// Agent mode: the system prompt workbench, the last group in the set-up
// column. Sections with on/off boxes and editable text, the cost of each
// section, saved versions with a note, the prompt checker, compare,
// download, and load.
//
// The group is a disclosure. It is closed for the Glass Box agent, which
// does not read the prompt, and open for the Black Box agent, until the
// student changes it. Each section shows its title and its tokens on one
// line; the text opens on a click.
//
// Every control has a fixed id, so main.js can put the focus back on the
// same control after it redraws the column.

import { el, fill } from '../../dom.js';
import { matchingVersion, promptCost } from '../prompt.js';
import { helpPanel, helpGroup, helpEntry } from './help.js';

export function renderWorkbench(app) {
  const A = app.copy.AGENT;
  const W = A.workbench;
  const store = app.prompts;
  const working = store.working;
  const match = matchingVersion(store);
  const cost = promptCost(working);

  const label = match ? fill(W.matches, { version: match.version, name: match.name }) : W.unsaved;

  const sections = working.sections.map((s) => {
    const tokens = cost.sections.find((c) => c.id === s.id).tokens;
    const box = el('input', { type: 'checkbox', id: `agent-ps-on-${s.id}`, checked: s.enabled, 'aria-label': fill(W.sectionEnabled, { title: s.title }) });
    box.addEventListener('change', () => app.editPromptSection(s.id, { enabled: box.checked }));
    const text = el('textarea', {
      id: `agent-ps-text-${s.id}`, rows: '3', class: 'prompt-section__text',
      'aria-label': fill(W.sectionText, { title: s.title }),
    });
    text.value = s.text;
    text.addEventListener('change', () => app.editPromptSection(s.id, { text: text.value }));
    // The text is behind the title. The open state survives a redraw of the column.
    const body = el('details', { class: 'prompt-section__body', open: Boolean(app.ui.openPromptSections[s.id]) }, [
      el('summary', { class: 'prompt-section__summary' }, [
        el('span', { class: 'prompt-section__title', text: s.title }),
        el('span', { class: 'agent-tag', text: fill(W.sectionTokens, { tokens }) }),
      ]),
      text,
    ]);
    body.addEventListener('toggle', () => app.setPromptSectionOpen(s.id, body.open));
    return el('div', { class: `prompt-section${s.enabled ? '' : ' is-off'}` }, [box, body]);
  });

  const tab = app.ui.promptTab || 'agent';
  const tabButton = (id, value, text) => el('button', {
    type: 'button', class: `button workbench-tab${tab === value ? ' is-current' : ''}`, id,
    'aria-pressed': tab === value ? 'true' : 'false', text, onclick: () => app.setPromptTab(value),
  });
  const tabs = el('div', { class: 'workbench-tabs', role: 'group', 'aria-label': W.tabs }, [
    tabButton('agent-tab-agent', 'agent', W.tabAgent),
    tabButton('agent-tab-checker', 'checker', W.tabChecker),
  ]);
  const body = tab === 'checker'
    ? [tabs, ...checkerTab(app, A)]
    : [
      tabs,
      app.setup.agentKind === 'glass' ? el('p', { class: 'hint', text: W.glassNote }) : null,
      el('p', { class: 'workbench-current', text: fill(W.current, { label }) }),
      el('p', { class: 'hint', text: fill(W.cost, { tokens: cost.total }) }),
      ...sections,
      saveArea(app, W, match),
      versionList(app, W, store, match),
      el('div', { class: 'workbench-actions' }, [
        button('agent-prompt-check', W.check, () => app.checkPrompt()),
        button('agent-compare-open', W.compare, () => app.openCompare(), store.versions.length < 2),
        button('agent-prompt-reset', W.resetPrompt, () => app.usePromptVersion('v1'), match && match.version === 'v1'),
      ]),
      findings(app, A),
      el('div', { class: 'workbench-actions' }, [
        button('agent-prompt-download', W.download, () => app.downloadPrompts()),
        loadButton(app, W),
      ]),
      ...metaPrompt(app, A),
      helpGroup([
        helpEntry('promptSections', W.tabAgent),
        helpEntry('promptVersions', W.save),
        helpEntry('promptChecker', W.check),
        helpEntry('promptCompare', W.compare),
        helpEntry('promptFiles', W.download),
        helpEntry('metaPrompt', A.metaPrompt.heading),
      ]),
    ];

  // Closed for the Glass Box agent, open for the Black Box agent, until the student changes it.
  const open = app.ui.workbenchOpen ?? app.setup.agentKind === 'black';
  const group = el('details', { class: 'agent-group agent-workbench', id: 'agent-workbench', open }, [
    el('summary', { class: 'agent-workbench__summary' }, [
      el('h3', { text: W.heading }),
      el('span', { class: 'agent-tag', text: fill(W.sectionTokens, { tokens: cost.total }) }),
    ]),
    el('div', { class: 'agent-workbench__body' }, body),
  ]);
  group.addEventListener('toggle', () => app.setWorkbenchOpen(group.open));
  return group;
}

/** The second system prompt: the prompt of the model check. */
function checkerTab(app, A) {
  const W = A.workbench;
  const text = el('textarea', { id: 'agent-checker-text', rows: '6', class: 'prompt-section__text', 'aria-label': W.checkerText });
  text.value = app.setup.checkerPrompt || A.modelCheck.defaultPrompt;
  text.addEventListener('change', () => app.setSetup({ checkerPrompt: text.value }, { rebuild: true }));
  return [
    el('h4', { text: W.checkerHeading }),
    el('p', { class: 'hint', text: W.checkerUnused }),
    text,
    el('div', { class: 'workbench-actions' }, [
      button('agent-checker-reset', W.checkerReset, () => app.setSetup({ checkerPrompt: '' }, { rebuild: true }), !app.setup.checkerPrompt),
    ]),
    helpPanel('checkerPrompt'),
  ];
}

/** Ask a model to write a system prompt from a basic prompt (Black Box only). */
function metaPrompt(app, A) {
  const M = A.metaPrompt;
  const ready = app.setup.agentKind === 'black' && Boolean(app.apiKey);
  const basic = el('textarea', { id: 'agent-meta-basic', rows: '2', class: 'prompt-section__text', placeholder: M.basicPlaceholder });
  basic.value = app.ui.metaBasic || '';
  basic.addEventListener('change', () => app.setMetaBasic(basic.value));

  const result = app.ui.metaResult;
  const sections = app.prompts.working.sections;
  const proposals = [];
  if (result === null) proposals.push(el('p', { class: 'message--error', text: M.nothing }));
  else if (result) {
    proposals.push(el('h5', { text: M.resultHeading }));
    for (const s of sections) {
      if (!result[s.id]) continue;
      proposals.push(el('div', { class: 'meta-proposal' }, [
        el('strong', { text: s.title }),
        el('p', { text: result[s.id] }),
        button(`agent-meta-use-${s.id}`, fill(M.use, { title: s.title }), () => app.useMetaSection(s.id)),
      ]));
    }
  }

  return [
    el('h4', { text: M.heading }),
    el('div', { class: 'agent-field' }, [el('label', { for: basic.id, text: M.basic }), basic]),
    ready ? null : el('p', { class: 'hint', text: M.blackOnly }),
    el('div', { class: 'workbench-actions' }, [button('agent-meta-ask', M.ask, () => app.askMetaPrompt(), !ready || app.busy)]),
    ...proposals,
  ];
}

function button(id, text, onclick, disabled = false) {
  return el('button', { type: 'button', class: 'button', id, text, onclick, disabled });
}

function saveArea(app, W, match) {
  if (!app.ui.saveOpen) {
    return el('div', { class: 'workbench-actions' }, [button('agent-save-open', W.save, () => app.toggleSave(true))]);
  }
  const field = (id, labelText, control) => {
    control.id = id;
    return el('div', { class: 'agent-field' }, [el('label', { for: id, text: labelText }), control]);
  };
  const name = el('input', { type: 'text', autocomplete: 'off' });
  const what = el('textarea', { rows: '2' });
  const why = el('textarea', { rows: '2' });
  return el('form', {
    class: 'workbench-save',
    onsubmit: (event) => {
      event.preventDefault();
      app.savePromptVersion({ name: name.value, what: what.value, why: why.value });
    },
  }, [
    field('agent-save-name', W.saveName, name),
    field('agent-save-what', W.saveWhat, what),
    field('agent-save-why', W.saveWhy, why),
    el('p', { class: 'message--error', role: 'alert', id: 'agent-save-message', text: app.ui.saveMessage || '' }),
    el('div', { class: 'workbench-actions' }, [
      el('button', { type: 'submit', class: 'button button--primary', id: 'agent-save-confirm', text: W.saveConfirm }),
      button('agent-save-cancel', W.saveCancel, () => app.toggleSave(false)),
    ]),
  ]);
}

function versionList(app, W, store, match) {
  return el('div', {}, [
    el('h4', { text: W.versionsHeading }),
    el('ol', { class: 'workbench-versions' }, store.versions.map((v) => {
      const inUse = match && match.version === v.version;
      return el('li', { class: inUse ? 'is-in-use' : '' }, [
        el('div', { class: 'workbench-version__head' }, [
          el('strong', { text: `${v.version} · ${v.name}` }),
          inUse
            ? el('span', { class: 'agent-tag agent-tag--rule', text: W.inUse })
            : button(`agent-use-${v.version}`, W.use, () => app.usePromptVersion(v.version)),
        ]),
        v.note
          ? el('dl', { class: 'workbench-note' }, [
            el('dt', { text: W.saveWhat }), el('dd', { text: v.note.what }),
            el('dt', { text: W.saveWhy }), el('dd', { text: v.note.why }),
          ])
          : el('p', { class: 'hint', text: W.noNote }),
      ]);
    })),
  ]);
}

function findings(app, A) {
  const list = app.ui.findings;
  if (!list) return null;
  const W = A.workbench;
  const C = A.checker;
  const title = (id) => (app.prompts.working.sections.find((s) => s.id === id) || { title: id }).title;
  return el('div', { class: 'workbench-findings', id: 'agent-findings' }, [
    el('h4', { text: C.heading }),
    el('p', { text: list.length ? fill(W.checkFound, { count: list.length }) : W.checkClean }),
    list.length ? el('ul', {}, list.map((f) => el('li', {}, [
      el('strong', { text: f.sentence ? fill(C.location, { section: title(f.section), sentence: f.sentence }) : fill(C.sectionOnly, { section: title(f.section) }) }),
      f.text ? el('q', { text: f.text }) : null,
      el('p', { text: f.message }),
    ]))) : null,
  ]);
}

function loadButton(app, W) {
  const input = el('input', { type: 'file', accept: '.json,application/json', 'aria-label': W.load });
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    input.value = '';
    if (file) await app.loadPromptsFile(file);
  });
  return el('label', { class: 'button button--file', id: 'agent-prompt-load' }, [W.load, input]);
}
