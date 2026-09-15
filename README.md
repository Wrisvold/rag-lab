# RAG Lab

A browser-based teaching simulator of the retrieval-augmented generation (RAG) pipeline for CBIS 5530, Introduction to RAG, at Georgia College & State University.

Students paste or upload a document and watch it move through chunking, embedding, retrieval, and prompt assembly, with every intermediate artifact visible and three dials to turn: `CHUNK_SIZE`, `CHUNK_OVERLAP`, `TOP_K`. It runs entirely in the browser with no account or API key.

**Status:** Phase 4 (prompt assembly and export). See [STATUS.md](STATUS.md).

## Run it locally

Any static file server works. With Node installed, the folder includes a tiny one:

```bash
node serve.js
```

Then open http://localhost:5173. Opening `index.html` directly from the file system will not work because the app uses ES modules.

Uploading a `.docx` file fetches the mammoth library from jsdelivr the first time, so that path needs internet access. Everything else works offline once the page has loaded.

## Run the tests

```bash
npm test
```

## Layout

```
index.html      page shell
styles.css      palette and layout
js/constants.js every default and range, each with a comment
js/copy.js      every sentence a student reads
js/main.js      state, stepper, dials, and routing to the stations
js/stations/    one file per station (the DOM for each step)
js/chunker.js   pure module: fixed-size chunking with overlap
js/tokenizer.js pure module: text -> words (Glass Box)
js/tfidf.js     pure module: TF-IDF vectors and top terms
js/cosine.js    pure module: cosine similarity, unit vectors
js/pca.js       pure module: PCA for the 2D map
js/glassBox.js  the Glass Box embedding mode (ties the four above together)
js/retrieval.js pure module: rank every chunk, cut at TOP_K
js/prompt.js    pure module: the three-block prompt and a token estimate
js/summary.js   pure module: the "Copy run summary" text
js/clipboard.js copy to clipboard with a fallback
js/map.js       the SVG scatter plot
js/fileReader.js  .txt/.md/.docx reading (mammoth loaded on demand)
js/session.js   keeps the document and dials across a reload
js/dom.js, js/text.js  small helpers
serve.js        optional local server: node serve.js
data/sample.txt the built-in sample document
tests/          node --test files, one per pure module
```

The full README (hosting, changing defaults, swapping the sample document, editing copy, known limitations) is written in Phase 6.
