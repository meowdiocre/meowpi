import path from 'node:path';
import {
  commandName,
  expandTokens,
  installDirectory,
  installFile,
  installText,
  parseCommonArgs,
  portablePathTokens,
  readJson,
  repoRoot,
  run,
  runMain,
  timestamp,
  userHome,
} from './lib.mjs';
import { verifyRepository } from './verify.mjs';
import { ensurePiWebWindowsBinaryDiscovery } from './pi-web.mjs';

async function main() {
  const options = parseCommonArgs(process.argv.slice(2));
  const manifestRoot = path.join(repoRoot, 'manifests');
  const configRoot = path.join(repoRoot, 'config');
  const backupRoot = path.join(options.piHome, 'portable-backups', timestamp());

  console.log('==> Validate repository');
  await verifyRepository();

  if (!options.skipPi) {
    console.log('\n==> Install pinned Pi CLI');
    const pi = await readJson(path.join(manifestRoot, 'pi.json'));
    run(commandName('npm'), [
      'install',
      '--global',
      '--ignore-scripts',
      `${pi.package}@${pi.version}`,
    ], { dryRun: options.dryRun });
  }

  if (!options.skipPackages) {
    console.log('\n==> Install pinned Pi packages');
    const packages = await readJson(path.join(manifestRoot, 'pi-packages.json'));
    for (const entry of packages) {
      run(commandName('pi'), ['install', `npm:${entry.name}@${entry.version}`], {
        dryRun: options.dryRun,
      });
    }
  }

  if (process.platform === 'win32') {
    console.log('\n==> Configure pi-web for Windows');
    await ensurePiWebWindowsBinaryDiscovery(options.piHome, { dryRun: options.dryRun });
  }

  console.log('\n==> Restore MeowPi configuration');
  await installFile(
    path.join(configRoot, 'settings.json'),
    path.join(options.piHome, 'settings.json'),
    backupRoot,
    'config/settings.json',
    options.dryRun,
  );
  await installFile(
    path.join(configRoot, 'models.json'),
    path.join(options.piHome, 'models.json'),
    backupRoot,
    'config/models.json',
    options.dryRun,
  );

  const mcpTemplate = await readJson(path.join(configRoot, 'mcp.json.template'));
  const mcpConfig = {
    mcpServers: mcpTemplate.mcpServers,
  };
  const replacements = {
    ...portablePathTokens(),
    NPX: commandName('npx'),
  };
  const renderedMcp = expandTokens(mcpConfig, replacements);
  await installText(
    path.join(options.piHome, 'mcp.json'),
    `${JSON.stringify(renderedMcp, null, 2)}\n`,
    backupRoot,
    'config/mcp.json',
    options.dryRun,
  );

  const extensions = await readJson(path.join(manifestRoot, 'extensions.json'));
  for (const extension of extensions) {
    await installFile(
      path.join(configRoot, 'extensions', extension),
      path.join(options.piHome, 'extensions', extension),
      backupRoot,
      path.join('extensions', extension),
      options.dryRun,
    );
  }

  if (!options.skipSkills) {
    console.log('\n==> Restore complete skill snapshot');
    const skillManifest = await readJson(path.join(manifestRoot, 'skills.json'));
    for (const target of skillManifest.targets) {
      const targetRoot = expandTokens(target.path, {
        HOME: userHome,
        PI_HOME: options.piHome,
      });
      for (const skillName of skillManifest.skills) {
        await installDirectory(
          path.join(repoRoot, 'skills', skillName),
          path.join(targetRoot, skillName),
          backupRoot,
          path.join('skills', target.name, skillName),
          options.dryRun,
        );
      }
    }
  }

  console.log('\n==> Complete');
  console.log('MeowPi is installed. Authenticate providers locally on this device.');
  if (!options.dryRun) console.log(`Backups: ${backupRoot}`);
}

runMain(main);
