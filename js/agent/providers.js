// Agent mode: the three model providers of the Black Box agent. Pure, except
// sendRequest, which is the only function that touches the network.
//
// The agent keeps one provider-neutral transcript and turns it into each
// provider's request shape here:
//
//   { kind: 'user', text }                       a message from the user or from the check
//   { kind: 'assistant', raw }                   the model's reply, EXACTLY as the provider sent it
//   { kind: 'tool_results', results: [...] }     { callId, name, content, isError } for each call
//
// The model's replies go back unchanged, because they can carry data that the
// provider checks: Claude's thinking blocks and Gemini's thought signatures.
// The history only grows; nothing earlier is edited (agent-mode-plan.md, Phase 15).
//
// The formats follow each provider's published API types (checked 17 October
// 2026 against openai-node and js-genai on GitHub, and Anthropic's API
// reference). Check them again each term: providers change them.

import { ANSWER_PROVIDERS, AGENT_PROVIDERS, AGENT_TEXT_MAX_OUTPUT_TOKENS } from '../constants.js';
import { describeError } from '../answer.js';

const KEY_HEADERS = ['x-api-key', 'authorization', 'x-goog-api-key'];
export const HIDDEN_KEY = '[key hidden]';

/**
 * @param {'gemini' | 'openai' | 'anthropic'} providerKey
 * @param {{ apiKey: string, model?: string, system: string, tools: object[], transcript: object[], text?: boolean }} input
 *   tools are neutral schemas ({ name, description, parameters }); `text: true`
 *   is a request with no tools (the model check and the meta prompt).
 * @returns {{ url: string, headers: object, body: object }}
 */
export function buildAgentRequest(providerKey, { apiKey, model, system, tools = [], transcript, text = false }) {
  const base = ANSWER_PROVIDERS[providerKey];
  const settings = AGENT_PROVIDERS[providerKey];
  if (!base || !settings) throw new Error(`Unknown provider: ${providerKey}`);
  const modelName = model || settings.model;
  const url = base.endpoint.replace('{model}', encodeURIComponent(modelName));
  const maxTokens = text ? AGENT_TEXT_MAX_OUTPUT_TOKENS[providerKey] : settings.maxOutputTokens;

  switch (providerKey) {
    case 'anthropic': {
      const body = {
        model: modelName,
        max_tokens: maxTokens,
        messages: anthropicMessages(transcript),
        output_config: { effort: settings.effort },
      };
      // A prompt with every section disabled is empty: leave the field out.
      if (system) body.system = system;
      if (settings.fallbacks) body.fallbacks = settings.fallbacks;
      if (tools.length) {
        body.tools = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
        // One tool call per round: the loop runs one action at a time.
        body.tool_choice = { type: 'auto', disable_parallel_tool_use: true };
      }
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': base.apiVersion,
        // Anthropic blocks browser calls unless the page opts in. The key belongs
        // to the student and goes only to Anthropic, the same as Station 5.
        'anthropic-dangerous-direct-browser-access': 'true',
      };
      if (settings.betas && settings.betas.length) headers['anthropic-beta'] = settings.betas.join(',');
      return { url, headers, body };
    }

    case 'openai': {
      const body = {
        model: modelName,
        max_completion_tokens: maxTokens,
        messages: [...(system ? [{ role: 'developer', content: system }] : []), ...openaiMessages(transcript)],
      };
      if (tools.length) {
        body.tools = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
        body.parallel_tool_calls = false;
      }
      return { url, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body };
    }

    case 'gemini': {
      const body = {
        contents: geminiContents(transcript),
        generationConfig: { maxOutputTokens: maxTokens },
      };
      if (system) body.systemInstruction = { parts: [{ text: system }] };
      if (tools.length) {
        body.tools = [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.parameters })) }];
      }
      return { url, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body };
    }

    default:
      throw new Error(`Unknown provider: ${providerKey}`);
  }
}

// ---------------------------------------------------------------------------
// The transcript in each provider's shape
// ---------------------------------------------------------------------------

function anthropicMessages(transcript) {
  return transcript.map((item) => {
    if (item.kind === 'user') return { role: 'user', content: item.text };
    if (item.kind === 'assistant') return { role: 'assistant', content: item.raw.content };
    return {
      role: 'user',
      content: item.results.map((r) => ({
        type: 'tool_result', tool_use_id: r.callId, content: r.content, ...(r.isError ? { is_error: true } : {}),
      })),
    };
  });
}

function openaiMessages(transcript) {
  const out = [];
  for (const item of transcript) {
    if (item.kind === 'user') out.push({ role: 'user', content: item.text });
    else if (item.kind === 'assistant') {
      // Send back only the fields of an assistant message parameter.
      const m = item.raw;
      const message = { role: 'assistant', content: m.content ?? null };
      if (m.tool_calls && m.tool_calls.length) {
        message.tool_calls = m.tool_calls.map((c) => ({ id: c.id, type: 'function', function: { name: c.function.name, arguments: c.function.arguments } }));
      }
      out.push(message);
    } else {
      for (const r of item.results) out.push({ role: 'tool', tool_call_id: r.callId, content: r.content });
    }
  }
  return out;
}

function geminiContents(transcript) {
  return transcript.map((item) => {
    if (item.kind === 'user') return { role: 'user', parts: [{ text: item.text }] };
    if (item.kind === 'assistant') return item.raw;   // { role: 'model', parts }, unchanged
    return {
      role: 'user',
      parts: item.results.map((r) => ({
        functionResponse: { name: r.name, ...(r.callId ? { id: r.callId } : {}), response: geminiResponse(r) },
      })),
    };
  });
}

function geminiResponse(r) {
  let value;
  try { value = JSON.parse(r.content); } catch { value = r.content; }
  return r.isError ? { error: value } : { output: value };
}

// ---------------------------------------------------------------------------
// Reading a response
// ---------------------------------------------------------------------------

/**
 * @returns {{ kind: 'tool' | 'text' | 'refusal' | 'truncated' | 'empty',
 *             calls: { callId: string | null, name: string, args: object, argsError?: boolean }[],
 *             text: string, raw: object | null, usage: { input: number, output: number }, model: string | null }}
 *   `raw` is the assistant message to send back in the next request, unchanged.
 */
export function parseAgentResponse(providerKey, json) {
  if (providerKey === 'anthropic') {
    const content = json.content || [];
    const result = {
      calls: content.filter((b) => b.type === 'tool_use').map((b) => ({ callId: b.id, name: b.name, args: b.input || {} })),
      text: content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim(),
      raw: { role: 'assistant', content },
      usage: { input: (json.usage && json.usage.input_tokens) || 0, output: (json.usage && json.usage.output_tokens) || 0 },
      model: json.model || null,
    };
    if (json.stop_reason === 'refusal') return { ...result, kind: 'refusal', raw: null };
    return { ...result, kind: kindOf(result, json.stop_reason === 'max_tokens') };
  }

  if (providerKey === 'openai') {
    const choice = (json.choices && json.choices[0]) || {};
    const message = choice.message || { role: 'assistant', content: null };
    const calls = (message.tool_calls || []).filter((c) => c.type === 'function').map((c) => {
      try { return { callId: c.id, name: c.function.name, args: JSON.parse(c.function.arguments || '{}') }; }
      catch { return { callId: c.id, name: c.function.name, args: {}, argsError: true }; }
    });
    const result = {
      calls,
      text: (message.content || '').trim(),
      raw: message,
      usage: { input: (json.usage && json.usage.prompt_tokens) || 0, output: (json.usage && json.usage.completion_tokens) || 0 },
      model: json.model || null,
    };
    if (choice.finish_reason === 'content_filter' || message.refusal) return { ...result, kind: 'refusal', raw: null };
    return { ...result, kind: kindOf(result, choice.finish_reason === 'length') };
  }

  if (providerKey === 'gemini') {
    const candidate = (json.candidates && json.candidates[0]) || {};
    const content = candidate.content || { role: 'model', parts: [] };
    const parts = content.parts || [];
    const usage = json.usageMetadata || {};
    const result = {
      calls: parts.filter((p) => p.functionCall).map((p) => ({ callId: p.functionCall.id || null, name: p.functionCall.name, args: p.functionCall.args || {} })),
      text: parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('').trim(),
      raw: { ...content, role: 'model' },
      usage: { input: usage.promptTokenCount || 0, output: (usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0) },
      model: json.modelVersion || null,
    };
    const blocked = (json.promptFeedback && json.promptFeedback.blockReason) || ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION'].includes(candidate.finishReason);
    if (blocked) return { ...result, kind: 'refusal', raw: null };
    return { ...result, kind: kindOf(result, candidate.finishReason === 'MAX_TOKENS') };
  }

  throw new Error(`Unknown provider: ${providerKey}`);
}

function kindOf(result, truncated) {
  if (result.calls.length) return 'tool';
  if (truncated) return 'truncated';
  return result.text ? 'text' : 'empty';
}

// ---------------------------------------------------------------------------
// The key never leaves the request headers, and the page never shows it
// ---------------------------------------------------------------------------

/** A copy of the request for the inspector, with the key replaced. */
export function redactRequest(request) {
  const headers = {};
  for (const [name, value] of Object.entries(request.headers)) {
    headers[name] = KEY_HEADERS.includes(name.toLowerCase()) ? HIDDEN_KEY : value;
  }
  return { url: request.url, headers, body: request.body };
}

/**
 * Send one request. Throws an Error with a `code`: one of describeError's
 * codes ('badKey', 'noCredit', 'rateLimit', 'badRequest', 'server') or 'network'.
 */
export async function sendRequest(request) {
  let response;
  try {
    response = await fetch(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(request.body) });
  } catch (error) {
    error.code = 'network';
    throw error;
  }
  let json = {};
  try { json = await response.json(); } catch { json = {}; }
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.code = describeError(response.status, json);
    throw error;
  }
  return json;
}
