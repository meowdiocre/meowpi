---
name: model-file-audit
description: "Audit model artefacts for malicious pickle code before anything loads them: picklescan for fast denylist verdicts, fickling to decompile a pickle into readable Python and prove intent. Use when a .pkl, .pt, .bin, .ckpt or .joblib arrives from a download, a hub or a colleague. Not for auditing safetensors or gguf weights, which are not pickle."
---

# Model file audit

A pickle is a program, not a data format. Loading one - `torch.load`, `joblib.load`, `pickle.load` - executes whatever its `__reduce__` says, in your process, with your credentials. Two tools answer the only question that matters: `picklescan` gives a fast, denylist-based verdict over a file or a tree; `fickling` translates the pickle into Python so you can read what it would do.

Neither tool imports the payload into your interpreter the way `pickle.load` would. Neither tool proves a file safe: `picklescan` can only flag globals it knows, and `fickling` says so about its own `--check-safety`.

## When to use

| Situation | Tool | Command |
| --- | --- | --- |
| One file arrived, verdict in seconds | picklescan | `picklescan -p model.pkl` |
| Whole download directory | picklescan | `picklescan -p ./models --strict` |
| Hub repo, before download | picklescan | `picklescan -hf org/model` |
| Need to know what the file does | fickling | `fickling model.pkl` |
| Gate a build or CI job | picklescan | exit code 1 on infection |
| Suspicious global, want the call sequence | fickling | `fickling -t model.pkl` |
| Show a colleague what a payload would run | fickling | `fickling -i '<code>' model.pkl` |
| Legacy torch `.pt`/`.ckpt` zip | both, on the member | unzip, then scan `archive/data.pkl` |

Not for: safetensors and gguf (no pickle, nothing to execute), tensorflow SavedModel or HDF5 (different formats; picklescan will not see them), or a live endpoint (use [garak](../garak/SKILL.md)).

## Prerequisites

- `picklescan` 1.0.5 and `fickling` 0.1.12, both pipx-installed at `~/.local/bin`. `picklescan` has no `--version`; confirm with `pipx list --short | grep picklescan`.
- Offline by default. `-u` (picklescan) and `--huggingface/--hf` (both tools) fetch from the network; everything else is local.
- `unzip` and `tar` are present for archive members.
- No GPU, no model runtime, no framework installed to run the artefact. Audit machines should not be able to execute what they audit.

## Core invocations

```sh
# 1. tool identity
picklescan --help | head -5
fickling --version

# 2. single-file verdict, then the strict mode that promotes suspicious to dangerous
picklescan -p model.pkl
picklescan -p model.pkl --strict

# 3. list every global the pickle imports, not just the verdict
picklescan -p model.pkl -g

# 4. tree scan with a debug trace of what was parsed
picklescan -p ./downloaded_models -l DEBUG
picklescan -p . --include '\.(pkl|pt|bin|ckpt)$' --exclude-dir '\.git'

# 5. zip-based torch checkpoint: picklescan descends into the archive itself
picklescan -p checkpoint.pt
# /path/checkpoint.pt:archive/data.pkl: dangerous import 'posix system' FOUND

# 6. fickling: translate the pickle into readable Python
fickling model.pkl
# from posix import system
# _var0 = system('id > /tmp/pwned')
# result0 = _var0

# 7. fickling: formal verdict, console detail, machine-readable output
fickling --check-safety -p model.pkl
fickling --check-safety -p model.pkl --json-output /tmp/safety.json
cat /tmp/safety.json   # {"severity": "LIKELY_OVERTLY_MALICIOUS", ...}

# 8. runtime trace, which prints the interpreted call sequence
fickling -t model.pkl

# 9. prove what a payload does without ever loading it (writes a new pickle)
fickling -i "print('benign probe')" model.pkl > /tmp/probe.pkl
fickling -i "__import__('os').getcwd()" model.pkl -r > /tmp/probe2.pkl

# 10. legacy torch file whose member must be extracted first
unzip -q -o checkpoint.pt -d /tmp/ckpt
picklescan -p /tmp/ckpt/archive/data.pkl
fickling --check-safety -p /tmp/ckpt/archive/data.pkl

# 11. hub artefact review before download (network); both scan a whole repo
picklescan -hf org/model-name
fickling --hf org/model-name -p        # needs huggingface_hub; exit 1 if unsafe

# 12. URL artefact (network); pin the hash you intend to audit
sha256sum model.pkl
picklescan -u https://example.test/model.pkl

# 13. quick manual triage when the verdict is only "suspicious"
fickling -t model.pkl | grep -nE 'system|popen|subprocess|eval|exec|socket|urllib|base64'
```

The decision rule, in order:

1. Any `dangerous import ... FOUND` from `picklescan`, or any `--strict` promotion: do not load the file. Not in a sandbox, not in a throwaway container, not "just to check the weights".
2. `fickling --check-safety` exiting 1: do not load. Read the decompiled output to see what it wanted to run, then report it as an incident if the file came from a supplier or a hub.
3. Only `suspicious` globals with a plausible reason (`numpy.core.multiarray._reconstruct`, `torch._utils._rebuild_tensor_v2`, `collections.OrderedDict`): these are normal model reconstruction. Confirm every global is one you expect for the format.
4. Clean verdict on a file from an untrusted source is still not a clearance. Convert to safetensors, or load inside a disposable VM with no credentials and no network, and treat the weights as untrusted data afterwards.

## Flags that matter

| Flag | Tool | Effect |
| --- | --- | --- |
| `-p, --path` | picklescan | file or directory to scan (recurses) |
| `-u, --url` | picklescan | fetch and scan a remote file |
| `-hf, --huggingface` | picklescan | scan a hub repo by id |
| `-g, --globals` | picklescan | print every global found with its classification |
| `--strict` | picklescan | promote suspicious globals to dangerous; default-deny posture |
| `--include` / `--exclude` | picklescan | regex filter on file names, repeatable |
| `--include-dir` / `--exclude-dir` | picklescan | regex filter on directory names |
| `-l, --log` | picklescan | `CRITICAL` to `DEBUG`; `DEBUG` shows parse decisions |
| `--check-safety, -s` | fickling | verdict plus exit 1 when unsafe |
| `-p, --print-results` | fickling | print analysis detail (note: `-p` is not a path here) |
| `--json-output` | fickling | severity JSON, default `safety_results.json` |
| `-t, --trace` | fickling | interpret the pickle and print the call trace |
| `-i, --inject` | fickling | append code to a copy of the pickle |
| `-r, --replace-result` | fickling | make injected code's return value the unpickle result |
| `--inject-target` | fickling | which embedded pickle to modify in a stacked file |
| `--hf`, `--hf-revision`, `--hf-token` | fickling | repo-wide hub scan (exit 0 clean, 1 unsafe, 2 error); prefer `HF_TOKEN` |

`picklescan -p` means path. `fickling -p` means print results. Getting these backwards is the most common mistake in this workflow.

## Workflow

1. **Hash first.** `sha256sum` the artefact and record the hash next to the verdict. A scan of a file you cannot identify later is worthless.
2. **Static scan the tree, not the file.** `picklescan -p ./download --strict -g` catches sidecar pickles a single-file scan misses.
3. **Handle containers.** For a zip-based `.pt`/`.ckpt`, let picklescan descend; if you need fickling, unzip and point it at `archive/data.pkl` - fickling refuses archives.
4. **Translate anything reported.** A verdict tells you a global was imported; `fickling model.pkl` tells you what it was called with.
5. **Apply the decision rule.** Dangerous means the file stays out of every process that has credentials, including the one you are about to use for "just reading metadata".
6. **Convert when you must use the weights.** Extract tensors in a disposable environment and re-save as safetensors; the pickle never gets unpickled by a trusted process.
7. **Record the disposition.** Hash, scanner version, verdict, the decompiled line, and the decision. That is the audit trail.

## OPSEC and telemetry

- Scanning is local and quiet. Uploading the file to a public scanner leaks the artefact and reveals that you are looking at it.
- `-u` and `--hf` send the artefact name or a fetch request to a third party. Use a pinned revision, and prefer downloading once and scanning locally.
- Do not open an untrusted pickle in an interpreter you care about, including an interactive Python session in your home directory. `pickle.load` is the attack.
- `fickling --check-safety` is explicitly not a proof of safety; the tool says so in its own output.
- A malicious model file is usually a supply-chain event. Preserve the file, the hash and the download URL rather than deleting it.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| `could not parse ... no newline found` | payload is base64-wrapped or not a raw pickle | identify the container first; decode or extract, then rescan |
| `No pickle files detected` from fickling | zip container (torch `.pt`) | `unzip` and scan `archive/data.pkl` |
| `Unhandled exception` / `FileNotFoundError` | path typo; picklescan does not guard a bad `-p` | fix the path; this is not a verdict |
| `could not parse ... opcode ... unknown` on a text file | an explicitly named file is parsed regardless of suffix | trust a summary only for real pickles; a directory scan filters by type |
| Verdict is `suspicious`, not dangerous | global is known but dual-use | read the decompiled call before clearing it |
| `--check-safety` exits 0 on a file you distrusted | the check only knows overt patterns | treat exit 0 as no evidence, not as clearance |
| `--json-output` overwrote a previous result | default file name is fixed | always pass an explicit path |
| HF scan fails with 401 | private repo without a token | `HF_TOKEN` in the environment, not `--hf-token` on the command line |
| Nested archive reports the outer name only | inner archives are not recursed by every version | extract and rescan the members |

## Verification

```sh
picklescan -p evil.pkl
# evil.pkl: dangerous import 'posix system' FOUND ; Infected files: 1
# exit code 1

picklescan -p ok.pkl
# SCAN SUMMARY with Infected files: 0 ; exit code 0

fickling evil.pkl
# from posix import system
# _var0 = system('id > /tmp/pwned')

fickling --check-safety -p evil.pkl ; echo $?
# "Fickling detected that the pickle file may be unsafe." ; 1

fickling --check-safety -p ok.pkl --json-output /tmp/s.json
# /tmp/s.json contains "severity": "LIKELY_SAFE"
```

Evidence to keep: artefact hash, scanner version, full verdict line, the decompiled call, and the load decision with its justification.

## Related skills

- [ai-security-testing](../ai-security-testing/SKILL.md) for the wider AI-target triage flow
- [snyk-agent-scan](../snyk-agent-scan/SKILL.md) when the risk is installed agent tooling rather than a model file
- [agentic-radar](../agentic-radar/SKILL.md) for static review of the application that loads the model
- [garak](../garak/SKILL.md) once a trusted model is being served and needs behavioural testing
