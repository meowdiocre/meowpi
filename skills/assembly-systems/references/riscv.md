# RISC-V

Identify XLEN, the base ISA, every enabled extension, the code model, and the ABI before interpreting an instruction stream. Do not assume that compressed, floating-point, vector, bit-manipulation, or atomic extensions are present.

Under the standard integer calling convention:

- `a0`–`a7` are argument registers; `a0` and `a1` also carry results.
- `s0`–`s11` and `sp` are preserved across calls.
- `ra` and `t0`–`t6` are not preserved.
- `gp` and `tp` are fixed platform registers and should not be repurposed.
- The stack is 16-byte aligned at procedure entry under the standard ABI.

Pseudoinstructions can expand differently depending on addresses, the code model, and relaxation. Inspect relocations and the final linked image before concluding that a source-level instruction maps to one machine instruction.

## Inspection commands

```sh
riscv64-linux-gnu-gcc -O2 -S source.c -o source.s
riscv64-linux-gnu-objdump -dr binary
llvm-objdump -d --mattr=+c binary
rustc --target riscv64gc-unknown-linux-gnu -C opt-level=3 --emit=asm source.rs
```

## Authoritative references

- RISC-V ISA manuals: https://github.com/riscv/riscv-isa-manual
- RISC-V ELF psABI: https://github.com/riscv-non-isa/riscv-elf-psabi-doc
- RISC-V assembly programmer's manual: https://github.com/riscv-non-isa/riscv-asm-manual
