import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, tokenizeDetailed } from '../js/tokenizer.js';
import { STOPWORDS, MIN_TOKEN_LENGTH } from '../js/constants.js';

const options = { stopwords: STOPWORDS, minTokenLength: MIN_TOKEN_LENGTH };

test('lowercases, strips apostrophes, splits on punctuation', () => {
  assert.deepEqual(tokenize("New Year's Day, 8:00 a.m.!", options), ['new', 'years', 'day', '00']);
});

test('drops stopwords and short tokens, and counts them', () => {
  const result = tokenizeDetailed('The cat and a dog sat on the mat', options);
  assert.deepEqual(result.tokens, ['cat', 'dog', 'sat', 'mat']);
  assert.equal(result.droppedStopwords, 4); // the, and, on, the
  assert.equal(result.droppedShort, 1);     // "a" is dropped for length before the stopword check
});

test('stopword count is exact', () => {
  const result = tokenizeDetailed('the the the', options);
  assert.deepEqual(result.tokens, []);
  assert.equal(result.droppedStopwords, 3);
  assert.equal(result.droppedShort, 0);
});

test('short-token count', () => {
  const result = tokenizeDetailed('x y zz', { stopwords: new Set(), minTokenLength: 2 });
  assert.deepEqual(result.tokens, ['zz']);
  assert.equal(result.droppedShort, 2);
});

test('empty and null input', () => {
  assert.deepEqual(tokenize('', options), []);
  assert.deepEqual(tokenize(null, options), []);
});

test('the synonym probe question keeps only its content words', () => {
  assert.deepEqual(tokenize('How many days of PTO do new employees get?', options), ['days', 'pto', 'new', 'employees', 'get']);
});
