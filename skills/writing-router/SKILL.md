---
name: writing-router
description: Route writing requests to the correct installed workflow. Use when a request could mean natural prose, technical documentation, repository agent instructions, or a post-draft style audit. Do not use when the user already named plain-english, simple-english, style-review, or writing-great-agents-md.
---

# Writing Router

Choose one primary writing workflow. Do not stack rule sets that optimize for different readers.

## Route

| Request | Load and follow |
|---|---|
| README, runbook, procedure, API guide, error message, incident report, release note, localization-ready text | The sibling `simple-english/SKILL.md` |
| Essay, blog post, email, product explanation, announcement, or other voice-led nonfiction | The sibling `plain-english/SKILL.md` |
| `AGENTS.md`, `CLAUDE.md`, or repository instructions | The sibling `writing-great-agents-md/SKILL.md` |
| Audit, score, compare, or polish an existing technical Markdown file | The sibling `style-review/SKILL.md` |

If the document mixes technical instructions with narrative prose, apply each workflow only to its matching section. Never run Plain English and Simplified Technical English over the same passage.

## Documentation Gate

Before drafting technical documentation:

1. Name the intended reader and the task that the document must help them complete.
2. Inspect the source of truth. Do not infer commands, behavior, defaults, metrics, or compatibility from style guidance.
3. Verify commands, paths, examples, links, and factual claims with the available project tools.
4. Draft with Simple English in pragmatic mode unless the user explicitly requests strict STE.
5. Use Style Review only as a final quality pass. A style score does not prove technical correctness.

The goal is clear, trustworthy prose. Do not promise that text can evade an AI detector.
