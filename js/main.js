// RAG Lab — entry point. Holds the application state, renders the stepper and
// the dials, and routes to the station renderers in js/stations/.
//
// All user-facing text comes from js/copy.js. Do not type sentences here.

import * as constants from './constants.js';
import * as copy from './copy.js';
import { el, fill } from './dom.js';
import { chunkText } from './chunker.js';
import { countWords, normalizeNewlines } from './text.js';
import { loadSession, saveSession } from './session.js';
import { renderDocumentStation, updateDocumentStatus } from './stations/document.js';
import { renderChunkStation } from './stations/chunk.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  currentStep: 'document',
  dials: {
    chunkSize: constants.CHUNK_SIZE_DEFAULT,
    chunkOverlap: constants.CHUNK_OVERLAP_DEFAULT,
    topK: constants.TOP_K_DEFAULT,
  },
  // false while a dial holds a value the app refused (out of range, overlap too large)
  dialsValid: true,
  document: { text: '', name: '', words: 0, chars: 0, version: 0 },
  // Artifacts remember the settings and document version they were made
  // from, so "stale" is computed, never guessed.
  artifacts: {
    chunks: null, // { chunks, summary, settings: { chunkSize, chunkOverlap }, documentVersion }
    // Phase 2+: embeddings, retrieval, prompt
  },
};

// Which stations exist in code so far. Others are shown as locked.
const STATION_RENDERERS = {
  document: renderDocumentStation,
  chunk: renderChunkStation,
};

// ---------------------------------------------------------------------------
// Actions shared with the stations (passed as `app`)
// ---------------------------------------------------------------------------
const app = {
  state,
  copy,
  constants,

  setDocument(text, name) {
    const clean = normalizeNewlines(text);
    if (clean === state.document.text && name === state.document.name) return;
    state.document = {
      text: clean,
      name: clean ? name : '',
      words: countWords(clean),
      chars: clean.length,
      version: state.document.version + 1,
    };
    persist();
    app.refreshDocumentStatus();
    renderStepper();
  },

  refreshDocumentStatus() {
    updateDocumentStatus(app);
  },

  /** Runs the chunker on the current document with the current dials. */
  runChunking({ goToStation = true } = {}) {
    if (!state.document.text || !state.dialsValid) return false;
    const settings = { chunkSize: state.dials.chunkSize, chunkOverlap: state.dials.chunkOverlap };
    let result;
    try {
      result = chunkText(state.document.text, settings, constants.SENTENCE_END_CHARS);
    } catch (error) {
      showDialMessage(error.code === 'OVERLAP_TOO_LARGE' ? copy.DIALS.overlapTooLarge : String(error.message));
      return false;
    }
    state.artifacts.chunks = { ...result, settings, documentVersion: state.document.version };
    if (goToStation) showStep('chunk');
    else { renderStepper(); renderStation(); }
    return true;
  },

  /** True when an artifact was made from settings or a document that have since changed. */
  isStale(artifactId) {
    if (artifactId === 'chunks') {
      const artifact = state.artifacts.chunks;
      if (!artifact) return false;
      return artifact.documentVersion !== state.document.version
        || artifact.settings.chunkSize !== state.dials.chunkSize
        || artifact.settings.chunkOverlap !== state.dials.chunkOverlap;
    }
    return false;
  },

  showStep,
};

// ---------------------------------------------------------------------------
// Session persistence (document text and dials survive a reload)
// ---------------------------------------------------------------------------
function persist() {
  saveSession(constants.SESSION_STORAGE_KEY, {
    document: { text: state.document.text, name: state.document.name },
    dials: state.dials,
  });
}

function restore() {
  const saved = loadSession(constants.SESSION_STORAGE_KEY);
  if (!saved) return;
  if (saved.dials) {
    for (const spec of DIAL_SPECS) {
      const value = Number(saved.dials[spec.key]);
      if (Number.isFinite(value) && value >= spec.min && value <= spec.max) state.dials[spec.key] = value;
    }
    if (state.dials.chunkOverlap >= state.dials.chunkSize) state.dials.chunkOverlap = constants.CHUNK_OVERLAP_DEFAULT;
  }
  if (saved.document && typeof saved.document.text === 'string' && saved.document.text) {
    const text = saved.document.text;
    state.document = { text, name: saved.document.name || copy.STATION_DOCUMENT.pastedName, words: countWords(text), chars: text.length, version: 1 };
  }
}

// ---------------------------------------------------------------------------
// Header and footer
// ---------------------------------------------------------------------------
function renderChrome() {
  document.getElementById('app-title').textContent = copy.APP.title;
  document.getElementById('app-subtitle').textContent = copy.APP.subtitle;
  document.getElementById('app-course').textContent = copy.APP.course;
  document.getElementById('app-footer').textContent = copy.UI.footer;
}

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------
// A step is unlocked when the step before it has produced its artifact.
function isUnlocked(stepId) {
  switch (stepId) {
    case 'document': return true;
    case 'chunk': return state.document.chars > 0;
    // Phase 2+: embed needs chunks, retrieve needs embeddings, and so on.
    default: return false;
  }
}

function stepIsStale(stepId) {
  if (stepId === 'chunk') return app.isStale('chunks');
  return false;
}

function renderStepper() {
  const list = document.getElementById('stepper');
  list.replaceChildren();
  for (const step of copy.STEPS) {
    const unlocked = isUnlocked(step.id);
    const built = Boolean(STATION_RENDERERS[step.id]);
    const stale = stepIsStale(step.id);
    const lane = step.lane ? copy.LANES[step.lane] : null;
    const enabled = unlocked && built;

    let hint = '';
    if (!unlocked) hint = copy.UI.lockedPrefix + step.lockedHint;
    else if (!built) hint = copy.UI.notBuilt;
    else if (stale) hint = copy.UI.staleStep;

    const button = el('button', {
      type: 'button',
      class: `step__button${stale ? ' step__button--stale' : ''}`,
      disabled: !enabled,
      'aria-current': state.currentStep === step.id ? 'step' : null,
      'aria-describedby': `step-hint-${step.id}`,
      onclick: () => showStep(step.id),
    }, [
      el('span', { class: 'step__number', 'aria-hidden': 'true', text: String(step.number) }),
      el('span', { class: 'visually-hidden', text: `Step ${step.number}: ` }),
      el('span', { class: 'step__label', text: step.label }),
      step.optional ? el('span', { class: 'step__optional', text: copy.UI.optionalTag }) : null,
    ]);
    const laneTag = el('span', {
      class: `lane-tag ${lane ? `lane-tag--${step.lane}` : 'lane-tag--none'}`,
      title: lane ? lane.name : null,
      text: lane ? lane.label : '·',
    });
    const hintNode = el('p', { class: `step__hint${stale ? ' step__hint--stale' : ''}`, id: `step-hint-${step.id}`, text: hint });
    list.append(el('li', { class: 'step' }, [button, laneTag, hintNode]));
  }
}

function showStep(stepId) {
  state.currentStep = stepId;
  renderStepper();
  renderStation();
  document.getElementById('station-panel').focus({ preventScroll: false });
}

// ---------------------------------------------------------------------------
// Sidebar: the three dials
// ---------------------------------------------------------------------------
const DIAL_SPECS = [
  { key: 'chunkSize', copyKey: 'chunkSize', min: constants.CHUNK_SIZE_MIN, max: constants.CHUNK_SIZE_MAX, step: 10 },
  { key: 'chunkOverlap', copyKey: 'chunkOverlap', min: constants.CHUNK_OVERLAP_MIN, max: constants.CHUNK_OVERLAP_MAX, step: 10 },
  { key: 'topK', copyKey: 'topK', min: constants.TOP_K_MIN, max: constants.TOP_K_MAX, step: 1 },
];

function showDialMessage(text) {
  document.getElementById('dials-message').textContent = text || '';
}

function renderDials() {
  document.getElementById('dials-heading').textContent = copy.DIALS.heading;
  document.getElementById('dials-intro').textContent = copy.DIALS.intro;
  const form = document.getElementById('dials');
  form.replaceChildren();

  for (const spec of DIAL_SPECS) {
    const text = copy.DIALS[spec.copyKey];
    const id = `dial-${spec.key}`;
    const range = el('input', { type: 'range', id: `${id}-range`, min: spec.min, max: spec.max, step: spec.step, value: state.dials[spec.key], 'aria-label': `${text.label} slider` });
    const number = el('input', { type: 'number', id, min: spec.min, max: spec.max, step: spec.step, value: state.dials[spec.key] });

    range.addEventListener('input', () => { number.value = range.value; onDialChange(spec, Number(range.value)); });
    number.addEventListener('input', () => {
      const value = Number(number.value);
      if (value >= spec.min && value <= spec.max) range.value = number.value;
      onDialChange(spec, value);
    });

    form.append(el('div', { class: 'dial' }, [
      el('label', { for: id, text: text.label }),
      el('p', { class: 'dial__help', text: text.help }),
      el('div', { class: 'dial__row' }, [range, number]),
      el('p', { class: 'dial__range', text: `${spec.min} – ${spec.max}` }),
    ]));
  }
}

// Validates a dial change and explains problems instead of clamping.
// A valid change updates state and lets the stations show "stale" notices.
function onDialChange(spec, value) {
  if (!Number.isFinite(value) || value < spec.min || value > spec.max) {
    state.dialsValid = false;
    showDialMessage(fill(copy.DIALS.outOfRange, { min: spec.min, max: spec.max }));
    app.refreshDocumentStatus();
    return;
  }
  const next = { ...state.dials, [spec.key]: value };
  if (next.chunkOverlap >= next.chunkSize) {
    state.dialsValid = false;
    showDialMessage(copy.DIALS.overlapTooLarge);
    app.refreshDocumentStatus();
    return;
  }
  state.dialsValid = true;
  showDialMessage('');
  state.dials = next;
  persist();
  app.refreshDocumentStatus();
  renderStepper();
  // Re-render the station so a now-stale artifact greys out immediately.
  if (state.currentStep !== 'document') renderStation();
}

// ---------------------------------------------------------------------------
// Stations
// ---------------------------------------------------------------------------
function renderExplainer(stepId) {
  const text = copy.EXPLAINERS[stepId];
  const paragraphs = [
    el('p', {}, [el('strong', { text: 'What this step does. ' }), text.what]),
    el('p', {}, [el('strong', { text: 'Why it matters. ' }), text.why]),
  ];
  if (text.cosine) paragraphs.push(el('p', {}, [el('strong', { text: 'About the score. ' }), text.cosine]));
  return el('details', { class: 'explainer', open: true }, [
    el('summary', { text: copy.EXPLAINER_TITLE }),
    ...paragraphs,
  ]);
}

function stationHeading(step) {
  if (step.id === 'document') return copy.STATION_DOCUMENT.heading;
  if (step.id === 'chunk') return copy.STATION_CHUNK.heading;
  return step.label;
}

function renderStation() {
  const panel = document.getElementById('station-panel');
  panel.replaceChildren();
  const step = copy.STEPS.find((s) => s.id === state.currentStep);
  const lane = step.lane ? copy.LANES[step.lane] : null;

  panel.append(el('div', { class: 'station__header' }, [
    el('h2', { text: `${step.number} · ${stationHeading(step)}` }),
    lane ? el('span', { class: `lane-tag lane-tag--${step.lane}`, text: lane.label }) : null,
  ]));
  panel.append(renderExplainer(step.id));

  const render = STATION_RENDERERS[step.id];
  if (render) render(panel, app);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
restore();
renderChrome();
renderStepper();
renderDials();
renderStation();
