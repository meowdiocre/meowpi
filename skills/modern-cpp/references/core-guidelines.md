# Practical C++ core guidelines

This is a compact, repository-aware adaptation of the [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines) and ECC's [`cpp-coding-standards`](https://github.com/affaan-m/ECC/tree/dd6ee538aee0f548d4a6b520118f875431fd749e/skills/cpp-coding-standards). Apply it selectively: the project's language level, ABI, platform, error model, and conventions come first.

## Interfaces and functions

- Use domain types when primitive parameters would hide units, ownership, identity, or valid states.
- Pass small, cheap values by value. Pass read-only larger objects by `const T&`. For sink parameters, choose by-value-and-move or `T&&` according to the API and measured cost.
- Return results instead of writing through output parameters. Return a named struct when multiple values form one result. Keep output parameters where an existing API, ABI, or allocation constraint requires them.
- Use `std::span` and `std::string_view` for borrowed ranges only when their lifetime is evident. Never return a view or reference to a local or temporary.
- Keep each function responsible for one coherent operation. Split only when the extracted operation has a useful name, invariant, or independent test boundary.
- Make preconditions representable in types when practical. Validate untrusted or dynamically constrained data at the boundary.
- Mark `noexcept` only when the function truly cannot throw under its contract. Remember that allocation, callbacks, and member operations may throw.
- Use `[[nodiscard]]` when silently ignoring a result is likely to lose an error, resource, or required state transition.

## Classes and special members

- Use `struct` for passive data whose members vary independently. Use `class` when construction and operations must preserve an invariant.
- A constructor must establish a usable object or report failure through the repository's error model. Avoid two-phase initialization unless the surrounding API requires it.
- Mark converting constructors and conversion operators `explicit` unless implicit conversion is intentional and unsurprising.
- Prefer the Rule of Zero: compose resource-owning members and let the compiler generate special members.
- If a type directly manages a resource or customizes one special member, deliberately define, default, or delete the full relevant copy/move/destructor set. Make moves `noexcept` when that guarantee is correct.
- A polymorphic base destructor must be public and virtual when deletion through the base is allowed, or protected and non-virtual when it is forbidden.
- Use `override` on overrides and `final` only when extension is intentionally closed. Do not call virtual functions from constructors or destructors expecting derived dispatch.
- Avoid `memcpy`, `memset`, relocation tricks, and binary serialization on non-trivial objects unless their exact object-model requirements are proven.

## Ownership and resources

- Bind every acquired resource to an object whose destructor releases it. This includes non-memory resources and rollback actions.
- Prefer stack and value ownership. Use `std::unique_ptr` for exclusive heap ownership and `std::shared_ptr` only when independent owners must extend the same lifetime.
- Treat raw pointers and references as borrowed unless an external interface defines otherwise. Record unusual ownership at the boundary rather than relying on folklore.
- Encapsulate required `new`/`delete`, `malloc`/`free`, platform handles, custom allocators, and C APIs behind the smallest RAII boundary that preserves their semantics.
- Make nullable and non-null states clear. Do not introduce a wrapper merely to disguise an unavoidable pointer-based ABI.
- Avoid returning ownership through an unannotated raw pointer.

## Initialization, constants, and conversions

- Initialize every object before use and keep its scope no wider than needed.
- Use `const` for state that should not change after initialization; use localized mutation when it is clearer or avoids needless copies and allocations.
- Use `constexpr` or `consteval` when compile-time evaluation is part of the contract or materially improves correctness, not as decoration.
- Prevent accidental narrowing and signed/unsigned surprises. Check that external sizes and integers are representable before conversion.
- Prefer named casts that state intent. Use `reinterpret_cast` and `const_cast` only at justified low-level boundaries with the invariant made explicit.
- Prefer `enum class` for scoped, type-safe enumerations. Preserve plain enums or exact underlying representations when interoperability requires them.
- Follow the repository's initialization syntax. Braced initialization catches narrowing but may select `initializer_list` overloads; choose deliberately.

## Error handling

Use one coherent model per layer and follow the repository's established contract:

- Use exceptions for failures that prevent an operation from meeting its contract when exceptions are enabled and form part of the API.
- Use `std::expected<T, E>` or the project's result type for expected, typed failures that callers commonly inspect or recover from.
- Use status codes where required by C compatibility, stable ABI, freestanding environments, or an established no-exceptions policy.

In every model:

- Do not silently discard errors or depend on stale global state.
- Preserve actionable context without duplicating logs at every layer.
- Keep destructors, deallocation, and rollback paths non-failing from the caller's perspective.
- If using exceptions, throw objects by value, catch by reference, and avoid exceptions as ordinary control flow.
- Do not translate between exceptions, status codes, and result types repeatedly inside one layer. Convert at a deliberate boundary.

## Concurrency

- Define the shared invariant, synchronization owner, lock order, and shutdown behavior before choosing primitives.
- Keep writable sharing small. Prefer message passing, immutable snapshots, or partitioned ownership when they simplify the design.
- Acquire locks with named RAII guards. Use `std::scoped_lock` for multiple mutexes instead of manually sequencing them.
- Wait on condition variables with a predicate and re-check state after wakeup.
- Do not call unknown code, user callbacks, blocking I/O, or re-entrant operations while holding a lock unless the contract explicitly requires it.
- `volatile` is not synchronization. Use atomics or locks; reserve `volatile` for hardware or other implementation-defined boundaries.
- Choose atomic memory order from a documented happens-before argument. Default to simpler synchronization when that proof is unclear.
- Avoid detached threads and lock-free structures unless ownership, reclamation, cancellation, and measurable benefit are all established.

## Templates and generic code

- Introduce a template when one algorithm or abstraction genuinely serves multiple types. Prefer an ordinary function or overload when it is clearer.
- On C++20 and later, constrain public templates with standard or small domain concepts when constraints improve the interface and diagnostics.
- On older standards, use the repository's existing constraint idiom; do not force concepts into an unsupported build.
- Prefer `constexpr` computation and ordinary types over elaborate template metaprogramming.
- Overload function templates instead of specializing them unless the language rules and design specifically require specialization.

## Source and ABI hygiene

- Follow repository naming, file extensions, namespaces, include style, and formatting. Do not impose a separate naming convention.
- Keep headers self-contained and independent of inclusion order. Use the project's include guards or `#pragma once` policy.
- Do not place global `using namespace` directives in headers.
- Include what the interface needs, but keep implementation-only dependencies out of public headers when practical.
- Use macros only where preprocessing is required. Keep macro names scoped and collision-resistant.
- Before changing public layouts, virtual interfaces, calling conventions, exported symbols, exceptions, or standard-library types in an ABI, check compatibility requirements.

## Performance

- Optimize from profiles, benchmarks, or a demonstrated complexity problem. Compare equivalent builds and inputs.
- Examine data layout, access patterns, allocation frequency, indirection, copies, synchronization, and I/O before adding clever code.
- Prefer contiguous storage when access patterns benefit from it, but preserve pointer stability and mutation requirements.
- Do not claim that a newer construct is faster or zero-cost without evidence relevant to the target compiler and workload.

## Focused review checklist

- Does the interface express ownership, lifetime, nullability, valid states, units, and failure clearly?
- Are all resources released on success, failure, cancellation, and partial construction?
- Are special members and polymorphic destruction correct?
- Can a borrowed view, lambda capture, iterator, callback, or thread outlive its source?
- Are conversions, sizes, indices, and arithmetic valid at boundary values?
- Does concurrent code have a clear invariant, lock scope, wait predicate, and shutdown path?
- Are templates, allocations, shared ownership, and abstractions justified by the current problem?
- Are ABI and repository conventions preserved?
