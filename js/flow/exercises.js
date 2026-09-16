// Flow mode: the exercises. Each one builds a canvas with a Note on it that
// says what to do. The text lives in copy.js (FLOW.exercises); the graphs
// are built here with the same calls the canvas uses, so every wire in
// them is one the canvas would accept.
//
// Extension point: a new exercise is a new entry in EXERCISES plus a label
// and task in copy.js. The palette lists them in this order.

import * as C from '../constants.js';
import { FLOW, SAMPLE_QUESTIONS } from '../copy.js';
import { addNode, removeNode, connect } from './graph.js';
import { canonicalGraph } from './presets.js';

const question = (key) => SAMPLE_QUESTIONS.find((q) => q.key === key).text;
const step = () => C.FLOW_NODE_WIDTH + C.FLOW_COLUMN_GAP;
const at = (column, row) => ({ x: C.FLOW_CANVAS_PADDING + column * step(), y: C.FLOW_CANVAS_PADDING + row * C.FLOW_ROW_GAP });

function note(graph, key, position = at(0, 1)) {
  return addNode(graph, 'note', { params: { text: FLOW.exercises.items[key].task }, position });
}

function wire(graph, from, fromPort, to, toPort) {
  const result = connect(graph, { node: from.id, port: fromPort }, { node: to.id, port: toPort });
  if (!result.ok) throw new Error(`Exercise wiring refused: ${from.id} -> ${to.id} (${result.code})`);
}

/**
 * @type {{ key: string, build: (options: { text: string }) => { graph, ids } }[]}
 * `text` is the sample document; every exercise starts from it.
 */
export const EXERCISES = [
  {
    // Document and Answer only. The gap is the lesson.
    key: 'blank',
    build({ text }) {
      const { graph, ids } = canonicalGraph({ text, question: question('synonym') });
      for (const id of [ids.chunk, ids.embed, ids.question, ids.retrieve, ids.assemble]) removeNode(graph, id);
      note(graph, 'blank');
      return { graph, ids: { document: ids.document, answer: ids.answer } };
    },
  },
  {
    // Everything but the Chunk step. Wiring Document into Embed is refused.
    key: 'missing',
    build({ text }) {
      const { graph, ids } = canonicalGraph({ text, question: question('synonym') });
      removeNode(graph, ids.chunk);
      note(graph, 'missing');
      return { graph, ids };
    },
  },
  {
    // TOP_K = 1 and a question the handbook cannot answer.
    key: 'starved',
    build({ text }) {
      const { graph, ids } = canonicalGraph({ text, question: question('grounding') });
      graph.nodes.get(ids.retrieve).params.topK = 1;
      note(graph, 'starved');
      return { graph, ids };
    },
  },
  {
    // Glass Box and Black Box side by side, fed by one Chunk and one Question.
    key: 'twoBoxes',
    build({ text }) {
      const { graph, ids } = canonicalGraph({ text, question: question('synonym') });
      const embed = addNode(graph, 'embed', { params: { mode: 'black' }, position: at(2, 2) });
      const retrieve = addNode(graph, 'retrieve', { position: at(3, 2) });
      wire(graph, graph.nodes.get(ids.chunk), 'chunks', embed, 'chunks');
      wire(graph, embed, 'vectors', retrieve, 'vectors');
      wire(graph, graph.nodes.get(ids.question), 'question', retrieve, 'question');
      note(graph, 'twoBoxes');
      return { graph, ids: { ...ids, embedBlack: embed.id, retrieveBlack: retrieve.id } };
    },
  },
  {
    // No overlap, and a size that cuts the vacation sentence inside a word.
    key: 'overlap',
    build({ text }) {
      const { graph, ids } = canonicalGraph({ text, question: FLOW.exercises.items.overlap.question });
      const chunk = graph.nodes.get(ids.chunk);
      chunk.params.chunkSize = C.FLOW_EXERCISE_OVERLAP_SIZE;
      chunk.params.chunkOverlap = 0;
      note(graph, 'overlap');
      return { graph, ids };
    },
  },
];

export function exercise(key) {
  return EXERCISES.find((entry) => entry.key === key);
}
