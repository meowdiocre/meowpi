# Repository rules

- Treat this repository as the source of truth for portable Pi configuration.
- Never add `auth.json`, API keys, access tokens, session transcripts, caches, or generated `node_modules`.
- Keep third-party skills declarative in `manifests/skills.json`; do not vendor them.
- Keep locally authored skills under `skills/`.
- Run `verify.cmd` after changing configuration, scripts, manifests, or skills.
- Use `export.cmd` to refresh the safe configuration snapshot from the current machine.
