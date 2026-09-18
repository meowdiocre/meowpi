import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { installDirectory, readJson, repoRoot } from '../lib.mjs';
import { verifyReverseBundle } from '../reverse-bundle.mjs';
import { selectRoute } from '../../skills/reverse-skill-router/scripts/route.mjs';

const bundle = path.join(repoRoot, 'skills/reverse-skill-router');
const upstream = path.join(bundle, 'upstream');
const config = await readJson(path.join(upstream, 'skills/config/routing.json'));
const benchmark = await readJson(path.join(upstream, 'skills/tests/routing-benchmark.json'));
for (const test of benchmark.cases) {
  assert.equal(selectRoute(config, test.hint).primary, test.expect, test.hint);
}
for (const route of Object.values(config.routes)) {
  assert.ok((await stat(path.join(upstream, 'skills', route.skill))).isFile(), route.skill);
}

const lock = await readJson(path.join(bundle, 'upstream-lock.json'));
const modules = Object.keys(lock.files).filter((name) => /^skills\/.+\/SKILL\.md$/.test(name));
const ctfModules = Object.keys(lock.files).filter((name) => /^CTF-Sandbox-Orchestrator\/.+\/SKILL\.md$/.test(name));
assert.equal(modules.length, 45);
assert.equal(ctfModules.length, 42);
assert.equal(Object.keys(lock.files).length, 596);

const scratch = await mkdtemp(path.join(tmpdir(), 'reverse-bundle-'));
try {
  const installed = path.join(scratch, 'installed skills', 'reverse-skill-router');
  await installDirectory(bundle, installed, path.join(scratch, 'backups'), 'reverse-skill-router', false);
  await verifyReverseBundle(installed);
  const before = await readdir(scratch);
  const result = spawnSync(process.execPath, [
    path.join(installed, 'scripts/route.mjs'), 'analyze a stripped Rust binary',
  ], { cwd: scratch, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const selected = JSON.parse(result.stdout);
  assert.equal(selected.primary, 'R33');
  assert.equal(selected.skill, path.join(installed, 'upstream/skills/go-rust-reverse/SKILL.md'));
  assert.match(await readFile(selected.skill, 'utf8'), /name: go-rust-reverse/);
  assert.deepEqual(await readdir(scratch), before, 'Routing must not generate case files');

  const reference = path.join(installed, 'upstream/skills/go-rust-reverse/SKILL.md');
  await writeFile(reference, 'incomplete replacement');
  await assert.rejects(verifyReverseBundle(installed), /upstream content changed/);
  await rm(reference);
  await assert.rejects(verifyReverseBundle(installed), /missing or untracked files/);
} finally {
  await rm(scratch, { recursive: true, force: true });
}

console.log(`PASS: ${benchmark.cases.length} routing cases, 45 core modules, 42 CTF modules, snapshot integrity, and isolated installation`);
