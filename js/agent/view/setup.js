// Agent mode: the set-up column. The exercises, the decision maker, the
// question, the rule table of the Glass Box agent, the tools with the rules
// in code, the loop settings, and last the system prompt workbench.
//
// Each control calls app.setSetup() (or a workbench action). Every control
// has a fixed id, so main.js can put the focus back on it after a redraw.
//
// Each group ends with one "How to use it, and why" panel that holds the
// entry of each control in the group (see help.js).

import { el, fill } from '../../dom.js';
import { toolSchemas, TOOL_DEFINITIONS, TOOL_NAMES } from '../tools.js';
import { helpPanel, helpGroup, helpEntry } from './help.js';
import { renderWorkbench } from './workbench.js';
import { EXERCISES, exercise } from '../exercises.js';

export function renderSetup(app, container) {
  const T = app.copy.AGENT.setup;
  const s = app.setup;
  if (!app.scenario) { container.replaceChildren(); return; }

  container.replaceChildren(
    exercises(app, s),
    decisionMaker(app, T, s),
    question(app, T, s),
    s.agentKind === 'glass'
      ? ruleTable(app, T, s)
      : group(T.rulesHeading, [el('p', { class: 'hint', text: app.copy.AGENT.blackBox.noRuleTable })]),
    tools(app, T, s),
    loopSettings(app, T, s),
    renderWorkbench(app),
  );
}

// ---------------------------------------------------------------------------

function group(title, children) {
  return el('section', { class: 'agent-group' }, [el('h3', { text: title }), ...children]);
}

function labelled(id, text, control, { inline = false } = {}) {
  control.id = id;
  const label = el('label', { for: id, text });
  return el('div', { class: inline ? 'agent-field agent-field--inline' : 'agent-field' }, inline ? [control, label] : [label, control]);
}

function checkbox(id, text, checked, onChange) {
  const input = el('input', { type: 'checkbox' });
  input.checked = Boolean(checked);
  input.addEventListener('change', () => onChange(input.checked));
  return labelled(id, text, input, { inline: true });
}

// ---------------------------------------------------------------------------

/** The exercise buttons, and the panel of the exercise that is loaded. */
function exercises(app, s) {
  const X = app.copy.AGENT.exercises;
  const buttons = el('div', { class: 'agent-exercises', role: 'group', 'aria-label': X.heading }, EXERCISES.map((entry) => el('button', {
    type: 'button', id: `agent-exercise-${entry.key}`,
    class: `button agent-exercise${s.exercise === entry.key ? ' is-current' : ''}`,
    'aria-pressed': s.exercise === entry.key ? 'true' : 'false',
    text: X.items[entry.key].label, onclick: () => app.loadExercise(entry.key),
  })));

  const entry = exercise(s.exercise);
  const panel = entry ? exercisePanel(app, X, entry) : null;
  return group(X.heading, [el('p', { class: 'hint', text: X.intro }), buttons, panel, helpPanel('exercises')]);
}

function exercisePanel(app, X, entry) {
  const item = X.items[entry.key];
  const black = entry.agentKind === 'black';
  return el('section', { class: 'agent-exercise-panel', 'aria-labelledby': 'agent-exercise-heading' }, [
    el('div', { class: 'agent-exercise-panel__head' }, [
      el('h4', { id: 'agent-exercise-heading', tabindex: '-1', text: item.label }),
      el('p', { class: 'hint', text: fill(X.course, { course: item.course }) }),
    ]),
    el('h5', { text: X.goalHeading }),
    el('p', { text: item.goal }),
    black ? el('p', { class: 'hint', text: X.needsKey }) : null,
    entry.handbook === 'poisoned' ? el('p', { class: 'hint agent-warn', text: X.poisonNote }) : null,
    el('h5', { text: X.stepsHeading }),
    el('ol', { class: 'agent-exercise-steps' }, item.steps.map((step) => el('li', { text: step }))),
    el('p', {}, [el('strong', { text: `${X.lookHeading}. ` }), item.look]),
    el('p', {}, [el('strong', { text: `${X.questionHeading}. ` }), el('span', { class: 'agent-exercise-question', text: item.question })]),
    black ? el('p', { class: 'hint', text: X.modelNote }) : null,
    el('p', { class: 'agent-exercise-why' }, [el('strong', { text: `${X.whyHeading} ` }), item.why]),
    el('button', { type: 'button', class: 'button agent-small', id: 'agent-exercise-close', text: X.close, onclick: () => app.closeExercise() }),
  ]);
}

function decisionMaker(app, T, s) {
  const B = app.copy.AGENT.blackBox;
  const option = (value, name, help) => {
    const radio = el('input', { type: 'radio', name: 'agent-kind', value, id: `agent-kind-${value}`, checked: s.agentKind === value });
    radio.addEventListener('change', () => { if (radio.checked) app.setSetup({ agentKind: value }, { rebuild: true }); });
    return el('label', { class: 'mode-toggle__option', for: radio.id }, [
      radio,
      el('span', { class: 'mode-toggle__name', text: name }),
      el('span', { class: 'mode-toggle__help', text: help }),
    ]);
  };

  const black = [];
  if (s.agentKind === 'black') {
    const providers = app.constants.ANSWER_PROVIDERS;
    const provider = el('select', {}, Object.entries(providers).map(([key, p]) =>
      el('option', { value: key, text: `${p.label} · ${p.note}`, selected: key === s.provider })));
    provider.addEventListener('change', () => app.setSetup({ provider: provider.value }, { rebuild: true }));
    const chosen = providers[s.provider];

    const key = el('input', { type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: B.keyPlaceholder, class: 'agent-key-input' });
    key.value = app.apiKey;
    key.addEventListener('input', () => app.setApiKey(key.value));

    black.push(
      labelled('agent-provider', B.provider, provider),
      el('p', { class: 'hint', text: fill(B.model, { model: app.constants.AGENT_PROVIDERS[s.provider].model }) }),
      labelled('agent-api-key', B.key, key),
      el('p', { class: 'hint', text: fill(B.keyHelp, { provider: chosen.label }) }),
      el('div', { class: 'workbench-actions' }, [
        el('a', { href: chosen.keyHelpUrl, target: '_blank', rel: 'noopener', text: fill(B.keyLink, { provider: chosen.label }) }),
        el('button', { type: 'button', class: 'button agent-small', id: 'agent-forget-key', text: B.forget, onclick: () => app.forgetApiKey() }),
      ]),
      el('p', { class: 'hint', text: B.costNote }),
      checkbox('agent-model-check', B.modelCheck, s.modelCheck, (on) => app.setSetup({ modelCheck: on })),
    );
  }

  return group(T.decisionMakerHeading, [
    el('fieldset', { class: 'mode-toggle agent-kind' }, [
      el('legend', { class: 'visually-hidden', text: T.decisionMakerHeading }),
      option('glass', T.glassBox, T.glassBoxHelp),
      option('black', B.option, B.optionHelp),
    ]),
    ...black,
    helpGroup([
      helpEntry('decisionMaker', T.glassBox),
      helpEntry('blackBox', B.option),
      s.agentKind === 'black' ? helpEntry('modelCheck', B.modelCheck) : null,
    ]),
  ]);
}

function question(app, T, s) {
  const employee = el('select', {}, app.scenario.employees.map((e) =>
    el('option', { value: e.id, text: `${e.id} · ${e.name} · ${e.label}`, selected: e.id === s.employeeId })));
  employee.addEventListener('change', () => app.setSetup({ employeeId: employee.value }));

  const text = el('textarea', { rows: '2', class: 'agent-question' });
  text.value = s.question;
  text.addEventListener('change', () => app.setSetup({ question: text.value }));

  const samples = el('div', { class: 'agent-samples', role: 'group', 'aria-label': T.samples },
    T.sampleQuestions.map((q, i) => el('button', {
      type: 'button', class: 'button agent-sample', text: q, id: `agent-sample-${i}`,
      onclick: () => app.setSetup({ question: q, requestOn: false }, { rebuild: true }),
    })));

  const request = checkbox('agent-request-on', T.requestToggle, s.requestOn, (on) => app.setSetup({ requestOn: on }, { rebuild: true }));
  const dates = [];
  if (s.requestOn) {
    const start = el('input', { type: 'date', value: s.start });
    start.addEventListener('change', () => app.setSetup({ start: start.value }));
    const end = el('input', { type: 'date', value: s.end });
    end.addEventListener('change', () => app.setSetup({ end: end.value }));
    dates.push(el('div', { class: 'agent-dates' }, [labelled('agent-request-start', T.requestStart, start), labelled('agent-request-end', T.requestEnd, end)]));
  }

  return group(T.questionHeading, [
    labelled('agent-employee', T.employee, employee),
    labelled('agent-question', T.questionLabel, text),
    el('p', { class: 'agent-field__label', text: T.samples }),
    samples,
    request,
    ...dates,
    el('p', { class: 'hint', text: fill(T.today, { date: app.scenario.today }) }),
    helpGroup([helpEntry('question', T.questionLabel), helpEntry('request', T.requestToggle)]),
  ]);
}

function ruleTable(app, T, s) {
  // One line per rule: the id, the condition, an arrow, the action. A
  // three-column table does not fit the column without wrapping every cell.
  const table = el('ol', { class: 'agent-rule-list', 'aria-label': T.rulesHeading }, app.copy.AGENT.ruleTable.map((r) => el('li', {}, [
    el('span', { class: 'agent-rule__id', text: r.id }),
    el('span', { class: 'agent-rule__text' }, [
      el('span', { class: 'agent-rule__when', text: r.when }),
      el('span', { class: 'agent-rule__arrow', 'aria-hidden': 'true', text: ' → ' }),
      el('span', { class: 'agent-rule__action', text: r.action }),
    ]),
  ])));

  // The synonym table (rule F1)
  const list = s.synonyms.length
    ? el('ul', { class: 'agent-synonyms' }, s.synonyms.map((pair, i) => el('li', {}, [
      el('span', { text: `${pair.from} → ${pair.to}` }),
      el('button', {
        type: 'button', class: 'button agent-small', text: '×', id: `agent-syn-remove-${i}`,
        'aria-label': fill(T.synonymRemove, { from: pair.from }),
        onclick: () => app.setSetup({ synonyms: s.synonyms.filter((_, j) => j !== i) }, { rebuild: true }),
      }),
    ])))
    : el('p', { class: 'hint', text: T.synonymsEmpty });
  const from = el('input', { type: 'text', size: '10', autocomplete: 'off' });
  const to = el('input', { type: 'text', size: '10', autocomplete: 'off' });
  const add = el('button', {
    type: 'button', class: 'button', text: T.synonymAdd, id: 'agent-syn-add',
    onclick: () => {
      const pair = { from: from.value.trim(), to: to.value.trim() };
      if (!pair.from || !pair.to) return;
      app.setSetup({ synonyms: [...s.synonyms.filter((p) => p.from.toLowerCase() !== pair.from.toLowerCase()), pair] }, { rebuild: true });
    },
  });

  const threshold = el('input', { type: 'number', min: '0', max: '1', step: '0.05', value: String(s.threshold) });
  threshold.addEventListener('change', () => {
    const value = Math.min(1, Math.max(0, Number(threshold.value) || 0));
    app.setSetup({ threshold: value });
  });

  const balance = el('input', { type: 'text', value: s.balanceWords });
  balance.addEventListener('change', () => app.setSetup({ balanceWords: balance.value }));

  return group(T.rulesHeading, [
    table,
    el('h4', { text: T.synonymsHeading }),
    list,
    el('div', { class: 'agent-synonym-add' }, [labelled('agent-syn-from', T.synonymFrom, from), labelled('agent-syn-to', T.synonymTo, to), add]),
    labelled('agent-threshold', T.threshold, threshold),
    el('h4', { text: T.ruleSwitches }),
    checkbox('agent-rule-c3', T.switchC3, s.c3, (on) => app.setSetup({ c3: on })),
    checkbox('agent-rule-f2', T.switchF2, s.f2, (on) => app.setSetup({ f2: on })),
    checkbox('agent-rule-f3', T.switchF3, s.f3, (on) => app.setSetup({ f3: on })),
    labelled('agent-balance-words', T.balanceWords, balance),
    helpGroup([
      helpEntry('synonyms', T.synonymsHeading),
      helpEntry('threshold', T.threshold),
      helpEntry('ruleSwitches', T.ruleSwitches),
      helpEntry('balanceWords', T.balanceWords),
    ]),
  ]);
}

function tools(app, T, s) {
  const W = app.copy.AGENT.workbench;
  const items = TOOL_NAMES.map((name) => {
    const def = TOOL_DEFINITIONS[name];
    const schema = toolSchemas([name])[0];
    return el('li', { class: `agent-tool agent-tool--${def.type}` }, [
      el('div', { class: 'agent-tool__head' }, [
        checkbox(`agent-tool-${name}`, name, s.tools[name], (on) => app.setSetup({ tools: { ...s.tools, [name]: on } })),
        el('span', { class: 'agent-tag', text: T.toolType[def.type] }),
        el('span', { class: 'agent-tag', text: T.toolApproval[def.approval] }),
      ]),
      el('p', { class: 'agent-tool__desc', text: schema.description }),
      el('details', { class: 'agent-tool__schema' }, [
        el('summary', { text: T.toolSchema }),
        el('pre', { text: JSON.stringify(schema, null, 2) }),
      ]),
    ]);
  });

  // The rules in code of submit_vacation_request. Clearing one is for Exercise 4 only.
  const disabled = new Set(s.disabledRules || []);
  const rules = Object.entries(W.ruleInCode).map(([rule, text]) => checkbox(
    `agent-code-rule-${rule}`, text, !disabled.has(rule),
    (on) => app.setSetup({ disabledRules: on ? [...disabled].filter((r) => r !== rule) : [...disabled, rule] }, { rebuild: true }),
  ));

  return group(T.toolsHeading, [
    el('ul', { class: 'agent-tools' }, items),
    el('h4', { text: W.rulesInCodeHeading }),
    ...rules,
    disabled.size ? el('p', { class: 'hint agent-warn', text: W.ruleInCodeOff }) : null,
    helpGroup([helpEntry('tools', T.toolsHeading), helpEntry('ruleInCode', W.rulesInCodeHeading)]),
  ]);
}

function loopSettings(app, T, s) {
  const limit = app.constants.AGENT_HARD_LIMIT;

  const max = el('select', {}, [
    ...Array.from({ length: app.constants.AGENT_MAX_ROUNDS_MAX - app.constants.AGENT_MAX_ROUNDS_MIN + 1 }, (_, i) => {
      const n = app.constants.AGENT_MAX_ROUNDS_MIN + i;
      return el('option', { value: String(n), text: String(n), selected: s.maxRounds === n });
    }),
    el('option', { value: 'none', text: T.noLimit, selected: s.maxRounds === null }),
  ]);
  max.addEventListener('change', () => app.setSetup({ maxRounds: max.value === 'none' ? null : Number(max.value) }, { rebuild: true }));

  const budget = el('input', {
    type: 'number', min: String(app.constants.AGENT_TOKEN_BUDGET_MIN), max: String(app.constants.AGENT_TOKEN_BUDGET_MAX),
    step: '500', value: String(s.tokenBudget ?? app.constants.AGENT_TOKEN_BUDGET_DEFAULT), disabled: s.tokenBudget === null,
  });
  budget.addEventListener('change', () => {
    const value = Math.min(app.constants.AGENT_TOKEN_BUDGET_MAX, Math.max(app.constants.AGENT_TOKEN_BUDGET_MIN, Number(budget.value) || 0));
    app.setSetup({ tokenBudget: value }, { rebuild: true });
  });

  return group(T.loopHeading, [
    labelled('agent-max-rounds', T.maxRounds, max),
    s.maxRounds === null ? el('p', { class: 'hint agent-warn', text: fill(T.noLimitNote, { limit }) }) : null,
    labelled('agent-token-budget', T.tokenBudget, budget),
    checkbox('agent-no-budget', T.budgetNoLimit, s.tokenBudget === null, (on) => app.setSetup({ tokenBudget: on ? null : app.constants.AGENT_TOKEN_BUDGET_DEFAULT }, { rebuild: true })),
    checkbox('agent-repeat-stop', T.repeatStop, s.repeatStop, (on) => app.setSetup({ repeatStop: on })),
    checkbox('agent-keep-two', T.keepLastTwo, s.keepLastTwo, (on) => app.setSetup({ keepLastTwo: on })),
    helpGroup([
      helpEntry('maxRounds', T.maxRounds),
      helpEntry('tokenBudget', T.tokenBudget),
      helpEntry('repeatStop', T.repeatStop),
      helpEntry('keepLastTwo', T.keepLastTwo),
    ]),
  ]);
}
