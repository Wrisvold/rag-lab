// Flow mode: one node card. Builds the article for a node (title, lane tag,
// ports, inline parameter controls, summary line, stale badge, Run button)
// and keeps its chrome up to date without rebuilding the controls, so a
// student never loses the cursor mid-edit.
//
// All text comes from copy.js. Interaction (drag, wire, keyboard) lives in
// canvas.js; this file only builds and updates DOM.

import { el, fill } from '../dom.js';
import { formatNumber } from '../text.js';
import { estimateTokens } from '../prompt.js';
import { nodeType } from './registry.js';
import { setParam, isStale, inputEdge } from './graph.js';
import { explainError } from './explain.js';

/**
 * @param node        a graph node
 * @param app         { graph, copy, constants, busy, label(node) }
 * @param hooks       { onParam(nodeId), onRun(nodeId), onRemove(nodeId), loadSample(nodeId) -> Promise<string|null> }
 */
export function buildNode(node, app, hooks) {
  const { copy } = app;
  const F = copy.FLOW;
  const definition = nodeType(node.type);
  const label = F.nodes[node.type].label;
  const lane = definition.lane ? copy.LANES[definition.lane] : null;

  const article = el('article', {
    class: `flow-node flow-node--${node.type}${definition.lane ? ` flow-node--${definition.lane}` : ''}`,
    'data-node': node.id,
    tabindex: '0',
    role: 'group',
    'aria-labelledby': `${node.id}-title`,
    'aria-describedby': `${node.id}-summary`,
  });
  article.style.left = `${node.position.x}px`;
  article.style.top = `${node.position.y}px`;

  const head = el('div', { class: 'flow-node__head' }, [
    el('h3', { class: 'flow-node__title', id: `${node.id}-title`, text: label }),
    lane ? el('span', { class: `lane-tag lane-tag--${definition.lane}`, text: lane.name }) : null,
    el('button', {
      type: 'button', class: 'flow-node__remove', text: '×',
      'aria-label': fill(F.node.remove, { node: label }),
      onclick: () => hooks.onRemove(node.id),
    }),
  ]);

  const inputs = el('div', { class: 'flow-node__inputs' }, definition.inputs.map((port) => portRow(node, port, 'in', F)));
  const outputs = el('div', { class: 'flow-node__outputs' }, definition.outputs.map((port) => portRow(node, port, 'out', F)));
  const message = el('p', { class: 'flow-node__message', role: 'alert' });
  const params = el('div', { class: 'flow-node__params' }, buildParams(node, app, hooks, message));
  params.append(message);

  article.append(head, el('div', { class: 'flow-node__body' }, [inputs, params, outputs]));

  if (definition.runnable !== false) {
    article.append(el('div', { class: 'flow-node__foot' }, [
      el('p', { class: 'flow-node__summary', id: `${node.id}-summary` }),
      el('button', { type: 'button', class: 'button flow-node__run', text: F.node.run, onclick: () => hooks.onRun(node.id) }),
      el('span', { class: 'flow-node__badge', text: F.node.stale, hidden: true }),
      el('p', { class: 'flow-node__error' }),
    ]));
  } else {
    // Notes still need the summary id the article's aria-describedby points at.
    article.append(el('p', { class: 'visually-hidden', id: `${node.id}-summary`, text: F.nodes[node.type].hint }));
  }

  updateChrome(article, node, app);
  return article;
}

function portRow(node, port, side, F) {
  const button = el('button', {
    type: 'button',
    class: `flow-port flow-port--${side}`,
    'data-node': node.id,
    'data-port': port.id,
    'data-type': port.type,
    'data-side': side,
  });
  return el('div', { class: `flow-port-row flow-port-row--${side}` }, [
    button,
    el('span', { class: 'flow-port-label', text: F.portLabels[port.type], 'aria-hidden': 'true' }),
  ]);
}

/**
 * Refresh everything on a card that depends on the graph: stale state, the
 * summary line, the error line, the Run button, and the port names.
 */
export function updateChrome(article, node, app) {
  const F = app.copy.FLOW;
  const stale = isStale(app.graph, node.id);
  article.classList.toggle('is-stale', stale);
  article.classList.toggle('has-error', Boolean(node.error));
  article.classList.toggle('has-artifact', Boolean(node.artifact));

  const summary = article.querySelector('.flow-node__summary');
  if (summary) summary.textContent = node.artifact ? summarize(node, app) : F.node.notRun;
  const badge = article.querySelector('.flow-node__badge');
  if (badge) badge.hidden = !stale;
  const error = article.querySelector('.flow-node__error');
  if (error) error.textContent = node.error ? explainError(node.error) : '';
  const run = article.querySelector('.flow-node__run');
  if (run) run.disabled = Boolean(app.busy);

  updatePortNames(article, node, app);
}

/** Accessible names for the ports, which change as wires come and go. */
export function updatePortNames(article, node, app) {
  const F = app.copy.FLOW;
  const label = F.nodes[node.type].label;
  for (const button of article.querySelectorAll('.flow-port')) {
    const portName = F.portNames[button.dataset.type];
    if (button.dataset.side === 'in') {
      const edge = inputEdge(app.graph, node.id, button.dataset.port);
      const source = edge ? app.graph.nodes.get(edge.from.node) : null;
      button.classList.toggle('is-wired', Boolean(edge));
      button.setAttribute('aria-label', source
        ? fill(F.node.inputWired, { node: label, port: portName, source: F.nodes[source.type].label })
        : fill(F.node.inputFree, { node: label, port: portName }));
    } else {
      button.setAttribute('aria-label', fill(F.node.output, { node: label, port: portName }));
    }
  }
}

function summarize(node, app) {
  const F = app.copy.FLOW;
  const output = node.artifact.output;
  switch (node.type) {
    case 'document':
      return fill(F.summaries.document, { name: output.name || app.copy.STATION_DOCUMENT.pastedName, words: formatNumber(output.words) });
    case 'chunk':
      return fill(F.summaries.chunk, { count: formatNumber(output.summary.count), cuts: formatNumber(output.summary.midSentenceCuts) });
    case 'embed':
      return fill(F.summaries.embed, { count: formatNumber(output.embedding.vectors.length), dims: formatNumber(output.embedding.dimensions) });
    case 'question':
      return F.summaries.question;
    case 'retrieve':
      return fill(F.summaries.retrieve, { k: output.topK.length, total: formatNumber(output.ranked.length) });
    case 'assemble':
      return fill(F.summaries.assemble, {
        chars: formatNumber(output.text.length),
        tokens: formatNumber(estimateTokens(output.text, app.constants.CHARS_PER_TOKEN_ESTIMATE)),
      });
    case 'answer':
      return fill(F.summaries.answer, { provider: app.constants.ANSWER_PROVIDERS[output.provider].label, chars: formatNumber(output.text.length) });
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Inline parameter controls, one set per node type
// ---------------------------------------------------------------------------
function buildParams(node, app, hooks, message) {
  const { copy, constants: C } = app;
  const F = copy.FLOW;
  const change = (key, value) => {
    if (setParam(app.graph, node.id, key, value)) hooks.onParam(node.id);
  };

  switch (node.type) {
    case 'document': {
      const textarea = el('textarea', {
        rows: '3', placeholder: copy.STATION_DOCUMENT.placeholder, spellcheck: 'false',
        'aria-label': F.params.documentText,
      });
      textarea.value = node.params.text;
      const count = el('span', { class: 'hint' });
      const refreshCount = () => {
        const text = node.params.text;
        count.textContent = text
          ? fill(copy.STATION_DOCUMENT.wordCount, { name: node.params.name, words: formatNumber(text.trim().split(/\s+/).length), chars: formatNumber(text.length) })
          : copy.STATION_DOCUMENT.emptyCount;
      };
      textarea.addEventListener('input', () => {
        setParam(app.graph, node.id, 'name', textarea.value ? copy.STATION_DOCUMENT.pastedName : '');
        change('text', textarea.value);
        refreshCount();
      });
      const sample = el('button', { type: 'button', class: 'button', text: copy.STATION_DOCUMENT.sampleButton });
      sample.addEventListener('click', async () => {
        message.textContent = '';
        const text = await hooks.loadSample(node.id);
        if (text === null) { message.textContent = copy.STATION_DOCUMENT.sampleError; return; }
        textarea.value = text;
        refreshCount();
      });
      refreshCount();
      return [labelled(F.params.documentText, textarea, true), el('div', { class: 'toolbar', style: 'margin:0' }, [sample]), count];
    }

    case 'chunk':
      return [
        numberControl(app, node, 'chunkSize', copy.DIALS.chunkSize, C.CHUNK_SIZE_MIN, C.CHUNK_SIZE_MAX, change, message),
        numberControl(app, node, 'chunkOverlap', copy.DIALS.chunkOverlap, C.CHUNK_OVERLAP_MIN, C.CHUNK_OVERLAP_MAX, change, message),
      ];

    case 'embed': {
      const name = `${node.id}-mode`;
      const option = (value, text) => {
        const input = el('input', { type: 'radio', name, value });
        input.checked = node.params.mode === value;
        input.addEventListener('change', () => { if (input.checked) change('mode', value); });
        return el('label', { class: 'flow-mode-option' }, [input, text]);
      };
      return [
        el('fieldset', { class: 'flow-fieldset', style: 'border:0;padding:0;margin:0' }, [
          el('legend', { class: 'visually-hidden', text: F.params.mode }),
          option('glass', copy.STATION_EMBED.modeGlass),
          option('black', copy.STATION_EMBED.modeBlack),
        ]),
      ];
    }

    case 'question': {
      const input = el('input', { type: 'text', 'aria-label': F.params.questionText, placeholder: copy.STATION_RETRIEVE.placeholder || '' });
      input.value = node.params.text;
      input.addEventListener('input', () => change('text', input.value));
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') { event.preventDefault(); hooks.onRun(node.id); }
      });
      const select = el('select', { 'aria-label': F.params.sampleQuestions }, [
        el('option', { value: '', text: F.params.chooseQuestion }),
        ...copy.SAMPLE_QUESTIONS.map((q) => el('option', { value: q.key, text: q.label })),
      ]);
      select.addEventListener('change', () => {
        const sample = copy.SAMPLE_QUESTIONS.find((q) => q.key === select.value);
        if (!sample) return;
        input.value = sample.text;
        change('text', sample.text);
        select.value = '';
      });
      return [labelled(F.params.questionText, input, true), select];
    }

    case 'retrieve':
      return [numberControl(app, node, 'topK', copy.DIALS.topK, C.TOP_K_MIN, C.TOP_K_MAX, change, message)];

    case 'assemble': {
      const textarea = el('textarea', { rows: '3', 'aria-label': F.params.instruction });
      textarea.value = node.params.instruction;
      textarea.addEventListener('input', () => change('instruction', textarea.value));
      return [labelled(F.params.instruction, textarea)];
    }

    case 'answer': {
      const select = el('select', { 'aria-label': F.params.provider },
        Object.entries(C.ANSWER_PROVIDERS).map(([key, provider]) => el('option', { value: key, text: `${provider.label} · ${provider.note}` })));
      select.value = node.params.provider;
      select.addEventListener('change', () => change('provider', select.value));
      return [labelled(F.params.provider, select)];
    }

    case 'note': {
      const textarea = el('textarea', { rows: '4', 'aria-label': F.params.noteText, placeholder: F.params.notePlaceholder });
      textarea.value = node.params.text;
      textarea.addEventListener('input', () => change('text', textarea.value));
      return [textarea];
    }

    default:
      return [];
  }
}

function labelled(text, control, hideLabel = false) {
  const label = el('label', {}, [el('span', { class: hideLabel ? 'visually-hidden' : '', text }), control]);
  return label;
}

/**
 * A dial on a node: the same rules as the sidebar dials. Out-of-range values
 * and an overlap that is not smaller than the chunk size are refused with the
 * sidebar's messages and the control is set back, rather than clamped.
 */
function numberControl(app, node, key, dial, min, max, change, message) {
  const input = el('input', { type: 'number', min: String(min), max: String(max), step: '1' });
  input.value = node.params[key];
  input.addEventListener('change', () => {
    const value = Number(input.value);
    if (!Number.isInteger(value) || value < min || value > max) {
      message.textContent = fill(app.copy.DIALS.outOfRange, { min, max });
      input.value = node.params[key];
      return;
    }
    const next = { ...node.params, [key]: value };
    if ('chunkOverlap' in next && next.chunkOverlap >= next.chunkSize) {
      message.textContent = app.copy.DIALS.overlapTooLarge;
      input.value = node.params[key];
      return;
    }
    message.textContent = '';
    change(key, value);
  });
  return el('label', {}, [
    el('span', { class: 'mono', text: dial.label }),
    el('span', { class: 'hint', text: ` ${dial.help}` }),
    input,
  ]);
}
