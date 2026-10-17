// The Black Box agent in the real loop, with sample provider replies and no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlackBoxAgent, parseSections, writePromptWithModel } from '../../js/agent/blackBoxAgent.js';
import { createRun, runToEnd } from '../../js/agent/loop.js';
import { defaultPrompt, systemPromptText } from '../../js/agent/context.js';
import { TOOL_NAMES } from '../../js/agent/tools.js';
import { describeEvent } from '../../js/agent/describe.js';
import { formatAgentRunSummary } from '../../js/agent/summary.js';
import { AGENT } from '../../js/copy.js';
import { fixtures } from './helpers.js';
import { anthropic, openai, gemini, scriptedSend } from './providerFixtures.js';

const QUESTION = 'How many days of PTO do new employees get?';

async function runWith(providerKey, replies, { question = QUESTION, employeeId = 'E-101', settings = {}, request = null, agentOptions = {} } = {}) {
  const { handbook, scenario } = await fixtures();
  const { send, requests } = scriptedSend(replies);
  const agent = createBlackBoxAgent({ providerKey, apiKey: 'KEY', send, scenarioDate: scenario.today, ...agentOptions });
  const events = [];
  const state = await runToEnd(
    createRun({ question, request, employeeId, prompt: { ...defaultPrompt(), version: 'v1' }, toolNames: TOOL_NAMES, settings }),
    { agent, env: { handbook, scenario } },
    (event) => events.push(event),
  );
  return { state, requests, events, scenario };
}

test('Anthropic: search, then a cited answer, accepted in two rounds; the thinking block goes back unchanged', async () => {
  const { state, requests, scenario } = await runWith('anthropic', [
    anthropic.toolUse('1', 'search_handbook', { query: 'vacation days new employees' }),
    anthropic.text('2', 'A newly hired employee gets ten vacation days a year. [3.1]'),
  ]);
  assert.equal(state.stopReason, 'ANSWER_ACCEPTED');
  assert.equal(state.rounds.length, 2);
  assert.equal(requests[0].body.system, systemPromptText(defaultPrompt()), 'the model reads the system prompt');
  assert.match(requests[0].body.messages[0].content, /Employee: E-101 \(New employee\)\. Today is 2026-11-02\.\nQuestion: How many days of PTO/);
  const second = requests[1].body.messages;
  assert.deepEqual(second[1].content, anthropic.toolUse('1', 'search_handbook', { query: 'vacation days new employees' }).content, 'replayed exactly');
  assert.equal(second[2].content[0].tool_use_id, 'toolu_1');
  assert.match(second[2].content[0].content, /"section":"3.1"/);
  assert.equal(state.tokens, 900 + 60 + 1400 + 40, 'the provider counts replace the estimates');
  const summary = formatAgentRunSummary(state, { scenario, agentKind: 'black', provider: 'Anthropic Claude', model: 'claude-opus-5-5' });
  assert.match(summary, /Agent: Black Box \(Anthropic Claude · claude-opus-5-5\)/);
  assert.match(summary, /Stop: ANSWER_ACCEPTED after 2 rounds · 2,400 tokens$/, 'no "about": the provider counted them');
  assert.ok(!summary.includes('KEY'));
  assert.equal(state.rounds[0].decision.request.headers['x-api-key'], '[key hidden]');
});

test('Gemini: an answer with no section fails the check in code, the feedback goes to the model, and it searches', async () => {
  const { state, requests } = await runWith('gemini', [
    gemini.text('1', 'New employees get ten days.'),
    gemini.functionCall('2', 'search_handbook', { query: 'vacation days new employees' }),
    gemini.text('3', 'A newly hired employee gets ten vacation days a year. [3.1]'),
  ]);
  assert.equal(state.stopReason, 'ANSWER_ACCEPTED');
  assert.equal(state.rounds[0].check.passed, false);
  assert.equal(state.rounds[0].check.reasons[0].rule, 'A1');
  const contents = requests[1].body.contents;
  assert.deepEqual(contents[1], gemini.text('1', 'New employees get ten days.').candidates[0].content, 'the model turn goes back unchanged');
  assert.deepEqual(contents[2], { role: 'user', parts: [{ text: AGENT.feedback.noCitation }] });
  assert.equal(requests[2].body.contents.at(-1).parts[0].functionResponse.id, 'fc_2');
});

test('OpenAI: a balance question; an answer from a tool needs no section number', async () => {
  const { state, requests } = await runWith('openai', [
    openai.toolCall('1', 'get_vacation_balance', { employee_id: 'E-102' }),
    openai.text('2', 'You have 6 days of vacation left.'),
  ], { question: 'How many vacation days do I have left?', employeeId: 'E-102' });
  assert.equal(state.stopReason, 'ANSWER_ACCEPTED');
  assert.equal(state.rounds[1].check.reasons[0].rule, 'A2');
  assert.deepEqual(requests[1].body.messages.at(-1), { role: 'tool', tool_call_id: 'call_1', content: '{"employee_id":"E-102","vacation_days_left":6}' });
});

test('a second tool call in one reply does not run, and the model is told so', async () => {
  const extra = { type: 'tool_use', id: 'toolu_extra', name: 'get_vacation_balance', input: { employee_id: 'E-101' } };
  const { requests } = await runWith('anthropic', [
    anthropic.toolUse('1', 'search_handbook', { query: 'vacation' }, [extra]),
    anthropic.text('2', 'Ten vacation days a year. [3.1]'),
  ]);
  const results = requests[1].body.messages[2].content;
  assert.equal(results.length, 2, 'one result for each call in the reply');
  assert.equal(results[1].tool_use_id, 'toolu_extra');
  assert.equal(results[1].is_error, true);
  assert.match(results[1].content, /Not run/);
});

test('keep only the last two rounds: the old rounds drop out, and Claude thinking blocks in the kept rounds go', async () => {
  const { requests } = await runWith('anthropic', [
    anthropic.toolUse('1', 'search_handbook', { query: 'a vacation' }),
    anthropic.toolUse('2', 'search_handbook', { query: 'b vacation' }),
    anthropic.toolUse('3', 'search_handbook', { query: 'c vacation' }),
    anthropic.text('4', 'Ten vacation days a year. [3.1]'),
  ], { settings: { keepLastRounds: 2 } });
  const last = requests[3].body.messages;
  assert.equal(last.length, 1 + 2 * 2, 'the first message and two rounds');
  assert.equal(last[1].content[0].type, 'tool_use', 'no thinking block');
  assert.equal(last[1].content[0].id, 'toolu_2');
  assert.ok(requests[2].body.messages[1].content.some((b) => b.type === 'thinking'), 'before any round drops out, thinking blocks stay');
});

test('a failed model call stops the run with MODEL_ERROR, and the readout says why', async () => {
  const { state, events } = await runWith('gemini', [Object.assign(new Error('HTTP 401'), { code: 'badKey' })]);
  assert.equal(state.stopReason, 'MODEL_ERROR');
  assert.equal(state.stopDetail, 'badKey');
  const line = describeEvent(events.at(-1));
  assert.ok(line.includes(AGENT.stops.MODEL_ERROR.message) && line.includes(AGENT.modelErrors.badKey));
});

test('a refusal by the provider ends the run honestly', async () => {
  const { state } = await runWith('anthropic', [anthropic.refusal()]);
  assert.equal(state.stopReason, 'GAVE_UP');
  assert.equal(state.rounds[0].decision.text, AGENT.answers.modelRefused);
});

test('the model check: a second call with its own prompt; "NOT SUPPORTED" sends the reason back', async () => {
  const { state, requests } = await runWith('anthropic', [
    anthropic.toolUse('1', 'search_handbook', { query: 'vacation days' }),
    anthropic.text('2', 'New employees get twelve vacation days. [3.1]'),
    anthropic.text('c1', 'NOT SUPPORTED. The passages say ten days, not twelve.'),
    anthropic.text('3', 'A newly hired employee gets ten vacation days a year. [3.1]'),
    anthropic.text('c2', 'SUPPORTED'),
  ], { agentOptions: { modelCheck: true, checkerPrompt: 'CHECKER PROMPT' } });
  assert.equal(state.stopReason, 'ANSWER_ACCEPTED');
  assert.equal(requests[2].body.system, 'CHECKER PROMPT');
  assert.equal(requests[2].body.tools, undefined, 'the check has no tools');
  assert.match(requests[2].body.messages[0].content, /Answer:\nNew employees get twelve/);
  const failed = state.rounds[1].check;
  assert.equal(failed.passed, false);
  assert.match(failed.feedback, /ten days, not twelve/);
  assert.match(requests[3].body.messages.at(-1).content, /The model check found a problem/);
  assert.equal(state.tokens, 960 + 1440 + 1440 + 1440 + 1440, 'the check calls count too');
});

test('Exercise 4 with a model: with the notice rule off, a 7-day request reaches the approval step', async () => {
  const { state } = await runWith('openai', [
    openai.toolCall('1', 'get_vacation_balance', { employee_id: 'E-103' }),
    openai.toolCall('2', 'submit_vacation_request', { employee_id: 'E-103', start_date: '2026-11-09', end_date: '2026-11-10' }),
  ], { employeeId: 'E-103', question: 'I want 9 and 10 November off.', settings: { disabledRules: ['notice'] } });
  assert.equal(state.status, 'waiting_for_approval');
  assert.equal(state.pending.rules.find((r) => r.rule === 'notice').disabled, true);
});

test('the meta prompt: the six sections from the reply of the model', async () => {
  const titles = defaultPrompt().sections;
  const text = '**Role:** You are the help agent.\nTasks: You answer questions.\nRules: Use the handbook.\nTool guidance: Search first.\nStop rules: Stop after two searches.\nOutput format: Two sentences.';
  assert.deepEqual(Object.keys(parseSections(text, titles)), ['role', 'tasks', 'rules', 'tools', 'stop', 'format']);
  assert.equal(parseSections(text, titles).tools, 'Search first.');
  assert.equal(parseSections('No sections here.', titles), null);
  const { send, requests } = scriptedSend([anthropic.text('m', text)]);
  const result = await writePromptWithModel({ providerKey: 'anthropic', apiKey: 'KEY', send, basicPrompt: 'Help staff.', sectionTitles: titles });
  assert.equal(result.sections.role, 'You are the help agent.');
  assert.equal(requests[0].body.system, AGENT.metaPrompt.prompt);
});
