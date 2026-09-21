import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prisma } from '@/lib/db/prisma';
import { createInstallationToken } from '@/lib/github/auth';

const API = 'https://api.github.com';
const VERSION = '2022-11-28';
const MAX_OUTPUT = 20_000;

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
      if (scripts.lint) commands.push({ label: 'lint', command: 'npm run lint' });
      if (scripts.typecheck) commands.push({ label: 'typecheck', command: 'npm run typecheck' });
      if (scripts.test) commands.push({ label: 'test', command: 'npm test -- --runInBand' });
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
  repoDir: string;
}) {
  const tree = await github<{ tree: TreeEntry[] }>(
    `${API}/repos/${input.owner}/${input.name}/git/trees/${encodeURIComponent(input.branch)}?recursive=1`,
    input.token,
  );

  const blobs = tree.tree.filter((entry) => entry.type === 'blob');
  await Promise.all(
    blobs.map(async (entry) => {
      const blob = await github<{ content?: string; encoding?: string }>(
        `${API}/repos/${input.owner}/${input.name}/git/blobs/${entry.sha}`,
        input.token,
      );

      if (blob.encoding !== 'base64' || !blob.content) return;

      const target = path.join(input.repoDir, entry.path);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, Buffer.from(blob.content.replace(/\n/g, ''), 'base64'));
    }),
  );
}

async function runCommand(command: string, cwd: string) {
  const { spawn } = await import('node:child_process');

  return new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
    const child = spawn(command, {
      cwd,
      env: { ...process.env, CI: '1' },
      shell: true,
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, 180_000);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
      if (stdout.length > MAX_OUTPUT * 2) stdout = stdout.slice(-MAX_OUTPUT * 2);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
      if (stderr.length > MAX_OUTPUT * 2) stderr = stderr.slice(-MAX_OUTPUT * 2);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ stdout: trimOutput(stdout), stderr: trimOutput(stderr || error.message), exitCode: 1 });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout: trimOutput(stdout), stderr: trimOutput(stderr), exitCode: code ?? 1 });
    });
  });
}

export async function validateRepositorySnapshot(input: {
  owner: string;
  name: string;
  branch: string;
  files: Array<{ path: string; content: string }>;
}) {
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
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'gitagent-'));
  const repoDir = path.join(tempRoot, 'repo');

  try {
    await mkdir(repoDir, { recursive: true });
    await downloadRepositorySnapshot({
      owner: input.owner,
      name: input.name,
      branch: input.branch,
      token: installation.token,
      repoDir,
    });

    for (const file of input.files) {
      const target = path.join(repoDir, file.path);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, file.content, 'utf8');
    }

    const trackedFiles = new Map<string, string>();
    for (const file of input.files) trackedFiles.set(file.path, file.content);

    try {
      const packageJson = await import('node:fs/promises').then((fs) => fs.readFile(path.join(repoDir, 'package.json'), 'utf8'));
      trackedFiles.set('package.json', packageJson);
    } catch {}
    try {
      const pyproject = await import('node:fs/promises').then((fs) => fs.readFile(path.join(repoDir, 'pyproject.toml'), 'utf8'));
      trackedFiles.set('pyproject.toml', pyproject);
    } catch {}
    try {
      const requirements = await import('node:fs/promises').then((fs) => fs.readFile(path.join(repoDir, 'requirements.txt'), 'utf8'));
      trackedFiles.set('requirements.txt', requirements);
    } catch {}

    const detected = detectCommands(trackedFiles);
    if (detected.commands.length === 0) {
      return { passed: true, projectType: detected.projectType, commands: [] } satisfies ValidationResult;
    }

    const results: ValidationResult['commands'] = [];
    for (const item of detected.commands) {
      const result = await runCommand(item.command, repoDir);
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
    await rm(tempRoot, { recursive: true, force: true });
  }
}
