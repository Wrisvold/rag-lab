import { test } from 'node:test';
import assert from 'node:assert/strict';
import { embedChunksGlassBox } from '../js/glassBox.js';
import { STOPWORDS, MIN_TOKEN_LENGTH, GLASS_BOX_TOP_TERMS } from '../js/constants.js';

const options = { stopwords: STOPWORDS, minTokenLength: MIN_TOKEN_LENGTH, topTermCount: GLASS_BOX_TOP_TERMS };

test('embeds chunks and reports the shared shape', () => {
  const chunks = [
    { text: 'Staff accrue vacation at ten days per year.' },
    { text: 'Staff receive six days of sick leave per year.' },
  ];
  const embedding = embedChunksGlassBox(chunks, options);
  assert.equal(embedding.mode, 'glass');
  assert.equal(embedding.vectors.length, 2);
  assert.equal(embedding.dimensions, embedding.vectors[0].length);
  assert.ok(embedding.stats.droppedStopwords > 0);
});

test('inspect returns the heaviest words and counts', () => {
  const embedding = embedChunksGlassBox([{ text: 'vacation vacation accrue staff' }, { text: 'sick staff' }], options);
  const view = embedding.inspect(0);
  assert.equal(view.topTerms[0].term, 'vacation');
  assert.equal(view.nonZero, 2); // vacation, accrue; "staff" is in both chunks -> 0
  assert.equal(view.tokenCount, 4);
});

test('embedQuery separates known from unknown words', () => {
  const embedding = embedChunksGlassBox([{ text: 'vacation accrue' }, { text: 'sick leave' }], options);
  const query = embedding.embedQuery('How much PTO or vacation?');
  assert.deepEqual(query.known, ['vacation']);
  assert.deepEqual(query.unknown, ['pto']);
  assert.equal(query.vector.length, embedding.dimensions);
});
