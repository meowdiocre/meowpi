import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readJson, walkFiles } from './lib.mjs';

function blobHash(content) {
  return createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
}

export async function verifyReverseBundle(skillRoot) {
  const lock = await readJson(path.join(skillRoot, 'upstream-lock.json'));
  const upstream = path.join(skillRoot, 'upstream');
  const actual = await walkFiles(upstream);
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
