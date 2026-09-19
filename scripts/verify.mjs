import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  pathExists,
  readJson,
  readText,
  repoRoot,
  runMain,
  sortedStrings,
  userHome,
  walkFiles,
  yamlBlock,
  yamlRootEntries,
} from './lib.mjs';
import { verifyReverseBundle } from './reverse-bundle.mjs';

const requiredFiles = [
  '.gitignore',
  'README.md',
  'THIRD_PARTY_NOTICES.md',
  'assets/meowpi-logo.jpg',
  'package.json',
  'config/config.yml',
  'config/models.yml',
  'config/mcp.json.template',
  'config/extensions/herdr-omp-agent-state.ts',
  'config/agents/consultant.md',
  'manifests/omp.json',
  'manifests/skill-sources.json',
  'manifests/skills.json',
  'scripts/bootstrap.mjs',
  'scripts/export.mjs',
  'scripts/lib.mjs',
  'scripts/verify.mjs',
  'scripts/tests/export-skills.mjs',
  'scripts/tests/reverse-bundle.mjs',
];

const yamlFiles = ['config/config.yml', 'config/models.yml'];
const portableFiles = [...yamlFiles, 'config/mcp.json.template'];
const forbiddenFilePattern = /(^|\/)(auth\.json|\.env(?:\..*)?|[^/]+\.(?:pem|key))$/i;
const secretPatterns = [
  /\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{16,}/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

/**
 * Every foreign skill source OMP could read. MeowPi installs into the
 * OMP-native tree, so all of them must stay disabled or a second copy of a
 * skill can load from a tree this repository does not own.
 */
const foreignSkillSources = [
  'enableCodexUser',
  'enableClaudeUser',
  'enableClaudeProject',
  'enableAgentsUser',
  'enableAgentsProject',
];

const requiredPortableSkills = [
  'assembly-systems',
  'caveman-commit',
  'code-standards',
  'consult',
  'git-workflow',
  'modern-cpp',
  'research-router',
  'reverse-skill-router',
  'rust-best-practices',
  'systems-coding-style',
];

async function requireFiles(kind, relativeFiles) {
  for (const relative of relativeFiles) {
    if (!(await pathExists(path.join(repoRoot, relative)))) {
      throw new Error(`${kind} is missing: ${relative}`);
    }
  }
}

async function verifySkillBaseline() {
  const skillManifest = await readJson(path.join(repoRoot, 'manifests', 'skills.json'));
  const unknownFields = Object.keys(skillManifest).filter((field) => !['skills', 'targets'].includes(field));
  if (unknownFields.length > 0) {
    throw new Error(`manifests/skills.json contains unknown fields: ${unknownFields.join(', ')}`);
  }
  if (!Array.isArray(skillManifest.skills)) throw new Error('manifests/skills.json skills must be an array');
  if (new Set(skillManifest.skills).size !== skillManifest.skills.length) {
    throw new Error('manifests/skills.json contains duplicate skill names');
  }
  for (const skillName of requiredPortableSkills) {
    if (!skillManifest.skills.includes(skillName)) {
      throw new Error(`Required portable skill is absent from the baseline: ${skillName}`);
    }
  }

  const targets = JSON.stringify(skillManifest.targets);
  if (targets !== JSON.stringify([{ name: 'omp', path: '{{OMP_HOME}}/skills' }])) {
    throw new Error('Skills must install into the OMP-native tree only');
  }

  const skillRoot = path.join(repoRoot, 'skills');
  const skillDirectories = (await readdir(skillRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  if (JSON.stringify(sortedStrings(skillManifest.skills)) !== JSON.stringify(sortedStrings(skillDirectories))) {
    throw new Error('manifests/skills.json does not match the vendored skill directories');
  }

  for (const skillName of skillManifest.skills) {
    const skillFile = path.join(skillRoot, skillName, 'SKILL.md');
    if (!(await pathExists(skillFile))) throw new Error(`Missing SKILL.md for ${skillName}`);
    const frontmatter = (await readFile(skillFile, 'utf8')).match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const declaredName = frontmatter?.[1].match(/^name:\s*([^\r\n]+)$/m)?.[1]?.trim();
    if (declaredName !== skillName) {
      throw new Error(`Skill name mismatch: directory=${skillName}, frontmatter=${declaredName || 'missing'}`);
    }
  }

  return skillManifest;
}

async function verifySkillSources(skillManifest, reverseBundle) {
  const sourceManifest = await readJson(path.join(repoRoot, 'manifests', 'skill-sources.json'));
  if (!Array.isArray(sourceManifest)) throw new Error('manifests/skill-sources.json must be an array');
  if (sourceManifest.find((source) => source.name === 'reverse-skill-router')?.ref !== reverseBundle.ref) {
    throw new Error('Reverse-skill source pin does not match the bundled snapshot');
  }

  const sourceNames = new Set();
  for (const source of sourceManifest) {
    if (!source || typeof source !== 'object') throw new Error('Invalid skill source entry');
    if (sourceNames.has(source.name)) throw new Error(`Duplicate skill source: ${source.name}`);
    sourceNames.add(source.name);
    if (!skillManifest.skills.includes(source.name)) {
      throw new Error(`Vendored source is absent from the skill baseline: ${source.name}`);
    }
    if (!/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(source.repository || '')) {
      throw new Error(`Invalid GitHub repository for skill source: ${source.name}`);
    }
    if (!/^[0-9a-f]{40}$/.test(source.ref || '')) {
      throw new Error(`Skill source must pin a full commit SHA: ${source.name}`);
    }
    if (!source.path || !source.license || source.modified !== true) {
      throw new Error(`Incomplete skill source metadata: ${source.name}`);
    }
  }
}

async function verifyContentGuards(files) {
  for (const relative of files) {
    if (
      forbiddenFilePattern.test(relative) ||
      (!relative.startsWith('skills/reverse-skill-router/upstream/') &&
        !(relative.startsWith('skills/powerskills/') && relative.endsWith('.ps1')) &&
        /\.(?:ps1|cmd)$/i.test(relative))
    ) {
      throw new Error(`Forbidden platform-specific or credential file: ${relative}`);
    }
    const text = await readFile(path.join(repoRoot, relative), 'utf8');
    for (const pattern of secretPatterns) {
      if (pattern.test(text)) throw new Error(`Potential secret found in ${relative}`);
    }
  }

  const escapedHome = JSON.stringify(userHome).slice(1, -1);
  const programFilesX86 = process.env['ProgramFiles(x86)'];
  const machineLiterals = [userHome, escapedHome, programFilesX86].filter(
    (value) => typeof value === 'string' && value.length > 3,
  );
  for (const relative of portableFiles) {
    const text = await readText(path.join(repoRoot, relative));
    for (const literal of machineLiterals) {
      if (text.includes(literal)) {
        throw new Error(`Machine-specific path found in ${relative}: ${literal}`);
      }
    }
    const drivePath = /[A-Za-z]:\\/.exec(text);
    if (drivePath) {
      throw new Error(`Machine-specific path found in ${relative}: ${drivePath[0]}`);
    }
  }
}

async function verifyOmpConfiguration() {
  const settingsText = await readText(path.join(repoRoot, 'config', 'config.yml'));

  const settings = yamlRootEntries(settingsText);
  if (settings.get('shellPath') !== undefined) {
    throw new Error('config/config.yml must stay portable; shellPath belongs to the local install');
  }
  if (settings.get('modelRoles') !== null) {
    throw new Error('config/config.yml must define a modelRoles block');
  }

  const skills = yamlRootEntries(yamlBlock(settingsText, 'skills'));
  const disabled = sortedStrings(
    [...skills].filter(([, value]) => value === 'false').map(([key]) => key),
  );
  if (JSON.stringify(disabled) !== JSON.stringify(sortedStrings(foreignSkillSources))) {
    throw new Error(
      `config/config.yml must disable every foreign skill source: ${foreignSkillSources.join(', ')}`,
    );
  }

  const models = yamlRootEntries(await readText(path.join(repoRoot, 'config', 'models.yml')));
  if (models.get('providers') !== null) {
    throw new Error('config/models.yml must define a providers block');
  }

  const omp = await readJson(path.join(repoRoot, 'manifests', 'omp.json'));
  const unknownOmpFields = Object.keys(omp).filter((field) => !['package', 'version'].includes(field));
  if (unknownOmpFields.length > 0) {
    throw new Error(`manifests/omp.json contains unknown fields: ${unknownOmpFields.join(', ')}`);
  }
  if (omp.package !== '@oh-my-pi/pi-coding-agent') {
    throw new Error('manifests/omp.json must pin the OMP coding agent package');
  }
  if (!/^\d+\.\d+\.\d+$/.test(omp.version || '')) {
    throw new Error('manifests/omp.json must pin an exact version');
  }
}

async function verifyConsultAgent() {
  const skillFile = path.join(repoRoot, 'skills', 'consult', 'SKILL.md');
  const skill = await readText(skillFile);
  const referenced = skill.match(/"agent":\s*"([a-z0-9-]+)"/);
  if (!referenced) throw new Error('The consult skill must dispatch a named agent');

  const agentName = referenced[1];
  const agentFile = path.join(repoRoot, 'config', 'agents', `${agentName}.md`);
  if (!(await pathExists(agentFile))) {
    throw new Error(`The consult skill dispatches "${agentName}", which config/agents does not define`);
  }
  const declared = (await readText(agentFile)).match(/^name:\s*([^\r\n]+)$/m)?.[1]?.trim();
  if (declared !== agentName) {
    throw new Error(`Agent name mismatch: file=${agentName}, frontmatter=${declared || 'missing'}`);
  }
}

async function verifyMcp() {
  const mcp = await readJson(path.join(repoRoot, 'config', 'mcp.json.template'));
  if (mcp.mcpServers?.exa?.url !== 'https://mcp.exa.ai/mcp?tools=web_search_exa,web_fetch_exa,web_search_advanced_exa') {
    throw new Error('Exa MCP must expose search, fetch, and advanced search');
  }
  if (mcp.mcpServers?.exa?.headers?.['x-api-key'] !== '${EXA_API_KEY}') {
    throw new Error('Exa MCP must read its API key from EXA_API_KEY');
  }
  if (mcp.mcpServers?.context7?.url !== 'https://mcp.context7.com/mcp') {
    throw new Error('Context7 MCP is missing or misconfigured');
  }
  if (mcp.mcpServers?.deepwiki?.url !== 'https://mcp.deepwiki.com/mcp') {
    throw new Error('DeepWiki MCP is missing or misconfigured');
  }

  const windbgArgs = mcp.mcpServers?.windbg?.args || [];
  if (mcp.mcpServers?.windbg?.command !== 'mcp-windbg') {
    throw new Error('WinDbg MCP is missing or misconfigured');
  }
  if (windbgArgs[windbgArgs.indexOf('--cdb-path') + 1] !== '{{PROGRAMFILES_X86}}\\Windows Kits\\10\\Debuggers\\x64\\cdb.exe') {
    throw new Error('WinDbg MCP must resolve cdb.exe from the tokenized Program Files (x86) root');
  }
  if (windbgArgs[windbgArgs.indexOf('--symbols-path') + 1] !== 'srv*{{SYSTEMDRIVE}}\\Symbols*https://msdl.microsoft.com/download/symbols') {
    throw new Error('WinDbg MCP must resolve its symbol cache from the tokenized system drive');
  }
}

export async function verifyRepository() {
  for (const relative of requiredFiles) {
    if (!(await pathExists(path.join(repoRoot, relative)))) {
      throw new Error(`Required file is missing: ${relative}`);
    }
  }

  const projectPackage = await readJson(path.join(repoRoot, 'package.json'));
  if (projectPackage.name !== 'meowpi') {
    throw new Error('Package name must match the MeowPi repository brand');
  }
  if (projectPackage.engines?.node !== '>=22.19.0' || projectPackage.engines?.bun !== '>=1.3.14') {
    throw new Error('MeowPi must declare its Node.js and Bun engine requirements');
  }

  const files = await walkFiles(repoRoot, { skip: ['.git', 'node_modules'] });
  const reverseBundle = await verifyReverseBundle(path.join(repoRoot, 'skills/reverse-skill-router'));
  await verifyContentGuards(files);
  await verifyOmpConfiguration();
  await verifyConsultAgent();
  await verifyMcp();

  const skillManifest = await verifySkillBaseline();
  await verifySkillSources(skillManifest, reverseBundle);

  await requireFiles('Writing suite file', [
    'skills/plain-english/REFERENCE.md',
    'skills/simple-english/references/agent-style-quality.md',
    'skills/style-review/references/rules.md',
    'skills/style-review/references/revision-prompt.md',
    'skills/style-review/scripts/audit.mjs',
    'skills/style-review/tests/run.mjs',
    'skills/writing-router/agents/openai.yaml',
  ]);
  await requireFiles('Code standards reference', [
    'skills/code-standards/references/engineering-principles.md',
    'skills/code-standards/references/language-routing.md',
    'skills/code-standards/references/testing-and-verification.md',
    'skills/modern-cpp/references/core-guidelines.md',
  ]);
  await requireFiles('Git workflow reference', [
    'skills/git-workflow/references/branches-and-conflicts.md',
    'skills/git-workflow/references/commits-and-history.md',
    'skills/git-workflow/references/prs-and-releases.md',
  ]);

  for (const relative of files.filter((name) => name.endsWith('.mjs'))) {
    const result = spawnSync(process.execPath, ['--check', path.join(repoRoot, relative)], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`Invalid JavaScript in ${relative}:\n${result.stderr}`);
  }

  console.log(
    `PASS: ${skillManifest.skills.length} skills, OMP configuration, JSON, Node scripts, portability, and secret checks.`,
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) runMain(verifyRepository);
