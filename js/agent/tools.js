// Agent mode: the three tools of the Fall Line agent. Pure, no DOM.
//
// A tool is code that the agent can call. The model only ASKS for a call;
// this file runs it. That is where the hard rules live: a rule here cannot
// be ignored the way a rule in the system prompt can (agent-mode-plan.md,
// Idea 4). Every refusal names the handbook section that caused it.
//
// The HR data is fictional (data/agent-scenario.json). Nothing is sent
// anywhere: an approved vacation request is recorded in memory only.

import { AGENT } from '../copy.js';
import { fill } from '../dom.js';
import { TOP_K_DEFAULT, TOP_K_MAX, AGENT_NOTICE_DAYS, AGENT_SERVICE_DAYS } from '../constants.js';

/**
 * @typedef {'read' | 'read-confidential' | 'write'} ToolType
 * @typedef {{ name: string, type: ToolType, approval: 'none' | 'each-call', sections: string[],
 *             parameters: object, required: string[] }} ToolDefinition
 */

/** @type {Record<string, ToolDefinition>} */
export const TOOL_DEFINITIONS = {
  search_handbook: {
    name: 'search_handbook',
    type: 'read',
    approval: 'none',
    sections: [],
    parameters: {
      query: { type: 'string' },
      top_k: { type: 'integer', minimum: 1, maximum: TOP_K_MAX },
    },
    required: ['query'],
  },
  get_vacation_balance: {
    name: 'get_vacation_balance',
    type: 'read-confidential',
    approval: 'none',
    sections: ['5.2'],
    parameters: { employee_id: { type: 'string' } },
    required: ['employee_id'],
  },
  submit_vacation_request: {
    name: 'submit_vacation_request',
    type: 'write',
    approval: 'each-call',
    sections: ['3.1', '5.2'],
    parameters: {
      employee_id: { type: 'string' },
      start_date: { type: 'string', format: 'date' },
      end_date: { type: 'string', format: 'date' },
    },
    required: ['employee_id', 'start_date', 'end_date'],
  },
};

export const TOOL_NAMES = Object.keys(TOOL_DEFINITIONS);

/**
 * The tool list as a model receives it: name, description, and a JSON
 * schema for the parameters. Only enabled tools are listed; a model cannot
 * call a tool it never sees (Lesson 12: tool loadout).
 */
export function toolSchemas(enabled = TOOL_NAMES) {
  return enabled.map((name) => {
    const def = TOOL_DEFINITIONS[name];
    const text = AGENT.tools[name];
    const properties = {};
    for (const [param, spec] of Object.entries(def.parameters)) {
      properties[param] = { ...spec, description: text.params[param] };
    }
    return {
      name,
      description: text.description,
      parameters: { type: 'object', properties, required: def.required },
    };
  });
}

// ---------------------------------------------------------------------------
// Dates, as whole days in UTC so time zones never move a date
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-11-02" -> a day number, or null when it is not a real date. */
export function dayNumber(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const time = Date.UTC(y, m - 1, d);
  const back = new Date(time);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null;
  return time / DAY_MS;
}

/** Monday to Friday, both ends included. Holidays are not counted out. */
export function workDays(startDay, endDay) {
  let count = 0;
  for (let day = startDay; day <= endDay; day += 1) {
    const weekday = new Date(day * DAY_MS).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

/** "1 day", "7 days", "1 work day": counts with the correct form, from js/copy.js. */
export function countOf(n, unit = 'day') {
  const key = unit === 'work' ? (n === 1 ? 'workDay' : 'workDays') : (n === 1 ? 'day' : 'days');
  return fill(AGENT.rules[key], { n });
}

// ---------------------------------------------------------------------------
// The rules in code
// ---------------------------------------------------------------------------

/**
 * @typedef {{ rule: string, section: string | null, passed: boolean, disabled?: boolean, message: string }} RuleResult
 *
 * @param {string} name   tool name
 * @param {object} args   the arguments the agent asked for
 * @param {{ scenario: object, employeeId: string, disabledRules?: Set<string> | string[] }} env
 * @returns {RuleResult[]}  every rule the tool applies, passed or not
 */
export function checkRules(name, args, env) {
  const disabled = new Set(env.disabledRules || []);
  const results = [];
  const add = (rule, section, passed, message) => {
    if (disabled.has(rule)) results.push({ rule, section, passed: true, disabled: true, message: AGENT.rules.disabled });
    else results.push({ rule, section, passed, message: passed ? AGENT.rules.passed : message });
  };

  if (name === 'get_vacation_balance' || name === 'submit_vacation_request') {
    add('owner', '5.2', args.employee_id === env.employeeId, AGENT.rules.owner);
  }

  if (name === 'submit_vacation_request') {
    const today = dayNumber(env.scenario.today);
    const start = dayNumber(args.start_date);
    const end = dayNumber(args.end_date);
    const datesOk = start !== null && end !== null && end >= start;
    // The dates rule cannot be disabled: without real dates nothing else can be checked.
    results.push({ rule: 'dates', section: null, passed: datesOk, message: datesOk ? AGENT.rules.passed : AGENT.rules.dates });
    if (!datesOk) return results;

    const employee = env.scenario.employees.find((e) => e.id === env.employeeId);
    const notice = start - today;
    add('notice', '3.1', notice >= AGENT_NOTICE_DAYS, fill(AGENT.rules.notice, { days: countOf(AGENT_NOTICE_DAYS), actual: countOf(notice) }));

    const service = start - dayNumber(employee.startDate);
    add('service', '3.1', service >= AGENT_SERVICE_DAYS, fill(AGENT.rules.service, { days: countOf(AGENT_SERVICE_DAYS), actual: countOf(service) }));

    const requested = workDays(start, end);
    add('balance', '3.1', requested <= employee.vacationDaysLeft,
      fill(AGENT.rules.balance, { requested: countOf(requested, 'work'), left: countOf(employee.vacationDaysLeft) }));
  }
  return results;
}

/** True when every rule passed (or was disabled for an exercise). */
export const rulesPass = (results) => results.every((r) => r.passed);

// ---------------------------------------------------------------------------
// Running a tool
// ---------------------------------------------------------------------------

/**
 * Run a tool. Returns { ok: true, data } or, when a rule in code refuses,
 * { ok: false, refused: true, rules }. Throws only when the tool itself is
 * broken (unknown name, no handbook); the loop counts those as failures.
 *
 * Write tools are not approved here. The loop asks a person first and calls
 * runTool only after the approval.
 *
 * @param {{ handbook: object, scenario: object, employeeId: string, disabledRules?: Iterable<string> }} env
 */
export async function runTool(name, args, env) {
  const def = TOOL_DEFINITIONS[name];
  if (!def) throw Object.assign(new Error(`No tool named ${name}`), { code: 'UNKNOWN_TOOL' });
  args = args || {};

  const rules = checkRules(name, args, env);
  if (!rulesPass(rules)) return { ok: false, refused: true, rules };

  switch (name) {
    case 'search_handbook': {
      if (!env.handbook) throw Object.assign(new Error('No handbook loaded'), { code: 'NO_HANDBOOK' });
      const query = String(args.query || '').trim();
      if (!query) throw Object.assign(new Error('Empty query'), { code: 'EMPTY_QUERY' });
      const topK = Number.isInteger(args.top_k) ? Math.min(Math.max(args.top_k, 1), TOP_K_MAX) : TOP_K_DEFAULT;
      return { ok: true, rules, data: await env.handbook.search(query, topK) };
    }
    case 'get_vacation_balance': {
      const employee = env.scenario.employees.find((e) => e.id === args.employee_id);
      return { ok: true, rules, data: { employee_id: employee.id, vacation_days_left: employee.vacationDaysLeft } };
    }
    case 'submit_vacation_request': {
      const days = workDays(dayNumber(args.start_date), dayNumber(args.end_date));
      const request = {
        employee_id: args.employee_id,
        start_date: args.start_date,
        end_date: args.end_date,
        work_days: days,
        status: 'waiting for the manager',
      };
      return { ok: true, rules, data: { recorded: request } };
    }
    default:
      throw Object.assign(new Error(`No tool named ${name}`), { code: 'UNKNOWN_TOOL' });
  }
}
