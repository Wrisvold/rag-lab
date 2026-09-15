// Black Box embedding mode: a small neural sentence-embedding model run in the
// browser with Transformers.js. Loaded lazily, the first time a student
// switches to Black Box, with progress reported to the page.
//
// Produces the same shape as js/glassBox.js:
//   { mode, dimensions, vectors, embedQuery(text), inspect(index), stats }
// except that embedQuery is async here (the model runs asynchronously).

let extractor = null;   // the loaded pipeline, once ready
let loading = null;     // the in-flight load, so two callers share it

export function isBlackBoxLoaded() {
  return extractor !== null;
}

/**
 * Download (once) and initialise the model.
 * @param {object} options
 * @param {string} options.transformersUrl   pinned CDN address of Transformers.js
 * @param {string} options.modelName         e.g. "Xenova/all-MiniLM-L6-v2"
 * @param {(progress: { percent: number|null, file: string, status: string }) => void} [options.onProgress]
 * @param {number} [options.stallTimeoutMs]  give up if nothing arrives for this long
 */
export async function loadBlackBoxModel({ transformersUrl, modelName, onProgress, stallTimeoutMs = 90_000 }) {
  if (extractor) return extractor;
  if (!loading) {
    loading = (async () => {
      const files = new Map();
      let lastEvent = Date.now();
      const report = (event) => {
        lastEvent = Date.now();
        if (onProgress) onProgress(summarizeProgress(files, event));
      };

      const transformers = await import(/* webpackIgnore: true */ transformersUrl);
      transformers.env.allowLocalModels = false;

      const build = transformers.pipeline('feature-extraction', modelName, { quantized: true, progress_callback: report });
      let timer = null;
      const stalled = new Promise((_, reject) => {
        timer = setInterval(() => {
          if (Date.now() - lastEvent > stallTimeoutMs) reject(new Error('The model download stalled.'));
        }, 2_000);
      });
      try {
        extractor = await Promise.race([build, stalled]);
      } finally {
        clearInterval(timer);
      }
      return extractor;
    })().catch((error) => {
      loading = null; // allow a retry later
      throw error;
    });
  }
  return loading;
}

/**
 * Folds Transformers.js progress events into one number for a progress bar.
 * Pure; exported for tests.
 * @param {Map<string, { loaded: number, total: number }>} files  running tally, mutated
 * @param {object} event  a progress_callback event
 */
export function summarizeProgress(files, event) {
  if (event && event.file) {
    const entry = files.get(event.file) || { loaded: 0, total: 0 };
    if (typeof event.total === 'number' && event.total > 0) entry.total = event.total;
    if (typeof event.loaded === 'number') entry.loaded = event.loaded;
    if (event.status === 'done' && entry.total) entry.loaded = entry.total;
    files.set(event.file, entry);
  }
  let loaded = 0;
  let total = 0;
  for (const entry of files.values()) { loaded += entry.loaded; total += entry.total; }
  const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : null;
  return { percent, file: event && event.file ? event.file : '', status: event ? event.status : '' };
}

/**
 * Embed every chunk with the loaded model, a few at a time so the page can
 * show progress between batches.
 * @param {{ text: string }[]} chunks
 * @param {{ batchSize?: number, previewCount?: number, onProgress?: (p: { done: number, total: number }) => void }} options
 */
export async function embedChunksBlackBox(chunks, { batchSize = 8, previewCount = 10, onProgress } = {}) {
  if (!extractor) throw new Error('Black Box model is not loaded.');
  const vectors = [];
  for (let start = 0; start < chunks.length; start += batchSize) {
    if (onProgress) onProgress({ done: start, total: chunks.length });
    const texts = chunks.slice(start, start + batchSize).map((chunk) => chunk.text);
    const rows = await embedTexts(texts);
    vectors.push(...rows);
  }
  if (onProgress) onProgress({ done: chunks.length, total: chunks.length });
  const dimensions = vectors.length ? vectors[0].length : 0;

  return {
    mode: 'black',
    dimensions,
    vectors,
    stats: {},

    async embedQuery(text) {
      const [vector] = await embedTexts([text]);
      return { vector, tokens: [], known: [], unknown: [], dropped: [] };
    },

    inspect(chunkIndex) {
      const vector = vectors[chunkIndex];
      let maxAbs = 0;
      for (let i = 0; i < vector.length; i += 1) maxAbs = Math.max(maxAbs, Math.abs(vector[i]));
      return {
        dimensions: vector.length,
        values: vector,
        preview: Array.from(vector.slice(0, previewCount)),
        maxAbs,
      };
    },
  };
}

// Mean-pooled, unit-length sentence vectors, one per text.
async function embedTexts(texts) {
  const output = await extractor(texts, { pooling: 'mean', normalize: true });
  const rows = output.tolist();
  return rows.map((row) => Float64Array.from(row));
}
