import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pathExists, readJson, repoRoot, userHome } from './lib.mjs';
import { verifyReverseBundle } from './reverse-bundle.mjs';

const requiredFiles = [
  '.gitignore',
  'README.md',
  'THIRD_PARTY_NOTICES.md',
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

async function listFiles(root, relative = '') {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (['.git', 'node_modules'].includes(entry.name)) continue;
    const childRelative = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, childRelative)));
    else files.push(childRelative);
  }
  return files;
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

export async function verifyRepository() {
  for (const relative of requiredFiles) {
    if (!(await pathExists(path.join(repoRoot, relative)))) {
      throw new Error(`Required file is missing: ${relative}`);
    }
  }

  for (const relative of jsonFiles) await readJson(path.join(repoRoot, relative));

  const files = await listFiles(repoRoot);
  const reverseBundle = await verifyReverseBundle(path.join(repoRoot, 'skills/reverse-skill-router'));
  for (const relative of files) {
    const normalized = relative.split(path.sep).join('/');
    const upstreamFile = normalized.startsWith('skills/reverse-skill-router/upstream/');
    if (forbiddenFilePattern.test(normalized) || (!upstreamFile && /\.(?:ps1|cmd)$/i.test(normalized))) {
      throw new Error(`Forbidden platform-specific or credential file: ${normalized}`);
    }
    const text = await readFile(path.join(repoRoot, relative), 'utf8');
    for (const pattern of secretPatterns) {
      if (pattern.test(text)) throw new Error(`Potential secret found in ${normalized}`);
    }
  }

  const escapedHome = JSON.stringify(userHome).slice(1, -1);
  for (const relative of ['config/mcp.json.template', 'config/models.json', 'config/settings.json']) {
    const text = await readFile(path.join(repoRoot, relative), 'utf8');
    if (text.includes(userHome) || text.includes(escapedHome)) {
      throw new Error(`Machine-specific home path found in ${relative}`);
    }
  }

  const mcp = await readJson(path.join(repoRoot, 'config', 'mcp.json.template'));
  const expectedServers = ['codegraph', 'exa', 'ida', 'notebooklm-mcp'];
  if (JSON.stringify(sorted(Object.keys(mcp.mcpServers || {}))) !== JSON.stringify(expectedServers)) {
    throw new Error(`Portable MCP servers must be exactly: ${expectedServers.join(', ')}`);
  }
  if (mcp.mcpServers.exa.url !== 'https://mcp.exa.ai/mcp?tools=web_search_exa,web_fetch_exa') {
    throw new Error('Exa must expose only web search and fetch');
  }
  if ('directTools' in mcp.mcpServers.exa) {
    throw new Error('Exa must use the adapter default instead of directTools');
  }
  if (
    mcp.mcpServers.ida.command !== 'idalib-mcp' ||
    JSON.stringify(mcp.mcpServers.ida.args) !== JSON.stringify(['--stdio', '--max-workers', '2'])
  ) {
    throw new Error('IDA must use the portable idalib-mcp stdio command');
  }
  if (mcp.mcpServers['notebooklm-mcp'].command !== 'notebooklm-mcp') {
    throw new Error('NotebookLM MCP must remain available');
  }
  if (mcp.platformServers?.win32?.windbg?.command !== 'mcp-windbg') {
    throw new Error('WinDbg must resolve mcp-windbg from PATH');
  }

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
    'git-workflow',
    'modern-cpp',
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
  if (JSON.stringify(sorted(skillManifest.skills)) !== JSON.stringify(sorted(skillDirectories))) {
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

  const writingSuiteFiles = [
    'skills/plain-english/REFERENCE.md',
    'skills/simple-english/references/agent-style-quality.md',
    'skills/style-review/references/rules.md',
    'skills/style-review/references/revision-prompt.md',
    'skills/style-review/scripts/audit.mjs',
    'skills/style-review/tests/run.mjs',
    'skills/writing-router/agents/openai.yaml',
  ];
  for (const relative of writingSuiteFiles) {
    if (!(await pathExists(path.join(repoRoot, relative)))) {
      throw new Error(`Writing suite file is missing: ${relative}`);
    }
  }

  const codeStandardsFiles = [
    'skills/code-standards/references/engineering-principles.md',
    'skills/code-standards/references/language-routing.md',
    'skills/code-standards/references/testing-and-verification.md',
  ];
  for (const relative of codeStandardsFiles) {
    if (!(await pathExists(path.join(repoRoot, relative)))) {
      throw new Error(`Code standards reference is missing: ${relative}`);
    }
  }

  const gitWorkflowFiles = [
    'skills/git-workflow/references/branches-and-conflicts.md',
    'skills/git-workflow/references/commits-and-history.md',
    'skills/git-workflow/references/prs-and-releases.md',
  ];
  for (const relative of gitWorkflowFiles) {
    if (!(await pathExists(path.join(repoRoot, relative)))) {
      throw new Error(`Git workflow reference is missing: ${relative}`);
    }
  }

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
if (isMain) {
  verifyRepository().catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}
