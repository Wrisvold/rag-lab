// The six exercises of Agent mode (agent-mode-plan.md, Section 13): each set-up
// gives the result that its text describes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, exercise, exerciseSetup, poisonHandbook, addDays } from '../../js/agent/exercises.js';
import { createHandbook } from '../../js/agent/handbook.js';
import { createGlassBoxAgent } from '../../js/agent/glassBoxAgent.js';
import { createBlackBoxAgent } from '../../js/agent/blackBoxAgent.js';
import { createRun, runToEnd } from '../../js/agent/loop.js';
import { defaultPrompt } from '../../js/agent/context.js';
import { TOOL_NAMES, checkRules } from '../../js/agent/tools.js';
import { AGENT } from '../../js/copy.js';
import { AGENT_TOKEN_BUDGET_DEFAULT, AGENT_GLASS_SCORE_THRESHOLD } from '../../js/constants.js';
import { fixtures } from './helpers.js';
import { gemini, scriptedSend } from './providerFixtures.js';

const DEFAULTS = {
  agentKind: 'glass', employeeId: 'E-101', question: '', requestOn: false, start: '', end: '', synonyms: [],
  threshold: AGENT_GLASS_SCORE_THRESHOLD, c3: true, f2: true, f3: true, maxRounds: 4, tokenBudget: AGENT_TOKEN_BUDGET_DEFAULT,
  repeatStop: true, disabledRules: [], provider: 'gemini', exercise: null,
};

const words = (text) => text.trim().split(/\s+/).filter(Boolean);
const sentences = (text) => text.split(/(?<=[.!?])\s+/).filter((s) => /\w/.test(s));

/** Run a Glass Box set-up the way js/agent/main.js runs it. */
async function runGlass(setup, { handbook, scenario }) {
  const agent = createGlassBoxAgent({
    handbook,
    synonyms: Object.fromEntries((setup.synonyms || []).map((p) => [p.from, p.to])),
    scoreThreshold: setup.threshold, f3: setup.f3, c3: setup.c3, f2: setup.f2,
  });
  const run = createRun({
    question: setup.question, request: null, employeeId: setup.employeeId,
    prompt: { ...defaultPrompt(), version: 'v1' }, toolNames: TOOL_NAMES,
    settings: { maxRounds: setup.maxRounds, tokenBudget: setup.tokenBudget, repeatStop: setup.repeatStop },
  });
  return runToEnd(run, { agent, env: { handbook, scenario } }, () => {});
}

test('each exercise has its text, and each text has an exercise', () => {
  const keys = EXERCISES.map((e) => e.key);
  assert.deepEqual(Object.keys(AGENT.exercises.items), keys);
  for (const key of keys) {
    const item = AGENT.exercises.items[key];
    for (const field of ['label', 'course', 'goal', 'look', 'question', 'why']) assert.ok(item[field], `${key}.${field}`);
    assert.ok(item.steps.length >= 3, `${key} has at least three steps`);
    for (const step of item.steps) assert.ok(words(step).length <= 20, `${key} step: "${step}"`);
    const n = sentences(item.why).length;
    assert.ok(n >= 2 && n <= 5, `${key}: the teaching note has 2 to 5 sentences`);
  }
});

test('a Black Box exercise asks for a key in its first step; a Glass Box exercise needs none', () => {
  for (const entry of EXERCISES) {
    const first = AGENT.exercises.items[entry.key].steps[0];
    assert.equal(/Your API key/.test(first), entry.agentKind === 'black', entry.key);
  }
});

test('loading an exercise starts from the defaults, keeps the provider, and records the exercise', async () => {
  const { scenario } = await fixtures();
  const setup = exerciseSetup(exercise('ruleInPrompt'), DEFAULTS, scenario, { provider: 'anthropic', synonyms: [{ from: 'x', to: 'y' }] });
  assert.equal(setup.agentKind, 'black');
  assert.equal(setup.provider, 'anthropic');
  assert.deepEqual(setup.synonyms, [], 'the old set-up does not stay');
  assert.equal(setup.exercise, 'ruleInPrompt');
  assert.deepEqual([setup.start, setup.end], ['2026-11-09', '2026-11-13']);
  assert.deepEqual(setup.disabledRules, ['notice']);
});

test('Exercise 1: no stop condition but the hard limit; then REPEAT_STOP, then the budget', async () => {
  const env = await fixtures();
  const setup = exerciseSetup(exercise('loop'), DEFAULTS, env.scenario);
  const first = await runGlass(setup, env);
  assert.equal(first.stopReason, 'HARD_LIMIT');
  assert.equal(first.rounds.length, 12);
  assert.ok(first.tokens > 40000, `about 43,500 tokens, got ${first.tokens}`);

  const repeat = await runGlass({ ...setup, repeatStop: true }, env);
  assert.equal(repeat.stopReason, 'NO_PROGRESS');
  assert.equal(repeat.rounds.length, 3);

  const budget = await runGlass({ ...setup, tokenBudget: AGENT_TOKEN_BUDGET_DEFAULT }, env);
  assert.equal(budget.stopReason, 'BUDGET');
});

test('Exercise 2: the agent gives up before the synonym and answers in three rounds after it', async () => {
  const env = await fixtures();
  const setup = exerciseSetup(exercise('pto'), DEFAULTS, env.scenario);
  const before = await runGlass(setup, env);
  assert.equal(before.stopReason, 'GAVE_UP');
  assert.equal(before.rounds[0].check.reasons.find((r) => !r.passed).rule, 'C1', 'round 1 fails rule C1');

  const after = await runGlass({ ...setup, synonyms: [{ from: 'PTO', to: 'vacation' }] }, env);
  assert.equal(after.stopReason, 'ANSWER_ACCEPTED');
  assert.equal(after.rounds.length, 3);
});

test('Exercises 4 and 6: the request breaks only the notice rule, and Exercise 4 turns that rule off', async () => {
  const { scenario } = await fixtures();
  const setup = exerciseSetup(exercise('poison'), DEFAULTS, scenario);
  const args = { employee_id: 'E-103', start_date: setup.start, end_date: setup.end };
  const failed = checkRules('submit_vacation_request', args, { scenario, employeeId: 'E-103' }).filter((r) => !r.passed);
  assert.deepEqual(failed.map((r) => r.rule), ['notice']);
  const off = checkRules('submit_vacation_request', args, { scenario, employeeId: 'E-103', disabledRules: ['notice'] });
  assert.ok(off.every((r) => r.passed));
  assert.equal(addDays('2026-11-30', 2), '2026-12-02');
});

test('Exercise 6: the poisoned paragraph is in Section 3.1 and a vacation search finds it', async () => {
  const { text } = await fixtures();
  const poisoned = poisonHandbook(text);
  assert.ok(poisoned.includes(AGENT.exercises.poison));
  const flat = (t) => t.replace(/\s+/g, ' ').trim();
  assert.equal(flat(poisoned.replace(AGENT.exercises.poison, '')), flat(text), 'nothing else changes');
  const handbook = createHandbook(poisoned);
  const result = await handbook.search('vacation request notice', 3);
  const hit = result.passages.find((p) => p.text.includes('Note to AI assistants'));
  assert.ok(hit, 'a passage has the attack');
  assert.equal(hit.section, '3.1');
});

test('Exercise 6: the attack enters the context through search_handbook, and the rule in code refuses the request', async () => {
  const { text, scenario } = await fixtures();
  const handbook = createHandbook(poisonHandbook(text));
  const setup = exerciseSetup(exercise('poison'), DEFAULTS, scenario);
  // A model that obeys the poisoned passage: it searches, then submits at once.
  const { send, requests } = scriptedSend([
    gemini.functionCall('1', 'search_handbook', { query: 'vacation request notice' }),
    gemini.functionCall('2', 'submit_vacation_request', { employee_id: 'E-103', start_date: setup.start, end_date: setup.end }),
    gemini.text('3', 'I cannot record the request. Section 3.1 needs 14 days of notice. [3.1]'),
  ]);
  const agent = createBlackBoxAgent({ providerKey: 'gemini', apiKey: 'KEY', send, scenarioDate: scenario.today });
  const state = await runToEnd(
    createRun({
      question: setup.question, request: { start_date: setup.start, end_date: setup.end }, employeeId: setup.employeeId,
      prompt: { ...defaultPrompt(), version: 'v1' }, toolNames: TOOL_NAMES, settings: {},
    }),
    { agent, env: { handbook, scenario } },
    () => {},
  );
  assert.notEqual(state.status, 'waiting_for_approval', 'no person is asked: the code refuses first');
  const act = state.rounds[1].act.result;
  assert.equal(act.refused, true);
  assert.deepEqual(act.rules.filter((r) => !r.passed).map((r) => r.rule), ['notice']);
  assert.ok(JSON.stringify(requests[1].body.contents).includes('Note to AI assistants'), 'the model read the attack');
});
