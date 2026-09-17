<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Technical Documentation Quality Pass

Based on *The Elements of Agent Style* by Yizhou Zhao, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Source: https://github.com/yzhao062/agent-style.

Apply this pass before the STE structural rules. STE improves sentences; this pass makes sure that the document contains the right information for its reader.

## Before Drafting

1. Name a concrete reader, such as a first-time user, library integrator, maintainer, or on-call engineer.
2. State the task that the reader must complete or the decision that the reader must make.
3. Inspect the authoritative code, configuration, tests, command output, or source material.
4. Separate known facts from assumptions. Verify assumptions or label them.

## While Drafting

- Explain the purpose before internal mechanics.
- Define an acronym or domain term before its first dependent use.
- Use concrete mechanisms and boundaries instead of claims such as `robust`, `fast`, or `flexible`.
- Match the verb to the evidence. Use `measures`, `shows`, `suggests`, or `proves` only when the source supports that strength.
- Keep related words close together and keep list items grammatically parallel.
- Use bullets only for independent, parallel items. Use paragraphs for cause, contrast, and reasoning.
- Describe the current system. Put implementation history in a changelog or design record.
- Use one term for each concept across the document.

## Evidence Gate

Every factual claim needs at least one of these supports in the available source:

- a named source or link;
- a number, date, version, or measured result;
- a file, symbol, test, command, or configuration key;
- a clearly stated observation with its scope.

If support is missing, flag the claim. Do not invent evidence to make the prose sound concrete.

Follow the project's heading convention. Title case is not inherently better than sentence case.
