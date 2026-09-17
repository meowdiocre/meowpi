#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const semanticRules = [
  'RULE-01', 'RULE-02', 'RULE-03', 'RULE-04', 'RULE-05', 'RULE-06',
  'RULE-07', 'RULE-08', 'RULE-09', 'RULE-10', 'RULE-11', 'RULE-F',
  'RULE-G', 'RULE-H',
];

const phraseRules = [
  {
    rule: 'RULE-04',
    severity: 'high',
    detail: 'Needless filler phrase',
    patterns: [
      /\bin order to\b/i,
      /\bdue to the fact that\b/i,
      /\bit(?: is|['’]s) important to note that\b/i,
      /\bit(?: is|['’]s) worth noting that\b/i,
      /\bin the event that\b/i,
      /\b(?:may potentially|could possibly)\b/i,
    ],
  },
  {
    rule: 'RULE-05',
    severity: 'high',
    detail: 'Stock metaphor or prefabricated phrase',
    patterns: [
      /\bat the end of the day\b/i,
      /\btip of the iceberg\b/i,
      /\bgame[- ]changer\b/i,
      /\bparadigm shift\b/i,
      /\bmove the needle\b/i,
      /\bunlock(?:s|ed|ing)? the power\b/i,
    ],
  },
  {
    rule: 'RULE-06',
    severity: 'high',
    detail: 'Avoidable model-writing jargon',
    patterns: [
      /\b(?:delve|tapestry|multifaceted|paramount|pivotal|holistic)\b/i,
      /\b(?:leverage|utilize|facilitate|foster|underscore)\b/i,
      /\b(?:robust|comprehensive|nuanced)\b/i,
    ],
  },
];

function scrubInlineCode(input) {
  return input
    .replace(/`[^`]*`/g, ' CODE ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
}

function collectLines(text) {
  const rawLines = text.replace(/\r\n/g, '\n').split('\n');
  const result = [];
  let inFence = false;
  let inFrontmatter = rawLines[0]?.trim() === '---';

  for (let index = 0; index < rawLines.length; index += 1) {
    const raw = rawLines[index];
    const trimmed = raw.trim();

    if (inFrontmatter) {
      if (index > 0 && trimmed === '---') inFrontmatter = false;
      result.push({ line: index + 1, raw, text: '', prose: false });
      continue;
    }

    if (/^(?:```|~~~)/.test(trimmed)) {
      inFence = !inFence;
      result.push({ line: index + 1, raw, text: '', prose: false });
      continue;
    }

    const prose = !inFence;
    result.push({
      line: index + 1,
      raw,
      text: prose ? scrubInlineCode(raw) : '',
      prose,
    });
  }

  return result;
}

function excerpt(text) {
  const compact = text.trim().replace(/\s+/g, ' ');
  return compact.length > 160 ? `${compact.slice(0, 157)}...` : compact;
}

function addViolation(violations, rule, severity, line, detail, text) {
  violations.push({ rule, severity, line, detail, excerpt: excerpt(text) });
}

function wordsIn(sentence) {
  const cleaned = sentence
    .replace(/https?:\/\/\S+/g, ' URL ')
    .replace(/[*_>#\[\]()]/g, ' ');
  return cleaned.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu) || [];
}

function sentenceRecords(lines) {
  const records = [];
  for (const entry of lines) {
    if (!entry.prose || !entry.text.trim() || /^\s*(?:#|\|)/.test(entry.text)) continue;
    const listItem = /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(entry.text);
    const content = entry.text.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '');
    for (const match of content.matchAll(/[^.!?]+(?:[.!?]+|$)/g)) {
      const sentence = match[0].trim();
      if (sentence) records.push({ line: entry.line, text: sentence, listItem });
    }
  }
  return records;
}

function checkPhraseRules(lines, violations) {
  for (const entry of lines) {
    if (!entry.prose || !entry.text.trim()) continue;
    for (const group of phraseRules) {
      for (const pattern of group.patterns) {
        if (pattern.test(entry.text)) {
          addViolation(
            violations,
            group.rule,
            group.severity,
            entry.line,
            group.detail,
            entry.raw,
          );
          break;
        }
      }
    }
  }
}

function checkDashesAndContractions(lines, violations) {
  const contraction = /\b(?:[A-Za-z]+n['’]t|(?:I|you|we|they|he|she|it|that|there|here)['’](?:re|ve|ll|d|m|s))\b/i;

  for (const entry of lines) {
    if (!entry.prose || !entry.text.trim()) continue;
    for (let index = 0; index < entry.text.length; index += 1) {
      const character = entry.text[index];
      if (character !== '—' && character !== '–') continue;
      const numericRange = character === '–'
        && /\d/.test(entry.text[index - 1] || '')
        && /\d/.test(entry.text[index + 1] || '');
      if (!numericRange) {
        addViolation(
          violations,
          'RULE-B',
          'medium',
          entry.line,
          'Casual em or en dash in technical prose',
          entry.raw,
        );
        break;
      }
    }

    if (contraction.test(entry.text)) {
      addViolation(
        violations,
        'RULE-I',
        'low',
        entry.line,
        'Contraction in formal technical prose',
        entry.raw,
      );
    }
  }
}

function checkSentences(lines, violations) {
  const sentences = sentenceRecords(lines);

  for (const sentence of sentences) {
    const wordCount = wordsIn(sentence.text).length;
    if (wordCount > 30) {
      addViolation(
        violations,
        'RULE-12',
        'medium',
        sentence.line,
        `Sentence has ${wordCount} words; split it or justify the structure`,
        sentence.text,
      );
    }
  }

  for (let index = 2; index < sentences.length; index += 1) {
    const window = sentences.slice(index - 2, index + 1);
    if (window.some((item) => item.listItem)) continue;
    const starts = window.map((item) => item.text.match(/[\p{L}\p{N}]+/u)?.[0]?.toLowerCase());
    if (starts[0] && starts.every((word) => word === starts[0])) {
      addViolation(
        violations,
        'RULE-C',
        'low',
        window[2].line,
        `Three consecutive sentences start with “${starts[0]}”`,
        window[2].text,
      );
    }
  }
}

function paragraphGroups(lines) {
  const groups = [];
  let current = [];
  for (const entry of lines) {
    if (!entry.prose || !entry.text.trim()) {
      if (current.length) groups.push(current);
      current = [];
    } else {
      current.push(entry);
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

function checkParagraphs(lines, violations) {
  const transition = /^\s*(?:(?:[-*+]\s+|\d+[.)]\s+))?(Additionally|Furthermore|Moreover|Consequently|Notably|Importantly)\b/i;
  const summary = /^(?:In summary|In conclusion|To sum up|Overall|All in all)\b/i;

  for (const group of paragraphGroups(lines)) {
    let transitionCount = 0;
    const sentences = sentenceRecords(group);
    for (const sentence of sentences) {
      if (transition.test(sentence.text)) {
        transitionCount += 1;
        if (transitionCount > 1) {
          addViolation(
            violations,
            'RULE-D',
            'medium',
            sentence.line,
            'Repeated transition opener in one paragraph',
            sentence.text,
          );
        }
      }
    }

    const final = sentences.at(-1);
    if (final && summary.test(final.text)) {
      addViolation(
        violations,
        'RULE-E',
        'medium',
        final.line,
        'Paragraph closes by announcing or repeating a summary',
        final.text,
      );
    }
  }
}

function checkLists(lines, violations) {
  const listItem = /^\s*(?:[-*+]\s+|\d+[.)]\s+)(.+)$/;
  let block = [];

  const inspect = () => {
    if (block.length < 3) {
      block = [];
      return;
    }
    const items = block.map((entry) => entry.text.match(listItem)?.[1] || '');
    const strongFragment = items.some((item) => /^(?:And|But|Because|Which|Rather|So)\b/i.test(item));
    const repeatedCopula = items.every((item) => /^(?:It|This|That) (?:is|has)\b/i.test(item));
    if (strongFragment || repeatedCopula) {
      addViolation(
        violations,
        'RULE-A',
        'high',
        block[0].line,
        'List appears to be fragmented prose rather than parallel items',
        block.map((entry) => entry.raw.trim()).join(' | '),
      );
    }
    block = [];
  };

  for (const entry of lines) {
    if (entry.prose && listItem.test(entry.text)) block.push(entry);
    else inspect();
  }
  inspect();
}

export function auditText(text) {
  const lines = collectLines(text);
  const violations = [];
  checkPhraseRules(lines, violations);
  checkDashesAndContractions(lines, violations);
  checkSentences(lines, violations);
  checkParagraphs(lines, violations);
  checkLists(lines, violations);

  violations.sort((left, right) => left.line - right.line || left.rule.localeCompare(right.rule));
  const counts = {};
  for (const violation of violations) counts[violation.rule] = (counts[violation.rule] || 0) + 1;
  return { total: violations.length, counts, violations, semanticRules };
}

async function auditFile(file) {
  const resolved = path.resolve(file);
  return {
    file: resolved,
    ...auditText(await readFile(resolved, 'utf8')),
  };
}

function printAudit(result) {
  console.log(`${result.file}: ${result.total} mechanical violation(s)`);
  for (const violation of result.violations) {
    console.log(
      `${violation.rule} [${violation.severity}] line ${violation.line}: ${violation.detail}`,
    );
    console.log(`  ${violation.excerpt}`);
  }
  console.log(`Semantic review still required: ${result.semanticRules.join(', ')}`);
}

function printComparison(left, right) {
  const rules = [...new Set([...Object.keys(left.counts), ...Object.keys(right.counts)])]
    .sort((a, b) => a.localeCompare(b));
  console.log(`Rule\t${path.basename(left.file)}\t${path.basename(right.file)}\tDelta`);
  for (const rule of rules) {
    const before = left.counts[rule] || 0;
    const after = right.counts[rule] || 0;
    console.log(`${rule}\t${before}\t${after}\t${after - before}`);
  }
  console.log(`TOTAL\t${left.total}\t${right.total}\t${right.total - left.total}`);
}

async function main(argv) {
  if (argv[0] === '--compare') {
    if (argv.length !== 3) throw new Error('Usage: audit.mjs --compare A.md B.md');
    printComparison(await auditFile(argv[1]), await auditFile(argv[2]));
    return;
  }

  const json = argv[0] === '--json';
  const file = json ? argv[1] : argv[0];
  if (!file || argv.length !== (json ? 2 : 1)) {
    throw new Error('Usage: audit.mjs [--json] FILE | audit.mjs --compare A.md B.md');
  }
  const result = await auditFile(file);
  if (json) console.log(JSON.stringify(result, null, 2));
  else printAudit(result);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}
