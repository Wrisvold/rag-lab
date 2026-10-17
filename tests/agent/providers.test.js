// The request shapes and the reply parsing of the three providers. No network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentRequest, parseAgentResponse, redactRequest, HIDDEN_KEY } from '../../js/agent/providers.js';
import { toolSchemas } from '../../js/agent/tools.js';
import { anthropic, openai, gemini } from './providerFixtures.js';

const KEY = 'sk-test-SECRET-123';
const tools = toolSchemas();
const transcript = (raw) => [
  { kind: 'user', text: 'Question: How many vacation days?' },
  { kind: 'assistant', raw },
  { kind: 'tool_results', results: [{ callId: 'X1', name: 'search_handbook', content: '{"passages":[]}' }] },
];
const keyLeaks = (request) => request.url.includes(KEY) || JSON.stringify(request.body).includes(KEY);

test('Anthropic: system at the top, tools with input_schema, the model and settings of Agent mode', () => {
  const reply = parseAgentResponse('anthropic', anthropic.toolUse('1', 'search_handbook', { query: 'vacation' }));
  const r = buildAgentRequest('anthropic', { apiKey: KEY, system: 'Role:\nYou help.', tools, transcript: transcript(reply.raw) });
  assert.equal(r.body.model, 'claude-opus-5-5');
  assert.equal(r.body.system, 'Role:\nYou help.');
  assert.deepEqual(r.body.output_config, { effort: 'low' });
  assert.equal(r.body.fallbacks, 'default');
  assert.equal(r.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  assert.deepEqual(r.body.tool_choice, { type: 'auto', disable_parallel_tool_use: true });
  assert.deepEqual(Object.keys(r.body.tools[0]), ['name', 'description', 'input_schema']);
  assert.equal(r.body.messages[1].role, 'assistant');
  assert.deepEqual(r.body.messages[1].content[0], { type: 'thinking', thinking: '', signature: 'sig-1' }, 'the thinking block goes back unchanged');
  assert.deepEqual(r.body.messages[2].content[0], { type: 'tool_result', tool_use_id: 'X1', content: '{"passages":[]}' });
  assert.equal(r.headers['x-api-key'], KEY);
  assert.ok(!keyLeaks(r));
  assert.equal(buildAgentRequest('anthropic', { apiKey: KEY, system: '', tools, transcript: [] }).body.system, undefined, 'an empty prompt is left out');
});

test('OpenAI: a developer message, function tools, one tool message for each call', () => {
  const reply = parseAgentResponse('openai', openai.toolCall('1', 'search_handbook', { query: 'vacation' }));
  const r = buildAgentRequest('openai', { apiKey: KEY, system: 'Role:\nYou help.', tools, transcript: transcript(reply.raw) });
  assert.equal(r.body.model, 'gpt-5-mini');
  assert.deepEqual(r.body.messages[0], { role: 'developer', content: 'Role:\nYou help.' });
  assert.equal(r.body.tools[0].type, 'function');
  assert.equal(r.body.parallel_tool_calls, false);
  const assistant = r.body.messages[2];
  assert.deepEqual(Object.keys(assistant).sort(), ['content', 'role', 'tool_calls'], 'only fields of an assistant message parameter');
  assert.deepEqual(r.body.messages[3], { role: 'tool', tool_call_id: 'X1', content: '{"passages":[]}' });
  assert.equal(r.headers.Authorization, `Bearer ${KEY}`);
  assert.ok(!keyLeaks(r));
});

test('Gemini: systemInstruction, JSON Schema tools, the model content sent back unchanged', () => {
  const reply = parseAgentResponse('gemini', gemini.functionCall('1', 'search_handbook', { query: 'vacation' }));
  const r = buildAgentRequest('gemini', { apiKey: KEY, system: 'Role:\nYou help.', tools, transcript: transcript(reply.raw) });
  assert.match(r.url, /models\/gemini-2\.5-flash:generateContent$/);
  assert.deepEqual(r.body.systemInstruction, { parts: [{ text: 'Role:\nYou help.' }] });
  assert.ok(r.body.tools[0].functionDeclarations[0].parametersJsonSchema.properties.query);
  assert.equal(r.body.contents[1].parts[0].thoughtSignature, 'ts-1', 'the thought signature goes back unchanged');
  assert.deepEqual(r.body.contents[2], { role: 'user', parts: [{ functionResponse: { name: 'search_handbook', id: 'X1', response: { output: { passages: [] } } } }] });
  assert.equal(r.headers['x-goog-api-key'], KEY);
  assert.ok(!keyLeaks(r));
});

test('reading replies: tool calls, answers, refusals, and token counts', () => {
  const a = parseAgentResponse('anthropic', anthropic.toolUse('1', 'get_vacation_balance', { employee_id: 'E-101' }));
  assert.equal(a.kind, 'tool');
  assert.deepEqual(a.calls, [{ callId: 'toolu_1', name: 'get_vacation_balance', args: { employee_id: 'E-101' } }]);
  assert.deepEqual(a.usage, { input: 900, output: 60 });
  assert.equal(parseAgentResponse('anthropic', anthropic.refusal()).kind, 'refusal');
  assert.equal(parseAgentResponse('anthropic', { ...anthropic.text('2', ''), stop_reason: 'max_tokens' }).kind, 'truncated');

  const o = parseAgentResponse('openai', openai.toolCall('1', 'search_handbook', { query: 'pto' }));
  assert.deepEqual(o.calls[0].args, { query: 'pto' });
  const broken = openai.toolCall('2', 'search_handbook', {});
  broken.choices[0].message.tool_calls[0].function.arguments = '{"query": ';
  assert.equal(parseAgentResponse('openai', broken).calls[0].argsError, true);
  assert.equal(parseAgentResponse('openai', openai.text('3', 'Ten days. [3.1]')).text, 'Ten days. [3.1]');

  const g = parseAgentResponse('gemini', gemini.text('1', 'Ten days. [3.1]'));
  assert.equal(g.text, 'Ten days. [3.1]', 'thought parts are not part of the answer');
  assert.deepEqual(g.usage, { input: 800, output: 65 });
  assert.equal(parseAgentResponse('gemini', gemini.safety()).kind, 'refusal');
  assert.equal(parseAgentResponse('gemini', gemini.functionCall('2', 'search_handbook', {})).calls[0].callId, 'fc_2');
});

test('the inspector copy of a request never shows the key', () => {
  for (const provider of ['anthropic', 'openai', 'gemini']) {
    const shown = redactRequest(buildAgentRequest(provider, { apiKey: KEY, system: 'x', tools, transcript: [{ kind: 'user', text: 'q' }] }));
    assert.ok(!JSON.stringify(shown).includes(KEY), provider);
    assert.ok(JSON.stringify(shown.headers).includes(HIDDEN_KEY), provider);
  }
});
