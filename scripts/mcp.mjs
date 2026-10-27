import { access, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { expandTokens, pathExists, readJson } from './lib.mjs';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function merge(base, local) {
  const result = new Map(Object.entries(base));
  for (const [key, value] of Object.entries(local)) {
    const previous = result.get(key);
    result.set(key, isObject(previous) && isObject(value) ? merge(previous, value) : value);
  }
  return Object.fromEntries(result);
}

export function renderMcp(template, local, tokens) {
  if (!isObject(local) || (local.mcpServers !== undefined && !isObject(local.mcpServers))) {
    throw new Error('mcp.local.json must be an object with an optional mcpServers object');
  }
  return expandTokens(merge(template, local), tokens);
}

export async function readLocalMcp(ompHome) {
  const file = path.join(ompHome, 'mcp.local.json');
  return (await pathExists(file)) ? readJson(file) : {};
}

function expandEnvironment(value, env, missing) {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g, (match, name, fallback) => {
      if (env[name] !== undefined && env[name] !== '') return env[name];
      if (fallback !== undefined) return fallback;
      missing.add(name);
      return match;
    });
  }
  if (Array.isArray(value)) return value.map((item) => expandEnvironment(item, env, missing));
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expandEnvironment(item, env, missing)]));
  }
  return value;
}

export async function resolveExecutable(command, env = process.env, cwd = process.cwd(), platform = process.platform) {
  if (typeof command !== 'string' || !command) return null;
  const paths = /[/\\]/.test(command)
    ? [path.resolve(cwd, command)]
    : (env.PATH || env.Path || '').split(platform === 'win32' ? ';' : path.delimiter)
      .filter(Boolean).map((directory) => path.join(directory, command));
  const suffixes = platform === 'win32' && !path.extname(command)
    ? (env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';') : [''];
  for (const candidate of paths) {
    for (const suffix of suffixes) {
      const file = candidate + suffix;
      try {
        await access(file, platform === 'win32' ? constants.F_OK : constants.X_OK);
        if ((await stat(file)).isFile()) return file;
      } catch (error) {
        if (!['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) throw error;
      }
    }
  }
  return null;
}

export async function inspectMcp(config, { env = process.env, cwd = process.cwd(), platform = process.platform } = {}) {
  const denied = new Set(config.disabledServers || []);
  const forced = new Set(config.enabledServers || []);
  const results = [];
  for (const [name, raw] of Object.entries(config.mcpServers || {})) {
    if (!isObject(raw)) {
      results.push({ name, status: 'error', detail: 'server definition must be an object' });
      continue;
    }
    const missing = new Set();
    const server = expandEnvironment(raw, env, missing);
    const enabled = forced.has(name) ? true : (server.enabled ?? true);
    if (denied.has(name) || [false, 'false', '0'].includes(enabled)) {
      results.push({ name, status: 'disabled', detail: 'not enabled on this host' });
      continue;
    }
    let detail;
    if (![true, 'true', '1'].includes(enabled)) detail = 'enabled must be a boolean or boolean string';
    else if (missing.size) detail = `missing environment: ${[...missing].join(', ')}`;
    else if (platform !== 'win32' && name === 'windbg') detail = 'WinDbg requires Windows';
    else if (server.url) {
      try {
        const url = new URL(server.url);
        if (!['https:', 'http:'].includes(url.protocol)) detail = 'HTTP transport requires an HTTP(S) URL';
      } catch {
        detail = 'invalid MCP URL';
      }
    } else {
      const directory = server.cwd ? path.resolve(cwd, server.cwd) : cwd;
      if (!(await resolveExecutable(server.command, { ...env, ...server.env }, directory, platform))) {
        detail = 'configured executable is not available';
      } else if (server.cwd && !(await pathExists(directory))) {
        detail = 'configured working directory does not exist';
      }
    }
    results.push({ name, status: detail ? 'error' : 'ready', detail: detail || (server.url ? 'HTTP configuration' : 'stdio executable') });
  }
  return results;
}
