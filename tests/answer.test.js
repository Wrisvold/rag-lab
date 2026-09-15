import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRequest, parseAnswer, describeError } from '../js/answer.js';
import { ANSWER_PROVIDERS, ANSWER_MAX_OUTPUT_TOKENS } from '../js/constants.js';

const base = { apiKey: 'sk-test-KEY', prompt: 'Hello?', maxTokens: ANSWER_MAX_OUTPUT_TOKENS, providers: ANSWER_PROVIDERS };

test('every provider puts the key in a header, never in the URL or body', () => {
  for (const key of Object.keys(ANSWER_PROVIDERS)) {
    const request = buildRequest(key, { ...base, model: ANSWER_PROVIDERS[key].model });
    assert.ok(!request.url.includes('sk-test-KEY'), `${key} leaks the key in the URL`);
    assert.ok(!JSON.stringify(request.body).includes('sk-test-KEY'), `${key} leaks the key in the body`);
    assert.ok(JSON.stringify(request.headers).includes('sk-test-KEY'), `${key} should send the key in a header`);
    assert.ok(request.url.startsWith('https://'), `${key} must use https`);
  }
});

test('gemini request shape', () => {
  const request = buildRequest('gemini', { ...base, model: 'gemini-x' });
  assert.match(request.url, /models\/gemini-x:generateContent$/);
  assert.equal(request.headers['x-goog-api-key'], 'sk-test-KEY');
  assert.equal(request.body.contents[0].parts[0].text, 'Hello?');
});

test('openai request shape', () => {
  const request = buildRequest('openai', { ...base, model: 'gpt-x' });
  assert.equal(request.headers.Authorization, 'Bearer sk-test-KEY');
  assert.equal(request.body.model, 'gpt-x');
  assert.equal(request.body.messages[0].content, 'Hello?');
});

test('anthropic request shape includes the browser opt-in header', () => {
  const request = buildRequest('anthropic', { ...base, model: 'claude-x' });
  assert.equal(request.headers['x-api-key'], 'sk-test-KEY');
  assert.equal(request.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.ok(request.headers['anthropic-version']);
  assert.equal(request.body.max_tokens, ANSWER_MAX_OUTPUT_TOKENS);
  assert.equal(request.body.messages[0].role, 'user');
});

test('unknown provider throws', () => {
  assert.throws(() => buildRequest('nope', { ...base, model: 'm' }));
});

test('parseAnswer reads each provider and trims', () => {
  assert.equal(parseAnswer('gemini', { candidates: [{ content: { parts: [{ text: ' Hi ' }, { text: 'there' }] } }] }), 'Hi there');
  assert.equal(parseAnswer('openai', { choices: [{ message: { content: 'Yes.' } }] }), 'Yes.');
  assert.equal(parseAnswer('anthropic', { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Sure' }, { type: 'text', text: '.' }] }), 'Sure.');
});

test('parseAnswer flags refusals and empty replies', () => {
  assert.throws(() => parseAnswer('anthropic', { stop_reason: 'refusal', content: [] }), { code: 'refusal' });
  assert.throws(() => parseAnswer('gemini', { promptFeedback: { blockReason: 'SAFETY' } }), { code: 'refusal' });
  assert.throws(() => parseAnswer('openai', { choices: [{ finish_reason: 'content_filter', message: { content: '' } }] }), { code: 'refusal' });
  assert.throws(() => parseAnswer('openai', { choices: [] }), { code: 'empty' });
});

test('describeError maps statuses to plain codes', () => {
  assert.equal(describeError(401, {}), 'badKey');
  assert.equal(describeError(403, {}), 'badKey');
  assert.equal(describeError(400, { error: { message: 'API key not valid' } }), 'badKey');
  assert.equal(describeError(400, { error: { message: 'Your credit balance is too low' } }), 'noCredit');
  assert.equal(describeError(429, { error: { code: 'insufficient_quota' } }), 'noCredit');
  assert.equal(describeError(429, { error: { message: 'Rate limit reached' } }), 'rateLimit');
  assert.equal(describeError(402, {}), 'noCredit');
  assert.equal(describeError(404, {}), 'badRequest');
  assert.equal(describeError(500, {}), 'server');
  assert.equal(describeError(400, {}), 'badRequest');
});
