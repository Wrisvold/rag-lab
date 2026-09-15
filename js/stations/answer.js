// Station 5 — Answer (optional). Sends the assembled prompt to a language
// model with a key the student supplies. The key lives in memory only.

import { el, fill } from '../dom.js';

export function renderAnswerStation(panel, app) {
  const { state, copy, constants } = app;
  const text = copy.STATION_ANSWER;
  const prompt = state.artifacts.prompt;

  if (!prompt) {
    panel.append(el('p', { class: 'hint', text: text.notYet }));
    return;
  }

  panel.append(el('p', { text: text.intro }));

  // ---- Provider, model, key ----
  const providerSelect = el('select', { id: 'answer-provider', class: 'select' });
  for (const [key, provider] of Object.entries(constants.ANSWER_PROVIDERS)) {
    providerSelect.append(el('option', { value: key, text: `${provider.label} — ${provider.note}` }));
  }
  providerSelect.value = state.ui.provider;

  const modelLine = el('p', { class: 'hint', id: 'answer-model' });
  const keyLink = el('a', { id: 'answer-key-link', target: '_blank', rel: 'noopener noreferrer' });

  function refreshProvider() {
    const provider = constants.ANSWER_PROVIDERS[state.ui.provider];
    modelLine.replaceChildren(el('strong', { text: text.modelLabel + ': ' }), el('code', { text: provider.model }), ' · ', text.modelHint);
    keyLink.textContent = fill(text.keyHelpLink, { provider: provider.label });
    keyLink.href = provider.keyHelpUrl;
  }
  providerSelect.addEventListener('change', () => { state.ui.provider = providerSelect.value; refreshProvider(); });

  const keyInput = el('input', {
    type: 'password',
    id: 'answer-key',
    class: 'key-input',
    placeholder: text.keyPlaceholder,
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-describedby': 'answer-key-note',
  });
  keyInput.value = state.ui.apiKey;
  keyInput.addEventListener('input', () => { state.ui.apiKey = keyInput.value; });

  const forgetButton = el('button', {
    type: 'button', class: 'button', text: text.forgetButton,
    onclick: () => { state.ui.apiKey = ''; keyInput.value = ''; keyInput.focus(); },
  });

  const message = el('p', { class: 'message--error', role: 'alert' });
  const status = el('span', { class: 'copy-status', role: 'status', 'aria-live': 'polite' });
  const askButton = el('button', { type: 'button', class: 'button button--primary', text: text.askButton });

  askButton.addEventListener('click', async () => {
    message.textContent = '';
    if (!state.ui.apiKey.trim()) { message.textContent = text.noKey; keyInput.focus(); return; }
    const provider = constants.ANSWER_PROVIDERS[state.ui.provider];
    askButton.disabled = true;
    status.textContent = fill(text.asking, { provider: provider.label });
    const result = await app.askModel();
    askButton.disabled = false;
    status.textContent = '';
    if (!result.ok) {
      message.textContent = text.errors[result.code] || text.errors.badRequest;
      return;
    }
    renderResult(resultArea, app);
  });

  panel.append(el('div', { class: 'answer-form' }, [
    el('div', {}, [el('label', { for: 'answer-provider', text: text.providerLabel }), providerSelect, modelLine]),
    el('div', {}, [
      el('label', { for: 'answer-key', text: text.keyLabel }),
      el('div', { class: 'toolbar' }, [keyInput, forgetButton, keyLink]),
      el('p', { class: 'callout', id: 'answer-key-note', text: copy.CALLOUTS.answerKey }),
    ]),
    el('div', { class: 'toolbar' }, [askButton, el('span', { class: 'hint', text: text.costNote }), el('span', { class: 'toolbar__spacer' }), status]),
    message,
  ]));

  const resultArea = el('div', { id: 'answer-result' });
  panel.append(resultArea);
  refreshProvider();
  renderResult(resultArea, app);
}

function renderResult(container, app) {
  const { state, copy, constants } = app;
  const text = copy.STATION_ANSWER;
  const answer = state.artifacts.answer;
  const prompt = state.artifacts.prompt;
  container.replaceChildren();
  if (!answer) return;

  const stale = app.isStale('answer');
  if (stale) {
    container.append(el('div', { class: 'stale-notice', role: 'status', text: copy.DIALS.staleNotice }));
  }
  const provider = constants.ANSWER_PROVIDERS[answer.provider];
  const chunks = state.artifacts.chunks.chunks;

  const given = el('div', { class: 'answer-panel' }, [
    el('h3', { text: text.givenHeading }),
    el('p', { class: 'hint', text: state.instruction }),
    ...answer.passages.map((passage, i) => el('div', { class: 'passage' }, [
      el('div', { class: 'passage__label mono', text: `[Passage ${i + 1}]` }),
      el('p', { class: 'passage__text', text: passage.text }),
    ])),
    el('p', { class: 'question-display', text: `Question: ${answer.question}` }),
  ]);
  void chunks;

  const reply = el('div', { class: 'answer-panel answer-panel--reply' }, [
    el('h3', { text: text.answerHeading }),
    el('p', { class: 'answer-meta', text: fill(text.answerMeta, { provider: provider ? provider.label : answer.provider, model: answer.model }) }),
    el('p', { class: 'answer-text', text: answer.text }),
  ]);

  container.append(
    el('div', { class: `answer-grid${stale ? ' stale' : ''}` }, [given, reply]),
    el('section', { class: 'check-section' }, [
      el('h3', { text: text.checkHeading }),
      el('p', { class: 'hint', text: text.checkIntro }),
      el('ol', { class: 'checklist' }, text.checks.map((item) => el('li', { text: item }))),
    ]),
  );
  void prompt;
}
