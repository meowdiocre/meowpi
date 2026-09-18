# Testing and verification

Choose evidence from the behavior and risk of the change. A documentation correction, parser change, lock-free algorithm, and public API migration do not need the same test plan.

## Evidence ladder

1. **Reproduction or contract:** capture the current failure or the new externally visible behavior.
2. **Focused check:** run the smallest test, compiler invocation, static check, or probe that can disprove the change.
3. **Boundary cases:** cover relevant empty, minimum, maximum, malformed, partial, overflow, timeout, cancellation, and failure paths.
4. **Integration:** exercise the real boundary when mocks would conceal serialization, ABI, filesystem, database, network, process, or concurrency behavior.
5. **Repository checks:** run the required formatter, compiler, linter, static analyzer, test suites, and build.
6. **Risk-specific tools:** use sanitizers, race detectors, fuzzers, property tests, model checks, disassembly inspection, benchmarks, or target-hardware tests when the changed behavior warrants them.

## Test design

- Prefer behavior and contracts over implementation details. A refactor should not require rewriting tests when observable behavior is unchanged.
- Add a regression test that fails for the original bug and passes for the fix when the failure is deterministic.
- For new behavior, test the important success path and the failure or boundary paths likely to break.
- Use unit tests for local logic, integration tests for component boundaries, and end-to-end tests only for critical journeys that require the assembled system.
- Make tests deterministic. Control time, randomness, locale, environment, network, and concurrency where they affect the result.
- Use property or fuzz testing for parsers, codecs, allocators, protocol state machines, arithmetic, and other large input spaces.
- Do not require a universal coverage percentage. Follow the repository's threshold and inspect whether the changed risk is actually exercised.

## Test integrity

- Observe a new regression test fail for the expected reason before relying on it. If that is impractical, state why and provide another independent check.
- Fix production code when a valid test reveals a defect. Change the test only when its contract is wrong or the intended behavior changed.
- Do not replace meaningful assertions with snapshots, broad mocks, sleeps, retries, ignored failures, or looser expectations merely to get green output.
- Keep test helpers simpler than the behavior they verify. Avoid reproducing the production algorithm in the expected-value calculation.

## Verification report

Report the exact commands that matter, their result, and any environment or scope limitation. Separate automated proof, manual inspection, and unverified assumptions. A passing command supports only the behavior it actually exercised.
