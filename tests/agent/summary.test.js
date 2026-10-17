import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAgentRunSummary } from '../../js/agent/summary.js';
import { createGlassBoxAgent } from '../../js/agent/glassBoxAgent.js';
import { createRun, runToEnd } from '../../js/agent/loop.js';
import { defaultPrompt } from '../../js/agent/context.js';
import { TOOL_NAMES } from '../../js/agent/tools.js';
import { fixtures } from './helpers.js';

test('the run summary of the worked example', async () => {
  const { handbook, scenario } = await fixtures();
  const agent = createGlassBoxAgent({ handbook, synonyms: { PTO: 'vacation' } });
  const state = await runToEnd(
    createRun({ question: 'How many days of PTO do new employees get?', employeeId: 'E-101', prompt: defaultPrompt(), toolNames: TOOL_NAMES }),
    { agent, env: { handbook, scenario } },
  );
  const text = formatAgentRunSummary(state, { scenario, agentKind: 'glass' });
  const lines = text.split('\n');

  assert.equal(lines[0], 'RAG Lab · Agent mode run · 2026-11-02 (simulated date)');
  assert.equal(lines[1], 'Agent: Glass Box · Employee: E-101 (New employee)');
  assert.match(text, /System prompt: v1 "Default" \(6 sections, 6 enabled, not read by the Glass Box agent\)/);
  assert.match(text, /Settings: MAX_ROUNDS=4 {2}TOKEN_BUDGET=8000 {2}REPEAT_STOP=on/);
  assert.match(text, /Round 1 {2}decide: R3 search_handbook/);
  assert.match(text, /check: {2}FAILED C1 - These words are not in the handbook: "pto"\./);
  assert.match(text, /act: {4}chunks 08 \(0\.24, Section 3\.1\), 02 \(0\.17, Section 1\.1\), 09 \(0\.14, Section 3\.1\)/);
  assert.match(text, /answer: A newly hired employee gets ten vacation days a year\. \[3\.1\]/);
  assert.match(lines[lines.length - 1], /^Stop: ANSWER_ACCEPTED after 3 rounds · about [\d,]+ tokens$/);
});
