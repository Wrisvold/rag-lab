// Flow mode: the node table. One entry per node type, as data.
//
// Each entry names its input and output ports, its parameter defaults, and a
// `run` function that calls the same compute module the walkthrough uses.
// Nothing here touches the DOM. The graph (graph.js) and the runner
// (runner.js) read this table; the canvas (Phase 8) draws from it.
//
// Port payloads, so every node agrees on what travels down a wire:
//   text      { text, name, words, chars }
//   chunks    { chunks, summary, settings, documentName }        (chunker.js result plus the settings)
//   vectors   { embedding, projection, mode, chunks }            (glassBox.js / blackBox.js shape plus the 2D map fit)
//   question  { text }
//   passages  { question, query, ranked, topK, topKValue, passages, questionPoint, questionHasDirection, chunks, mode }
//   prompt    { text, instruction, passages, question }
//   answer    { provider, model, text, promptText, passages, question }
//
// Extension point: a new node type is a new entry here plus a label and hint
// in copy.js (FLOW.nodes). The graph, runner, and serializer need no changes.

import * as C from '../constants.js';
import { chunkText } from '../chunker.js';
import { countWords, normalizeNewlines } from '../text.js';
import { embedChunksGlassBox } from '../glassBox.js';
import { loadBlackBoxModel, embedChunksBlackBox } from '../blackBox.js';
import { projectTo2D, applyPca } from '../pca.js';
import { unitVector } from '../cosine.js';
import { rankChunks, selectTopK } from '../retrieval.js';
import { buildPrompt } from '../prompt.js';
import { askModel } from '../answer.js';

/** Every kind of wire. The order is the order data moves through the pipeline. */
export const PORT_TYPES = ['text', 'chunks', 'vectors', 'question', 'passages', 'prompt', 'answer'];

/** The embedding modes an Embed node can be set to. */
export const EMBED_MODES = ['glass', 'black'];

// The real Black Box loader. Tests hand the runner a fake through
// `context.blackBox` so no model is downloaded.
const realBlackBox = {
  load: (onProgress) => loadBlackBoxModel({
    transformersUrl: C.TRANSFORMERS_JS_URL,
    modelName: C.BLACK_BOX_MODEL,
    onProgress,
  }),
  embed: (chunks, onProgress) => embedChunksBlackBox(chunks, {
    batchSize: C.BLACK_BOX_BATCH_SIZE,
    previewCount: C.BLACK_BOX_PREVIEW_COUNT,
    onProgress,
  }),
};

const glassBoxOptions = () => ({
  stopwords: C.STOPWORDS,
  minTokenLength: C.MIN_TOKEN_LENGTH,
  topTermCount: C.GLASS_BOX_TOP_TERMS,
});

/**
 * @typedef {object} NodeDefinition
 * @property {string} type
 * @property {'build'|'run'|null} lane        matches the stepper's lane tags
 * @property {{ id: string, type: string }[]} inputs
 * @property {{ id: string, type: string }[]} outputs
 * @property {object} params                  defaults; copied onto each new node
 * @property {boolean} [runnable]             false for nodes that only decorate the canvas
 * @property {(inputs: object, params: object, context: object) => Promise<any>} [run]
 */

/** @type {Record<string, NodeDefinition>} */
export const NODE_TYPES = {
  document: {
    type: 'document',
    lane: null,
    inputs: [],
    outputs: [{ id: 'text', type: 'text' }],
    params: { text: '', name: '' },
    async run(inputs, params) {
      const text = normalizeNewlines(params.text);
      if (!text.trim()) throw coded('EMPTY_DOCUMENT');
      return { text, name: params.name || '', words: countWords(text), chars: text.length };
    },
  },

  chunk: {
    type: 'chunk',
    lane: 'build',
    inputs: [{ id: 'text', type: 'text' }],
    outputs: [{ id: 'chunks', type: 'chunks' }],
    params: { chunkSize: C.CHUNK_SIZE_DEFAULT, chunkOverlap: C.CHUNK_OVERLAP_DEFAULT },
    async run({ text }, params) {
      const settings = { chunkSize: params.chunkSize, chunkOverlap: params.chunkOverlap };
      // chunkText throws a RangeError carrying INVALID_SIZE, INVALID_OVERLAP,
      // or OVERLAP_TOO_LARGE; the runner keeps that code.
      const result = chunkText(text.text, settings, C.SENTENCE_END_CHARS);
      return { ...result, settings, documentName: text.name };
    },
  },

  embed: {
    type: 'embed',
    lane: 'build',
    inputs: [{ id: 'chunks', type: 'chunks' }],
    outputs: [{ id: 'vectors', type: 'vectors' }],
    params: { mode: 'glass' },
    async run({ chunks }, params, context) {
      let embedding;
      if (params.mode === 'glass') {
        embedding = embedChunksGlassBox(chunks.chunks, glassBoxOptions());
      } else if (params.mode === 'black') {
        const blackBox = context.blackBox || realBlackBox;
        const report = context.onProgress || (() => {});
        try {
          await blackBox.load((p) => report({ stage: 'download', percent: p.percent }));
          embedding = await blackBox.embed(chunks.chunks, ({ done, total }) => report({
            stage: 'embed', percent: total ? Math.round((done / total) * 100) : 0, done, total,
          }));
        } catch (error) {
          throw coded('BLACK_BOX_UNAVAILABLE', error && error.message ? error.message : String(error));
        }
      } else {
        throw coded('UNKNOWN_MODE');
      }
      // The map shows directions (what cosine similarity compares), so project unit vectors.
      const projection = projectTo2D(embedding.vectors.map(unitVector));
      return { embedding, projection, mode: params.mode, chunks: chunks.chunks };
    },
  },

  question: {
    type: 'question',
    lane: 'run',
    inputs: [],
    outputs: [{ id: 'question', type: 'question' }],
    params: { text: '' },
    async run(inputs, params) {
      const text = (params.text || '').trim();
      if (!text) throw coded('EMPTY_QUESTION');
      return { text };
    },
  },

  retrieve: {
    type: 'retrieve',
    lane: 'run',
    inputs: [{ id: 'vectors', type: 'vectors' }, { id: 'question', type: 'question' }],
    outputs: [{ id: 'passages', type: 'passages' }],
    params: { topK: C.TOP_K_DEFAULT },
    async run({ vectors, question }, params) {
      const { embedding, projection, chunks } = vectors;
      const query = await embedding.embedQuery(question.text);
      const ranked = rankChunks(query.vector, embedding.vectors);
      const topK = selectTopK(ranked, params.topK);
      const questionHasDirection = Array.from(query.vector).some((value) => value !== 0);
      // A question with no direction has nothing to project; it sits at the mean (the origin).
      const questionPoint = questionHasDirection ? applyPca(projection.fit, unitVector(query.vector)) : [0, 0];
      const passages = topK.map((entry) => ({
        chunkIndex: entry.index,
        number: chunks[entry.index].number,
        text: chunks[entry.index].text,
        score: entry.score,
      }));
      return {
        question: question.text, query, ranked, topK, topKValue: params.topK, passages,
        questionPoint, questionHasDirection, chunks, mode: vectors.mode,
      };
    },
  },

  assemble: {
    type: 'assemble',
    lane: 'run',
    inputs: [{ id: 'passages', type: 'passages' }, { id: 'question', type: 'question' }],
    outputs: [{ id: 'prompt', type: 'prompt' }],
    params: { instruction: C.DEFAULT_INSTRUCTION },
    async run({ passages, question }, params) {
      const text = buildPrompt({ instruction: params.instruction, passages: passages.passages, question: question.text });
      return { text, instruction: params.instruction, passages: passages.passages, question: question.text };
    },
  },

  answer: {
    type: 'answer',
    lane: 'run',
    inputs: [{ id: 'prompt', type: 'prompt' }],
    outputs: [{ id: 'answer', type: 'answer' }],
    // The key is never a parameter: parameters are exported and saved, the
    // key must not be. It arrives through `context.apiKey` for one run.
    params: { provider: 'gemini' },
    async run({ prompt }, params, context) {
      const provider = C.ANSWER_PROVIDERS[params.provider];
      if (!provider) throw coded('UNKNOWN_PROVIDER');
      const apiKey = (context.apiKey || '').trim();
      if (!apiKey) throw coded('badKey');
      const ask = context.askModel || askModel;
      let text;
      try {
        text = await ask(params.provider, {
          apiKey, model: provider.model, prompt: prompt.text,
          maxTokens: C.ANSWER_MAX_OUTPUT_TOKENS, providers: C.ANSWER_PROVIDERS,
        });
      } catch (error) {
        throw coded(error && error.code ? error.code : 'badRequest', error && error.message);
      }
      return {
        provider: params.provider, model: provider.model, text,
        promptText: prompt.text, passages: prompt.passages, question: prompt.question,
      };
    },
  },

  note: {
    type: 'note',
    lane: null,
    inputs: [],
    outputs: [],
    params: { text: '' },
    runnable: false,
  },
};

/** The definition for a node type, or undefined. */
export function nodeType(type) {
  return NODE_TYPES[type];
}

/** The port on a definition, or undefined. `side` is 'inputs' or 'outputs'. */
export function findPort(definition, side, portId) {
  return definition[side].find((port) => port.id === portId);
}

function coded(code, message) {
  const error = new Error(message || code);
  error.code = code;
  return error;
}
