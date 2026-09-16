// Flow mode — entry point for flow.html. Holds the graph, builds the palette
// and toolbar, mounts the canvas, runs nodes, and keeps the canvas alive
// across a reload. The walkthrough (js/main.js) is untouched by this file.
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
import { mountCanvas } from './canvas.js';

const F = copy.FLOW;

const state = {
  graph: createGraph(),
  busy: false,
  selected: null,
  sampleText: null,   // the sample document, fetched once
};

// ---------------------------------------------------------------------------
// The app object the canvas and the node cards talk to
// ---------------------------------------------------------------------------
const app = {
  copy,
  constants,
  get graph() { return state.graph; },
  get busy() { return state.busy; },

  readout,

  /** Structural change (node, wire, position): persist. Chrome is already updated by the canvas. */
  graphChanged() {
    persist();
  },

  /** A parameter changed on one node: mark it and everything downstream. */
  paramChanged(nodeId) {
    canvas.updateOne(nodeId);
    for (const id of dependents(state.graph, nodeId)) canvas.updateOne(id);
    canvas.refresh();
    persist();
  },

  async runNode(nodeId) {
    if (state.busy) return;
    await withBusy(() => runNode(state.graph, nodeId, runContext(), runHooks()));
  },

  async runAll() {
    if (state.busy) return;
    const runnable = [...state.graph.nodes.values()].some((node) => NODE_TYPES[node.type].runnable !== false);
    if (!runnable) { readout(F.readout.nothingToRun); return; }
    await withBusy(() => runGraph(state.graph, runContext(), runHooks()));
  },

  select(nodeId) {
    state.selected = nodeId;
    renderInspector();
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
async function withBusy(run) {
  state.busy = true;
  canvas.refresh();
  try {
    const report = await run();
    readout(fill(F.readout.ran, {
      ran: report.ran.length,
      fresh: report.fresh.length,
      skipped: report.skipped.filter((entry) => entry.reason !== 'notRunnable').length,
      failed: report.failed.length,
    }));
  } finally {
    state.busy = false;
    canvas.refresh();
  }
}

function runContext() {
  return {
    apiKey: '',
    onProgress: (progress) => {
      const template = progress.stage === 'download' ? F.readout.downloading : F.readout.embedding;
      readout(fill(template, { percent: progress.percent === null || progress.percent === undefined ? 0 : progress.percent }));
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
// Readout (one aria-live line under the canvas)
// ---------------------------------------------------------------------------
function readout(text) {
  const line = document.getElementById('flow-readout');
  // Clear first so the same sentence twice is announced twice.
  line.textContent = '';
  setTimeout(() => { line.textContent = text; }, 30);
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
    document.getElementById('global-status').hidden = true;
  });
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
}

function renderToolbar() {
  const toolbar = document.getElementById('flow-toolbar');
  toolbar.replaceChildren(
    el('button', { type: 'button', class: 'button button--primary', text: F.toolbar.runAll, onclick: () => app.runAll() }),
    el('span', { class: 'flow-toolbar__spacer' }),
    el('button', { type: 'button', class: 'button', text: F.toolbar.zoomOut, 'aria-label': F.toolbar.zoomOut, onclick: () => canvas.zoomBy(1 / constants.FLOW_ZOOM_STEP) }),
    el('button', { type: 'button', class: 'button', text: F.toolbar.zoomIn, 'aria-label': F.toolbar.zoomIn, onclick: () => canvas.zoomBy(constants.FLOW_ZOOM_STEP) }),
    el('button', { type: 'button', class: 'button', text: F.toolbar.fit, onclick: () => canvas.fit() }),
    el('span', { class: 'flow-toolbar__zoom', id: 'flow-zoom-level', 'aria-live': 'off' }),
  );
}

function renderInspector() {
  document.getElementById('inspector-heading').textContent = F.inspector.heading;
  const body = document.getElementById('inspector-body');
  const node = state.selected ? state.graph.nodes.get(state.selected) : null;
  if (!node) {
    body.replaceChildren(el('p', { class: 'inspector-placeholder', text: F.inspector.empty }));
    return;
  }
  body.replaceChildren(
    el('h3', { text: F.nodes[node.type].label }),
    el('p', { text: F.nodes[node.type].hint }),
    el('p', { class: 'inspector-placeholder', text: F.inspector.notYet }),
  );
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
renderInspector();
if (!(await restore())) await loadStandard();
