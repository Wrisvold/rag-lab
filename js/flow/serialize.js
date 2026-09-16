// Flow mode: a graph as JSON and back. Pure.
//
// The export is written to be read by a person or by the course notebook:
//
//   {
//     "format": "rag-lab-flow",
//     "version": 1,
//     "pipeline": [                              // execution order
//       { "id": "document-1", "type": "document", "params": { "name": "sample.txt", "sample": true }, "inputs": {} },
//       { "id": "chunk-2",    "type": "chunk",    "params": { "CHUNK_SIZE": 400, "CHUNK_OVERLAP": 50 }, "inputs": { "text": "document-1" } },
//       ...
//     ],
//     "layout": { "document-1": { "x": 40, "y": 120 }, ... }   // the notebook ignores this
//   }
//
// Parameters use the notebook's names where one exists (FLOW_NOTEBOOK_NAMES).
// An input names the node it is wired from; every node has at most one
// output, so the port is implied. Artifacts are never exported: a loaded
// graph is re-run. The API key is never a parameter, so it cannot appear here.

import * as C from '../constants.js';
import { nodeType } from './registry.js';
import { createGraph, addNode, connect, order } from './graph.js';

export const FORMAT = 'rag-lab-flow';

export function toJSON(graph) {
  const ids = order(graph);
  const runnable = ids.filter((id) => nodeType(graph.nodes.get(id).type).runnable !== false);
  const decorative = ids.filter((id) => !runnable.includes(id));
  const pipeline = [...runnable, ...decorative].map((id) => {
    const node = graph.nodes.get(id);
    const inputs = {};
    for (const edge of graph.edges.values()) {
      if (edge.to.node === id) inputs[edge.to.port] = edge.from.node;
    }
    return { id, type: node.type, params: exportParams(node), inputs };
  });
  const layout = {};
  for (const id of ids) {
    const { x, y } = graph.nodes.get(id).position;
    layout[id] = { x, y };
  }
  return { format: FORMAT, version: C.FLOW_EXPORT_VERSION, pipeline, layout };
}

/**
 * @throws {Error} with code BAD_FORMAT, BAD_VERSION, BAD_NODE (with `type`),
 *   or BAD_EDGE (with `reason`, a refusal code)
 */
export function fromJSON(json) {
  if (!json || json.format !== FORMAT || !Array.isArray(json.pipeline)) throw coded('Not a RAG Lab graph', 'BAD_FORMAT');
  if (typeof json.version !== 'number' || json.version > C.FLOW_EXPORT_VERSION) throw coded('Unsupported graph version', 'BAD_VERSION');

  const graph = createGraph();
  const layout = json.layout || {};
  for (const entry of json.pipeline) {
    const definition = nodeType(entry.type);
    if (!definition) throw Object.assign(coded(`Unknown node type ${entry.type}`, 'BAD_NODE'), { type: entry.type });
    addNode(graph, entry.type, {
      id: entry.id,
      params: importParams(entry.params || {}),
      position: layout[entry.id] || { x: 0, y: 0 },
    });
  }
  for (const entry of json.pipeline) {
    for (const [port, sourceId] of Object.entries(entry.inputs || {})) {
      const source = graph.nodes.get(sourceId);
      const outPort = source && nodeType(source.type).outputs[0];
      const result = source && outPort
        ? connect(graph, { node: sourceId, port: outPort.id }, { node: entry.id, port })
        : { ok: false, code: 'UNKNOWN_NODE' };
      if (!result.ok) throw Object.assign(coded(`Cannot wire ${sourceId} to ${entry.id}.${port}`, 'BAD_EDGE'), { reason: result.code });
    }
  }
  return graph;
}

// Notebook names out; the sample document by reference rather than by text.
function exportParams(node) {
  const out = {};
  for (const [key, value] of Object.entries(node.params)) {
    out[C.FLOW_NOTEBOOK_NAMES[key] || key] = value;
  }
  if (node.type === 'document' && node.params.name === C.SAMPLE_DOCUMENT_NAME) {
    delete out.text;
    out.sample = true;
  }
  return out;
}

const OWN_NAMES = Object.fromEntries(Object.entries(C.FLOW_NOTEBOOK_NAMES).map(([own, notebook]) => [notebook, own]));

function importParams(params) {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (key === 'sample') continue; // the loader fetches the sample text (Phase 9)
    out[OWN_NAMES[key] || key] = value;
  }
  return out;
}

function coded(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}
