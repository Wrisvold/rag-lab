// Agent mode — entry point for agent.html. Holds the set-up and the run,
// drives the loop engine (js/agent/loop.js) one part at a time, and asks the
// three views to draw: the set-up, the loop, and the inspector.
//
// All user-facing text comes from js/copy.js (AGENT block). Do not type sentences here.

import * as constants from '../constants.js';
import * as copy from '../copy.js';
import { loadSession, saveSession } from '../session.js';
import { copyText } from '../clipboard.js';
import { createHandbook } from './handbook.js';
import { createGlassBoxAgent } from './glassBoxAgent.js';
import { createRun, step, approve, refuse, stopRun } from './loop.js';
import { defaultPrompt } from './context.js';
import { TOOL_NAMES } from './tools.js';
import { formatAgentRunSummary } from './summary.js';
import { describeEvent } from './describe.js';
import { renderSetup } from './view/setup.js';
import { renderLoop } from './view/loop.js';
import { renderInspector } from './view/inspector.js';

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
  };
}

const state = {
  setup: { ...defaultSetup(), ...(loadSession(constants.AGENT_SESSION_STORAGE_KEY) || {}) },
  handbook: null,
  scenario: null,
  run: null,
  selectedRound: null,
  busy: false,
  lastApprovalRound: null,   // so focus moves to the approval panel only once
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

  /**
   * Change the set-up. Any change clears the run, because a run belongs to
   * one set-up. `rebuild` redraws the set-up column (for changes that add or
   * remove controls); typing in a field does not, so the cursor stays.
   */
  setSetup(patch, { rebuild = false } = {}) {
    state.setup = { ...state.setup, ...patch };
    saveSession(constants.AGENT_SESSION_STORAGE_KEY, state.setup);
    if (state.run) {
      state.run = null;
      state.selectedRound = null;
      readout(A.readout.setupChanged);
    }
    if (rebuild) drawSetup();
    drawLoop();
    drawInspector();
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
    prompt: defaultPrompt(),
    toolNames: TOOL_NAMES.filter((name) => s.tools[name]),
    settings: {
      maxRounds: s.maxRounds,
      tokenBudget: s.tokenBudget,
      repeatStop: s.repeatStop,
      keepLastRounds: s.keepLastTwo ? 2 : null,
    },
  });
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

function drawSetup() {
  renderSetup(app, document.getElementById('agent-setup'));
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
