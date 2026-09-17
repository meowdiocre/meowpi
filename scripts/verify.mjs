import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pathExists, readJson, repoRoot, userHome } from './lib.mjs';

const requiredFiles = [
  '.gitignore',
  'README.md',
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
  'manifests/skills.json',
  'manifests/extensions.json',
];

const jsonFiles = requiredFiles.filter((name) => name.endsWith('.json'));
const forbiddenFilePattern = /(^|\/)(auth\.json|\.env(?:\..*)?|[^/]+\.(?:pem|key)|[^/]+\.(?:ps1|cmd))$/i;
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
  for (const relative of files) {
    const normalized = relative.split(path.sep).join('/');
    if (forbiddenFilePattern.test(normalized)) {
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

  const skillManifest = await readJson(path.join(repoRoot, 'manifests', 'skills.json'));
  const additionalSkills = skillManifest.additionalSkills || [];
  if (!Array.isArray(additionalSkills) || additionalSkills.some((name) => typeof name !== 'string')) {
    throw new Error('manifests/skills.json additionalSkills must be an array of names');
  }
  if (new Set(skillManifest.skills).size !== skillManifest.skills.length) {
    throw new Error('manifests/skills.json contains duplicate skill names');
  }
  for (const skillName of additionalSkills) {
    if (!skillManifest.skills.includes(skillName)) {
      throw new Error(`Additional portable skill is absent from skills: ${skillName}`);
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
