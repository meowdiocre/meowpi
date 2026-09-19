import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  collapseTokens,
  normalizeSkillSnapshot,
  parseCommonArgs,
  pathExists,
  portablePathTokens,
  readJson,
  readText,
  repoRoot,
  run,
  runMain,
  stripYamlRootKeys,
  writeJson,
  writeText,
} from './lib.mjs';
import { verifyRepository } from './verify.mjs';

/** Keys that describe this machine rather than the MeowPi setup. */
const machineLocalSettings = ['shellPath'];

const sensitiveKeyPattern =
  /^(?:api[-_]?key|access[-_]?token|refresh[-_]?token|token|secret|password|credential|authorization)$/i;
const environmentReferencePattern = /^(?:[A-Z][A-Z0-9_]*|\$\{[A-Z0-9_]+\}|\{\{NPX\}\})$/;

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

/**
 * Reject literal credentials in YAML while allowing environment indirection.
 *
 * OMP treats an `apiKey` value as an environment variable name first, so
 * `apiKey: INFERHUB_API_KEY` is portable and stays exported.
 */
function assertNoLiteralSecrets(text, label) {
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z0-9_.-]+):\s*(.+)$/.exec(line);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    if (!sensitiveKeyPattern.test(match[1])) continue;
    if (environmentReferencePattern.test(value)) continue;
    throw new Error(`Refusing to export a literal credential from ${label}: ${match[1]}`);
  }
}

function resolveInstalledOmpVersion() {
  const reported = run('omp', ['--version'], { capture: true }).trim();
  const version = /^omp\/(\d+\.\d+\.\d+)/.exec(reported)?.[1];
  if (!version) throw new Error(`Unparsable OMP version output: ${reported}`);
  return version;
}

async function exportSettings(ompHome) {
  const configRoot = path.join(repoRoot, 'config');
  const settings = stripYamlRootKeys(
    await readText(path.join(ompHome, 'config.yml')),
    machineLocalSettings,
  );
  await writeText(path.join(configRoot, 'config.yml'), settings);
  console.log(`exported: ${path.join(configRoot, 'config.yml')}`);

  const models = await readText(path.join(ompHome, 'models.yml'));
  assertNoLiteralSecrets(models, 'models.yml');
  await writeText(path.join(configRoot, 'models.yml'), models);
  console.log(`exported: ${path.join(configRoot, 'models.yml')}`);
}

async function exportMcp(ompHome) {
  const liveMcp = await readJson(path.join(ompHome, 'mcp.json'));
  assertNoSensitiveKeys(liveMcp);

  const portableMcp = collapseTokens(
    { mcpServers: { ...(liveMcp.mcpServers || {}) } },
    portablePathTokens(),
  );
  for (const server of Object.values(portableMcp.mcpServers)) {
    if (server.command === 'npx' || server.command === 'npx.cmd') server.command = '{{NPX}}';
  }
  await writeJson(path.join(repoRoot, 'config', 'mcp.json.template'), portableMcp);
  console.log('exported: config/mcp.json.template');
}

async function exportExtensions(ompHome) {
  const configRoot = path.join(repoRoot, 'config');
  const extensionsRoot = path.join(configRoot, 'extensions');
  await mkdir(extensionsRoot, { recursive: true });

  for (const extension of await readdir(extensionsRoot)) {
    const source = path.join(ompHome, 'extensions', extension);
    if (!(await pathExists(source))) throw new Error(`Configured extension is missing: ${source}`);
    await cp(source, path.join(extensionsRoot, extension), { force: true });
    console.log(`exported: ${path.join('config/extensions', extension)}`);
  }
}

async function exportAgents(ompHome) {
  const agentsRoot = path.join(repoRoot, 'config', 'agents');
  await mkdir(agentsRoot, { recursive: true });

  const repoAgents = await readdir(agentsRoot);
  const liveAgentsRoot = path.join(ompHome, 'agents');
  const liveAgents = (await pathExists(liveAgentsRoot)) ? await readdir(liveAgentsRoot) : [];

  // A configured agent file missing from the install means the install drifted;
  // report it instead of silently dropping the agent from the portable set.
  for (const agent of repoAgents) {
    if (!liveAgents.includes(agent)) throw new Error(`Configured agent is missing from the install: ${agent}`);
    await cp(path.join(liveAgentsRoot, agent), path.join(agentsRoot, agent), { force: true });
    console.log(`exported: ${path.join('config/agents', agent)}`);
  }
}

async function refreshPinnedVersion() {
  const manifestPath = path.join(repoRoot, 'manifests', 'omp.json');
  const manifest = await readJson(manifestPath);
  manifest.version = resolveInstalledOmpVersion();
  await writeJson(manifestPath, manifest);
}

/**
 * Skill entries this repository owns outright.
 *
 * `skills/reverse-skill-router/upstream` is a byte-exact vendored snapshot that
 * `upstream-lock.json` verifies, and no install can reproduce it: a live tree
 * may hold a modified or tooling-redacted copy of those files. Export reads
 * skills *from* an install, so it must leave these entries alone.
 */
const repoOwnedSkillEntries = {
  'reverse-skill-router': ['upstream', 'upstream-lock.json'],
};

async function syncSkillTree(skillName, source, target) {
  const excluded = new Set(repoOwnedSkillEntries[skillName] ?? []);
  const existing = (await pathExists(target)) ? await readdir(target) : [];

  for (const entry of existing) {
    if (excluded.has(entry)) continue;
    await rm(path.join(target, entry), { recursive: true, force: true });
  }
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    await cp(path.join(source, entry.name), path.join(target, entry.name), {
      recursive: true,
      dereference: true,
      force: true,
      filter: (item) => !['.git', 'node_modules'].includes(path.basename(item)),
    });
  }
}

async function refreshSkillSnapshot(ompHome, skillManifestPath, skillManifest) {
  const liveSkillRoot = path.join(ompHome, 'skills');
  const repoSkillRoot = path.join(repoRoot, 'skills');
  const liveSkills = (await readdir(liveSkillRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => entry.name);
  const snapshotSkills = normalizeSkillSnapshot(liveSkills);

  for (const entry of await readdir(repoSkillRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && !snapshotSkills.includes(entry.name)) {
      await rm(path.join(repoSkillRoot, entry.name), { recursive: true, force: true });
    }
  }
  for (const skillName of snapshotSkills) {
    await syncSkillTree(skillName, path.join(liveSkillRoot, skillName), path.join(repoSkillRoot, skillName));
  }

  skillManifest.skills = snapshotSkills;
  await writeJson(skillManifestPath, skillManifest);
}

async function main() {
  const options = parseCommonArgs(process.argv.slice(2));
  if (options.dryRun || options.skipOmp || options.skipSkills) {
    throw new Error('export accepts only --omp-home');
  }

  await exportSettings(options.ompHome);
  await exportMcp(options.ompHome);
  await exportExtensions(options.ompHome);
  await exportAgents(options.ompHome);
  await refreshPinnedVersion();

  const skillManifestPath = path.join(repoRoot, 'manifests', 'skills.json');
  await refreshSkillSnapshot(options.ompHome, skillManifestPath, await readJson(skillManifestPath));

  await verifyRepository();
  console.log('MeowPi OMP configuration and complete skill snapshot refreshed. Review git diff.');
}

runMain(main);
