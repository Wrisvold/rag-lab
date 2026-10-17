// Agent mode — entry point for agent.html. Holds the set-up and the run,
// drives the loop engine (js/agent/loop.js) one part at a time, and asks the
// three views to draw: the set-up, the loop, and the inspector.
//
// All user-facing text comes from js/copy.js (AGENT block). Do not type sentences here.

import * as constants from '../constants.js';
import * as copy from '../copy.js';
import { loadSession, saveSession } from '../session.js';
import { copyText } from '../clipboard.js';
import { fill } from '../dom.js';
import { createHandbook } from './handbook.js';
import { createGlassBoxAgent } from './glassBoxAgent.js';
import { createRun, step, approve, refuse, stopRun } from './loop.js';
import { TOOL_NAMES } from './tools.js';
import { formatAgentRunSummary } from './summary.js';
import { describeEvent } from './describe.js';
import { renderSetup } from './view/setup.js';
import { renderLoop } from './view/loop.js';
import { renderInspector } from './view/inspector.js';
import { renderCompare } from './view/compare.js';
import {
  createPromptStore, editSection, saveVersion, useVersion, promptForRun, matchingVersion, checkPrompt,
  exportPrompts, importPrompts,
} from './prompt.js';

const A = copy.AGENT;

function defaultSetup() {
  return {
    agentKind: 'glass',
    employeeId: 'E-101',
    question: A.setup.sampleQuestions[0],
    requestOn: false,
    start: '',
    end: '',
    synonyms: [],                      // [{ from: 'PTO', to: 'vacation' }]
    threshold: constants.AGENT_GLASS_SCORE_THRESHOLD,
    c3: true,
    f2: true,
    f3: true,
    balanceWords: constants.AGENT_GLASS_BALANCE_WORDS.join(', '),
    tools: Object.fromEntries(TOOL_NAMES.map((name) => [name, true])),
    maxRounds: constants.AGENT_MAX_ROUNDS_DEFAULT,   // null: no limit
    tokenBudget: constants.AGENT_TOKEN_BUDGET_DEFAULT, // null: no limit
    repeatStop: constants.AGENT_REPEAT_STOP_DEFAULT,
    keepLastTwo: false,
    disabledRules: [],                 // rules in code turned off (Exercise 4 only)
  };
}

function loadPrompts() {
  const saved = loadSession(constants.AGENT_PROMPTS_SESSION_KEY);
  if (saved && Array.isArray(saved.versions) && saved.versions.length && saved.working) return saved;
  return createPromptStore();
}

const state = {
  setup: { ...defaultSetup(), ...(loadSession(constants.AGENT_SESSION_STORAGE_KEY) || {}) },
  handbook: null,
  scenario: null,
  run: null,
  selectedRound: null,
  busy: false,
  lastApprovalRound: null,   // so focus moves to the approval panel only once
  prompts: loadPrompts(),    // the system prompt workbench: saved versions and the working copy
  history: [],               // finished runs, for the compare view (this visit only)
  runId: 0,
  recordedRunId: null,
  ui: { saveOpen: false, saveMessage: '', findings: null, compare: null },
};

const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// The object the views talk to
// ---------------------------------------------------------------------------
const app = {
  copy,
  constants,
  get setup() { return state.setup; },
  get run() { return state.run; },
  get scenario() { return state.scenario; },
  get busy() { return state.busy; },
  get selectedRound() { return state.selectedRound; },
  get prompts() { return state.prompts; },
  get ui() { return state.ui; },

  /** The newest finished run of a prompt version for a question, or null. */
  lastRunFor(version, question) {
    for (let i = state.history.length - 1; i >= 0; i -= 1) {
      const run = state.history[i];
      if (run.promptVersion === version && run.question === question.trim()) return run;
    }
    return null;
  },

  /**
   * Change the set-up. Any change clears the run, because a run belongs to
   * one set-up. `rebuild` redraws the set-up column (for changes that add or
   * remove controls); typing in a field does not, so the cursor stays.
   */
  setSetup(patch, { rebuild = false } = {}) {
    state.setup = { ...state.setup, ...patch };
    saveSession(constants.AGENT_SESSION_STORAGE_KEY, state.setup);
    invalidateRun();
    if (rebuild) drawSetup();
    drawLoop();
    drawInspector();
    drawCompare();
  },

  // ---- The system prompt workbench ----
  editPromptSection(id, patch) {
    setPrompts(editSection(state.prompts, id, patch));
    state.ui.findings = null;
  },

  toggleSave(open) {
    state.ui.saveOpen = open;
    state.ui.saveMessage = '';
    drawSetup();
    const target = document.getElementById(open ? 'agent-save-name' : 'agent-save-open');
    if (target) target.focus();
  },

  savePromptVersion(note) {
    const result = saveVersion(state.prompts, note);
    if (!result.ok) {
      const match = matchingVersion(state.prompts);
      state.ui.saveMessage = result.code === 'NO_CHANGE'
        ? fill(A.workbench.noChange, { version: match ? match.version : 'v1' })
        : A.workbench.noteRequired;
      // Keep what the student typed: redraw, then put the values back.
      drawSetup();
      document.getElementById('agent-save-name').value = note.name || '';
      document.getElementById('agent-save-what').value = note.what || '';
      document.getElementById('agent-save-why').value = note.why || '';
      document.getElementById(result.code === 'NOTE_REQUIRED' ? 'agent-save-what' : 'agent-save-cancel').focus();
      return;
    }
    state.ui.saveOpen = false;
    state.ui.saveMessage = '';
    setPrompts(result.store);
    readout(fill(A.workbench.saved, { version: result.version }));
    const target = document.getElementById('agent-save-open');
    if (target) target.focus();
  },

  usePromptVersion(version) {
    setPrompts(useVersion(state.prompts, version));
    state.ui.findings = null;
    readout(fill(A.workbench.useDone, { version }));
  },

  checkPrompt() {
    state.ui.findings = checkPrompt(state.prompts.working);
    drawSetup();
    readout(state.ui.findings.length ? fill(A.workbench.checkFound, { count: state.ui.findings.length }) : A.workbench.checkClean);
  },

  downloadPrompts() {
    const blob = new Blob([JSON.stringify(exportPrompts(state.prompts), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = constants.AGENT_PROMPTS_FILENAME;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  async loadPromptsFile(file) {
    let result;
    try {
      result = importPrompts(JSON.parse(await file.text()));
    } catch {
      result = { ok: false, code: 'BAD_FORMAT' };
    }
    if (!result.ok) {
      readout(result.code === 'BAD_VERSION' ? A.workbench.loadBadVersion : A.workbench.loadBadFormat);
      return;
    }
    state.ui.compare = null;
    setPrompts(result.store);
    readout(fill(A.workbench.loaded, { count: result.store.versions.length, name: file.name }));
  },

  openCompare() {
    const versions = state.prompts.versions;
    state.ui.compare = { a: versions[Math.max(0, versions.length - 2)].version, b: versions[versions.length - 1].version };
    drawCompare();
    document.getElementById('agent-compare-heading').focus();
  },

  setCompare(patch) {
    state.ui.compare = { ...state.ui.compare, ...patch };
    const id = document.activeElement && document.activeElement.id;
    drawCompare();
    if (id && document.getElementById(id)) document.getElementById(id).focus();
  },

  closeCompare() {
    state.ui.compare = null;
    drawCompare();
    const target = document.getElementById('agent-compare-open');
    if (target) target.focus();
  },


  selectRound(number) {
    state.selectedRound = number;
    drawLoop();
    drawInspector();
  },

  doStep: () => guarded(async () => {
    if (!ensureRun()) return;
    if (state.run.status === 'waiting_for_approval') { readout(A.readout.waiting); return; }
    const event = await advance();
    readout(describeEvent(event));
  }),

  runRound: () => guarded(async () => {
    if (!ensureRun()) return;
    const start = state.run.round;
    let event;
    while (state.run.status === 'running' && state.run.round === start) {
      event = await advance();
      if (state.run.status === 'running' && !reducedMotion()) await pause(constants.AGENT_RUN_PAUSE_MS);
    }
    const ended = state.run.round !== start ? ` ${fillRound(A.readout.roundEnded, start)}` : '';
    if (event) readout(describeEvent(event) + ended);
  }),

  runToEnd: () => guarded(async () => {
    if (!ensureRun()) return;
    let event;
    while (state.run.status === 'running') {
      event = await advance();
      if (state.run.status === 'running' && !reducedMotion()) await pause(constants.AGENT_RUN_PAUSE_MS);
    }
    if (event) readout(describeEvent(event));
  }),

  stopRun() {
    if (!state.run || state.busy) return;
    const result = stopRun(state.run);
    state.run = result.state;
    readout(describeEvent(result.event));
    recordIfStopped();
    drawLoop();
  },

  reset() {
    if (state.busy) return;
    state.run = null;
    state.selectedRound = null;
    state.lastApprovalRound = null;
    readout(A.readout.reset);
    drawLoop();
    drawInspector();
  },

  approve: () => guarded(async () => {
    if (!state.run || state.run.status !== 'waiting_for_approval') return;
    const result = await approve(state.run, deps());
    state.run = result.state;
    readout(`${A.readout.approved} ${describeEvent(result.event)}`);
    document.getElementById('agent-loop').focus();
  }),

  refuse() {
    if (!state.run || state.run.status !== 'waiting_for_approval' || state.busy) return;
    const result = refuse(state.run);
    state.run = result.state;
    readout(describeEvent(result.event));
    recordIfStopped();
    drawLoop();
    document.getElementById('agent-loop').focus();
  },

  async copySummary() {
    if (!state.run) return;
    const text = formatAgentRunSummary(state.run, { scenario: state.scenario, agentKind: state.setup.agentKind });
    readout((await copyText(text)) ? A.loop.copied : A.loop.copyFailed);
  },

  /** The approval panel calls this after it draws, so focus moves there one time per request. */
  approvalShown(round) {
    if (state.lastApprovalRound === round) return false;
    state.lastApprovalRound = round;
    return true;
  },
};

const fillRound = (template, round) => template.replace('{round}', String(round));

/** Any change to the set-up or the prompt clears the run: a run belongs to one set-up. */
function invalidateRun() {
  if (!state.run) return;
  state.run = null;
  state.selectedRound = null;
  readout(A.readout.setupChanged);
}

/** Keep the prompt store, clear the run, and redraw. */
function setPrompts(store) {
  state.prompts = store;
  saveSession(constants.AGENT_PROMPTS_SESSION_KEY, state.prompts);
  invalidateRun();
  drawSetup();
  drawLoop();
  drawInspector();
  drawCompare();
}

/** When a run stops, keep its summary for the compare view. */
function recordIfStopped() {
  const run = state.run;
  if (!run || run.status !== 'stopped' || state.recordedRunId === state.runId) return;
  state.recordedRunId = state.runId;
  state.history.push({
    runId: state.runId,
    promptVersion: run.prompt.version,
    question: run.question.trim(),
    agentKind: state.setup.agentKind,
    stopReason: run.stopReason,
    rounds: run.rounds.filter((r) => r.decision).length,
    tokens: run.tokens,
    summary: formatAgentRunSummary(run, { scenario: state.scenario, agentKind: state.setup.agentKind }),
  });
  drawCompare();
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------
async function guarded(action) {
  if (state.busy || !state.handbook) return;
  state.busy = true;
  drawLoop();
  try {
    await action();
  } finally {
    state.busy = false;
    recordIfStopped();
    drawLoop();
    drawInspector();
  }
}

/** Create the run from the set-up when there is none. False when the set-up cannot start a run. */
function ensureRun() {
  if (state.run) return true;
  const s = state.setup;
  if (!s.question.trim() && !s.requestOn) {
    readout(A.readout.noQuestion);
    return false;
  }
  state.run = createRun({
    question: s.question.trim() || A.setup.requestToggle,
    request: s.requestOn ? { start_date: s.start, end_date: s.end } : null,
    employeeId: s.employeeId,
    prompt: promptForRun(state.prompts),
    toolNames: TOOL_NAMES.filter((name) => s.tools[name]),
    settings: {
      maxRounds: s.maxRounds,
      tokenBudget: s.tokenBudget,
      repeatStop: s.repeatStop,
      keepLastRounds: s.keepLastTwo ? 2 : null,
      disabledRules: s.disabledRules || [],
    },
  });
  state.runId += 1;
  state.selectedRound = null;
  state.lastApprovalRound = null;
  return true;
}

function deps() {
  const s = state.setup;
  const agent = createGlassBoxAgent({
    handbook: state.handbook,
    synonyms: Object.fromEntries(s.synonyms.map((pair) => [pair.from, pair.to])),
    scoreThreshold: Number(s.threshold),
    c3: s.c3,
    f2: s.f2,
    f3: s.f3,
    balanceWords: s.balanceWords.split(',').map((w) => w.trim()).filter(Boolean),
  });
  return { agent, env: { handbook: state.handbook, scenario: state.scenario } };
}

/** One part of one round. The inspector follows the newest context. */
async function advance() {
  const { state: next, event } = await step(state.run, deps());
  state.run = next;
  if (event.type === 'context') state.selectedRound = event.round;
  drawLoop();
  drawInspector();
  return event;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------
function readout(text) {
  const line = document.getElementById('agent-readout');
  // Clear first so the same sentence twice is announced twice.
  line.textContent = '';
  setTimeout(() => { line.textContent = text; }, 30);
}

// A redraw removes the focused field. The browser then sends that field's
// "change" event, and its handler asks for a redraw inside this one. So: send
// the change first (blur), let the nested request only mark a second redraw,
// and draw from the newest state.
let drawingSetup = false;
let setupAgain = false;

function drawSetup() {
  if (drawingSetup) { setupAgain = true; return; }
  drawingSetup = true;
  try {
    const container = document.getElementById('agent-setup');
    const active = document.activeElement;
    const id = active && container.contains(active) ? active.id : null;
    if (id) active.blur();
    renderSetup(app, container);
    // Put the focus back on the same control: every control has a fixed id.
    if (id && document.getElementById(id)) document.getElementById(id).focus();
  } finally {
    drawingSetup = false;
  }
  if (setupAgain) {
    setupAgain = false;
    drawSetup();
  }
}

function drawCompare() {
  renderCompare(app, document.getElementById('agent-compare'));
}

function drawLoop() {
  renderLoop(app, {
    diagram: document.getElementById('agent-diagram'),
    controls: document.getElementById('agent-controls'),
    stop: document.getElementById('agent-stop'),
    approval: document.getElementById('agent-approval'),
    rounds: document.getElementById('agent-rounds'),
  });
}

function drawInspector() {
  renderInspector(app, document.getElementById('agent-inspector'));
}

function renderChrome() {
  document.title = A.page.title;
  document.getElementById('app-title').textContent = copy.APP.title;
  document.getElementById('app-subtitle').textContent = A.page.subtitle;
  document.getElementById('app-course').textContent = copy.APP.course;
  document.getElementById('app-footer').textContent = copy.UI.footer;
  document.getElementById('mode-walkthrough').textContent = copy.MODES.walkthrough;
  document.getElementById('mode-flow').textContent = copy.MODES.flow;
  document.getElementById('mode-agent').textContent = copy.MODES.agent;
  document.getElementById('agent-skip').textContent = A.page.skip;
  document.getElementById('setup-heading').textContent = A.page.setupHeading;
  document.getElementById('loop-heading').textContent = A.page.loopHeading;
  document.getElementById('inspector-heading').textContent = A.page.inspectorHeading;
}

function showNotice(text) {
  const notice = document.getElementById('agent-notice');
  notice.textContent = text;
  notice.hidden = !text;
}

async function loadData() {
  showNotice(A.page.loading);
  try {
    const [text, scenario] = await Promise.all([
      fetch(constants.SAMPLE_DOCUMENT_PATH).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); }),
      fetch(constants.AGENT_SCENARIO_PATH).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    ]);
    state.handbook = createHandbook(text.replace(/\r\n?/g, '\n'));
    state.scenario = scenario;
    showNotice('');
  } catch (error) {
    console.warn('RAG Lab: Agent mode could not load its data:', error);
    showNotice(A.page.loadFailed);
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
renderChrome();
await loadData();
drawSetup();
drawLoop();
drawInspector();
drawCompare();
