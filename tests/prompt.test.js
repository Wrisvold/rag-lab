import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, formatPassages, estimateTokens } from '../js/prompt.js';
import { DEFAULT_INSTRUCTION, CHARS_PER_TOKEN_ESTIMATE } from '../js/constants.js';

test('assembles the three blocks in order with numbered passages', () => {
  const prompt = buildPrompt({
    instruction: 'Answer from the passages.',
    passages: [{ text: 'Staff accrue vacation.' }, { text: 'Sick leave is six days.' }],
    question: 'How much PTO do new employees get?',
  });
  assert.equal(prompt, [
    'Answer from the passages.',
    '',
    '[Passage 1]',
    'Staff accrue vacation.',
    '',
    '[Passage 2]',
    'Sick leave is six days.',
    '',
    'Question: How much PTO do new employees get?',
  ].join('\n'));
});

test('trims stray whitespace but keeps passage text intact', () => {
  const prompt = buildPrompt({ instruction: '  Do this.  \n', passages: [{ text: '\n  A line.\nAnother.  ' }], question: ' Why? ' });
  assert.equal(prompt, 'Do this.\n\n[Passage 1]\nA line.\nAnother.\n\nQuestion: Why?');
});

test('no passages still yields instruction and question', () => {
  const prompt = buildPrompt({ instruction: 'I', passages: [], question: 'Q' });
  assert.equal(prompt, 'I\n\nQuestion: Q');
});

test('the default instruction is the course wording', () => {
  assert.match(DEFAULT_INSTRUCTION, /using only the passages below/);
  assert.match(DEFAULT_INSTRUCTION, /"The provided material does not answer this\."/);
  assert.match(DEFAULT_INSTRUCTION, /Do not use outside knowledge\./);
});

test('formatPassages labels from 1', () => {
  assert.equal(formatPassages([{ text: 'x' }]), '[Passage 1]\nx');
  assert.equal(formatPassages([]), '');
});

test('estimateTokens rounds up and treats empty as 0', () => {
  assert.equal(estimateTokens('', CHARS_PER_TOKEN_ESTIMATE), 0);
  assert.equal(estimateTokens('abcd', 4), 1);
  assert.equal(estimateTokens('abcde', 4), 2);
});
