# MeowPi

<p align="center">
  <img src="assets/meowpi-logo.jpg" alt="MeowPi logo" width="420">
</p>

MeowPi keeps the same [Oh My Pi](https://omp.sh) setup on all my machines. Mainly used for OS internals and reverse engineering, or to help me with small pentest and research work.

## Install

Install Git, Node.js 22.19 or later, and Bun 1.3.14 or later. Make sure that the device has network access.

```sh
git clone https://github.com/meowdiocre/meowpi.git
cd meowpi
npm run bootstrap
omp
```

`npm run bootstrap` installs the pinned OMP release with `bun install --global`, then restores the portable configuration and the complete skill snapshot. Every file it replaces is copied to `<OMP_HOME>/portable-backups/<timestamp>/` first.

## Included

- The pinned Oh My Pi command-line tool
- OMP settings, the shared model catalog, the Herdr extension, and the `consultant` task agent
- Shared skills, installed into the OMP-native skill tree only
- MCP definitions for Exa, Context7, DeepWiki, CodeGraph, IDA Pro, NotebookLM, and WinDbg

See [`config/mcp.json.template`](config/mcp.json.template) for the required commands.

## Where things install

| Repository | Installed to |
| --- | --- |
| `manifests/omp.json` | `bun install --global` |
| `config/config.yml` | `~/.omp/agent/config.yml` |
| `config/models.yml` | `~/.omp/agent/models.yml` |
| `config/mcp.json.template` | `~/.omp/agent/mcp.json` |
| `config/extensions/` | `~/.omp/agent/extensions/` |
| `config/agents/` | `~/.omp/agent/agents/` |
| `skills/` | `~/.omp/agent/skills/` |

Set `OMP_HOME` to install somewhere else. The default agent directory is `~/.omp/agent`.

Skills install into the OMP-native tree alone. `config/config.yml` disables every foreign skill source, so `~/.claude`, `~/.codex`, and `~/.agents` cannot load a second copy of a skill next to the one this repository installs. OMP's own `claude-plugins` and managed-skill providers are not affected.

The installed skill tree is exact. `npm run bootstrap` removes every skill directory that `manifests/skills.json` does not list, after backing it up, so a stale copy cannot shadow the current one.

## Skills under OMP

OMP advertises each discovered skill to the model by `name` and `description` only; the body is read on demand with `read skill://<name>`. That is why every `description` in this repository states the trigger conditions, and why a skill that needs a companion file says where the file lives.

- **Relative paths.** A skill's `references/…` and `scripts/…` paths resolve against its own directory: read them as `skill://<name>/<relative-path>`, or address the installed copy at `<OMP_HOME>/skills/<name>/`.
- **Skill commands.** Every skill is also registered as `/skill:<name>` (`skills.enableSkillCommands`). Invoking it that way prints the resolved skill directory.
- **Foreign metadata.** Some skills ship an `agents/openai.yaml` from their upstream source. OMP reads no such file; it is retained for other harnesses and is inert here.
- **Consultant agent.** `skills/consult` dispatches the `consultant` task agent, which `config/agents/consultant.md` defines with a read-only tool list and `model: "@slow"`. Set `modelRoles.slow` so the consultant is a different model from the session model; the skill tells the agent to report the limitation and ask rather than pass off a same-model answer. `npm test` fails if the skill and the agent definition drift apart.
- **Vendored snapshot.** `skills/reverse-skill-router/upstream/` is byte-exact upstream content checked against `upstream-lock.json`. Keep integration changes outside that directory, and note that some antivirus engines quarantine its XSS payload references — see "Antivirus exclusions" below.

## Antivirus exclusions

The vendored reverse-engineering snapshot contains working exploit payloads. Windows Defender quarantines or rewrites them, which breaks `upstream-lock.json` verification and therefore blocks `npm test` and `npm run bootstrap`. On Windows, exclude the installed snapshot and the repository copy:

```powershell
Add-MpPreference -ExclusionPath '<OMP_HOME>\skills\reverse-skill-router\upstream'
Add-MpPreference -ExclusionPath '<repository>\skills\reverse-skill-router\upstream'
```

Restore the affected files from `git` afterwards. Do not commit a redacted snapshot: the lock file is the integrity check.

## Update

On the device with the current OMP setup, run:

```sh
npm run export
npm test
git diff
```

Review the diff before you commit it. Edit repository skills in `skills/`, not in their installed locations.

`npm run export` strips machine-local settings, which keeps `config/config.yml` portable. `npm run bootstrap` adds a Git Bash `shellPath` back on Windows when it finds one.

On another device, pull the changes. Then run `npm run bootstrap` again.
