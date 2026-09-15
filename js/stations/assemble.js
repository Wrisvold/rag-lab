// Station 4 — Assemble. Artifact 4: the assembled prompt, in three labelled
// blocks, plus Copy prompt and Copy run summary.

import { el, fill } from '../dom.js';
import { formatNumber, padNumber } from '../text.js';
import { estimateTokens } from '../prompt.js';
import { copyText } from '../clipboard.js';

export function renderAssembleStation(panel, app) {
  const { state, copy, constants } = app;
  const text = copy.STATION_ASSEMBLE;
  const artifact = state.artifacts.prompt;

  if (!artifact) {
    panel.append(
      el('p', { class: 'hint', text: text.notYet }),
      el('div', { class: 'toolbar' }, [
        el('button', { type: 'button', class: 'button button--primary', text: text.runButton, disabled: !state.artifacts.retrieval, onclick: () => app.runAssembly() }),
      ]),
    );
    return;
  }

  const stale = app.isStale('prompt');
  const chunks = state.artifacts.chunks.chunks;

  if (stale) {
    panel.append(el('div', { class: 'stale-notice', role: 'status' }, [
      copy.DIALS.staleNotice + ' ',
      el('button', { type: 'button', class: 'button button--primary', text: text.rerunButton, onclick: () => app.runAssembly() }),
    ]));
  }

  const body = el('div', { class: stale ? 'stale' : '' });
  panel.append(body);

  // ---- Block 1: instruction (editable) ----
  const instruction = el('textarea', { class: 'instruction-input', id: 'instruction-text', 'aria-label': text.block1, rows: 4 });
  instruction.value = state.instruction;
  const promptBox = el('pre', { class: 'prompt-box', id: 'assembled-prompt', tabindex: '0', 'aria-label': text.fullHeading });
  const lengthLine = el('p', { class: 'hint', id: 'prompt-length' });
  const copyStatus = el('span', { class: 'copy-status', role: 'status', 'aria-live': 'polite' });

  function refreshPrompt() {
    const current = state.artifacts.prompt;
    promptBox.textContent = current.text;
    lengthLine.textContent = fill(text.length, {
      chars: formatNumber(current.text.length),
      tokens: formatNumber(estimateTokens(current.text, constants.CHARS_PER_TOKEN_ESTIMATE)),
    });
  }

  instruction.addEventListener('input', () => { app.setInstruction(instruction.value); refreshPrompt(); });
  const resetButton = el('button', {
    type: 'button', class: 'button', text: text.resetButton,
    onclick: () => { instruction.value = constants.DEFAULT_INSTRUCTION; app.setInstruction(constants.DEFAULT_INSTRUCTION); refreshPrompt(); },
  });

  body.append(el('section', { class: 'prompt-block', 'aria-labelledby': 'block-1' }, [
    el('h3', { id: 'block-1', class: 'prompt-block__title', text: text.block1 }),
    el('p', { class: 'hint', text: text.block1Help }),
    instruction,
    el('div', { class: 'toolbar' }, [resetButton]),
  ]));

  // ---- Block 2: retrieved passages (read-only) ----
  const passageList = el('ol', { class: 'passage-list' });
  artifact.passages.forEach((passage, i) => {
    const chunk = chunks[passage.chunkIndex];
    passageList.append(el('li', { class: 'passage' }, [
      el('div', { class: 'passage__label mono' }, [
        `[Passage ${i + 1}]`,
        el('span', { class: 'hint', text: ' ' + fill(text.passageTag, { chunk: padNumber(chunk.number, chunks.length), score: passage.score.toFixed(2) }) }),
      ]),
      el('p', { class: 'passage__text', text: passage.text }),
    ]));
  });
  body.append(el('section', { class: 'prompt-block', 'aria-labelledby': 'block-2' }, [
    el('h3', { id: 'block-2', class: 'prompt-block__title', text: text.block2 }),
    el('p', { class: 'hint', text: fill(text.block2Help, { topK: artifact.passages.length }) }),
    passageList,
  ]));

  // ---- Block 3: question (read-only) ----
  body.append(el('section', { class: 'prompt-block', 'aria-labelledby': 'block-3' }, [
    el('h3', { id: 'block-3', class: 'prompt-block__title', text: text.block3 }),
    el('p', { class: 'hint', text: text.block3Help }),
    el('p', { class: 'question-display', text: artifact.question }),
  ]));

  // ---- The full prompt ----
  const copyPromptButton = el('button', {
    type: 'button', class: 'button button--primary', text: text.copyPrompt,
    onclick: async () => { copyStatus.textContent = (await copyText(state.artifacts.prompt.text)) ? text.copied : text.copyFailed; },
  });
  body.append(el('section', { class: 'prompt-full', 'aria-labelledby': 'full-heading' }, [
    el('h3', { id: 'full-heading', text: text.fullHeading }),
    promptBox,
    el('div', { class: 'toolbar' }, [copyPromptButton, lengthLine, el('span', { class: 'toolbar__spacer' }), copyStatus]),
    el('div', { class: 'callout', role: 'note', text: copy.CALLOUTS.pasteIntoLlm }),
  ]));

  // ---- Run summary ----
  const summaryBox = el('pre', { class: 'prompt-box prompt-box--summary', tabindex: '0', 'aria-label': text.summaryHeading });
  const summaryStatus = el('span', { class: 'copy-status', role: 'status', 'aria-live': 'polite' });
  summaryBox.textContent = app.buildRunSummary();
  body.append(el('section', { class: 'summary-section', 'aria-labelledby': 'summary-heading' }, [
    el('h3', { id: 'summary-heading', text: text.summaryHeading }),
    el('p', { class: 'hint', text: text.summaryIntro }),
    summaryBox,
    el('div', { class: 'toolbar' }, [
      el('button', {
        type: 'button', class: 'button button--primary', text: text.copySummary,
        onclick: async () => {
          const summary = app.buildRunSummary();
          summaryBox.textContent = summary;
          summaryStatus.textContent = (await copyText(summary)) ? text.copied : text.copyFailed;
        },
      }),
      el('span', { class: 'toolbar__spacer' }),
      summaryStatus,
    ]),
  ]));

  // ---- Continue ----
  body.append(el('div', { class: 'toolbar' }, [
    el('button', { type: 'button', class: 'button', text: text.continueButton, disabled: true, title: copy.UI.notBuilt }),
  ]));

  refreshPrompt();
}
