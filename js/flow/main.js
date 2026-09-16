// Flow mode — entry point for flow.html. Holds the graph, builds the palette
// and toolbar, mounts the canvas and the inspector, runs nodes with the
// shared progress bar, and keeps the canvas alive across a reload. The
// walkthrough (js/main.js) is untouched by this file.
//
// All user-facing text comes from js/copy.js (FLOW block). Do not type sentences here.

import * as constants from '../constants.js';
import * as copy from '../copy.js';
import { el, fill } from '../dom.js';
import { loadSession, saveSession } from '../session.js';
import { NODE_TYPES } from './registry.js';
import { createGraph, setParam, dependents } from './graph.js';
import { runGraph, runNode } from './runner.js';
import { toJSON, fromJSON } from './serialize.js';
import { canonicalGraph } from './presets.js';
import { EXERCISES } from './exercises.js';
import { flowGraphSummary } from './summary.js';
import { explainLoadError } from './explain.js';
import { copyText } from '../clipboard.js';
import { mountCanvas } from './canvas.js';
import { renderInspector } from './inspector.js';

const F = copy.FLOW;

const state = {
  graph: createGraph(),
  busy: false,
  selected: null,
  sampleText: null,                 // the sample document, fetched once
  blackBox: { available: true },    // flips to false if the model cannot be loaded
  // Per-visit interface state that is not part of the graph. The API key lives
  // here and nowhere else: never persisted, never exported, never logged.
  ui: { selectedChunk: null, apiKey: '' },
};

// ---------------------------------------------------------------------------
// The page object the canvas, the node cards, and the inspector talk to
// ---------------------------------------------------------------------------
const app = {
  copy,
  constants,
  get graph() { return state.graph; },
  get busy() { return state.busy; },
  get blackBoxAvailable() { return state.blackBox.available; },
  get ui() { return state.ui; },

  readout,

  /** Structural change (node, wire, position): persist. Chrome is already updated by the canvas. */
  graphChanged() {
    persist();
    renderInspectorPanel();
  },

  /**
   * A parameter changed on one node: mark it and everything downstream.
   * Changes typed into the inspector do not rebuild the inspector, or the
   * student would lose the cursor.
   */
  paramChanged(nodeId, { fromInspector = false } = {}) {
    canvas.updateOne(nodeId);
    for (const id of dependents(state.graph, nodeId)) canvas.updateOne(id);
    canvas.refresh();
    persist();
    if (!fromInspector) renderInspectorPanel();
  },

  /** Run one node (and its stale ancestors). Resolves to the runner's report, or undefined when busy. */
  async runNode(nodeId, { rerenderInspector = true } = {}) {
    if (state.busy) return undefined;
    return withBusy(() => runNode(state.graph, nodeId, runContext(), runHooks()), { rerenderInspector });
  },

  async runAll() {
    if (state.busy) return undefined;
    const runnable = [...state.graph.nodes.values()].some((node) => NODE_TYPES[node.type].runnable !== false);
    if (!runnable) { readout(F.readout.nothingToRun); return undefined; }
    return withBusy(() => runGraph(state.graph, runContext(), runHooks()));
  },

  select(nodeId) {
    state.selected = nodeId;
    if (nodeId) showInspector(true);
    renderInspectorPanel();
  },

  /** Select a node from the inspector's continue buttons: focus its card, which selects it. */
  selectNode(nodeId) {
    canvas.selectNode(nodeId);
    canvas.focusNode(nodeId);
  },

  /** Fill a Document node with the sample. Returns the text, or null if it could not be fetched. */
  async loadSample(nodeId) {
    const text = await fetchSample();
    if (text === null) return null;
    setParam(state.graph, nodeId, 'text', text);
    setParam(state.graph, nodeId, 'name', constants.SAMPLE_DOCUMENT_NAME);
    app.paramChanged(nodeId);
    return text;
  },

  onViewChange(view) {
    const zoom = document.getElementById('flow-zoom-level');
    if (zoom) zoom.textContent = fill(F.toolbar.zoomLevel, { percent: Math.round(view.zoom * 100) });
    persistView(view);
  },
};

const canvas = mountCanvas(app, {
  canvas: document.getElementById('flow-canvas'),
  world: document.getElementById('flow-world'),
  edges: document.getElementById('flow-edges'),
  nodes: document.getElementById('flow-nodes'),
  handles: document.getElementById('flow-handles'),
});

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------
async function withBusy(run, { rerenderInspector = true } = {}) {
  state.busy = true;
  canvas.refresh();
  let report;
  try {
    report = await run();
    // The walkthrough degrades to Glass Box when the model cannot load; so does the canvas.
    if (report.failed.some((entry) => entry.code === 'BLACK_BOX_UNAVAILABLE')) {
      blackBoxFallback(report);
      report = await run();
    }
    readout(fill(F.readout.ran, {
      ran: report.ran.length,
      fresh: report.fresh.length,
      skipped: report.skipped.filter((entry) => entry.reason !== 'notRunnable').length,
      failed: report.failed.length,
    }));
  } finally {
    state.busy = false;
    hideProgress();
    canvas.refresh();
    if (rerenderInspector) renderInspectorPanel();
  }
  return report;
}

function blackBoxFallback(report) {
  const failed = report.failed.find((entry) => entry.code === 'BLACK_BOX_UNAVAILABLE');
  // One warning line for the instructor's console; no stack trace on the page.
  console.warn('RAG Lab: Black Box mode unavailable:', failed.message);
  state.blackBox.available = false;
  for (const node of state.graph.nodes.values()) {
    if (node.type === 'embed' && node.params.mode === 'black') setParam(state.graph, node.id, 'mode', 'glass');
  }
  showNotice(copy.CALLOUTS.modelFailed);
  persist();
}

function runContext() {
  return {
    apiKey: state.ui.apiKey,
    onProgress: (progress) => {
      if (progress.stage === 'download') {
        showProgress(
          progress.percent === null || progress.percent === undefined
            ? copy.CALLOUTS.modelDownload
            : `${copy.CALLOUTS.modelDownload} ${fill(copy.STATION_EMBED.progressDownload, { percent: progress.percent })}`,
          progress.percent ?? null,
        );
      } else {
        showProgress(
          fill(copy.STATION_EMBED.progressEmbedding, { done: Math.min(progress.done + 1, progress.total), total: progress.total }),
          progress.percent,
        );
      }
    },
  };
}

function runHooks() {
  return {
    onStart(node) {
      canvas.setRunning(node.id, true);
      readout(fill(F.readout.running, { node: F.nodes[node.type].label }));
    },
    onDone(node) {
      canvas.setRunning(node.id, false);
      canvas.updateOne(node.id);
    },
    onError(node) {
      canvas.setRunning(node.id, false);
      canvas.updateOne(node.id);
    },
  };
}

// ---------------------------------------------------------------------------
// Readout, progress bar, notices
// ---------------------------------------------------------------------------
function readout(text) {
  const line = document.getElementById('flow-readout');
  // Clear first so the same sentence twice is announced twice.
  line.textContent = '';
  setTimeout(() => { line.textContent = text; }, 30);
}

function showProgress(label, percent) {
  const bar = document.getElementById('global-progress-fill');
  document.getElementById('global-progress-label').textContent = label;
  bar.classList.toggle('is-indeterminate', percent === null);
  bar.style.width = percent === null ? '' : `${percent}%`;
  document.getElementById('global-progress').hidden = false;
  document.getElementById('global-status').hidden = false;
}

function hideProgress() {
  document.getElementById('global-progress').hidden = true;
  syncGlobalStatus();
}

function showNotice(text) {
  document.getElementById('global-notice-text').textContent = text;
  document.getElementById('global-notice').hidden = false;
  document.getElementById('global-status').hidden = false;
}

function syncGlobalStatus() {
  const wrap = document.getElementById('global-status');
  wrap.hidden = document.getElementById('global-progress').hidden && document.getElementById('global-notice').hidden;
}

// ---------------------------------------------------------------------------
// Chrome: header, palette, toolbar, inspector
// ---------------------------------------------------------------------------
function renderChrome() {
  document.title = F.page.title;
  document.getElementById('app-title').textContent = copy.APP.title;
  document.getElementById('app-subtitle').textContent = F.page.subtitle;
  document.getElementById('app-course').textContent = copy.APP.course;
  document.getElementById('app-footer').textContent = copy.UI.footer;
  document.getElementById('mode-walkthrough').textContent = copy.MODES.walkthrough;
  document.getElementById('mode-flow').textContent = copy.MODES.flow;
  document.getElementById('flow-skip').textContent = F.page.skip;
  document.getElementById('flow-canvas').setAttribute('aria-label', F.page.canvasLabel);
  document.getElementById('flow-help').textContent = F.page.canvasHelp;
  document.getElementById('global-notice-dismiss').textContent = copy.UI.dismiss;
  document.getElementById('global-notice-dismiss').addEventListener('click', () => {
    document.getElementById('global-notice').hidden = true;
    syncGlobalStatus();
  });
  document.getElementById('inspector-heading').textContent = F.inspector.heading;
  const close = document.getElementById('inspector-close');
  close.textContent = F.inspector.close;
  close.addEventListener('click', () => showInspector(false));
}

function renderPalette() {
  document.getElementById('palette-heading').textContent = F.palette.heading;
  document.getElementById('palette-intro').textContent = F.palette.intro;
  const palette = document.getElementById('palette');
  palette.replaceChildren(...Object.values(NODE_TYPES).map((definition) => {
    const label = F.nodes[definition.type].label;
    return el('div', { class: 'palette__item' }, [
      el('button', {
        type: 'button',
        class: `palette__button palette__button--${definition.lane || 'none'}`,
        text: fill(F.palette.add, { node: label }),
        onclick: () => canvas.addNode(definition.type),
      }),
      el('p', { class: 'palette__hint', text: F.nodes[definition.type].hint }),
    ]);
  }));

  document.getElementById('presets-heading').textContent = F.presets.heading;
  document.getElementById('presets').replaceChildren(
    el('button', { type: 'button', class: 'button', text: F.presets.standard, onclick: () => loadStandard() }),
    el('button', { type: 'button', class: 'button', text: F.presets.blank, onclick: () => clearCanvas() }),
  );

  document.getElementById('exercises-heading').textContent = F.exercises.heading;
  document.getElementById('exercises-intro').textContent = F.exercises.intro;
  document.getElementById('exercises').replaceChildren(...EXERCISES.map((entry) => el('button', {
    type: 'button', class: 'button', text: F.exercises.items[entry.key].label, onclick: () => loadExercise(entry),
  })));
}

function renderToolbar() {
  const toolbar = document.getElementById('flow-toolbar');
  const fileInput = el('input', { type: 'file', accept: '.json,application/json', 'aria-label': F.toolbar.load });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (file) await loadGraphFile(file);
  });
  toolbar.replaceChildren(
    el('button', { type: 'button', class: 'button button--primary', text: F.toolbar.runAll, onclick: () => app.runAll() }),
    el('button', { type: 'button', class: 'button', text: F.toolbar.copySummary, onclick: () => copyToClipboard(flowGraphSummary(state.graph)) }),
    el('button', { type: 'button', class: 'button', text: F.toolbar.copyJson, onclick: () => copyToClipboard(exportJson()) }),
    el('button', { type: 'button', class: 'button', text: F.toolbar.download, onclick: () => downloadGraph() }),
    el('label', { class: 'button button--file', title: F.toolbar.loadHint }, [F.toolbar.load, fileInput]),
    el('span', { class: 'flow-toolbar__spacer' }),
    el('button', { type: 'button', class: 'button', text: F.toolbar.zoomOut, onclick: () => canvas.zoomBy(1 / constants.FLOW_ZOOM_STEP) }),
    el('button', { type: 'button', class: 'button', text: F.toolbar.zoomIn, onclick: () => canvas.zoomBy(constants.FLOW_ZOOM_STEP) }),
    el('button', { type: 'button', class: 'button', text: F.toolbar.fit, onclick: () => canvas.fit() }),
    el('span', { class: 'flow-toolbar__zoom', id: 'flow-zoom-level' }),
    el('button', { type: 'button', class: 'button', id: 'inspector-show', text: F.toolbar.inspector, onclick: () => showInspector(true) }),
  );
}

function showInspector(visible) {
  document.querySelector('.flow-layout').classList.toggle('inspector-hidden', !visible);
  document.getElementById('inspector-show').hidden = visible;
  // The canvas changed width, so the wires must be redrawn where the ports now are.
  canvas.refresh();
}

function renderInspectorPanel() {
  const node = state.selected ? state.graph.nodes.get(state.selected) : null;
  if (!node) state.selected = null;
  renderInspector(document.getElementById('inspector-body'), app, state.selected);
}

// ---------------------------------------------------------------------------
// Presets, sample document, persistence
// ---------------------------------------------------------------------------
async function fetchSample() {
  if (state.sampleText !== null) return state.sampleText;
  try {
    const response = await fetch(constants.SAMPLE_DOCUMENT_PATH);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.sampleText = await response.text();
    return state.sampleText;
  } catch {
    return null;
  }
}

async function loadStandard() {
  const text = (await fetchSample()) || '';
  state.graph = canonicalGraph({ text, question: copy.SAMPLE_QUESTIONS[0].text }).graph;
  app.select(null);
  canvas.renderAll();
  fitWhenLaidOut();
  persist();
  readout(F.readout.presetLoaded);
}

async function loadExercise(entry) {
  const text = (await fetchSample()) || '';
  state.graph = entry.build({ text }).graph;
  app.select(null);
  canvas.renderAll();
  fitWhenLaidOut();
  persist();
  readout(fill(F.exercises.loaded, { label: F.exercises.items[entry.key].label }));
}

// ---------------------------------------------------------------------------
// Export and load
// ---------------------------------------------------------------------------
function exportJson() {
  return JSON.stringify(toJSON(state.graph), null, 2);
}

async function copyToClipboard(text) {
  readout((await copyText(text)) ? F.toolbar.copied : F.toolbar.copyFailed);
}

function downloadGraph() {
  const blob = new Blob([exportJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = el('a', { href: url, download: constants.FLOW_EXPORT_FILENAME });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Replace the canvas with a graph from a file. Every failure becomes one plain sentence. */
async function loadGraphFile(file) {
  let graph;
  try {
    graph = fromJSON(JSON.parse(await file.text()));
  } catch (error) {
    readout(explainLoadError(error && error.code ? error : { code: 'BAD_FORMAT' }));
    return;
  }
  for (const node of graph.nodes.values()) {
    if (node.type === 'document' && node.params.name === constants.SAMPLE_DOCUMENT_NAME && !node.params.text) {
      const text = await fetchSample();
      if (text !== null) node.params.text = text;
    }
  }
  state.graph = graph;
  app.select(null);
  canvas.renderAll();
  fitWhenLaidOut();
  persist();
  readout(fill(F.toolbar.loadedFile, { name: file.name }));
}

function clearCanvas() {
  if (state.graph.nodes.size && !window.confirm(F.toolbar.clearConfirm)) return;
  state.graph = createGraph();
  app.select(null);
  canvas.renderAll();
  canvas.setView({ zoom: 1, pan: { x: 0, y: 0 } });
  persist();
  readout(F.readout.blankLoaded);
}

function persist() {
  saveSession(constants.FLOW_SESSION_STORAGE_KEY, { graph: toJSON(state.graph), view: canvas.getView() });
}

function persistView(view) {
  const saved = loadSession(constants.FLOW_SESSION_STORAGE_KEY);
  if (saved && saved.graph) saveSession(constants.FLOW_SESSION_STORAGE_KEY, { graph: saved.graph, view });
}

/** Restore the saved canvas. Returns false when there is nothing usable to restore. */
async function restore() {
  const saved = loadSession(constants.FLOW_SESSION_STORAGE_KEY);
  if (!saved || !saved.graph) return false;
  let graph;
  try {
    graph = fromJSON(saved.graph);
  } catch {
    return false;
  }
  // The sample document is saved by reference; fetch it back in.
  for (const node of graph.nodes.values()) {
    if (node.type === 'document' && node.params.name === constants.SAMPLE_DOCUMENT_NAME && !node.params.text) {
      const text = await fetchSample();
      if (text !== null) node.params.text = text;
    }
  }
  state.graph = graph;
  canvas.renderAll();
  if (saved.view) canvas.setView(saved.view); else fitWhenLaidOut();
  return true;
}

// On first paint the canvas has not been sized yet, so a fit measured then
// is wrong. Wait for the browser to lay the page out first.
function fitWhenLaidOut() {
  setTimeout(() => canvas.fit(), 0);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
renderChrome();
renderPalette();
renderToolbar();
showInspector(false);
renderInspectorPanel();
if (!(await restore())) await loadStandard();
