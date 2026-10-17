// Agent mode: the middle column. The loop diagram and status, the controls,
// the stop message, the approval panel, and one card for each round.
//
// The diagram highlights the part that runs next. The round card of the
// current round highlights the same part, so the eye can go from the
// diagram to the card.

import { el, fill } from '../../dom.js';
import { formatCall } from '../context.js';
import { dayNumber, workDays } from '../tools.js';
import { stopMessage } from '../describe.js';
import { helpPanel } from './help.js';

const PARTS = ['context', 'decide', 'act', 'check'];

// Redrawing replaces the buttons. To keep a keyboard user in place, each
// button has a data-focus-key, and focus returns to the same key after a redraw.
let lastFocusKey = null;

export function renderLoop(app, els) {
  const A = app.copy.AGENT;
  const active = document.activeElement;
  const keyed = active && active.dataset && active.dataset.focusKey;
  if (keyed) lastFocusKey = active.dataset.focusKey;
  const restore = keyed || !active || active === document.body;

  els.diagram.replaceChildren(diagram(app, A));
  els.controls.replaceChildren(controls(app, A));
  els.stop.replaceChildren(...stopBanner(app, A));
  const approval = approvalPanel(app, A);
  els.approval.replaceChildren(...(approval ? [approval] : []));
  els.rounds.replaceChildren(rounds(app, A));

  // Move focus to the approval panel the first time it shows for a round.
  if (approval && app.approvalShown(app.run.round)) {
    approval.querySelector('h3').focus();
    return;
  }
  if (restore && lastFocusKey) {
    const target = document.querySelector(`[data-focus-key="${lastFocusKey}"]`);
    if (target && !target.disabled) target.focus();
    else {
      // The button is gone or disabled (for example, Step after the run stopped):
      // focus the first control that still works.
      const fallback = els.controls.querySelector('button:not([disabled])');
      if (fallback) fallback.focus();
    }
  }
}

/** The part that runs next, or null when there is no run or the run stopped. */
function nextPart(run) {
  if (!run || run.status === 'stopped') return null;
  if (run.status === 'waiting_for_approval') return 'act';
  return run.part;
}

// ---------------------------------------------------------------------------

function diagram(app, A) {
  const run = app.run;
  const current = nextPart(run);
  const items = PARTS.map((part) => el('li', {
    class: `loop-diagram__part${part === current ? ' is-current' : ''}`,
    'aria-current': part === current ? 'step' : false,
  }, [
    el('span', { class: 'loop-diagram__name', text: A.loop.parts[part] }),
    el('span', { class: 'loop-diagram__help', text: A.loop.partHelp[part] }),
  ]));

  let status;
  if (!run) status = A.loop.statusIdle;
  else {
    const max = run.settings.maxRounds;
    const round = max === null ? fill(A.loop.statusRound, { round: run.round }) : fill(A.loop.statusRoundOf, { round: run.round, max });
    const tokens = fill(A.loop.statusTokens, { tokens: run.tokens.toLocaleString('en-US') });
    const extra = run.status === 'waiting_for_approval' ? A.loop.statusWaiting
      : run.status === 'stopped' ? fill(A.loop.statusStopped, { code: run.stopReason }) : '';
    status = [round, tokens, extra].filter(Boolean).join(' · ');
  }

  return el('div', { class: 'loop-diagram' }, [
    el('ol', { class: 'loop-diagram__parts' }, items),
    el('p', { class: 'loop-diagram__back', 'aria-hidden': 'true', text: `↺ ${A.loop.back}` }),
    el('p', { class: 'loop-diagram__status', text: status }),
  ]);
}

function controls(app, A) {
  const run = app.run;
  const stopped = run && run.status === 'stopped';
  const waiting = run && run.status === 'waiting_for_approval';
  // Buttons are disabled only for the state of the run, never while a step
  // runs: a disabled button loses the keyboard focus. The actions ignore a
  // click while the page is busy.
  const off = !app.scenario;
  const button = (key, text, onclick, disabled, primary = false) => el('button', {
    type: 'button', class: primary ? 'button button--primary' : 'button', text, onclick,
    disabled: off || disabled, 'data-focus-key': key,
  });
  return el('div', { class: 'agent-controls' }, [
    el('div', { class: 'agent-controls__buttons', role: 'group', 'aria-label': A.loop.controls, 'aria-busy': app.busy ? 'true' : false }, [
      button('step', A.loop.step, app.doStep, stopped || waiting, true),
      button('run-round', A.loop.runRound, app.runRound, stopped || waiting),
      button('run-to-end', A.loop.runToEnd, app.runToEnd, stopped || waiting),
      button('stop', A.loop.stop, () => app.stopRun(), !run || stopped),
      button('reset', A.loop.reset, () => app.reset(), !run),
      button('copy', A.loop.copySummary, () => app.copySummary(), !run),
    ]),
    el('div', { class: 'agent-controls__help' }, [
      helpPanelTitled(A, 'step', A.loop.step),
      helpPanelTitled(A, 'runRound', A.loop.runRound),
      helpPanelTitled(A, 'runToEnd', A.loop.runToEnd),
      helpPanelTitled(A, 'stop', A.loop.stop),
      helpPanelTitled(A, 'reset', A.loop.reset),
      helpPanelTitled(A, 'summary', A.loop.copySummary),
    ]),
  ]);
}

/** A help panel whose summary names the button it explains. */
function helpPanelTitled(A, key, name) {
  const panel = helpPanel(key);
  panel.querySelector('summary').textContent = `${name}: ${A.helpLabel}`;
  return panel;
}

function stopBanner(app, A) {
  const run = app.run;
  if (!run || run.status !== 'stopped') return [];
  const good = run.stopReason === 'ANSWER_ACCEPTED' || run.stopReason === 'GAVE_UP';
  const note = A.stops[run.stopReason] ? A.stops[run.stopReason].note : '';
  return [el('div', { class: `agent-stop ${good ? 'agent-stop--good' : 'agent-stop--warn'}` }, [
    el('p', { class: 'agent-stop__code', text: run.stopReason }),
    el('p', { class: 'agent-stop__message', text: stopMessage(run.stopReason) }),
    run.stopDetail && A.modelErrors[run.stopDetail] ? el('p', { class: 'agent-stop__message', text: A.modelErrors[run.stopDetail] }) : null,
    el('p', { class: 'agent-stop__note' }, [el('strong', { text: `${A.whyLabel}. ` }), note]),
  ])];
}

function approvalPanel(app, A) {
  const run = app.run;
  if (!run || run.status !== 'waiting_for_approval') return null;
  const T = A.approval;
  const { decision, rules } = run.pending;
  const args = decision.args;
  const employee = app.scenario.employees.find((e) => e.id === args.employee_id);
  const start = dayNumber(args.start_date);
  const end = dayNumber(args.end_date);
  const days = start !== null && end !== null ? workDays(start, end) : '-';

  const row = (term, value) => [el('dt', { text: term }), el('dd', { text: String(value) })];
  return el('section', { class: 'agent-approval', 'aria-labelledby': 'agent-approval-heading' }, [
    el('h3', { id: 'agent-approval-heading', tabindex: '-1', text: T.heading, 'data-focus-key': 'approval' }),
    el('p', { text: T.intro }),
    el('p', { class: 'agent-call', text: formatCall(decision) }),
    el('dl', { class: 'agent-approval__list' }, [
      ...row(T.employee, employee ? `${employee.id} · ${employee.name}` : args.employee_id),
      ...row(T.start, args.start_date),
      ...row(T.end, args.end_date),
      ...row(T.workDays, days),
    ]),
    el('h4', { text: T.rules }),
    el('ul', { class: 'agent-checks' }, rules.map((r) => ruleLine(A, r))),
    el('div', { class: 'toolbar' }, [
      el('button', { type: 'button', class: 'button button--primary', text: T.approve, onclick: app.approve, 'data-focus-key': 'approve' }),
      el('button', { type: 'button', class: 'button', text: T.refuse, onclick: () => app.refuse(), 'data-focus-key': 'refuse' }),
    ]),
    helpPanel('approval'),
  ]);
}

function ruleLine(A, r) {
  const mark = r.passed ? A.card.checkPassed : A.card.checkFailed;
  // A passed rule needs no message, except when an exercise disabled it.
  const message = !r.passed || r.disabled ? ` ${r.message}` : '';
  return el('li', { class: r.passed ? 'is-passed' : 'is-failed' }, [
    el('span', { class: 'agent-check__mark', text: `${mark}: ` }),
    el('span', { text: `${r.rule}${r.section ? ` [${r.section}]` : ''}.${message}` }),
  ]);
}

// ---------------------------------------------------------------------------
// Round cards
// ---------------------------------------------------------------------------

function rounds(app, A) {
  const run = app.run;
  const heading = el('h3', { class: 'agent-rounds__heading', text: A.loop.roundsHeading });
  if (!run) return el('div', {}, [heading, el('p', { class: 'hint', text: A.loop.noRounds })]);
  const current = nextPart(run);
  return el('div', {}, [
    heading,
    el('ol', { class: 'agent-rounds' }, run.rounds.map((round) => card(app, A, round, round.number === run.round ? current : null))),
  ]);
}

function card(app, A, round, currentPart) {
  const C = A.card;
  const d = round.decision;
  const selected = app.selectedRound === round.number;

  const header = el('div', { class: 'agent-card__header' }, [
    el('h4', { text: fill(C.title, { number: round.number }) }),
    d && d.rule ? el('span', { class: 'agent-tag agent-tag--rule', text: fill(C.rule, { rule: d.rule }) }) : null,
    d && !d.rule ? el('span', { class: 'agent-tag agent-tag--model', text: C.modelDecided }) : null,
    round.context ? el('button', {
      type: 'button', class: 'button agent-small', 'aria-pressed': selected ? 'true' : 'false',
      text: selected ? C.contextShown : C.showContext, onclick: () => app.selectRound(round.number),
      'data-focus-key': `context-${round.number}`,
    }) : null,
  ]);

  const rowFor = (part, content) => el('div', { class: `agent-card__row${part === currentPart ? ' is-current' : ''}` }, [
    el('dt', { text: A.loop.parts[part] }),
    el('dd', {}, content),
  ]);

  return el('li', { class: `agent-card${selected ? ' is-selected' : ''}` }, [
    header,
    el('dl', { class: 'agent-card__rows' }, [
      rowFor('context', round.context ? fill(C.contextLine, { tokens: round.context.total.toLocaleString('en-US') }) : C.pending),
      rowFor('decide', decideText(C, d)),
      rowFor('act', actContent(C, round)),
      rowFor('check', checkContent(A, round)),
    ]),
  ]);
}

function decideText(C, d) {
  if (!d) return C.pending;
  const usage = d.usage ? el('p', { class: 'hint', text: fill(C.usage, { input: d.usage.input.toLocaleString('en-US'), output: d.usage.output.toLocaleString('en-US') }) }) : null;
  if (d.type === 'tool') return [el('code', { class: 'agent-call', text: formatCall(d) }), usage];
  if (d.type === 'answer') return [C.decideAnswer, usage];
  return [C.decideGiveUp, usage];
}

function actContent(C, round) {
  const act = round.act;
  const parts = [];
  if (round.approval && round.approval.status === 'approved') parts.push(el('p', { text: C.approvalApproved }));
  if (!act) return parts.length ? parts : C.pending;
  if (act.kind === 'deliver') return [el('p', { class: 'agent-answer', text: fill(C.actDeliver, { text: round.decision.text }) })];
  if (act.kind === 'refused-by-person') return [el('p', { text: C.actRefusedPerson })];

  const result = act.result;
  if (result.error) parts.push(el('p', { text: fill(C.actError, { error: result.error }) }));
  else if (result.refused) {
    parts.push(el('p', { text: C.actRefusedRule }));
    parts.push(el('ul', { class: 'agent-checks' }, result.rules.filter((r) => !r.passed).map((r) => el('li', { class: 'is-failed', text: r.message }))));
  } else if (result.data && result.data.passages) {
    parts.push(el('p', { text: C.actPassages }));
    parts.push(el('ol', { class: 'agent-passages' }, result.data.passages.map((p) => el('li', {
      text: fill(p.section ? C.passage : C.passageNoSection, {
        chunk: String(p.chunkNumber).padStart(2, '0'), score: p.score.toFixed(2), section: p.section,
      }),
    }))));
  } else {
    parts.push(el('p', {}, [fill(C.actResult, { result: '' }), el('code', { text: JSON.stringify(result.data) })]));
  }
  return parts;
}

function checkContent(A, round) {
  if (!round.check) return A.card.pending;
  return [el('ul', { class: 'agent-checks' }, round.check.reasons.map((r) => {
    const mark = r.passed ? A.card.checkPassed : A.card.checkFailed;
    return el('li', { class: r.passed ? 'is-passed' : 'is-failed' }, [
      el('span', { class: 'agent-check__mark', text: `${mark}: ` }),
      el('span', { text: `${r.rule}. ${r.detail}` }),
    ]);
  }))];
}
