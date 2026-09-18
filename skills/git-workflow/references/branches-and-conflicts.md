# Branches and conflicts

## Branch strategy

Use the repository's established strategy: trunk-based development, short-lived feature branches, release branches, or another documented model. Do not impose GitFlow or direct-to-main work on a repository that chose differently.

Choose short, descriptive branch names in the project's format, such as `fix/parser-overflow` or `feature/device-probe`. Do not rename or delete remote branches unless the task requires it.

## Merge or rebase

- Merge when preserving the integration event or shared branch topology matters.
- Rebase local, unpublished commits when a linear history is useful and project policy permits it.
- Do not rebase public history without explicit coordination.

Inspect the commit range and working tree before either operation. A clean tree reduces ambiguity, but do not hide unrelated changes in an unnamed stash merely to proceed.

## Resolve conflicts

1. Read `git status` to identify the operation and every unmerged path.
2. Inspect the base and both sides. `ours` and `theirs` change meaning across merge and rebase; do not select them by label alone.
3. Resolve the intended behavior, remove conflict markers, and run focused tests.
4. Stage resolved paths explicitly.
5. Continue the merge or rebase, or abort it if the chosen integration approach was wrong.

Do not resolve a conflict by accepting an entire side when both contain required changes. Verify generated lockfiles and build metadata using their owning tools when practical.

## Stash and cleanup

Prefer committing coherent work or leaving unrelated changes in place. When a temporary stash is necessary, give it a descriptive message, include untracked files only intentionally, and confirm the stash applied cleanly before dropping it.

List merged branches before deleting any branch. Use safe deletion for fully merged local branches. Remote deletion, forced deletion, and bulk cleanup require exact scope and clear authorization.
