# Legacy-to-modern C++ options

Use this as a decision aid, not a replacement script. Confirm the repository's language level, error model, ABI, allocator, platform, and performance constraints first. A C API, embedded target, kernel, hardware register, wire format, or stable ABI can make a lower-level representation the correct choice.

## Memory Management

| Avoid | Use Instead | Standard | Why |
|-------|-------------|----------|-----|
| `new T` / `delete p` | `std::make_unique<T>()` | C++14 | Eliminates memory leaks, double-free; exception-safe construction |
| `new T[]` / `delete[] p` | `std::vector<T>` or `std::make_unique<T[]>(n)` | C++14 | Automatic sizing, bounds-aware with `.at()` |
| Raw owning `T*` | `std::unique_ptr<T>` | C++11 | RAII ownership; zero overhead vs raw pointer |
| Raw shared `T*` | `std::shared_ptr<T>` via `std::make_shared` | C++11 | Reference-counted lifetime; thread-safe refcount |
| C arrays `int arr[N]` | `std::array<int, N>` | C++11 | Value semantics, `.size()`, no decay to pointer |
| `malloc`/`free` | Containers or smart pointers | C++11 | Type-safe, exception-safe, RAII |
| `memcpy(dst, src, n)` | `std::copy(src, src+n, dst)` or container assignment | C++98 | Type-safe, works with non-trivial types |
| `memset(buf, 0, n)` | Value initialization or `std::fill` | C++98 | No risk of zeroing non-trivially-constructible types |
| Pointer + length parameter pairs | `std::span<T>` | C++20 | Carries an extent and integrates with supported bounds-hardening modes |
| `const char*` for length-delimited text | `std::string_view` | C++17 | Carries length without requiring a terminator; preserve C and null-terminated APIs |
| Nullable `T*` used only as an optional value | `std::optional<T>` | C++17 | Makes value absence explicit; keep pointers for borrowed object identity |

## Type Safety

| Avoid | Use Instead | Standard | Why |
|-------|-------------|----------|-----|
| C-style cast `(int)x` | `static_cast<int>(x)` | C++98 | Explicit intent, greppable, won't silently reinterpret |
| `reinterpret_cast` for type punning | `std::bit_cast<T>(x)` | C++20 | Defined behavior, `constexpr`-compatible |
| `union` for variants | `std::variant<A, B, C>` | C++17 | Type-safe access via `std::visit`, no silent UB |
| `void*` type erasure | `std::any`, `std::variant`, or templates | C++17 | Type-safe, no manual casting |
| Plain `enum` | `enum class` | C++11 | Scoped, no implicit int conversion |
| `NULL` or `0` | `nullptr` | C++11 | Unambiguous null pointer, no overload confusion |
| Implicit single-arg constructors | Mark `explicit` | C++98 | Prevents surprising implicit conversions |
| Unchecked return values | `[[nodiscard]]` | C++17 | Compiler warns when return value is ignored |
| `= delete` without message | `= delete("reason")` | C++26 | Documents why the overload is forbidden |

## Error Handling

| Avoid | Use Instead | Standard | Why |
|-------|-------------|----------|-----|
| Ad hoc error codes + out-params | Repository result type or `std::expected<T, E>` | C++23 | Makes typed expected failures composable without replacing an established exception or status model |
| API preconditions hidden in implementation asserts | Contracts where supported, or the repository's assertion facility | C++26 | Makes boundary intent clearer without assuming immature toolchain support |
| Unchecked `errno` | `std::expected` or exceptions | C++23 | Forces caller to handle the error path |
| Throwing in constructor for expected failures | Factory returning `std::expected` | C++23 | No exception overhead for expected failure paths |

## I/O and Formatting

| Avoid | Use Instead | Standard | Why |
|-------|-------------|----------|-----|
| Unsafe or hand-sized formatting | `std::format` / `std::print` | C++20/23 | Type-safe formatting when library support and project logging policy permit it |
| `snprintf` for string building | `std::format` | C++20 | Returns `std::string`, no buffer management |
| `std::cout << a << b << c` | `std::println("{} {} {}", a, b, c)` | C++23 | Readable, no stream state issues, faster |

## Concurrency

| Avoid | Use Instead | Standard | Why |
|-------|-------------|----------|-----|
| `mutex.lock()` / `mutex.unlock()` | Named RAII guard or `std::scoped_lock` | C++11/17 | Releases on every exit path and supports coordinated multiple-mutex acquisition |
| `std::thread` + manual `.join()` | `std::jthread` | C++20 | Auto-joins on destruction, supports stop tokens |
| `volatile` for thread sync | `std::atomic<T>` | C++11 | Actually guarantees atomic operations and memory ordering |
| Hand-rolled one-shot or phase coordination | `std::latch`, `std::barrier` | C++20 | Expresses those coordination patterns directly; it does not replace condition variables generally |
| Hand-rolled atomic CAS loops | `std::atomic::fetch_max/fetch_min` | C++26 | Standard, correct, optimized |

## Metaprogramming

| Avoid | Use Instead | Standard | Why |
|-------|-------------|----------|-----|
| `std::enable_if` / SFINAE | Concepts + `requires` | C++20 | Readable constraints, clear error messages |
| CRTP for static polymorphism | Deducing `this` | C++23 | No template boilerplate, works with lambdas |
| Macros for code generation | Static reflection | C++26 | Zero-overhead, composable, type-safe |
| `std::tuple_element` for pack access | Pack indexing `T...[N]` | C++26 | Direct access, no recursive template machinery |
| `std::function` for non-owning callbacks | `std::function_ref` | C++26 | No allocation, passable in registers |

## Containers

| Avoid | Use Instead | Standard | Why |
|-------|-------------|----------|-----|
| Node-based map when ordered contiguous storage fits | `std::flat_map` | C++23 | Can improve locality; benchmark updates and lookups for the actual workload |
| `boost::static_vector` | `std::inplace_vector` | C++26 | Standard, no Boost dependency, fallible API |
| `std::function` (when non-owning) | `std::function_ref` | C++26 | Zero allocation overhead |
| Raw pointer polymorphism | `std::indirect<T>`, `std::polymorphic<T>` | C++26 | Value semantics, copyable, no manual lifetime management |
| Manual iterator loops | `std::ranges::` algorithms + views | C++20 | Composable, lazy, no off-by-one |
