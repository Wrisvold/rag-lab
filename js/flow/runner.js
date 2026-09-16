// Flow mode: runs a graph. Walks the nodes in execution order, awaits each
// one, and writes the result back onto the node as an artifact. Pure apart
// from the compute modules it calls through the registry.
//
// `context` carries the things a node may need that are not parameters:
//   { apiKey, blackBox, askModel, onProgress }
// `hooks` let the page react: { onStart(node), onDone(node), onError(node, error) }
//
// A report says what happened to every node:
//   { ran: [id], fresh: [id], skipped: [{ id, ...blocker }], failed: [{ id, code, message }] }

import { nodeType } from './registry.js';
import { order, ancestors, inputEdge, isStale, blocker } from './graph.js';

/**
 * Run every node that is missing an artifact or stale, in order.
 * With `force`, re-run everything that can run.
 */
export async function runGraph(graph, context = {}, hooks = {}, { force = false } = {}) {
  const report = emptyReport();
  for (const nodeId of order(graph)) {
    await runOne(graph, nodeId, context, hooks, force, report);
  }
  return report;
}

/**
 * Run one node and, first, any of its ancestors that are missing or stale,
 * the way "Retrieve" in the walkthrough re-chunks and re-embeds if it must.
 * The node itself always re-runs.
 */
export async function runNode(graph, nodeId, context = {}, hooks = {}) {
  const report = emptyReport();
  for (const ancestorId of ancestors(graph, nodeId)) {
    await runOne(graph, ancestorId, context, hooks, false, report);
  }
  await runOne(graph, nodeId, context, hooks, true, report);
  return report;
}

async function runOne(graph, nodeId, context, hooks, force, report) {
  const node = graph.nodes.get(nodeId);
  const definition = nodeType(node.type);

  const blocked = blocker(graph, nodeId);
  if (blocked) {
    // A blocked node cannot keep an artifact it could not make now.
    if (blocked.reason !== 'notRunnable') node.artifact = null;
    report.skipped.push({ id: nodeId, ...blocked });
    return;
  }
  if (!force && node.artifact && !isStale(graph, nodeId)) {
    report.fresh.push(nodeId);
    return;
  }

  const inputs = {};
  const recorded = {};
  for (const port of definition.inputs) {
    const source = graph.nodes.get(inputEdge(graph, nodeId, port.id).from.node);
    inputs[port.id] = source.artifact.output;
    recorded[port.id] = { node: source.id, version: source.artifact.version };
  }

  if (hooks.onStart) hooks.onStart(node);
  try {
    const output = await definition.run(inputs, node.params, context);
    node.runs += 1;
    node.artifact = { output, inputs: recorded, params: { ...node.params }, version: node.runs };
    node.error = null;
    report.ran.push(nodeId);
    if (hooks.onDone) hooks.onDone(node);
  } catch (error) {
    node.artifact = null;
    node.error = { code: error && error.code ? error.code : 'FAILED', message: error && error.message ? error.message : String(error) };
    report.failed.push({ id: nodeId, ...node.error });
    if (hooks.onError) hooks.onError(node, node.error);
  }
}

function emptyReport() {
  return { ran: [], fresh: [], skipped: [], failed: [] };
}
