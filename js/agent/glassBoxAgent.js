// Agent mode: the Glass Box agent. Pure, no DOM.
//
// It decides with a rule table that a person can read (agent-mode-plan.md,
// Section 9.2), and every decision names the rule that fired. It does not
// read the system prompt, and it cannot write: it quotes the handbook or
// fills in a fixed sentence from js/copy.js.
//
//   R1 Balance   a balance question          -> get_vacation_balance
//   R2 Request   the request form is filled  -> get_vacation_balance, then submit_vacation_request
//   R3 Search    every other question        -> search_handbook
//   C1 C2 C3     the checks after a search   (known words, score, numbered section)
//   F1 Rewrite   C1 failed, a synonym exists -> search again with the synonym
//   F2 Wider     C2 failed, F2 not used yet  -> search again with TOP_K + 2
//   F3 Stop      no fix is left              -> tell the user the handbook does not answer
//   F4 Repeat    no fix is left, F3 is off   -> the same search again (Exercise 1 only)
//   A1 Answer    the checks passed           -> quote the best sentence, with its section

import { AGENT } from '../copy.js';
import { fill } from '../dom.js';
import { tokenize } from '../tokenizer.js';
import {
  TOP_K_DEFAULT, TOP_K_MAX, AGENT_GLASS_SCORE_THRESHOLD, AGENT_GLASS_WIDER_STEP, AGENT_GLASS_BALANCE_WORDS,
} from '../constants.js';
import { GLASS_BOX_OPTIONS, sectionAt } from './handbook.js';
import { countOf } from './tools.js';

/**
 * @param {{ handbook: object, synonyms?: Record<string, string>, scoreThreshold?: number,
 *           c3?: boolean, f2?: boolean, f3?: boolean, balanceWords?: string[], topK?: number }} options
 */
export function createGlassBoxAgent(options) {
  const config = {
    synonyms: lowerKeys(options.synonyms || {}),
    scoreThreshold: options.scoreThreshold ?? AGENT_GLASS_SCORE_THRESHOLD,
    c3: options.c3 ?? true,
    f2: options.f2 ?? true,
    f3: options.f3 ?? true,
    balanceWords: options.balanceWords || AGENT_GLASS_BALANCE_WORDS,
    topK: options.topK ?? TOP_K_DEFAULT,
  };
  const handbook = options.handbook;

  return {
    kind: 'glass',
    config,

    decide(view) {
      const past = view.rounds.filter((r) => r.decision && r.act);
      const calls = (name) => past.filter((r) => r.decision.type === 'tool' && r.decision.name === name);
      const employeeId = view.employee.id;

      // R2: the request form is filled in.
      if (view.request) {
        if (!calls('get_vacation_balance').length) return tool('R2', 'get_vacation_balance', { employee_id: employeeId });
        const submits = calls('submit_vacation_request');
        if (!submits.length) {
          return tool('R2', 'submit_vacation_request', {
            employee_id: employeeId, start_date: view.request.start_date, end_date: view.request.end_date,
          });
        }
        return requestAnswer(submits[submits.length - 1].act.result);
      }

      // R1: a balance question.
      const question = view.question.toLowerCase();
      if (config.balanceWords.some((word) => question.includes(word.toLowerCase()))) {
        const balance = calls('get_vacation_balance');
        if (!balance.length) return tool('R1', 'get_vacation_balance', { employee_id: employeeId });
        const result = balance[balance.length - 1].act.result;
        if (result.ok) return answer('R1', fill(AGENT.answers.balance, { days: countOf(result.data.vacation_days_left) }), [], 'tool');
        return { type: 'give_up', rule: 'R1', text: refusalText(result) };
      }

      // R3: search the handbook, then fix or answer.
      const searches = calls('search_handbook');
      if (!searches.length) return tool('R3', 'search_handbook', { query: view.question, top_k: config.topK });

      const last = searches[searches.length - 1];
      const { query, top_k: topK } = last.decision.args;
      if (last.check && last.check.passed) return answerFromSearch(last.act.result.data, handbook);

      const failed = new Set((last.check ? last.check.reasons : []).filter((r) => !r.passed).map((r) => r.rule));
      const result = last.act.result;

      if (failed.has('C1') && result.ok) {
        const rewritten = rewrite(query, result.data.unknown, config.synonyms);
        if (rewritten !== query) return tool('F1', 'search_handbook', { query: rewritten, top_k: topK });
      }
      const usedF2 = past.some((r) => r.decision.rule === 'F2');
      if (failed.has('C2') && config.f2 && !usedF2) {
        return tool('F2', 'search_handbook', { query, top_k: Math.min(topK + AGENT_GLASS_WIDER_STEP, TOP_K_MAX) });
      }
      if (config.f3) return { type: 'give_up', rule: 'F3', text: AGENT.answers.giveUp };
      return tool('F4', 'search_handbook', { query, top_k: topK });
    },

    check(round, view) {
      const d = round.decision;
      if (d.type === 'give_up') return pass([{ rule: 'G1', passed: true, detail: AGENT.checks.G1 }]);
      if (d.type === 'answer') return checkAnswer(d, view);

      const result = round.act && round.act.result;
      if (d.name === 'search_handbook' && !(result && result.ok)) {
        return pass([{ rule: 'T1', passed: false, detail: AGENT.checks.T1fail }]);
      }
      // A refusal by a rule in code is also a result: the agent must report it.
      if (d.name !== 'search_handbook') return pass([{ rule: 'T1', passed: true, detail: AGENT.checks.T1 }]);

      const { passages, unknown } = result.data;
      const best = passages[0];
      const score = best ? best.score : 0;
      const reasons = [
        unknown.length
          ? { rule: 'C1', passed: false, detail: fill(AGENT.checks.C1fail, { words: unknown.map((w) => `"${w}"`).join(', ') }) }
          : { rule: 'C1', passed: true, detail: AGENT.checks.C1pass },
        {
          rule: 'C2',
          passed: score >= config.scoreThreshold,
          detail: fill(score >= config.scoreThreshold ? AGENT.checks.C2pass : AGENT.checks.C2fail,
            { score: score.toFixed(2), threshold: config.scoreThreshold.toFixed(2) }),
        },
      ];
      if (config.c3) {
        reasons.push(best && best.section
          ? { rule: 'C3', passed: true, detail: fill(AGENT.checks.C3pass, { section: best.section }) }
          : { rule: 'C3', passed: false, detail: AGENT.checks.C3fail });
      }
      return pass(reasons);
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const tool = (rule, name, args) => ({ type: 'tool', rule, name, args });
const answer = (rule, text, citations, basis) => ({ type: 'answer', rule, text, citations, basis });
const pass = (reasons) => ({ passed: reasons.every((r) => r.passed), reasons });

function lowerKeys(map) {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k.toLowerCase(), v]));
}

/** F1: put the synonym in place of each unknown word that has one. Whole words, any case. */
export function rewrite(query, unknown, synonyms) {
  let out = query;
  for (const word of unknown) {
    const replacement = synonyms[word.toLowerCase()];
    if (!replacement) continue;
    out = out.replace(new RegExp(`\\b${escape(word)}\\b`, 'gi'), replacement);
  }
  return out;
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A1: quote the sentence of the best passage that has the most words of the
 * query (first one on a tie), and cite the section that the SENTENCE is in.
 */
export function answerFromSearch(data, handbook) {
  const best = data.passages[0];
  const queryWords = new Set(tokenize(data.query, GLASS_BOX_OPTIONS));
  let chosen = null;
  for (const match of best.text.matchAll(/[^.!?]+[.!?]*/g)) {
    const sentence = match[0].trim();
    if (!sentence) continue;
    const count = tokenize(sentence, GLASS_BOX_OPTIONS).filter((w) => queryWords.has(w)).length;
    if (!chosen || count > chosen.count) {
      const offset = best.start + match.index + match[0].indexOf(sentence);
      chosen = { sentence, count, offset };
    }
  }
  const section = sectionAt(handbook.sections, chosen.offset);
  const number = section ? section.number : best.section;
  return {
    type: 'answer',
    rule: 'A1',
    text: number ? `${chosen.sentence} [${number}]` : chosen.sentence,
    citations: number ? [number] : [],
    basis: 'handbook',
    quote: { chunkNumber: best.chunkNumber, sentence: chosen.sentence, matches: chosen.count },
  };
}

function requestAnswer(result) {
  if (result.ok) {
    const r = result.data.recorded;
    return answer('R2', fill(AGENT.answers.recorded, { start: r.start_date, end: r.end_date, days: countOf(r.work_days, 'work') }), [], 'tool');
  }
  return answer('R2', refusalText(result), [], 'tool');
}

function refusalText(result) {
  if (result.refused) {
    const reason = result.rules.filter((r) => !r.passed).map((r) => r.message).join(' ');
    return fill(AGENT.answers.refusedByRule, { reason });
  }
  return AGENT.answers.giveUp;
}

/**
 * The answer check, the same in code for both agents: a handbook answer must
 * cite a section that a retrieved passage in this run covers. A tool answer
 * needs a tool result.
 */
export function checkAnswer(decision, view) {
  if (decision.basis === 'tool') return pass([{ rule: 'A2', passed: true, detail: AGENT.checks.A2 }]);
  const covered = new Set();
  for (const r of view.rounds) {
    const result = r.act && r.act.result;
    if (r.decision && r.decision.name === 'search_handbook' && result && result.ok) {
      for (const p of result.data.passages) for (const s of p.sections) covered.add(s);
    }
  }
  const cited = (decision.citations || []).find((s) => covered.has(s));
  if (cited) return pass([{ rule: 'A1', passed: true, detail: fill(AGENT.checks.A1pass, { section: cited }) }]);
  return { passed: false, reasons: [{ rule: 'A1', passed: false, detail: AGENT.checks.A1fail }], feedback: AGENT.feedback.noCitation };
}
