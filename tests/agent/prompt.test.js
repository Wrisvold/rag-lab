// The system prompt workbench: versions, compare, cost, and the prompt checker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPromptStore, editSection, saveVersion, useVersion, matchingVersion, promptForRun,
  exportPrompts, importPrompts, promptCost, diffSentences, comparePrompts, checkPrompt,
} from '../../js/agent/prompt.js';
import { createGlassBoxAgent } from '../../js/agent/glassBoxAgent.js';
import { createRun, runToEnd } from '../../js/agent/loop.js';
import { formatAgentRunSummary } from '../../js/agent/summary.js';
import { TOOL_NAMES } from '../../js/agent/tools.js';
import { fixtures } from './helpers.js';

const withText = (store, id, text) => editSection(store, id, { text });
const rules = (findings) => findings.map((f) => f.rule);

test('the default prompt passes the checker: it is also the example of a clear prompt', () => {
  assert.deepEqual(checkPrompt(createPromptStore().working), []);
});

test('the checker finds each type of problem', () => {
  let store = createPromptStore();
  store = withText(store, 'rules', 'Use only the handbook passages for facts and always give the section number that the passage is in for each fact.');
  store = withText(store, 'tools', 'Look up the balance first; then prepare the request as needed. Always use search_handbook for questions.');
  store = withText(store, 'format', 'Never call search_handbook more than two times.');
  store = editSection(store, 'stop', { enabled: false });
  const found = checkPrompt(store.working);

  assert.ok(rules(found).includes('LONG_SENTENCE'), 'the 21-word rule');
  assert.ok(rules(found).includes('SEMICOLON'));
  assert.ok(found.some((f) => f.rule === 'PHRASAL_VERB' && f.message.includes('"look up"') && f.message.includes('"find"')));
  assert.ok(found.some((f) => f.rule === 'VAGUE_WORD' && f.message.includes('"as needed"')));
  assert.ok(found.some((f) => f.rule === 'CONFLICT' && f.message.includes('search_handbook')), 'always vs never about the same tool');
  assert.ok(found.some((f) => f.rule === 'NO_STOP_RULES' && f.sentence === 0));
  const long = found.find((f) => f.rule === 'LONG_SENTENCE');
  assert.equal(long.section, 'rules');
  assert.equal(long.sentence, 1);
});

test('a word inside a tool name does not make a conflict', () => {
  let store = withText(createPromptStore(), 'rules', 'Always use the handbook passages for facts.');
  store = withText(store, 'role', 'Never call search_handbook more than two times.');
  assert.deepEqual(rules(checkPrompt(store.working)), []);
  store = withText(store, 'tools', 'Always use search_handbook for questions.');
  const conflict = checkPrompt(store.working).find((f) => f.rule === 'CONFLICT');
  assert.match(conflict.message, /sentence 1 of Role uses "never" or "do not" about "search_handbook"/);
});

test('description sections allow 25 words, instruction sections 20', () => {
  const twentyTwo = 'You help employees of Fall Line Supply Company in Milledgeville and in Macon with questions about the handbook and their vacation days.';
  let store = withText(createPromptStore(), 'role', twentyTwo);
  assert.deepEqual(rules(checkPrompt(store.working)), []);
  store = withText(store, 'rules', twentyTwo);
  assert.deepEqual(rules(checkPrompt(store.working)), ['LONG_SENTENCE']);
});

test('a version needs a note, and saving an unchanged prompt is refused', () => {
  let store = createPromptStore();
  assert.equal(saveVersion(store, { what: 'x', why: 'y' }).code, 'NO_CHANGE');
  store = editSection(store, 'format', { enabled: false });
  assert.equal(saveVersion(store, { what: 'Disabled Output format', why: '' }).code, 'NOTE_REQUIRED');
  const saved = saveVersion(store, { name: 'No format', what: 'Disabled Output format', why: 'To see what it costs' });
  assert.equal(saved.ok, true);
  assert.equal(saved.version, 'v2');
  assert.deepEqual(saved.store.versions[1].note, { what: 'Disabled Output format', why: 'To see what it costs' });
  assert.equal(matchingVersion(saved.store).version, 'v2');
});

test('a run is labelled with the matching version, or with "unsaved"', () => {
  let store = createPromptStore();
  assert.equal(promptForRun(store).version, 'v1');
  store = withText(store, 'role', 'You are a test.');
  assert.equal(promptForRun(store).version, 'unsaved');
  store = saveVersion(store, { what: 'Role', why: 'Test' }).store;
  assert.equal(promptForRun(store).version, 'v2');
  store = useVersion(store, 'v1');
  assert.equal(promptForRun(store).version, 'v1');
});

test('compare: sentence changes and section status', () => {
  assert.deepEqual(diffSentences('A one. B two. C three.', 'A one. C three. D four.').map((d) => `${d.kind}:${d.text}`),
    ['same:A one.', 'removed:B two.', 'same:C three.', 'added:D four.']);
  let store = createPromptStore();
  store = editSection(store, 'format', { enabled: false });
  store = withText(store, 'rules', 'Use only the handbook passages for facts.');
  const v2 = saveVersion(store, { what: 'a', why: 'b' }).store.versions[1];
  const sections = comparePrompts(createPromptStore().versions[0], v2);
  assert.equal(sections.find((s) => s.id === 'format').status, 'disabled');
  assert.equal(sections.find((s) => s.id === 'rules').status, 'changed');
  assert.equal(sections.find((s) => s.id === 'role').status, 'same');
  assert.ok(sections.find((s) => s.id === 'rules').diff.some((d) => d.kind === 'removed' && d.text.startsWith('Give the section number')));
});

test('download and load keep every version and its note', () => {
  let store = editSection(createPromptStore(), 'format', { enabled: false });
  store = saveVersion(store, { name: 'No format', what: 'a', why: 'b' }).store;
  const loaded = importPrompts(JSON.parse(JSON.stringify(exportPrompts(store))));
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.store.versions.map((v) => v.version), ['v1', 'v2']);
  assert.equal(loaded.store.versions[1].sections.find((s) => s.id === 'format').enabled, false);
  assert.equal(loaded.store.working.version, 'v2');
  assert.equal(importPrompts({ format: 'something else' }).code, 'BAD_FORMAT');
  assert.equal(importPrompts({ ...exportPrompts(store), version: 99 }).code, 'BAD_VERSION');
});

test('a disabled section costs nothing, and the run sends the prompt in every round', async () => {
  const full = createPromptStore();
  const smaller = editSection(full, 'format', { enabled: false });
  assert.ok(promptCost(smaller.working).total < promptCost(full.working).total);

  const { handbook, scenario } = await fixtures();
  const agent = createGlassBoxAgent({ handbook, synonyms: { PTO: 'vacation' } });
  const run = async (store) => runToEnd(
    createRun({ question: 'How many days of PTO do new employees get?', employeeId: 'E-101', prompt: promptForRun(store), toolNames: TOOL_NAMES }),
    { agent, env: { handbook, scenario } },
  );
  const [a, b] = [await run(full), await run(smaller)];
  assert.equal(a.stopReason, b.stopReason, 'the Glass Box agent does not read the prompt');
  const saved = a.tokens - b.tokens;
  const perRound = a.rounds[0].context.promptTokens - b.rounds[0].context.promptTokens;
  assert.ok(perRound > 0);
  assert.equal(saved, perRound * 3, 'three rounds, so the section cost three times');
  assert.match(formatAgentRunSummary(b, { scenario, agentKind: 'glass' }), /System prompt: unsaved "Unsaved changes" \(6 sections, 5 enabled/);
});

test('a run keeps the rules in code that an exercise turned off, and the summary shows them', async () => {
  const { handbook, scenario } = await fixtures();
  const agent = createGlassBoxAgent({ handbook });
  const state = await runToEnd(
    createRun({
      question: 'Vacation', request: { start_date: '2026-11-09', end_date: '2026-11-10' }, employeeId: 'E-103',
      prompt: promptForRun(createPromptStore()), toolNames: TOOL_NAMES, settings: { disabledRules: ['notice'] },
    }),
    { agent, env: { handbook, scenario } },
  );
  assert.equal(state.status, 'waiting_for_approval', 'with the notice rule off, the request reaches a person');
  assert.equal(state.pending.rules.find((r) => r.rule === 'notice').disabled, true);
  assert.match(formatAgentRunSummary(state, { scenario, agentKind: 'glass' }), /Rules in code turned off: notice/);
});
