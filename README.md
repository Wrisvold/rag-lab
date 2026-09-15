# RAG Lab

A browser-based teaching simulator of the retrieval-augmented generation (RAG) pipeline for CBIS 5530, Introduction to RAG, at Georgia College & State University.

Students paste or upload a document and watch it move through chunking, embedding, retrieval, and prompt assembly, with every intermediate artifact visible and three dials to turn: `CHUNK_SIZE`, `CHUNK_OVERLAP`, `TOP_K`. It runs entirely in the browser with no account or API key.

**Status:** Phase 0 (scaffold and sample corpus). See [STATUS.md](STATUS.md).

## Run it locally

Any static file server works. With Node installed:

```bash
npx serve .
```

Then open the address it prints. Opening `index.html` directly from the file system will not work because the app uses ES modules.

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
js/main.js      wires the page together
js/*.js         pure modules (chunker, tokenizer, tfidf, cosine, pca, prompt, summary) arrive in later phases
data/sample.txt the built-in sample document
tests/          node --test files, one per pure module
```

The full README (hosting, changing defaults, swapping the sample document, editing copy, known limitations) is written in Phase 6.
