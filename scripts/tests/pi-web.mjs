import assert from 'node:assert/strict';
import { patchPiWebExtensionSource } from '../pi-web.mjs';

const legacy = [
  'async function findPiWebBinary(pi) {',
  '  try {',
  '    accessSync("./pi-web", fsConstants.X_OK);',
  '    return "./pi-web";',
  '  } catch {}',
  '  const piBin = `${agentDir()}/bin/pi-web`;',
  '  try {',
  '    const result = await pi.exec("which", ["pi-web"]);',
  '    const bin = result.stdout.trim();',
  '  } catch {}',
  '}',
  'const status = "not found (~/.pi/agent/bin/pi-web, /usr/local/bin/pi-web)";',
].join('\n');

const patched = patchPiWebExtensionSource(legacy);
assert.match(patched, /process\.platform === "win32" \? "pi-web\.exe" : "pi-web"/);
assert.match(patched, /bin\/\$\{executableName\}/);
assert.match(patched, /process\.platform === "win32" \? "where\.exe" : "which"/);
assert.match(patched, /split\(\/\\r\?\\n\/\)\[0\]/);
assert.match(patched, /\.pi\/agent\/bin\/pi-web\.exe on Windows/);
assert.equal(patchPiWebExtensionSource(patched), patched, 'patch must be idempotent');

assert.throws(
  () => patchPiWebExtensionSource('unrecognized upstream source'),
  /pinned package layout changed/,
);

console.log('PASS: pi-web Windows binary discovery patch');
