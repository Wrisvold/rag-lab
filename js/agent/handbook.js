// Agent mode: the handbook behind the search_handbook tool. Pure, no DOM.
//
// Chunks and embeds the document one time, with the same modules and dials
// as the walkthrough, then answers searches. Each passage carries the
// section it belongs to, found from its POSITION in the document, not from
// its text: a chunk can start in the middle of a heading ("…\n\n3.1 Vacation"
// cut after the "3"), and then its text no longer shows the section number.
// Keeping that kind of data next to the chunk is what "metadata" means.

import { chunkText } from '../chunker.js';
import { embedChunksGlassBox } from '../glassBox.js';
import { rankChunks, selectTopK } from '../retrieval.js';
import {
  CHUNK_SIZE_DEFAULT, CHUNK_OVERLAP_DEFAULT, SENTENCE_END_CHARS,
  STOPWORDS, MIN_TOKEN_LENGTH, GLASS_BOX_TOP_TERMS,
} from '../constants.js';

/** Glass Box tokenizer options, the same ones the walkthrough uses. */
export const GLASS_BOX_OPTIONS = { stopwords: STOPWORDS, minTokenLength: MIN_TOKEN_LENGTH, topTermCount: GLASS_BOX_TOP_TERMS };

// A heading is a line that starts "n.n Title." (the handbook's numbering).
const HEADING = /^(\d+\.\d+)\s+([^.\n]+)\./gm;

/**
 * Every numbered section heading in the document, in order.
 * @returns {{ number: string, title: string, start: number }[]}
 */
export function findSections(text) {
  return [...(text || '').matchAll(HEADING)].map((m) => ({ number: m[1], title: m[2].trim(), start: m.index }));
}

/** The section that a character position falls in, or null before the first heading. */
export function sectionAt(sections, position) {
  let found = null;
  for (const section of sections) {
    if (section.start <= position) found = section;
    else break;
  }
  return found;
}

/**
 * Build the searchable handbook.
 * @param {string} text
 * @param {{ chunkSize?: number, chunkOverlap?: number, embedding?: object }} [options]
 *   `embedding` lets a caller pass a Black Box embedding of the same chunks;
 *   the default is Glass Box.
 */
export function createHandbook(text, options = {}) {
  const settings = {
    chunkSize: options.chunkSize ?? CHUNK_SIZE_DEFAULT,
    chunkOverlap: options.chunkOverlap ?? CHUNK_OVERLAP_DEFAULT,
  };
  const { chunks } = chunkText(text, settings, SENTENCE_END_CHARS);
  const embedding = options.embedding || embedChunksGlassBox(chunks, GLASS_BOX_OPTIONS);
  const sections = findSections(text);

  return {
    text,
    chunks,
    sections,
    settings,
    mode: embedding.mode,

    /**
     * @param {string} query
     * @param {number} topK
     * @returns {Promise<{ query, topK, passages, known, unknown }>}
     */
    async search(query, topK) {
      const embedded = await embedding.embedQuery(query);
      const ranked = rankChunks(embedded.vector, embedding.vectors);
      const passages = selectTopK(ranked, topK).map((entry) => {
        const chunk = chunks[entry.index];
        const section = sectionAt(sections, chunk.start);
        // Every section the chunk touches: the one it starts in, and any
        // heading that begins inside it.
        const covered = [section, ...sections.filter((s) => s.start > chunk.start && s.start < chunk.end)]
          .filter(Boolean).map((s) => s.number);
        return {
          chunkIndex: entry.index,
          chunkNumber: chunk.number,
          score: entry.score,
          section: section ? section.number : null,
          sections: [...new Set(covered)],
          start: chunk.start,
          text: chunk.text,
        };
      });
      return {
        query,
        topK,
        passages,
        // Glass Box reports which query words the handbook never uses.
        // A Black Box embedding has no vocabulary, so it reports none.
        known: embedded.known || [],
        unknown: embedded.unknown || [],
      };
    },
  };
}
