# RAG Lab — build status

Updated at the end of each phase. Newest phase first.

## Phase 5 — Black Box mode and the optional answer step (done, awaiting Ward's review)

**Read this first: the centrepiece needed a corpus change**

The brief's success criterion 3 says the PTO question must rank the vacation chunk **outside** the top 3 in Glass Box and **at rank 1** in Black Box. With the Phase 0 handbook, Black Box put it at rank 6. I reproduced this outside the browser with the real model (`tools/probe.mjs`) and tested 30-odd wordings and five small models before changing anything. Findings:

- `all-MiniLM-L6-v2` barely associates "PTO" with "vacation". The question's other words ("new employees get") decide the ranking, so chunks about orientation, reimbursements, and benefits win.
- Mean pooling over a 400-character chunk dilutes any one sentence. The vacation policy also shared its chunk with the holiday-pay sentence.
- No wording of the original layout passed with the brief's model. Larger or retrieval-trained small models (`bge-small-en-v1.5`, `gte-small`) passed only after the same wording changes, by margins of about 0.02.

What I changed in `data/sample.txt` (1,105 words; still no "PTO" or "paid time off"):

1. Vacation is now policy **3.1**, first in Section 3, so at the defaults it opens chunk 08 instead of trailing the holiday paragraph. Holidays became 3.2.
2. The allowance is stated in words the question does *not* use: "A newly hired employee gets ten vacation days a year." To TF-IDF, `employee`/`employees`, `gets`/`get`, and `newly`/`new` are different words, so the Glass Box score for this chunk stays 0. To the neural model they mean the same thing. This is a second, honest layer of the same lesson (no stemming, no synonyms), and it is why the Glass Box side is now even clearer.
3. Toned down three semantic decoys so they do not outrank the vacation chunk: 1.2 Orientation (no "new employee" check-in sentence), 4.4 Retirement (no "after ninety days of employment"), 4.5 Professional Development (no "dollars per year"). "New Year's Day", "New hires receive a photo badge", and "get a replacement badge" stay as the lexical decoys for Glass Box.

Result with the brief's model and the brief's question, at the defaults: **Glass Box rank 9 (score 0.00), Black Box rank 1 (0.336, +0.019 over chunk 03)**. Verified in Node and in the browser. The margin is thin: **if you edit the handbook or the question, run `node tools/probe.mjs` and check that it still says PASS.**

**For your decision (I did not change these):** the question "How many days of PTO do new employees get?" gives a margin of +0.086 with the same model and text, and "How many days off do new hires get each year?" gives +0.15. Either is one string in `js/copy.js`. Switching the model to `Xenova/bge-small-en-v1.5` (33 MB) is also one line in `constants.js`, but it did not help enough on its own to be worth breaking the brief.

**Done**
- `js/blackBox.js`: lazy `import()` of Transformers.js from the pinned jsdelivr address, `Xenova/all-MiniLM-L6-v2` quantized, progress folded across model files into one percentage, a stall watchdog (90 s without progress rejects), chunks embedded in batches of 8 with progress, the same `{ mode, dimensions, vectors, embedQuery, inspect }` shape as Glass Box (`embedQuery` is async).
- Global progress bar and notice area under the stepper (`#global-status`), visible whichever station is open, with the brief's download message: "Downloading a 23 MB embedding model to your browser. This happens once."
- Fallback: any load failure flips `state.blackBox.available` to false, reverts the mode to Glass Box, re-embeds, shows "The neural model could not be loaded… Glass Box mode still works fully…" with a Dismiss button, disables the Black Box radio with "unavailable in this browser session", and logs one `console.warn` line (message only, no stack).
- Station 2 in Black Box: summary "20 vectors · 384 dimensions from the neural model"; inspector shows a 384-cell heat strip (teal above zero, amber below, darker = larger, each cell titled with its index and value), the first 10 numbers printed, and the brief's line "These 384 numbers are not words…". The same map re-projects the neural vectors.
- Station 3 in Black Box: "How the question was read" explains that the question became 384 numbers and there are no words to compare.
- Every run action is now `async`; the chain (assemble → retrieve → embed → chunk) awaits each step, and `state.busy` blocks double clicks during a download or an API call.
- `js/answer.js`: `buildRequest` / `parseAnswer` / `describeError` (pure, tested) plus `askModel` (the only network call). Gemini via `x-goog-api-key` header, OpenAI via `Authorization: Bearer`, Anthropic via `x-api-key` + `anthropic-version` + the browser opt-in header. Keys go in headers only; a test asserts none appears in a URL or body. Errors map to eight plain codes.
- Station 5: provider dropdown (Gemini "Has a free tier", OpenAI and Anthropic "Needs prepaid credit"), model name shown with a pointer to `constants.js`, password-type key field with autocomplete off, "Forget key", the memory-only callout, "Ask the model", plain-language error messages, then a two-column view of what the model was given and what it said, and a three-item "Now judge it" checklist. The key lives in `state.ui.apiKey` and nowhere else. The answer goes stale if the prompt text changes.
- `tools/probe.mjs`: the manual Black Box check, scripted. `npm install --no-save @xenova/transformers@2.17.2` once, then `node tools/probe.mjs`. Exits non-zero on FAIL.
- Test suite: 75 passing.

**Verified in the browser**
- Switching to Black Box downloaded the model with the progress bar and embedded 20 chunks in about three seconds on this connection. Inspector for chunk 08: 384 cells, first ten numbers, the note. Map re-projected into a different layout.
- Synonym probe in Black Box: vacation chunk rank 1 (0.33), then orientation (0.33) and health insurance (0.32). Three lines on the map. Glass Box, same text: rank 9.
- Station 5 renders with Gemini selected, a password-type key field with autocomplete off, the memory-only callout, and a link to the provider's key page. "Ask the model" with no key shows "Paste a key first." and focuses the field. I did not enter a key (that is a student's own credential), so the live calls are verified only by the unit tests of the request shapes; please try one provider yourself.
- The fallback path, tested by pointing the Transformers.js constant at a non-existent CDN address and switching to Black Box: the gold notice appeared with the brief's wording, the mode flipped back to Glass Box and re-embedded (20 vectors, 392 dims), the Black Box option became disabled with "unavailable in this browser session", and the console showed one warning line with the failure message and no stack trace.

**Decisions made without asking**
- Raw `fetch` for all three providers rather than vendor SDKs, to keep the brief's zero-dependency rule. The Anthropic call sends the `anthropic-dangerous-direct-browser-access` header, which exists to stop shared keys being shipped in pages; here the key is the student's own and goes only to Anthropic.
- Model names in `constants.js`: `gemini-2.5-flash`, `gpt-5-mini`, `claude-opus-5`. Each is one commented line.
- Answer length capped at 1,024 tokens (`ANSWER_MAX_OUTPUT_TOKENS`).
- The Black Box batch size (8) and stall timeout (90 s) are constants.

**Next: Phase 6** — explainer copy pass, accessibility pass (keyboard order, focus, contrast), cross-browser check (Edge, Firefox, Safari), full README (hosting on GitHub Pages and on S3/CloudFront, changing defaults, swapping the sample, editing copy, known limitations), final STATUS.

## Phase 4 — Prompt assembly and export (done, reviewed)

**Done**
- `js/prompt.js` (pure): `buildPrompt` joins the three blocks (instruction, `[Passage n]` passages, `Question: …`) with blank lines; `estimateTokens` at ~4 characters per token (the constant is in `constants.js`).
- `js/summary.js` (pure): `formatRunSummary` produces the brief's format character for character, including the em dash and arrow, two-decimal scores, and thousands separators. `tests/summary.test.js` pins the exact example from the brief.
- `js/clipboard.js`: modern clipboard API with the old `execCommand` fallback; every failure becomes a plain message.
- Station 4 (`js/stations/assemble.js`): three labelled blocks with amber run-time edges. Block 1 is an editable instruction with "Reset to the default instruction"; edits update the full prompt live and survive a reload. Block 2 lists each passage with its chunk number and score. Block 3 is the question. Then the full prompt in a dark monospace box with Copy prompt and "{chars} characters · about {tokens} tokens", the gold "paste it into Gemini, ChatGPT, or Claude" callout, and the run summary shown in full with Copy run summary (the summary is regenerated at copy time so the timestamp is current).
- Wiring: "Assemble the prompt" on Station 3 builds the prompt and moves on; the prompt remembers which retrieval run it came from and goes stale with it; Re-assemble re-runs the whole chain (retrieve, embed, chunk) if needed. The Answer step unlocks once a prompt exists but is "Not built yet" until Phase 5.
- `DEFAULT_INSTRUCTION` in `constants.js` is the course wording; a test checks the three phrases.
- Test suite: 64 passing.

**Verified in the browser**
- Full chain from a fresh load: chunk, embed, retrieve (grounding probe), assemble. Passages 1–3 are chunks 10, 11, 12 with scores 0.34, 0.21, 0.06. Prompt: 1,483 characters, about 371 tokens. The run summary reads exactly as the brief's example with this run's numbers.
- Editing the instruction to one sentence changed the full prompt and the length line at once, and the new instruction was in sessionStorage.

**Decisions made without asking**
- The prompt text has no headings of its own beyond `[Passage n]` and `Question:`. The three labels are on screen, not in the prompt, so what the student copies is exactly what a model would receive.
- The run summary is shown on the page as well as copied, so a student can check it before pasting.
- Chunk numbers in the summary are the same 1-based, zero-padded numbers shown on the cards.

**Next: Phase 5** — Black Box mode: lazy Transformers.js load with progress and a plain fallback message, 384-dim inspector with heat strip, same map re-projected, manual synonym-probe check; and the optional Station 5 answer step with a student-supplied Gemini, OpenAI, or Anthropic key held in memory only.

## Phase 3 — Retrieval (done, reviewed)

**Done**
- `js/retrieval.js` (pure): `rankChunks` scores every chunk with exact cosine similarity and sorts (ties keep chunk order), `selectTopK` cuts the list (k larger than the list is tolerated), `rankOf` for tests and the run summary.
- `tests/retrieval.test.js`: ranking, ties, cutting, zero query, and **the automated Glass Box synonym probe on the real sample document**: "pto" is not in the vocabulary, the vacation chunk ranks outside the top 3, and no top-3 chunk mentions vacation. Also the direct-match probe (expense chunk is rank 1) and the grounding probe (nothing mentions parental leave, yet retrieval still returns chunks).
- Station 3 (`js/stations/retrieve.js`): question box (Enter runs it), sample-question dropdown with the sample's teaching note underneath, Retrieve / Retrieve again, summary line with TOP_K and the mode, "How the question was read" (Glass Box: words found in the document, words not in the document shown struck through, common words dropped), the map with the question as an amber diamond and dashed lines to its top-k neighbours, the ranked table of every chunk with the top-k rows in gold, and the top-k cards with rank and score badges. "Assemble the prompt" is visible but disabled until Phase 4.
- Wiring: loading the sample document prefills the synonym probe; the question survives a reload; retrieval remembers the question, TOP_K, and the embedding run it came from, so it goes stale when any of those change. Retrieve re-embeds (and re-chunks) first if needed, so a student can change CHUNK_SIZE and press Retrieve in one motion. Typing a new question greys the old results immediately without losing the cursor.
- `embedQuery` in Glass Box now also reports the dropped common words so the station can show all three groups.
- Test suite: 55 passing.

**Verified in the browser**
- With CHUNK_SIZE changed to 400 on the Retrieve station, one press of Retrieve re-chunked (20), re-embedded, and ranked. Summary "20 chunks scored · TOP_K=3". Known words: new, employees, get. Unknown: pto. Dropped: how, much, do. Top 3: chunks 02, 03, 07 (orientation, check-ins, badges). Vacation chunk at rank 9. Three cards, three map lines, three highlighted neighbours. Stepper shows nothing stale. No new console errors.

**Decisions made without asking**
- Changing TOP_K makes the retrieval stale rather than re-cutting the list live, to keep the rule "change a dial, re-run the step" the same for all three dials.
- A question with no known words (all scores 0) is drawn at the centre of the map with a note saying why, instead of being hidden.
- Scores are shown to two decimals, matching the brief's examples.

**Next: Phase 4** — three-block prompt builder, Copy prompt with a token estimate, Copy run summary in the brief's exact format, and the "paste into an LLM" callout.

## Phase 2 — Glass Box embedding and the map (done, reviewed)

**Done**
- Pure modules, each with a test file: `js/tokenizer.js` (lowercase, strip apostrophes, split on non-letters, drop short tokens and stopwords, count what was dropped), `js/tfidf.js` (vocabulary, IDF = ln(N/df), one vector per chunk, query vectors from the same index, top terms), `js/cosine.js` (cosine similarity plus `unitVector`), `js/pca.js` (power iteration with deflation; `fitPca` / `applyPca` so a question can be projected onto the same axes in Phase 3), `js/glassBox.js` (the embedding-mode object both modes will share: `{ mode, dimensions, vectors, embedQuery, inspect, stats }`).
- `js/map.js`: SVG scatter plot. Points are keyboard-focusable buttons with the chunk number inside and the first 80 characters as the accessible name; hover or focus writes the preview to a readout line under the map (no floating tooltip to position). Already supports a question marker and lines to neighbours for Phase 3.
- Station 2 (`js/stations/embed.js`): mode toggle (Black Box shown but disabled, "Arrives in a later phase"), summary line with the vector count and dimensions, the "Dropped N common words" line Ward agreed to, Re-embed, the map, a row of chunk-number chips, and the Glass Box inspector: heading in the brief's format, chunk preview, bar list of the 12 heaviest terms with weights, non-zero dimension count, per-chunk kept/dropped word counts, and the "a word in every chunk scores 0" note. Map point, chip, and inspector stay in sync without rebuilding the SVG.
- Wiring: "Embed these chunks" on Station 1 runs the embedding and moves to Station 2; the Embed step unlocks once chunks exist; embeddings remember which chunking run and which mode they came from, so they go stale on a dial change, a re-chunk, or a mode switch. Re-embed re-chunks first if the chunks are stale. Retrieve step is visible but "Not built yet".
- Test suite: 48 passing.

**Verified in the browser**
- Sample at CHUNK_SIZE=400: 20 vectors, 387 dimensions; at 600: 13 vectors, 383 dimensions, 398 stopwords dropped, 778 words kept. No console errors.
- Clicking chip 07 and map point 13 each update the inspector, the gold point on the map, and the pressed chip. Chunk 13 (the AI-tools and questions section) lists "questions", "ai", "tool", "accurate" as its heaviest words.
- The map groups the welcome/working sections, the time-away/pay policies, and the conduct sections into three visible clusters.

**Decisions made without asking**
- The map projects unit-length vectors. Raw TF-IDF vectors differ in length (short chunks have big weights), which made PCA put one short chunk in a corner and pile everything else together. Cosine similarity ignores length, so the map now shows what retrieval will actually compare. Same rule will apply to Black Box vectors.
- The Glass Box inspector shows term weights as computed (TF × IDF), not re-normalised, so the numbers a student reads match the formula in the explainer.
- The Retrieve step becomes clickable only after embeddings exist, and until Phase 3 its hint says "Not built yet".

**Next: Phase 3** — question box with the sample-question dropdown, exact cosine ranking of every chunk, full ranked table with top-k highlighted, top-k cards, question marker and neighbour lines on the map, and the automated Glass Box synonym-probe test.

## Phase 1 — Station 0 and Station 1 (done, reviewed)

**Done**
- `js/chunker.js`: pure fixed-size chunker with overlap. Returns chunks with start/end, overlap-with-previous, and a mid-sentence flag, plus a summary (count, average length, boundaries, mid-sentence cuts). Throws coded errors instead of clamping. Extension point for other strategies is marked in the file.
- `tests/chunker.test.js`: overlap ≥ size rejected, bad sizes rejected, empty input, coverage and overlap positions, last chunk shorter, exactly-one-chunk, zero overlap, mid-sentence detection, summary counts, and the sample-handbook check that policy 3.2 straddles a boundary at the defaults.
- Station 0: paste (live counts), upload `.txt`/`.md`/`.docx` (mammoth loaded from the CDN only when a `.docx` arrives; table-cell text included), friendly rejection of other types, "Load the sample document", `{name} · words · characters` status, privacy callout, "Chunk this document".
- Station 1: numbered chunk cards with character span and length; the leading overlap shaded teal with a dotted underline and a tooltip naming the previous chunk; a red ✂ where a cut lands mid-sentence and an amber footer saying so; summary line; the settings used; Re-chunk button; a disabled "Embed these chunks" button marked "Not built yet".
- Dial invalidation: chunks remember the settings and document version they were made from. Changing CHUNK_SIZE, CHUNK_OVERLAP, or the text greys the cards, shows "Settings changed. Re-run this step to update." with a Re-chunk button, and puts a gold dot and "Re-run to update" on the stepper. Stale is computed from the stored settings, so changing a dial back clears it.
- `js/session.js`: the document text and dials survive a reload through sessionStorage (try/catch; artifacts are not stored, so the student re-runs the steps).
- Small modules: `js/dom.js` (element helper), `js/text.js` (word count, newline normalisation, number formatting), `js/fileReader.js`, `js/stations/document.js`, `js/stations/chunk.js`. Tests for `text.js` and the pure parts of `fileReader.js`.
- Layout: stepper wraps instead of overflowing on narrow screens; the sidebar stops being sticky when the layout stacks. `.gitattributes` pins LF line endings.

**Verified in the browser (Chrome engine in the desktop app)**
- Sample loads: `sample.txt · 1,119 words · 6,870 characters`. Chunking at the defaults: 20 chunks, 19 of 19 cuts mid-sentence, no console errors.
- Changing CHUNK_SIZE to 600 greys the 20 cards and marks the step stale; Re-chunk produces 13 chunks with 12 of 12 cuts mid-sentence.
- Reload restores the document text and the dial values.
- A synthetic `.docx` with a paragraph, a two-cell table, and a trailing paragraph reads as five lines in about 200 ms including the mammoth download. A `.pdf` name is rejected (unit test).

**Decisions made without asking**
- "Mid-sentence" skips spaces and tabs just before the cut, so a cut right after "Day. " counts as clean. The brief's literal definition would flag that as mid-sentence, which students would read as a bug. `SENTENCE_END_CHARS` in `constants.js` still controls what ends a sentence.
- Chunks are numbered from 1 for students (Chunk 01 … 20). The notebook's Python lists are 0-based; the run summary in Phase 4 will use the same 1-based numbers, and the README will say so.
- Overlap shading marks only the leading overlap (shared with the previous chunk), as the brief asks. The trailing repeat is visible on the next card.
- `serve.js` (zero-dependency) was added so anyone can run the app locally with `node serve.js`; `npx serve` did not start cleanly on this Windows machine.

**Next: Phase 2** — tokenizer, TF-IDF, cosine, PCA modules with tests; Glass Box vector inspector (with the "dropped N common words" line Ward agreed to); the 2D map; unlock the Embed step.

## Phase 0 — Scaffold and corpus (done, reviewed)

**Done**
- Folder structure: `index.html`, `styles.css`, `js/`, `data/`, `tests/`, `README.md`, `STATUS.md`, `package.json` (test script only, no build).
- `index.html` shell: header, stepper, dials sidebar, station panel, footer.
- `styles.css`: GCSU Evergreen palette as CSS variables, teal/amber lane colors, system font stacks, focus rings, stale-state styling.
- `js/constants.js`: every default and range with a plain-language comment.
- `js/copy.js`: all user-facing text, including drafted explainer copy for all six stations, callouts, sample questions, and dial messages.
- `js/main.js`: renders header, stepper (with lane tags and locked hints), dials (with out-of-range and overlap-too-large messages, no clamping), and the Station 0 shell. No station behaviour yet.
- `data/sample.txt`: Fall Line Supply Company employee handbook excerpt, 1,119 words, 6,870 characters. Fictional company in Milledgeville, Georgia.
- `tests/copy.test.js`: explainer word limit, banned words, one explainer per step, PTO/vacation check on the corpus.

**Corpus verification at CHUNK_SIZE=400, CHUNK_OVERLAP=50 (scratch script, same tokenizer rules that Phase 2 will implement)**
- 20 chunks, 19 mid-sentence cuts.
- Policy 3.2 (Vacation) straddles the boundary between chunks 8 and 9: the accrual sentence is in chunk 8, the request rules in chunk 9. Every numbered policy longer than 350 characters straddles a boundary.
- Synonym probe "How much PTO do new employees get?" in TF-IDF: vacation chunk ranks 9th of 20. Top 3 are the orientation chunk, the "new employee" check-in chunk, and the badges chunk.
- Grounding probe "How many weeks of parental leave does the company offer?" returns the sick leave and vacation chunks; nothing about parental leave exists in the text.
- Direct match "When must expense reports be submitted?" returns the expense reimbursement chunk at rank 1.

**Decisions made without asking**
- Stepper has six steps, not five: Ward chose an optional Station 5 (Answer, bring-your-own key). It is tagged run-time and marked "optional".
- Tokenizer rule for Glass Box, fixed now so the corpus check holds in Phase 2: lowercase, strip apostrophes, split on anything that is not a letter or digit, drop tokens under 2 characters and a small stopword list (in `constants.js`). IDF is `ln(N / df)`, so a word that appears in every chunk gets weight 0. This is a teaching choice: "a word in every chunk tells you nothing."
- Words like "get" and "new" are deliberately used in the orientation and badge sections so that the PTO question has lexical decoys and the Glass Box failure is clear.
- Company name "Fall Line Supply Company" (the Fall Line runs through Milledgeville). No real company, person, or policy.
- `package.json` exists only so `npm test` works; there is still no build step.
- Model names for Station 5 (`gemini-2.5-flash`, `gpt-4o-mini`) are placeholders in `constants.js` and will be confirmed in Phase 5.

**Please review before Phase 1**
- The handbook text in `data/sample.txt` (tone, policies, anything you would rather change).
- The explainer copy in `js/copy.js`.
- The sample questions.

**Next: Phase 1** — Station 0 behaviour (paste, upload incl. .docx via mammoth, sample loading, counts), chunker module with tests, chunk cards with overlap shading and cut markers, summary line, dial invalidation.
