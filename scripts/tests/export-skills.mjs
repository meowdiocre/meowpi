import assert from 'node:assert/strict';
import { normalizeSkillSnapshot } from '../lib.mjs';

const snapshot = normalizeSkillSnapshot([
  'z-live',
  'plain-english',
  'a-live',
  'plain-english',
]);

assert.deepEqual(snapshot, [
  'a-live',
  'plain-english',
  'z-live',
]);

console.log('PASS: all live Pi skills form the baseline snapshot');
