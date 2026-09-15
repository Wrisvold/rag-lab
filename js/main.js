// RAG Lab — entry point. Wires copy.js and constants.js to the page.
// Phase 0: renders the header, the stepper, the dials sidebar, and the
// Station 0 shell. Station behaviour arrives in later phases.
//
// All user-facing text comes from js/copy.js. Do not type sentences here.

import * as constants from './constants.js';
import * as copy from './copy.js';

// ---------------------------------------------------------------------------
// Application state (kept deliberately small and plain)
// ---------------------------------------------------------------------------
const state = {
  currentStep: 'document',
  // Which steps are unlocked. Phase 1+ flips these as artifacts are produced.
  completed: { document: false, chunk: false, embed: false, retrieve: false, assemble: false },
  dials: {
    chunkSize: constants.CHUNK_SIZE_DEFAULT,
    chunkOverlap: constants.CHUNK_OVERLAP_DEFAULT,
    topK: constants.TOP_K_DEFAULT,
  },
};

// ---------------------------------------------------------------------------
// Small DOM helpers
// ---------------------------------------------------------------------------
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (value !== null && value !== undefined) node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) continue;
    node.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
}

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
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
function isUnlocked(stepIndex) {
  if (stepIndex === 0) return true;
  const previous = copy.STEPS[stepIndex - 1];
  return state.completed[previous.id] === true;
}

function renderStepper() {
  const list = document.getElementById('stepper');
  list.replaceChildren();
  copy.STEPS.forEach((step, index) => {
    const unlocked = isUnlocked(index);
    const lane = step.lane ? copy.LANES[step.lane] : null;
    const button = el('button', {
      type: 'button',
      class: 'step__button',
      disabled: unlocked ? null : '',
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
    const hint = el('p', {
      class: 'step__hint',
      id: `step-hint-${step.id}`,
      text: unlocked ? '' : copy.UI.lockedPrefix + step.lockedHint,
    });
    list.append(el('li', { class: 'step' }, [button, laneTag, hint]));
  });
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
    number.addEventListener('change', () => { range.value = number.value; onDialChange(spec, Number(number.value)); });

    form.append(el('div', { class: 'dial' }, [
      el('label', { for: id, text: text.label }),
      el('p', { class: 'dial__help', text: text.help }),
      el('div', { class: 'dial__row' }, [range, number]),
      el('p', { class: 'dial__range', text: `${spec.min} – ${spec.max}` }),
    ]));
  }
}

// Validates a dial change and explains problems instead of clamping.
// Phase 1 will also mark downstream artifacts stale from here.
function onDialChange(spec, value) {
  const message = document.getElementById('dials-message');
  message.textContent = '';

  if (!Number.isFinite(value) || value < spec.min || value > spec.max) {
    message.textContent = fill(copy.DIALS.outOfRange, { min: spec.min, max: spec.max });
    return;
  }
  const next = { ...state.dials, [spec.key]: value };
  if (next.chunkOverlap >= next.chunkSize) {
    message.textContent = copy.DIALS.overlapTooLarge;
    return;
  }
  state.dials = next;
  // EXTENSION POINT (Phase 1): invalidate downstream artifacts here.
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
  return el('details', { class: 'explainer', open: '' }, [
    el('summary', { text: copy.EXPLAINER_TITLE }),
    ...paragraphs,
  ]);
}

function renderStation() {
  const panel = document.getElementById('station-panel');
  panel.replaceChildren();
  const step = copy.STEPS.find((s) => s.id === state.currentStep);
  const lane = step.lane ? copy.LANES[step.lane] : null;

  panel.append(el('div', { class: 'station__header' }, [
    el('h2', { text: `${step.number} · ${step.id === 'document' ? copy.STATION_DOCUMENT.heading : step.label}` }),
    lane ? el('span', { class: `lane-tag lane-tag--${step.lane}`, text: lane.label }) : null,
  ]));
  panel.append(renderExplainer(step.id));

  if (step.id === 'document') renderDocumentStation(panel);
  // Phase 1+: chunk, embed, retrieve, assemble, answer stations render here.
}

// Station 0 shell. Behaviour (upload, sample, counts) is wired in Phase 1.
function renderDocumentStation(panel) {
  const text = copy.STATION_DOCUMENT;
  panel.append(
    el('div', { class: 'callout', role: 'note', text: copy.CALLOUTS.privacy }),
    el('textarea', { class: 'document-input', id: 'document-text', placeholder: text.placeholder, 'aria-label': text.heading }),
    el('div', { class: 'toolbar' }, [
      el('label', { class: 'button button--file' }, [
        text.uploadButton,
        el('input', { type: 'file', accept: constants.ACCEPTED_UPLOAD_EXTENSIONS.join(','), 'aria-label': text.uploadButton }),
      ]),
      el('button', { type: 'button', class: 'button', text: text.sampleButton }),
      el('span', { class: 'hint', text: text.uploadHint }),
      el('span', { class: 'toolbar__spacer' }),
      el('span', { class: 'count', id: 'document-count', role: 'status', text: text.emptyCount }),
    ]),
    el('p', { class: 'message--error', id: 'document-message', role: 'alert' }),
    el('button', { type: 'button', class: 'button button--primary', disabled: '', text: text.continueButton }),
  );
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
renderChrome();
renderStepper();
renderDials();
renderStation();
