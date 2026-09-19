# Repository rules

- Treat this repository as the source of truth for MeowPi's portable Oh My Pi (OMP) configuration.
- Never add `auth.json`, API keys, access tokens, session transcripts, caches, or generated `node_modules`.
- Keep the complete skill baseline under `skills/`; `manifests/skills.json` must list every directory.
- Install task agents from `config/agents/` into the OMP-native `agents/` tree only. A skill that dispatches an agent by name must match a file there.
- Keep every skill loadable by OMP alone: state trigger conditions in `description`, point companion files at `skill://<name>/<path>`, and never require tooling that OMP does not provide.
- Install skills into the OMP-native tree only. Every foreign skill source stays disabled in `config/config.yml`.
- Pin vendored skill sources in `manifests/skill-sources.json` and preserve their notices in `THIRD_PARTY_NOTICES.md`.
- Preserve the complete reverse-skill snapshot under `skills/reverse-skill-router/upstream/`; keep portable integration outside it and verify all files against `upstream-lock.json`.
- Keep Plain English and Simple English as separate routes; their rules must not run over the same passage.
- Keep `config/config.yml` and `config/models.yml` machine-independent. `npm run export` strips machine-local keys; `npm run bootstrap` re-adds them to the local install.
- Keep migration logic dependency-free and cross-platform. Do not add PowerShell-only workflows.
- Run `npm test` after changing configuration, scripts, manifests, or skills.
- Use `npm run export` to refresh the safe configuration and skill snapshot from the current machine.
