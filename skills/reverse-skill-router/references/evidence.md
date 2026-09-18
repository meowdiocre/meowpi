# Evidence reporting

Use one record per claim:

```text
Evidence: exact artifact and observation
Finding: the narrow conclusion supported by that observation
Path: how another analyst can reproduce or inspect it
Confidence: confirmed, strong inference, or tentative
```

Prefer addresses relative to the module plus the module hash, because rebasing changes virtual addresses. Preserve command lines, tool versions, target architecture, and analysis settings when they affect the result.

Avoid these failure modes:

- Presenting decompiler syntax as recovered source code.
- Naming a function from one weak string reference.
- Treating tool auto-analysis as independent confirmation.
- Applying guessed types or symbols across a database before sampling the results.
- Claiming behavior from static reachability alone.
- Running a sample merely to obtain evidence that static inspection could provide.

End with unanswered questions and the cheapest observation that would resolve each one.
