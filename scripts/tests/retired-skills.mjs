import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathExists, retireDirectory } from '../lib.mjs';

const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'pi-retired-skill-'));
const target = path.join(fixtureRoot, 'target', 'orwell-writing');
const backupRoot = path.join(fixtureRoot, 'backups');
const marker = 'retired skill fixture';

try {
  await mkdir(target, { recursive: true });
  await writeFile(path.join(target, 'SKILL.md'), marker, 'utf8');

  await retireDirectory(target, backupRoot, 'retired/orwell-writing', false);

  assert.equal(await pathExists(target), false);
  assert.equal(
    await readFile(path.join(backupRoot, 'retired', 'orwell-writing', 'SKILL.md'), 'utf8'),
    marker,
  );
  console.log('PASS: retired skills are backed up before removal');
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
