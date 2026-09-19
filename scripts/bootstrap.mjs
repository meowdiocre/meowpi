import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  backupExisting,
  expandTokens,
  installDirectory,
  installFile,
  installText,
  isWindows,
  parseCommonArgs,
  pathExists,
  portablePathTokens,
  readJson,
  readText,
  repoRoot,
  run,
  runMain,
  setYamlRootScalar,
  sortedStrings,
  timestamp,
  userHome,
} from './lib.mjs';
import { verifyRepository } from './verify.mjs';

const minimumBun = [1, 3, 14];
const gitBashCandidates = [
  path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
  path.join(userHome, 'AppData', 'Local', 'Programs', 'Git', 'bin', 'bash.exe'),
];

function parseVersion(text) {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(text);
  if (!match) throw new Error(`Unparsable version: ${text.trim()}`);
  return match.slice(1, 4).map(Number);
}

function isOlderThan(actual, minimum) {
  for (let index = 0; index < minimum.length; index += 1) {
    if (actual[index] !== minimum[index]) return actual[index] < minimum[index];
  }
  return false;
}

function requireBun() {
  const version = parseVersion(run('bun', ['--version'], { capture: true }));
  if (isOlderThan(version, minimumBun)) {
    throw new Error(`Bun ${minimumBun.join('.')} or later is required, found ${version.join('.')}`);
  }
}

async function findGitBash() {
  for (const candidate of gitBashCandidates) {
    if (await pathExists(candidate)) return candidate;
  }
  return null;
}

async function installOmp(options) {
  const omp = await readJson(path.join(repoRoot, 'manifests', 'omp.json'));
  if (options.skipOmp) {
    console.log(`[skipped] ${omp.package}@${omp.version}`);
    return;
  }
  if (!options.dryRun) requireBun();
  run('bun', ['install', '--global', `${omp.package}@${omp.version}`], { dryRun: options.dryRun });
}

async function installConfiguration(options, backupRoot) {
  const configRoot = path.join(repoRoot, 'config');

  let settings = await readText(path.join(configRoot, 'config.yml'));
  if (isWindows) {
    const gitBash = await findGitBash();
    if (gitBash) settings = setYamlRootScalar(settings, 'shellPath', gitBash);
    else console.log('note: no Git Bash found; OMP will use its own shell lookup');
  }
  await installText(
    path.join(options.ompHome, 'config.yml'),
    settings,
    backupRoot,
    'config.yml',
    options.dryRun,
  );

  await installFile(
    path.join(configRoot, 'models.yml'),
    path.join(options.ompHome, 'models.yml'),
    backupRoot,
    'models.yml',
    options.dryRun,
  );

  const mcpTemplate = await readJson(path.join(configRoot, 'mcp.json.template'));
  const renderedMcp = expandTokens(
    { mcpServers: mcpTemplate.mcpServers },
    { ...portablePathTokens(), NPX: isWindows ? 'npx.cmd' : 'npx' },
  );
  await installText(
    path.join(options.ompHome, 'mcp.json'),
    `${JSON.stringify(renderedMcp, null, 2)}\n`,
    backupRoot,
    'mcp.json',
    options.dryRun,
  );

  for (const extension of sortedStrings(await readdir(path.join(configRoot, 'extensions')))) {
    await installFile(
      path.join(configRoot, 'extensions', extension),
      path.join(options.ompHome, 'extensions', extension),
      backupRoot,
      path.join('extensions', extension),
      options.dryRun,
    );
  }

  for (const agent of sortedStrings(await readdir(path.join(configRoot, 'agents')))) {
    await installFile(
      path.join(configRoot, 'agents', agent),
      path.join(options.ompHome, 'agents', agent),
      backupRoot,
      path.join('agents', agent),
      options.dryRun,
    );
  }
}

/**
 * Install the manifest skills and drop anything else already in the target.
 *
 * The repository is the single source of truth for this tree, so an unlisted
 * skill directory is a stale copy that drifts silently. Each removal is backed
 * up first.
 */
async function installSkills(options, backupRoot) {
  const manifest = await readJson(path.join(repoRoot, 'manifests', 'skills.json'));
  const installed = new Set(manifest.skills);

  for (const target of manifest.targets) {
    const targetRoot = expandTokens(target.path, {
      HOME: userHome,
      OMP_HOME: options.ompHome,
    });

    for (const skillName of manifest.skills) {
      await installDirectory(
        path.join(repoRoot, 'skills', skillName),
        path.join(targetRoot, skillName),
        backupRoot,
        path.join(`skills/${target.name}`, skillName),
        options.dryRun,
      );
    }

    if (!(await pathExists(targetRoot))) continue;
    const stale = (await readdir(targetRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => entry.name)
      .filter((name) => !installed.has(name));

    for (const skillName of sortedStrings(stale)) {
      const targetPath = path.join(targetRoot, skillName);
      await backupExisting(
        targetPath,
        backupRoot,
        path.join(`skills/${target.name}`, skillName),
        options.dryRun,
      );
      if (options.dryRun) {
        console.log(`[dry-run] prune ${targetPath}`);
        continue;
      }
      await rm(targetPath, { recursive: true, force: true });
      console.log(`pruned stale skill: ${targetPath}`);
    }
  }
}

async function main() {
  const options = parseCommonArgs(process.argv.slice(2));
  const backupRoot = path.join(options.ompHome, 'portable-backups', timestamp());

  console.log('==> Validate repository');
  await verifyRepository();

  console.log('\n==> Install pinned OMP CLI');
  await installOmp(options);

  console.log('\n==> Restore MeowPi configuration');
  await installConfiguration(options, backupRoot);

  if (!options.skipSkills) {
    console.log('\n==> Restore complete skill snapshot');
    await installSkills(options, backupRoot);
  }

  console.log('\n==> Complete');
  console.log('MeowPi is installed. Authenticate providers locally on this device.');
  if (!options.dryRun) console.log(`Backups: ${backupRoot}`);
}

runMain(main);
