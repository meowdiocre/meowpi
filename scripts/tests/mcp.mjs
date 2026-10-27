import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inspectMcp, renderMcp } from '../mcp.mjs';

const root = await mkdtemp(path.join(os.tmpdir(), 'meowpi-mcp-'));
try {
  const command = path.join(root, process.platform === 'win32' ? 'server.cmd' : 'server');
  await writeFile(command, process.platform === 'win32' ? '@exit /b 0\r\n' : '#!/bin/sh\nexit 0\n');
  await chmod(command, 0o755);
  const template = { mcpServers: {
    docs: { url: 'https://example.invalid/mcp' },
    desktop: { enabled: false, command: 'missing-desktop-program', env: { SHARED: 'kept' } },
  } };
  const local = { mcpServers: { desktop: { enabled: true, command, env: { LOCAL: 'private' }, args: ['{{HOME}}/case'] } } };
  const rendered = renderMcp(template, local, { HOME: root });
  assert.equal(rendered.mcpServers.desktop.env.SHARED, 'kept');
  assert.equal(rendered.mcpServers.desktop.env.LOCAL, 'private');
  assert.equal(path.normalize(rendered.mcpServers.desktop.args[0]), path.join(root, 'case'));
  assert.equal(template.mcpServers.desktop.enabled, false);
  assert.deepEqual((await inspectMcp(rendered)).map(({ status }) => status), ['ready', 'ready']);
  assert.equal((await inspectMcp(template))[1].status, 'disabled');

  const missing = await inspectMcp({ mcpServers: { broken: { command: path.join(root, 'absent') } } });
  assert.equal(missing[0].status, 'error');
  const denied = await inspectMcp({ ...rendered, enabledServers: ['desktop'], disabledServers: ['desktop'] });
  assert.equal(denied[1].status, 'disabled');
  const required = { mcpServers: { api: { url: 'https://example.invalid/mcp', headers: { Authorization: 'Bearer ${TEST_KEY}' } } } };
  assert.equal((await inspectMcp(required, { env: {} }))[0].status, 'error');
  assert.equal((await inspectMcp(required, { env: { TEST_KEY: 'private-test-value' } }))[0].status, 'ready');
  assert.equal((await inspectMcp({ mcpServers: { optional: { command, env: { EMPTY: '${UNSET:-}' } } } }, { env: {} }))[0].status, 'ready');
  assert.equal((await inspectMcp({ mcpServers: { windbg: { command } } }, { platform: 'linux' }))[0].status, 'error');
  assert.throws(() => renderMcp(template, { mcpServers: [] }, {}), /mcpServers object/);
  console.log('PASS: host overrides, dependency failures, environment references, and denylist precedence');
} finally {
  await rm(root, { recursive: true, force: true });
}
