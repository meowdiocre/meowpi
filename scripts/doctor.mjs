import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectMcp, resolveExecutable } from './mcp.mjs';
import { parseCommonArgs, pathExists, readJson, repoRoot, runMain } from './lib.mjs';

async function main() {
  const options = parseCommonArgs(process.argv.slice(2));
  if (options.dryRun || options.skipOmp || options.skipSkills) {
    throw new Error('doctor accepts only --omp-home');
  }
  const envFile = path.join(options.ompHome, '.env');
  if (await pathExists(envFile)) process.loadEnvFile(envFile);
  const pinned = await readJson(path.join(repoRoot, 'manifests', 'omp.json'));
  const executable = await resolveExecutable('omp');
  const commandScript = process.platform === 'win32' && executable?.toLowerCase().endsWith('.cmd');
  const version = executable && spawnSync(
    commandScript ? process.env.ComSpec || 'cmd.exe' : executable,
    commandScript ? ['/d', '/c', executable, '--version'] : ['--version'],
    { encoding: 'utf8', timeout: 10000 },
  );
  let failures = 0;
  if (!version || version.status !== 0 || version.stdout.match(/^omp\/(\d+\.\d+\.\d+)/m)?.[1] !== pinned.version) {
    console.log(`ERROR omp: PATH must select pinned version ${pinned.version}`);
    if (executable) console.log(`  selected executable: ${executable}`);
    failures += 1;
  } else {
    console.log(`READY omp ${pinned.version}: ${executable}`);
  }
  const config = await readJson(path.join(options.ompHome, 'mcp.json'));
  for (const result of await inspectMcp(config, { cwd: options.ompHome })) {
    console.log(`${result.status.toUpperCase()} ${result.name}: ${result.detail}`);
    if (result.status === 'error') failures += 1;
  }
  console.log('Prerequisites only: this check does not contact MCP transports or invoke a model.');
  if (failures) throw new Error(`${failures} prerequisite check(s) failed`);
}

runMain(main);
