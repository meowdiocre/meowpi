---
name: reverse-skill-router
description: Route authorized reverse engineering and security analysis across native binaries, IDA, Ghidra, radare2, binary diffing, Go or Rust artifacts, mobile apps, firmware, protocols, malware, and forensics. Use when the target or workflow spans more than assembly reading; do not use for ordinary source-code development.
---

# Reverse-skill router

This is a portable adaptation of `zhaoxuya520/reverse-skill`. It retains the evidence-first routing model without the upstream repository's platform-specific installers, persistent journal, or CTF sidecar.

## Scope

Treat a user-supplied local sample as permission for read-only static inspection. Before dynamic execution, modification, exploitation, credential access, network interaction, or testing a system owned by another party, confirm that the requested action and target are authorized. Do not infer authorization from the presence of a tool or target.

Do not run unknown binaries directly on the host. Use an isolated environment appropriate to the target. Do not install tools, register MCP servers, or alter security settings unless the user asked for that setup.

## Route

Read [references/routes.md](references/routes.md), select the smallest matching route, and load only the linked section. Use `assembly-systems` for instruction and ABI interpretation. Use `idapython` for IDA scripting when available.

For every route:

1. Establish file identity, hashes, architecture, format, and relevant protection metadata.
2. Preserve evidence before changing the sample or analysis database.
3. Start with static triage, then add dynamic analysis only when it answers a concrete question.
4. Record observations separately from inferences. Tie each finding to a file, address, function, packet, artifact, or command output.
5. Validate important claims through an independent view such as a second disassembler, debugger observation, small emulator probe, or reproducible script.

Use the compact Evidence → Finding → Path form described in [references/evidence.md](references/evidence.md). Stop when the requested question is answered; do not expand a reverse-engineering task into exploitation or live testing without a new request.
