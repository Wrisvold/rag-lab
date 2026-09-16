// Flow mode: the run summary for a graph, in the walkthrough's exact format.
// Walks upstream from an Assemble node to find the document, the chunking,
// the embedding, and the retrieval it was built from. Pure.

import * as C from '../constants.js';
import { STATION_ASSEMBLE } from '../copy.js';
import { fill } from '../dom.js';
import { formatRunSummary } from '../summary.js';
import { padNumber } from '../text.js';
import { inputEdge } from './graph.js';

/**
 * @param graph
 * @param {string} assembleId   an Assemble node with an artifact
 * @param {{ date?: Date }} [options]
 * @returns {string|null}  null when the chain is incomplete
 */
export function flowRunSummary(graph, assembleId, { date = new Date() } = {}) {
  const assemble = graph.nodes.get(assembleId);
  if (!assemble || assemble.type !== 'assemble' || !assemble.artifact) return null;
  const retrieve = upstream(graph, assembleId, 'passages');
  const embed = retrieve && upstream(graph, retrieve.id, 'vectors');
  const chunk = embed && upstream(graph, embed.id, 'chunks');
  const document = chunk && upstream(graph, chunk.id, 'text');
  if (!document || [retrieve, embed, chunk, document].some((node) => !node.artifact)) return null;

  const chunks = chunk.artifact.output;
  const vectors = embed.artifact.output;
  const passages = retrieve.artifact.output;
  const prompt = assemble.artifact.output;
  const total = chunks.chunks.length;
  const dims = vectors.embedding.dimensions.toLocaleString('en-US');
  const modeLabel = vectors.mode === 'glass'
    ? fill(STATION_ASSEMBLE.modeGlassSummary, { dims })
    : fill(STATION_ASSEMBLE.modeBlackSummary, { model: C.BLACK_BOX_MODEL.split('/').pop(), dims });

  return formatRunSummary({
    date,
    documentName: document.artifact.output.name,
    words: document.artifact.output.words,
    chunkSize: chunks.settings.chunkSize,
    chunkOverlap: chunks.settings.chunkOverlap,
    chunkCount: total,
    midSentenceCuts: chunks.summary.midSentenceCuts,
    modeLabel,
    question: passages.question,
    topK: passages.topKValue,
    results: passages.topK.map((entry) => ({
      rank: entry.rank,
      chunkLabel: padNumber(chunks.chunks[entry.index].number, total),
      score: entry.score,
    })),
    promptLength: prompt.text.length,
  });
}

function upstream(graph, nodeId, portId) {
  const edge = inputEdge(graph, nodeId, portId);
  return edge ? graph.nodes.get(edge.from.node) : null;
}
