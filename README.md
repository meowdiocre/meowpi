# Portable Pi configuration

Use the same Pi setup on Windows, macOS, or Linux. This repository stores portable configuration and shared agent skills.

## Install

Install Git and Node.js 22.19 or later. Make sure that the device has network access.

```sh
git clone https://github.com/meowdiocre/pi-portable-config.git
cd pi-portable-config
npm run bootstrap
pi
```

## Included

- The pinned Pi command-line tool and packages
- Pi settings, model definitions, and the Herdr extension
- Shared skills for Pi, Codex, Claude Code, and OpenCode
- Model Context Protocol (MCP) definitions for Exa, CodeGraph, IDA Pro, and NotebookLM
- WinDbg MCP support on Windows

See [`config/mcp.json.template`](config/mcp.json.template) for the required commands.

## Update

On the device with the current Pi setup, run:

```sh
npm run export
npm test
git diff
```

Review the diff before you commit it. Edit repository skills in `skills/`, not in their installed locations.

On another device, pull the changes. Then run `npm run bootstrap` again.
