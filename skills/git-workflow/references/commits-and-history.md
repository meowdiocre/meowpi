# Commits and history

## Build an atomic commit

An atomic commit has one coherent purpose and can be reviewed or reverted without dragging unrelated work with it.

1. Inspect `git status --short` and the unstaged diff.
2. Stage explicit paths with `git add -- <path>` or interactively with `git add -p` when the file contains mixed concerns.
3. Review `git diff --cached --stat` and `git diff --cached`.
4. Run the focused checks for the staged behavior.
5. Use `caveman-commit` to compose the message from the staged diff.
6. Commit, then inspect `git show --stat --oneline HEAD` and `git status --short`.

Do not use broad staging when it would capture unrelated user changes, generated output, credentials, or machine-local files.

## Conventional commits

Use `<type>(<scope>): <summary>` when the repository accepts Conventional Commits. Prefer a stable domain or component as the scope, not a filename. A breaking change uses `!` and a `BREAKING CHANGE:` body.

Follow existing repository history when it uses another convention. A portable skill should not rewrite a project's established vocabulary.

## Correct mistakes safely

- Unstage while keeping the file: `git restore --staged -- <path>`.
- Discard a known unwanted file edit only after inspecting it: `git restore -- <path>`.
- Amend only an unshared commit and only when the task includes changing that commit.
- Revert a published or shared commit with `git revert <commit>` so the correction is visible.
- Use reset only when its target and effect on the index and working tree are understood. Avoid hard reset when a preserving operation works.

Before any history rewrite, determine whether the commits are already published and whether another contributor may depend on them. Create a named backup ref when recovery would otherwise be difficult.
