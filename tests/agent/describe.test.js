// The readout: one sentence for each part of each round, so a student can
// follow the loop with a screen reader. Checked on the worked example.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeEvent, stopMessage } from '../../js/agent/describe.js';
import { createGlassBoxAgent } from '../../js/agent/glassBoxAgent.js';
import { createRun, runToEnd } from '../../js/agent/loop.js';
import { defaultPrompt } from '../../js/agent/context.js';
import { TOOL_NAMES } from '../../js/agent/tools.js';
import { fixtures } from './helpers.js';

test('each part of the worked example has a sentence, and the last one names the stop', async () => {
  const { handbook, scenario } = await fixtures();
  const agent = createGlassBoxAgent({ handbook, synonyms: { PTO: 'vacation' } });
  const lines = [];
  await runToEnd(
    createRun({ question: 'How many days of PTO do new employees get?', employeeId: 'E-101', prompt: defaultPrompt(), toolNames: TOOL_NAMES }),
    { agent, env: { handbook, scenario } },
    (event) => lines.push(describeEvent(event)),
  );
  assert.equal(lines.length, 12, 'three rounds of four parts');
  assert.ok(lines.every((line) => line.length > 0));
  assert.match(lines[0], /^Round 1, Context: the agent reads [\d,]+ tokens\./);
  assert.equal(lines[1], 'Round 1, Decide: rule R3 calls search_handbook.');
  assert.equal(lines[2], 'Round 1, Act: the search returned 3 passages. The best is chunk 2, with a score of 0.19.');
  assert.equal(lines[3], 'Round 1, Check: failed. C1: These words are not in the handbook: "pto".');
  assert.equal(lines[5], 'Round 2, Decide: rule F1 calls search_handbook.');
  assert.equal(lines[7], 'Round 2, Check: passed.');
  assert.equal(lines[9], 'Round 3, Decide: rule A1 gives an answer.');
  assert.equal(lines[10], 'Round 3, Act: the agent gives its answer. No tool runs.');
  assert.equal(lines[11], 'Round 3, Check: passed. The check accepted the answer. The loop stopped.');
});

test('the hard limit message names the limit', () => {
  assert.equal(stopMessage('HARD_LIMIT'), 'The loop stopped at the hard limit of 12 rounds. You set no other limit.');
});
