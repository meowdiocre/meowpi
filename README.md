# Portable Pi setup

This repository recreates the same Pi configuration and complete skill set on Windows, macOS, or Linux. It uses dependency-free Node.js scripts because Pi and the Skills ecosystem already require Node.

## Included

- Pi fork `@earendil-works/pi-coding-agent`, pinned to the exported version.
- All configured Pi npm packages at their installed versions.
- Settings, provider/model definitions, MCP definitions, and the Herdr integration.
- A vendored snapshot of every skill currently present in Pi, plus intentional portable additions.
- A routed writing suite for natural prose, technical documentation, and post-draft review.
- Skill deployment to Pi, the shared Agent Skills directory, Claude Code, and OpenCode.
- Secret checks and automatic backups before replacing live files.

Credentials, sessions, caches, and `node_modules` are never stored.

## Writing suite

The writing skills use separate rule sets for separate readers:

- `writing-router` selects the workflow when the request is ambiguous.
- `plain-english` edits voice-led nonfiction with Orwell/Gowers rules and a model-writing-tic pass.
- `simple-english` writes technical documentation with pragmatic or strict ASD-STE100-derived rules plus audience and evidence checks.
- `style-review` audits technical Markdown with a bundled dependency-free Node script and a semantic checklist derived from *The Elements of Agent Style*.

Plain English and Simple English must not process the same passage. The suite targets clarity, accuracy, and natural voice; it does not promise AI-detector evasion.

Audit a technical Markdown file on any supported operating system:

```sh
npm run review-docs -- README.md
npm run review-docs -- --compare before.md after.md
```

The reviewer ignores frontmatter, fenced code, and inline code. Its mechanical pass is only one part of review; factual claims and reader fit still require semantic and project-source checks.

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

`npm run export` snapshots every current Pi skill into `skills/`, preserves the repo-owned versions listed in `additionalSkills`, refreshes configuration, and updates pinned package versions. Edit an additional skill in this repository, not in its installed copy. Review the diff before committing.

Vendored writing sources are pinned to full commit SHAs in `manifests/skill-sources.json`. Review upstream changes and licenses before changing those pins.

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
