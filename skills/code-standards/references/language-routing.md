# Language and domain routing

Load the smallest useful combination. Do not copy a specialist skill's rules into the implementation plan; apply them directly.

| Work | Companion skills | What they add |
|---|---|---|
| C | `systems-coding-style` | Explicit ownership, checked sizes, cleanup, errors, bounds, aliasing, and ABI-aware design. |
| C++ | `systems-coding-style`; `modern-cpp` when the repository permits the relevant standard | RAII, value semantics, scoped ownership, supported modern idioms, compiler hardening, and sanitizers. |
| Rust | `systems-coding-style` and `rust-best-practices` | Borrowing and ownership, precise errors, linting, testing, performance, documentation, and unsafe invariants. |
| Assembly, inline assembly, SIMD, atomics, ABI boundaries, compiler output | `assembly-systems`; add the source-language skill at mixed-language boundaries | ISA and ABI assumptions, calling conventions, compiler contracts, memory ordering, and instruction-level verification. |
| Comments or API documentation across C, C++, Rust, JavaScript, TypeScript, Python, Go, or shell | `comment-audit` when comment quality is part of the task | Idiomatic comments and docstrings without narration or boilerplate. |
| Whole binaries, malware, firmware, symbol recovery, or reverse engineering | `reverse-skill-router` instead of treating the work as an ordinary source change | Full analysis routing, evidence handling, and tool-specific workflows. |
| Current external APIs, dependencies, standards, official docs, or public code patterns | `research-router` | Local-first evidence, version-aware documentation, focused web/code search, and source verification. |
| High-risk proof or a user request to demonstrate correctness | `verify` | Fail-first evidence, targeted checks, live output, and explicit limitations. |
| Commits, branches, merges, rebases, conflicts, pull requests, tags, or releases | `git-workflow`; add `caveman-commit` when naming a commit | Inspect-first repository operations, history safety, atomic staging, concise messages, and publication boundaries. |

For other languages, follow repository-native conventions and tooling. Add a specialist only when it materially improves the current change.

## Shared low-level rules

- Match the repository's language edition, compiler, target, ABI, build system, formatter, warning policy, and error model.
- Prefer the smallest direct solution that exposes ownership, lifetime, state, and failure. Do not modernize unrelated code.
- Treat integer conversion, overflow, bounds, alignment, aliasing, endianness, concurrency, resource lifetime, FFI, and ABI compatibility as design concerns where relevant.
- Use controlled mutation when it is the clearest or most efficient representation. Keep it local and make invariants visible. Do not copy large objects merely to satisfy a blanket immutability rule.
- Comments should preserve facts the code cannot express: safety invariants, synchronization, ownership exceptions, hardware or protocol constraints, compatibility requirements, and non-obvious tradeoffs.
