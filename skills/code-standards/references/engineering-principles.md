# Engineering principles

Apply these principles in the context of the repository. They are decision rules, not numeric quotas.

## Simplicity and structure

- Prefer ordinary language constructs, explicit data flow, and names that reveal purpose.
- Keep modules cohesive and dependencies directional. Split code when responsibilities or reasons to change differ, not because a line count crossed an arbitrary threshold.
- Remove real duplication after its shared shape is clear. Similar-looking code with different invariants may deserve to remain separate.
- Add an abstraction when it makes current behavior easier to understand, test, or change. Do not build extension points for hypothetical requirements.

## State and ownership

- Make ownership, lifetime, mutability, and resource cleanup unambiguous.
- Prefer immutable values when they simplify reasoning. Prefer localized mutation when it avoids waste or better represents the algorithm. Prevent unexpected aliasing and hidden side effects either way.
- Keep global state rare and explicit. Define synchronization and shutdown behavior for shared state.
- Pair acquisition and release through the language's native mechanism: structured cleanup, RAII, scoped guards, or ownership types.

## Interfaces and compatibility

- Preserve public behavior unless the request requires a change. Check callers, serialized forms, ABI surfaces, command-line flags, configuration, and error contracts before modifying them.
- Make migrations explicit. Add compatibility only when the project or user needs it; do not preserve obsolete paths speculatively.
- Validate external data at the boundary and convert it into types or structures that carry the internal invariants.

## Errors and observability

- Propagate errors through the repository's established model. Preserve useful context without leaking secrets or sensitive internals.
- Do not silently discard failures. Distinguish unavailable, malformed, unauthorized, transient, and invariant-breaking states when callers need different responses.
- Logs and metrics should answer operational questions. Avoid duplicate logging at every layer and avoid logging secrets, credentials, or unnecessary personal data.

## Dependencies and generated code

- Reuse standard-library or existing project facilities before adding a dependency.
- Add a dependency only when its maintained functionality outweighs supply-chain, binary-size, build-time, portability, and licensing costs.
- Treat vendored and generated files according to their source workflow. Do not hand-edit generated output or reformat vendored code unless the task explicitly updates that source.

## Security and performance

- Identify trust boundaries, privileged operations, secret handling, parsing, allocation, filesystem and network access, concurrency, and unsafe or foreign-code boundaries affected by the diff.
- Use least privilege, safe defaults, bounded resource use, parameterized data access, and explicit authorization checks where applicable.
- Optimize from measurements or a clear complexity problem. Preserve benchmark conditions and compare equivalent builds. Do not call code faster based only on fewer lines or instructions.
- In systems code, consider worst-case sizes, integer ranges, partial operations, cancellation, reentrancy, memory ordering, cache behavior, and cleanup after failure.

## Review questions

- Does the code implement the requested contract without unrelated behavior changes?
- Can invalid input or a partial failure leave corrupted state, leaked resources, or ambiguous ownership?
- Did the change alter a public interface, persistence format, protocol, ABI, or security boundary?
- Is every new abstraction, dependency, allocation, clone, lock, unsafe block, or assembly boundary justified?
- Are comments recording durable reasoning and invariants rather than narrating the code?
