<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Revision Contract

Use this contract only after the user approves a write-beside polished draft.

## Inputs

- The source Markdown file.
- The mechanical audit output.
- Confirmed semantic findings from `rules.md`.

## Requirements

1. Resolve only reported findings.
2. Preserve meaning, section order, and supported facts.
3. Do not add metrics, citations, links, commands, code behavior, or claims.
4. Preserve frontmatter, code fences, tables, heading levels, list nesting, links, inline code, and quoted text unless that structure caused the finding.
5. Keep untouched paragraphs byte-for-byte when practical.
6. Write the result to `FILE.reviewed.md`. Never overwrite `FILE`.
7. Rerun the bundled audit and show the before/after counts plus a diff.

If a finding requires evidence that the source does not contain, leave the claim unchanged and report it as unresolved.
