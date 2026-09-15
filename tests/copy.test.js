// Checks the rules for explainer copy in js/copy.js:
// every paragraph under the word limit, none of the banned words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPLAINERS, STEPS, SAMPLE_QUESTIONS } from '../js/copy.js';
import { BANNED_COPY_WORDS, MAX_EXPLAINER_WORDS } from '../js/constants.js';

function wordCount(text) {
  return text.trim().split(/\s+/).length;
}

test('every explainer paragraph is under the word limit', () => {
  for (const [station, paragraphs] of Object.entries(EXPLAINERS)) {
    for (const [key, text] of Object.entries(paragraphs)) {
      const count = wordCount(text);
      assert.ok(count < MAX_EXPLAINER_WORDS, `${station}.${key} has ${count} words`);
    }
  }
});

test('explainer copy avoids the banned words', () => {
  for (const [station, paragraphs] of Object.entries(EXPLAINERS)) {
    for (const [key, text] of Object.entries(paragraphs)) {
      for (const banned of BANNED_COPY_WORDS) {
        const pattern = new RegExp(`\\b${banned}`, 'i');
        assert.ok(!pattern.test(text), `${station}.${key} uses "${banned}"`);
      }
    }
  }
});

test('every step has an explainer', () => {
  for (const step of STEPS) {
    assert.ok(EXPLAINERS[step.id], `no explainer for step "${step.id}"`);
    assert.ok(EXPLAINERS[step.id].what && EXPLAINERS[step.id].why);
  }
});

test('the synonym probe question uses PTO and the handbook never does', async () => {
  const { readFile } = await import('node:fs/promises');
  const handbook = await readFile(new URL('../data/sample.txt', import.meta.url), 'utf8');
  const probe = SAMPLE_QUESTIONS.find((q) => q.key === 'synonym');
  assert.match(probe.text, /\bPTO\b/);
  assert.doesNotMatch(handbook, /\bPTO\b/);
  assert.doesNotMatch(handbook, /paid time off/i);
  assert.match(handbook, /\bvacation\b/i);
});
