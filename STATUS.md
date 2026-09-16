# RAG Lab — build status

Updated at the end of each phase. Newest phase first.

## Flow mode — phase plan (done: Phases 7 to 11, on the flow-mode branch)

A second way to use RAG Lab: a node canvas in the style of Langflow or Flowise, where the student places the stages and wires them together, but built to teach rather than to ship. Nothing in the existing walkthrough changes. Flow mode is added beside it and shares every compute module.

**Goals**
- The student builds the pipeline rather than walking through it. An empty canvas with a Document node and an Answer node is the first exercise; the gap between them is the lesson.
- Every wire is type-checked and every refusal is a sentence a student can learn from, never a silent failure or a stack trace.
- Two pipelines can run side by side on one canvas (Glass Box and Black Box feeding two Retrieve nodes), which the walkthrough's toggle cannot do.
- Sabotage exercises: a working graph with one deliberate fault, and a question the student must answer by reading the artifacts.
- The graph exports as JSON whose shape mirrors the Colab notebook, so the picture and the code line up.

**Non-goals**
- No general-purpose node editor. The node types are the six stations plus a few teaching nodes, and the list is fixed in code.
- No new dependencies and no build step. The canvas is hand-rolled SVG and HTML.
- No change to the walkthrough, its copy, its tests, or its URL. First-week students should not notice Flow mode exists unless they are sent to it.

**Architecture in one paragraph**
The compute modules (`chunker`, `glassBox`, `blackBox`, `retrieval`, `prompt`, `answer`) already take plain data and return plain data with version stamps. Flow mode adds three pure layers over them: a **registry** (one entry per node type: ports, parameters, and which function to call), a **graph** (nodes, edges, port type checks, topological order, stale propagation), and a **runner** (walks the order, awaits each node, writes artifacts back to the nodes). The **canvas** is a view over the graph and never computes anything. The existing station renderers are reused as node inspectors in a side panel. Flow mode lives at `flow.html` with its own `js/flow/main.js`, so `js/main.js` is untouched.

**Node types and port types**

| Node | Inputs | Outputs | Parameters |
|---|---|---|---|
| Document | — | `text` | paste, upload, sample (same as Station 0) |
| Chunk | `text` | `chunks` | CHUNK_SIZE, CHUNK_OVERLAP |
| Embed | `chunks` | `vectors` | mode: Glass Box or Black Box |
| Question | — | `question` | the question text, sample dropdown |
| Retrieve | `vectors`, `question` | `passages` | TOP_K |
| Assemble | `passages`, `question` | `prompt` | instruction block |
| Answer | `prompt` | `answer` | provider, key (memory only, as today) |
| Compare (deferred) | two of the same type (`passages` or `answer`) | — | none; shows both inputs side by side |
| Note | — | — | free text; a sticky note for exercises |

Port types are `text`, `chunks`, `vectors`, `question`, `passages`, `prompt`, `answer`. A wire is accepted only when the output type equals the input type. Each refused pairing has its own sentence in `copy.js` (for example, Retrieve fed from Chunk: "Retrieve compares numbers, not words. Something has to turn these chunks into vectors first."). Nodes that share a parameter with the sidebar dials (Chunk, Retrieve) carry it on the node itself in Flow mode; the sidebar is not shown there.

### Phase 7 — Graph core (pure, no UI)

**Deliverables**
- `js/flow/registry.js`: the node table above as data. Each entry names its ports, its parameter defaults (taken from `constants.js`), and an async `run(inputs, params, context)` that calls the existing module. Embed in Black Box mode shares one model load across every Embed node through `context`.
- `js/flow/graph.js` (pure): `createGraph`, `addNode`, `removeNode`, `connect`, `disconnect`, `setParam`, `moveNode`. `connect` returns `{ ok: false, code }` for a type mismatch, an input port already wired, a cycle, or a self-loop. `order(graph)` gives a topological order; `dependents(graph, nodeId)` gives everything downstream. Every node artifact is stamped with the versions of its inputs and parameters, so `isStale(graph, nodeId)` is computed the same way the walkthrough computes it today.
- `js/flow/runner.js`: `runGraph(graph, context, { onStart, onDone, onError })` runs nodes in order, skips nodes whose inputs are missing, awaits each `run`, and marks dependents stale before running them. `runNode` runs one node and its stale ancestors, the way "Retrieve" re-chunks and re-embeds today.
- `js/flow/serialize.js`: `toJSON(graph)` and `fromJSON(json)`. The JSON has a `pipeline` array in execution order with the notebook's parameter names, plus a `layout` block with node positions that the notebook ignores.
- Tests: `tests/flow/graph.test.js` (every refusal code, ordering, cycle detection, stale propagation through a diamond), `tests/flow/runner.test.js` (a full Glass Box graph on the sample document reproduces the walkthrough's synonym-probe ranking exactly), `tests/flow/serialize.test.js` (round trip, and the export matches a pinned fixture).
- `copy.js`: `FLOW.refusals`, one sentence per refusal code, under the same word limit and banned-word rules as the explainers. `tests/copy.test.js` extended to cover them.

**Exit check:** `npm test` green; a Node script can build the canonical graph from JSON, run it, and print the same run summary the walkthrough prints.

### Phase 8 — The canvas

**Deliverables**
- `flow.html`: same head, header, and footer as `index.html`; a mode link in the header of both pages ("Walkthrough · Flow"); a node palette on the left, the canvas in the middle, an inspector panel on the right that is empty until a node is selected.
- `js/flow/canvas.js`: a scrolling, zoomable surface. Nodes are HTML `<article>` elements absolutely positioned in a transformed layer; edges are one SVG layer underneath drawn as cubic curves between port centres. Pan with drag on empty space or the scroll wheel; zoom with Ctrl+wheel and two buttons; a "Fit" button. Node drag with the pointer. Wire by dragging from an output port to an input port; the target port highlights green when the types match and red when they do not, and a refused drop shows the refusal sentence in a readout line under the canvas (no floating tooltip, same rule as the map).
- Keyboard: every node and every port is focusable in reading order. Arrow keys move a focused node by a grid step; Shift+arrow by a larger one. Enter on an output port starts a connection, Tab moves between candidate input ports (only compatible ones are in the tab order while connecting), Enter completes it, Escape cancels. Delete removes the focused node or edge. Every action is announced through one `aria-live` readout.
- `prefers-reduced-motion` turns off edge redraw easing and the zoom transition.
- Node chrome: title, a lane tag (build time in teal, run time in amber, matching the stepper), an artifact summary line ("20 chunks", "20 vectors · 392 dimensions", "3 passages"), a stale badge with the gold dot, a Run button, and the node's parameters as inline controls.
- Constants: grid step, zoom bounds, default node size, canvas padding, all in `constants.js` under a `FLOW_` prefix.

**Exit check (in the browser):** build the six-node chain from the palette by mouse, then again by keyboard only, run it, and get the synonym-probe result. Wire Chunk to Retrieve and read the refusal. No console errors. Focus never trapped.

### Phase 9 — Inspectors, running, and staleness on screen

**Deliverables**
- Selecting a node renders its station in the inspector panel. The station renderers take an `app` object today; a thin adapter in `js/flow/adapter.js` gives them the same interface backed by the graph, so `stations/*.js` are reused without edits. Anything that turns out to need a change is made once and kept compatible with the walkthrough.
- Run controls: Run on a node runs it and its stale ancestors; "Run all" on the toolbar runs the whole graph in order. The global progress bar and notice area move into the shared layout so the Black Box download and the Black Box fallback behave exactly as in the walkthrough.
- Changing a parameter or an upstream artifact greys every dependent node and edge on the canvas at once, using the same stale rule and the same visual language as the stepper.
- Two Embed nodes in Black Box mode share one model download; two Retrieve nodes on different vectors show different rankings for the same Question node.
- The canvas and every parameter survive a reload through `sessionStorage`, using the Phase 7 serializer; artifacts are not stored, so the student re-runs.
- Tests: adapter unit tests; a stale-propagation test through a shared Question node feeding two branches.

**Exit check:** the side-by-side lesson. One Document, one Chunk, two Embed nodes (Glass and Black), one Question, two Retrieve nodes, two inspectors open. Vacation chunk rank 6 or worse on the left, rank 1 on the right, on one screen.

### Phase 10 — The teaching layer

**Deliverables**
- Exercise presets in `js/flow/exercises.js`, each a graph JSON plus a prompt and a teaching note in `copy.js`:
  1. **Blank.** Document and Answer only. "Build the path between them."
  2. **Wrong input.** Embed wired straight from Document. The student must discover that Embed refuses text, and why.
  3. **Starved retrieval.** TOP_K = 1 with the grounding-probe question. "What did the model receive, and was it enough?"
  4. **Two boxes.** The Phase 9 side-by-side graph, pre-built. "Explain the difference in one paragraph."
  5. **Broken overlap.** CHUNK_OVERLAP = 0 and CHUNK_SIZE chosen so the vacation policy splits mid-number. "Find the sentence the pipeline lost."
- A Compare node renderer: two inputs of the same type in two columns, with differences highlighted (ranks that moved, passages present in one and not the other).
- Export: "Copy graph as JSON" and "Download graph" on the toolbar; "Load graph" accepts a file. The notebook's section of the README documents the mapping. The run summary gains a Flow variant that lists every node in order with its parameters.
- Refusal copy pass: every refusal, exercise note, and node description reviewed against the explainer rules; tests updated.

**Exit check:** each exercise loads, runs, and reaches the state its note describes. A graph exported from one browser loads in another.

### Phase 11 — Polish, docs, review

- Contrast and focus pass over every new element, same 4.5:1 rule and the same measured table as Phase 6.
- Narrow-screen behaviour: the palette and inspector collapse into drawers; the canvas keeps working with touch drag.
- README: a Flow mode section (what it is for, the exercises, the JSON export, keyboard reference) and a second table of constants.
- STATUS entry in the usual format with what was verified in the browser and the decisions made without asking.
- Firefox and Safari check of the canvas, which stays on the manual list as it did for Phase 6.

**Decisions**
1. **Decided (Ward, 2026-09-16):** separate page, `flow.html`. All Flow mode work happens on the `flow-mode` branch so `main` stays as the live site until Ward decides whether it is an improvement worth keeping.
2. **Decided (Ward, 2026-09-16):** the Note node ships in the first release. The Compare node is held for a later phase, after students have done the side-by-side lesson by hand once.
3. **Deferred (Ward, 2026-09-16):** whether the Colab notebook will read the exported JSON. Until decided, the export is a reference only, but the `pipeline` block uses the notebook's variable names so it can become the notebook's input later without a format change.

**Risks**
- The canvas is the quality bar. A node editor that is fiddly to drag or unusable from a keyboard undoes the Phase 6 accessibility work. Phase 8 is budgeted as a full phase for that reason, and the keyboard path is built alongside the pointer path, not after it.
- Reusing the station renderers through an adapter may surface assumptions about the single global `state`. The plan allows one round of small edits to `stations/*.js`, kept compatible with the walkthrough and covered by the existing tests.
- Two Black Box nodes double the embedding time, not the download. Acceptable, and the progress bar makes it visible.


## Phase 11 — Flow mode polish, README, review (done)

The last phase of the Flow mode plan. Contrast and focus over every new element, the toolbar regrouped, narrow screens, the README section, and this entry.

**Contrast pass.** Every text and control colour pair Flow mode introduces, measured the same way as Phase 6 (WCAG relative luminance, rounded to two places):

| Pair | Ratio | Result |
|---|---|---|
| port label, summary line, palette hint, zoom level, help line: ink-soft on paper | 7.44 | pass |
| card title: green on ice | 6.74 | pass |
| setting label, wire handle ×: green on paper | 7.72 | pass |
| remove ×: ink-soft on ice | 6.49 | pass |
| summary line on a stale card: ink-soft on gold-soft | 6.63 | pass (was 2.23 at 50% opacity; the opacity is gone) |
| stale badge: amber-ink on gold-soft | 6.11 | pass |
| error line: danger on paper, and on a stale card's gold-soft | 6.69, 5.96 | pass |
| readout: ink on paper | 14.80 | pass |
| wire: green on the page | 7.24 | pass |
| stale wire: amber-ink dashed on the page | 6.42 | pass (was 1.35 in the line colour) |
| candidate port fill: teal on the page | 3.89 | pass for a control (3:1) |
| refused port fill: danger on the page | 6.27 | pass |
| focus ring: gold on the page, gold on paper | 2.08, 2.22 | the walkthrough's ring alone; on the canvas it now sits inside a green ring (7.24 on the page) |

**Done**
- `flow.css`: stale summaries use colour rather than opacity; stale wires are amber-ink dashed, matching the badge; focus on a card, a port, or a wire handle is a gold ring inside a green one, so it reads on the dotted page, on a card, and on a port.
- Toolbar regrouped so it never re-wraps: Run all and an "Export and load" menu (`<details>`: Copy flow summary, Copy graph as JSON, Download graph, Load graph; closes after a choice, on Escape with focus back on the button, and when focus leaves it) on the left; − 55% + Fit Inspector on the right. Beside an open inspector at 1400 px the toolbar is 58 px tall before and after, and the canvas does not move.
- Narrow screens (under 1100 px): the three columns stack, the palette and inspector each scroll inside about a third of the height, the palette becomes a row of compact buttons with its intro and hints hidden, and the canvas keeps at least 280 px.
- README: a Flow mode section (what it is for and what it is not; the canvas; a keyboard reference; the five exercises and what to notice in each; the export format with the notebook mapping and the open decision about the notebook; the flow summary; the `FLOW_` constants; where the copy lives; adding a kind of card), plus additions to the intro, contents, tests, folder layout, browser support, known limitations, and extension points.
- Suite: 124 passing. No console errors on either page.

**Verified in the browser (Chrome engine in the desktop app)**
- 1400 × 900: toolbar on one line; click a card, the inspector opens, the toolbar is still one line and the canvas top is unchanged; the export menu opens with its four items and Escape closes it with focus on the button.
- 900 × 700: columns stacked, the palette a row of buttons above the canvas, the canvas readable at the restored zoom, the readout and help under it, the footer below everything.
- The walkthrough page unchanged apart from the header switch and the notice fix.

**Not verified here, on the manual list with the Phase 6 items**
- Firefox and Safari. Flow mode adds pointer events with pointer capture, `elementFromPoint` during a drag, `<details>` as a menu, and `offsetLeft` for wire endpoints, all long supported; a pass through the five exercises in each is the remaining check.
- A real mouse wheel and Ctrl+wheel, the clipboard buttons, and the download and load dialogs, all of which the desktop app's automation cannot drive.
- A phone. The stacked layout was checked at 900 px; the README says Flow mode is meant for a laptop.

**Decisions made without asking**
- The toolbar's zoom buttons show − and + with the full names as accessible labels and tooltips, and the zoom level is a plain "55%" with the full sentence as its label. Words on all nine buttons did not fit beside an open inspector.
- The focus ring change applies to the canvas only. The walkthrough keeps its single gold ring, which Phase 6 accepted, and this phase did not touch it.
- A Compare card stays held back (decision 2), and the notebook question stays open (decision 3); both are stated in the README so a reader knows where the design stopped and why.

**Where this leaves the branch.** Phases 7 to 11 are on `flow-mode`, one commit per phase, with `main` untouched. Merging is Ward's call after a look at the live pages: `index.html` should feel exactly as before with one extra button in the header; `flow.html` is the new thing.

## Phase 10 — Flow mode teaching layer (done)

Five exercises, each a canvas with a Note on it saying what to do; the graph as JSON in and out; the Flow variant of the run summary.

**Done**
- `js/flow/exercises.js`: `EXERCISES`, five entries built with the same graph calls the canvas uses, so every wire in them is one the canvas would accept. Each adds a Note carrying its task from `copy.js` (`FLOW.exercises.items`). The palette lists them under "Exercises".
  1. **Build it.** Document (sample loaded) and Answer, nothing between. "Every wire the canvas refuses tells you what is still missing."
  2. **Something is missing.** The standard pipeline with the Chunk node removed. Wiring the Document into Embed is refused with "Embed works on chunks, not on the whole document…".
  3. **Starved retrieval.** TOP_K = 1 and the grounding probe. The one passage the model receives is about holidays and sick leave; nothing mentions parental leave.
  4. **Two boxes.** The Phase 9 side-by-side graph, pre-built: one Chunk and one Question feeding a Glass Box branch and a Black Box branch.
  5. **The lost sentence.** CHUNK_OVERLAP = 0 and CHUNK_SIZE = `FLOW_EXERCISE_OVERLAP_SIZE` (500), which cuts the handbook's vacation sentence inside the word: one chunk ends "…employee gets ten vacat", the next opens "ion days a year…" and goes on to the fifteen-day policy, so no chunk says what a newly hired employee gets. The question is "How many vacation days does a newly hired employee get?".
- `flowGraphSummary` in `js/flow/summary.js`: every node in execution order with what feeds it, its parameters, and what it produced; notes at the end without a number. Fixed format, pinned by a test.
- Toolbar: Copy flow summary, Copy graph as JSON, Download graph (`FLOW_EXPORT_FILENAME`), Load graph (a file picker; the sample document comes back by reference; every failure is one sentence from `FLOW.load`).
- Copy pass: every refusal, exercise task, and node hint reread against the explainer rules; the lost-sentence task reworded after the test showed "vacation days" survives in the second half through the fifteen-day policy.
- Layout: the three-column grid now has one row exactly as tall as the space under the header, so the palette (longer now) and the inspector scroll inside it instead of stretching the page under the footer. Canvas minimum height 280 px.
- Tests: `tests/flow/exercises.test.js` (every exercise has copy, builds, carries its task, round-trips; the shape and behaviour of each of the five), `tests/flow/flowSummary.test.js` (the pinned format on the canonical graph after a run, and on an unrun graph). Suite: 124 passing.

**Verified in the browser**
- Exercise 5 loads with CHUNK_SIZE 500 and CHUNK_OVERLAP 0 on the card, the note on the canvas, readout "Loaded exercise 5 · The lost sentence…". Run all: "14 chunks · 13 mid-sentence cuts", "Top 3 of 14: chunks 06, 05, 02".
- Exercise 4 loads with two Embed cards (one Black Box), two Retrieve cards, ten wires.
- Exercise 2 loads with no Chunk card. Click the Document output, click the Embed input: "Embed works on chunks, not on the whole document. Cut the text into pieces first, so each piece can get a vector of its own." No wire made.
- The toolbar shows the four new buttons; no console errors.

**Not verified here**
- Copying to the clipboard reported "Could not copy…" because the automated pane has no window focus, which the clipboard API requires. The same `copyText` serves the walkthrough's Copy prompt. Download and Load open native file dialogs the automation cannot drive; the load path is the tested `fromJSON` plus the sample fetch. All three are a quick manual check.

**Decisions made without asking**
- Exercise 2 is "no Chunk node" rather than the plan's "Embed wired straight from Document", which the graph refuses to build. The refusal is the exercise.
- Exercise 5 uses size 500 rather than a size that splits between "ten" and "vacation", because 500 splits the word itself and neither half can carry the sentence; the test pins both halves.
- Exercise tasks live on a Note node on the canvas rather than in a side panel, so the question sits next to the fault, and the note is exported with the graph.
- The README section for the export format waits for Phase 11 with the rest of the README.

**Seen, for Phase 11**
- With the inspector open the canvas is narrower and the toolbar (now nine buttons) wraps to a third line, so opening the inspector shifts the canvas down. Group the toolbar (run, export, view) so it never re-wraps.

**Next: Phase 11** — contrast and focus pass over every new element, the toolbar grouping above, narrow screens, README section for Flow mode (exercises, JSON export and its notebook mapping, keyboard reference, constants), Firefox and Safari check, final STATUS.

## Phase 9 — Flow mode inspectors, running, staleness (done)

Selecting a node now shows its artifact, drawn by the walkthrough's own station renderer. The Black Box download, its progress bar, and its fallback work on the canvas. The key field lives in the Answer node's inspector. The side-by-side lesson runs.

**Done**
- `js/flow/adapter.js` (pure): presents a node's upstream chain as the walkthrough's `app`. `chainFor` walks the primary inputs (Answer ← Assemble ← Retrieve ← Embed ← Chunk ← Document) and picks up the Question feeding the Retrieve. `artifactsFor` maps the chain's artifacts to `state.artifacts.{chunks, embeddings, retrieval, prompt, answer}`; each station is handed the chunk list its own artifact was built from, so a re-chunked upstream never leaves a station indexing chunks that no longer exist. `resolveStep` decides what a station's button means by "chunk", "embed", and so on: the node itself, else the nearest downstream node of that type (continue buttons), else the one upstream (stale notices). `createStationApp` wraps it all: live getters for `state`, `isStale` by artifact id, the run functions, `setQuestion`, `setInstruction`, `setEmbeddingMode`, `setDocument`, `buildRunSummary`, and `askModel`.
- `js/flow/inspector.js`: label, lane tag, hint, the walkthrough's explainer (collapsed), then the station. Document, Chunk, Embed, Retrieve, Assemble, and Answer use `js/stations/*.js` unchanged. Question and Note get small views of their own: the question with the sample dropdown and a line naming what it feeds; the note as a larger textarea.
- The inspector column is 460 px, can be hidden (Hide in its header, Inspector in the toolbar), and opens when a node is selected. Edits typed into the inspector update the node card without rebuilding the inspector, so the cursor stays put; edits typed into a card rebuild the inspector.
- `nodes.js`: `syncParams` pushes parameters into a card's controls when they change elsewhere (inspector, preset), skipping a control the student is typing in; the Black Box radio is disabled once the model has failed to load. The Retrieve summary line now names the chunks: "Top 3 of 20: chunks 08, 03, 13", so two Retrieve nodes can be compared on the canvas without opening either.
- `main.js`: the walkthrough's progress bar and notice area, driven by the same `CALLOUTS.modelDownload` and `STATION_EMBED.progressDownload` / `progressEmbedding` messages; the fallback when the model cannot load (one `console.warn`, every Black Box Embed node flipped to Glass Box, the `CALLOUTS.modelFailed` notice, then the run repeated); the key held in memory only, passed to the runner as context and never stored, exported, or logged.
- Registry: the Retrieve output now carries the embedding and projection it scored against, and the Assemble output the chunk list, so the inspector can draw the map and number the passages from the artifact alone.
- `styles.css`: `.notice[hidden] { display: none; }`. The notice's flex display had been overriding the `hidden` attribute, so an empty amber bar appeared whenever the progress bar did, in the walkthrough as well as here. One line, both pages.
- Canvas fixes found while verifying: wire endpoints are now computed from layout offsets rather than rendered geometry, so they are right while the world is mid-zoom; on a short wire the × handle sits below the midpoint instead of on top of a port; a new card from the palette steps down until it overlaps nothing.
- Tests: `tests/flow/adapter.test.js` (chain resolution, a shared Question feeding two branches, `resolveStep`, chunk-list mapping through a re-chunk, the station app's getters and setters, live instruction editing making the Answer stale, `askModel` with the page key and the code mapping Station 5 expects, mode switching). Suite: 116 passing.

**Verified in the browser (Chrome engine in the desktop app, 1400 × 900)**
- Click the Chunk card: the inspector shows the Chunk station with 20 cards, the summary "20 chunks · average 386 characters · 19 of 19 cuts fell mid-sentence", and the settings line.
- Click Retrieve after a run: the question box carries the Question node's text, the ranked table has 20 rows, the map has the question marker and three neighbour lines.
- Click Answer before a prompt exists: "Assemble a prompt first." After a run: provider dropdown, password-type key field with autocomplete off, the memory-only callout, "Ask the model". Pressing it with no key: "Paste a key first." and focus moves to the key field.
- Switch Embed to Black Box from the inspector's toggle with nothing embedded: the mode changes on the card and nothing runs, as in the walkthrough. Press "Embed all chunks": the progress bar reads "Downloading a 23 MB embedding model to your browser. This happens once. Downloading the model… 6%" through "Embedding chunk 20 of 20…", the card reads "20 vectors · 384 dimensions", the inspector "20 vectors · 384 dimensions from the neural model".
- Run all in Black Box: Retrieve reads "Top 3 of 20: chunks 08, 03, 13"; the table has chunk 08 at rank 1 with 0.55 and 03 at 0.48, the walkthrough's Phase 6 numbers.
- The side-by-side lesson: a second Embed (Glass Box) and second Retrieve added from the palette, wired to the same Chunk and Question by click-to-click. One Run all: the Black Box branch "Top 3 of 20: chunks 08, 03, 13", the Glass Box branch "Top 3 of 20: chunks 02, 03, 07", on one canvas from one question. The model was not downloaded again.
- Typing in the Assemble inspector's instruction updates the full prompt live, keeps the cursor, and updates the card's own textarea. (The Answer going stale from this is covered by the adapter test; in the browser the Answer had no artifact yet.)
- No console errors at any point; one Transformers.js warning about a missing content-length header during the download.

**Not verified here**
- The fallback path was not triggered: the model downloaded. The runner test covers the error code; the page-level flip to Glass Box, the notice, and the disabled radio follow the same steps the walkthrough verified in Phase 5 by pointing the CDN constant at a dead address. Worth one manual run the same way.
- The Document station's file upload inside the inspector was not exercised (the walkthrough's code, untouched).
- A live provider call was not made, as in Phase 5.

**Decisions made without asking**
- One inspector rather than two. The plan's exit check said "two inspectors open"; instead the Retrieve card's summary line names its top chunks, so the comparison is visible on the canvas itself, and the inspector shows whichever branch is selected.
- Assemble's instruction edits mirror the walkthrough's `rebuildPromptText`: the prompt text is rebuilt in the artifact without a run, the artifact's version is bumped so the Answer downstream goes stale. A run on every keystroke would have re-run stale ancestors too.
- The mode switch in the Embed station re-embeds at once when an embedding exists, as the walkthrough does, even though that can start a 23 MB download from a radio button. The card's own radio only marks the node stale; the student presses Run.
- Station continue buttons whose next step is not on the canvas read out "Nothing of that kind is wired after this step yet. Add a Retrieve node and wire it in." rather than being hidden, so the student learns what is missing.
- `.notice[hidden]` is a change to the shared stylesheet and so to the walkthrough. It removes an empty amber bar that appeared during every model download; it adds nothing.

**Next: Phase 10** — the teaching layer: five exercise presets (blank, wrong input, starved retrieval, two boxes, broken overlap) with their notes, export and load of graphs as JSON, the Flow variant of the run summary, and a copy pass over every refusal, exercise note, and node description.

## Phase 8 — Flow mode canvas (done)

Flow mode is now a page: `flow.html`, served beside `index.html`. Both pages carry a Walkthrough · Flow switch in the header; that switch and its styles are the only change to the walkthrough.

**Done**
- `flow.html` and `flow.css`: three columns (palette, canvas, inspector), the walkthrough's header and footer, the shared progress and notice area, a readout line under the canvas (`role="status"`, `aria-live="polite"`), and a one-line pointer-and-wheel help text. Below 1100 px the columns stack. The canvas is a dotted grid.
- `js/flow/canvas.js`: the hand-rolled surface. Nodes are `<article>` cards in an HTML layer positioned in world pixels; wires are cubic curves in one SVG layer underneath, recomputed from the ports' screen positions. Pan by dragging empty canvas or with the wheel; zoom with Ctrl+wheel around the cursor, with the toolbar buttons around the centre, and with Fit (never above 100%). Node drag by the title bar, snapped to the grid on release. Each wire has a small × handle at its midpoint.
  - Wiring by pointer: drag from an output port to an input port. While dragging, matching inputs glow teal and the hovered input turns teal (accepted) or red (refused). Dropping on a refused input prints the refusal sentence in the readout and flashes the port. A click on an output port (no drag) starts a click-to-click wire that ends on the next click anywhere.
  - Wiring by keyboard: Enter or Space on an output port starts a wire and moves focus to the first matching input; Tab reaches every input port; Enter on one wires it or reads out why not; Escape cancels and returns focus to the origin. Delete on a wired input, or Enter on a wire's handle, removes the wire.
  - Nodes: Tab reaches every card, port, control, and Run button in reading order. On a focused card, arrow keys move it one grid step, Shift+arrow five, Delete removes it and moves focus to a neighbour. Focus on a card selects it for the inspector.
  - The readout announces every action: node added or removed, wire made, refused, removed, or cancelled, a run starting and its result.
- `js/flow/nodes.js`: the node card. Title, lane tag (build time teal, run time amber, matching the stepper), a remove button, input ports on the left and output ports on the right with mono labels, inline parameters, then a footer with the summary line ("20 chunks · 19 mid-sentence cuts"), the gold stale badge, the error sentence, and Run. Inline parameters: Document has a textarea and the sample button; Chunk has CHUNK_SIZE and CHUNK_OVERLAP with the sidebar's refusal rules and messages; Embed has the Glass Box and Black Box radios; Question has a text box (Enter runs the node) and the sample-question dropdown; Retrieve has TOP_K; Assemble has the instruction; Answer has the provider; Note has a textarea. Chrome updates in place so an edit never loses the cursor.
- `js/flow/main.js`: the page. Palette (one button per registry entry, with its hint), Run all, zoom controls, the inspector placeholder (label and hint; the artifact view is Phase 9), the sample document fetched once and shared, and session persistence: the graph and the view survive a reload through the Phase 7 serializer. First visit loads the standard pipeline with the sample and the synonym probe and fits it to the screen.
- `graph.js` gained `canConnect`, the dry run the canvas uses to colour ports before a drop; `connect` is now `canConnect` plus the insert. The Answer node reports a missing key as `noKey`, explained with the walkthrough's "Paste a key first." rather than "The provider rejected that key."
- Constants: `FLOW_NODE_WIDTH`, `FLOW_COLUMN_GAP`, `FLOW_ROW_GAP`, `FLOW_CANVAS_PADDING`, `FLOW_GRID_STEP`, `FLOW_KEYBOARD_STEP_LARGE`, `FLOW_ZOOM_MIN`, `FLOW_ZOOM_MAX`, `FLOW_ZOOM_STEP`. The preset spacing reads them.
- Copy: `FLOW.page`, `palette`, `presets`, `toolbar`, `inspector`, `portLabels`, `params`, `node`, `summaries`, `readout`, plus `MODES` for the header switch. All still under the explainer rules (the Flow copy test walks every string).
- Suite: 108 passing; the pinned export fixture updated for the wider preset.

**Verified in the browser (Chrome engine in the desktop app, 1400 × 900)**
- First load: standard pipeline, fitted, readout "Loaded the standard pipeline.", no console errors. Reload restores the graph, positions, and zoom.
- Run all: Document "sample.txt · 1,105 words", Chunk "20 chunks · 19 mid-sentence cuts", Embed "20 vectors · 392 dimensions", Retrieve "Top 3 of 20 chunks", Assemble "1,467 characters · about 367 tokens", Answer "Paste a key first." Readout "6 ran, 0 already up to date, 0 waiting on another step, 1 failed."
- Removing the Embed → Retrieve wire by its handle greyed Retrieve as stale and moved focus to the freed input. Wiring it back by keyboard (Enter on Embed's output, focus landed on Retrieve's input, Enter) cleared the stale mark, because the artifact was made from that same input.
- Dragging Question's output onto Assemble's passages input: "This input needs retrieved passages, but the wire carries a question." No wire made. Dragging Retrieve's output onto it: "Wired Retrieve to Assemble."
- Click on an output port, click on an input: wired; click on empty canvas instead: "Wire cancelled."; Escape: cancelled with focus back on the origin.
- Add Note from the palette: the new card received focus; Delete removed it and focus moved to a neighbouring card. ArrowRight and Shift+ArrowDown moved the Chunk card by 20 and 100 pixels and the positions were in sessionStorage.
- Node drag by the title bar: snapped to the grid, wires followed, position saved.
- The walkthrough still loads with no console errors and shows the mode switch.

**Not verified here**
- Wheel panning and Ctrl+wheel zoom respond to a synthetic wheel event; the desktop app's automated scroll did not reach the page, so a real mouse wheel is a manual check.
- Tab traversal between input ports during a keyboard wire was checked by focusing the ports directly, not by pressing Tab through the whole canvas.
- The stacked layout under 1100 px was seen once at 800 px wide and works, but has not been used in earnest. Phase 11.
- Black Box on the canvas: the radio is wired and progress prints to the readout, but no model was downloaded in this session. Phase 9 owns the progress bar and the fallback.

**Decisions made without asking**
- During a keyboard wire, Tab reaches every input port, not only the matching ones as the plan said. Matching ports are highlighted; Enter on a wrong one reads the refusal sentence. Restricting Tab would have hidden the refusals from keyboard users, and the refusals are the lesson.
- Session persistence came forward from Phase 9 because the serializer made it a few lines and it makes the page far less annoying to review.
- Run buttons and Run all exist now rather than in Phase 9, so the exit check could be met; Phase 9 still owns the progress bar, the Black Box fallback, and the key field.
- Two timing calls use `setTimeout` rather than `requestAnimationFrame`: the initial fit (the canvas has no size before first layout) and the readout (cleared then set, so the same sentence twice is announced twice). Animation frames do not fire while the desktop app's browser drives the page, and nothing here needs frame timing.
- A click-started wire is ended by the next pointer click, not by focus leaving the canvas; only a keyboard wire ends on focus loss. Clicking an input port completes the wire; clicking anywhere else on a card cancels it.
- Fit caps at 100% and can go down to 40%. On a 860 px canvas the standard pipeline fits at 42%, which is an overview, not a reading size; students zoom in. On a full-width monitor it fits at about 75%.

**Next: Phase 9** — inspectors: the station renderers behind an adapter so a selected node shows its artifact; the global progress bar and the Black Box fallback on the canvas; the key field for Answer; stale greying of dependent wires and cards on every change; the side-by-side Glass Box and Black Box lesson as the exit check.

## Phase 7 — Flow mode graph core (done)

Everything in this phase is pure and lives in `js/flow/`. No page uses it yet; `flow.html` arrives in Phase 8. The walkthrough is untouched apart from two appended blocks (`FLOW` in `copy.js`, three `FLOW_` constants in `constants.js`).

**Done**
- `js/flow/registry.js`: the node table as data. Eight node types (Document, Chunk, Embed, Question, Retrieve, Assemble, Answer, Note), seven port types, parameter defaults taken from `constants.js`, and one `run` per node that calls the same compute module the walkthrough calls. The file's header documents what travels down each kind of wire. Black Box goes through `context.blackBox` (a `{ load, embed }` pair defaulting to the real Transformers.js loader) so tests can stand in a fake model; the real loader is already a module-level singleton, so two Embed nodes share one download. The Answer node reads the key from `context.apiKey`, never from a parameter, so a key can never be exported or saved.
- `js/flow/graph.js`: `createGraph`, `addNode`, `removeNode`, `connect`, `disconnect`, `setParam`, `moveNode`, plus `order` (Kahn's algorithm, insertion order breaks ties), `dependents`, `ancestors`, `missingInputs`, `isStale`, and `blocker`. `connect` refuses with a code: `UNKNOWN_NODE`, `UNKNOWN_PORT`, `SELF_LOOP`, `TYPE_MISMATCH` (with `needs` and `got`), `INPUT_TAKEN`, `CYCLE`. An artifact records the parameter values and the upstream artifact versions it was made from, so staleness is computed by comparison, as in the walkthrough, and setting a dial back to its old value clears the mark.
- `js/flow/runner.js`: `runGraph` runs whatever is missing or stale, in order, and `runNode` runs a node's stale ancestors and then the node itself. A failure clears the node's artifact, stores `{ code, message }` on the node, and blocks everything downstream with `upstreamMissing`. The report says what happened to every node: `ran`, `fresh`, `skipped` (with the reason), `failed` (with the code).
- `js/flow/serialize.js`: `toJSON` / `fromJSON`. The export has a `pipeline` array in execution order with the notebook's names (`CHUNK_SIZE`, `CHUNK_OVERLAP`, `TOP_K`), inputs given as the source node's id, and a `layout` block the notebook ignores. The sample document is exported by reference (`sample: true`), a pasted one with its text. Artifacts are never exported. Loading refuses with `BAD_FORMAT`, `BAD_VERSION`, `BAD_NODE`, or `BAD_EDGE`.
- `js/flow/explain.js`: the only Flow module that reads copy. Turns refusal, skip, error, and load codes into sentences. Codes the walkthrough already explains (`OVERLAP_TOO_LARGE`, the Black Box failure, the eight provider errors) reuse its exact wording.
- `js/flow/summary.js`: `flowRunSummary` walks upstream from an Assemble node and prints the walkthrough's run summary, character for character.
- `js/flow/presets.js`: `canonicalGraph`, the six-node chain plus Question. The exercises are added here in Phase 10.
- `copy.js`: `FLOW` block with port names, node labels and hints, four refusal sentences, eight taught pairs (Embed fed the document, Retrieve fed chunks, Assemble fed vectors, and so on), skip reasons, node error messages, and load errors. All under the explainer rules, checked by `tests/flow/explain.test.js`.
- `tools/flow-run.mjs`: the exit check. Builds the canonical graph (or loads an exported one), runs it, prints the run summary and the export.
- Tests: `tests/flow/graph.test.js` (every refusal code, cycle guard on a hand-edited graph, ordering, removal, staleness through a diamond, the blocker reasons), `runner.test.js` (the canonical graph reproduces the walkthrough's ranking, prompt, and run summary exactly; a second run re-runs nothing; a dial change re-runs only its dependents; `runNode` re-runs stale ancestors; a failure blocks downstream; two Embed nodes on one chunking give two rankings for one Question; a Black Box load failure lands on the Embed node; the Answer node's key stays out of the artifact), `serialize.test.js` (pinned export fixture, round trip, a loaded graph runs, every load error), `explain.test.js` (copy rules over every Flow string, every code has a sentence). Suite: 108 passing, up from 75.

**Verified**
- `node tools/flow-run.mjs` on the sample with the synonym probe: 20 chunks, 19 mid-sentence cuts, 392 dims, top 3 are chunks 02, 03, 07, the vacation chunk absent, prompt 1,467 characters. Same numbers as the walkthrough at the defaults.
- The exported JSON fed back through the same script prints the same summary.
- The walkthrough at `index.html` still loads with no console errors.

**Decisions made without asking**
- Assemble has its own `question` input rather than reading the question off the passages. That is the real architecture (the question goes to the retriever and into the prompt), and it makes a teachable mismatch possible: passages retrieved for one question, a prompt built around another.
- The `vectors` payload carries the chunk list along with the embedding, so Retrieve can hand Assemble passage text without a third input port.
- Node ids are `type-N` and wire ids `edge-N` from one counter, so an exported graph reads as `chunk-2`, not as a hash. A loaded graph keeps minting above every id it contains.
- A node with an artifact whose input wire has been removed counts as stale, not as "not run", so the canvas can grey it rather than showing an artifact it could no longer make.
- Every taught refusal is keyed by what the wire carries and what the input needs, not by node names, so a future node type gets the right sentence for free.

**Not done here**
- The Black Box branch was exercised only through the fake in the runner tests. `tools/flow-run.mjs` on a Black Box graph needs Transformers.js installed as `tools/probe.mjs` does; that check is on the list for Phase 9, when the browser path exists.

**Next: Phase 8** — `flow.html`, the hand-rolled canvas (HTML nodes over an SVG edge layer), pointer and keyboard wiring, port highlighting with refusal sentences in a readout line, node chrome with lane tags and stale badges, `FLOW_` layout constants.

## Phase 6 — Polish, README, AWS hosting kit (done)

**Done**
- **Contrast pass.** Measured every text/background pair in the palette. Four failed 4.5:1: teal and amber small text on their soft backgrounds and on white, and the white labels on teal map points. Added `--teal-ink` (#0F5C5C) and `--amber-ink` (#8A4A0B) for small text and darkened the map point fill; all pairs now pass (lowest 5.6:1). Gold is still only a background or border.
- **Motion.** `prefers-reduced-motion` turns off the progress-bar animation and the map hover transition.
- **Keyboard.** Checked the focus order from a fresh load: skip link, stepper, dials (slider then number for each), explainer summary, textarea, upload, sample, continue. Map points are buttons; the details panels are native. Nothing traps focus.
- **Page head.** Added a description, `color-scheme`, and an inline SVG favicon (green square, gold R) so the tab has an icon and the console has no 404.
- **README** rewritten in full: five-minute walkthrough; hosting on GitHub Pages, on AWS (S3 + CloudFront) with the scripts, automatic deploys, any static host, and the exact external addresses the browser must reach; a table of every constant; how to swap the sample document and re-run the probe; where the copy lives and the rules the tests enforce; how keys are handled in the answer step and why a shared key is impossible in a static page; the run summary; tests; folder layout; browser support; known limitations; extension points.
- **AWS hosting kit** in `deploy/aws/`: `template.yaml` (CloudFormation: private encrypted versioned S3 bucket, CloudFront with Origin Access Control, HTTPS redirect, compression, `index.html` default root, bucket policy scoped to that distribution, commented custom-domain block, outputs for bucket, distribution id, and URL), `deploy.sh` and `deploy.ps1` (create/update the stack, sync only the files the page needs, force `text/javascript` on modules, invalidate the cache, print the URL). `.github/workflows/deploy-aws.yml` is an optional push-to-deploy workflow using OIDC, switched off until the secrets exist.
- Test suite: 75 passing. No console errors on load.

**Not done here, by necessity**
- Firefox and Safari were not run: only the Chrome engine is available in this environment. The README lists the features relied on (`:has()`, dynamic `import()`, clipboard API with fallback) and their minimum versions; a quick pass through the five stations in Firefox and Safari is the remaining manual check.
- The AWS scripts were not executed against an account. They use only standard AWS CLI v2 commands and a plain CloudFormation template; the first real run will tell you whether the department's permissions allow CloudFront creation.
- The answer step was not exercised with a live key.

**Decision closed after review:** Ward approved rewording the synonym probe to "How many days of PTO do new employees get?". Measured at the defaults with the brief's model: Glass Box rank 6 (score 0.03, well outside the top 3), Black Box rank 1 (0.555, +0.086 over the orientation chunk). Verified with `tools/probe.mjs` and in the browser (0.55 vs 0.48). The Colab notebook should use the same question so the two layers match.

## Phase 5 — Black Box mode and the optional answer step (done, reviewed)

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
