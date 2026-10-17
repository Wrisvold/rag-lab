// Agent mode: the "How to use it, and why" panel for one function.
// Every function of the page has three texts in js/copy.js (AGENT.help):
// numbered steps, a teaching note, and the course week. See agent-mode-plan.md, Section 12.

import { el } from '../../dom.js';
import { AGENT } from '../../copy.js';

/** A closed disclosure with the steps, the note, and the course link for one function. */
export function helpPanel(key) {
  const help = AGENT.help[key];
  if (!help) throw new Error(`No help text for "${key}"`);
  return el('details', { class: 'agent-help' }, [
    el('summary', { text: AGENT.helpLabel }),
    el('ol', { class: 'agent-help__steps' }, help.steps.map((s) => el('li', { text: s }))),
    el('p', { class: 'agent-help__why' }, [el('strong', { text: `${AGENT.whyLabel}. ` }), help.why]),
    el('p', { class: 'agent-help__course', text: help.course }),
  ]);
}
