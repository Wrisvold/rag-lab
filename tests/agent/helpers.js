// Shared set-up for the Agent mode tests: the sample handbook and the
// fictional Fall Line scenario, loaded the way tools/agent-run.mjs loads them.
import { readFile } from 'node:fs/promises';
import { createHandbook } from '../../js/agent/handbook.js';

export const handbookText = () => readFile(new URL('../../data/sample.txt', import.meta.url), 'utf8');
export const loadScenario = async () => JSON.parse(await readFile(new URL('../../data/agent-scenario.json', import.meta.url), 'utf8'));

export async function fixtures() {
  const text = await handbookText();
  return { text, handbook: createHandbook(text), scenario: await loadScenario() };
}

/** Freeze an object and everything inside it, so a test fails if code changes it. */
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}
