// The run total on each round (tokensAfter): the inspector shows it, so it must
// equal the total of the status line and the run summary.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlackBoxAgent } from '../../js/agent/blackBoxAgent.js';
import { createGlassBoxAgent } from '../../js/agent/glassBoxAgent.js';
import { createRun, runToEnd } from '../../js/agent/loop.js';
import { defaultPrompt } from '../../js/agent/context.js';
import { TOOL_NAMES } from '../../js/agent/tools.js';
import { formatAgentRunSummary } from '../../js/agent/summary.js';
import { SAMPLE_QUESTIONS } from '../../js/copy.js';
import { fixtures } from './helpers.js';
import { anthropic, scriptedSend } from './providerFixtures.js';

const QUESTION = 'How many days of PTO do new employees get?';

async function blackBoxRun(replies, agentOptions = {}) {
  const { handbook, scenario } = await fixtures();
  const { send } = scriptedSend(replies);
  const agent = createBlackBoxAgent({ providerKey: 'anthropic', apiKey: 'KEY', send, scenarioDate: scenario.today, ...agentOptions });
  const state = await runToEnd(
    createRun({ question: QUESTION, employeeId: 'E-101', prompt: { ...defaultPrompt(), version: 'v1' }, toolNames: TOOL_NAMES }),
    { agent, env: { handbook, scenario } },
  );
  return { state, scenario };
}

function stopTotal(state, scenario) {
  const summary = formatAgentRunSummary(state, { scenario, agentKind: 'black', provider: 'Anthropic Claude', model: 'claude-opus-5-5' });
  const match = summary.match(/^Stop: .* · ([\d,]+) tokens$/m);
  assert.ok(match, 'the summary has a "Stop:" line');
  return Number(match[1].replace(/,/g, ''));
}

test('Black Box: the run total of the last round equals state.tokens and the "Stop:" line', async () => {
  const { state, scenario } = await blackBoxRun([
    anthropic.toolUse('1', 'search_handbook', { query: 'vacation days new employees' }),
    anthropic.text('2', 'A newly hired employee gets ten vacation days a year. [3.1]'),
  ]);
  assert.equal(state.stopReason, 'ANSWER_ACCEPTED');
  const last = state.rounds.at(-1);
  assert.equal(last.tokensAfter, state.tokens);
  assert.equal(last.tokensAfter, stopTotal(state, scenario));
  assert.notEqual(last.tokensAfter, last.tokensBefore + last.context.total, 'the provider counts replace the estimate');
});

test('Black Box with the model check: the check calls are in the run total of the last round', async () => {
  const { state, scenario } = await blackBoxRun([
    anthropic.toolUse('1', 'search_handbook', { query: 'vacation days' }),
    anthropic.text('2', 'New employees get twelve vacation days. [3.1]'),
    anthropic.text('c1', 'NOT SUPPORTED. The passages say ten days, not twelve.'),
    anthropic.text('3', 'A newly hired employee gets ten vacation days a year. [3.1]'),
    anthropic.text('c2', 'SUPPORTED'),
  ], { modelCheck: true, checkerPrompt: 'CHECKER PROMPT' });
  assert.equal(state.stopReason, 'ANSWER_ACCEPTED');
  const last = state.rounds.at(-1);
  assert.equal(last.tokensAfter, state.tokens);
  assert.equal(last.tokensAfter, stopTotal(state, scenario));
  // Each round ends where the next round starts.
  state.rounds.slice(1).forEach((round, i) => assert.equal(state.rounds[i].tokensAfter, round.tokensBefore));
});

test('Glass Box: the run total of each round is the old sum, and the next round starts from it', async () => {
  const { handbook, scenario } = await fixtures();
  const agent = createGlassBoxAgent({ handbook, synonyms: { PTO: 'vacation' } });
  const question = SAMPLE_QUESTIONS.find((q) => q.key === 'synonym').text;
  const state = await runToEnd(
    createRun({ question, employeeId: 'E-101', prompt: defaultPrompt(), toolNames: TOOL_NAMES }),
    { agent, env: { handbook, scenario } },
  );
  assert.equal(state.stopReason, 'ANSWER_ACCEPTED');
  for (const round of state.rounds) {
    assert.equal(round.tokensAfter, round.tokensBefore + round.context.total, `round ${round.number}`);
  }
  state.rounds.slice(1).forEach((round, i) => assert.equal(state.rounds[i].tokensAfter, round.tokensBefore));
  assert.equal(state.rounds.at(-1).tokensAfter, state.tokens);
});
