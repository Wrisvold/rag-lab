// Agent mode: the set-up column. The decision maker, the question, the rule
// table of the Glass Box agent, the tools, and the loop settings.
//
// Each control calls app.setSetup(). Typing in a field does not redraw this
// column (so the cursor stays); adding or removing controls does.

import { el, fill } from '../../dom.js';
import { toolSchemas, TOOL_DEFINITIONS, TOOL_NAMES } from '../tools.js';
import { helpPanel } from './help.js';

let uid = 0;
const id = (name) => `agent-${name}-${++uid}`;

export function renderSetup(app, container) {
  const T = app.copy.AGENT.setup;
  const s = app.setup;
  if (!app.scenario) { container.replaceChildren(); return; }

  container.replaceChildren(
    decisionMaker(app, T),
    question(app, T, s),
    ruleTable(app, T, s),
    tools(app, T, s),
    loopSettings(app, T, s),
  );
}

// ---------------------------------------------------------------------------

function group(title, children) {
  return el('section', { class: 'agent-group' }, [el('h3', { text: title }), ...children]);
}

function labelled(text, control, { inline = false } = {}) {
  control.id = control.id || id('field');
  const label = el('label', { for: control.id, text });
  return el('div', { class: inline ? 'agent-field agent-field--inline' : 'agent-field' }, inline ? [control, label] : [label, control]);
}

function checkbox(text, checked, onChange) {
  const input = el('input', { type: 'checkbox' });
  input.checked = Boolean(checked);
  input.addEventListener('change', () => onChange(input.checked));
  return labelled(text, input, { inline: true });
}

// ---------------------------------------------------------------------------

function decisionMaker(app, T) {
  const radio = el('input', { type: 'radio', name: 'agent-kind', value: 'glass', checked: true });
  return group(T.decisionMakerHeading, [
    el('fieldset', { class: 'mode-toggle agent-kind' }, [
      el('legend', { class: 'visually-hidden', text: T.decisionMakerHeading }),
      el('label', { class: 'mode-toggle__option' }, [
        radio,
        el('span', { class: 'mode-toggle__name', text: T.glassBox }),
        el('span', { class: 'mode-toggle__help', text: T.glassBoxHelp }),
      ]),
    ]),
    el('p', { class: 'hint', text: T.blackBoxLater }),
    helpPanel('decisionMaker'),
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
    T.sampleQuestions.map((q) => el('button', {
      type: 'button', class: 'button agent-sample', text: q,
      onclick: () => app.setSetup({ question: q, requestOn: false }, { rebuild: true }),
    })));

  const request = checkbox(T.requestToggle, s.requestOn, (on) => app.setSetup({ requestOn: on }, { rebuild: true }));
  const dates = [];
  if (s.requestOn) {
    const start = el('input', { type: 'date', value: s.start });
    start.addEventListener('change', () => app.setSetup({ start: start.value }));
    const end = el('input', { type: 'date', value: s.end });
    end.addEventListener('change', () => app.setSetup({ end: end.value }));
    dates.push(el('div', { class: 'agent-dates' }, [labelled(T.requestStart, start), labelled(T.requestEnd, end)]));
  }

  return group(T.questionHeading, [
    labelled(T.employee, employee),
    labelled(T.questionLabel, text),
    el('p', { class: 'agent-field__label', text: T.samples }),
    samples,
    helpPanel('question'),
    request,
    ...dates,
    el('p', { class: 'hint', text: fill(T.today, { date: app.scenario.today }) }),
    helpPanel('request'),
  ]);
}

function ruleTable(app, T, s) {
  const rows = app.copy.AGENT.ruleTable.map((r) => el('tr', {}, [
    el('th', { scope: 'row', text: r.id }), el('td', { text: r.when }), el('td', { text: r.action }),
  ]));
  const table = el('table', { class: 'agent-rules' }, [
    el('thead', {}, el('tr', {}, [
      el('th', { scope: 'col', text: T.ruleColumns.rule }),
      el('th', { scope: 'col', text: T.ruleColumns.when }),
      el('th', { scope: 'col', text: T.ruleColumns.action }),
    ])),
    el('tbody', {}, rows),
  ]);

  // The synonym table (rule F1)
  const list = s.synonyms.length
    ? el('ul', { class: 'agent-synonyms' }, s.synonyms.map((pair, i) => el('li', {}, [
      el('span', { text: `${pair.from} → ${pair.to}` }),
      el('button', {
        type: 'button', class: 'button agent-small', text: '×', 'aria-label': fill(T.synonymRemove, { from: pair.from }),
        onclick: () => app.setSetup({ synonyms: s.synonyms.filter((_, j) => j !== i) }, { rebuild: true }),
      }),
    ])))
    : el('p', { class: 'hint', text: T.synonymsEmpty });
  const from = el('input', { type: 'text', size: '10', autocomplete: 'off' });
  const to = el('input', { type: 'text', size: '10', autocomplete: 'off' });
  const add = el('button', {
    type: 'button', class: 'button', text: T.synonymAdd,
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
    el('div', { class: 'agent-table-wrap' }, table),
    el('h4', { text: T.synonymsHeading }),
    list,
    el('div', { class: 'agent-synonym-add' }, [labelled(T.synonymFrom, from), labelled(T.synonymTo, to), add]),
    helpPanel('synonyms'),
    labelled(T.threshold, threshold),
    helpPanel('threshold'),
    checkbox(T.switchC3, s.c3, (on) => app.setSetup({ c3: on })),
    checkbox(T.switchF2, s.f2, (on) => app.setSetup({ f2: on })),
    checkbox(T.switchF3, s.f3, (on) => app.setSetup({ f3: on })),
    helpPanel('ruleSwitches'),
    labelled(T.balanceWords, balance),
    helpPanel('balanceWords'),
  ]);
}

function tools(app, T, s) {
  const items = TOOL_NAMES.map((name) => {
    const def = TOOL_DEFINITIONS[name];
    const schema = toolSchemas([name])[0];
    return el('li', { class: `agent-tool agent-tool--${def.type}` }, [
      checkbox(name, s.tools[name], (on) => app.setSetup({ tools: { ...s.tools, [name]: on } })),
      el('p', { class: 'agent-tool__desc', text: schema.description }),
      el('p', { class: 'agent-tool__tags' }, [
        el('span', { class: 'agent-tag', text: T.toolType[def.type] }),
        el('span', { class: 'agent-tag', text: T.toolApproval[def.approval] }),
      ]),
      el('details', { class: 'agent-tool__schema' }, [
        el('summary', { text: T.toolSchema }),
        el('pre', { text: JSON.stringify(schema, null, 2) }),
      ]),
    ]);
  });
  return group(T.toolsHeading, [el('ul', { class: 'agent-tools' }, items), helpPanel('tools')]);
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
    labelled(T.maxRounds, max),
    s.maxRounds === null ? el('p', { class: 'hint agent-warn', text: fill(T.noLimitNote, { limit }) }) : null,
    helpPanel('maxRounds'),
    labelled(T.tokenBudget, budget),
    checkbox(T.budgetNoLimit, s.tokenBudget === null, (on) => app.setSetup({ tokenBudget: on ? null : app.constants.AGENT_TOKEN_BUDGET_DEFAULT }, { rebuild: true })),
    helpPanel('tokenBudget'),
    checkbox(T.repeatStop, s.repeatStop, (on) => app.setSetup({ repeatStop: on })),
    helpPanel('repeatStop'),
    checkbox(T.keepLastTwo, s.keepLastTwo, (on) => app.setSetup({ keepLastTwo: on })),
    helpPanel('keepLastTwo'),
  ]);
}
