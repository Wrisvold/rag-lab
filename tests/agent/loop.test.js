// The loop engine with small fake agents, so each stop condition is tested
// on its own, away from the handbook.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, step, approve, refuse, stopRun, runRound, runToEnd } from '../../js/agent/loop.js';
import { defaultPrompt } from '../../js/agent/context.js';
import { checkAnswer } from '../../js/agent/glassBoxAgent.js';
import { TOOL_NAMES } from '../../js/agent/tools.js';
import { fixtures, deepFreeze } from './helpers.js';

const newRun = (settings = {}, extra = {}) => createRun({
  question: 'Test question', employeeId: 'E-103', prompt: defaultPrompt(), toolNames: TOOL_NAMES, settings, ...extra,
});

/** An agent that follows a fixed script of decisions, and passes every check unless told otherwise. */
function scripted(decisions, checkResult = () => ({ passed: false, reasons: [{ rule: 'X', passed: false, detail: 'not yet' }] })) {
  let i = 0;
  return {
    decide: () => decisions[Math.min(i++, decisions.length - 1)],
    check: (round, view) => (round.decision.type === 'answer' ? checkAnswer(round.decision, view) : checkResult(round, view)),
  };
}

const search = (query) => ({ type: 'tool', name: 'search_handbook', args: { query, top_k: 3 } });

async function deps(agent, extraEnv = {}) {
  const { handbook, scenario } = await fixtures();
  return { agent, env: { handbook, scenario, ...extraEnv } };
}

test('each round has four parts, in order', async () => {
  const d = await deps(scripted([search('vacation')]));
  const parts = [];
  let state = newRun();
  for (let i = 0; i < 4; i += 1) {
    parts.push(state.part);
    state = (await step(state, d)).state;
  }
  assert.deepEqual(parts, ['context', 'decide', 'act', 'check']);
  assert.equal(state.round, 2);
  assert.equal(state.part, 'context');
});

test('step never changes the state that it receives', async () => {
  const d = await deps(scripted([search('vacation a'), search('vacation b'), search('vacation c')]));
  let state = deepFreeze(newRun());
  for (let i = 0; i < 8; i += 1) state = deepFreeze((await step(state, d)).state);
  assert.equal(state.round, 3);
});

test('MAX_ROUNDS stops a run that never finishes', async () => {
  const queries = ['a', 'b', 'c', 'd', 'e', 'f'].map((q) => search(`vacation ${q}`));
  const state = await runToEnd(newRun({ maxRounds: 4 }), await deps(scripted(queries)));
  assert.equal(state.stopReason, 'MAX_ROUNDS');
  assert.equal(state.rounds.length, 4);
});

test('NO_PROGRESS stops a repeated call before it runs a second time', async () => {
  const state = await runToEnd(newRun(), await deps(scripted([search('vacation'), search('vacation')])));
  assert.equal(state.stopReason, 'NO_PROGRESS');
  assert.equal(state.rounds[1].act, undefined, 'the repeated call did not run');
});

test('BUDGET stops a run before the agent reads a context over the budget', async () => {
  const queries = ['a', 'b', 'c', 'd', 'e', 'f'].map((q) => search(`vacation ${q}`));
  const state = await runToEnd(newRun({ tokenBudget: 1000, maxRounds: null }), await deps(scripted(queries)));
  assert.equal(state.stopReason, 'BUDGET');
  assert.ok(state.tokens > 1000);
  assert.equal(state.rounds[state.rounds.length - 1].decision, undefined, 'the agent did not decide in that round');
});

test('TOOL_FAILED stops after a tool fails two times', async () => {
  const broken = { search: async () => { throw new Error('index missing'); } };
  const state = await runToEnd(newRun(), await deps(scripted([search('a'), search('b'), search('c')]), { handbook: broken }));
  assert.equal(state.stopReason, 'TOOL_FAILED');
  assert.equal(state.failures, 2);
  assert.equal(state.rounds[1].act.result.error, 'index missing');
});

test('ANSWER_ACCEPTED needs a cited section from a retrieved passage', async () => {
  const goodAnswer = { type: 'answer', text: 'Ten days. [3.1]', citations: ['3.1'], basis: 'handbook' };
  const passAll = () => ({ passed: true, reasons: [] });
  const state = await runToEnd(newRun(), await deps(scripted([search('vacation days'), goodAnswer], passAll)));
  assert.equal(state.stopReason, 'ANSWER_ACCEPTED');
});

test('a failed answer check gives feedback, and the next round can read it', async () => {
  const noCitation = { type: 'answer', text: 'Ten days.', citations: [], basis: 'handbook' };
  const passAll = () => ({ passed: true, reasons: [] });
  const d = await deps(scripted([search('vacation days'), noCitation, { type: 'answer', text: 'Ten days. [3.1]', citations: ['3.1'], basis: 'handbook' }], passAll));
  const state = await runToEnd(newRun(), d);
  assert.equal(state.rounds[1].check.passed, false);
  assert.match(state.rounds[2].context.parts.find((p) => p.type === 'history').text, /no section number/);
  assert.equal(state.stopReason, 'ANSWER_ACCEPTED');
});

test('a write tool waits for a person: approve runs it, refuse stops the run', async () => {
  const submit = { type: 'tool', name: 'submit_vacation_request', args: { employee_id: 'E-103', start_date: '2026-11-30', end_date: '2026-12-04' } };
  const d = await deps(scripted([submit]));

  const waiting = await runToEnd(newRun(), d);
  assert.equal(waiting.status, 'waiting_for_approval');
  assert.equal(waiting.pending.decision.name, 'submit_vacation_request');
  assert.ok(waiting.pending.rules.every((r) => r.passed), 'the person sees the rules, already checked');
  assert.equal((await step(waiting, d)).event.type, 'waiting', 'step does nothing while a person decides');

  const approved = (await approve(waiting, d)).state;
  assert.equal(approved.rounds[0].approval.status, 'approved');
  assert.equal(approved.rounds[0].act.result.data.recorded.work_days, 5);
  assert.equal(approved.part, 'check');

  const refused = refuse(waiting).state;
  assert.equal(refused.stopReason, 'APPROVAL_REFUSED');
  assert.equal(refused.rounds[0].act.kind, 'refused-by-person');
});

test('HUMAN_STOP, and nothing runs after a stop', async () => {
  const d = await deps(scripted([search('vacation')]));
  const stopped = stopRun(newRun()).state;
  assert.equal(stopped.stopReason, 'HUMAN_STOP');
  const after = await step(stopped, d);
  assert.equal(after.state, stopped);
  assert.equal(after.event.type, 'stopped');
});

test('runRound ends at the end of the current round', async () => {
  const state = await runRound(newRun(), await deps(scripted([search('vacation a'), search('vacation b')])));
  assert.equal(state.round, 2);
  assert.equal(state.part, 'context');
});

test('the same run, two times, gives the same result', async () => {
  const make = async () => runToEnd(newRun(), await deps(scripted([search('vacation a'), search('vacation b'), search('vacation c'), search('vacation d')])));
  const [a, b] = [await make(), await make()];
  assert.deepEqual(a, b);
});
