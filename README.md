# Portable Pi configuration

Use this repository to reproduce the same Pi setup on Windows, macOS, or Linux. The Node.js scripts restore portable configuration and skills. Authentication stays local to each device.

## What it restores

- The Pi version in `manifests/pi.json`.
- The Pi packages in `manifests/pi-packages.json`.
- Settings, model definitions, MCP servers, and the Herdr extension.
- The skills listed in `manifests/skills.json`.
- Skills for Pi, Claude Code, OpenCode, and Codex through the shared Agent Skills directory.

The repository does not store credentials, sessions, caches, or `node_modules`. The bootstrap script backs up existing files before it replaces them.

## Requirements

- Git
- Node.js 20 or newer
- Network access during installation

## Set up a new device

```sh
git clone https://github.com/meowdiocre/pi-portable-config.git
cd pi-portable-config
npm run bootstrap
```

If PowerShell blocks `.ps1` launchers, use `npm.cmd` and `pi.cmd` instead. You do not need to change the system execution policy.

Start Pi after the bootstrap completes:

```sh
pi
```

Authenticate each provider on the new device. Credentials are not part of the repository.

The bootstrap stores backups in `~/.pi/agent/portable-backups/<timestamp>/`.

### Bootstrap options

| Option | Effect |
|---|---|
| `--dry-run` | Show the planned changes without writing files. |
| `--skip-pi` | Do not install the Pi CLI. |
| `--skip-packages` | Do not install Pi packages. |
| `--skip-skills` | Do not install skills. |
| `--pi-home <path>` | Use a different Pi configuration directory. |

Pass options after `--`:

```sh
npm run bootstrap -- --dry-run
npm run bootstrap -- --pi-home /path/to/pi/agent
```

## Update the snapshot

Run the export on the device whose Pi installation is the source of truth:

```sh
npm run export
npm test
git diff
```

The export refreshes the portable configuration, installed Pi package versions, and the complete Pi skill snapshot. It preserves repository-owned skills listed in `additionalSkills`.

Edit an `additionalSkills` entry in this repository. Do not edit its installed copy. Review the diff before you commit and push it.

Vendored sources are pinned in `manifests/skill-sources.json`. Their licenses are recorded in `THIRD_PARTY_NOTICES.md`.

## Writing skills

The writing suite keeps each rule set separate:

| Skill | Use |
|---|---|
| `writing-router` | Select the correct writing workflow. |
| `plain-english` | Tighten natural prose and remove model-writing habits. |
| `simple-english` | Write clear technical documentation and procedures. |
| `style-review` | Audit technical Markdown after drafting. |

Audit or compare Markdown files with these commands:

```sh
npm run review-docs -- README.md
npm run review-docs -- --compare before.md after.md
```

## MCP servers

The shared MCP configuration defines servers for ChunkHound, Exa, Chrome DevTools, CodeGraph, IDA Pro, and NotebookLM. WinDbg is enabled only on Windows.

The bootstrap restores these definitions but does not install their external executables. See `config/mcp.json.template` for the commands and platform-specific paths.

## Checks

```sh
npm run verify
npm test
```

`npm run verify` checks repository structure, skill metadata, portability, and common secret patterns. `npm test` also runs unit checks and a complete bootstrap dry run.
