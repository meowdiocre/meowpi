# Repository rules

- Treat this repository as the source of truth for portable Pi configuration.
- Never add `auth.json`, API keys, access tokens, session transcripts, caches, or generated `node_modules`.
- Keep the complete Pi skill baseline under `skills/`; `manifests/skills.json` must list every directory.
- Pin vendored skill sources in `manifests/skill-sources.json` and preserve their notices in `THIRD_PARTY_NOTICES.md`.
- Preserve the complete reverse-skill snapshot under `skills/reverse-skill-router/upstream/`; keep portable integration outside it and verify all files against `upstream-lock.json`.
- Keep Plain English and Simple English as separate routes; their rules must not run over the same passage.
- Keep migration logic dependency-free and cross-platform. Do not add PowerShell-only workflows.
- Run `npm test` after changing configuration, scripts, manifests, or skills.
- Use `npm run export` to refresh the safe configuration and skill snapshot from the current machine.
