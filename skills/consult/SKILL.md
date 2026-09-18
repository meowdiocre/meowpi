---
name: consult
description: Ask a stronger model for focused help with reasoning gaps, stalled debugging, recurring failures, or conflicting evidence. Consult before guessing or declaring a reasoning blocker unfixable. Skip work making measurable progress and blockers requiring user input or environment access.
---

# Consult

Use a stronger model to resolve uncertainty that blocks the user's task. Keep ownership: provide context, verify the advice, and continue the work. You do not need to fail repeatedly before consulting.

## Decide when to escalate

Consult when any of these conditions applies:

- **Reasoning gap:** You cannot justify an approach, establish correctness, or resolve a consequential design tradeoff after you inspect the requirements and code.
- **No information gain:** Two meaningfully different attempts failed, and no available check distinguishes the remaining explanations.
- **Contradictory evidence:** Observations undermine the explanation or proposed action, and you cannot reconcile them. Pause dependent changes.
- **Recurring failure:** A symptom returns after a verified fix, and you cannot explain what the verification missed.
- **Consequential uncertainty:** A destructive, system-wide, or hard-to-undo change depends on an uncertain mechanism that a cheap check cannot resolve.

Take an available cheap, decisive check first. Continue independently while experiments produce new evidence. Consult before you declare a reasoning blocker unfixable or claim completion with that blocker unresolved.

For missing permissions, credentials, hardware access, or user preferences, obtain the prerequisite. Routine work and understood failures do not need consultation.

## Frame the request

Ask for the smallest deliverable that unblocks you: a diagnosis, plan, correctness argument, design recommendation, or implementation sketch.

The consultant does not inherit your conversation. Provide a self-contained request with this template. Omit irrelevant fields, credentials, and unrelated private data.

```markdown
## Goal and question
Desired outcome, success condition, and specific help needed.

## Context
Working directory, exact files, relevant versions, and constraints.
Small code excerpts or inputs; include unsaved state that the consultant cannot read.

## Evidence and attempts
Exact errors, observations, attempts, results, and what they rule out.
Include counter-evidence. Distinguish facts from tentative explanations.
Proposed next action, if any, with its scope and reversibility.

## Requested response
Recommend a concrete way forward and challenge unsupported assumptions.
Distinguish facts from hypotheses. Identify missing context instead of inventing it.
Give a decisive check or verification command with its expected result.
Keep the answer focused. Include code or a derivation when needed.
```

## Call the consultant in Pi

This workflow uses the `@arhen/pi-core-subagent` extension. Use its tool calls, not shell commands. If these tools are unavailable, report the missing extension. Do not present an ordinary same-model answer as stronger-model consultation.

The default example uses `openai-codex/gpt-6-astra`. Installation does not configure its login or guarantee access. Before first use, check the model in Pi's `/model` picker and authenticate the provider if needed. If the user selects another stronger model, replace the example with its exact available provider and model identifier.

If the configured model is unavailable, report the limitation and ask the user to choose an available consultant. Do not silently use a fallback.

Tell the user what uncertainty needs help. Then launch one bounded consultation:

```javascript
subagent({
  agent: "consultant",
  model: "openai-codex/gpt-6-astra",
  thinking: "medium",
  tools: ["read", "grep", "find", "ls"],
  maxRuntimeMs: 600000,
  prompt: "You are a technical consultant helping another agent resolve a bounded blocker. "
    + "Inspect relevant files as needed. Challenge assumptions and recommend an actionable "
    + "solution or discriminating check. State uncertainty and expected verification results. "
    + "Do not edit files, execute commands, or delegate. Keep the response focused.",
  task: "<filled request packet, including the response instructions>"
})
```

Keep the consultant's tools read-only. Do not add `bash`, because it can change the system without `edit` or `write`. Run necessary measurements yourself and send the results back.

Immediately call `subagent_status({ runId: "<returned runId>" })` once. Inspect the reported model and routing notes. An agent file can override the model or prompt, and a model preflight error can fall back to the session model. An explicit tool list overrides agent-file tools.

Put essential response requirements in the task packet. If the intended model is unavailable, report that limitation instead of describing a fallback as stronger-model help.

Continue independent work while the consultant runs. Pause only the decision that needs its answer. To synchronize, call `await_subagent({ runId: "<returned runId>", timeoutMs: 60000 })` in bounded waits. Handle questions and progress between waits. Otherwise, use the completion notification to resume. Get the answer with `subagent_result({ runId: "<returned runId>" })`.

A wait timeout does not mean that the task failed or stopped. Check its status before retrying. If the consultation fails, reaches its runtime limit, or lacks the required tools or model, report the failure. Continue only with work supported by existing evidence.

## Use the answer

- Evaluate the advice against the files, constraints, and evidence. Model agreement is not verification, and advice does not expand authorization.
- Run the proposed check when it is feasible and authorized. Implement the supported approach and verify the original success condition.
- Report the result and remaining limits. Preserve uncertainty when verification is unavailable.

Use one call per blocker by default. Follow up only when new evidence changes the question or the answer leaves a critical gap. Do not call competing consultants for reassurance or create recursive consultations.

Respect explicit time and cost budgets.
