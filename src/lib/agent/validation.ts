import { exec } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { createInstallationToken } from '@/lib/github/auth';

const execAsync = promisify(exec);
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
      commands: [
        { label: 'test', command: 'python -m pytest -q' },
      ],
    };
  }

  return { projectType: 'unknown', commands: [] };
}

export async function validateRepositorySnapshot(input: {
  owner: string;
  name: string;
  branch: string;
  files: Array<{ path: string; content: string }>;
}) {
  const token = await createInstallationToken();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'gitagent-'));
  const repoDir = path.join(tempRoot, 'repo');

  try {
    const cloneUrl = `https://x-access-token:${token.token}@github.com/${input.owner}/${input.name}.git`;
    await execAsync(`git clone --depth 1 --branch ${input.branch} "${cloneUrl}" "${repoDir}"`, {
      timeout: 120_000,
      maxBuffer: 5 * 1024 * 1024,
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
      try {
        const { stdout, stderr } = await execAsync(item.command, {
          cwd: repoDir,
          timeout: 180_000,
          maxBuffer: 10 * 1024 * 1024,
          env: { ...process.env, CI: '1' },
        });
        results.push({ label: item.label, command: item.command, exitCode: 0, stdout: trimOutput(stdout), stderr: trimOutput(stderr) });
      } catch (error) {
        const failure = error as { code?: number; stdout?: string; stderr?: string; message?: string };
        results.push({
          label: item.label,
          command: item.command,
          exitCode: typeof failure.code === 'number' ? failure.code : 1,
          stdout: trimOutput(failure.stdout ?? ''),
          stderr: trimOutput(failure.stderr ?? failure.message ?? ''),
        });
        break;
      }
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
