---
name: jsluice
description: "Extract URLs, query and body parameters, HTTP methods and secrets from JavaScript using tree-sitter AST parsing with JSONL output. Use when mining endpoints or credentials from JS bundles and captured scripts. Not for deobfuscating or unpacking bundles (use webcrack) or regex scraping of HTML."
---

# jsluice

jsluice parses JavaScript with tree-sitter and walks the syntax tree for the shapes that matter: URL literals, `fetch`/XHR/axios calls, request options, and credential-looking patterns. Output is JSONL, one object per finding, so it composes with `jq` and `anew`.

It does not execute code and does not need a browser.

## When to use

| Goal | Mode |
| --- | --- |
| Every endpoint referenced by a bundle | `jsluice urls app.js` |
| Endpoints plus the surrounding source line | `jsluice urls -S app.js` |
| Only resolved absolute URLs | `jsluice urls -R https://app.target.test app.js` |
| Methods and query parameter names | `jsluice urls app.js \| jq -c '{url,method,queryParams}'` |
| Credential-shaped strings | `jsluice secrets app.js` |
| Custom secret matchers | `jsluice secrets -p patterns.json app.js` |
| Understand why a string was missed | `jsluice tree app.js` |
| Custom structural search | `jsluice query -q '(string) @m' -f app.js` |
| Beautify before reading | `jsluice format bundle.js` |

Do not use jsluice to unpack webpack/browserify modules or to reverse obfuscator.io string arrays. Run [webcrack](../webcrack/SKILL.md) first, then jsluice over its output.

## Prerequisites

- Binary at `/opt/tools/jsluice`. It has no version flag: `jsluice --version` returns `unknown flag: --version` and `jsluice version` returns `no such mode`. Use `jsluice` with no arguments to confirm the build is alive.
- `jq` for shaping output.
- Local `.js` files, a list of filenames on stdin, or HTTP(S) URLs. Remote fetch supports `-H`, `-C` and `-i`.
- No wordlist; no network access required for local files.

Exact mode names as reported by this build:

```text
urls      Extract URLs and paths
secrets   Extract secrets and other interesting bits
tree      Print syntax trees for input files
query     Run tree-sitter a query against input files
format    Format JavaScript source using jsbeautifier-go
```

There is no `strings` mode. If you need raw string literals, use `urls` without `-I`, or `query` with an appropriate tree-sitter query.

## Core invocations

```sh
# 1. endpoints from one file
jsluice urls app.js

# 2. include the source expression for each hit
jsluice urls -S app.js

# 3. resolve relative paths against the site root
jsluice urls -R https://app.target.test app.js

# 4. a file list on stdin, processed concurrently
find js -name '*.js' | jsluice urls -c 4

# 5. raw JavaScript on stdin (note -j; without it stdin is a filename list)
curl -s https://app.target.test/static/app.js | jsluice urls -j

# 6. remote fetch with session context
jsluice urls -C 'session=FAKE' -H 'Authorization: Bearer FAKE' https://app.target.test/static/app.js

# 7. secrets with the built-in matchers
jsluice secrets app.js

# 8. custom matchers: a JSON array of {key, value} objects
jsluice secrets -p patterns.json app.js

# 9. inspect the parse tree when a construct is missed
jsluice tree app.js | head -60

# 10. beautify a minified bundle, then re-run extraction
jsluice format bundle.js > pretty.js
jsluice urls pretty.js

# 11. change the placeholder used for dynamic expressions
jsluice urls -P '__DYN__' app.js
```

A verified `urls` record:

```json
{"url":"/api/orders?id=EXPR","queryParams":["id"],"bodyParams":[],"method":"POST","type":"fetch","filename":"app.js"}
```

A verified `secrets` record:

```json
{"kind":"AWSAccessKey","data":{"key":"AKIAFAKEFAKEFAKEFAKE"},"filename":"app.js","severity":"low","context":{"apiKey":"AKIAFAKEFAKEFAKEFAKE","endpoint":"https://internal.example.test:8443/health?deep=1"}}
```

Fields:

| Field | Meaning |
| --- | --- |
| `url` | literal or call-site URL, with `EXPR` for unresolved segments |
| `queryParams` / `bodyParams` | parameter names from the query string / request body |
| `method` | `GET`, `POST`, etc. when the call shape makes it clear, else empty |
| `type` | origin shape, observed values `stringLiteral` and `fetch` |
| `filename` | input file or URL |
| `source` | the matched expression, only with `-S` |
| `kind` / `data` / `severity` | secret matcher name, matched fields, severity |
| `context` | neighboring object or code around the match |

## Flags that matter

| Flag | Mode | Effect |
| --- | --- | --- |
| `-c` | global | files processed concurrently |
| `-C` | global | Cookie header for remote inputs |
| `-H` | global | extra header, repeatable |
| `-j` | global | treat stdin as raw JavaScript, not filenames |
| `-i` | global | skip TLS verification for remote inputs |
| `-P` | global | placeholder for dynamic expressions, default `EXPR` |
| `-I` | urls | ignore string-literal matches |
| `-S` | urls | include source expression |
| `-R` | urls | resolve relative paths against a base URL |
| `-u` | urls | unique URLs per input file |
| `-p` | secrets | JSON file of custom matchers |
| `-q` | query | tree-sitter query |
| `-f` | query | include filename in output |

## Why AST beats regex

LinkFinder-style regexes scan text for quoted paths. They match dead code and comments, break on template literals, miss binary concatenation, and cannot tell a URL from an unrelated string. jsluice walks the parse tree instead:

- It recognizes `fetch`, XHR, axios and similar call shapes, so it can attach a method and distinguish URL arguments from body arguments.
- Concatenation and template literals become a single URL with an `EXPR` placeholder instead of a truncated fragment. `-P` changes the placeholder if `EXPR` collides with real text.
- `queryParams` and `bodyParams` come from the actual expression, not from guessing at delimiters.
- Syntax errors usually produce no findings rather than garbage findings; `tree` and `query` expose the same parse tree when you need a custom pattern.

The tradeoff: jsluice returns what the source literally says. URLs assembled at runtime from config, encryption, or server-supplied strings stay `EXPR` until you read the code or instrument the browser.

## Workflow

1. **Collect.** Save every script referenced by the target, keeping the original URL path so relative resolution makes sense.
2. **Readable first.** If the file is minified, `jsluice format` or [webcrack](../webcrack/SKILL.md); extraction works on minified code, reading it does not.
3. **Extract.** `jsluice urls -R https://app.target.test -S file.js > urls.jsonl`.
4. **Triage.** `jq -r 'select(.url|test("api|admin|internal")) | .url' urls.jsonl | anew endpoints.txt`.
5. **Probe.** Feed discovered paths to [httpx](../httpx/SKILL.md) with `-path`, or to the browser for authenticated routes.
6. **Secrets last.** `jsluice secrets` output contains live credentials. Verify only with authorization, and never paste values into tickets or chat.

Useful `jq` shapes:

```sh
jq -r '.url' urls.jsonl | sort -u
jq -r 'select(.method != "") | "\(.method) \(.url)"' urls.jsonl | sort -u
jq -r '.queryParams[]' urls.jsonl | sort -u
```

## OPSEC and telemetry

- Local analysis is offline. Remote inputs make requests from your host with whatever `-C` and `-H` you supply, including live session cookies.
- JavaScript is untrusted input. jsluice does not execute it, but the `source` and `context` fields can contain personal data, tokens and internal hostnames. Handle output as sensitive.
- Secret hits are candidates, not proof. A key may be revoked, a test fixture, or a public value. Do not validate against third-party APIs without written scope.
- If you fetch remote scripts, the target's CDN logs the request and your User-Agent.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| `no such mode: strings` | no `strings` mode exists | use `urls`, `secrets`, `tree`, `query` or `format` |
| `unknown flag: --version` | build has no version flag | run `jsluice` alone for usage |
| No output on a valid-looking file | not JavaScript, or a parse failure | try `jsluice tree file`; check the file type |
| stdin seems ignored | stdin is a filename list by default | add `-j` for raw source |
| Relative URLs stay relative | no base supplied | add `-R https://host` |
| Duplicate records | one hit per syntactic occurrence | add `-u`, or dedupe with `sort -u` |
| `404` on remote input | wrong path or missing session | add `-C` / `-H`, test with curl first |
| TLS error on remote input | internal CA or bad chain | `-i` only on authorized targets |
| Secret matcher errors | pattern file is not a JSON array of matcher objects | use `[{"key":"apiKey","value":"AKIA[0-9A-Z]{16}"}]` |
| Dynamic URLs appear as `EXPR` | runtime-assembled string | read the surrounding code or instrument the browser |

## Verification

```sh
jsluice
# usage: jsluice <mode> [...flags] plus the mode list

jsluice urls sample.js | jq -r '.url'
# one URL per line, JSON parse must succeed

jsluice secrets sample.js | jq -r 'select(.kind != "") | .kind'
# matcher names such as AWSAccessKey
```

Check that the pipeline is not silently empty with `jsluice urls sample.js | wc -l`.

## Related skills

- [webcrack](../webcrack/SKILL.md) to unpack and deobfuscate before extraction
- [web-traffic-js-reversing](../web-traffic-js-reversing/SKILL.md) for the capture-to-OpenAPI pipeline
- [httpx](../httpx/SKILL.md) to probe extracted endpoints
- [mitmproxy](../mitmproxy/SKILL.md) to capture the scripts in the first place
