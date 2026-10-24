// Agent mode: the six exercises (agent-mode-plan.md, Section 13). Pure, no DOM.
//
// Each exercise is a set-up and a goal. Loading one changes the set-up of the
// page; the student then does the steps with the normal controls. The text
// of each exercise lives in js/copy.js (AGENT.exercises.items).
//
// Extension point: a new exercise is a new entry in EXERCISES plus its text
// in AGENT.exercises.items. tests/agent/exercises.test.js checks both.

import { AGENT } from '../copy.js';

/** A date `days` after an ISO date, as an ISO date. */
export function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * A request that starts 7 days after the simulated date: it breaks the
 * notice rule of Section 3.1 (14 days). Monday to Friday, 5 work days.
 */
const shortNotice = (scenario) => ({
  requestOn: true,
  question: AGENT.exercises.requestQuestion,
  start: addDays(scenario.today, 7),
  end: addDays(scenario.today, 11),
});

/**
 * key        the key of the text in AGENT.exercises.items
 * agentKind  'glass' or 'black' (a Black Box exercise needs a key)
 * setup      the changes to the default set-up
 * promptV1   use the default system prompt (v1) as the working copy (Exercises 3 and 4)
 * handbook   'poisoned' adds AGENT.exercises.poison to Section 3.1
 */
export const EXERCISES = [
  {
    key: 'loop',
    agentKind: 'glass',
    setup: () => ({
      employeeId: 'E-101',
      question: AGENT.setup.sampleQuestions[0],
      threshold: 0.9,       // no passage reaches it, so rule C2 always fails
      f3: false,            // the agent cannot say "the handbook does not answer"
      maxRounds: null,
      tokenBudget: null,
      repeatStop: false,
    }),
  },
  {
    key: 'pto',
    agentKind: 'glass',
    setup: () => ({ employeeId: 'E-101', question: AGENT.setup.sampleQuestions[0], synonyms: [] }),
  },
  {
    key: 'sections',
    agentKind: 'black',
    promptV1: true,
    setup: () => ({ employeeId: 'E-101', question: AGENT.setup.sampleQuestions[0] }),
  },
  {
    key: 'ruleInPrompt',
    agentKind: 'black',
    promptV1: true,   // the student starts from the default prompt, then removes its notice sentence
    setup: (scenario) => ({ employeeId: 'E-103', ...shortNotice(scenario), disabledRules: ['notice'] }),
  },
  {
    key: 'plan',
    agentKind: 'black',
    setup: () => ({ employeeId: 'E-102', question: AGENT.exercises.planQuestion }),
  },
  {
    key: 'poison',
    agentKind: 'black',
    handbook: 'poisoned',
    setup: (scenario) => ({ employeeId: 'E-103', ...shortNotice(scenario) }),
  },
];

export function exercise(key) {
  return EXERCISES.find((entry) => entry.key === key) || null;
}

/**
 * The set-up of an exercise: the defaults, then the exercise. The provider
 * stays, so a student with a key does not select it again.
 */
export function exerciseSetup(entry, defaults, scenario, current = {}) {
  return {
    ...defaults,
    provider: current.provider || defaults.provider,
    agentKind: entry.agentKind,
    ...entry.setup(scenario),
    exercise: entry.key,
  };
}

/**
 * The handbook text with the poisoned paragraph at the end of Section 3.1,
 * so that a search for vacation finds it. The text of the other sections
 * does not change.
 */
export function poisonHandbook(text) {
  const next = text.search(/\n\s*3\.2 /);
  if (next < 0) throw new Error('Section 3.2 not found in the handbook');
  return `${text.slice(0, next).replace(/\s+$/, '')} ${AGENT.exercises.poison}${text.slice(next)}`;
}
