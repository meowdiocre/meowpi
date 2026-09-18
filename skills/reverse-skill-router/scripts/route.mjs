import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageRoot = fileURLToPath(new URL('../upstream/', import.meta.url));

export function selectRoute(config, hint) {
  const scores = new Map();
  const matches = (pattern) => new RegExp(pattern, 'i').test(hint);
  for (const [id, route] of Object.entries(config.routes)) {
    for (const rule of route.keywords || []) {
      const mustAll = typeof rule.mustAll === 'string' ? [rule.mustAll] : rule.mustAll || [];
      if (rule.must && matches(rule.must) && mustAll.every(matches)
          && !(rule.exclude && matches(rule.exclude))) {
        scores.set(id, (scores.get(id) || 0) + 1);
      }
    }
  }

  let primary = config.meta.fallbackId;
  let maxScore = -1;
  for (const id of config.priority) {
    if (scores.has(id) && scores.get(id) > maxScore) {
      primary = id;
      maxScore = scores.get(id);
    }
  }
  return {
    primary,
    confidence: scores.size === 0 ? 'low' : scores.size === 1 ? 'high' : 'medium',
    secondary: [...scores.keys()].filter((id) => id !== primary),
  };
}

export async function routeTask(hint) {
  const configText = await readFile(path.join(packageRoot, 'skills/config/routing.json'), 'utf8');
  const config = JSON.parse(configText.replace(/^\uFEFF/, ''));
  const result = selectRoute(config, hint);
  const route = config.routes[result.primary];
  const skill = path.resolve(packageRoot, 'skills', route.skill);
  if (!(await stat(skill)).isFile()) throw new Error(`Missing upstream module: ${skill}`);
  return { ...result, label: route.label, skill, packageRoot };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  routeTask(process.argv.slice(2).join(' ')).then(
    (result) => console.log(JSON.stringify(result, null, 2)),
    (error) => { console.error(error.message); process.exitCode = 1; },
  );
}
