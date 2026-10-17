// Agent mode: the run summary that students paste into assignments. Pure.
//
// One block of plain text: who ran, with which prompt and settings, then one
// entry per round (decide, act, check), then the stop reason and the tokens.
// The key of a model provider is never part of it.

import { AGENT } from '../copy.js';
import { fill } from '../dom.js';
import { formatCall } from './context.js';

const INDENT = '         ';

/**
 * @param {object} state      a run from js/agent/loop.js
 * @param {{ scenario: object, agentKind: 'glass' | 'black', provider?: string, model?: string }} info
 *   Token counts are estimates unless the provider reported them (the Black Box agent).
 */
export function formatAgentRunSummary(state, { scenario, agentKind, provider = '', model = '' }) {
  const estimated = !state.measured;
  const employee = scenario.employees.find((e) => e.id === state.employeeId);
  const enabled = state.prompt.sections.filter((s) => s.enabled).length;
  const promptNote = agentKind === 'glass' ? `, ${AGENT.summary.promptGlass}` : '';
  const limit = (value) => (value === null ? AGENT.summary.noLimit : String(value));
  const { maxRounds, tokenBudget, repeatStop } = state.settings;

  const lines = [
    fill(AGENT.summary.title, { date: scenario.today }),
    `Agent: ${agentKind === 'glass' ? AGENT.summary.agentGlass : fill(AGENT.summary.agentBlack, { provider, model })} · Employee: ${employee.id} (${employee.label})`,
    `System prompt: ${state.prompt.version} "${state.prompt.name}" (${state.prompt.sections.length} sections, ${enabled} enabled${promptNote})`,
    `Settings: MAX_ROUNDS=${limit(maxRounds)}  TOKEN_BUDGET=${limit(tokenBudget)}  REPEAT_STOP=${repeatStop ? 'on' : 'off'}`,
    `Question: ${state.question}`,
  ];
  if (state.request) lines.push(`Request form: from ${state.request.start_date} to ${state.request.end_date}`);
  if (state.settings.disabledRules && state.settings.disabledRules.length) {
    lines.push(`Rules in code turned off: ${state.settings.disabledRules.join(', ')}`);
  }
  lines.push('');

  for (const round of state.rounds) {
    if (!round.decision) {
      // The token budget stops a run in the context part, before the decision.
      if (state.stopReason && round.context) {
        lines.push(`${`Round ${round.number}`.padEnd(INDENT.length - 2)}  ${fill(AGENT.summary.contextOnly, { tokens: round.context.total.toLocaleString('en-US') })}`);
        if (round.error) lines.push(`${INDENT}error:  ${round.error}`);
      }
      continue;
    }
    const d = round.decision;
    const label = `Round ${round.number}`.padEnd(INDENT.length - 2);
    const rule = d.rule ? `${d.rule} ` : '';
    if (d.type === 'tool') lines.push(`${label}  decide: ${rule}${formatCall(d)}`);
    else if (d.type === 'answer') lines.push(`${label}  decide: ${rule}answer`);
    else lines.push(`${label}  decide: ${rule}cannot answer`);

    if (round.approval) lines.push(`${INDENT}approval: ${round.approval.status}`);
    const act = round.act;
    if (act) {
      if (act.kind === 'deliver') lines.push(`${INDENT}answer: ${d.text}`);
      else if (act.kind === 'refused-by-person') lines.push(`${INDENT}act:    not run. A person refused it.`);
      else lines.push(`${INDENT}act:    ${describeResult(d, act.result)}`);
    }
    if (round.error) lines.push(`${INDENT}error:  ${round.error}`);
    if (round.check) {
      const failed = round.check.reasons.filter((r) => !r.passed);
      lines.push(failed.length
        ? `${INDENT}check:  FAILED ${failed.map((r) => `${r.rule} - ${r.detail}`).join(' · ')}`
        : `${INDENT}check:  passed ${round.check.reasons.map((r) => r.rule).join(' ')}`);
    }
  }

  lines.push('');
  const rounds = state.rounds.filter((r) => r.decision).length;
  const tokens = `${estimated ? 'about ' : ''}${state.tokens.toLocaleString('en-US')} tokens`;
  lines.push(state.stopReason
    ? `Stop: ${state.stopReason} after ${rounds} round${rounds === 1 ? '' : 's'} · ${tokens}`
    : `Not stopped yet: round ${state.round}, part ${state.part} · ${tokens}`);
  return lines.join('\n');
}

function describeResult(decision, result) {
  if (!result) return 'no result';
  if (result.error) return `error: ${result.error}`;
  if (result.refused) {
    return `refused by a rule in code. ${result.rules.filter((r) => !r.passed).map((r) => r.message).join(' ')}`;
  }
  if (decision.name === 'search_handbook') {
    return 'chunks ' + result.data.passages
      .map((p) => `${p.chunkNumber.toString().padStart(2, '0')} (${p.score.toFixed(2)}${p.section ? `, Section ${p.section}` : ''})`)
      .join(', ');
  }
  return JSON.stringify(result.data);
}
