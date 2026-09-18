import { cp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  collapseTokens,
  commandName,
  normalizeSkillSnapshot,
  parseCommonArgs,
  pathExists,
  readJson,
  repoRoot,
  run,
  userHome,
  writeJson,
} from './lib.mjs';
import { verifyRepository } from './verify.mjs';

const sensitiveKeyPattern = /^(?:api[-_]?key|access[-_]?token|refresh[-_]?token|token|secret|password|credential|authorization)$/i;

function assertNoSensitiveKeys(value, jsonPath = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveKeys(item, `${jsonPath}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (sensitiveKeyPattern.test(key)) {
      throw new Error(`Refusing to export credential-shaped property: ${jsonPath}.${key}`);
    }
    assertNoSensitiveKeys(item, `${jsonPath}.${key}`);
  }
}

async function exportJson(source, target, transform = (value) => value) {
  const value = await readJson(source);
  assertNoSensitiveKeys(value);
  await writeJson(target, transform(value));
  console.log(`exported: ${target}`);
}

async function main() {
  const options = parseCommonArgs(process.argv.slice(2));
  if (options.dryRun || options.skipPi || options.skipPackages || options.skipSkills) {
    throw new Error('export accepts only --pi-home');
  }

  const configRoot = path.join(repoRoot, 'config');
  const manifestRoot = path.join(repoRoot, 'manifests');
  await mkdir(path.join(configRoot, 'extensions'), { recursive: true });

  await exportJson(
    path.join(options.piHome, 'settings.json'),
    path.join(configRoot, 'settings.json'),
    (settings) => {
      const { lastChangelogVersion, ...portable } = settings;
      return portable;
    },
  );
  await exportJson(
    path.join(options.piHome, 'models.json'),
    path.join(configRoot, 'models.json'),
  );

  const liveMcp = await readJson(path.join(options.piHome, 'mcp.json'));
  assertNoSensitiveKeys(liveMcp);
  const currentTemplate = await readJson(path.join(configRoot, 'mcp.json.template'));
  const liveServers = { ...(liveMcp.mcpServers || {}) };
  const platformServers = { ...(currentTemplate.platformServers || {}) };
  if (process.platform === 'win32' && liveServers.windbg) {
    platformServers.win32 = { windbg: liveServers.windbg };
    delete liveServers.windbg;
  }

  const portableMcp = collapseTokens(
    {
      mcpServers: liveServers,
      platformServers,
    },
    {
      PROGRAMFILES_X86: process.env['ProgramFiles(x86)'],
      USERPROFILE: userHome,
      HOME: userHome,
      SYSTEMDRIVE: process.env.SystemDrive,
    },
  );
  for (const server of Object.values(portableMcp.mcpServers)) {
    if (server.command === 'npx' || server.command === 'npx.cmd') server.command = '{{NPX}}';
  }
  await writeJson(path.join(configRoot, 'mcp.json.template'), portableMcp);

  const extensions = await readJson(path.join(manifestRoot, 'extensions.json'));
  for (const extension of extensions) {
    const source = path.join(options.piHome, 'extensions', extension);
    if (!(await pathExists(source))) throw new Error(`Configured extension is missing: ${source}`);
    await cp(source, path.join(configRoot, 'extensions', extension), { force: true });
  }

  const npm = commandName('npm');
  const installedPackages = JSON.parse(
    run(npm, ['--prefix', path.join(options.piHome, 'npm'), 'list', '--depth=0', '--json'], {
      capture: true,
    }),
  );
  const packageManifestPath = path.join(manifestRoot, 'pi-packages.json');
  const packages = await readJson(packageManifestPath);
  for (const entry of packages) {
    const installed = installedPackages.dependencies?.[entry.name];
    if (!installed) throw new Error(`Pinned Pi package is not installed: ${entry.name}`);
    entry.version = installed.version;
  }
  await writeJson(packageManifestPath, packages);

  const piManifestPath = path.join(manifestRoot, 'pi.json');
  const piManifest = await readJson(piManifestPath);
  const globalPackages = JSON.parse(
    run(npm, ['list', '--global', '--depth=0', '--json'], { capture: true }),
  );
  const installedPi = globalPackages.dependencies?.[piManifest.package];
  if (!installedPi) throw new Error(`Configured Pi package is not installed: ${piManifest.package}`);
  piManifest.version = installedPi.version;
  await writeJson(piManifestPath, piManifest);

  const liveSkillRoot = path.join(options.piHome, 'skills');
  const repoSkillRoot = path.join(repoRoot, 'skills');
  const skillManifestPath = path.join(manifestRoot, 'skills.json');
  const skillManifest = await readJson(skillManifestPath);
  const liveSkills = (await readdir(liveSkillRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => entry.name);
  const snapshotSkills = normalizeSkillSnapshot(liveSkills);

  const existingSkills = await readdir(repoSkillRoot, { withFileTypes: true });
  for (const entry of existingSkills) {
    if (entry.isDirectory() && !snapshotSkills.includes(entry.name)) {
      await rm(path.join(repoSkillRoot, entry.name), { recursive: true, force: true });
    }
  }
  for (const skillName of snapshotSkills) {
    const source = path.join(liveSkillRoot, skillName);
    const target = path.join(repoSkillRoot, skillName);
    await rm(target, { recursive: true, force: true });
    await cp(source, target, {
      recursive: true,
      dereference: true,
      force: true,
      filter: (entry) => !['.git', 'node_modules'].includes(path.basename(entry)),
    });
  }

  skillManifest.skills = snapshotSkills;
  await writeJson(skillManifestPath, skillManifest);

  await verifyRepository();
  console.log('MeowPi configuration and complete skill snapshot refreshed. Review git diff.');
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
