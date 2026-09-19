import { cp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  collapseTokens,
  commandName,
  normalizeSkillSnapshot,
  parseCommonArgs,
  pathExists,
  portablePathTokens,
  readJson,
  repoRoot,
  run,
  runMain,
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

function resolveInstalledVersion(installed, name, label) {
  const version = installed.dependencies?.[name]?.version;
  if (!version) throw new Error(`${label} is not installed: ${name}`);
  return version;
}

async function refreshPinnedVersions(manifestPath, installed, label) {
  const manifest = await readJson(manifestPath);
  if (Array.isArray(manifest)) {
    for (const entry of manifest) {
      entry.version = resolveInstalledVersion(installed, entry.name, label);
    }
  } else {
    manifest.version = resolveInstalledVersion(installed, manifest.package, label);
  }
  await writeJson(manifestPath, manifest);
}

async function refreshSkillSnapshot(piHome, skillManifestPath, skillManifest) {
  const liveSkillRoot = path.join(piHome, 'skills');
  const repoSkillRoot = path.join(repoRoot, 'skills');
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

  const portableMcp = collapseTokens(
    { mcpServers: { ...(liveMcp.mcpServers || {}) } },
    portablePathTokens(),
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
  await refreshPinnedVersions(
    path.join(manifestRoot, 'pi-packages.json'),
    installedPackages,
    'Pinned Pi package',
  );

  const globalPackages = JSON.parse(
    run(npm, ['list', '--global', '--depth=0', '--json'], { capture: true }),
  );
  await refreshPinnedVersions(path.join(manifestRoot, 'pi.json'), globalPackages, 'Configured Pi package');

  const skillManifestPath = path.join(manifestRoot, 'skills.json');
  const skillManifest = await readJson(skillManifestPath);
  await refreshSkillSnapshot(options.piHome, skillManifestPath, skillManifest);

  await verifyRepository();
  console.log('MeowPi configuration and complete skill snapshot refreshed. Review git diff.');
}

runMain(main);
