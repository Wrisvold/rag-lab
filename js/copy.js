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

// The two ways to use the lab. Links in the header of both pages.
export const MODES = {
  label: 'Mode',
  walkthrough: 'Walkthrough',
  flow: 'Flow',
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

// The bold lead-ins of the explainer paragraphs, as Flow mode prints them.
export const EXPLAINER_LABELS = { what: 'What this step does. ', why: 'Why it matters. ', cosine: 'About the score. ' };

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
    text: 'How many days of PTO do new employees get?',
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
  inspectTitleBlack: 'Chunk {n} — Black Box vector ({dimensions} dimensions)',
  heatStripLabel: 'All {dimensions} numbers as a strip of colours: teal above zero, amber below, darker means larger.',
  firstNumbers: 'The first {count} numbers, as they are:',
  blackUnavailable: 'Black Box mode is unavailable in this browser session.',
  progressDownload: 'Downloading the model… {percent}%',
  progressPreparing: 'Preparing the model…',
  progressEmbedding: 'Embedding chunk {done} of {total}…',
  progressQuestion: 'Embedding your question…',
};

// ---------------------------------------------------------------------------
// Station 3 — Retrieve
// ---------------------------------------------------------------------------
export const STATION_RETRIEVE = {
  heading: 'Retrieved passages',
  questionLabel: 'Your question',
  questionPlaceholder: 'Type a question about your document',
  sampleLabel: 'Sample questions',
  samplePlaceholder: 'Choose a sample question…',
  runButton: 'Retrieve',
  rerunButton: 'Retrieve again',
  continueButton: 'Assemble the prompt',
  notYet: 'Ask a question and press Retrieve to score every chunk against it.',
  emptyQuestion: 'Type a question first.',
  summary: '{count} chunks scored · TOP_K={topK} · the top {topK} are highlighted in gold',
  wordsHeading: 'How the question was read',
  knownWords: 'Question words that appear in the document:',
  unknownWords: 'Not in the document, so they count for nothing here:',
  noKnownWords: 'None of the words in your question appear in the document. In Glass Box mode the question has no direction at all, so every chunk scores 0.',
  droppedWords: 'Dropped as common words:',
  mapHeading: 'Where the question landed',
  mapIntro: 'The amber diamond is your question, placed on the same map as the chunks. Dashed lines lead to the passages it retrieved.',
  questionMarker: 'Your question',
  questionNoDirection: 'Your question shares no words with the document, so it is drawn at the centre of the map.',
  tableHeading: 'Every chunk, ranked',
  tableIntro: 'Retrieval scores all of them and simply cuts the list at TOP_K. Nothing below the line is "wrong"; it just did not make the cut.',
  colRank: 'Rank',
  colChunk: 'Chunk',
  colScore: 'Score',
  colPreview: 'Preview',
  colTopK: 'Kept?',
  topKMark: '★ top-k',
  cardsHeading: 'The top {topK} passages, in rank order',
  rankBadge: 'Rank {rank}',
  scoreBadge: 'score {score}',
  blackBoxNote: 'In Black Box mode the question became {dimensions} numbers, just like the chunks. There are no words to compare. The model placed the question near chunks that mean similar things, whether or not they share any words.',
};

// ---------------------------------------------------------------------------
// Station 5 — Answer (optional)
// ---------------------------------------------------------------------------
export const STATION_ANSWER = {
  heading: 'The answer (optional)',
  notYet: 'Assemble a prompt first.',
  intro: 'Send the assembled prompt to a language model with a key of your own. Nothing here is required for the course. It is the last step of the pipeline, made visible.',
  providerLabel: 'Provider',
  modelLabel: 'Model',
  modelHint: 'Set on one line in js/constants.js.',
  keyLabel: 'Your API key',
  keyPlaceholder: 'Paste a key you created for this class',
  keyHelpLink: 'Get a key from {provider}',
  forgetButton: 'Forget key',
  askButton: 'Ask the model',
  asking: 'Waiting for {provider}…',
  noKey: 'Paste a key first.',
  costNote: 'A run this size costs a fraction of a cent on the paid providers.',
  givenHeading: 'What the model was given',
  answerHeading: 'What the model said',
  answerMeta: '{provider} · {model}',
  checkHeading: 'Now judge it',
  checkIntro: 'Read the reply against the passages. Every claim in it should trace back to one of them.',
  checks: [
    'Did the answer stay inside the passages?',
    'If the passages did not contain the answer, did the model say so, in the words the instruction asked for?',
    'Did it add anything the passages never said?',
  ],
  errors: {
    badKey: 'The provider rejected that key. Check that you copied the whole key and that it belongs to the provider you chose.',
    noCredit: 'The provider says this key has no credit or quota left. Add credit on the provider\'s site, or try Gemini, which has a free tier.',
    rateLimit: 'The provider asked us to slow down. Wait a minute and try again.',
    network: 'The request never reached the provider. Check your connection; some campus networks block these addresses.',
    refusal: 'The model declined to answer this prompt. Try rewording the question.',
    empty: 'The provider replied but sent no text. Try again.',
    badRequest: 'The provider rejected the request. The model name in js/constants.js may be out of date.',
    server: 'The provider is having trouble right now. Try again in a few minutes.',
  },
};

// ---------------------------------------------------------------------------
// Station 4 — Assemble
// ---------------------------------------------------------------------------
export const STATION_ASSEMBLE = {
  heading: 'The assembled prompt',
  notYet: 'Retrieve some passages first, then assemble the prompt.',
  runButton: 'Assemble the prompt',
  rerunButton: 'Re-assemble',
  block1: '1 · Instruction',
  block1Help: 'Tells the model how to behave. Edit it and watch the full prompt below change.',
  resetButton: 'Reset to the default instruction',
  block2: '2 · Retrieved passages',
  block2Help: 'The top {topK} chunks from Station 3, in rank order, each labelled [Passage n]. The model never sees the rest of your document.',
  block3: '3 · Question',
  block3Help: 'Your question, exactly as you typed it.',
  passageTag: '= chunk {chunk}, score {score}',
  fullHeading: 'The full prompt, exactly as it would be sent',
  length: '{chars} characters · about {tokens} tokens',
  copyPrompt: 'Copy prompt',
  copySummary: 'Copy run summary',
  copied: 'Copied to the clipboard.',
  copyFailed: 'Copying did not work in this browser. Select the text and copy it yourself.',
  summaryHeading: 'Run summary',
  summaryIntro: 'Paste this block into an assignment submission. It records every setting and result of this run, so nobody has to grade screenshots.',
  continueButton: 'Try the optional answer step',
  modeGlassSummary: 'Glass Box (TF-IDF, {dims} dims)',
  modeBlackSummary: 'Black Box ({model}, {dims} dims)',
};

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------
export const UI = {
  optionalTag: 'optional',
  lockedPrefix: 'Locked: ',
  notBuilt: 'Not built yet',
  busy: 'Working…',
  dismiss: 'Dismiss',
  staleStep: 'Re-run to update',
  footer: 'Nothing you type leaves this browser tab unless you choose the optional answer step. No account, no cookies, no tracking.',
};

// ---------------------------------------------------------------------------
// Flow mode (flow.html): the node canvas. Same rules as the explainers:
// under 70 words each, none of the banned words (tests/copy.test.js).
// ---------------------------------------------------------------------------
export const FLOW = {
  // What each kind of wire carries, in words a student would use.
  portNames: {
    text: 'the document text',
    chunks: 'chunks',
    vectors: 'vectors',
    question: 'a question',
    passages: 'retrieved passages',
    prompt: 'an assembled prompt',
    answer: "a model's answer",
  },

  // One entry per node type. `label` is the title on the node; `hint` is the
  // one-line description in the palette.
  nodes: {
    document: { label: 'Document', hint: 'The raw text everything else is built from.' },
    chunk: { label: 'Chunk', hint: 'Cuts the text into fixed-size pieces.' },
    embed: { label: 'Embed', hint: 'Turns every chunk into a vector of numbers.' },
    question: { label: 'Question', hint: 'What the student asks.' },
    retrieve: { label: 'Retrieve', hint: 'Scores every chunk against the question and keeps the top few.' },
    assemble: { label: 'Assemble', hint: 'Builds the prompt: instruction, passages, question.' },
    answer: { label: 'Answer', hint: 'Sends the prompt to a model with your own key. Optional.' },
    note: { label: 'Note', hint: 'A sticky note. It does nothing; it is for you and your instructor.' },
  },

  // Why a wire was refused. Shown in the readout line under the canvas.
  refusals: {
    selfLoop: 'A step cannot feed itself. Its output has to go to a later step.',
    inputTaken: 'That input already has a wire. Each input takes one source, so remove the wire that is there first.',
    cycle: 'That wire would send the pipeline round in a circle, so no step could ever finish. Data flows one way, from the document towards the answer.',
    typeMismatch: 'This input needs {needs}, but the wire carries {got}.',
  },

  // Refusals with a lesson in them, keyed "what the wire carries->what the
  // input needs". Anything not listed here falls back to `refusals.typeMismatch`.
  pairs: {
    'text->chunks': 'Embed works on chunks, not on the whole document. Cut the text into pieces first, so each piece can get a vector of its own.',
    'text->vectors': 'Retrieve compares numbers, not words. The document has to be chunked and then embedded before anything can be scored.',
    'chunks->vectors': 'Retrieve compares numbers, not words. Something has to turn these chunks into vectors first.',
    'chunks->passages': 'Assemble needs the passages that retrieval chose, not every chunk. Without a Retrieve step the model would be handed the whole document.',
    'vectors->passages': 'Assemble needs text a model can read. Vectors are for scoring. Retrieve turns the highest-scoring vectors back into their chunks.',
    'passages->prompt': 'Answer needs one assembled prompt: instruction, passages, and question in a single block. Assemble is the step that builds it.',
    'question->text': 'Chunk works on the document, not on the question. The question is a few words; it gets its own vector later, at Retrieve.',
    'text->question': 'This input wants the question, not the document. The document is what gets scored; the question is what it is scored against.',
  },

  // Why a node did not run. `port` is filled from portNames.
  skipped: {
    missingInput: 'Nothing is wired into this step yet. It needs {port}.',
    upstreamMissing: 'A step before this one has not run, or failed. Fix that step first.',
    notRunnable: 'Notes do not run.',
  },

  // What went wrong inside a node. Codes from the compute modules reuse the
  // walkthrough's wording where it exists (see errorsFrom in js/flow/explain.js).
  errors: {
    EMPTY_DOCUMENT: 'The Document node has no text yet. Paste some, upload a file, or load the sample.',
    EMPTY_QUESTION: 'The Question node is empty. Type a question first.',
    INVALID_SIZE: 'CHUNK_SIZE must be a whole number of 1 or more.',
    INVALID_OVERLAP: 'CHUNK_OVERLAP must be a whole number of 0 or more.',
    UNKNOWN_MODE: 'That embedding mode does not exist. Choose Glass Box or Black Box.',
    UNKNOWN_PROVIDER: 'That provider is not in the list. Choose one from the dropdown.',
    FAILED: 'This step stopped with an error it could not explain. Run it again; if it keeps happening, tell your instructor.',
  },

  // The page itself.
  page: {
    title: 'RAG Lab · Flow',
    subtitle: 'Build the pipeline yourself, one node at a time.',
    skip: 'Skip to the canvas',
    canvasLabel: 'Pipeline canvas',
    canvasHelp: 'Drag a node by its title. Drag from an output on the right to an input on the left to wire them. Scroll to pan, hold Ctrl and scroll to zoom.',
  },

  palette: {
    heading: 'Nodes',
    intro: 'Add a step, then wire its output (right side) into the next step\'s input (left side).',
    add: 'Add {node}',
  },

  presets: {
    heading: 'Start from',
    standard: 'The standard pipeline',
    blank: 'An empty canvas',
  },

  // Each exercise loads a canvas with a Note on it carrying the task.
  exercises: {
    heading: 'Exercises',
    intro: 'Each one loads a canvas with a note on it. Read the note, then do what it asks.',
    items: {
      blank: {
        label: '1 · Build it',
        task: 'Build the path from the Document to the Answer. Add steps from the palette and wire them together. Every wire the canvas refuses tells you what is still missing.',
      },
      missing: {
        label: '2 · Something is missing',
        task: 'This pipeline has no Chunk step. Try wiring the Document straight into Embed and read what the canvas says. Then add what is missing and run it.',
      },
      starved: {
        label: '3 · Starved retrieval',
        task: 'TOP_K is 1 and the question asks about parental leave, which the handbook never mentions. Run it, open Assemble, and read what the model would receive. Was it enough to answer honestly?',
      },
      twoBoxes: {
        label: '4 · Two boxes',
        task: 'The same chunks and the same question go through Glass Box and Black Box. Run all and compare the two Retrieve cards. Explain in one paragraph why they name different chunks.',
      },
      overlap: {
        label: '5 · The lost sentence',
        task: 'CHUNK_OVERLAP is 0 and CHUNK_SIZE is 500. Run it, open Chunk, and find the sentence a cut broke in half. Read the two halves: what does the pipeline now believe a newly hired employee gets? Then raise the overlap and run again.',
        question: 'How many vacation days does a newly hired employee get?',
      },
    },
    loaded: 'Loaded exercise {label}. The note on the canvas says what to do.',
  },

  toolbar: {
    runAll: 'Run all',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fit: 'Fit to screen',
    inspector: 'Inspector',
    zoomLevel: 'Zoom {percent}%',
    exportMenu: 'Export and load',
    copySummary: 'Copy flow summary',
    copyJson: 'Copy graph as JSON',
    download: 'Download graph',
    load: 'Load graph',
    loadHint: 'A .json file saved with Download graph',
    copied: 'Copied.',
    copyFailed: 'Could not copy. Select the text and copy it by hand.',
    loadedFile: 'Loaded {name}.',
    clear: 'Clear the canvas',
    clearConfirm: 'Remove every node and wire from the canvas?',
  },

  inspector: {
    heading: 'Inspector',
    empty: 'Select a node to see its artifact here.',
    close: 'Hide',
    show: 'Inspector',
    noNext: 'Nothing of that kind is wired after this step yet. Add a {node} node and wire it in.',
    feeds: 'This question feeds: {nodes}.',
    feedsNone: 'This question is not wired into anything yet. Drag from its output to a Retrieve node.',
  },

  // Short port labels printed beside each port on a node.
  portLabels: {
    text: 'text',
    chunks: 'chunks',
    vectors: 'vectors',
    question: 'question',
    passages: 'passages',
    prompt: 'prompt',
    answer: 'answer',
  },

  // Inline parameter controls. Dials reuse the sidebar's labels (DIALS).
  params: {
    documentText: 'Document text',
    questionText: 'Question',
    sampleQuestions: 'Sample questions',
    chooseQuestion: 'Choose a sample question…',
    mode: 'Embedding mode',
    instruction: 'Instruction',
    provider: 'Provider',
    noteText: 'Note',
    notePlaceholder: 'Write a note for yourself or your instructor.',
  },

  // Node chrome.
  node: {
    run: 'Run',
    remove: 'Remove the {node} node',
    removeWire: 'Remove the wire from {from} to {to}',
    notRun: 'Not run yet',
    stale: 'Re-run to update',
    running: 'Running…',
    inputWired: '{node}: input for {port}. Wired from {source}.',
    inputFree: '{node}: input for {port}. Not wired.',
    output: '{node}: output, {port}. Press Enter to start a wire.',
  },

  // One line under each node once it has run.
  summaries: {
    notRun: 'not run',
    document: '{name} · {words} words',
    chunk: '{count} chunks · {cuts} mid-sentence cuts',
    embed: '{count} vectors · {dims} dimensions',
    question: 'Ready',
    retrieve: 'Top {k} of {total}: chunks {numbers}',
    assemble: '{chars} characters · about {tokens} tokens',
    answer: '{provider} replied · {chars} characters',
  },

  // The readout line under the canvas (aria-live).
  readout: {
    added: 'Added a {node} node. Arrow keys move it; Delete removes it.',
    removed: 'Removed the {node} node.',
    wiringKeyboard: 'Wiring from {node}. Tab to a matching input and press Enter. Escape cancels.',
    wiringPointer: 'Wiring from {node}. Click a matching input, or click anywhere else to cancel.',
    wiringNoTargets: 'Nothing on the canvas can take {port} yet. Add the step that comes next.',
    wired: 'Wired {from} to {to}.',
    wireCancelled: 'Wire cancelled.',
    wireRemoved: 'Removed the wire from {from} to {to}.',
    running: 'Running {node}…',
    ran: '{ran} ran, {fresh} already up to date, {skipped} waiting on another step, {failed} failed.',
    nothingToRun: 'Nothing to run yet. Add a Document node and wire it up.',
    cleared: 'Canvas cleared.',
    presetLoaded: 'Loaded the standard pipeline.',
    blankLoaded: 'Started with an empty canvas.',
  },

  // Errors when loading an exported graph.
  load: {
    badFormat: 'That file is not a RAG Lab graph.',
    badVersion: 'That graph was saved by a newer version of RAG Lab and cannot be opened here.',
    badNode: 'The graph names a node type this version does not have: {type}.',
    badEdge: 'The graph has a wire that cannot be made: {reason}',
  },
};

// ---------------------------------------------------------------------------
// Agent mode (agent.html). See agent-mode-plan.md.
// All text here follows ASD-STE100 Simplified Technical English:
// instructions of 20 words or fewer, other sentences of 25 words or fewer,
// active voice, no semicolons, no phrasal verbs. {name} marks a value.
// ---------------------------------------------------------------------------
export const AGENT = {
  // The default system prompt, in the six sections of the workbench.
  defaultPrompt: {
    name: 'Default',
    sections: [
      { id: 'role', title: 'Role',
        text: 'You are the Fall Line help agent. You help employees of Fall Line Supply Company.' },
      { id: 'tasks', title: 'Tasks',
        text: 'You answer questions about the handbook. You tell employees their vacation balance. You help employees make vacation requests.' },
      { id: 'rules', title: 'Rules',
        text: 'Use only the handbook passages for facts. Give the section number for each fact. Give vacation data only for the employee who asks. Do not send a vacation request with less than two weeks of notice.' },
      { id: 'tools', title: 'Tool guidance',
        text: 'Use search_handbook for each handbook question. Use get_vacation_balance before you prepare a vacation request.' },
      { id: 'stop', title: 'Stop rules',
        text: 'If a search does not answer the question, search one more time with different words. If the second search fails, say that the handbook does not answer the question.' },
      { id: 'format', title: 'Output format',
        text: 'Write two to four short sentences. End with the section number in brackets, for example [3.1].' },
    ],
  },

  // Tool descriptions: what the model reads. 25 words or fewer each.
  tools: {
    search_handbook: {
      description: 'Finds the handbook passages that best match a query. Returns each passage with its section number and its score.',
      params: {
        query: 'The words to search for.',
        top_k: 'How many passages to return. The default is 3.',
      },
    },
    get_vacation_balance: {
      description: 'Returns the vacation days left for the employee who asks. It cannot return data about a different employee.',
      params: { employee_id: 'The ID of the employee who asks, for example E-101.' },
    },
    submit_vacation_request: {
      description: 'Records a vacation request for the manager of the employee. A person must approve each request before the tool records it.',
      params: {
        employee_id: 'The ID of the employee who asks.',
        start_date: 'The first day of the vacation, as YYYY-MM-DD.',
        end_date: 'The last day of the vacation, as YYYY-MM-DD.',
      },
    },
  },

  // Rules in code that the tools apply. [n.n] is the handbook section.
  rules: {
    owner: 'The agent can give vacation data only for the employee who asks. [5.2]',
    dates: 'The dates must be real dates, as YYYY-MM-DD, and the end must not be before the start.',
    notice: 'A vacation request must arrive at least {days} before the vacation starts. This request has {actual} of notice. [3.1]',
    service: 'An employee can use vacation after {days} of service. On the first day of this vacation, the employee has {actual} of service. [3.1]',
    balance: 'The request is for {requested}. The employee has {left} of vacation left. [3.1]',
    passed: 'Passed.',
    disabled: 'This exercise disables the rule in code.',
    // Counts: {n} is a number. The code selects the singular or the plural.
    day: '{n} day',
    days: '{n} days',
    workDay: '{n} work day',
    workDays: '{n} work days',
  },

  // What the check part reports. One line for each rule.
  checks: {
    C1pass: 'All important words of the query are in the handbook.',
    C1fail: 'These words are not in the handbook: {words}.',
    C2pass: 'The best score is {score}. The threshold is {threshold}.',
    C2fail: 'The best score is {score}. It is less than the threshold of {threshold}.',
    C3pass: 'The best passage is in Section {section}.',
    C3fail: 'The best passage is not in a numbered section.',
    T1: 'The tool returned a result.',
    T1fail: 'The tool returned no result.',
    A1pass: 'The answer gives Section {section}, and a retrieved passage is in that section.',
    A1fail: 'The answer has no section number from the passages.',
    A2: 'The answer comes from a tool result.',
    G1: 'The agent said that it cannot answer. This is an honest result.',
  },

  // Answers that the Glass Box agent can give. It cannot write, so it uses these forms.
  answers: {
    giveUp: 'The handbook does not answer this question. Ask the People Operations team.',
    balance: 'You have {days} of vacation left.',
    recorded: 'The system recorded your vacation request from {start} to {end}, for {days}. Your manager must approve it.',
    refusedByRule: 'The system did not record your request. {reason}',
    refusedByPerson: 'A person refused the request. The system did not record it.',
  },

  // Feedback that starts the next round after a failed answer check.
  feedback: {
    noCitation: 'Your answer has no section number from the passages. Add the section number, or say that the handbook does not answer the question.',
  },

  // Stop conditions: the message, then the teaching note.
  stops: {
    ANSWER_ACCEPTED: {
      message: 'The check accepted the answer. The loop stopped.',
      note: 'This is the stop that you want. The agent stopped because it finished, not because it reached a limit.',
    },
    MAX_ROUNDS: {
      message: 'The loop stopped at the maximum number of rounds. The agent did not finish.',
      note: 'The limit is the last safety net. If your agent often stops here, its check or its search method needs work.',
    },
    HARD_LIMIT: {
      message: 'The loop stopped at the hard limit of {limit} rounds. You set no other limit.',
      note: 'With no stop condition, a loop runs until something outside it stops it. Each round costs tokens. Add a stop condition.',
    },
    NO_PROGRESS: {
      message: 'The agent repeated the same action. The loop stopped.',
      note: 'An agent that repeats an action gets the same result. Stop it early and save the cost of the remaining rounds.',
    },
    BUDGET: {
      message: 'The run used its token budget. The loop stopped.',
      note: 'Each round sends the full context again. A budget puts a limit on the cost of one run.',
    },
    GAVE_UP: {
      message: 'The agent told the user that it cannot answer.',
      note: 'An honest answer of "I cannot answer" is a correct result. Lesson 05 calls this a fall back on human oversight.',
    },
    APPROVAL_REFUSED: {
      message: 'You refused the action. The agent did not do it.',
      note: 'The person, not the agent, decides each high-risk action.',
    },
    TOOL_FAILED: {
      message: 'A tool failed two times. The loop stopped.',
      note: 'Do not let an agent call a broken tool again and again. One retry is enough.',
    },
    HUMAN_STOP: {
      message: 'You stopped the run.',
      note: 'A person must be able to stop an agent at any time.',
    },
  },

  // The run summary for assignments.
  summary: {
    title: 'RAG Lab · Agent mode run · {date} (simulated date)',
    agentGlass: 'Glass Box',
    agentBlack: 'Black Box',
    promptGlass: 'not read by the Glass Box agent',
    noLimit: 'no limit',
  },
};
