# MeowPi

<p align="center">
  <img src="assets/meowpi-logo.jpg" alt="MeowPi logo" width="420">
</p>

MeowPi keeps the same [Oh My Pi](https://omp.sh) (OMP) setup on each of my machines. I use it for OS internals, reverse engineering, and small pentest and research work.

## Install

You need Git, Node.js 22.19 or later, Bun 1.3.14 or later, and network access.

```sh
git clone https://github.com/meowdiocre/meowpi.git
cd meowpi
npm run bootstrap
omp
```

`npm run bootstrap` installs the pinned OMP release with `bun install --global`. Then it restores the configuration, the agents, and the skills. It copies each file or directory that it replaces to `<OMP_HOME>/portable-backups/<timestamp>/`.

Set `OMP_HOME` to install into a different directory. The default agent directory is `~/.omp/agent`.

## Files

| Repository | Installed to |
| --- | --- |
| `manifests/omp.json` | the global Bun install |
| `config/config.yml` | `~/.omp/agent/config.yml` |
| `config/models.yml` | `~/.omp/agent/models.yml` |
| `config/mcp.json.template` | `~/.omp/agent/mcp.json` |
| `config/extensions/` | `~/.omp/agent/extensions/` |
| `config/agents/` | `~/.omp/agent/agents/` |
| `skills/` | `~/.omp/agent/skills/` |

The setup defines MCP servers for Exa, Context7, DeepWiki, CodeGraph, IDA Pro, NotebookLM, and WinDbg. Four of these servers call a program that you install separately: `codegraph`, `idalib-mcp`, `notebooklm-mcp`, and `mcp-windbg`. Exa needs the `EXA_API_KEY` environment variable.

## Skills

OMP sends the `name` and the `description` of each skill to the model. The model reads the body on demand with `skill://<name>`. A companion file is at `skill://<name>/<path>`, and a skill script runs from `<OMP_HOME>/skills/<name>/`. Each skill is also a command: `/skill:<name>`.

`npm run bootstrap` makes the installed tree match `manifests/skills.json`. It copies each unlisted skill directory to the backup before it removes the directory.

`config/config.yml` disables each foreign skill source. A skill in `~/.claude`, `~/.codex`, or `~/.agents` cannot load next to the installed copy.

`config/agents/consultant.md` defines the `consultant` task agent for the `consult` skill. The agent has read-only tools and the model role `@slow`. If the configuration has no `modelRoles.slow`, the consultant uses the session model instead.

## Warning for Windows

Exclude the vendored snapshot from Windows Defender. Defender rewrites or blocks the exploit payloads in `skills/reverse-skill-router/upstream/`. The `upstream-lock.json` check then fails, and so do `npm test` and `npm run bootstrap`.

```powershell
Add-MpPreference -ExclusionPath '<OMP_HOME>\skills\reverse-skill-router\upstream'
Add-MpPreference -ExclusionPath '<repository>\skills\reverse-skill-router\upstream'
```

Then restore the changed files from `git`. Do not commit a redacted snapshot. The lock file is the integrity check.

## Update

On the machine that holds the current setup, run:

```sh
npm run export
npm test
git diff
```

Before you commit the change, review the diff. Edit a skill in `skills/` only, because `npm run bootstrap` copies that directory to the installed tree.

`npm run export` removes machine-local keys, so `config/config.yml` stays portable. On Windows, `npm run bootstrap` adds the Git Bash `shellPath` again.

On each other machine, pull the changes. Then run `npm run bootstrap`.
