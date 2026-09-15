# RAG Lab — build status

Updated at the end of each phase. Newest phase first.

## Phase 0 — Scaffold and corpus (done, awaiting Ward's review)

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
