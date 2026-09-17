# Repository rules

- Treat this repository as the source of truth for portable Pi configuration.
- Never add `auth.json`, API keys, access tokens, session transcripts, caches, or generated `node_modules`.
- Keep the complete Pi skill snapshot under `skills/`; `manifests/skills.json` must list every directory.
- Keep migration logic dependency-free and cross-platform. Do not add PowerShell-only workflows.
- Run `npm test` after changing configuration, scripts, manifests, or skills.
- Use `npm run export` to refresh the safe configuration and skill snapshot from the current machine.
