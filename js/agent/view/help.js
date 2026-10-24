// Agent mode: the "How to use it, and why" panels.
// Every function of the page has three texts in js/copy.js (AGENT.help):
// numbered steps, a teaching note, and the course week. See agent-mode-plan.md, Section 12.
//
// One closed disclosure stands at the end of each group of controls and holds
// the entry of each control in that group, under the control's own name. A
// control that stands alone (the inspector, the approval panel) has a
// disclosure with one entry and no name.

import { el } from '../../dom.js';
import { AGENT } from '../../copy.js';

/** The steps, the note, and the course link for one function, with the name of its control. */
export function helpEntry(key, title = null) {
  const help = AGENT.help[key];
  if (!help) throw new Error(`No help text for "${key}"`);
  return el('div', { class: 'agent-help__entry' }, [
    title ? el('h5', { class: 'agent-help__title', text: title }) : null,
    el('ol', { class: 'agent-help__steps' }, help.steps.map((s) => el('li', { text: s }))),
    el('p', { class: 'agent-help__why' }, [el('strong', { text: `${AGENT.whyLabel}. ` }), help.why]),
    el('p', { class: 'agent-help__course', text: help.course }),
  ]);
}

/** A closed disclosure that holds one or more entries. Null entries are skipped. */
export function helpGroup(entries) {
  return el('details', { class: 'agent-help' }, [
    el('summary', { text: AGENT.helpLabel }),
    ...entries.filter(Boolean),
  ]);
}

/** A closed disclosure with the entry of one function and no name. */
export function helpPanel(key) {
  return helpGroup([helpEntry(key)]);
}
