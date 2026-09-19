import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const userHome = homedir();
export const isWindows = process.platform === 'win32';

export function commandName(base) {
  return isWindows ? `${base}.cmd` : base;
}

export async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function readJson(target) {
  const text = await readFile(target, 'utf8');
  return JSON.parse(text.replace(/^\uFEFF/, ''));
}

export async function writeJson(target, value) {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, target);
}

export async function walkFiles(root, { skip = [] } = {}) {
  const skipped = new Set(skip);
  const files = [];
  async function walk(directory, relative) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (skipped.has(entry.name)) continue;
      const child = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), child);
      else if (entry.isFile()) files.push(child);
      else throw new Error(`Unsupported path entry: ${child}`);
    }
  }
  await walk(root, '');
  return files.sort();
}

export function run(command, args, { capture = false, dryRun = false } = {}) {
  console.log(`> ${command} ${args.join(' ')}`);
  if (dryRun) return '';

  let executable = command;
  let argumentList = args;
  if (isWindows && command.toLowerCase().endsWith('.cmd')) {
    executable = process.env.ComSpec || 'cmd.exe';
    argumentList = ['/d', '/c', command, ...args];
  }

  const result = spawnSync(executable, argumentList, {
    encoding: capture ? 'utf8' : undefined,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = capture ? `\n${result.stderr || result.stdout}` : '';
    throw new Error(`${command} exited with code ${result.status}${detail}`);
  }
  return capture ? result.stdout : '';
}

export function timestamp() {
  return new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
}

export async function backupExisting(target, backupRoot, label, dryRun) {
  if (!(await pathExists(target))) return;
  const backupTarget = path.join(backupRoot, label);
  if (dryRun) {
    console.log(`[dry-run] backup ${target} -> ${backupTarget}`);
    return;
  }
  await mkdir(path.dirname(backupTarget), { recursive: true });
  await cp(target, backupTarget, { recursive: true, dereference: true, force: true });
}

export async function installFile(source, target, backupRoot, label, dryRun) {
  await backupExisting(target, backupRoot, label, dryRun);
  if (dryRun) {
    console.log(`[dry-run] install ${source} -> ${target}`);
    return;
  }
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target, { force: true });
  console.log(`installed: ${target}`);
}

export async function installDirectory(source, target, backupRoot, label, dryRun) {
  await backupExisting(target, backupRoot, label, dryRun);
  if (dryRun) {
    console.log(`[dry-run] install ${source} -> ${target}`);
    return;
  }
  await rm(target, { recursive: true, force: true });
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target, {
    recursive: true,
    dereference: true,
    force: true,
    filter: (entry) => !['.git', 'node_modules'].includes(path.basename(entry)),
  });
  console.log(`installed: ${target}`);
}

export async function installText(target, content, backupRoot, label, dryRun) {
  await backupExisting(target, backupRoot, label, dryRun);
  if (dryRun) {
    console.log(`[dry-run] install -> ${target}`);
    return;
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
  console.log(`installed: ${target}`);
}

export function mapStrings(value, transform) {
  if (typeof value === 'string') return transform(value);
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, transform));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, mapStrings(item, transform)]),
    );
  }
  return value;
}

export function expandTokens(value, replacements) {
  return mapStrings(value, (input) =>
    Object.entries(replacements).reduce(
      (result, [token, replacement]) => result.split(`{{${token}}}`).join(replacement || ''),
      input,
    ),
  );
}

export function collapseTokens(value, replacements) {
  const ordered = Object.entries(replacements)
    .filter(([, replacement]) => replacement)
    .sort((left, right) => right[1].length - left[1].length);
  return mapStrings(value, (input) =>
    ordered.reduce(
      (result, [token, replacement]) => result.split(replacement).join(`{{${token}}}`),
      input,
    ),
  );
}

export function sortedStrings(values) {
  return [...values].sort();
}

export function normalizeSkillSnapshot(liveSkills) {
  return sortedStrings(new Set(liveSkills));
}

export function parseCommonArgs(argv) {
  const options = {
    dryRun: false,
    piHome: process.env.PI_HOME || path.join(userHome, '.pi', 'agent'),
    skipPi: false,
    skipPackages: false,
    skipSkills: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '--skip-pi') options.skipPi = true;
    else if (argument === '--skip-packages') options.skipPackages = true;
    else if (argument === '--skip-skills') options.skipSkills = true;
    else if (argument === '--pi-home') {
      index += 1;
      if (!argv[index]) throw new Error('--pi-home requires a path');
      options.piHome = path.resolve(argv[index]);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

export function portablePathTokens() {
  return {
    HOME: userHome,
    USERPROFILE: userHome,
    PROGRAMFILES_X86: process.env['ProgramFiles(x86)'] || '',
    SYSTEMDRIVE: process.env.SystemDrive || path.parse(userHome).root.replace(/[\\/]$/, ''),
  };
}

export function runMain(main) {
  main().catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}
