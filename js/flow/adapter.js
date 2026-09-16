// Flow mode: the adapter that lets the walkthrough's station renderers
// (js/stations/*.js) draw a node's artifact in the inspector, unchanged.
//
// A station expects the walkthrough's `app`: a `state` with `artifacts`,
// `dials`, `question`, `instruction`, and `ui`, plus run functions and
// `isStale`. For a node on the canvas, those come from the node's upstream
// chain: the Chunk node feeding its Embed node, the Document feeding that,
// and so on. `chainFor` finds the chain; `artifactsFor` maps the chain's
// artifacts to the walkthrough's names; `createStationApp` wraps it all.
//
// Pure apart from `refreshDocumentStatus`, which the Document station calls
// to update its own counts on screen.

import { fill } from '../dom.js';
import { countWords } from '../text.js';
import { buildPrompt } from '../prompt.js';
import { updateDocumentStatus } from '../stations/document.js';
import { inputEdge, dependents, isStale, setParam } from './graph.js';
import { flowRunSummary } from './summary.js';

// The input that carries the artifact a node is "made from", per type.
const PRIMARY_INPUT = { chunk: 'text', embed: 'chunks', retrieve: 'vectors', assemble: 'passages', answer: 'prompt' };

// Walkthrough artifact ids -> node types.
const ARTIFACT_NODE = { chunks: 'chunk', embeddings: 'embed', retrieval: 'retrieve', prompt: 'assemble', answer: 'answer' };

/**
 * The nodes that play each walkthrough role for `nodeId`: itself and the
 * chain upstream of it along the primary inputs, plus the Question feeding
 * its Retrieve (or, failing that, its Assemble).
 * @returns {{ document?, chunk?, embed?, question?, retrieve?, assemble?, answer? }} node ids by type
 */
export function chainFor(graph, nodeId) {
  const chain = {};
  let current = graph.nodes.get(nodeId);
  while (current) {
    chain[current.type] = current.id;
    const port = PRIMARY_INPUT[current.type];
    if (!port) break;
    const edge = inputEdge(graph, current.id, port);
    current = edge ? graph.nodes.get(edge.from.node) : null;
  }
  if (!chain.question) {
    const holder = chain.retrieve || chain.assemble;
    const edge = holder ? inputEdge(graph, holder, 'question') : null;
    if (edge) chain.question = edge.from.node;
  }
  return chain;
}

/**
 * The node a station's button means by "chunk", "embed", ... when pressed on
 * `nodeId`: the node itself if it is that type, else the nearest downstream
 * node of that type (continue buttons), else the one upstream (stale notices).
 */
export function resolveStep(graph, nodeId, type) {
  const node = graph.nodes.get(nodeId);
  if (!node) return null;
  if (node.type === type) return nodeId;
  const down = dependents(graph, nodeId).find((id) => graph.nodes.get(id).type === type);
  if (down) return down;
  return chainFor(graph, nodeId)[type] || null;
}

/**
 * The walkthrough's `state.artifacts` for a node. Each station is handed the
 * chunk list its own artifact was built from, so a re-chunked upstream can
 * never leave a station indexing chunks that no longer exist.
 */
export function artifactsFor(graph, nodeId) {
  const node = graph.nodes.get(nodeId);
  const chain = chainFor(graph, nodeId);
  const output = (type) => {
    const id = chain[type];
    const member = id ? graph.nodes.get(id) : null;
    return member && member.artifact ? member.artifact.output : null;
  };
  const chunkOut = output('chunk');
  const embedOut = output('embed');
  const retrieveOut = output('retrieve');
  const assembleOut = output('assemble');
  const answerOut = output('answer');

  let chunks;
  if (node.type === 'document' || node.type === 'chunk') chunks = chunkOut;
  else if (node.type === 'embed') chunks = embedOut ? { chunks: embedOut.chunks } : chunkOut;
  else if (node.type === 'retrieve') chunks = retrieveOut ? { chunks: retrieveOut.chunks } : (embedOut ? { chunks: embedOut.chunks } : chunkOut);
  else chunks = assembleOut ? { chunks: assembleOut.chunks } : (retrieveOut ? { chunks: retrieveOut.chunks } : chunkOut);
  if (!chunks && node.type !== 'document' && node.type !== 'chunk') chunks = { chunks: [] };

  let embeddings = null;
  if (node.type === 'retrieve' && retrieveOut) {
    embeddings = { embedding: retrieveOut.embedding, projection: retrieveOut.projection, mode: retrieveOut.mode };
  } else if (embedOut) {
    embeddings = { embedding: embedOut.embedding, projection: embedOut.projection, mode: embedOut.mode };
  }

  return { chunks, embeddings, retrieval: retrieveOut, prompt: assembleOut, answer: answerOut };
}

/**
 * The `app` object a station renderer expects, backed by the graph.
 *
 * @param flow  the page: { graph, copy, constants, busy, blackBoxAvailable, ui: { selectedChunk, apiKey },
 *              readout(text), paramChanged(id, { fromInspector }), runNode(id, { rerenderInspector }) -> report,
 *              selectNode(id) }
 * @param {string} nodeId
 */
export function createStationApp(flow, nodeId) {
  const { copy, constants: C } = flow;
  const graph = () => flow.graph;
  const chain = () => chainFor(graph(), nodeId);
  const member = (type) => {
    const id = chain()[type];
    return id ? graph().nodes.get(id) : null;
  };
  const label = (type) => copy.FLOW.nodes[type].label;

  const state = {
    get artifacts() { return artifactsFor(graph(), nodeId); },
    get document() {
      const node = member('document');
      const text = node ? node.params.text : '';
      return { text, name: node ? node.params.name : '', words: countWords(text), chars: text.length, version: 0 };
    },
    dialsValid: true,
    get dials() {
      const chunk = member('chunk');
      const retrieve = member('retrieve');
      return {
        chunkSize: chunk ? chunk.params.chunkSize : C.CHUNK_SIZE_DEFAULT,
        chunkOverlap: chunk ? chunk.params.chunkOverlap : C.CHUNK_OVERLAP_DEFAULT,
        topK: retrieve ? retrieve.params.topK : C.TOP_K_DEFAULT,
      };
    },
    get embeddingMode() { const node = member('embed'); return node ? node.params.mode : 'glass'; },
    get blackBox() { return { available: flow.blackBoxAvailable !== false }; },
    get busy() { return Boolean(flow.busy); },
    get question() { const node = member('question'); return node ? node.params.text : ''; },
    get instruction() { const node = member('assemble'); return node ? node.params.instruction : C.DEFAULT_INSTRUCTION; },
    ui: {
      get selectedChunk() { return flow.ui.selectedChunk; },
      set selectedChunk(value) { flow.ui.selectedChunk = value; },
      get apiKey() { return flow.ui.apiKey; },
      set apiKey(value) { flow.ui.apiKey = value; },
      get provider() { const node = member('answer'); return node ? node.params.provider : 'gemini'; },
      set provider(value) {
        const node = member('answer');
        if (node && setParam(graph(), node.id, 'provider', value)) flow.paramChanged(node.id, { fromInspector: true });
      },
    },
  };

  const run = async (type, { goToStation = false } = {}) => {
    const id = resolveStep(graph(), nodeId, type);
    if (!id) { flow.readout(fill(copy.FLOW.inspector.noNext, { node: label(type) })); return false; }
    if (goToStation) flow.selectNode(id);
    const report = await flow.runNode(id);
    return Boolean(report) && !report.failed.some((entry) => entry.id === id);
  };

  const api = {
    state,
    copy,
    constants: C,

    isStale(artifactId) {
      const node = member(ARTIFACT_NODE[artifactId]);
      return node ? isStale(graph(), node.id) : false;
    },

    runChunking: (options) => run('chunk', options),
    runEmbedding: (options) => run('embed', options),
    runRetrieval: (options) => run('retrieve', options),
    runAssembly: (options) => run('assemble', options),

    showStep(stepId) {
      const id = resolveStep(graph(), nodeId, stepId);
      if (id) flow.selectNode(id);
      else flow.readout(fill(copy.FLOW.inspector.noNext, { node: label(stepId) }));
    },

    setDocument(text, name) {
      const node = member('document');
      if (!node) return;
      const changed = setParam(graph(), node.id, 'text', text);
      const renamed = setParam(graph(), node.id, 'name', text ? name : '');
      if (changed || renamed) flow.paramChanged(node.id, { fromInspector: true });
    },

    refreshDocumentStatus() {
      updateDocumentStatus(api);
    },

    setQuestion(text) {
      const node = member('question');
      if (node && setParam(graph(), node.id, 'text', text)) flow.paramChanged(node.id, { fromInspector: true });
    },

    /**
     * Mirrors the walkthrough's rebuildPromptText: the prompt updates live as
     * the instruction is typed, without a run, and the Answer downstream goes
     * stale because the prompt it saw has changed.
     */
    setInstruction(text) {
      const node = member('assemble');
      if (!node || !setParam(graph(), node.id, 'instruction', text)) return;
      if (node.artifact) {
        const out = node.artifact.output;
        out.instruction = text;
        out.text = buildPrompt({ instruction: text, passages: out.passages, question: out.question });
        node.artifact.params = { ...node.params };
        node.runs += 1;
        node.artifact.version = node.runs;
      }
      flow.paramChanged(node.id, { fromInspector: true });
    },

    async setEmbeddingMode(mode) {
      const node = member('embed');
      if (!node || !setParam(graph(), node.id, 'mode', mode)) return;
      flow.paramChanged(node.id, { fromInspector: true });
      // The walkthrough re-embeds on a mode switch; so does the canvas.
      if (node.artifact) await flow.runNode(node.id);
    },

    buildRunSummary() {
      const node = member('assemble');
      return (node && flowRunSummary(graph(), node.id)) || '';
    },

    /** Station 5's request: run the Answer node with the key from the page. Never throws. */
    async askModel() {
      const node = member('answer');
      if (!node) return { ok: false, code: 'badRequest' };
      const report = await flow.runNode(node.id, { rerenderInspector: false });
      if (!report) return { ok: false, code: 'rateLimit' };
      const failed = report.failed.find((entry) => entry.id === node.id);
      if (failed) return { ok: false, code: failed.code === 'noKey' ? 'badKey' : failed.code };
      return { ok: true, text: node.artifact.output.text };
    },
  };
  return api;
}
