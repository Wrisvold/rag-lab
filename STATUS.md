# RAG Lab — build status

Updated at the end of each phase. Newest phase first.

## Phase 1 — Station 0 and Station 1 (done, awaiting Ward's review)

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
