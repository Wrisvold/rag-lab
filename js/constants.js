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
// current visit only and is sent in a request header, never in the address.
// Model names go stale; update the `model` line here if a provider retires one.
export const ANSWER_PROVIDERS = {
  gemini: {
    label: 'Google Gemini',
    model: 'gemini-3-flash-preview',
    thinkingLevel: 'LOW',        // Gemini 3 thinks by default, and thinking counts toward the token limit
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    keyHelpUrl: 'https://aistudio.google.com/apikey',
    note: 'Has a free tier.',
  },
  openai: {
    label: 'OpenAI',
    model: 'gpt-5-mini',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    keyHelpUrl: 'https://platform.openai.com/api-keys',
    note: 'Needs prepaid credit.',
  },
  anthropic: {
    label: 'Anthropic Claude',
    model: 'claude-opus-5',
    endpoint: 'https://api.anthropic.com/v1/messages',
    apiVersion: '2023-06-01',
    keyHelpUrl: 'https://console.anthropic.com/settings/keys',
    note: 'Needs prepaid credit.',
  },
};

// The longest reply the answer step will accept, in tokens.
export const ANSWER_MAX_OUTPUT_TOKENS = 1024;

// How many chunks Black Box embeds at a time before updating the progress bar.
export const BLACK_BOX_BATCH_SIZE = 8;

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

// ---------------------------------------------------------------------------
// Flow mode (flow.html): the node canvas
// ---------------------------------------------------------------------------

// Version stamp written into every exported graph. Bump it only when the
// export format changes in a way an older loader could not read.
export const FLOW_EXPORT_VERSION = 1;

// How node parameters are named in an exported graph, so the JSON reads like
// the course notebook. Parameters not listed here keep their own names.
export const FLOW_NOTEBOOK_NAMES = {
  chunkSize: 'CHUNK_SIZE',
  chunkOverlap: 'CHUNK_OVERLAP',
  topK: 'TOP_K',
};

// Key used to keep a Flow mode canvas alive across a page reload.
export const FLOW_SESSION_STORAGE_KEY = 'rag-lab-flow';

// Canvas layout. Pixels at 100% zoom.
export const FLOW_NODE_WIDTH = 250;      // every node card is this wide
export const FLOW_COLUMN_GAP = 70;       // space between columns in a preset
export const FLOW_ROW_GAP = 300;         // space between rows in a preset
export const FLOW_CANVAS_PADDING = 40;   // margin around a preset, and around "Fit"
export const FLOW_GRID_STEP = 20;        // nodes snap to this grid; arrow keys move by it
export const FLOW_KEYBOARD_STEP_LARGE = 5; // Shift+arrow moves this many grid steps
export const FLOW_ZOOM_MIN = 0.4;
export const FLOW_ZOOM_MAX = 1.6;
export const FLOW_ZOOM_STEP = 1.2;       // one click of the zoom buttons multiplies by this

// Exercise 5 ("The lost sentence"): with no overlap, this chunk size cuts the
// handbook's vacation sentence inside the word "vacation". Re-check with
// tests/flow/exercises.test.js after editing data/sample.txt.
export const FLOW_EXERCISE_OVERLAP_SIZE = 500;

// File name offered by "Download graph".
export const FLOW_EXPORT_FILENAME = 'rag-lab-flow.json';

// ---------------------------------------------------------------------------
// Agent mode (agent.html): the agent loop. See agent-mode-plan.md.
// ---------------------------------------------------------------------------

// The simulated Fall Line data: today's date, employees, requests.
export const AGENT_SCENARIO_PATH = 'data/agent-scenario.json';

// MAX_ROUNDS: the most rounds a run may take. "No limit" (null) is for
// Exercise 1 only, and even then the engine stops at AGENT_HARD_LIMIT.
export const AGENT_MAX_ROUNDS_DEFAULT = 4;
export const AGENT_MAX_ROUNDS_MIN = 1;
export const AGENT_MAX_ROUNDS_MAX = 8;
export const AGENT_HARD_LIMIT = 12;

// TOKEN_BUDGET: the most context tokens a run may read, added over all
// rounds. Each round sends the whole context again, so the total grows fast.
// null means no budget (Exercise 1 only).
export const AGENT_TOKEN_BUDGET_DEFAULT = 8000;
export const AGENT_TOKEN_BUDGET_MIN = 1000;
export const AGENT_TOKEN_BUDGET_MAX = 32000;

// REPEAT_STOP: stop when the agent makes the same tool call twice.
export const AGENT_REPEAT_STOP_DEFAULT = true;

// A tool that throws this many times in one run stops the loop (TOOL_FAILED).
export const AGENT_TOOL_FAILURE_LIMIT = 2;

// Glass Box agent: the editable parts of its rule table.
export const AGENT_GLASS_SCORE_THRESHOLD = 0.15;   // rule C2
export const AGENT_GLASS_WIDER_STEP = 2;           // rule F2 adds this to TOP_K
export const AGENT_GLASS_BALANCE_WORDS = ['balance', 'left', 'how many days do i have', 'remaining'];

// Handbook rules that the tools enforce in code (Section 3.1).
export const AGENT_NOTICE_DAYS = 14;
export const AGENT_SERVICE_DAYS = 90;

// Key used to keep the Agent mode set-up alive across a page reload.
export const AGENT_SESSION_STORAGE_KEY = 'rag-lab-agent';

// Pause between the parts of a round in "Run round" and "Run to end", in
// milliseconds, so a student can follow the highlight. No pause when the
// browser asks for reduced motion.
export const AGENT_RUN_PAUSE_MS = 600;

// ---------------------------------------------------------------------------
// Agent mode: the system prompt workbench (Phase 14)
// ---------------------------------------------------------------------------

// Key used to keep the prompt versions alive across a page reload.
export const AGENT_PROMPTS_SESSION_KEY = 'rag-lab-agent-prompts';

// File name and format stamp for downloaded prompt versions.
export const AGENT_PROMPTS_FILENAME = 'rag-lab-agent-prompts.json';
export const AGENT_PROMPTS_FORMAT = 'rag-lab-agent-prompts';
export const AGENT_PROMPTS_FORMAT_VERSION = 1;

// The prompt checker uses the structural rules of ASD-STE100.
// Sections that hold instructions allow 20 words per sentence; the others 25.
export const AGENT_PROMPT_INSTRUCTION_SECTIONS = ['rules', 'tools', 'stop'];
export const AGENT_PROMPT_MAX_WORDS_INSTRUCTION = 20;
export const AGENT_PROMPT_MAX_WORDS_DESCRIPTION = 25;

// Two-word verbs with meanings the parts do not predict, and one plain verb for each.
export const AGENT_PROMPT_PHRASAL_VERBS = {
  'set up': 'configure', 'look up': 'find', 'find out': 'learn', 'turn off': 'disable',
  'turn on': 'enable', 'fill in': 'complete', 'fill out': 'complete', 'carry out': 'do',
  'go back': 'return', 'pick up': 'collect', 'write down': 'record', 'give up': 'stop',
  'point out': 'show', 'check out': 'examine', 'make up': 'create', 'deal with': 'handle',
  'follow up': 'continue', 'back up': 'support', 'come up with': 'make', 'get back to': 'answer',
};

// Words that make the model guess. The checker asks for the exact condition instead.
export const AGENT_PROMPT_VAGUE_WORDS = [
  'appropriate', 'appropriately', 'relevant', 'as needed', 'if needed', 'when necessary',
  'if possible', 'etc', 'properly', 'reasonable', 'reasonably', 'suitable', 'and so on', 'various',
];

// ---------------------------------------------------------------------------
// Agent mode: the Black Box agent (Phase 15)
// ---------------------------------------------------------------------------

// The Black Box agent uses the student's own key, as Station 5 does, with the
// same endpoints. Its settings are separate, because an agent makes many
// calls with tools and the models think before each tool call.
// Model names go stale; update a `model` line here if a provider retires one.
export const AGENT_PROVIDERS = {
  gemini: {
    // Since September 2026, Google serves the 2.5 models only to projects that used them before.
    model: 'gemini-3-flash-preview',
    maxOutputTokens: 4096,       // thinking tokens count toward this limit
    thinkingLevel: 'LOW',        // short routing decisions; the default for this model is high
  },
  openai: {
    model: 'gpt-5-mini',
    maxOutputTokens: 4096,       // reasoning tokens count toward this limit
  },
  anthropic: {
    model: 'claude-opus-5-5',
    maxOutputTokens: 16000,      // thinking is always on for this model and counts toward this limit
    effort: 'low',               // short routing decisions; the default for this model is 'medium'
    // On a safety refusal, the API reruns the request on a fallback model it selects.
    fallbacks: 'default',
    betas: ['server-side-fallback-2026-07-01'],
  },
};

// The longest reply of the model check and of the meta prompt, in tokens.
export const AGENT_TEXT_MAX_OUTPUT_TOKENS = { gemini: 4096, openai: 4096, anthropic: 16000 };

// The theme control (js/theme.js). js/theme-boot.js repeats this key, because it runs before the modules.
export const THEME_STORAGE_KEY = 'rag-lab-theme';
