import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countWords, normalizeNewlines, padNumber } from '../js/text.js';

test('countWords', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords('   '), 0);
  assert.equal(countWords('one'), 1);
  assert.equal(countWords('  one two\n\tthree  '), 3);
});

test('normalizeNewlines', () => {
  assert.equal(normalizeNewlines('a\r\nb\rc\nd'), 'a\nb\nc\nd');
});

test('padNumber', () => {
  assert.equal(padNumber(7, 20), '07');
  assert.equal(padNumber(7, 5), '7');
  assert.equal(padNumber(7, 120), '007');
});
