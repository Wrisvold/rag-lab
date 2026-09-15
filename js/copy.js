// RAG Lab — every sentence a student reads lives in this file.
// Edit the text between the quotes; nothing else needs to change.
// Rules for explainer paragraphs (checked by tests/copy.test.js):
//   - under 70 words each
//   - none of: leverage, seamless, robust, delve, powerful

// ---------------------------------------------------------------------------
// Page header
// ---------------------------------------------------------------------------
export const APP = {
  title: 'RAG Lab',
  subtitle: 'Watch a document become a chatbot answer, one step at a time.',
  course: 'CBIS 5530 · Introduction to RAG · Georgia College & State University',
};

// ---------------------------------------------------------------------------
// The stepper across the top. Order matters; ids are used in code.
// ---------------------------------------------------------------------------
export const LANES = {
  build: { name: 'Build time', label: 'happens once per document' },
  run: { name: 'Run time', label: 'happens for every question' },
};

export const STEPS = [
  { id: 'document', number: 0, label: 'Document', lane: null,
    lockedHint: '' },
  { id: 'chunk', number: 1, label: 'Chunk', lane: 'build',
    lockedHint: 'Add a document first' },
  { id: 'embed', number: 2, label: 'Embed', lane: 'build',
    lockedHint: 'Chunk your document first' },
  { id: 'retrieve', number: 3, label: 'Retrieve', lane: 'run',
    lockedHint: 'Embed your chunks first' },
  { id: 'assemble', number: 4, label: 'Assemble', lane: 'run',
    lockedHint: 'Retrieve some passages first' },
  { id: 'answer', number: 5, label: 'Answer', lane: 'run', optional: true,
    lockedHint: 'Assemble a prompt first' },
];

// ---------------------------------------------------------------------------
// Explainer panels: one per station, two short paragraphs each.
// ---------------------------------------------------------------------------
export const EXPLAINER_TITLE = 'What is happening here';

export const EXPLAINERS = {
  document: {
    what: "This is the raw material. Everything the chatbot will ever \"know\" comes from the text you put here. Paste it, upload a file, or load the sample employee handbook. The app counts the words so you can see how much material you are working with.",
    why: "A RAG chatbot does not read the whole document each time you ask a question. It reads pieces of it. So the document's length, structure, and wording decide what the later steps can find. Choose a document you understand, so you can judge whether the system found the right passage.",
  },
  chunk: {
    what: "The document is cut into pieces of a fixed number of characters, called chunks. Each chunk overlaps the previous one by a few characters so a sentence at the edge is not lost entirely. The cards below show every chunk, where it starts and ends, and where a cut landed mid-sentence.",
    why: "Retrieval works on chunks, not on the whole document. If a chunk is too small, a policy gets split and the answer is scattered. If it is too big, unrelated text rides along and confuses the model. Watch a numbered policy get severed here; that is the failure you will diagnose later.",
  },
  embed: {
    what: "An embedding turns a chunk of text into a list of numbers. Chunks about similar things get similar lists. In Glass Box mode every number is tied to a word, so you can read the whole list. In Black Box mode a small neural model produces 384 numbers that no one can read directly.",
    why: "Computers cannot compare meaning, but they can compare numbers. Turning text into numbers is what lets the system find the right passage later. Glass Box shows you exactly what a vector is. Black Box shows you why real systems use learned vectors: they can tell that \"PTO\" and \"vacation\" mean the same thing.",
  },
  retrieve: {
    what: "Your question is turned into a vector the same way the chunks were. The system then scores every chunk by how close its vector is to the question's vector, sorts them, and keeps the top few. TOP_K is simply where the list gets cut.",
    why: "This is the step that decides what the language model gets to see. If the right chunk is not in the top k, the model cannot use it, no matter how good the model is. Most RAG failures are retrieval failures. The map shows the question landing among the chunks so you can see why.",
    cosine: "The score is cosine similarity: how closely two vectors point in the same direction. It runs from 0 (nothing in common) to 1 (identical). A score of 0.82 means the chunk and the question share most of their content. A score of 0.31 means a weak connection, probably a few shared words.",
  },
  assemble: {
    what: "The final prompt is built from three blocks: an instruction telling the model how to behave, the retrieved passages, and your question. Nothing else. This whole block of text is what actually gets sent to the language model. You can copy it and paste it into any chatbot yourself.",
    why: "The model never sees your document. It sees only this prompt. The instruction tells it to answer from the passages and to admit when they do not contain the answer. That single sentence is what keeps a RAG chatbot from making things up, and it is the first thing to check when one does.",
  },
  answer: {
    what: "This optional step sends the assembled prompt to a language model using a key you supply and shows the reply next to the passages it was given. The key stays in your browser's memory for this visit only and goes nowhere except to the provider you chose.",
    why: "Reading the answer beside the passages lets you check the one thing that matters: did the model stay inside the material? An answer that sounds right but matches nothing in the passages is a hallucination. The prompt, the passages, and the reply are all visible, so you can judge it yourself.",
  },
};

// ---------------------------------------------------------------------------
// Callouts (the gold boxes)
// ---------------------------------------------------------------------------
export const CALLOUTS = {
  privacy: "Use only documents you are comfortable sharing. Never paste confidential employer material into any AI tool, including this one.",
  pasteIntoLlm: "This is what gets sent to the language model. Copy it and paste it into Gemini, ChatGPT, or Claude to see the answer it produces. Then ask: did the model stay inside the passages?",
  modelDownload: "Downloading a 23 MB embedding model to your browser. This happens once.",
  modelFailed: "The neural model could not be loaded, so Black Box mode is unavailable right now. Glass Box mode still works fully. This usually means the network blocked the download; try again later or on another connection.",
  blackBoxUnreadable: "These 384 numbers are not words. No one can read them. But nearby vectors mean similar meanings.",
  answerKey: "Your key is used only for this request and is kept in memory until you close the tab. Use a key you created for this class, and delete it afterwards.",
};

// ---------------------------------------------------------------------------
// Sample questions offered in the dropdown at Station 3
// ---------------------------------------------------------------------------
export const SAMPLE_QUESTIONS = [
  {
    key: 'synonym',
    label: 'Synonym probe',
    text: 'How much PTO do new employees get?',
    note: "The handbook says \"vacation\", never \"PTO\". Watch this fail in Glass Box and succeed in Black Box.",
  },
  {
    key: 'grounding',
    label: 'Grounding probe',
    text: 'How many weeks of parental leave does the company offer?',
    note: "The handbook does not cover parental leave. A well-behaved model should say the material does not answer this.",
  },
  {
    key: 'lexical',
    label: 'Direct match',
    text: 'When must expense reports be submitted?',
    note: "The words \"expense\" and \"submitted\" appear in the passage, so both modes find it.",
  },
];

// ---------------------------------------------------------------------------
// Sidebar (the three dials)
// ---------------------------------------------------------------------------
export const DIALS = {
  heading: 'Dials',
  intro: 'These three settings match the notebook. Change one and the steps after it will ask to be re-run.',
  chunkSize: { label: 'CHUNK_SIZE', help: 'characters per chunk' },
  chunkOverlap: { label: 'CHUNK_OVERLAP', help: 'characters shared with the previous chunk' },
  topK: { label: 'TOP_K', help: 'passages handed to the model' },
  overlapTooLarge: 'CHUNK_OVERLAP must be smaller than CHUNK_SIZE. Otherwise every chunk would start inside the previous one and the process would never move forward. Lower the overlap or raise the chunk size.',
  outOfRange: 'That value is outside the range this lab supports. Enter a number between {min} and {max}.',
  staleNotice: 'Settings changed. Re-run this step to update.',
};

// ---------------------------------------------------------------------------
// Station 0 — Your document
// ---------------------------------------------------------------------------
export const STATION_DOCUMENT = {
  heading: 'Your document',
  placeholder: 'Paste your text here, upload a file, or load the sample document.',
  uploadButton: 'Upload a file',
  uploadHint: 'Accepts .txt, .md, and .docx',
  sampleButton: 'Load the sample document',
  wordCount: '{name} · {words} words · {chars} characters',
  emptyCount: 'No text yet',
  pastedName: 'pasted text',
  reading: 'Reading {name}…',
  rejectedFile: 'That file type is not supported. Please upload a .txt, .md, or .docx file.',
  readError: 'That file could not be read. Try saving it again as .txt or .docx and re-uploading.',
  sampleError: 'The sample document could not be loaded. If you opened index.html straight from a folder, run it from a web server instead (see README.md).',
  continueButton: 'Chunk this document',
};

// ---------------------------------------------------------------------------
// Station 1 — Chunk
// ---------------------------------------------------------------------------
export const STATION_CHUNK = {
  heading: 'Chunks',
  notYet: 'Your document has not been chunked yet.',
  runButton: 'Chunk this document',
  rerunButton: 'Re-chunk',
  continueButton: 'Embed these chunks',
  summaryCount: '{count} chunks',
  summaryAverage: 'average {average} characters',
  summaryCuts: '{mid} of {boundaries} cuts fell mid-sentence',
  settingsUsed: 'CHUNK_SIZE={chunkSize}  CHUNK_OVERLAP={chunkOverlap}',
  cardTitle: 'Chunk {n}',
  cardSpan: 'chars {start}–{end}',
  cardLength: '{length} chars',
  overlapLabel: 'These {count} characters are repeated from the end of chunk {n}',
  cutLabel: 'cut mid-sentence',
  cleanCutLabel: 'cut at a sentence end',
  endLabel: 'end of document',
};

// ---------------------------------------------------------------------------
// Station 2 — Embed
// ---------------------------------------------------------------------------
export const STATION_EMBED = {
  heading: 'Embeddings',
  notYet: 'Your chunks have not been embedded yet.',
  runButton: 'Embed all chunks',
  rerunButton: 'Re-embed',
  continueButton: 'Retrieve passages',
  modeLabel: 'Embedding mode',
  modeGlass: 'Glass Box (TF-IDF)',
  modeGlassHelp: 'Every dimension is a word you can read.',
  modeBlack: 'Black Box (neural model)',
  modeBlackHelp: '384 numbers no one can read. Matches meaning, not spelling.',
  summaryGlass: '{count} vectors · {dimensions} dimensions, one per distinct word in your document',
  summaryBlack: '{count} vectors · {dimensions} dimensions from the neural model',
  droppedWords: 'Dropped {dropped} common words such as "the" and "of" before counting, and kept {kept}.',
  mapHeading: 'The map',
  mapIntro: 'Every chunk is a point. Chunks with similar words sit close together. The two directions that spread the points out most were chosen as the axes (a method called PCA), so the axes have no names of their own.',
  mapHover: 'Hover over or tab to a point to read which chunk it is.',
  inspectHeading: 'Inspect one chunk',
  inspectIntro: 'Click a point on the map, or a number below, to see that chunk as a vector.',
  inspectTitleGlass: 'Chunk {n} — Glass Box vector ({dimensions} dimensions; showing the {shown} heaviest)',
  inspectNonZero: 'Every other dimension is 0 — this chunk does not contain those words. Only {nonZero} of {dimensions} dimensions are above zero.',
  inspectDropped: 'This chunk kept {kept} words and dropped {dropped} common ones.',
  inspectZeroWeight: 'A word that appears in every chunk also scores 0. It cannot tell chunks apart, so it is worth nothing here.',
  noSelection: 'No chunk selected yet.',
};

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------
export const UI = {
  optionalTag: 'optional',
  lockedPrefix: 'Locked: ',
  notBuilt: 'Not built yet',
  notBuiltParenthetical: '(Arrives in a later phase.)',
  staleStep: 'Re-run to update',
  footer: 'Nothing you type leaves this browser tab unless you choose the optional answer step. No account, no cookies, no tracking.',
};
