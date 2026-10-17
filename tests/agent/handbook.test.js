import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSections, sectionAt, createHandbook } from '../../js/agent/handbook.js';
import { handbookText } from './helpers.js';

test('the handbook has 22 numbered sections, in order', async () => {
  const sections = findSections(await handbookText());
  assert.equal(sections.length, 22);
  assert.equal(sections[0].number, '1.1');
  assert.equal(sections.find((s) => s.number === '3.1').title, 'Vacation');
  assert.ok(sections.every((s, i) => i === 0 || s.start > sections[i - 1].start));
});

test('a chunk that starts in the middle of a heading still gets its section from its position', async () => {
  const text = await handbookText();
  const handbook = createHandbook(text);
  const chunk08 = handbook.chunks[7];
  assert.match(chunk08.text, /^\.1 Vacation\./, 'the text lost the "3" of "3.1"');
  assert.equal(sectionAt(handbook.sections, chunk08.start).number, '3.1');
});

test('text before the first heading belongs to no section', async () => {
  const handbook = createHandbook(await handbookText());
  assert.equal(sectionAt(handbook.sections, 0), null);
});

test('a passage lists every section it touches', async () => {
  const handbook = createHandbook(await handbookText());
  const { passages } = await handbook.search('How many days of vacation do new employees get?', 3);
  const byChunk = Object.fromEntries(passages.map((p) => [p.chunkNumber, p]));
  assert.deepEqual(byChunk[8].sections, ['3.1']);
  assert.deepEqual(byChunk[9].sections, ['3.1', '3.2'], 'chunk 09 starts in 3.1 and holds the 3.2 heading');
});

test('search reports the query words that the handbook never uses', async () => {
  const handbook = createHandbook(await handbookText());
  const result = await handbook.search('How many days of PTO do new employees get?', 3);
  assert.deepEqual(result.unknown, ['pto']);
});
