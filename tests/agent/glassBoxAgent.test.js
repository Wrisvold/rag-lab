// The Glass Box agent, run through the real loop on the sample handbook.
// The worked example of agent-mode-plan.md, Section 14, is pinned here: if
// the handbook or the dials change, this test fails and the plan must change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGlassBoxAgent, rewrite } from '../../js/agent/glassBoxAgent.js';
import { createRun, runToEnd } from '../../js/agent/loop.js';
import { defaultPrompt } from '../../js/agent/context.js';
import { TOOL_NAMES } from '../../js/agent/tools.js';
import { SAMPLE_QUESTIONS } from '../../js/copy.js';
import { fixtures } from './helpers.js';

const PTO = SAMPLE_QUESTIONS.find((q) => q.key === 'synonym').text;

async function run(agentOptions, runOptions = {}) {
  const { handbook, scenario } = await fixtures();
  const agent = createGlassBoxAgent({ handbook, ...agentOptions });
  const state = createRun({ question: PTO, employeeId: 'E-101', prompt: defaultPrompt(), toolNames: TOOL_NAMES, ...runOptions });
  return runToEnd(state, { agent, env: { handbook, scenario } });
}

const decided = (state) => state.rounds.filter((r) => r.decision);
const top3 = (round) => round.act.result.data.passages.map((p) => [p.chunkNumber, Number(p.score.toFixed(2))]);

test('worked example: the PTO question with "PTO -> vacation" in the synonym table', async () => {
  const state = await run({ synonyms: { PTO: 'vacation' } });
  const rounds = decided(state);

  assert.equal(state.stopReason, 'ANSWER_ACCEPTED');
  assert.deepEqual(rounds.map((r) => r.decision.rule), ['R3', 'F1', 'A1']);

  assert.deepEqual(top3(rounds[0]), [[2, 0.19], [3, 0.10], [7, 0.08]]);
  assert.deepEqual(rounds[0].check.reasons.filter((r) => !r.passed).map((r) => r.rule), ['C1']);

  assert.equal(rounds[1].decision.args.query, 'How many days of vacation do new employees get?');
  assert.deepEqual(top3(rounds[1]), [[8, 0.24], [2, 0.17], [9, 0.14]]);
  assert.equal(rounds[1].act.result.data.passages[0].section, '3.1');
  assert.equal(rounds[1].check.passed, true);

  assert.equal(rounds[2].decision.text, 'A newly hired employee gets ten vacation days a year. [3.1]');
  assert.equal(rounds[2].decision.quote.matches, 2, '"days" and "vacation"');
});

test('the same question with no synonym: the agent says that it cannot answer', async () => {
  const state = await run({});
  assert.equal(state.stopReason, 'GAVE_UP');
  assert.deepEqual(decided(state).map((r) => r.decision.rule), ['R3', 'F3']);
});

test('Exercise 1: with every stop condition off, only the hard limit stops the loop', async () => {
  const state = await run({ scoreThreshold: 0.9, f3: false }, { settings: { maxRounds: null, tokenBudget: null, repeatStop: false } });
  assert.equal(state.stopReason, 'HARD_LIMIT');
  assert.equal(decided(state).length, 12);
  const rules = decided(state).map((r) => r.decision.rule);
  assert.deepEqual(rules.slice(0, 3), ['R3', 'F2', 'F4'], 'F2 widens the search one time, then F4 repeats');
  assert.equal(rules.filter((r) => r === 'F2').length, 1);
  // Each round reads the whole context again, so each round costs more than the last.
  const perRound = decided(state).map((r) => r.context.total);
  assert.ok(perRound.every((t, i) => i === 0 || t > perRound[i - 1]));
});

test('Exercise 1 with REPEAT_STOP on: the loop stops when the agent repeats itself', async () => {
  const state = await run({ scoreThreshold: 0.9, f3: false }, { settings: { maxRounds: null, tokenBudget: null, repeatStop: true } });
  assert.equal(state.stopReason, 'NO_PROGRESS');
  assert.equal(state.rounds.length, 3, 'the third decision repeats the second');
});

test('Exercise 1 with the default budget: the token budget stops the loop', async () => {
  const state = await run({ scoreThreshold: 0.9, f3: false }, { settings: { maxRounds: null, repeatStop: false } });
  assert.equal(state.stopReason, 'BUDGET');
  assert.ok(state.tokens > 8000);
});

test('a balance question uses rule R1 and the tool, not the handbook', async () => {
  const state = await run({}, { question: 'How many vacation days do I have left?', employeeId: 'E-102' });
  assert.equal(state.stopReason, 'ANSWER_ACCEPTED');
  assert.deepEqual(decided(state).map((r) => r.decision.name || r.decision.type), ['get_vacation_balance', 'answer']);
  assert.equal(decided(state)[1].decision.text, 'You have 6 days of vacation left.');
});

test('a request that breaks a rule in code is refused, and no person is asked', async () => {
  const state = await run({}, { employeeId: 'E-103', request: { start_date: '2026-11-09', end_date: '2026-11-10' } });
  assert.equal(state.stopReason, 'ANSWER_ACCEPTED');
  const submit = decided(state)[1];
  assert.equal(submit.act.result.refused, true);
  assert.equal(submit.approval, undefined);
  assert.match(decided(state)[2].decision.text, /did not record your request.*14 days/);
});

test('rewrite: whole words, any case, only words with a synonym', () => {
  assert.equal(rewrite('How much PTO? pto!', ['pto'], { pto: 'vacation' }), 'How much vacation? vacation!');
  assert.equal(rewrite('PTOS and PTO', ['pto'], { pto: 'vacation' }), 'PTOS and vacation');
  assert.equal(rewrite('Unknown words', ['zzz'], { pto: 'vacation' }), 'Unknown words');
});
