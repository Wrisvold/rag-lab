import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toolSchemas, checkRules, rulesPass, runTool, dayNumber, workDays, countOf, TOOL_NAMES } from '../../js/agent/tools.js';
import { fixtures } from './helpers.js';

const env = (scenario, employeeId, extra = {}) => ({ scenario, employeeId, ...extra });
const failed = (results) => results.filter((r) => !r.passed).map((r) => r.rule);

test('each tool description is 25 words or fewer, and each schema lists its required parameters', () => {
  for (const schema of toolSchemas()) {
    assert.ok(schema.description.split(/\s+/).length <= 25, schema.name);
    assert.ok(!schema.description.includes(';'), schema.name);
    for (const name of schema.parameters.required) assert.ok(schema.parameters.properties[name], `${schema.name}.${name}`);
  }
  assert.deepEqual(toolSchemas(['search_handbook']).map((s) => s.name), ['search_handbook'], 'only enabled tools');
  assert.deepEqual(TOOL_NAMES, ['search_handbook', 'get_vacation_balance', 'submit_vacation_request']);
});

test('dates: real dates only, and work days are Monday to Friday', () => {
  assert.equal(dayNumber('2026-02-30'), null);
  assert.equal(dayNumber('30/11/2026'), null);
  assert.equal(workDays(dayNumber('2026-11-30'), dayNumber('2026-12-04')), 5, 'Monday to Friday');
  assert.equal(workDays(dayNumber('2026-11-27'), dayNumber('2026-11-30')), 2, 'Friday to Monday skips the weekend');
  assert.equal(countOf(1), '1 day');
  assert.equal(countOf(7), '7 days');
  assert.equal(countOf(1, 'work'), '1 work day');
});

test('vacation data only for the employee who asks (Section 5.2)', async () => {
  const { scenario } = await fixtures();
  assert.deepEqual(failed(checkRules('get_vacation_balance', { employee_id: 'E-102' }, env(scenario, 'E-101'))), ['owner']);
  const result = await runTool('get_vacation_balance', { employee_id: 'E-102' }, env(scenario, 'E-101'));
  assert.equal(result.ok, false);
  assert.equal(result.refused, true);
  assert.match(result.rules[0].message, /\[5\.2\]/);
});

test('the rules in code for a vacation request (Section 3.1)', async () => {
  const { scenario } = await fixtures();   // today is 2026-11-02
  const ask = (id, start, end) => failed(checkRules('submit_vacation_request', { employee_id: id, start_date: start, end_date: end }, env(scenario, id)));
  assert.deepEqual(ask('E-103', '2026-11-30', '2026-12-04'), [], 'a good request');
  assert.deepEqual(ask('E-103', '2026-11-09', '2026-11-10'), ['notice'], '7 days of notice');
  assert.deepEqual(ask('E-103', '2026-11-16', '2026-11-16'), [], 'exactly 14 days of notice is enough');
  assert.deepEqual(ask('E-101', '2026-12-01', '2026-12-01'), ['service'], '78 days of service on 1 December');
  assert.deepEqual(ask('E-102', '2026-11-30', '2026-12-09'), ['balance'], '8 work days, 6 left');
  assert.deepEqual(ask('E-103', '2026-12-04', '2026-11-30'), ['dates'], 'the end is before the start');
});

test('a disabled rule passes and says that it is disabled (Exercise 4)', async () => {
  const { scenario } = await fixtures();
  const results = checkRules('submit_vacation_request', { employee_id: 'E-103', start_date: '2026-11-09', end_date: '2026-11-10' },
    env(scenario, 'E-103', { disabledRules: ['notice'] }));
  assert.ok(rulesPass(results));
  assert.equal(results.find((r) => r.rule === 'notice').disabled, true);
});

test('running the tools', async () => {
  const { scenario, handbook } = await fixtures();
  const search = await runTool('search_handbook', { query: 'vacation days', top_k: 2 }, env(scenario, 'E-101', { handbook }));
  assert.equal(search.ok, true);
  assert.equal(search.data.passages.length, 2);

  const balance = await runTool('get_vacation_balance', { employee_id: 'E-102' }, env(scenario, 'E-102'));
  assert.deepEqual(balance.data, { employee_id: 'E-102', vacation_days_left: 6 });

  const recorded = await runTool('submit_vacation_request', { employee_id: 'E-103', start_date: '2026-11-30', end_date: '2026-12-04' }, env(scenario, 'E-103'));
  assert.equal(recorded.data.recorded.work_days, 5);

  await assert.rejects(runTool('send_email', {}, env(scenario, 'E-101')), { code: 'UNKNOWN_TOOL' });
  await assert.rejects(runTool('search_handbook', { query: 'x' }, env(scenario, 'E-101')), { code: 'NO_HANDBOOK' });
});
