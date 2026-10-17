// Sample provider replies for the Black Box agent tests. They follow each
// provider's published response format. They are not recordings of live
// calls: the tests run with no network and no key.

export const anthropic = {
  toolUse: (id, name, input, extra = []) => ({
    id: `msg_${id}`, type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'tool_use',
    content: [
      { type: 'thinking', thinking: '', signature: `sig-${id}` },
      { type: 'tool_use', id: `toolu_${id}`, name, input },
      ...extra,
    ],
    usage: { input_tokens: 900, output_tokens: 60 },
  }),
  text: (id, text, stop = 'end_turn') => ({
    id: `msg_${id}`, type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: stop,
    content: [{ type: 'thinking', thinking: '', signature: `sig-${id}` }, { type: 'text', text }],
    usage: { input_tokens: 1400, output_tokens: 40 },
  }),
  refusal: () => ({ id: 'msg_r', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'refusal', content: [], usage: { input_tokens: 800, output_tokens: 0 } }),
};

export const openai = {
  toolCall: (id, name, args) => ({
    id: `chatcmpl-${id}`, model: 'gpt-5-mini',
    choices: [{ index: 0, finish_reason: 'tool_calls', message: {
      role: 'assistant', content: null, refusal: null, annotations: [],
      tool_calls: [{ id: `call_${id}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }],
    } }],
    usage: { prompt_tokens: 700, completion_tokens: 30, total_tokens: 730 },
  }),
  text: (id, text) => ({
    id: `chatcmpl-${id}`, model: 'gpt-5-mini',
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: text, refusal: null, annotations: [] } }],
    usage: { prompt_tokens: 900, completion_tokens: 20, total_tokens: 920 },
  }),
};

export const gemini = {
  functionCall: (id, name, args) => ({
    modelVersion: 'gemini-2.5-flash',
    candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [
      { functionCall: { id: `fc_${id}`, name, args }, thoughtSignature: `ts-${id}` },
    ] } }],
    usageMetadata: { promptTokenCount: 650, candidatesTokenCount: 20, thoughtsTokenCount: 80, totalTokenCount: 750 },
  }),
  text: (id, text) => ({
    modelVersion: 'gemini-2.5-flash',
    candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [
      { text: 'Plan: answer.', thought: true },
      { text, thoughtSignature: `ts-${id}` },
    ] } }],
    usageMetadata: { promptTokenCount: 800, candidatesTokenCount: 25, thoughtsTokenCount: 40, totalTokenCount: 865 },
  }),
  safety: () => ({ candidates: [{ finishReason: 'SAFETY', content: { role: 'model', parts: [] } }], usageMetadata: { promptTokenCount: 600 } }),
};

/** A fake `send`: returns the replies in order and keeps every request. */
export function scriptedSend(replies) {
  const requests = [];
  const send = async (request) => {
    requests.push(JSON.parse(JSON.stringify(request)));
    const next = replies[requests.length - 1];
    if (!next) throw Object.assign(new Error('no more replies'), { code: 'server' });
    if (next instanceof Error) throw next;
    return next;
  };
  return { send, requests };
}
