# RAG Lab

A browser-based teaching simulator of the retrieval-augmented generation (RAG) pipeline, built for **CBIS 5530 · Introduction to RAG**, MS in AI Strategy, Georgia College & State University.

A student pastes or uploads a document and watches it move through the four stages of a RAG pipeline, with every intermediate artifact on screen:

| Station | Artifact | When it runs |
|---|---|---|
| 0 · Document | the raw text | once |
| 1 · Chunk | **the chunks** | build time (once per document) |
| 2 · Embed | **an embedding** (one chunk as a vector) | build time |
| 3 · Retrieve | **the retrieved passages** | run time (every question) |
| 4 · Assemble | **the assembled prompt** | run time |
| 5 · Answer (optional) | a model's reply, judged against the passages | run time |

Three dials in the sidebar match the course notebook exactly: `CHUNK_SIZE`, `CHUNK_OVERLAP`, `TOP_K`. Change one, and every step after it greys out until it is re-run.

Two embedding modes sit behind a toggle on Station 2, and the toggle is the argument of the course:

- **Glass Box** (TF-IDF, plain JavaScript): every dimension of a vector is a word the student can read. It fails on synonyms, and that failure is the lesson.
- **Black Box** (`Xenova/all-MiniLM-L6-v2`, run in the browser with Transformers.js): 384 numbers nobody can read, but it matches "PTO" to "vacation".

The app runs entirely in the browser. No account, no API key, no payment, no server, no build step. It is one folder of plain HTML, CSS, and JavaScript.

---

## Contents

1. [Try it in five minutes](#try-it-in-five-minutes)
2. [Hosting](#hosting)
   - [GitHub Pages](#github-pages)
   - [AWS: S3 and CloudFront](#aws-s3-and-cloudfront)
   - [AWS: automatic deploys from GitHub](#aws-automatic-deploys-from-github)
   - [Any other static host](#any-other-static-host)
   - [What the browser needs to reach](#what-the-browser-needs-to-reach)
3. [Changing the defaults](#changing-the-defaults)
4. [Swapping the sample document](#swapping-the-sample-document)
5. [Editing the explainer copy and other text](#editing-the-explainer-copy-and-other-text)
6. [The optional answer step and API keys](#the-optional-answer-step-and-api-keys)
7. [The run summary for assignments](#the-run-summary-for-assignments)
8. [Tests](#tests)
9. [Folder layout](#folder-layout)
10. [Browser support](#browser-support)
11. [Known limitations](#known-limitations)
12. [Extension points](#extension-points)

---

## Try it in five minutes

You need Node.js (any recent version) only to serve the files locally. The app itself does not use Node.

```bash
node serve.js
```

Open http://localhost:5173. Then:

1. Station 0: click **Load the sample document**.
2. Click **Chunk this document**. Scroll the cards; every red ✂ is a mid-sentence cut.
3. Click **Embed these chunks**. Click any point on the map to read its vector.
4. Click **Retrieve passages**. The synonym probe question is already filled in. Press **Retrieve**. In Glass Box the vacation chunk is not in the top 3; "pto" is struck through as a word the document never uses.
5. Back on Station 2, switch to **Black Box**. A 23 MB model downloads once. Retrieve again: the vacation chunk is now rank 1.
6. Click **Assemble the prompt**, then **Copy prompt**, and paste it into any chatbot.

Opening `index.html` straight from a folder does **not** work: browsers refuse to load ES modules from `file://` addresses. Use `node serve.js`, any static file server, or one of the hosts below.

---

## Hosting

RAG Lab is a folder of static files. Anything that can serve a folder over HTTPS can host it. There is nothing to build and nothing to run on the server.

### GitHub Pages

The repository is already laid out for it: `index.html` is at the root and a `.nojekyll` file is present.

1. On GitHub open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to "Deploy from a branch", pick branch `main` and folder `/ (root)`, and save.
3. After a minute the page reports the address, normally `https://wrisvold.github.io/rag-lab/`.

Every push to `main` republishes automatically. Students need nothing but the link.

### AWS: S3 and CloudFront

The `deploy/aws/` folder contains everything needed to host RAG Lab in the department's AWS account: a private S3 bucket that only CloudFront can read, served over HTTPS with `index.html` as the default page. Total cost for a class is cents per month.

**Prerequisites (once):**

- The [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) installed and signed in (`aws configure`, or `aws sso login` if the department uses IAM Identity Center). The identity must be allowed to create S3 buckets, CloudFront distributions, and CloudFormation stacks. A department administrator can do this once; later uploads need only write access to the bucket.
- A globally unique bucket name, lowercase, for example `gcsu-cbis5530-rag-lab`.

**Deploy (and redeploy after every change):**

On macOS or Linux:

```bash
./deploy/aws/deploy.sh gcsu-cbis5530-rag-lab us-east-1
```

On Windows PowerShell:

```powershell
.\deploy\aws\deploy.ps1 -BucketName gcsu-cbis5530-rag-lab -Region us-east-1
```

The script does four things and prints the address at the end:

1. Creates or updates a CloudFormation stack named `rag-lab` from `deploy/aws/template.yaml`. The template creates the bucket (public access blocked, encrypted, versioned), a CloudFront distribution with Origin Access Control, and the bucket policy that lets only that distribution read the files.
2. Uploads just the files the page needs: `index.html`, `styles.css`, `js/`, `data/`. Tests, tools, and git metadata stay out.
3. Sets `Content-Type: text/javascript` on every module. Browsers refuse ES modules served with the wrong type, and S3 sometimes guesses.
4. Creates a CloudFront invalidation so the new files show up within a couple of minutes.

The first run takes about ten minutes because CloudFront distributions are slow to create. Later runs take under a minute.

**Custom domain (optional).** To serve the lab at something like `raglab.gcsu.edu`: request an ACM certificate for that name **in us-east-1** (CloudFront only reads certificates from that region), validate it by DNS, then edit the `ViewerCertificate` block in `deploy/aws/template.yaml` as the comment there shows, add the name under `Aliases`, redeploy, and ask whoever manages GCSU DNS to add a CNAME from `raglab.gcsu.edu` to the distribution's domain name (the `SiteUrl` output without `https://`).

**Removing it.** `aws cloudformation delete-stack --stack-name rag-lab` removes the distribution and the bucket policy. Empty the bucket first (`aws s3 rm s3://BUCKET --recursive`), because CloudFormation will not delete a bucket that still has objects.

**Alternatives on AWS.** [AWS Amplify Hosting](https://aws.amazon.com/amplify/hosting/) can connect straight to the GitHub repository and publish on every push with no scripts; choose "Deploy without a build" and the root folder. Plain "S3 static website hosting" also works but serves over HTTP only, so prefer the CloudFront setup above.

### AWS: automatic deploys from GitHub

`.github/workflows/deploy-aws.yml` is a GitHub Actions workflow that runs the tests and then uploads to S3 and refreshes CloudFront on every push to `main`. It is switched off until the one-time setup in its header comment is done (an IAM role that trusts the repository via OpenID Connect, and four repository secrets). No AWS access keys are stored anywhere.

### Any other static host

Copy the folder. That is the whole procedure. The only requirements are:

- `index.html` is served at the folder root (any path is fine: the page uses relative addresses).
- `.js` files are served as `text/javascript` or `application/javascript` (every common host does this).
- HTTPS. Not required by the app, but the clipboard and the answer step behave better on secure pages, and campus networks increasingly block plain HTTP.

### What the browser needs to reach

Nothing on the server side calls out. The **student's browser** does, and campus firewalls occasionally block these:

| Feature | Address | If blocked |
|---|---|---|
| Uploading a `.docx` | `cdn.jsdelivr.net` (mammoth library, once) | upload `.txt` or `.md` instead |
| Black Box mode | `cdn.jsdelivr.net` (Transformers.js) and `huggingface.co` (the 23 MB model, once per browser) | the app shows a plain notice and continues in Glass Box |
| Optional answer step | `generativelanguage.googleapis.com`, `api.openai.com`, or `api.anthropic.com` | the step reports that the request never reached the provider |

Glass Box mode, the sample document, chunking, retrieval, and prompt assembly work with no network at all once the page has loaded.

---

## Changing the defaults

Every number the app uses is in `js/constants.js`, each on its own line with a plain-language comment above it. Edit the value, save, reload. There is no build step.

| Constant | Default | What it is |
|---|---|---|
| `CHUNK_SIZE_DEFAULT`, `_MIN`, `_MAX` | 400, 100, 1200 | characters per chunk and the range the dial allows |
| `CHUNK_OVERLAP_DEFAULT`, `_MIN`, `_MAX` | 50, 0, 300 | characters repeated from the previous chunk (must stay below chunk size) |
| `TOP_K_DEFAULT`, `_MIN`, `_MAX` | 3, 1, 8 | passages handed to the model |
| `SENTENCE_END_CHARS` | `. ! ?` and newline | what counts as the end of a sentence for the mid-sentence check |
| `STOPWORDS`, `MIN_TOKEN_LENGTH` | small list, 2 | words Glass Box drops before counting |
| `GLASS_BOX_TOP_TERMS` | 12 | bars shown in the Glass Box inspector |
| `BLACK_BOX_MODEL`, `BLACK_BOX_DIMENSIONS` | `Xenova/all-MiniLM-L6-v2`, 384 | the neural model and its vector size |
| `TRANSFORMERS_JS_URL`, `MAMMOTH_URL` | pinned jsdelivr addresses | the two external libraries |
| `DEFAULT_INSTRUCTION` | the course wording | block 1 of the assembled prompt |
| `CHARS_PER_TOKEN_ESTIMATE` | 4 | used for the "about N tokens" line |
| `ANSWER_PROVIDERS` | Gemini, OpenAI, Anthropic | the model name for each provider is one line each |
| `ANSWER_MAX_OUTPUT_TOKENS` | 1024 | longest reply the answer step accepts |

If a provider retires a model, the answer step reports "The provider rejected the request. The model name in js/constants.js may be out of date." Change the `model` line for that provider.

---

## Swapping the sample document

The built-in document is `data/sample.txt`, a fictional employee handbook for "Fall Line Supply Company" of Milledgeville, Georgia. To replace it, put your text in that file (plain text, UTF-8) and update `SAMPLE_DOCUMENT_NAME` in `js/constants.js` if you want a different name in the run summary.

The sample questions live in `js/copy.js` under `SAMPLE_QUESTIONS`. Each has a label, the question text, and a one-sentence teaching note that appears under the question box.

**The synonym probe is fragile, on purpose.** The course's centrepiece demonstration is that "How much PTO do new employees get?" fails in Glass Box (the vacation chunk is outside the top 3) and succeeds in Black Box (rank 1). That depends on the exact wording of the handbook:

- The handbook says "vacation" and never "PTO" or "paid time off", so Glass Box has nothing to match.
- The vacation allowance is worded as "A newly hired employee gets ten vacation days a year". To TF-IDF, *employee*, *gets*, and *newly* are different words from the question's *employees*, *get*, and *new*, so that chunk scores zero; the neural model reads them as the same meaning.
- Vacation is the first policy in Section 3 so that, at the default dials, it starts a chunk rather than sharing one with the holiday policy.
- Three other policies were worded to avoid sounding like "what new employees get per year".

The Black Box side holds by a small margin with this model. **After any edit to the handbook, the sample questions, the model, or the default dials, run the probe:**

```bash
npm install --no-save @xenova/transformers@2.17.2
```

```bash
node tools/probe.mjs
```

It prints the vacation chunk's rank in both modes for each sample question and ends with PASS or FAIL. The first command is a one-time, dev-only download of about 100 MB; it is not part of the app and `node_modules/` is ignored by git. The Glass Box side is also checked by `npm test`.

Two measured alternatives, should you want a safer margin: the question "How many days of PTO do new employees get?" scores about four times further ahead with the same text and model, and "How many days off do new hires get each year?" further still. Either is one string in `js/copy.js`.

---

## Editing the explainer copy and other text

Every sentence a student reads is in `js/copy.js`, grouped by station. Nothing user-facing is typed inside the DOM code. Edit the text between the quotes and reload.

Two rules are enforced by `npm test` on the explainer paragraphs (`EXPLAINERS`): each paragraph is under 70 words, and none uses the words leverage, seamless, robust, delve, or powerful. The banned list and the limit are in `js/constants.js`.

The gold callouts (privacy, "paste it into an LLM", model download, model failed, key handling) are in `CALLOUTS`. The dial messages, including the one that refuses an overlap larger than the chunk size, are in `DIALS`.

---

## The optional answer step and API keys

Station 5 sends the assembled prompt to a language model of the student's choice and shows the reply beside the passages it was given, followed by a three-question checklist ("Did the answer stay inside the passages?").

**How keys are handled.** The student pastes their own key into a password-type field. It is held in JavaScript memory only: never written to localStorage or sessionStorage, never put in a URL, never logged, never included in the run summary, and forgotten when the tab closes or the "Forget key" button is pressed. It travels in a request header straight from the student's browser to the provider they chose. There is no server in between, so nothing at GCSU ever sees it. A test in `tests/answer.test.js` asserts that no provider request carries the key in its address or body.

**What the app cannot do** is hold one shared class key. A static page has no secrets: anything in it is readable by anyone who opens the browser's developer tools. If you ever want students to skip creating keys, that needs a tiny server (an AWS Lambda function URL or a Cloudflare Worker) holding the key behind a class password. That is deliberately not part of this app.

**Providers.**

| Provider | Free tier | Key page | Model (in `constants.js`) |
|---|---|---|---|
| Google Gemini | yes | https://aistudio.google.com/apikey | `gemini-2.5-flash` |
| OpenAI | no, prepaid credit | https://platform.openai.com/api-keys | `gpt-5-mini` |
| Anthropic Claude | no, prepaid credit | https://console.anthropic.com/settings/keys | `claude-opus-5` |

A run this size (roughly 400 tokens in, 150 out) costs well under a cent on the paid providers. Tell students to create a key just for the class and delete it afterwards; the page says so too.

The Anthropic request includes the header `anthropic-dangerous-direct-browser-access: true`. Anthropic requires it for calls made from a web page; the name is a warning against shipping a shared key inside a page, which is exactly what this app does not do.

---

## The run summary for assignments

Station 4 has a **Copy run summary** button that produces a plain-text block like this:

```
RAG Lab run — 2026-09-15 14:02
Document: sample.txt (1,105 words)
CHUNK_SIZE=400  CHUNK_OVERLAP=50  → 20 chunks, 19 mid-sentence cuts
Mode: Glass Box (TF-IDF, 392 dims)
Question: How much PTO do new employees get?
TOP_K=3
  1. chunk 02  score 0.21
  2. chunk 03  score 0.16
  3. chunk 07  score 0.11
Prompt length: 1,483 chars
```

Chunk numbers are the same 1-based, zero-padded numbers shown on the cards. (The Colab notebook's Python lists start at 0; tell students the lab counts from 1.) An assignment can say "run RAG Lab with CHUNK_SIZE=200 and paste your summary" and be graded from text.

---

## Tests

```bash
npm test
```

runs `node --test` over `tests/`: one file per pure module (chunker, tokenizer, TF-IDF, cosine, PCA, Glass Box, retrieval, prompt, summary, answer request shapes, Black Box progress) plus the copy rules and the Glass Box half of the synonym probe on the real sample document. No packages are installed for the tests.

---

## Folder layout

```
index.html          page shell (header, stepper, sidebar, station panel, global progress/notice)
styles.css          GCSU Evergreen palette as CSS variables, layout, every component
serve.js            optional local server: node serve.js
data/sample.txt     the built-in sample document
js/constants.js     every default and range, each with a comment
js/copy.js          every sentence a student reads
js/main.js          state, stepper, dials, staleness rules, routing to stations
js/stations/        one file per station: document, chunk, embed, retrieve, assemble, answer
js/chunker.js       pure: fixed-size chunking with overlap and mid-sentence flags
js/tokenizer.js     pure: text to words for Glass Box
js/tfidf.js         pure: vocabulary, IDF, vectors, top terms
js/cosine.js        pure: cosine similarity, unit vectors
js/pca.js           pure: PCA for the 2D map
js/retrieval.js     pure: rank every chunk, cut at TOP_K
js/prompt.js        pure: the three-block prompt and a token estimate
js/summary.js       pure: the run-summary text
js/glassBox.js      the Glass Box embedding mode
js/blackBox.js      the Black Box embedding mode (Transformers.js, loaded on demand)
js/answer.js        the answer step's request shapes and the one fetch call
js/map.js           the SVG scatter plot
js/fileReader.js    .txt/.md/.docx reading (mammoth loaded on demand)
js/session.js       keeps the document, dials, question, and instruction across a reload
js/clipboard.js     copy to clipboard with a fallback
js/dom.js, js/text.js   small helpers
tests/              node --test files
tools/probe.mjs     re-checks the synonym probe with the real model
deploy/aws/         CloudFormation template and deploy scripts for S3 + CloudFront
.github/workflows/  optional automatic AWS deploy (off until configured)
STATUS.md           what was built in each phase and every decision made along the way
```

---

## Browser support

Built and checked on the Chrome engine (Chrome and Edge). The code uses only features that current Firefox and Safari also support: ES modules, dynamic `import()`, `async`/`await`, typed arrays, SVG, the `:has()` selector (Firefox 121+, Safari 15.4+), and the clipboard API with an older fallback. Phones are out of scope; tablets and small laptop windows stack the sidebar above the station.

Keyboard: every control is reachable with Tab, the map points are buttons (Enter or Space selects one), and a skip link at the top jumps to the current station. Progress and status changes are announced to screen readers through live regions. All text colours meet the 4.5:1 contrast ratio on their backgrounds; gold is used only as a background or border, never as small text.

---

## Known limitations

- **The synonym probe is marginal.** See [Swapping the sample document](#swapping-the-sample-document). The 23 MB model barely knows the word "PTO"; the demonstration works because of careful wording and is verified by `tools/probe.mjs`, not guaranteed for other texts.
- **Fixed-size chunking only.** Sentence and paragraph chunking are deliberately absent so that the failures students diagnose are the fixed-size ones. `js/chunker.js` marks where another strategy would attach.
- **One document at a time.** Loading another document replaces the first.
- **No PDF upload.** Save as `.docx` or `.txt`. Scanned PDFs would need OCR anyway.
- **Black Box mode needs the network** for its first use in each browser, then the model is cached by the browser. Very old browsers without WebAssembly cannot run it; the app falls back to Glass Box.
- **Large documents slow the map.** PCA is a plain implementation; a few hundred chunks are fine, thousands are not. Tens of pages of text is a sensible upper limit for a lesson.
- **The token estimate is a rule of thumb** (four characters per token). Real tokenizers differ by model.
- **The answer step depends on three companies' APIs.** Model names go stale; each is one line in `js/constants.js`.
- **Nothing is saved between sessions.** The document, dials, question, and instruction survive a reload within a tab, nothing more. That is intentional: there are no accounts and no tracking.

---

## Extension points

Each is marked with a comment in the code where it would attach.

- `js/chunker.js`: a sentence- or paragraph-based chunker returning the same `{ chunks, summary }` shape.
- `js/fileReader.js`: PDF text extraction (would need a PDF library from the CDN).
- `js/main.js`, the `STATION_RENDERERS` table and the artifact list: multiple documents, or a document library.
- `js/answer.js`: a fourth provider, or a departmental proxy so students never handle keys.

---

*RAG Lab was built for Ward Risvold's CBIS 5530 with Claude Code, September 2026. The sample handbook, company, and people in it are fictional.*
