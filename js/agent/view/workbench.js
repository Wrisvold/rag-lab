// Agent mode: the system prompt workbench, a group in the set-up column.
// Sections with on/off boxes and editable text, the cost of each section,
// saved versions with a note, the prompt checker, compare, download, and load.
//
// Every control has a fixed id, so main.js can put the focus back on the
// same control after it redraws the column.

import { el, fill } from '../../dom.js';
import { matchingVersion, promptCost } from '../prompt.js';
import { helpPanel } from './help.js';

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
    const box = el('input', { type: 'checkbox', id: `agent-ps-on-${s.id}`, checked: s.enabled });
    box.addEventListener('change', () => app.editPromptSection(s.id, { enabled: box.checked }));
    const text = el('textarea', {
      id: `agent-ps-text-${s.id}`, rows: '3', class: 'prompt-section__text',
      'aria-label': fill(W.sectionText, { title: s.title }),
    });
    text.value = s.text;
    text.addEventListener('change', () => app.editPromptSection(s.id, { text: text.value }));
    return el('div', { class: `prompt-section${s.enabled ? '' : ' is-off'}` }, [
      el('div', { class: 'prompt-section__head' }, [
        el('div', { class: 'agent-field agent-field--inline' }, [
          box, el('label', { for: box.id, text: s.title }),
        ]),
        el('span', { class: 'agent-tag', text: fill(W.sectionTokens, { tokens }) }),
      ]),
      text,
    ]);
  });

  return el('section', { class: 'agent-group agent-workbench' }, [
    el('h3', { text: W.heading }),
    app.setup.agentKind === 'glass' ? el('p', { class: 'hint', text: W.glassNote }) : null,
    el('p', { class: 'workbench-current', text: fill(W.current, { label }) }),
    el('p', { class: 'hint', text: fill(W.cost, { tokens: cost.total }) }),
    ...sections,
    helpPanel('promptSections'),
    saveArea(app, W, match),
    helpPanel('promptVersions'),
    versionList(app, W, store, match),
    el('div', { class: 'workbench-actions' }, [
      button('agent-prompt-check', W.check, () => app.checkPrompt()),
      button('agent-compare-open', W.compare, () => app.openCompare(), store.versions.length < 2),
      button('agent-prompt-reset', W.resetPrompt, () => app.usePromptVersion('v1'), match && match.version === 'v1'),
    ]),
    findings(app, A),
    helpPanel('promptChecker'),
    helpPanel('promptCompare'),
    el('div', { class: 'workbench-actions' }, [
      button('agent-prompt-download', W.download, () => app.downloadPrompts()),
      loadButton(app, W),
    ]),
    helpPanel('promptFiles'),
  ]);
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
