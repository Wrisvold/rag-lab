// Runs an Agent mode scenario with the Glass Box agent, outside the browser,
// and prints the run summary. The Phase 12 exit check (agent-mode-plan.md).
//
//   node tools/agent-run.mjs                    Exercise 2, after the student adds "PTO -> vacation"
//   node tools/agent-run.mjs --no-synonym       Exercise 2, before the synonym (the agent gives up)
//   node tools/agent-run.mjs --exercise 1       Exercise 1: no stop condition but the hard limit
//   node tools/agent-run.mjs --question "How many vacation days do I have left?" --employee E-102
//   node tools/agent-run.mjs --request 2026-11-30:2026-12-04 --employee E-103
//   node tools/agent-run.mjs --approve          approve a write action when the run waits for a person
//   node tools/agent-run.mjs --verbose          print each part of each round as it happens

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const js = (name) => new URL(`../js/${name}`, import.meta.url);

const C = await import(js('constants.js'));
const { SAMPLE_QUESTIONS } = await import(js('copy.js'));
const { createHandbook } = await import(js('agent/handbook.js'));
const { createGlassBoxAgent } = await import(js('agent/glassBoxAgent.js'));
const { createRun, runToEnd, approve, refuse } = await import(js('agent/loop.js'));
const { defaultPrompt } = await import(js('agent/context.js'));
const { TOOL_NAMES } = await import(js('agent/tools.js'));
const { formatAgentRunSummary } = await import(js('agent/summary.js'));

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

const text = readFileSync(join(root, C.SAMPLE_DOCUMENT_PATH), 'utf8');
const scenario = JSON.parse(readFileSync(join(root, C.AGENT_SCENARIO_PATH), 'utf8'));
const handbook = createHandbook(text);

const exercise1 = value('--exercise') === '1';
const synonyms = flag('--no-synonym') || exercise1 ? {} : { PTO: 'vacation' };
const agent = createGlassBoxAgent(exercise1
  ? { handbook, synonyms, scoreThreshold: 0.9, f3: false }
  : { handbook, synonyms });

const requestArg = value('--request');
const request = requestArg ? { start_date: requestArg.split(':')[0], end_date: requestArg.split(':')[1] } : null;

let state = createRun({
  question: value('--question') || (request ? 'I want to take a vacation.' : SAMPLE_QUESTIONS.find((q) => q.key === 'synonym').text),
  request,
  employeeId: value('--employee') || scenario.employees[0].id,
  prompt: defaultPrompt(),
  toolNames: TOOL_NAMES,
  settings: exercise1 ? { maxRounds: null, tokenBudget: null, repeatStop: false } : {},
});

const deps = { agent, env: { handbook, scenario } };
const onEvent = flag('--verbose')
  ? (event) => console.log(`  round ${event.round ?? '-'} · ${event.type}${event.stop ? ` -> ${event.stop}` : ''}`)
  : () => {};

state = await runToEnd(state, deps, onEvent);
while (state.status === 'waiting_for_approval') {
  const decision = state.pending.decision;
  console.log(`\nWaiting for a person: ${decision.name}(${JSON.stringify(decision.args)})`);
  if (flag('--approve')) {
    console.log('Approved (--approve).');
    state = (await approve(state, deps)).state;
    state = await runToEnd(state, deps, onEvent);
  } else {
    console.log('Refused. Use --approve to approve it.');
    state = refuse(state).state;
  }
}

console.log('\n' + formatAgentRunSummary(state, { scenario, agentKind: 'glass' }));
