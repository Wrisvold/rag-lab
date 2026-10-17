// Agent mode: the Black Box agent. Pure, except for the `send` function it
// receives (js/agent/providers.js sendRequest in the page, recorded replies
// in the tests).
//
// A model decides in each round. It reads the system prompt, the tool list,
// and the transcript of the run, and it returns a tool call or an answer.
// The check is separate from the model that made the answer (the checker is
// not the maker): a check in code for every answer, and an optional second
// model call with its own system prompt, the checker prompt.

import { AGENT } from '../copy.js';
import { fill } from '../dom.js';
import { AGENT_PROVIDERS } from '../constants.js';
import { toolSchemas } from './tools.js';
import { systemPromptText } from './context.js';
import { checkAnswer } from './glassBoxAgent.js';
import { buildAgentRequest, parseAgentResponse, redactRequest } from './providers.js';

const SECTION = /\[(\d+\.\d+)\]/g;

/**
 * @param {{ providerKey: 'gemini' | 'openai' | 'anthropic', apiKey: string, send: (request) => Promise<object>,
 *           scenarioDate: string, modelCheck?: boolean, checkerPrompt?: string }} options
 */
export function createBlackBoxAgent(options) {
  const { providerKey, apiKey, send } = options;
  const model = AGENT_PROVIDERS[providerKey].model;

  return {
    kind: 'black',
    providerKey,
    model,

    async decide(view) {
      const request = buildAgentRequest(providerKey, {
        apiKey,
        system: systemPromptText(view.prompt),
        tools: toolSchemas(view.toolNames),
        transcript: buildTranscript(view, providerKey, options.scenarioDate),
      });
      const shown = redactRequest(request);
      const reply = parseAgentResponse(providerKey, await send(request));
      const common = { rule: null, raw: reply.raw, usage: reply.usage, request: shown, servedBy: reply.model };

      if (reply.kind === 'tool') {
        const [first, ...extra] = reply.calls;
        return { ...common, type: 'tool', name: first.name, args: first.args, callId: first.callId, extraCalls: extra };
      }
      if (reply.kind === 'text') {
        const citations = [...new Set([...reply.text.matchAll(SECTION)].map((m) => m[1]))];
        return { ...common, type: 'answer', text: reply.text, citations, basis: answerBasis(view, citations) };
      }
      const text = reply.kind === 'refusal' ? AGENT.answers.modelRefused
        : reply.kind === 'truncated' ? AGENT.answers.modelTruncated : AGENT.answers.modelEmpty;
      return { ...common, type: 'give_up', text };
    },

    async check(round, view) {
      const d = round.decision;
      if (d.type === 'give_up') return { passed: true, reasons: [{ rule: 'G1', passed: true, detail: AGENT.checks.G1 }] };
      if (d.type === 'tool') {
        const result = round.act && round.act.result;
        const ok = Boolean(result) && !result.error;
        return { passed: ok, reasons: [{ rule: 'T1', passed: ok, detail: ok ? AGENT.checks.T1 : AGENT.checks.T1fail }] };
      }

      // The answer: first the check in code, then, if selected, the model check.
      const code = checkAnswer(d, view);
      if (!code.passed || !options.modelCheck) return code;

      const request = buildAgentRequest(providerKey, {
        apiKey,
        system: options.checkerPrompt || AGENT.modelCheck.defaultPrompt,
        transcript: [{ kind: 'user', text: fill(AGENT.modelCheck.request, { passages: passagesText(view), answer: d.text }) }],
        text: true,
      });
      const reply = parseAgentResponse(providerKey, await send(request));
      const verdict = reply.text.trim();
      const reason = verdict.replace(/^NOT SUPPORTED[.:]?\s*/i, '').replace(/^SUPPORTED[.:]?\s*/i, '') || verdict;
      let m1;
      if (/^NOT SUPPORTED/i.test(verdict)) m1 = { rule: 'M1', passed: false, detail: fill(AGENT.modelCheck.M1fail, { reason }) };
      else if (/^SUPPORTED/i.test(verdict)) m1 = { rule: 'M1', passed: true, detail: AGENT.modelCheck.M1pass };
      else m1 = { rule: 'M1', passed: false, detail: fill(AGENT.modelCheck.M1unclear, { reason: verdict || '-' }) };

      const reasons = [...code.reasons, m1];
      const passed = reasons.every((r) => r.passed);
      return {
        passed,
        reasons,
        usage: reply.usage,
        request: redactRequest(request),
        ...(passed ? {} : { feedback: fill(AGENT.feedback.notSupported, { reason }) }),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// The transcript: the first message, then each finished round, in order.
// It only grows. With "keep only the last N rounds", older rounds drop out;
// Claude's thinking blocks in the rounds that stay are then removed, because
// a thinking block is valid only with the full history it came from.
// ---------------------------------------------------------------------------

export function buildTranscript(view, providerKey, date) {
  const B = AGENT.blackBox;
  let first = fill(B.userMessage, { id: view.employee.id, label: view.employee.label, date, question: view.question });
  if (view.request) first += `\n${fill(B.userRequest, { start: view.request.start_date, end: view.request.end_date })}`;
  const items = [{ kind: 'user', text: first }];

  const finished = view.rounds.filter((r) => r.decision && r.decision.raw && r.act);
  const keep = view.settings && view.settings.keepLastRounds;
  const rounds = keep ? finished.slice(-keep) : finished;
  const dropped = rounds.length < finished.length;

  for (const round of rounds) {
    const d = round.decision;
    let raw = d.raw;
    if (dropped && providerKey === 'anthropic') {
      raw = { ...raw, content: raw.content.filter((b) => b.type !== 'thinking' && b.type !== 'redacted_thinking') };
    }
    items.push({ kind: 'assistant', raw });
    if (d.type === 'tool') {
      const results = [{ callId: d.callId, name: d.name, ...toolResultContent(round) }];
      for (const extra of d.extraCalls || []) results.push({ callId: extra.callId, name: extra.name, content: JSON.stringify({ not_run: B.notRun }), isError: true });
      items.push({ kind: 'tool_results', results });
    }
    if (round.check && !round.check.passed && round.check.feedback) items.push({ kind: 'user', text: round.check.feedback });
  }
  return items;
}

/** What the model reads as the result of its tool call. */
function toolResultContent(round) {
  const result = round.act.result;
  if (!result) return { content: JSON.stringify({ error: 'no result' }), isError: true };
  if (result.error) return { content: JSON.stringify({ error: result.error }), isError: true };
  if (result.refused) {
    return { content: JSON.stringify({ refused: true, reasons: result.rules.filter((r) => !r.passed).map((r) => r.message) }) };
  }
  if (result.data && result.data.passages) {
    return {
      content: JSON.stringify({
        query: result.data.query,
        passages: result.data.passages.map((p) => ({ chunk: p.chunkNumber, section: p.section, score: Number(p.score.toFixed(2)), text: p.text.trim() })),
      }),
    };
  }
  return { content: JSON.stringify(result.data) };
}

/**
 * Which check applies to an answer. An answer with a section number is a
 * handbook answer and needs a retrieved passage in that section. An answer
 * with no section number, after a balance or request tool gave a result, is
 * a tool answer. Any other answer must cite the handbook, so it fails.
 */
function answerBasis(view, citations) {
  if (citations.length) return 'handbook';
  const toolAnswered = view.rounds.some((r) => r.decision && r.decision.type === 'tool' && r.decision.name !== 'search_handbook'
    && r.act && r.act.result && !r.act.result.error);
  return toolAnswered ? 'tool' : 'handbook';
}

function passagesText(view) {
  const lines = [];
  for (const r of view.rounds) {
    const result = r.act && r.act.result;
    if (r.decision && r.decision.name === 'search_handbook' && result && result.ok) {
      for (const p of result.data.passages) lines.push(`[Section ${p.section ?? 'none'}] ${p.text.trim()}`);
    }
  }
  return lines.length ? lines.join('\n\n') : AGENT.modelCheck.noPassages;
}

// ---------------------------------------------------------------------------
// The meta prompt (agent-mode-plan.md, Section 8.7)
// ---------------------------------------------------------------------------

/** Ask the model to write a system prompt in the six sections. Returns { sections, usage } or { sections: null }. */
export async function writePromptWithModel({ providerKey, apiKey, send, basicPrompt, sectionTitles }) {
  const request = buildAgentRequest(providerKey, {
    apiKey, system: AGENT.metaPrompt.prompt, transcript: [{ kind: 'user', text: basicPrompt }], text: true,
  });
  const reply = parseAgentResponse(providerKey, await send(request));
  return { sections: parseSections(reply.text, sectionTitles), usage: reply.usage };
}

/** "Role: ... Tasks: ..." -> { role: '...', ... } for the titles that are present, or null. */
export function parseSections(text, titles) {
  const found = {};
  const pattern = new RegExp(`^\\s*[#*]*\\s*(${titles.map((t) => t.title.replace(/ /g, '\\s+')).join('|')})\\s*[*]*\\s*:\\s*[*]*\\s*`, 'gim');
  const marks = [...(text || '').matchAll(pattern)];
  marks.forEach((m, i) => {
    const title = titles.find((t) => new RegExp(`^${t.title.replace(/ /g, '\\s+')}$`, 'i').test(m[1]));
    const end = i + 1 < marks.length ? marks[i + 1].index : text.length;
    const body = text.slice(m.index + m[0].length, end).replace(/\s+/g, ' ').trim();
    if (title && body) found[title.id] = body;
  });
  return Object.keys(found).length ? found : null;
}
