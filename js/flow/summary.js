// Flow mode: the run summary for a graph, in the walkthrough's exact format.
// Walks upstream from an Assemble node to find the document, the chunking,
// the embedding, and the retrieval it was built from. Pure.

import * as C from '../constants.js';
import { FLOW, STATION_ASSEMBLE, STATION_DOCUMENT, STATION_EMBED } from '../copy.js';
import { fill } from '../dom.js';
import { formatRunSummary, formatDateTime } from '../summary.js';
import { padNumber } from '../text.js';
import { nodeType } from './registry.js';
import { inputEdge, order } from './graph.js';

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

/**
 * The Flow variant of the run summary: every node in execution order with
 * what feeds it, its parameters, and what it produced. Fixed format, so an
 * instructor can read many quickly:
 *
 *   RAG Lab flow — 2026-09-16 14:02
 *   1. Document · sample.txt · 1,105 words
 *   2. Chunk (from 1) · CHUNK_SIZE=400  CHUNK_OVERLAP=50 · 20 chunks, 19 mid-sentence cuts
 *   3. Embed (from 2) · Glass Box (TF-IDF) · 392 dims
 *   4. Question · How many days of PTO do new employees get?
 *   5. Retrieve (from 3, 4) · TOP_K=3 · chunks 02, 03, 07 · scores 0.19, 0.10, 0.08
 *   6. Assemble (from 5, 4) · 1,467 chars
 *   7. Answer (from 6) · Google Gemini · not run
 *   Note · Build the path from the Document to the Answer…
 *
 * @param graph
 * @param {{ date?: Date }} [options]
 */
export function flowGraphSummary(graph, { date = new Date() } = {}) {
  const ids = order(graph);
  const number = new Map(ids.filter((id) => graph.nodes.get(id).type !== 'note').map((id, i) => [id, i + 1]));
  const lines = [`RAG Lab flow — ${formatDateTime(date)}`];
  for (const id of ids) {
    const node = graph.nodes.get(id);
    const label = FLOW.nodes[node.type].label;
    if (node.type === 'note') {
      lines.push(`${label} · ${firstLine(node.params.text, 80)}`);
      continue;
    }
    const sources = nodeType(node.type).inputs
      .map((port) => inputEdge(graph, id, port.id))
      .filter(Boolean)
      .map((edge) => number.get(edge.from.node));
    const head = `${number.get(id)}. ${label}${sources.length ? ` (from ${sources.join(', ')})` : ''}`;
    const parts = [head, describeParams(node)].filter(Boolean);
    const result = node.artifact ? describeOutput(node) : FLOW.summaries.notRun;
    if (result) parts.push(result);
    lines.push(parts.join(' · '));
  }
  return lines.join('\n');
}

const n = (value) => Number(value).toLocaleString('en-US');

function describeParams(node) {
  const p = node.params;
  switch (node.type) {
    case 'document': return p.name || (p.text ? STATION_DOCUMENT.pastedName : '');
    case 'chunk': return `CHUNK_SIZE=${p.chunkSize}  CHUNK_OVERLAP=${p.chunkOverlap}`;
    case 'embed': return p.mode === 'glass' ? STATION_EMBED.modeGlass : STATION_EMBED.modeBlack;
    case 'question': return firstLine(p.text, 120);
    case 'retrieve': return `TOP_K=${p.topK}`;
    case 'assemble': return '';
    case 'answer': return C.ANSWER_PROVIDERS[p.provider] ? C.ANSWER_PROVIDERS[p.provider].label : p.provider;
    default: return '';
  }
}

function describeOutput(node) {
  const out = node.artifact.output;
  switch (node.type) {
    case 'document': return `${n(out.words)} words`;
    case 'chunk': return `${n(out.summary.count)} chunks, ${n(out.summary.midSentenceCuts)} mid-sentence cuts`;
    case 'embed': return `${n(out.embedding.dimensions)} dims`;
    case 'question': return '';
    case 'retrieve': {
      const total = out.ranked.length;
      const numbers = out.passages.map((p) => padNumber(p.number, total)).join(', ');
      const scores = out.passages.map((p) => p.score.toFixed(2)).join(', ');
      return `chunks ${numbers} · scores ${scores}`;
    }
    case 'assemble': return `${n(out.text.length)} chars`;
    case 'answer': return `${out.model} · ${n(out.text.length)} chars`;
    default: return '';
  }
}

function firstLine(text, max) {
  const flat = (text || '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function upstream(graph, nodeId, portId) {
  const edge = inputEdge(graph, nodeId, portId);
  return edge ? graph.nodes.get(edge.from.node) : null;
}
