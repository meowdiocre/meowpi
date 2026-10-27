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
| `config/mcp.json.template` + local override | `~/.omp/agent/mcp.json` |
| `config/extensions/` | `~/.omp/agent/extensions/` |
| `config/agents/` | `~/.omp/agent/agents/` |
| `skills/` | `~/.omp/agent/skills/` |
| `config/host/zsh/` | `~/.zshrc`, `~/.p10k.zsh` |
| `config/host/profile.d/` | `/etc/profile.d/10-redteam.sh` |
| `config/host/ssh/` | `/etc/ssh/ssh_config.d/99-redteam.conf` |
| `config/host/vim/` | `/etc/vim/vimrc.local` |
| `config/host/tern/` | `~/.config/tern/settings.json` (pane shell) |
| `scripts/install-redteam-toolchain.sh` | installs the OS toolchain in stages |
| `scripts/install-host-config.sh` | installs the host files above, with backups |
| `scripts/redteam-check.sh` | `/opt/redteam-check.sh` and `/usr/local/bin/redteam-check` |

Context7 and DeepWiki are enabled by default. Exa, CodeGraph, IDA, NotebookLM, WinDbg, CloakBrowser, and js-reverse remain in the catalog but are disabled until enabled on a host. The catalog also carries `mitmproxy` (traffic capture, replay, OpenAPI export) and `chrome-devtools` (Chrome DevTools Protocol), both disabled by default because they need a local binary and, for DevTools, a Chrome build; enable them per host in `mcp.local.json`. Bootstrap checks enabled servers' executable and environment prerequisites before replacing configuration.

### Host-specific MCP configuration

Create `<OMP_HOME>/mcp.local.json` on each machine. This file is private and is never exported:

```json
{
  "mcpServers": {
    "codegraph": { "enabled": true },
    "ida": { "enabled": true },
    "notebooklm-mcp": { "enabled": true }
  }
}
```

Overrides merge objects recursively; arrays such as `args` replace the catalog value. A local entry may define another server, override an executable path, or disable a shared server. OMP's native `disabledServers` denylist takes precedence over `enabledServers`.

Install optional programs separately. IDA uses the official `uvx ida-mcp` launcher and needs an installed, licensed IDA. NotebookLM uses `uv tool install notebooklm-mcp-cli`; update it with `uv tool upgrade notebooklm-mcp-cli`. WinDbg requires Windows. Exa needs `EXA_API_KEY`; js-reverse needs `MEOWPI_JS_REVERSE_ROOT`, unless its local `args` supply the project root. Put secrets in the host environment or `<OMP_HOME>/.env`, never in this repository.

Then apply and check:

```sh
npm run bootstrap
npm run doctor
```

Doctor checks the OMP version selected by PATH and enabled MCP prerequisites. It does not contact servers or invoke a model. After a server update, restart OMP and verify that its MCP tools load. An older Tern-managed `omp` can shadow the Bun installation; doctor reports the selected executable rather than claiming the new version is active.

## Host toolchain

`skills/` describes the tools; two scripts install them. Both are idempotent and non-Windows.

```sh
bash scripts/install-redteam-toolchain.sh        # all stages
bash scripts/install-redteam-toolchain.sh base go  # selected stages
bash scripts/install-host-config.sh              # shell, ssh, vim, tern, checker
redteam-check --full                             # ok=N missing=0
```

Stages: `base` (apt), `go` (1.26 for nuclei plus 1.27, all Go tools, jsluice with cgo), `pipx` (impacket, netexec from git, certipy, garak, mitmproxy, …), `release` (feroxbuster, sliver, GhostPack, PEASS, PrivescCheck), `wordlists` (SecLists links plus rockyou), `metasploit` (omnibus plus the Postgres role and `~/.msf4/database.yml`), `node` (Node 24, webcrack, chrome-devtools-mcp, Chrome for Testing), `mitm`, `shell` (PATH, `/etc/zsh/zshenv`, login shell).

The tool skills are routed by `skills/toolchain-router/SKILL.md`; the inventory, versions, layout and known version traps live in `skills/redteam-toolchain/SKILL.md`. Two cross-tool workflows are described end to end: `skills/web-traffic-js-reversing/SKILL.md` and `skills/ai-security-testing/SKILL.md`.

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

Before committing, review the diff. Export refreshes the installed configuration, model catalog, agents, skill snapshot, and OMP version pin. It deliberately leaves the repository's MCP catalog unchanged: a server disabled or absent on one machine must not disappear from every other machine. Edit `config/mcp.json.template` to change the shared catalog. Review/export before editing repository skills, so a stale installed copy cannot overwrite an intended edit.

`npm run export` removes machine-local keys from `config/config.yml`. On Windows, bootstrap adds the Git Bash `shellPath` again. Local MCP overrides, authentication, `.env`, sessions, runtime databases, and managed operational notes are not portable repository content.

On another machine:

```sh
git pull --ff-only
npm run bootstrap
npm run doctor
```

The current OMP pin is 18.13.1. Update that pin deliberately on the maintainer machine and test before pushing; do not replace it with an arbitrary older host's version. Authenticate providers locally on each new device.
