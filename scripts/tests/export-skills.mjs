import assert from 'node:assert/strict';
import { planSkillSnapshot } from '../lib.mjs';

const plan = planSkillSnapshot(
  ['z-live', 'plain-english', 'a-live'],
  ['plain-english', 'writing-router'],
);

assert.deepEqual(plan.copyFromPi, ['a-live', 'z-live']);
assert.deepEqual(plan.snapshot, [
  'a-live',
  'plain-english',
  'writing-router',
  'z-live',
]);

console.log('PASS: repo-managed skills survive Pi export');
