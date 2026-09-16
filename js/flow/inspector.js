// Flow mode: the inspector panel. Shows the selected node's artifact by
// rendering the walkthrough's station for it through the adapter, under the
// node's label, lane tag, hint, and the walkthrough's explainer (collapsed).
// Question and Note have no station; they get small views of their own.

import { el, fill } from '../dom.js';
import { nodeType } from './registry.js';
import { setParam, outputEdges } from './graph.js';
import { createStationApp } from './adapter.js';
import { renderDocumentStation } from '../stations/document.js';
import { renderChunkStation } from '../stations/chunk.js';
import { renderEmbedStation } from '../stations/embed.js';
import { renderRetrieveStation } from '../stations/retrieve.js';
import { renderAssembleStation } from '../stations/assemble.js';
import { renderAnswerStation } from '../stations/answer.js';

const STATIONS = {
  document: renderDocumentStation,
  chunk: renderChunkStation,
  embed: renderEmbedStation,
  retrieve: renderRetrieveStation,
  assemble: renderAssembleStation,
  answer: renderAnswerStation,
};

/**
 * @param container   the inspector body
 * @param flow        the page object (see adapter.js)
 * @param {string|null} nodeId
 */
export function renderInspector(container, flow, nodeId) {
  const { copy } = flow;
  const F = copy.FLOW;
  container.replaceChildren();
  const node = nodeId ? flow.graph.nodes.get(nodeId) : null;
  if (!node) {
    container.append(el('p', { class: 'inspector-placeholder', text: F.inspector.empty }));
    return;
  }

  const definition = nodeType(node.type);
  const lane = definition.lane ? copy.LANES[definition.lane] : null;
  container.append(
    el('div', { class: 'station__header' }, [
      el('h3', { text: F.nodes[node.type].label }),
      lane ? el('span', { class: `lane-tag lane-tag--${definition.lane}`, text: lane.label }) : null,
    ]),
    el('p', { class: 'hint', text: F.nodes[node.type].hint }),
  );

  const explainer = copy.EXPLAINERS[node.type];
  if (explainer) {
    const labels = copy.EXPLAINER_LABELS;
    const paragraphs = [
      el('p', {}, [el('strong', { text: labels.what }), explainer.what]),
      el('p', {}, [el('strong', { text: labels.why }), explainer.why]),
    ];
    if (explainer.cosine) paragraphs.push(el('p', {}, [el('strong', { text: labels.cosine }), explainer.cosine]));
    container.append(el('details', { class: 'explainer' }, [el('summary', { text: copy.EXPLAINER_TITLE }), ...paragraphs]));
  }

  const panel = el('div', { class: 'inspector-station' });
  container.append(panel);

  const station = STATIONS[node.type];
  if (station) station(panel, createStationApp(flow, nodeId));
  else if (node.type === 'question') renderQuestion(panel, flow, node);
  else if (node.type === 'note') renderNote(panel, flow, node);
}

function renderQuestion(panel, flow, node) {
  const { copy } = flow;
  const text = copy.STATION_RETRIEVE;
  const F = copy.FLOW;

  const input = el('input', { type: 'text', class: 'question-input', id: 'inspector-question', placeholder: text.questionPlaceholder, autocomplete: 'off' });
  input.value = node.params.text;
  const note = el('p', { class: 'hint question-note' });
  const select = el('select', { class: 'select', 'aria-label': text.sampleLabel }, [
    el('option', { value: '', text: text.samplePlaceholder }),
    ...copy.SAMPLE_QUESTIONS.map((sample) => el('option', { value: sample.key, text: `${sample.label}: ${sample.text}` })),
  ]);
  const refresh = () => {
    const sample = copy.SAMPLE_QUESTIONS.find((q) => q.text === node.params.text.trim());
    note.textContent = sample ? sample.note : '';
    select.value = sample ? sample.key : '';
  };
  input.addEventListener('input', () => {
    if (setParam(flow.graph, node.id, 'text', input.value)) flow.paramChanged(node.id, { fromInspector: true });
    refresh();
  });
  select.addEventListener('change', () => {
    const sample = copy.SAMPLE_QUESTIONS.find((q) => q.key === select.value);
    if (!sample) return;
    input.value = sample.text;
    if (setParam(flow.graph, node.id, 'text', sample.text)) flow.paramChanged(node.id, { fromInspector: true });
    refresh();
  });

  const fed = outputEdges(flow.graph, node.id).map((edge) => F.nodes[flow.graph.nodes.get(edge.to.node).type].label);
  panel.append(
    el('div', { class: 'question-box' }, [
      el('label', { for: 'inspector-question', class: 'question-label', text: text.questionLabel }),
      input,
      el('div', { class: 'toolbar' }, [el('label', { class: 'hint', text: text.sampleLabel }), select]),
      note,
    ]),
    el('p', { class: 'hint', text: fed.length ? fill(F.inspector.feeds, { nodes: fed.join(', ') }) : F.inspector.feedsNone }),
  );
  refresh();
}

function renderNote(panel, flow, node) {
  const F = flow.copy.FLOW;
  const textarea = el('textarea', { class: 'instruction-input', rows: '8', 'aria-label': F.params.noteText, placeholder: F.params.notePlaceholder });
  textarea.value = node.params.text;
  textarea.addEventListener('input', () => {
    if (setParam(flow.graph, node.id, 'text', textarea.value)) flow.paramChanged(node.id, { fromInspector: true });
  });
  panel.append(textarea);
}
