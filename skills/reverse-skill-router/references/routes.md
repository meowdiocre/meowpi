# Reverse-engineering routes

Select one primary route. Add a second only when evidence requires it.

| Target or intent | Primary route | Useful tools |
|---|---|---|
| PE, ELF, Mach-O, library, driver | Native binary | IDA, Ghidra, Binary Ninja, radare2, object-format tools |
| One function or instruction sequence | Assembly | `assembly-systems`, debugger, compiler probe |
| IDA database automation | IDA | IDA MCP and `idapython` |
| No IDA license or repeatable batch analysis | Ghidra | headless analyzer, scripts, decompiler export |
| Fast CLI triage or patch inspection | radare2 | `rabin2`, `r2`, `rasm2`, `radiff2` |
| Old and new program versions | Binary diff | symbols, normalized CFGs, strings, relocations, BinDiff or Diaphora |
| Stripped Go or Rust binary | Language-aware native | runtime metadata, demangling, panic strings, package paths |
| APK, DEX, native Android library | Mobile | jadx/apktool first, then native and authorized instrumentation |
| Firmware image | Firmware | container extraction, entropy, filesystem, CPU/endianness, emulation |
| Unknown network format or PCAP | Protocol | framing, state machine, field hypotheses, replay only in scope |
| Suspected malware | Malware | isolated static triage, configuration extraction, controlled behavior |
| Memory, disk, logs, deleted artifacts | Forensics | read-only acquisition, hashes, timeline, provenance |

## Native binary

Determine format, architecture, endianness, entry points, sections or segments, imports, exports, relocations, strings, signatures, debug metadata, and mitigations. Build a function and cross-reference map before naming behavior. Decompiler output is a hypothesis: verify types, signedness, aliasing, indirect calls, and exceptional control flow against disassembly.

## IDA

Prefer the configured IDA MCP for queries and database edits. Wait for analysis before using its results. Rename or type an item only when evidence supports it, and keep uncertain names visibly provisional. Use `idapython` for repeatable operations rather than emitting legacy `idc` snippets.

## Binary diff

Anchor on stable exports, strings, constants, callers, and structural features. Normalize addresses and compiler noise. Treat an LLM-proposed match as a candidate until control flow, callees, data references, and behavior agree. Apply names in batches small enough to review and revert.

## Go and Rust

For Go, inspect build information, `pclntab`, module data, runtime functions, interfaces, slices, strings, goroutines, and embedded files. For Rust, use symbol demangling, crate paths, panic strings, enum layout clues, monomorphization, trait objects, and async state machines. Do not mistake runtime scaffolding for business logic.

## Mobile and firmware

Separate container, managed-code, native-code, and runtime-instrumentation layers. For firmware, preserve the original image and record every extraction offset. Identify the CPU and load address before disassembly. Emulate peripherals only from documented assumptions; hardware interaction requires explicit scope.

## Protocols

Start from message boundaries and direction. Track offsets, widths, endianness, length fields, checksums, identifiers, optional fields, and state transitions. Keep a machine-readable schema or parser as the executable hypothesis. Validate it against multiple captures rather than one packet.

## Malware and forensics

Default to non-executing inspection. Use an isolated lab for behavior, record its network and persistence controls, and distinguish sample behavior from sandbox artifacts. For forensic work, preserve acquisition method, hashes, timestamps, timezone, and transformation history.
