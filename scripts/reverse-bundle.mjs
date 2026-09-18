import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { readJson } from './lib.mjs';

function blobHash(content) {
  return createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
}

async function listFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) {
      files.push(...await listFiles(path.join(directory, entry.name), `${relative}/`));
    } else if (entry.isFile()) files.push(relative);
    else throw new Error(`Unexpected upstream file type: ${relative}`);
  }
  return files.sort();
}

export async function verifyReverseBundle(skillRoot) {
  const lock = await readJson(path.join(skillRoot, 'upstream-lock.json'));
  const upstream = path.join(skillRoot, 'upstream');
  const actual = await listFiles(upstream);
  const expected = Object.keys(lock.files).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('Reverse-skill snapshot has missing or untracked files; keep case data outside the bundle');
  }
  for (const relative of expected) {
    const content = await readFile(path.join(upstream, relative));
    const hash = lock.files[relative];
    if (blobHash(content) === hash) continue;
    // Git may check text out as CRLF on Windows; compare canonical LF as well.
    if (!content.includes(0) && blobHash(Buffer.from(content.toString('utf8').replace(/\r\n/g, '\n'))) === hash) continue;
    throw new Error(`Reverse-skill upstream content changed: ${relative}`);
  }
  return { ref: lock.ref, files: actual.length };
}
