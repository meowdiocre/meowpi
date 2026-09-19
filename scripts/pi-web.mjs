import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const replacements = [
  {
    label: 'local executable lookup',
    oldText: [
      '  try {',
      '    accessSync("./pi-web", fsConstants.X_OK);',
      '    return "./pi-web";',
    ].join('\n'),
    newText: [
      '  const executableName = process.platform === "win32" ? "pi-web.exe" : "pi-web";',
      '  const localBin = `./${executableName}`;',
      '  try {',
      '    accessSync(localBin, fsConstants.X_OK);',
      '    return localBin;',
    ].join('\n'),
  },
  {
    label: 'Pi-managed executable lookup',
    oldText: '  const piBin = `${agentDir()}/bin/pi-web`;',
    newText: '  const piBin = `${agentDir()}/bin/${executableName}`;',
  },
  {
    label: 'PATH executable lookup',
    oldText: [
      '    const result = await pi.exec("which", ["pi-web"]);',
      '    const bin = result.stdout.trim();',
    ].join('\n'),
    newText: [
      '    const lookup = process.platform === "win32" ? "where.exe" : "which";',
      '    const result = await pi.exec(lookup, [executableName]);',
      '    const bin = result.stdout.trim().split(/\\r?\\n/)[0];',
    ].join('\n'),
  },
  {
    label: 'missing executable message',
    oldText: 'not found (~/.pi/agent/bin/pi-web, /usr/local/bin/pi-web)',
    newText:
      'not found (~/.pi/agent/bin/pi-web.exe on Windows; ~/.pi/agent/bin/pi-web or /usr/local/bin/pi-web elsewhere)',
  },
];

export function patchPiWebExtensionSource(source) {
  let result = source;
  for (const { label, oldText, newText } of replacements) {
    if (result.includes(newText)) continue;
    const first = result.indexOf(oldText);
    if (first < 0) {
      throw new Error(`Cannot patch pi-web ${label}; pinned package layout changed`);
    }
    if (result.indexOf(oldText, first + oldText.length) >= 0) {
      throw new Error(`Cannot patch ambiguous pi-web ${label}`);
    }
    result = `${result.slice(0, first)}${newText}${result.slice(first + oldText.length)}`;
  }
  return result;
}

export async function ensurePiWebWindowsBinaryDiscovery(piHome, { dryRun = false } = {}) {
  const target = path.join(
    piHome,
    'npm',
    'node_modules',
    '@ygncode',
    'pi-web',
    '.pi',
    'extensions',
    'pi-web.ts',
  );
  if (dryRun) {
    console.log(`[dry-run] patch Windows pi-web binary discovery -> ${target}`);
    return;
  }

  const source = await readFile(target, 'utf8');
  const patched = patchPiWebExtensionSource(source);
  if (patched === source) {
    console.log(`already patched: ${target}`);
    return;
  }
  await writeFile(target, patched, 'utf8');
  console.log(`patched: ${target}`);
}
