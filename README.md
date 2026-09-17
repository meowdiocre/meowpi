# Portable Pi setup

This repository recreates the same Pi configuration and complete skill set on Windows, macOS, or Linux. It uses dependency-free Node.js scripts because Pi and the Skills ecosystem already require Node.

## Included

- Pi fork `@earendil-works/pi-coding-agent`, pinned to the exported version.
- All configured Pi npm packages at their installed versions.
- Settings, provider/model definitions, MCP definitions, and the Herdr integration.
- A vendored snapshot of every skill currently present in Pi, plus intentional portable additions.
- `orwell-writing` for clear documentation, combining Orwell's six rules with an ASD-STE100 baseline.
- Skill deployment to Pi, the shared Agent Skills directory, Claude Code, and OpenCode.
- Secret checks and automatic backups before replacing live files.

Credentials, sessions, caches, and `node_modules` are never stored.

## Requirements

- Git
- Node.js 20 or newer
- Network access while installing Pi and its npm packages

## Install on a new device

```sh
git clone <private-repository-url>
cd pi-portable-config
npm run bootstrap
```

The same command works in PowerShell, Command Prompt, Bash, and zsh.

Then start Pi and authenticate each provider locally:

```sh
pi
```

Use a custom Pi directory when needed:

```sh
npm run bootstrap -- --pi-home /path/to/pi/agent
```

Useful options:

```text
--dry-run
--skip-pi
--skip-packages
--skip-skills
--pi-home <path>
```

Existing files and skill directories are copied to `~/.pi/agent/portable-backups/<timestamp>/` before replacement.

## Refresh after changing Pi

Run this on the device whose Pi installation is the source of truth:

```sh
npm run export
npm test
git diff
```

`npm run export` snapshots every current Pi skill into `skills/`, preserves the additions listed in `additionalSkills`, refreshes configuration, and updates pinned package versions. Review the diff before committing.

## Verification

```sh
npm run verify
npm test
```

`npm test` validates the repository and performs a full bootstrap dry run without modifying the machine.

## MCP portability

Common MCP servers are restored on every operating system. Platform-specific servers live under `platformServers` in `config/mcp.json.template`:

- `windbg` is installed only on Windows.
- macOS and Linux currently have no platform-only MCP entries.
- `npx` automatically becomes `npx.cmd` on Windows.
- Home and system paths are expanded for the destination device.

External MCP executables still need to exist on the destination device, including the tools you use from this list: `chunkhound`, `codegraph`, `ida_pro_mcp`, `mcp-windbg`, `notebooklm-mcp`, and Node/npm for `chrome-devtools-mcp`.

## Publish

The local repository is already initialized. Create an empty private repository, then run:

```sh
git remote add origin <private-repository-url>
git push -u origin main
```

A private remote is recommended because provider endpoints and personal workflow choices remain configuration metadata even though credentials are excluded.
