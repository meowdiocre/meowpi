# Portable Pi configuration

This repository reproduces the same Pi setup on Windows, macOS, or Linux. It restores portable configuration and skills. Authentication stays local to each device.

## Install

You need Git, Node.js 20 or newer, and network access.

```sh
git clone https://github.com/meowdiocre/pi-portable-config.git
cd pi-portable-config
npm run bootstrap
pi
```

Authenticate each provider when Pi starts. If PowerShell blocks `.ps1` launchers, use `npm.cmd` and `pi.cmd` instead.

The bootstrap stores replaced files in `~/.pi/agent/portable-backups/<timestamp>/`.

## Included

- The pinned Pi command-line interface and Pi packages.
- Settings, model definitions, Model Context Protocol (MCP) servers, and the Herdr extension.
- Skills for Pi, Claude Code, OpenCode, and Codex through the shared Agent Skills directory.
- Repository and skill validation before installation.

The repository does not store credentials, sessions, caches, or `node_modules`.

## Update the snapshot

Run these commands on the device whose Pi installation is the source of truth:

```sh
npm run export
npm test
git diff
```

The export refreshes the portable configuration, package versions, and Pi skills. It preserves repository-owned skills listed in `additionalSkills`.

Edit repository-owned skills here, not in their installed copies. Review the diff before you commit and push it.

## Writing skills

| Skill | Use |
|---|---|
| `writing-router` | Select the writing workflow. |
| `plain-english` | Tighten natural prose. |
| `simple-english` | Write technical documentation and procedures. |
| `style-review` | Audit technical Markdown. |

```sh
npm run review-docs -- README.md
```

## MCP servers

The shared configuration defines servers for Exa, CodeGraph, IDA Pro, and NotebookLM. WinDbg is available only on Windows.

The bootstrap restores the definitions but does not install external executables. See `config/mcp.json.template` for the required commands.
