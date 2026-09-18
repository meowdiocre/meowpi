---
name: code-standards
description: Govern implementation, bug fixes, and refactors from repository orientation through scoped research, planning, evidence-led tests, implementation, review, verification, and handoff. Use for any code change; combine it with the relevant language skill for C, C++, Rust, assembly, or another stack.
---

# Code standards

Use this skill as the shared engineering lifecycle. Repository instructions and the user's requested behavior take precedence. Existing project conventions govern language version, architecture, naming, formatting, error handling, and tooling unless the task explicitly changes them.

## Compose the workflow

Before editing, read [language routing](references/language-routing.md) and load only the companion skills that match the code being changed. The shared workflow decides how to work; the companion skill decides how good code looks in that language or domain.

For decisions about abstraction, state, interfaces, errors, comments, dependencies, security, or performance, read [engineering principles](references/engineering-principles.md). For choosing and running evidence, read [testing and verification](references/testing-and-verification.md).

## Change lifecycle

1. **Establish the contract.** Identify the requested behavior, constraints, acceptance evidence, files in scope, and actions that require separate authorization. Inspect repository instructions, relevant documentation, the working tree, and current callers before editing. Preserve unrelated user changes.
2. **Research proportionally.** Search the repository before inventing a pattern. Check primary documentation when an API, toolchain, standard, or dependency may have changed. Look outside the repository only when it resolves a real uncertainty or avoids reimplementing a substantial proven solution.
3. **Plan and baseline.** For a multi-file, risky, or architectural change, record a short plan with risks and verification. Run the narrowest relevant existing check before editing. If it already fails, distinguish the pre-existing failure from the requested work instead of silently expanding scope.
4. **Create evidence.** Reproduce a bug before fixing it. For new behavior, add a stable contract or regression test when the behavior is observable and the test adds confidence. Use an explicit manual check when automation would be brittle or would only restate the implementation.
5. **Implement the smallest coherent change.** Follow local patterns. Keep data flow, ownership, state changes, and failure behavior visible. Avoid speculative abstraction, unrelated cleanup, hidden allocation, unnecessary dependencies, and mass formatting.
6. **Review the diff.** Check correctness, error paths, public interfaces, compatibility, trust boundaries, ownership and lifetime, concurrency, resource cleanup, undefined behavior, and likely performance regressions. Fix findings supported by the diff.
7. **Verify and hand off.** Run focused checks first, then the repository's required formatter, compiler, linter, static analysis, tests, and build. Report the commands and results that support completion. Update user-facing documentation when behavior or interfaces changed. Commit or publish only when the task includes it.

## Failure discipline

- Do not weaken, delete, or bypass a valid test to make a change pass.
- Do not hide warnings, errors, or partial verification behind a success claim.
- After the same failure survives two informed attempts, stop repeating the approach. Re-read the evidence, revise the hypothesis and plan, and record a concrete blocker only if progress truly requires external input.
- Keep temporary probes and generated artifacts out of the final diff unless they are useful project assets.

The goal is a small change whose behavior, design, and verification are easy for another engineer to inspect.
