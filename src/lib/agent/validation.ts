import path from 'node:path';
import { Sandbox } from '@vercel/sandbox';
import { prisma } from '@/lib/db/prisma';
import { createInstallationToken } from '@/lib/github/auth';
import { isDocumentationOnly, validateRepositoryPath } from './validation-scope';

const API = 'https://api.github.com';
const VERSION = '2022-11-28';
const MAX_OUTPUT = 20_000;
const MAX_SNAPSHOT_BYTES = 25_000_000;
const REPO_DIR = '/vercel/sandbox/repo';

type ValidationCommand = {
  label: string;
  command: string;
};

export type ValidationResult = {
  passed: boolean;
  projectType: string;
  commands: Array<{
    label: string;
    command: string;
    exitCode: number;
    stdout: string;
    stderr: string;
  }>;
};

type TreeEntry = {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
};

function trimOutput(value: string) {
  return value.length > MAX_OUTPUT ? value.slice(-MAX_OUTPUT) : value;
}

function detectCommands(files: Map<string, string>): { projectType: string; commands: ValidationCommand[] } {
  const packageJson = files.get('package.json');
  if (packageJson) {
    try {
      const parsed = JSON.parse(packageJson) as { scripts?: Record<string, string> };
      const scripts = parsed.scripts ?? {};
      const commands: ValidationCommand[] = [];
      // `next lint` prompts for initial setup when no ESLint configuration exists.
      const lintConfigured = [...files.keys()].some((file) => /^(?:eslint\.config\.[cm]?js|\.eslintrc(?:\.[a-z]+)?)$/.test(file));
      if (scripts.lint && (scripts.lint !== 'next lint' || lintConfigured)) commands.push({ label: 'lint', command: 'npm run lint' });
      if (scripts['db:generate'] && scripts.typecheck) commands.push({ label: 'generate', command: 'npm run db:generate' });
      if (scripts.typecheck) commands.push({ label: 'typecheck', command: 'npm run typecheck' });
      if (scripts.test) commands.push({ label: 'test', command: 'npm test' });
      if (scripts.build) commands.push({ label: 'build', command: 'npm run build' });
      return { projectType: 'node', commands };
    } catch {
      return { projectType: 'node', commands: [{ label: 'build', command: 'npm run build' }] };
    }
  }

  if (files.has('pyproject.toml') || files.has('requirements.txt')) {
    return {
      projectType: 'python',
      commands: [{ label: 'test', command: 'python -m pytest -q' }],
    };
  }

  return { projectType: 'unknown', commands: [] };
}

async function github<T>(url: string, token: string) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': VERSION,
      'User-Agent': 'GitAgent-Control',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed (${response.status}).`);
  }

  return response.json() as Promise<T>;
}

async function downloadRepositorySnapshot(input: {
  owner: string;
  name: string;
  branch: string;
  token: string;
  sandbox: Sandbox;
}) {
  const tree = await github<{ tree: TreeEntry[]; truncated?: boolean }>(
    `${API}/repos/${input.owner}/${input.name}/git/trees/${encodeURIComponent(input.branch)}?recursive=1`,
    input.token,
  );

  if (tree.truncated) throw new Error('Repository snapshot is truncated.');
  const blobs = tree.tree.filter((entry) => entry.type === 'blob');
  if (blobs.reduce((sum, entry) => sum + (entry.size ?? 0), 0) > MAX_SNAPSHOT_BYTES) {
    throw new Error('Repository snapshot exceeds the validation size limit.');
  }
  const downloaded = await Promise.all(
    blobs.map(async (entry) => {
      const file = validateRepositoryPath(entry.path);
      const blob = await github<{ content?: string; encoding?: string }>(
        `${API}/repos/${input.owner}/${input.name}/git/blobs/${entry.sha}`,
        input.token,
      );

      if (blob.encoding !== 'base64' || !blob.content) throw new Error('Repository blob cannot be decoded.');
      return { path: file, content: Buffer.from(blob.content.replace(/\n/g, ''), 'base64') };
    }),
  );
  if (downloaded.reduce((sum, file) => sum + file.content.length, 0) > MAX_SNAPSHOT_BYTES) {
    throw new Error('Repository snapshot exceeds the validation size limit.');
  }
  const directories = [...new Set(downloaded.map((file) => path.posix.dirname(file.path)).filter((dir) => dir !== '.'))];
  if (directories.length) {
    const mkdirResult = await input.sandbox.runCommand('mkdir', ['-p', ...directories.map((dir) => `${REPO_DIR}/${dir}`)]);
    if (mkdirResult.exitCode !== 0) throw new Error('Could not prepare sandbox repository directories.');
  }
  for (let i = 0; i < downloaded.length; i += 25) {
    await input.sandbox.writeFiles(downloaded.slice(i, i + 25).map((file) => ({ path: `${REPO_DIR}/${file.path}`, content: file.content })));
  }
  return downloaded;
}

async function runCommand(command: string, sandbox: Sandbox) {
  const result = await sandbox.runCommand({
    cmd: 'sh', args: ['-lc', command], cwd: REPO_DIR, env: { CI: '1' },
    signal: AbortSignal.timeout(180_000),
  });
  return { stdout: trimOutput(await result.stdout()), stderr: trimOutput(await result.stderr()), exitCode: result.exitCode };
}

export async function validateRepositorySnapshot(input: {
  owner: string;
  name: string;
  branch: string;
  files: Array<{ path: string; content: string }>;
}) {
  if (isDocumentationOnly(input.files.map((file) => file.path))) {
    return { passed: true, projectType: 'documentation', commands: [] } satisfies ValidationResult;
  }

  const repository = await prisma.repository.findFirst({
    where: { provider: 'github', owner: input.owner, name: input.name },
    select: {
      user: {
        select: { githubInstallationId: true },
      },
    },
  });

  const installationId = repository?.user?.githubInstallationId;
  if (!installationId) {
    throw new Error('GitHub installation is not linked to the repository owner.');
  }

  const installation = await createInstallationToken(installationId);
  // Only the npm registry is reachable while dependencies are installed.
  // No GitHub token, database URL, or application environment is passed into the VM.
  const sandbox = await Sandbox.create({ runtime: 'node24', timeout: 300_000, networkPolicy: { allow: ['registry.npmjs.org'] } });

  try {
    await sandbox.mkDir(REPO_DIR);
    const downloaded = await downloadRepositorySnapshot({
      owner: input.owner,
      name: input.name,
      branch: input.branch,
      token: installation.token,
      sandbox,
    });

    for (const file of input.files) {
      validateRepositoryPath(file.path);
      await sandbox.writeFiles([{ path: `${REPO_DIR}/${file.path}`, content: Buffer.from(file.content, 'utf8') }]);
    }

    const trackedFiles = new Map<string, string>();
    for (const file of downloaded) {
      if (['package.json', 'pyproject.toml', 'requirements.txt'].includes(file.path)) {
        trackedFiles.set(file.path, file.content.toString('utf8'));
      } else if (/^(?:eslint\.config\.[cm]?js|\.eslintrc(?:\.[a-z]+)?)$/.test(file.path)) {
        trackedFiles.set(file.path, '');
      }
    }
    for (const file of input.files) trackedFiles.set(file.path, file.content);

    const detected = detectCommands(trackedFiles);
    if (detected.commands.length === 0) {
      await sandbox.update({ networkPolicy: 'deny-all' });
      return { passed: true, projectType: detected.projectType, commands: [] } satisfies ValidationResult;
    }

    const results: ValidationResult['commands'] = [];
    if (detected.projectType === 'node') {
      const hasLockfile = input.files.some((file) => file.path === 'package-lock.json') || downloaded.some((file) => file.path === 'package-lock.json');
      const installCommand = hasLockfile
        ? 'npm ci --ignore-scripts --no-audit --no-fund'
        : 'npm install --ignore-scripts --no-save --no-package-lock --no-audit --no-fund';
      const installation = await runCommand(installCommand, sandbox);
      results.push({ label: 'dependencies', command: installCommand, ...installation });
      if (installation.exitCode !== 0) {
        return { passed: false, projectType: detected.projectType, commands: results } satisfies ValidationResult;
      }
    }
    // Repository scripts are untrusted. Deny all egress before any are executed.
    await sandbox.update({ networkPolicy: 'deny-all' });
    for (const item of detected.commands) {
      const result = await runCommand(item.command, sandbox);
      results.push({
        label: item.label,
        command: item.command,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      });
      if (result.exitCode !== 0) break;
    }

    return {
      passed: results.every((result) => result.exitCode === 0),
      projectType: detected.projectType,
      commands: results,
    } satisfies ValidationResult;
  } finally {
    await sandbox.stop();
  }
}
