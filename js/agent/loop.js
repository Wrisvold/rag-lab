// Agent mode: the loop engine. Pure, no DOM.
//
// An agent runs in a loop. Each round has four parts:
//
//   context  collect what the agent can see (js/agent/context.js)
//   decide   the agent selects one action: a tool call, an answer, or give up
//   act      the system runs the tool. The model never runs a tool itself.
//   check    a SEPARATE checker tests the result (the checker is not the maker)
//
// step() does one part and returns a NEW state and one event; it never
// changes the state it was given, so the page can show every earlier state
// and a test can replay a run. The stop conditions are the point of the
// lesson (agent-mode-plan.md, Idea 2): every way a run can end has a code.

import { buildContext } from './context.js';
import { TOOL_DEFINITIONS, checkRules, rulesPass, runTool } from './tools.js';
import {
  AGENT_MAX_ROUNDS_DEFAULT, AGENT_TOKEN_BUDGET_DEFAULT, AGENT_REPEAT_STOP_DEFAULT,
  AGENT_HARD_LIMIT, AGENT_TOOL_FAILURE_LIMIT,
} from '../constants.js';

export const PARTS = ['context', 'decide', 'act', 'check'];

export const STOP_CODES = [
  'ANSWER_ACCEPTED', 'MAX_ROUNDS', 'HARD_LIMIT', 'NO_PROGRESS', 'BUDGET',
  'GAVE_UP', 'APPROVAL_REFUSED', 'TOOL_FAILED', 'HUMAN_STOP',
];

/**
 * @param {{ question: string, request?: { start_date: string, end_date: string } | null,
 *           employeeId: string, prompt: object, toolNames: string[],
 *           settings?: { maxRounds?: number | null, tokenBudget?: number | null,
 *                        repeatStop?: boolean, keepLastRounds?: number | null, disabledRules?: string[] } }} input
 *   maxRounds and tokenBudget take null for "no limit" (Exercise 1). disabledRules
 *   turns off rules in code for Exercise 4; the run keeps the list, so its summary shows it.
 */
export function createRun({ question, request = null, employeeId, prompt, toolNames, settings = {} }) {
  return {
    question,
    request,
    employeeId,
    prompt,
    toolNames: [...toolNames],
    settings: {
      maxRounds: settings.maxRounds === undefined ? AGENT_MAX_ROUNDS_DEFAULT : settings.maxRounds,
      tokenBudget: settings.tokenBudget === undefined ? AGENT_TOKEN_BUDGET_DEFAULT : settings.tokenBudget,
      repeatStop: settings.repeatStop ?? AGENT_REPEAT_STOP_DEFAULT,
      keepLastRounds: settings.keepLastRounds ?? null,
      disabledRules: [...(settings.disabledRules || [])],
    },
    round: 1,
    part: 'context',
    status: 'running',          // 'running' | 'waiting_for_approval' | 'stopped'
    stopReason: null,
    rounds: [{ number: 1 }],
    tokens: 0,
    failures: 0,
    pending: null,              // the write action that waits for a person
  };
}

// ---------------------------------------------------------------------------
// Small immutable helpers
// ---------------------------------------------------------------------------

function patchRound(state, patch) {
  const rounds = state.rounds.slice();
  rounds[rounds.length - 1] = { ...rounds[rounds.length - 1], ...patch };
  return { ...state, rounds };
}

function stop(state, code) {
  return { ...state, status: 'stopped', part: 'done', stopReason: code, pending: null };
}

const current = (state) => state.rounds[state.rounds.length - 1];

const callKey = (d) => `${d.name}:${JSON.stringify(sortKeys(d.args || {}))}`;
function sortKeys(object) {
  return Object.fromEntries(Object.keys(object).sort().map((k) => [k, object[k]]));
}

/** What the decision maker and the checker are allowed to see. */
function view(state, deps) {
  return {
    question: state.question,
    request: state.request,
    employee: deps.env.scenario.employees.find((e) => e.id === state.employeeId),
    rounds: state.rounds,
    settings: state.settings,
  };
}

function toolEnv(state, deps) {
  const disabledRules = [...(deps.env.disabledRules || []), ...(state.settings.disabledRules || [])];
  return { ...deps.env, employeeId: state.employeeId, disabledRules };
}

// ---------------------------------------------------------------------------
// One part of one round
// ---------------------------------------------------------------------------

/**
 * @param {object} state  from createRun or an earlier step
 * @param {{ agent: { decide(view): Promise<object> | object, check(round, view): object },
 *           env: { handbook: object, scenario: object, disabledRules?: Iterable<string> } }} deps
 * @returns {Promise<{ state: object, event: object }>}
 */
export async function step(state, deps) {
  if (state.status === 'stopped') return { state, event: { type: 'stopped', code: state.stopReason } };
  if (state.status === 'waiting_for_approval') return { state, event: { type: 'waiting', round: state.round } };

  const round = state.round;
  switch (state.part) {
    case 'context': {
      const finished = state.rounds.slice(0, -1);
      const context = buildContext({
        prompt: state.prompt,
        toolNames: state.toolNames,
        question: state.question,
        request: state.request,
        employee: view(state, deps).employee,
        rounds: finished,
        keepLastRounds: state.settings.keepLastRounds,
      });
      let next = patchRound({ ...state, tokens: state.tokens + context.total }, { context, tokensBefore: state.tokens });
      const event = { type: 'context', round, tokens: context.total, total: next.tokens };
      if (state.settings.tokenBudget !== null && next.tokens > state.settings.tokenBudget) {
        next = stop(next, 'BUDGET');
        return { state: next, event: { ...event, stop: 'BUDGET' } };
      }
      return { state: { ...next, part: 'decide' }, event };
    }

    case 'decide': {
      const decision = await deps.agent.decide(view(state, deps));
      let next = patchRound(state, { decision });
      const event = { type: 'decide', round, decision };
      if (decision.type === 'tool' && state.settings.repeatStop) {
        const key = callKey(decision);
        const repeated = state.rounds.slice(0, -1).some((r) => r.decision && r.decision.type === 'tool' && callKey(r.decision) === key);
        if (repeated) {
          next = stop(next, 'NO_PROGRESS');
          return { state: next, event: { ...event, stop: 'NO_PROGRESS' } };
        }
      }
      return { state: { ...next, part: 'act' }, event };
    }

    case 'act': {
      const decision = current(state).decision;
      if (decision.type !== 'tool') {
        // An answer or a give-up: nothing to run. The check part still tests it.
        const next = patchRound(state, { act: { kind: 'deliver' } });
        return { state: { ...next, part: 'check' }, event: { type: 'act', round, kind: 'deliver' } };
      }

      const def = TOOL_DEFINITIONS[decision.name];
      if (def && def.approval === 'each-call') {
        // Rules in code run BEFORE a person is asked: a request that breaks a
        // rule is refused by the system, and no one is asked to approve it.
        const rules = checkRules(decision.name, decision.args || {}, toolEnv(state, deps));
        if (!rulesPass(rules)) {
          const next = patchRound(state, { act: { kind: 'tool', result: { ok: false, refused: true, rules } } });
          return { state: { ...next, part: 'check' }, event: { type: 'act', round, kind: 'refused-by-rule', rules } };
        }
        const next = { ...state, status: 'waiting_for_approval', pending: { decision, rules } };
        return { state: next, event: { type: 'approval_needed', round, decision, rules } };
      }

      return runAndRecord(state, deps, decision);
    }

    case 'check': {
      const record = current(state);
      const check = deps.agent.check(record, view(state, deps));
      let next = patchRound(state, { check });
      const event = { type: 'check', round, check };

      if (record.decision.type === 'answer' && check.passed) return { state: stop(next, 'ANSWER_ACCEPTED'), event: { ...event, stop: 'ANSWER_ACCEPTED' } };
      if (record.decision.type === 'give_up') return { state: stop(next, 'GAVE_UP'), event: { ...event, stop: 'GAVE_UP' } };

      const { maxRounds } = state.settings;
      if (maxRounds !== null && round >= maxRounds) return { state: stop(next, 'MAX_ROUNDS'), event: { ...event, stop: 'MAX_ROUNDS' } };
      if (round >= AGENT_HARD_LIMIT) return { state: stop(next, 'HARD_LIMIT'), event: { ...event, stop: 'HARD_LIMIT' } };

      next = { ...next, round: round + 1, part: 'context', rounds: [...next.rounds, { number: round + 1 }] };
      return { state: next, event };
    }

    default:
      throw new Error(`Unknown part: ${state.part}`);
  }
}

async function runAndRecord(state, deps, decision, approval = null) {
  const round = state.round;
  let result;
  let failures = state.failures;
  try {
    result = await runTool(decision.name, decision.args || {}, toolEnv(state, deps));
  } catch (error) {
    failures += 1;
    result = { ok: false, error: error.message, code: error.code || 'TOOL_ERROR' };
  }
  let next = patchRound({ ...state, failures, status: 'running', pending: null }, { act: { kind: 'tool', result }, ...(approval ? { approval } : {}) });
  const event = { type: 'act', round, kind: 'tool', toolName: decision.name, result };
  if (result.error && failures >= AGENT_TOOL_FAILURE_LIMIT) {
    next = stop(next, 'TOOL_FAILED');
    return { state: next, event: { ...event, stop: 'TOOL_FAILED' } };
  }
  return { state: { ...next, part: 'check' }, event };
}

// ---------------------------------------------------------------------------
// A person's actions
// ---------------------------------------------------------------------------

/** The person approves the waiting write action. The tool runs now. */
export async function approve(state, deps) {
  if (state.status !== 'waiting_for_approval') return { state, event: { type: 'nothing_to_approve' } };
  return runAndRecord(state, deps, state.pending.decision, { status: 'approved' });
}

/** The person refuses the waiting write action. The tool does not run, and the run stops. */
export function refuse(state) {
  if (state.status !== 'waiting_for_approval') return { state, event: { type: 'nothing_to_approve' } };
  const next = patchRound(state, { approval: { status: 'refused' }, act: { kind: 'refused-by-person' } });
  return { state: stop(next, 'APPROVAL_REFUSED'), event: { type: 'refused', round: state.round, stop: 'APPROVAL_REFUSED' } };
}

/** The person stops the run. */
export function stopRun(state) {
  if (state.status === 'stopped') return { state, event: { type: 'stopped', code: state.stopReason } };
  return { state: stop(state, 'HUMAN_STOP'), event: { type: 'stopped', round: state.round, stop: 'HUMAN_STOP' } };
}

// ---------------------------------------------------------------------------
// Several parts at a time
// ---------------------------------------------------------------------------

/** The rest of the current round. Stops early at a stop or an approval. */
export async function runRound(state, deps, onEvent = () => {}) {
  const start = state.round;
  let next = state;
  while (next.status === 'running' && next.round === start) {
    const result = await step(next, deps);
    next = result.state;
    onEvent(result.event, next);
  }
  return next;
}

/** Rounds until the run stops or waits for a person. */
export async function runToEnd(state, deps, onEvent = () => {}) {
  let next = state;
  while (next.status === 'running') {
    const result = await step(next, deps);
    next = result.state;
    onEvent(result.event, next);
  }
  return next;
}
