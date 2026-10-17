// Agent mode: what the agent can see in one round. Pure, no DOM.
//
// The context is split into the five types of Lesson 12, so the inspector
// can show the share of each, and so students see that the instructions are
// sent again in every round while the history and tool results grow.
//
//   instructions  the enabled system prompt sections and the tool list
//   knowledge     the retrieved passages
//   tools         the tool calls and their results (other than passages)
//   history       the question, the earlier decisions, and check feedback
//   preferences   the selected employee
//
// Token counts are the walkthrough's estimate: one token per four
// characters. The Black Box agent (Phase 15) replaces them with the counts
// the provider reports.

import { AGENT } from '../copy.js';
import { estimateTokens } from '../prompt.js';
import { CHARS_PER_TOKEN_ESTIMATE } from '../constants.js';
import { toolSchemas } from './tools.js';

export const CONTEXT_TYPES = ['instructions', 'knowledge', 'tools', 'history', 'preferences'];

/** A fresh copy of the default system prompt: version v1, every section on. */
export function defaultPrompt() {
  return {
    version: 'v1',
    name: AGENT.defaultPrompt.name,
    sections: AGENT.defaultPrompt.sections.map((s) => ({ ...s, enabled: true })),
  };
}

/** The system prompt as the model receives it: the enabled sections only. */
export function systemPromptText(prompt) {
  return prompt.sections
    .filter((s) => s.enabled)
    .map((s) => `${s.title}:\n${s.text}`)
    .join('\n\n');
}

/** "search_handbook({"query":"…"})" */
export function formatCall(decision) {
  return `${decision.name}(${JSON.stringify(decision.args || {})})`;
}

/**
 * @param {{ prompt: object, toolNames: string[], question: string, request?: object,
 *           employee: object, rounds: object[], keepLastRounds?: number | null }} input
 *   `rounds` are the round records of the loop (js/agent/loop.js). Only
 *   rounds that finished their Act part add tool results.
 * @returns {{ parts: { type: string, text: string, tokens: number }[], total: number }}
 */
export function buildContext({ prompt, toolNames, question, request, employee, rounds, keepLastRounds = null }) {
  const kept = keepLastRounds ? rounds.slice(-keepLastRounds) : rounds;

  const instructions = [systemPromptText(prompt), 'Tools:\n' + JSON.stringify(toolSchemas(toolNames), null, 1)]
    .filter(Boolean).join('\n\n');

  const preferences = `Employee: ${employee.id} (${employee.label})`;

  const history = [`Question: ${question}`];
  if (request) history.push(`Request form: from ${request.start_date} to ${request.end_date}`);

  const toolLines = [];
  const knowledge = [];
  for (const round of kept) {
    const d = round.decision;
    if (!d) continue;
    if (d.type === 'tool') history.push(`Round ${round.number}: called ${d.name}.`);
    if (d.type === 'answer' || d.type === 'give_up') history.push(`Round ${round.number}: answered "${d.text}"`);
    if (round.check && !round.check.passed && round.check.feedback) history.push(round.check.feedback);

    const result = round.act && round.act.result;
    if (d.type !== 'tool' || !result) continue;
    if (result.ok && d.name === 'search_handbook') {
      toolLines.push(`${formatCall(d)} -> ${result.data.passages.length} passages`);
      result.data.passages.forEach((p, i) => {
        knowledge.push(`[Passage ${i + 1} · chunk ${p.chunkNumber} · Section ${p.section ?? 'none'}]\n${p.text.trim()}`);
      });
    } else if (result.ok) {
      toolLines.push(`${formatCall(d)} -> ${JSON.stringify(result.data)}`);
    } else if (result.refused) {
      const reasons = result.rules.filter((r) => !r.passed).map((r) => r.message).join(' ');
      toolLines.push(`${formatCall(d)} -> refused: ${reasons}`);
    } else if (result.error) {
      toolLines.push(`${formatCall(d)} -> error: ${result.error}`);
    }
  }

  const texts = {
    instructions,
    knowledge: knowledge.join('\n\n'),
    tools: toolLines.join('\n'),
    history: history.join('\n'),
    preferences,
  };
  const parts = CONTEXT_TYPES.map((type) => ({
    type,
    text: texts[type],
    tokens: estimateTokens(texts[type], CHARS_PER_TOKEN_ESTIMATE),
  }));
  return { parts, total: parts.reduce((sum, p) => sum + p.tokens, 0) };
}
