// The text of Agent mode follows ASD-STE100 (agent-mode-plan.md, Section 12).
// These checks catch the most frequent errors. They do not replace a review by a person.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { AGENT } from '../../js/copy.js';
import { BANNED_COPY_WORDS } from '../../js/constants.js';

const PHRASAL_VERBS = ['set up', 'look up', 'find out', 'turn off', 'turn on', 'fill in', 'fill out', 'carry out',
  'go back', 'pick up', 'write down', 'step through', 'give up', 'point out', 'make up', 'check out'];

/** Every string in an object, with its path. */
function strings(value, path = 'AGENT', out = []) {
  if (typeof value === 'string') out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) strings(v, `${path}.${k}`, out);
  return out;
}

const words = (text) => text.trim().split(/\s+/).filter(Boolean);
const sentences = (text) => text.split(/(?<=[.!?])\s+/).filter((s) => /\w/.test(s));

test('no Agent text has a semicolon, a banned word, a phrasal verb, or a perfect tense with "been"', () => {
  for (const [path, text] of strings(AGENT)) {
    // Sample questions are what a user types, not what the page says.
    if (path.startsWith('AGENT.setup.sampleQuestions')) continue;
    assert.ok(!text.includes(';'), `${path} has a semicolon`);
    for (const word of BANNED_COPY_WORDS) assert.ok(!new RegExp(`\\b${word}`, 'i').test(text), `${path} uses "${word}"`);
    for (const verb of PHRASAL_VERBS) assert.ok(!new RegExp(`\\b${verb}\\b`, 'i').test(text), `${path} uses "${verb}"`);
    assert.ok(!/\b(has|have|had) been\b/i.test(text), `${path} uses a perfect tense with "been"`);
  }
});

test('no Agent sentence has more than 25 words', () => {
  for (const [path, text] of strings(AGENT)) {
    if (path.startsWith('AGENT.setup.sampleQuestions')) continue;
    for (const sentence of sentences(text)) {
      assert.ok(words(sentence).length <= 25, `${path}: ${words(sentence).length} words: "${sentence}"`);
    }
  }
});

test('each help entry has steps of 20 words or fewer, a teaching note, and a course link', () => {
  for (const [key, help] of Object.entries(AGENT.help)) {
    assert.ok(Array.isArray(help.steps) && help.steps.length > 0, `${key} has no steps`);
    for (const step of help.steps) assert.ok(words(step).length <= 20, `${key} step: "${step}"`);
    assert.ok(sentences(help.why).length >= 1 && sentences(help.why).length <= 5, `${key} note has 1 to 5 sentences`);
    assert.ok(help.course && help.course.length > 0, `${key} has no course link`);
  }
});

test('each help panel that the page uses has its text', async () => {
  const dir = new URL('../../js/agent/view/', import.meta.url);
  const used = new Set();
  for (const file of await readdir(dir)) {
    const source = await readFile(new URL(file, dir), 'utf8');
    for (const match of source.matchAll(/(?:helpPanel|helpEntry)\((?:A, )?'(\w+)'/g)) used.add(match[1]);
  }
  assert.ok(used.size >= 15, `found ${used.size} help panels`);
  for (const key of used) assert.ok(AGENT.help[key], `no AGENT.help.${key}`);
  for (const key of Object.keys(AGENT.help)) assert.ok(used.has(key), `AGENT.help.${key} is not used on the page`);
});

test('each stop code has a message and a teaching note', async () => {
  const { STOP_CODES } = await import('../../js/agent/loop.js');
  for (const code of STOP_CODES) {
    assert.ok(AGENT.stops[code] && AGENT.stops[code].message && AGENT.stops[code].note, code);
  }
});

test('each control that an exercise step names exists on the page with that name', () => {
  // Exercise text that names a control the page does not have is a broken instruction.
  const labels = strings(AGENT).filter(([path]) => !path.startsWith('AGENT.exercises.items')).map(([, text]) => text);
  const has = (name) => labels.some((text) => text === name || text.startsWith(`${name} `) || text.startsWith(`${name}:`) || text.startsWith(`${name} (`));
  const buttons = ['Run to end', 'Step', 'Copy run summary', 'Save as a version', 'Save', 'Compare versions', 'Show context', 'Refuse', 'Approve', 'Add', 'Output format', 'REPEAT_STOP'];
  for (const [key, item] of Object.entries(AGENT.exercises.items)) {
    for (const step of item.steps) {
      for (const [, quoted] of step.matchAll(/"([^"]+)"/g)) assert.ok(has(quoted), `${key}: "${quoted}" is not a label of the page`);
      for (const name of buttons) {
        if (new RegExp(`\\b(Click|clear the box|select the box) ${name}\\b`, 'i').test(step)) assert.ok(has(name), `${key}: no control "${name}"`);
      }
    }
  }
});
