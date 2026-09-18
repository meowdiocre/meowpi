# Pull requests and releases

## Pull requests

Identify the actual base branch, then review the whole proposed change rather than only the last commit:

```sh
git log --oneline <base>..HEAD
git diff --stat <base>...HEAD
git diff <base>...HEAD
```

A useful pull request explains:

- the problem or goal;
- the chosen solution and important tradeoffs;
- the verification performed;
- compatibility, migration, security, or operational effects;
- linked issues and reviewer-specific context.

Keep the title consistent with repository conventions. Do not claim a test passed unless its result was observed. Before updating an existing pull request, inspect its current branch, description, checks, and review state.

## Releases

Follow the repository's release process and versioning scheme. Under semantic versioning:

- patch fixes compatible defects;
- minor adds compatible behavior;
- major introduces incompatible behavior.

Derive the version from user-visible impact, not commit count. Update changelogs and migration notes from the actual release range. Verify the exact release commit before tagging.

Prefer annotated tags when project policy does not specify otherwise. Treat tags and published releases as external state: do not create, replace, push, or publish them unless the user requested that action. Never move a published tag silently.

Report the release commit, version, tag, checks, artifacts, and publication result. If signing, credentials, protected environments, or manual approval are required, stop at that boundary and state what remains.
