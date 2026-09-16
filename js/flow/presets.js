// Flow mode: ready-made graphs. Phase 7 has one, the canonical six-node
// chain that matches the walkthrough. The exercises arrive in Phase 10 as
// more entries in this file.

import * as C from '../constants.js';
import { createGraph, addNode, connect } from './graph.js';

/**
 * Document -> Chunk -> Embed -> Retrieve <- Question, Retrieve -> Assemble <- Question,
 * Assemble -> Answer. Every wire is accepted by construction.
 *
 * @param {{ text?: string, name?: string, question?: string, mode?: 'glass'|'black' }} [options]
 * @returns {{ graph, ids: { document, chunk, embed, question, retrieve, assemble, answer } }}
 */
export function canonicalGraph({ text = '', name = C.SAMPLE_DOCUMENT_NAME, question = '', mode = 'glass' } = {}) {
  const graph = createGraph();
  const step = C.FLOW_NODE_WIDTH + C.FLOW_COLUMN_GAP;
  const column = (index) => ({ x: C.FLOW_CANVAS_PADDING + index * step, y: C.FLOW_CANVAS_PADDING });
  const document = addNode(graph, 'document', { params: { text, name }, position: column(0) });
  const chunk = addNode(graph, 'chunk', { position: column(1) });
  const embed = addNode(graph, 'embed', { params: { mode }, position: column(2) });
  const questionNode = addNode(graph, 'question', { params: { text: question }, position: { x: column(2).x, y: C.FLOW_CANVAS_PADDING + C.FLOW_ROW_GAP } });
  const retrieve = addNode(graph, 'retrieve', { position: column(3) });
  const assemble = addNode(graph, 'assemble', { position: column(4) });
  const answer = addNode(graph, 'answer', { position: column(5) });

  wire(graph, document, 'text', chunk, 'text');
  wire(graph, chunk, 'chunks', embed, 'chunks');
  wire(graph, embed, 'vectors', retrieve, 'vectors');
  wire(graph, questionNode, 'question', retrieve, 'question');
  wire(graph, retrieve, 'passages', assemble, 'passages');
  wire(graph, questionNode, 'question', assemble, 'question');
  wire(graph, assemble, 'prompt', answer, 'prompt');

  return {
    graph,
    ids: {
      document: document.id, chunk: chunk.id, embed: embed.id, question: questionNode.id,
      retrieve: retrieve.id, assemble: assemble.id, answer: answer.id,
    },
  };
}

function wire(graph, from, fromPort, to, toPort) {
  const result = connect(graph, { node: from.id, port: fromPort }, { node: to.id, port: toPort });
  if (!result.ok) throw new Error(`Preset wiring refused: ${from.id} -> ${to.id} (${result.code})`);
  return result.edge;
}
