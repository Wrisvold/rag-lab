// Flow mode: the graph. Nodes, wires, port type checks, execution order, and
// staleness. Pure: no DOM, no globals, no copy. Every function that changes
// the graph mutates the object it is given and returns what it changed.
//
// A node:
//   { id, type, params, position: { x, y }, runs, artifact, error }
// An artifact, written by the runner:
//   { output, inputs: { portId: { node, version } }, params, version }
// A wire ("edge"):
//   { id, from: { node, port }, to: { node, port } }
//
// Staleness is computed, never guessed: an artifact remembers the parameter
// values and the upstream artifact versions it was made from, exactly as the
// walkthrough's artifacts remember their settings and document version. So
// setting a dial back to what it was clears the stale mark, as it does there.

import { nodeType, findPort } from './registry.js';

/** Codes `connect` can refuse with. copy.js FLOW.refusals explains each one. */
export const REFUSALS = {
  UNKNOWN_NODE: 'UNKNOWN_NODE',
  UNKNOWN_PORT: 'UNKNOWN_PORT',
  SELF_LOOP: 'SELF_LOOP',
  TYPE_MISMATCH: 'TYPE_MISMATCH',
  INPUT_TAKEN: 'INPUT_TAKEN',
  CYCLE: 'CYCLE',
};

export function createGraph() {
  return { nodes: new Map(), edges: new Map(), nextId: 1 };
}

/**
 * Add a node. Parameters not given take the registry defaults.
 * @returns the new node
 * @throws {Error} with code UNKNOWN_TYPE or DUPLICATE_ID
 */
export function addNode(graph, type, { params = {}, position = { x: 0, y: 0 }, id } = {}) {
  const definition = nodeType(type);
  if (!definition) throw coded(`Unknown node type: ${type}`, 'UNKNOWN_TYPE');
  const nodeId = id || `${type}-${graph.nextId}`;
  if (graph.nodes.has(nodeId)) throw coded(`A node called ${nodeId} already exists`, 'DUPLICATE_ID');
  claimId(graph, nodeId);
  const node = {
    id: nodeId,
    type,
    params: { ...definition.params, ...pick(params, Object.keys(definition.params)) },
    position: { x: position.x, y: position.y },
    runs: 0,
    artifact: null,
    error: null,
  };
  graph.nodes.set(nodeId, node);
  return node;
}

/** Remove a node and every wire touching it. Returns the removed edge ids. */
export function removeNode(graph, nodeId) {
  if (!graph.nodes.has(nodeId)) return [];
  const removed = [];
  for (const edge of graph.edges.values()) {
    if (edge.from.node === nodeId || edge.to.node === nodeId) removed.push(edge.id);
  }
  for (const edgeId of removed) graph.edges.delete(edgeId);
  graph.nodes.delete(nodeId);
  return removed;
}

/**
 * Wire an output port to an input port.
 * @param {{ node: string, port: string }} from   an output port
 * @param {{ node: string, port: string }} to     an input port
 * @returns {{ ok: true, edge } | { ok: false, code, needs?, got? }}
 */
export function connect(graph, from, to) {
  const source = graph.nodes.get(from.node);
  const target = graph.nodes.get(to.node);
  if (!source || !target) return { ok: false, code: REFUSALS.UNKNOWN_NODE };
  const outPort = findPort(nodeType(source.type), 'outputs', from.port);
  const inPort = findPort(nodeType(target.type), 'inputs', to.port);
  if (!outPort || !inPort) return { ok: false, code: REFUSALS.UNKNOWN_PORT };
  if (from.node === to.node) return { ok: false, code: REFUSALS.SELF_LOOP };
  if (outPort.type !== inPort.type) {
    return { ok: false, code: REFUSALS.TYPE_MISMATCH, needs: inPort.type, got: outPort.type };
  }
  if (inputEdge(graph, to.node, to.port)) return { ok: false, code: REFUSALS.INPUT_TAKEN };
  if (reaches(graph, to.node, from.node)) return { ok: false, code: REFUSALS.CYCLE };

  const edge = { id: `edge-${graph.nextId}`, from: { ...from }, to: { ...to } };
  claimId(graph, edge.id);
  graph.edges.set(edge.id, edge);
  return { ok: true, edge };
}

/** Remove a wire. Returns true if it existed. */
export function disconnect(graph, edgeId) {
  return graph.edges.delete(edgeId);
}

/**
 * Change one parameter.
 * @returns {boolean} whether the value actually changed
 * @throws {Error} with code UNKNOWN_NODE or UNKNOWN_PARAM
 */
export function setParam(graph, nodeId, key, value) {
  const node = mustGet(graph, nodeId);
  if (!(key in nodeType(node.type).params)) throw coded(`${node.type} has no parameter ${key}`, 'UNKNOWN_PARAM');
  if (node.params[key] === value) return false;
  node.params[key] = value;
  return true;
}

export function moveNode(graph, nodeId, position) {
  const node = mustGet(graph, nodeId);
  node.position = { x: position.x, y: position.y };
  return node;
}

/** The wire into an input port, or null. Inputs take at most one wire. */
export function inputEdge(graph, nodeId, portId) {
  for (const edge of graph.edges.values()) {
    if (edge.to.node === nodeId && edge.to.port === portId) return edge;
  }
  return null;
}

/** Every wire leaving a node. */
export function outputEdges(graph, nodeId) {
  return [...graph.edges.values()].filter((edge) => edge.from.node === nodeId);
}

/** Input ports of a node that have no wire. */
export function missingInputs(graph, nodeId) {
  const node = mustGet(graph, nodeId);
  return nodeType(node.type).inputs
    .filter((port) => !inputEdge(graph, nodeId, port.id))
    .map((port) => port.id);
}

/**
 * Execution order: every node id, sources before the nodes that depend on
 * them, ties broken by insertion order. `connect` refuses cycles, so this
 * always succeeds; the throw is a guard against a hand-edited graph.
 */
export function order(graph) {
  const remaining = new Map();
  for (const id of graph.nodes.keys()) remaining.set(id, 0);
  for (const edge of graph.edges.values()) remaining.set(edge.to.node, remaining.get(edge.to.node) + 1);

  const result = [];
  let progressed = true;
  while (remaining.size && progressed) {
    progressed = false;
    for (const [id, pending] of remaining) {
      if (pending !== 0) continue;
      result.push(id);
      remaining.delete(id);
      for (const edge of outputEdges(graph, id)) remaining.set(edge.to.node, remaining.get(edge.to.node) - 1);
      progressed = true;
      break; // restart the scan so insertion order still decides ties
    }
  }
  if (remaining.size) throw coded('The graph contains a cycle', 'CYCLE');
  return result;
}

/** Every node downstream of `nodeId`, in execution order. */
export function dependents(graph, nodeId) {
  const seen = new Set();
  const walk = (id) => {
    for (const edge of outputEdges(graph, id)) {
      if (!seen.has(edge.to.node)) { seen.add(edge.to.node); walk(edge.to.node); }
    }
  };
  walk(nodeId);
  return order(graph).filter((id) => seen.has(id));
}

/** Every node upstream of `nodeId`, in execution order. */
export function ancestors(graph, nodeId) {
  const seen = new Set();
  const walk = (id) => {
    for (const edge of graph.edges.values()) {
      if (edge.to.node === id && !seen.has(edge.from.node)) { seen.add(edge.from.node); walk(edge.from.node); }
    }
  };
  walk(nodeId);
  return order(graph).filter((id) => seen.has(id));
}

/**
 * True when a node has an artifact that no longer matches its parameters or
 * the artifacts it was made from. A node with no artifact is not stale;
 * it is simply not run yet.
 */
export function isStale(graph, nodeId) {
  const node = mustGet(graph, nodeId);
  const artifact = node.artifact;
  if (!artifact) return false;
  if (!sameParams(artifact.params, node.params)) return true;
  for (const port of nodeType(node.type).inputs) {
    const edge = inputEdge(graph, nodeId, port.id);
    if (!edge) return true;
    const source = graph.nodes.get(edge.from.node);
    const recorded = artifact.inputs[port.id];
    if (!source || !source.artifact) return true;
    if (!recorded || recorded.node !== source.id || recorded.version !== source.artifact.version) return true;
    if (isStale(graph, source.id)) return true;
  }
  return false;
}

/**
 * Why a node cannot run right now, or null when it can.
 * @returns {null | { reason: 'notRunnable' } | { reason: 'missingInput', ports: string[] } | { reason: 'upstreamMissing', nodes: string[] }}
 */
export function blocker(graph, nodeId) {
  const node = mustGet(graph, nodeId);
  const definition = nodeType(node.type);
  if (definition.runnable === false) return { reason: 'notRunnable' };
  const missing = missingInputs(graph, nodeId);
  if (missing.length) return { reason: 'missingInput', ports: missing };
  const waiting = [];
  for (const port of definition.inputs) {
    const source = graph.nodes.get(inputEdge(graph, nodeId, port.id).from.node);
    if (!source.artifact || isStale(graph, source.id)) waiting.push(source.id);
  }
  if (waiting.length) return { reason: 'upstreamMissing', nodes: waiting };
  return null;
}

// Parameters are strings, numbers, and booleans, so a shallow comparison is exact.
function sameParams(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const key of keys) if (a[key] !== b[key]) return false;
  return true;
}

/** Is there a path from `startId` to `goalId` along wires? */
function reaches(graph, startId, goalId) {
  const stack = [startId];
  const seen = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (id === goalId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const edge of outputEdges(graph, id)) stack.push(edge.to.node);
  }
  return false;
}

// Ids end in a number; keep the counter above every number in use so a graph
// loaded from JSON keeps minting fresh ids.
function claimId(graph, id) {
  const match = /(\d+)$/.exec(id);
  if (match) graph.nextId = Math.max(graph.nextId, Number(match[1]) + 1);
  else graph.nextId += 1;
}

function mustGet(graph, nodeId) {
  const node = graph.nodes.get(nodeId);
  if (!node) throw coded(`No node called ${nodeId}`, 'UNKNOWN_NODE');
  return node;
}

function pick(object, keys) {
  const out = {};
  for (const key of keys) if (key in object) out[key] = object[key];
  return out;
}

function coded(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}
