// Agent mode: the compare view, in the loop column. Two saved versions of
// the system prompt next to each other: the changed sentences, the cost of
// each version per round, and the last run of each version for the current
// question (agent-mode-plan.md, Section 8.3).

import { el, fill } from '../../dom.js';
import { comparePrompts, promptCost } from '../prompt.js';
import { helpPanel } from './help.js';

export function renderCompare(app, container) {
  const view = app.ui.compare;
  if (!view) { container.replaceChildren(); return; }
  const A = app.copy.AGENT;
  const T = A.compare;
  const versions = app.prompts.versions;
  const a = versions.find((v) => v.version === view.a) || versions[0];
  const b = versions.find((v) => v.version === view.b) || versions[versions.length - 1];

  const select = (id, label, current, side) => {
    const control = el('select', { id }, versions.map((v) => el('option', {
      value: v.version, text: `${v.version} · ${v.name}`, selected: v.version === current.version,
    })));
    control.addEventListener('change', () => app.setCompare({ [side]: control.value }));
    return el('div', { class: 'agent-field' }, [el('label', { for: id, text: label }), control]);
  };

  const body = [];
  if (a.version === b.version) {
    body.push(el('p', { class: 'hint', text: T.sameVersions }));
  } else {
    body.push(el('h4', { text: T.sectionsHeading }));
    body.push(el('p', { class: 'hint', text: [
      fill(T.costLine, { version: a.version, tokens: promptCost(a).total }),
      fill(T.costLine, { version: b.version, tokens: promptCost(b).total }),
    ].join(' · ') }));
    body.push(el('ul', { class: 'compare-sections' }, comparePrompts(a, b).map((s) => el('li', { class: `compare-section is-${s.status}` }, [
      el('div', { class: 'compare-section__head' }, [el('strong', { text: s.title }), el('span', { class: 'agent-tag', text: T.status[s.status] })]),
      s.status === 'changed'
        ? el('ul', { class: 'compare-diff' }, s.diff.filter((d) => d.kind !== 'same').map((d) => el('li', { class: `diff-${d.kind}` }, [
          el('span', { class: 'diff-mark', text: d.kind === 'added' ? `+ ${T.added}: ` : `− ${T.removed}: ` }),
          d.kind === 'added' ? el('ins', { text: d.text }) : el('del', { text: d.text }),
        ])))
        : null,
    ]))));

    const question = app.setup.question.trim();
    body.push(el('h4', { text: fill(T.runsHeading, { question }) }));
    body.push(el('div', { class: 'compare-runs' }, [a, b].map((v) => runColumn(app, T, v, question))));
    const runs = [a, b].map((v) => app.lastRunFor(v.version, question));
    if (runs.every(Boolean) && runs.every((r) => r.agentKind === 'glass')) body.push(el('p', { class: 'callout', text: T.glassNote }));
  }

  container.replaceChildren(el('section', { class: 'agent-compare', 'aria-labelledby': 'agent-compare-heading' }, [
    el('div', { class: 'agent-compare__head' }, [
      el('h3', { id: 'agent-compare-heading', tabindex: '-1', text: T.heading }),
      el('button', { type: 'button', class: 'button agent-small', id: 'agent-compare-close', text: T.close, onclick: () => app.closeCompare() }),
    ]),
    el('div', { class: 'compare-select' }, [select('agent-compare-a', T.versionA, a, 'a'), select('agent-compare-b', T.versionB, b, 'b')]),
    ...body,
    helpPanel('promptCompare'),
  ]));
}

function runColumn(app, T, version, question) {
  const run = app.lastRunFor(version.version, question);
  if (!run) {
    return el('div', { class: 'compare-run' }, [
      el('h5', { text: `${version.version} · ${version.name}` }),
      el('p', { class: 'hint', text: fill(T.noRun, { version: version.version }) }),
    ]);
  }
  return el('div', { class: 'compare-run' }, [
    el('h5', { text: `${version.version} · ${version.name}` }),
    el('p', { class: 'compare-run__facts', text: fill(T.runFacts, { code: run.stopReason, rounds: run.rounds, tokens: run.tokens.toLocaleString('en-US') }) }),
    el('pre', { class: 'compare-run__summary', text: run.summary }),
  ]);
}
