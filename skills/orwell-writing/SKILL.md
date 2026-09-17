---
name: orwell-writing
description: Compatibility alias for the former combined Orwell and STE skill. Use only when the user explicitly invokes orwell-writing or an old workflow refers to it; route new requests to plain-english, simple-english, or style-review instead.
---

# Orwell Writing Compatibility Alias

This skill remains installed so old prompts do not break. It no longer owns a writing rule set.

Load and follow one sibling skill before writing:

- Use `plain-english/SKILL.md` for prose where voice and rhythm matter.
- Use `simple-english/SKILL.md` for technical documentation and instructions.
- Use `style-review/SKILL.md` to audit an existing technical Markdown file.
- Use `writing-router/SKILL.md` when the correct route is unclear.

Do not apply Plain English and Simple English to the same passage. Do not claim AI-detector evasion.
