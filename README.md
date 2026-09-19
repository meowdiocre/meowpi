# MeowPi

<p align="center">
  <img src="assets/meowpi-logo.jpg" alt="MeowPi logo" width="420">
</p>

MeowPi keeps the same my Pi Setup Across all my machine. Mainly used for OS internals and reverse engineering or help me doing small pentest and  research

## Install

Install Git and Node.js 22.19 or later. Make sure that the device has network access.

```sh
git clone https://github.com/meowdiocre/meowpi.git
cd meowpi
npm run bootstrap
pi
```

## Included

- The pinned Pi command-line tool and packages
- Pi Web for persistent browser access to Pi sessions
- Pi settings, model definitions, and the Herdr extension
- Shared skills for Pi, Codex, Claude Code, and OpenCode
- MCP definitions for Exa, Context7, DeepWiki, CodeGraph, IDA Pro, and NotebookLM
- A research router that selects external sources only when the code change needs them

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
