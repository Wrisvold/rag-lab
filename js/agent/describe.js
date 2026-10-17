// Agent mode: the sentence for each loop event. Pure, no DOM.
//
// The page shows one line under the controls and screen readers announce
// it, so each part of each round must have a sentence a student can follow
// with the screen turned off. The text comes from AGENT.readout in js/copy.js.

import { AGENT } from '../copy.js';
import { fill } from '../dom.js';
import { AGENT_HARD_LIMIT } from '../constants.js';

const R = AGENT.readout;

const number = (value) => Number(value).toLocaleString('en-US');

/**
 * @param {object} event   an event from js/agent/loop.js
 * @returns {string}       the sentence, with the stop message added when the event stopped the run
 */
export function describeEvent(event) {
  const round = event.round;
  let text = '';
  switch (event.type) {
    case 'context':
      text = fill(R.context, { round, tokens: number(event.tokens), total: number(event.total) });
      break;
    case 'decide': {
      const d = event.decision;
      if (d.type === 'tool') text = fill(R.decideTool, { round, rule: d.rule || '-', tool: d.name });
      else if (d.type === 'answer') text = fill(R.decideAnswer, { round, rule: d.rule || '-' });
      else text = fill(R.decideGiveUp, { round, rule: d.rule || '-' });
      break;
    }
    case 'act':
      text = describeAct(event);
      break;
    case 'approval_needed':
      text = fill(R.approvalNeeded, { round, tool: event.decision.name });
      break;
    case 'check': {
      const failed = event.check.reasons.filter((r) => !r.passed);
      text = failed.length
        ? fill(R.checkFailed, { round, details: failed.map((r) => `${r.rule}: ${r.detail}`).join(' ') })
        : fill(R.checkPassed, { round });
      break;
    }
    case 'waiting':
      text = R.waiting;
      break;
    case 'refused':
    case 'stopped':
      text = '';
      break;
    default:
      text = '';
  }
  const stop = event.stop ? stopMessage(event.stop) : '';
  return [text, stop].filter(Boolean).join(' ');
}

function describeAct(event) {
  const round = event.round;
  if (event.kind === 'deliver') return fill(R.actDeliver, { round });
  if (event.kind === 'refused-by-rule') {
    return fill(R.actRefused, { round, reason: event.rules.filter((r) => !r.passed).map((r) => r.message).join(' ') });
  }
  const result = event.result;
  if (result.error) return fill(R.actError, { round });
  if (result.refused) {
    return fill(R.actRefused, { round, reason: result.rules.filter((r) => !r.passed).map((r) => r.message).join(' ') });
  }
  if (result.data && result.data.passages) {
    const best = result.data.passages[0];
    return fill(R.actSearch, {
      round,
      count: result.data.passages.length,
      chunk: best ? best.chunkNumber : '-',
      score: best ? best.score.toFixed(2) : '-',
    });
  }
  return fill(R.actTool, { round, tool: event.toolName || 'The tool' });
}

/** The stop message for a stop code, for example "The check accepted the answer. The loop stopped." */
// The teaching note for the same code is AGENT.stops[code].note; the page shows it under the message.
export function stopMessage(code) {
  const entry = AGENT.stops[code];
  return entry ? fill(entry.message, { limit: AGENT_HARD_LIMIT }) : code;
}
