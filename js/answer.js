// Station 5: send the assembled prompt to a language model with the
// student's own key. Three providers, one plain shape.
//
// The key travels in a request header straight from the browser to the
// provider. It is never put in a URL, never stored, never logged.
//
// buildRequest / parseAnswer / describeError are pure and tested; askModel
// is the only function that touches the network.

/**
 * @param {string} providerKey  'gemini' | 'openai' | 'anthropic'
 * @param {{ apiKey: string, model: string, prompt: string, maxTokens: number, providers: object }} options
 * @returns {{ url: string, headers: object, body: object }}
 */
export function buildRequest(providerKey, { apiKey, model, prompt, maxTokens, providers }) {
  const provider = providers[providerKey];
  if (!provider) throw new Error(`Unknown provider: ${providerKey}`);
  const url = provider.endpoint.replace('{model}', encodeURIComponent(model));

  switch (providerKey) {
    case 'gemini':
      return {
        url,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens },
        },
      };
    case 'openai':
      return {
        url,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: {
          model,
          messages: [{ role: 'user', content: prompt }],
          max_completion_tokens: maxTokens,
        },
      };
    case 'anthropic':
      return {
        url,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': provider.apiVersion,
          // Anthropic blocks browser calls unless the page opts in. The name
          // is a warning against shipping a shared key inside a web page. Here
          // the key belongs to the student and never leaves their browser
          // except to go to Anthropic, which is the intended exception.
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: {
          model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        },
      };
    default:
      throw new Error(`Unknown provider: ${providerKey}`);
  }
}

/**
 * Pull the reply text out of a successful response.
 * @returns {string}
 * @throws {Error} with code 'refusal' or 'empty'
 */
export function parseAnswer(providerKey, json) {
  let text = '';
  if (providerKey === 'gemini') {
    if (json.promptFeedback && json.promptFeedback.blockReason) throw withCode(new Error('blocked'), 'refusal');
    const parts = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts;
    text = (parts || []).map((part) => part.text || '').join('');
  } else if (providerKey === 'openai') {
    const choice = json.choices && json.choices[0];
    if (choice && choice.finish_reason === 'content_filter') throw withCode(new Error('filtered'), 'refusal');
    text = (choice && choice.message && choice.message.content) || '';
  } else if (providerKey === 'anthropic') {
    if (json.stop_reason === 'refusal') throw withCode(new Error('refusal'), 'refusal');
    text = (json.content || []).filter((block) => block.type === 'text').map((block) => block.text).join('');
  }
  text = text.trim();
  if (!text) throw withCode(new Error('empty reply'), 'empty');
  return text;
}

/**
 * Turn an HTTP failure into one of a few plain codes the page can explain.
 * @returns {'badKey'|'noCredit'|'rateLimit'|'badRequest'|'server'}
 */
export function describeError(status, json) {
  const message = JSON.stringify(json || '').toLowerCase();
  const mentionsKey = /api key|api_key|invalid key|authentication|unauthori[sz]ed/.test(message);
  const mentionsCredit = /quota|billing|credit|insufficient|balance|payment/.test(message);
  if (status === 401 || status === 403) return 'badKey';
  if (status === 402) return 'noCredit';
  if (status === 429) return mentionsCredit ? 'noCredit' : 'rateLimit';
  if (status === 400) {
    if (mentionsKey) return 'badKey';
    if (mentionsCredit) return 'noCredit';
    return 'badRequest';
  }
  if (status === 404) return 'badRequest';
  if (status >= 500) return 'server';
  return 'badRequest';
}

/**
 * Send the prompt and return the reply text.
 * @throws {Error} with a `code` from describeError, or 'network', 'refusal', 'empty'
 */
export async function askModel(providerKey, options) {
  const request = buildRequest(providerKey, options);
  let response;
  try {
    response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
    });
  } catch (error) {
    throw withCode(error, 'network');
  }
  let json = {};
  try { json = await response.json(); } catch { json = {}; }
  if (!response.ok) throw withCode(new Error(`HTTP ${response.status}`), describeError(response.status, json));
  return parseAnswer(providerKey, json);
}

function withCode(error, code) {
  error.code = code;
  return error;
}
