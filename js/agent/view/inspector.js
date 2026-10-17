// Agent mode: the inspector. The context of the selected round, split into
// the five types of Lesson 12, with a size bar so the student sees which
// part grows from round to round.

import { el, fill } from '../../dom.js';
import { CONTEXT_TYPES } from '../context.js';
import { helpPanel } from './help.js';

export function renderInspector(app, container) {
  const T = app.copy.AGENT.inspector;
  const run = app.run;
  const round = run && app.selectedRound ? run.rounds.find((r) => r.number === app.selectedRound) : null;

  if (!round || !round.context) {
    container.replaceChildren(el('p', { class: 'hint', text: T.empty }), helpPanel('inspector'));
    return;
  }

  const { parts, total } = round.context;
  const runTotal = (round.tokensBefore || 0) + total;
  const share = (tokens) => (total ? (tokens / total) * 100 : 0);

  const bar = el('div', { class: 'size-bar', 'aria-hidden': 'true' },
    parts.filter((p) => p.tokens > 0).map((p) => el('span', {
      class: `size-bar__part size-bar__part--${p.type}`,
      style: `width: ${share(p.tokens).toFixed(2)}%`,
      title: `${T.types[p.type]}: ${fill(T.tokens, { tokens: p.tokens.toLocaleString('en-US') })}`,
    })));

  const legend = el('ul', { class: 'size-legend' }, CONTEXT_TYPES.map((type) => {
    const part = parts.find((p) => p.type === type);
    return el('li', {}, [
      el('span', { class: `size-legend__swatch size-bar__part--${type}`, 'aria-hidden': 'true' }),
      el('span', { text: `${T.types[type]}: ${fill(T.tokens, { tokens: part.tokens.toLocaleString('en-US') })}` }),
    ]);
  }));

  const details = parts.map((p) => el('details', { class: `context-part context-part--${p.type}`, open: p.type === 'knowledge' && p.tokens > 0 }, [
    el('summary', { text: `${T.types[p.type]} · ${fill(T.tokens, { tokens: p.tokens.toLocaleString('en-US') })}` }),
    // The text can scroll. tabindex lets a keyboard scroll it.
    p.text ? el('pre', { class: 'context-part__text', tabindex: '0', text: p.text }) : el('p', { class: 'hint', text: T.emptyPart }),
  ]));

  // The system prompt goes into every round: show its cost so far in this run.
  const sent = run.rounds.filter((r) => r.number <= round.number && r.context);
  const promptTotal = sent.reduce((sum, r) => sum + (r.context.promptTokens || 0), 0);

  container.replaceChildren(
    el('h3', { text: fill(T.heading, { number: round.number }) }),
    el('p', { class: 'context-total', text: fill(T.total, { tokens: total.toLocaleString('en-US'), run: runTotal.toLocaleString('en-US') }) }),
    el('p', { class: 'context-prompt-cost', text: fill(T.promptCost, {
      tokens: (round.context.promptTokens || 0).toLocaleString('en-US'),
      rounds: sent.length,
      total: promptTotal.toLocaleString('en-US'),
    }) }),
    bar,
    legend,
    ...details,
    ...modelParts(app, T, round),
    helpPanel('inspector'),
  );
}

/** For a model decision: what the provider counted, and the exact request. Otherwise the Glass Box note. */
function modelParts(app, T, round) {
  const d = round.decision;
  if (!d || !d.request) {
    return app.setup.agentKind === 'glass' ? [el('p', { class: 'callout agent-glass-note', text: T.glassNote })] : [];
  }
  const C = app.copy.AGENT.card;
  return [
    el('p', { class: 'callout agent-glass-note', text: T.blackNote }),
    d.usage ? el('p', { class: 'context-prompt-cost', text: fill(C.usage, { input: d.usage.input.toLocaleString('en-US'), output: d.usage.output.toLocaleString('en-US') }) }) : null,
    // With server-side fallbacks, a different model can reply. Show the model that the provider names.
    d.servedBy ? el('p', { class: 'hint', text: fill(C.servedBy, { model: d.servedBy }) }) : null,
    el('details', { class: 'context-part context-part--instructions' }, [
      el('summary', { text: T.rawRequest }),
      el('pre', { class: 'context-part__text', tabindex: '0', text: JSON.stringify(d.request, null, 2) }),
    ]),
  ];
}
