import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pathExists, readJson, repoRoot, runMain, sortedStrings, userHome, walkFiles } from './lib.mjs';
import { verifyReverseBundle } from './reverse-bundle.mjs';

const requiredFiles = [
  '.gitignore',
  'README.md',
  'THIRD_PARTY_NOTICES.md',
  'assets/meowpi-logo.jpg',
  'package.json',
  'scripts/bootstrap.mjs',
  'scripts/export.mjs',
  'scripts/lib.mjs',
  'scripts/verify.mjs',
  'config/settings.json',
  'config/models.json',
  'config/mcp.json.template',
  'manifests/pi.json',
  'manifests/pi-packages.json',
  'manifests/skill-sources.json',
  'manifests/skills.json',
  'manifests/extensions.json',
];

const jsonFiles = requiredFiles.filter((name) => name.endsWith('.json'));
const forbiddenFilePattern = /(^|\/)(auth\.json|\.env(?:\..*)?|[^/]+\.(?:pem|key))$/i;
const secretPatterns = [
  /\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{16,}/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
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
  const unknownSkillManifestFields = Object.keys(skillManifest)
    .filter((field) => !['skills', 'targets'].includes(field));
  if (unknownSkillManifestFields.length > 0) {
    throw new Error(`manifests/skills.json contains unknown fields: ${unknownSkillManifestFields.join(', ')}`);
  }
  if (!Array.isArray(skillManifest.skills)) {
    throw new Error('manifests/skills.json skills must be an array');
  }
  if (new Set(skillManifest.skills).size !== skillManifest.skills.length) {
    throw new Error('manifests/skills.json contains duplicate skill names');
  }
  for (const skillName of [
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
  ]) {
    if (!skillManifest.skills.includes(skillName)) {
      throw new Error(`Required portable skill is absent from the baseline: ${skillName}`);
    }
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
    const content = await readFile(skillFile, 'utf8');
    const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
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

export async function verifyRepository() {
  for (const relative of requiredFiles) {
    if (!(await pathExists(path.join(repoRoot, relative)))) {
      throw new Error(`Required file is missing: ${relative}`);
    }
  }

  for (const relative of jsonFiles) await readJson(path.join(repoRoot, relative));

  const files = await walkFiles(repoRoot, { skip: ['.git', 'node_modules'] });
  const reverseBundle = await verifyReverseBundle(path.join(repoRoot, 'skills/reverse-skill-router'));
  for (const relative of files) {
    const upstreamFile = relative.startsWith('skills/reverse-skill-router/upstream/');
    const powerskillsScript = relative.startsWith('skills/powerskills/') && relative.endsWith('.ps1');
    if (
      forbiddenFilePattern.test(relative) ||
      (!upstreamFile && !powerskillsScript && /\.(?:ps1|cmd)$/i.test(relative))
    ) {
      throw new Error(`Forbidden platform-specific or credential file: ${relative}`);
    }
    const text = await readFile(path.join(repoRoot, relative), 'utf8');
    for (const pattern of secretPatterns) {
      if (pattern.test(text)) throw new Error(`Potential secret found in ${relative}`);
    }
  }

  const escapedHome = JSON.stringify(userHome).slice(1, -1);
  for (const relative of ['config/mcp.json.template', 'config/models.json', 'config/settings.json']) {
    const text = await readFile(path.join(repoRoot, relative), 'utf8');
    if (text.includes(userHome) || text.includes(escapedHome)) {
      throw new Error(`Machine-specific home path found in ${relative}`);
    }
  }

  const settings = await readJson(path.join(repoRoot, 'config', 'settings.json'));
  const piPackages = await readJson(path.join(repoRoot, 'manifests', 'pi-packages.json'));
  const projectPackage = await readJson(path.join(repoRoot, 'package.json'));
  if (projectPackage.name !== 'meowpi') {
    throw new Error('Package name must match the MeowPi repository brand');
  }
  if (projectPackage.engines?.node !== '>=22.19.0') {
    throw new Error('Grill Me requires the repository to declare Node.js >=22.19.0');
  }
  const configuredPackages = sortedStrings(settings.packages || []);
  const pinnedPackages = sortedStrings(piPackages.map((entry) => `npm:${entry.name}`));
  if (JSON.stringify(configuredPackages) !== JSON.stringify(pinnedPackages)) {
    throw new Error('Pi settings packages must match the pinned package manifest');
  }
  if (JSON.stringify(settings.skills) !== JSON.stringify(['!**/.agents/skills/**'])) {
    throw new Error('Pi must ignore shared .agents skills and load its own skill tree only');
  }

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

  const skillManifest = await verifySkillBaseline();
  await verifySkillSources(skillManifest, reverseBundle);

  const writingSuiteFiles = [
    'skills/plain-english/REFERENCE.md',
    'skills/simple-english/references/agent-style-quality.md',
    'skills/style-review/references/rules.md',
    'skills/style-review/references/revision-prompt.md',
    'skills/style-review/scripts/audit.mjs',
    'skills/style-review/tests/run.mjs',
    'skills/writing-router/agents/openai.yaml',
  ];
  await requireFiles('Writing suite file', writingSuiteFiles);

  const codeStandardsFiles = [
    'skills/code-standards/references/engineering-principles.md',
    'skills/code-standards/references/language-routing.md',
    'skills/code-standards/references/testing-and-verification.md',
    'skills/modern-cpp/references/core-guidelines.md',
  ];
  await requireFiles('Code standards reference', codeStandardsFiles);

  const gitWorkflowFiles = [
    'skills/git-workflow/references/branches-and-conflicts.md',
    'skills/git-workflow/references/commits-and-history.md',
    'skills/git-workflow/references/prs-and-releases.md',
  ];
  await requireFiles('Git workflow reference', gitWorkflowFiles);

  const scriptFiles = files.filter((name) => name.endsWith('.mjs'));
  for (const relative of scriptFiles) {
    const result = spawnSync(process.execPath, ['--check', path.join(repoRoot, relative)], {
      encoding: 'utf8',
    });
    if (result.status !== 0) throw new Error(`Invalid JavaScript in ${relative}:\n${result.stderr}`);
  }

  console.log(
    `PASS: ${skillManifest.skills.length} skills, JSON, Node scripts, portability, and secret checks.`,
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) runMain(verifyRepository);
