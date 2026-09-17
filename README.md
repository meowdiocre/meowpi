# Portable Pi setup

This repository rebuilds the current Pi environment on a new Windows machine without committing credentials or runtime state.

It contains:

- Pi fork `@earendil-works/pi-coding-agent` pinned to `0.85.1`.
- Pi packages pinned to the currently installed versions.
- Portable settings, provider/model definitions, MCP definitions, and the Herdr integration extension.
- Reproducible installs for the selected third-party skills.
- The local `systems-coding-style` skill for concise, idiomatic C, C++, Rust, and systems code.

## New device

Install Git and Node.js 20 or newer, then clone this repository and run:

```powershell
.\bootstrap.cmd
```

The bootstrap command:

1. installs the pinned Pi fork;
2. installs the pinned Pi packages;
3. restores portable settings, models, MCP servers, and extensions;
4. installs third-party skills for Pi, Codex, OpenCode, and Claude Code as configured;
5. installs the local systems coding skill.

Existing destination configuration files are backed up under `~/.pi/agent/portable-backups/` before replacement.

After bootstrap, start Pi and authenticate providers on that device:

```powershell
pi.cmd
```

Provider credentials are intentionally not stored here. Use Pi's login flow or recreate the credentials locally.

## Refresh this repository

After changing Pi settings or package versions on your main machine:

```powershell
.\export.cmd
.\verify.cmd
git diff
```

Review the diff before committing. `export.cmd` refuses JSON containing credential-shaped property names.

## Verify without changing the machine

```powershell
.\verify.cmd
.\bootstrap.cmd -DryRun
```

## MCP prerequisites

The repository restores MCP configuration but does not install every external executable. Install the tools you use on the destination machine:

- `chunkhound`
- `codegraph`
- Python with `ida_pro_mcp`
- Windows Debugging Tools and `mcp-windbg`
- `notebooklm-mcp`
- Node.js/npm for `chrome-devtools-mcp`

Missing tools do not expose secrets; their MCP servers simply will not start until the executable is installed.

## Publish

Create an empty private repository on your Git host, then connect and push this local repository:

```powershell
git remote add origin <your-private-repository-url>
git push -u origin main
```

A private repository is recommended because model endpoints and personal workflow choices are still configuration metadata, even though credentials are excluded.
