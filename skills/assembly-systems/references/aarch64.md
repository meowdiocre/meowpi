# AArch64

## Base AAPCS64 facts

- `x0`–`x7` carry integer and pointer arguments and results; `v0`–`v7` carry SIMD and floating-point arguments and results according to classification rules.
- `x19`–`x29` and `sp` are preserved as specified by AAPCS64. `x30` is the link register and is not generally preserved across a nested call; a non-leaf function saves its return address when needed.
- `x16` and `x17` are intra-procedure-call temporaries. `x18` is platform-specific and must not be treated as a general register without checking the target platform.
- Keep `sp` 16-byte aligned whenever it is used. AArch64 has no universal red-zone rule; use only a platform ABI's documented allowance.
- A write to `wN` clears the upper half of `xN`.

Windows ARM64 follows AAPCS64 with platform-specific rules for registers, stack walking, exceptions, and a small reserved stack area. Apple platforms also have ABI differences. Confirm the operating system before interpreting prologues, variadic calls, or unwind data.

## Inspection commands

```sh
clang --target=aarch64-linux-gnu -O2 -S source.c -o source.s
llvm-objdump -d binary
rustc --target aarch64-unknown-linux-gnu -C opt-level=3 --emit=asm source.rs
```

Read `adrp` plus a following add or load as one address-materialization sequence. Distinguish ordinary loads and stores from acquire, release, exclusive, and large-system-extension atomic instructions. Treat pointer authentication and branch target identification as control-flow integrity mechanisms, not application logic.

## Authoritative references

- Arm ABI repository: https://github.com/ARM-software/abi-aa
- AAPCS64: https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst
- Windows ARM64 ABI: https://learn.microsoft.com/cpp/build/arm64-windows-abi-conventions
- Arm architecture documentation: https://developer.arm.com/documentation
