import assert from 'node:assert/strict';
import { auditText } from '../scripts/audit.mjs';

const clean = auditText(`
# Cache guide

This guide explains the request cache. Run \`npm test\` after you change the cache code.

1. Open the configuration file.
2. Set \`cache.enabled\` to \`true\`.
`);
assert.equal(clean.total, 0, `clean fixture produced ${clean.total} violation(s)`);

const bad = auditText(`
# Platform

It's important to note that this robust platform — at the end of the day — can leverage a comprehensive ecosystem for every user who needs a system that supports many different workflows across many different deployment environments without any clearly stated boundary or measurable result.

Furthermore, it handles requests. Additionally, it stores results. Moreover, it reports status. In conclusion, the platform is useful.

- Because it is fast
- Which makes it useful
- And enables teams
`);
const detected = new Set(bad.violations.map((violation) => violation.rule));
for (const rule of ['RULE-04', 'RULE-05', 'RULE-06', 'RULE-12', 'RULE-A', 'RULE-B', 'RULE-D', 'RULE-E', 'RULE-I']) {
  assert(detected.has(rule), `expected ${rule} in messy fixture`);
}

const protectedText = auditText(`
# Literal examples

Use \`robust — it's\` as the exact test fixture.

\`\`\`text
Furthermore, this robust example — it's literal.
\`\`\`
`);
assert.equal(protectedText.total, 0, 'code spans and fences must be ignored');

console.log('PASS: portable style-review audit fixtures');
