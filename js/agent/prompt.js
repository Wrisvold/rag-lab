// Agent mode: the system prompt workbench. Pure, no DOM.
//
// The system prompt is part of every round, so it is worth managing like
// code: in sections, in saved versions with a reason for each change, and
// compared run against run (agent-mode-plan.md, Section 8 and Ideas 4 and 5).
//
//   store     { versions: [prompt, ...], working: prompt }
//   prompt    { version, name, note: { what, why } | null, sections: [{ id, title, text, enabled }] }
//
// v1 is the default prompt and is always there. The working copy is what
// the next run uses; it matches a saved version or it has unsaved changes.

import { AGENT } from '../copy.js';
import { fill } from '../dom.js';
import { estimateTokens } from '../prompt.js';
import { tokenize } from '../tokenizer.js';
import {
  CHARS_PER_TOKEN_ESTIMATE, STOPWORDS,
  AGENT_PROMPTS_FORMAT, AGENT_PROMPTS_FORMAT_VERSION,
  AGENT_PROMPT_INSTRUCTION_SECTIONS, AGENT_PROMPT_MAX_WORDS_INSTRUCTION, AGENT_PROMPT_MAX_WORDS_DESCRIPTION,
  AGENT_PROMPT_PHRASAL_VERBS, AGENT_PROMPT_VAGUE_WORDS,
} from '../constants.js';
import { defaultPrompt } from './context.js';
import { TOOL_NAMES } from './tools.js';

const clone = (prompt) => ({ ...prompt, note: prompt.note ? { ...prompt.note } : null, sections: prompt.sections.map((s) => ({ ...s })) });

/** A new store: v1 is the default prompt, and the working copy is v1. */
export function createPromptStore() {
  const v1 = { ...defaultPrompt(), note: null };
  return { versions: [v1], working: clone(v1) };
}

/** True when two prompts send the same text to the model. */
export function samePrompt(a, b) {
  if (a.sections.length !== b.sections.length) return false;
  return a.sections.every((s, i) => {
    const t = b.sections[i];
    return s.id === t.id && s.enabled === t.enabled && s.text.trim() === t.text.trim();
  });
}

/** The saved version that the working copy matches, or null for unsaved changes. */
export function matchingVersion(store) {
  return store.versions.find((v) => samePrompt(v, store.working)) || null;
}

/**
 * The prompt that a run uses: the working copy, labelled with its version.
 * Unsaved changes get the label "unsaved", so a run summary never claims a
 * version that the student did not save.
 */
export function promptForRun(store) {
  const match = matchingVersion(store);
  const base = clone(store.working);
  if (match) return { ...base, version: match.version, name: match.name };
  return { ...base, version: 'unsaved', name: AGENT.workbench.unsavedName };
}

/** Change one section of the working copy. */
export function editSection(store, id, patch) {
  return { ...store, working: { ...store.working, sections: store.working.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) } };
}

/** Make a saved version the working copy. */
export function useVersion(store, version) {
  const found = store.versions.find((v) => v.version === version);
  return found ? { ...store, working: clone(found) } : store;
}

/**
 * Save the working copy as a new version. The note is necessary: "What I
 * changed" and "Why I changed it". A change with no reason is not an experiment.
 * @returns {{ ok: true, store, version } | { ok: false, code: 'NOTE_REQUIRED' | 'NO_CHANGE' }}
 */
export function saveVersion(store, { name, what, why }) {
  if (!what || !what.trim() || !why || !why.trim()) return { ok: false, code: 'NOTE_REQUIRED' };
  if (matchingVersion(store)) return { ok: false, code: 'NO_CHANGE' };
  const number = Math.max(...store.versions.map((v) => Number(v.version.slice(1)) || 0)) + 1;
  const version = {
    ...clone(store.working),
    version: `v${number}`,
    name: (name || '').trim() || `v${number}`,
    note: { what: what.trim(), why: why.trim() },
  };
  return { ok: true, version: version.version, store: { versions: [...store.versions, version], working: clone(version) } };
}

// ---------------------------------------------------------------------------
// Download and load
// ---------------------------------------------------------------------------

export function exportPrompts(store) {
  return { format: AGENT_PROMPTS_FORMAT, version: AGENT_PROMPTS_FORMAT_VERSION, prompts: store.versions };
}

/**
 * @returns {{ ok: true, store } | { ok: false, code: 'BAD_FORMAT' | 'BAD_VERSION' }}
 */
export function importPrompts(json) {
  if (!json || json.format !== AGENT_PROMPTS_FORMAT || !Array.isArray(json.prompts) || !json.prompts.length) return { ok: false, code: 'BAD_FORMAT' };
  if (json.version > AGENT_PROMPTS_FORMAT_VERSION) return { ok: false, code: 'BAD_VERSION' };
  const ids = defaultPrompt().sections.map((s) => s.id);
  const versions = [];
  for (const p of json.prompts) {
    const ok = p && typeof p.version === 'string' && Array.isArray(p.sections)
      && ids.every((id) => p.sections.some((s) => s.id === id && typeof s.text === 'string'));
    if (!ok) return { ok: false, code: 'BAD_FORMAT' };
    const sections = ids.map((id) => {
      const s = p.sections.find((x) => x.id === id);
      const title = defaultPrompt().sections.find((d) => d.id === id).title;
      return { id, title, text: s.text, enabled: s.enabled !== false };
    });
    versions.push({ version: p.version, name: String(p.name || p.version), note: p.note || null, sections });
  }
  return { ok: true, store: { versions, working: clone(versions[versions.length - 1]) } };
}

// ---------------------------------------------------------------------------
// Cost
// ---------------------------------------------------------------------------

/** Tokens of each enabled section, and the total that each round sends. */
export function promptCost(prompt) {
  const sections = prompt.sections.map((s) => ({
    id: s.id,
    enabled: s.enabled,
    tokens: s.enabled ? estimateTokens(`${s.title}:\n${s.text}`, CHARS_PER_TOKEN_ESTIMATE) : 0,
  }));
  return { sections, total: sections.reduce((sum, s) => sum + s.tokens, 0) };
}

// ---------------------------------------------------------------------------
// Compare: which sentences changed between two versions
// ---------------------------------------------------------------------------

export const splitSentences = (text) => (text || '').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);

/** Sentence-level difference: [{ kind: 'same' | 'removed' | 'added', text }]. */
export function diffSentences(before, after) {
  const a = splitSentences(before);
  const b = splitSentences(after);
  // Longest common subsequence, then walk it.
  const lcs = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out.push({ kind: 'same', text: a[i] }); i += 1; j += 1; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { out.push({ kind: 'removed', text: a[i] }); i += 1; }
    else { out.push({ kind: 'added', text: b[j] }); j += 1; }
  }
  while (i < a.length) out.push({ kind: 'removed', text: a[i++] });
  while (j < b.length) out.push({ kind: 'added', text: b[j++] });
  return out;
}

/** Each section of two versions: whether it changed, and how. */
export function comparePrompts(a, b) {
  return a.sections.map((sa) => {
    const sb = b.sections.find((s) => s.id === sa.id);
    let status = 'same';
    if (sa.enabled && !sb.enabled) status = 'disabled';
    else if (!sa.enabled && sb.enabled) status = 'enabled';
    else if (sa.text.trim() !== sb.text.trim()) status = 'changed';
    return { id: sa.id, title: sa.title, status, enabledA: sa.enabled, enabledB: sb.enabled, diff: diffSentences(sa.text, sb.text) };
  });
}

// ---------------------------------------------------------------------------
// The prompt checker: the structural rules of ASD-STE100, applied to the
// student's prompt. Advice only: it never blocks a run.
// ---------------------------------------------------------------------------

const KEY_WORD_OPTIONS = { stopwords: STOPWORDS, minTokenLength: 5 };

/**
 * @returns {{ section: string, sentence: number, text: string, rule: string, message: string }[]}
 *   sentence is 1-based within its section; 0 for a finding about a whole section.
 */
export function checkPrompt(prompt) {
  const C = AGENT.checker;
  const findings = [];
  const all = [];   // every sentence, for the conflict rule

  for (const section of prompt.sections) {
    if (!section.enabled) continue;
    const max = AGENT_PROMPT_INSTRUCTION_SECTIONS.includes(section.id) ? AGENT_PROMPT_MAX_WORDS_INSTRUCTION : AGENT_PROMPT_MAX_WORDS_DESCRIPTION;
    splitSentences(section.text).forEach((text, index) => {
      const add = (rule, message) => findings.push({ section: section.id, sentence: index + 1, text, rule, message });
      const lower = text.toLowerCase();
      const count = text.split(/\s+/).filter(Boolean).length;
      if (count > max) add('LONG_SENTENCE', fill(C.LONG_SENTENCE, { count, max }));
      if (text.includes(';')) add('SEMICOLON', C.SEMICOLON);
      for (const [verb, instead] of Object.entries(AGENT_PROMPT_PHRASAL_VERBS)) {
        if (new RegExp(`\\b${verb.replace(' ', '\\s+')}\\b`).test(lower)) add('PHRASAL_VERB', fill(C.PHRASAL_VERB, { verb, instead }));
      }
      for (const word of AGENT_PROMPT_VAGUE_WORDS) {
        if (new RegExp(`\\b${word}\\b`).test(lower)) add('VAGUE_WORD', fill(C.VAGUE_WORD, { word }));
      }
      all.push({ section: section.id, sentence: index + 1, text, lower });
    });
  }

  // A possible conflict: one sentence says "always", another says "never" or
  // "do not", and both name the same tool or the same key word.
  // Whole tool names count as one key. Remove them before the word split, so
  // "search_handbook" does not match the word "handbook" in an unrelated rule.
  const keys = (s) => {
    const tools = TOOL_NAMES.filter((t) => s.lower.includes(t));
    const rest = tools.reduce((text, tool) => text.split(tool).join(' '), s.lower);
    return new Set([...tools, ...tokenize(rest, KEY_WORD_OPTIONS)]);
  };
  const always = all.filter((s) => /\balways\b/.test(s.lower));
  const never = all.filter((s) => /\bnever\b|\bdo not\b|\bdon't\b/.test(s.lower));
  for (const a of always) {
    for (const n of never) {
      if (a === n) continue;
      const shared = [...keys(a)].find((k) => keys(n).has(k));
      if (shared) {
        findings.push({
          section: a.section, sentence: a.sentence, text: a.text, rule: 'CONFLICT',
          message: fill(C.CONFLICT, { word: shared, sentence: n.sentence, section: titleOf(prompt, n.section) }),
        });
      }
    }
  }

  const stop = prompt.sections.find((s) => s.id === 'stop');
  if (!stop || !stop.enabled || !stop.text.trim()) {
    findings.push({ section: 'stop', sentence: 0, text: '', rule: 'NO_STOP_RULES', message: C.NO_STOP_RULES });
  }
  return findings;
}

function titleOf(prompt, id) {
  const s = prompt.sections.find((x) => x.id === id);
  return s ? s.title : id;
}
