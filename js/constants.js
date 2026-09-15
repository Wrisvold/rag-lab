// RAG Lab — defaults and ranges.
// Every number the app uses as a default lives here. Change a value, save the
// file, and reload the page. No build step is needed.

// ---------------------------------------------------------------------------
// The three dials. These names match the Colab notebook exactly.
// ---------------------------------------------------------------------------

// CHUNK_SIZE: how many characters go into each chunk. Bigger chunks carry more
// context but are more likely to mix unrelated topics.
export const CHUNK_SIZE_DEFAULT = 400;
export const CHUNK_SIZE_MIN = 100;
export const CHUNK_SIZE_MAX = 1200;

// CHUNK_OVERLAP: how many characters each chunk repeats from the end of the
// previous chunk, so a sentence on the boundary is not lost entirely.
// Must be smaller than CHUNK_SIZE. The app explains this rather than clamping.
export const CHUNK_OVERLAP_DEFAULT = 50;
export const CHUNK_OVERLAP_MIN = 0;
export const CHUNK_OVERLAP_MAX = 300;

// TOP_K: how many of the highest-scoring chunks are handed to the language model.
export const TOP_K_DEFAULT = 3;
export const TOP_K_MIN = 1;
export const TOP_K_MAX = 8;

// ---------------------------------------------------------------------------
// Chunking details
// ---------------------------------------------------------------------------

// A cut is "mid-sentence" when the character just before it is not one of
// these. This is the definition the course uses; edit it if you teach another.
export const SENTENCE_END_CHARS = ['.', '!', '?', '\n'];

// ---------------------------------------------------------------------------
// Glass Box (TF-IDF) details
// ---------------------------------------------------------------------------

// Words that are dropped before counting, because they appear everywhere and
// carry no topic on their own. Edit freely; keep it lowercase.
export const STOPWORDS = new Set(`
a an the and or but if then else of to in on at by for from with without into
onto over under about as is are was were be been being am do does did doing
have has had having will would shall should can could may might must this that
these those it its they them their theirs we us our ours you your yours he him
his she her hers i me my mine who whom whose which what where when why how much
many more most some any all each every no not nor so than too very just also
only own same such there here up down out off again further once
`.trim().split(/\s+/));

// Tokens shorter than this (after lowercasing and stripping punctuation) are
// ignored. Catches stray letters left over from things like "a.m."
export const MIN_TOKEN_LENGTH = 2;

// How many of the heaviest words to list when a student inspects a Glass Box vector.
export const GLASS_BOX_TOP_TERMS = 12;

// ---------------------------------------------------------------------------
// Black Box (neural model) details
// ---------------------------------------------------------------------------

// The sentence-embedding model downloaded to the browser on first use.
export const BLACK_BOX_MODEL = 'Xenova/all-MiniLM-L6-v2';

// How many numbers that model produces per chunk. Shown in the inspector.
export const BLACK_BOX_DIMENSIONS = 384;

// How many raw numbers to print (in addition to the heat strip) when inspecting.
export const BLACK_BOX_PREVIEW_COUNT = 10;

// Approximate download size, quoted in the progress message.
export const BLACK_BOX_DOWNLOAD_SIZE = '23 MB';

// External libraries, pinned to exact versions. Change only on purpose.
export const TRANSFORMERS_JS_URL = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
export const MAMMOTH_URL = 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

// File types the upload button accepts. Anything else gets a friendly refusal.
export const ACCEPTED_UPLOAD_EXTENSIONS = ['.txt', '.md', '.docx'];

// Where the built-in sample document lives, and the name shown in run summaries.
export const SAMPLE_DOCUMENT_PATH = 'data/sample.txt';
export const SAMPLE_DOCUMENT_NAME = 'sample.txt';

// ---------------------------------------------------------------------------
// Prompt assembly
// ---------------------------------------------------------------------------

// The instruction block at the top of every assembled prompt. Students can
// edit it in the UI; this is the text they start from.
export const DEFAULT_INSTRUCTION =
  'Answer the question using only the passages below. If the passages do not ' +
  'contain the answer, say "The provided material does not answer this." ' +
  'Do not use outside knowledge.';

// Rough rule of thumb for the token estimate shown next to the prompt:
// one token is about this many characters of English text.
export const CHARS_PER_TOKEN_ESTIMATE = 4;

// ---------------------------------------------------------------------------
// Station 5 — optional answer step (bring your own key)
// ---------------------------------------------------------------------------

// Providers a student can choose from. The key is held in memory for the
// current visit only. Model names go stale; update them here if a provider
// retires one.
export const ANSWER_PROVIDERS = {
  gemini: {
    label: 'Google Gemini',
    model: 'gemini-2.5-flash',
    keyHelpUrl: 'https://aistudio.google.com/apikey',
  },
  openai: {
    label: 'OpenAI',
    model: 'gpt-4o-mini',
    keyHelpUrl: 'https://platform.openai.com/api-keys',
  },
};

// ---------------------------------------------------------------------------
// Housekeeping
// ---------------------------------------------------------------------------

// Key used to keep a run alive across a page reload (sessionStorage only,
// cleared when the tab closes). Wrapped in try/catch; the app works without it.
export const SESSION_STORAGE_KEY = 'rag-lab-run';

// Anything slower than this (milliseconds) shows a progress indicator.
export const PROGRESS_THRESHOLD_MS = 300;

// Words never to use in explainer copy. Checked by tests/copy.test.js.
export const BANNED_COPY_WORDS = ['leverage', 'seamless', 'robust', 'delve', 'powerful'];

// Longest paragraph allowed in an explainer panel, in words.
export const MAX_EXPLAINER_WORDS = 70;
