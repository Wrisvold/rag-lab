// Flow mode: turns codes from the graph and the runner into sentences from
// copy.js. The only module in js/flow/ that reads copy; graph.js and
// runner.js stay copy-free so their tests need no text.

import { fill } from '../dom.js';
import { FLOW, DIALS, CALLOUTS, STATION_ANSWER } from '../copy.js';

/** A refused `connect` result -> one sentence for the readout line. */
export function explainRefusal(result, flow = FLOW) {
  switch (result.code) {
    case 'SELF_LOOP': return flow.refusals.selfLoop;
    case 'INPUT_TAKEN': return flow.refusals.inputTaken;
    case 'CYCLE': return flow.refusals.cycle;
    case 'TYPE_MISMATCH': {
      const pair = flow.pairs[`${result.got}->${result.needs}`];
      if (pair) return pair;
      return fill(flow.refusals.typeMismatch, { needs: flow.portNames[result.needs], got: flow.portNames[result.got] });
    }
    default: return fill(flow.refusals.typeMismatch, { needs: '', got: '' });
  }
}

/** A `skipped` entry from a run report -> one sentence. */
export function explainSkip(entry, flow = FLOW) {
  if (entry.reason === 'missingInput') {
    const names = entry.ports.map((port) => flow.portNames[portTypeOf(entry, port)] || port);
    return fill(flow.skipped.missingInput, { port: names.join(' and ') });
  }
  if (entry.reason === 'upstreamMissing') return flow.skipped.upstreamMissing;
  return flow.skipped.notRunnable;
}

/**
 * A node error `{ code, message }` -> one sentence. Codes the walkthrough
 * already explains reuse its wording, so the two modes never disagree.
 */
export function explainError(error, flow = FLOW) {
  const code = error && error.code;
  if (code === 'OVERLAP_TOO_LARGE') return DIALS.overlapTooLarge;
  if (code === 'BLACK_BOX_UNAVAILABLE') return CALLOUTS.modelFailed;
  if (STATION_ANSWER.errors[code]) return STATION_ANSWER.errors[code];
  return flow.errors[code] || flow.errors.FAILED;
}

/** A `fromJSON` error -> one sentence. */
export function explainLoadError(error, flow = FLOW) {
  switch (error && error.code) {
    case 'BAD_VERSION': return flow.load.badVersion;
    case 'BAD_NODE': return fill(flow.load.badNode, { type: error.type });
    case 'BAD_EDGE': return fill(flow.load.badEdge, { reason: explainRefusal({ code: error.reason }) });
    default: return flow.load.badFormat;
  }
}

// Port ids happen to equal port types for every input in the registry
// (a Retrieve node's "vectors" input carries vectors). Kept in one place in
// case that ever changes.
function portTypeOf(entry, portId) {
  return entry.types && entry.types[portId] ? entry.types[portId] : portId;
}
