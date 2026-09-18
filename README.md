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

## Engineering and systems skills

- `code-standards` provides the shared research, planning, implementation, review, and verification lifecycle for every code change.
- `git-workflow` handles safe commits, branches, merges, rebases, conflicts, pull requests, tags, and releases. It loads `caveman-commit` for concise Conventional Commit messages.
- `systems-coding-style` supplies the minimalist low-level baseline, with `modern-cpp`, `rust-best-practices`, and `assembly-systems` loaded only for matching work.
- `assembly-systems` covers x86-64, AArch64, RISC-V, ABIs, compiler output, inline assembly, SIMD, and low-level verification.
- `reverse-skill-router` includes the complete pinned upstream collection: 45 core modules, 42 CTF modules, shared references, scripts, and routing data.

The code standards workflow is adapted from ECC, with repository-native conventions taking precedence. It uses risk-based evidence instead of fixed coverage, file-size, function-size, or immutability rules that do not fit every systems project.

The reverse collection is bundled under `skills/reverse-skill-router/upstream/`, preserving the original layout and licenses. The baseline router loads the relevant module on demand. Its Node entry point works on Windows, macOS, and Linux; tool-specific upstream helpers retain their own runtime and OS requirements. Analysis tools are installed separately when needed.

```sh
node skills/reverse-skill-router/scripts/route.mjs "analyze a stripped Rust binary"
```

Keep case output and generated tool indexes in the project being analyzed. Verification checks the bundled files against the pinned upstream snapshot.

## Update the snapshot

Run these commands on the device whose Pi installation is the source of truth:

```sh
npm run export
npm test
git diff
```

The export refreshes the portable configuration, package versions, and complete Pi skill baseline from the current installation.

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
