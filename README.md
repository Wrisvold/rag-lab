# RAG Lab

A browser-based teaching simulator of the retrieval-augmented generation (RAG) pipeline, built for **CBIS 5530 · Introduction to RAG**, MS in AI Strategy, Georgia College & State University.

**Live site:** https://wrisvold.github.io/rag-lab/

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

A second page, **Flow mode** (`flow.html`, the "Flow" button in the header), turns the same pipeline into a canvas: the student places the steps as cards, wires them together, and reads why a wrong wire is refused. It comes with five exercises. See [Flow mode](#flow-mode).

---

## Contents

1. [Try it in five minutes](#try-it-in-five-minutes)
2. [Hosting](#hosting)
   - [GitHub Pages](#github-pages)
   - [AWS: S3 and CloudFront](#aws-s3-and-cloudfront)
   - [For IT: moving RAG Lab into the department's AWS space, step by step](#for-it-moving-rag-lab-into-the-departments-aws-space-step-by-step)
   - [AWS: automatic deploys from GitHub](#aws-automatic-deploys-from-github)
   - [Any other static host](#any-other-static-host)
   - [What the browser needs to reach](#what-the-browser-needs-to-reach)
3. [Changing the defaults](#changing-the-defaults)
4. [Swapping the sample document](#swapping-the-sample-document)
5. [Editing the explainer copy and other text](#editing-the-explainer-copy-and-other-text)
6. [The optional answer step and API keys](#the-optional-answer-step-and-api-keys)
7. [The run summary for assignments](#the-run-summary-for-assignments)
8. [Flow mode](#flow-mode)
   - [The canvas](#the-canvas)
   - [Keyboard](#keyboard)
   - [The exercises](#the-exercises)
   - [Exporting a graph, and the notebook](#exporting-a-graph-and-the-notebook)
   - [The flow summary](#the-flow-summary)
   - [Flow mode constants](#flow-mode-constants)
   - [Adding a kind of card](#adding-a-kind-of-card)
9. [Tests](#tests)
10. [Folder layout](#folder-layout)
11. [Browser support](#browser-support)
12. [Known limitations](#known-limitations)
13. [Extension points](#extension-points)

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

This is how the site is published today: **https://wrisvold.github.io/rag-lab/**. The repository is laid out for it (`index.html` at the root, a `.nojekyll` file present), and Pages is enabled in the repository settings.

If it ever needs re-enabling, or for a fork:

1. On GitHub open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to "Deploy from a branch", pick branch `main` and folder `/ (root)`, and save.
3. After a minute the page reports the address.

Every push to `main` republishes automatically within a minute or two. Students need nothing but the link.

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
2. Uploads just the files the two pages need: `index.html`, `flow.html`, `styles.css`, `flow.css`, `js/`, `data/`. Tests, tools, and git metadata stay out.
3. Sets `Content-Type: text/javascript` on every module. Browsers refuse ES modules served with the wrong type, and S3 sometimes guesses.
4. Creates a CloudFront invalidation so the new files show up within a couple of minutes.

The first run takes about ten minutes because CloudFront distributions are slow to create. Later runs take under a minute.

**Custom domain (optional).** To serve the lab at something like `raglab.gcsu.edu`: request an ACM certificate for that name **in us-east-1** (CloudFront only reads certificates from that region), validate it by DNS, then edit the `ViewerCertificate` block in `deploy/aws/template.yaml` as the comment there shows, add the name under `Aliases`, redeploy, and ask whoever manages GCSU DNS to add a CNAME from `raglab.gcsu.edu` to the distribution's domain name (the `SiteUrl` output without `https://`).

**Removing it.** `aws cloudformation delete-stack --stack-name rag-lab` removes the distribution and the bucket policy. Empty the bucket first (`aws s3 rm s3://BUCKET --recursive`), because CloudFormation will not delete a bucket that still has objects.

**Alternatives on AWS.** [AWS Amplify Hosting](https://aws.amazon.com/amplify/hosting/) can connect straight to the GitHub repository and publish on every push with no scripts; choose "Deploy without a build" and the root folder. Plain "S3 static website hosting" also works but serves over HTTP only, so prefer the CloudFront setup above.

### For IT: moving RAG Lab into the department's AWS space, step by step

This section is written for someone who has not seen this project before. Everything you need to type is in a box; everything else is explanation. Budget about half an hour, most of it waiting for AWS.

**What you are hosting.** A folder of static files: HTML, CSS, JavaScript, and one text file. There is no server-side code, no database, no user accounts, and nothing that stores student data. The page runs entirely in the student's browser. The only outbound connections are made by the student's browser to a public CDN (for an optional 23 MB model) and, only if a student chooses to, to an AI provider with the student's own key. Nothing on the AWS side ever calls out.

**What it needs from AWS.** One S3 bucket (private) and one CloudFront distribution (HTTPS) in front of it, created by one CloudFormation template. Cost for a class is cents per month. If the department's space does not allow CloudFront, see step 8 for the alternatives.

**Step 1. Install the AWS command-line tool.**

Windows (PowerShell, run as yourself):

```powershell
winget install --id Amazon.AWSCLI -e
```

macOS:

```bash
brew install awscli
```

Close and reopen the terminal, then confirm:

```bash
aws --version
```

You should see `aws-cli/2.x`. Version 1 will not work with these scripts.

**Step 2. Sign in to the department's AWS space.**

How you sign in depends on how central IT set the space up. One of these two will apply.

*If they gave you an access key and secret key* for a user or role in the department's account:

```bash
aws configure
```

It asks four questions: the access key, the secret key, a default region (`us-east-1` unless the department has a required region), and an output format (`json`).

*If the university uses IAM Identity Center (single sign-on)*, central IT will have given you a profile name and a start URL:

```bash
aws configure sso
```

then, each day you deploy:

```bash
aws sso login --profile DEPARTMENT-PROFILE
```

and put that profile in front of every command below by setting, once per terminal session:

```powershell
$env:AWS_PROFILE = "DEPARTMENT-PROFILE"
```

(on macOS or Linux: `export AWS_PROFILE=DEPARTMENT-PROFILE`).

Confirm you are signed in and in the right account:

```bash
aws sts get-caller-identity
```

The `Account` number should be the department's. If this command fails, nothing further will work; stop here and check the credentials with whoever issued them.

**Step 3. Check permissions.** The identity from step 2 needs, once, to create a CloudFormation stack, an S3 bucket, and a CloudFront distribution. Later updates need only to write to the bucket and create a CloudFront invalidation. If central IT asks what to allow, the list is: `cloudformation:*` on the stack `rag-lab`, `s3:*` on the one bucket, `cloudfront:CreateDistribution`, `cloudfront:UpdateDistribution`, `cloudfront:GetDistribution`, `cloudfront:CreateOriginAccessControl`, `cloudfront:CreateInvalidation`, and `cloudfront:TagResource`. An administrator role covers all of it.

**Step 4. Get the code.**

If Git is installed:

```bash
git clone https://github.com/Wrisvold/rag-lab.git
```

If not, open https://github.com/Wrisvold/rag-lab in a browser, click the green **Code** button, choose **Download ZIP**, and unzip it. Either way you end up with a folder called `rag-lab` (the ZIP unzips as `rag-lab-main`; that is fine).

Move into it:

```bash
cd rag-lab
```

**Step 5. Choose three names.**

| Name | What it is | Suggestion |
|---|---|---|
| bucket name | must be unique across all of AWS, lowercase, no spaces | `gcsu-cbis5530-rag-lab` |
| region | where the bucket lives; CloudFront is global regardless | `us-east-1`, or the department's required region |
| stack name | the CloudFormation stack that owns everything | `rag-lab` (the default) |

If the bucket name is taken, the script fails at step 1 with "bucket already exists"; pick another and run it again.

**Step 6. Deploy.** One command. It creates everything the first time and updates it every later time.

Windows PowerShell, from inside the `rag-lab` folder:

```powershell
.\deploy\aws\deploy.ps1 -BucketName gcsu-cbis5530-rag-lab -Region us-east-1
```

macOS or Linux:

```bash
chmod +x deploy/aws/deploy.sh
./deploy/aws/deploy.sh gcsu-cbis5530-rag-lab us-east-1
```

You will see four numbered steps. The first one, creating the CloudFront distribution, takes five to ten minutes the first time and prints nothing while it waits; that is normal. The script ends with:

```
Done. RAG Lab is at: https://d1234abcd.cloudfront.net
```

Copy that address. It is the one students use, unless you add a custom domain (see the section above this one).

If PowerShell refuses to run the script ("running scripts is disabled on this system"), run this once in that window and try again:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

**Step 7. Check it.** Open the address in a browser. You should see the RAG Lab walkthrough with a green header. Then:

1. Click **Load the sample document**, then **Chunk this document**. Cards with text appear. This proves the JavaScript modules and the sample file were served correctly.
2. Add `/flow.html` to the address. The canvas with seven cards appears. This proves the Flow mode files were uploaded.
3. On the canvas, click **Run all**, then on the Embed card choose **Black Box** and press its **Run**. A progress bar says a 23 MB model is downloading. If instead a notice says the model could not be loaded, the campus network is blocking `cdn.jsdelivr.net` or `huggingface.co` for that browser; the app still works in Glass Box mode, and the instructor should know.

**Step 8. If the department's space does not allow CloudFront.** Two alternatives, in order of preference:

- **AWS Amplify Hosting.** In the AWS console open Amplify, choose **Deploy without Git** (or connect the GitHub repository), upload the `rag-lab` folder as a ZIP, and Amplify serves it over HTTPS at an address it prints. No scripts, no template. Later updates are another upload.
- **Any web server the university already runs.** Copy the folder to it. The requirements are in [Any other static host](#any-other-static-host); the only one that ever bites is that `.js` files must be served as `text/javascript`.

Plain S3 "static website hosting" also works but is HTTP only and needs a public bucket, which most university policies forbid, so it is not recommended.

**Updating later.** When the instructor changes the code, run step 6 again from an up-to-date copy of the folder (`git pull`, or a fresh ZIP). The script uploads only what changed and refreshes CloudFront. Students see the new version within a couple of minutes.

**Removing it.** Empty the bucket, then delete the stack:

```bash
aws s3 rm s3://gcsu-cbis5530-rag-lab --recursive
aws cloudformation delete-stack --stack-name rag-lab --region us-east-1
```

**If something goes wrong.**

| What you see | What it means | What to do |
|---|---|---|
| `Unable to locate credentials` or `ExpiredToken` | not signed in, or the SSO session expired | step 2 again |
| `AccessDenied` during step 1/4 | the identity cannot create one of the resources | step 3; ask central IT for the listed permissions |
| `BucketAlreadyExists` | someone else in the world has that bucket name | pick another name; step 5 |
| The page loads but is blank, and the browser console says a module was blocked because of its MIME type | `.js` files were served with the wrong content type | run step 6 again; its third step sets the type |
| Everything works except Black Box | the student's network blocks the CDN | expected on some campus networks; the app says so and continues |
| `flow.html` is "not found" | an older copy of the deploy script that did not know about Flow mode | update the folder (`git pull`) and run step 6 again |

### AWS: automatic deploys from GitHub

`.github/workflows/deploy-aws.yml` is a GitHub Actions workflow that runs the tests and then uploads to S3 and refreshes CloudFront on every push to `main`. It is switched off until the one-time setup in its header comment is done (an IAM role that trusts the repository via OpenID Connect, and four repository secrets). No AWS access keys are stored anywhere.

### Any other static host

Copy the folder. That is the whole procedure. The only requirements are:

- `index.html` is served at the folder root (any path is fine: both pages use relative addresses), with `flow.html` beside it.
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

**The synonym probe is fragile, on purpose.** The course's centrepiece demonstration is that "How many days of PTO do new employees get?" fails in Glass Box (the vacation chunk is outside the top 3) and succeeds in Black Box (rank 1). That depends on the exact wording of the handbook:

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

The question was chosen for its margin: "How much PTO do new employees get?" also passes but by a quarter of the distance, and "How many days off do new hires get each year?" scores further ahead still but drops the word "PTO". The question is one string in `js/copy.js`.

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
Question: How many days of PTO do new employees get?
TOP_K=3
  1. chunk 02  score 0.21
  2. chunk 03  score 0.16
  3. chunk 07  score 0.11
Prompt length: 1,491 chars
```

Chunk numbers are the same 1-based, zero-padded numbers shown on the cards. (The Colab notebook's Python lists start at 0; tell students the lab counts from 1.) An assignment can say "run RAG Lab with CHUNK_SIZE=200 and paste your summary" and be graded from text.

---

## Flow mode

The walkthrough shows the pipeline one station at a time. **Flow mode** (`flow.html`, the "Flow" button in the header) hands the student a canvas and the six steps as cards, and asks them to build the pipeline. It is the same compute code behind a different question: not "what happens at each step?" but "what has to connect to what, and why?"

It is deliberately not a general node editor. There are eight kinds of card and no others; every wire is type-checked; and every refusal is a sentence a student can learn from rather than a silent failure. The three dials sit on the cards that own them. Nothing in the walkthrough changed to make room for it: Flow mode is a second page over the same modules, and a first-week class need never see it.

### The canvas

- **Palette** (left): one button per kind of card, with a one-line hint. A new card lands near the middle of the view, clear of the others, and takes focus.
- **Cards**: title, lane tag (build time teal, run time amber, as on the stepper), input ports on the left, output port on the right, the card's own settings, then a footer with a summary line ("20 chunks · 19 mid-sentence cuts"), a gold "Re-run to update" badge when the card is stale, any error, and Run.
- **Wires**: drag from an output port to an input port. Matching inputs glow teal while you drag; a refused drop prints why in the line under the canvas and makes no wire. A click on an output port (no drag) starts a wire that finishes on the next click. The small × at a wire's midpoint removes it.
- **Run** on a card runs it and anything stale upstream, exactly as "Retrieve" in the walkthrough re-chunks and re-embeds if it must. **Run all** on the toolbar runs whatever is missing or stale, in order. Changing a setting greys the card and every card and wire downstream; nothing is re-run until you ask.
- **Inspector** (right): click a card and its artifact appears, drawn by the walkthrough's own station for that step: the chunk cards, the vector map and inspector, the ranked table with the question on the map, the three-block prompt with Copy prompt and Copy run summary, the answer form. Hide it with the button in its header.
- **Export and load** (toolbar menu): the flow summary, the graph as JSON, a download, and a file picker. See below.
- **Readout**: the line under the canvas announces every action (aria-live), so screen-reader users hear what happened.

The canvas, its zoom, and every setting survive a reload in the same tab, like the walkthrough. Artifacts do not; press Run all.

### Keyboard

| Where | Keys | What happens |
|---|---|---|
| anywhere | Tab / Shift+Tab | moves through cards, ports, settings, and buttons in reading order |
| a card | ← ↑ → ↓ | moves it one grid step (20 px); Shift moves five |
| a card | Delete | removes it; focus moves to a neighbour |
| an output port | Enter or Space | starts a wire and moves focus to the first matching input |
| while wiring | Tab | reaches every input port; matching ones are highlighted |
| an input port, while wiring | Enter | makes the wire, or reads out why it is refused |
| while wiring | Escape | cancels and returns focus to the port you started from |
| a wired input port | Delete | removes that wire |
| a wire's × handle | Enter | removes that wire |
| the export menu | Escape | closes it |

Tab reaches every input while wiring, not only the matching ones, on purpose: a keyboard user should be able to try Chunk into Retrieve and hear "Retrieve compares numbers, not words…" just as a mouse user can.

### The exercises

The palette's "Exercises" section loads a canvas with a sticky note carrying the task. Each is built from the sample handbook.

| Exercise | What loads | What to notice |
|---|---|---|
| 1 · Build it | Document and Answer, nothing between | Every refused wire names the missing step. The order of the steps is the lesson. |
| 2 · Something is missing | The pipeline with no Chunk card | Document into Embed is refused: "Embed works on chunks, not on the whole document…". Add Chunk, wire it, run. |
| 3 · Starved retrieval | TOP_K = 1 and the parental-leave question | The one passage the model receives is about holidays and sick leave. Retrieval always returns something; the instruction is what keeps the model honest. |
| 4 · Two boxes | Glass Box and Black Box branches fed by one Chunk and one Question | The two Retrieve footers name different chunks for the same question. The Black Box one has the vacation chunk at rank 1; the Glass Box one does not have it at all. |
| 5 · The lost sentence | CHUNK_OVERLAP = 0, CHUNK_SIZE = 500 | The cut lands inside "vacation": one chunk ends "…gets ten vacat", the next begins "ion days a year…". No chunk says what a new hire gets. Raise the overlap and run again. |

The chunk size for exercise 5 is `FLOW_EXERCISE_OVERLAP_SIZE` in `js/constants.js`. If you swap the sample document, `tests/flow/exercises.test.js` will tell you whether the cut still lands where the note says.

A new exercise is one entry in `js/flow/exercises.js` (a graph built with the same calls the canvas uses) plus a label and task in `js/copy.js` under `FLOW.exercises.items`.

### Exporting a graph, and the notebook

**Copy graph as JSON** and **Download graph** write the canvas in a shape meant to be read by a person or by the course notebook:

```json
{
  "format": "rag-lab-flow",
  "version": 1,
  "pipeline": [
    { "id": "document-1", "type": "document", "params": { "name": "sample.txt", "sample": true }, "inputs": {} },
    { "id": "chunk-2",    "type": "chunk",    "params": { "CHUNK_SIZE": 400, "CHUNK_OVERLAP": 50 }, "inputs": { "text": "document-1" } },
    { "id": "embed-3",    "type": "embed",    "params": { "mode": "glass" }, "inputs": { "chunks": "chunk-2" } },
    { "id": "question-4", "type": "question", "params": { "text": "How many days of PTO do new employees get?" }, "inputs": {} },
    { "id": "retrieve-5", "type": "retrieve", "params": { "TOP_K": 3 }, "inputs": { "vectors": "embed-3", "question": "question-4" } },
    { "id": "assemble-6", "type": "assemble", "params": { "instruction": "Answer the question using only…" }, "inputs": { "passages": "retrieve-5", "question": "question-4" } },
    { "id": "answer-7",   "type": "answer",   "params": { "provider": "gemini" }, "inputs": { "prompt": "assemble-6" } }
  ],
  "layout": { "document-1": { "x": 40, "y": 40 }, "chunk-2": { "x": 360, "y": 40 } }
}
```

- `pipeline` is in execution order. Each entry names what feeds it by node id; a node has one output, so the port is implied.
- The three dials use the notebook's names (`CHUNK_SIZE`, `CHUNK_OVERLAP`, `TOP_K`); the mapping is `FLOW_NOTEBOOK_NAMES` in `js/constants.js`. Other settings keep their own names.
- The sample document is written by reference (`"sample": true`) and fetched back on load; a pasted document is written in full.
- Artifacts are never written; a loaded graph is re-run. The API key is never a setting, so it cannot appear here.
- `layout` is card positions. The notebook ignores it.

**Load graph** takes such a file back. Anything else gets one plain sentence ("That file is not a RAG Lab graph.").

Whether the Colab notebook reads this file or the `pipeline` block is simply a reference for students to compare against is an open decision (see STATUS.md); the names are already the notebook's, so nothing in the format needs to change either way.

`node tools/flow-run.mjs path/to/graph.json` runs an exported graph outside the browser (Glass Box) and prints its run summary, which is how the Phase 7 exit check was made.

### The flow summary

**Copy flow summary** (in the export menu) is the Flow counterpart of the walkthrough's run summary: every card in execution order, what feeds it, its settings, and what it produced, with notes at the end.

```
RAG Lab flow — 2026-09-16 14:02
1. Document · sample.txt · 1,105 words
2. Chunk (from 1) · CHUNK_SIZE=400  CHUNK_OVERLAP=50 · 20 chunks, 19 mid-sentence cuts
3. Embed (from 2) · Glass Box (TF-IDF) · 392 dims
4. Question · How many days of PTO do new employees get?
5. Retrieve (from 3, 4) · TOP_K=3 · chunks 02, 03, 07 · scores 0.19, 0.10, 0.08
6. Assemble (from 5, 4) · 1,467 chars
7. Answer (from 6) · Google Gemini · not run
Note · Build the path from the Document to the Answer…
```

For a single chain the walkthrough's own run summary is also available: click the Assemble card and use Copy run summary in the inspector.

### Flow mode constants

| Constant | Default | What it is |
|---|---|---|
| `FLOW_NODE_WIDTH` | 250 | width of every card, in pixels at 100% |
| `FLOW_COLUMN_GAP`, `FLOW_ROW_GAP` | 70, 300 | spacing the presets and exercises use |
| `FLOW_CANVAS_PADDING` | 40 | margin around a preset and around Fit |
| `FLOW_GRID_STEP`, `FLOW_KEYBOARD_STEP_LARGE` | 20, 5 | cards snap to the grid; arrows move one step, Shift+arrow five |
| `FLOW_ZOOM_MIN`, `FLOW_ZOOM_MAX`, `FLOW_ZOOM_STEP` | 0.4, 1.6, 1.2 | zoom range and the factor per button press |
| `FLOW_EXPORT_VERSION` | 1 | stamp in every exported graph; bump only if the format changes |
| `FLOW_NOTEBOOK_NAMES` | the three dials | how settings are named in the export |
| `FLOW_EXPORT_FILENAME` | `rag-lab-flow.json` | the download's file name |
| `FLOW_EXERCISE_OVERLAP_SIZE` | 500 | the chunk size in exercise 5 |
| `FLOW_SESSION_STORAGE_KEY` | `rag-lab-flow` | where the canvas is kept across a reload |

All Flow mode text is the `FLOW` block at the end of `js/copy.js`: port names, card labels and hints, the refusal sentences (`refusals` for the general cases and `pairs` for the taught ones, keyed "what the wire carries->what the input needs"), the exercises, the toolbar, and the readout lines. The same rules apply as to the explainers, and `tests/flow/explain.test.js` checks every string.

### Adding a kind of card

A new node type is one entry in `NODE_TYPES` in `js/flow/registry.js` (its ports, its settings' defaults, and a `run` that calls the compute module) plus a label and hint in `FLOW.nodes`. The graph, the runner, the serializer, and the canvas need no change. A refusal sentence for a new port type goes in `FLOW.portNames` and, if it deserves its own lesson, `FLOW.pairs`. A Compare card (two inputs of one kind shown side by side) was designed and deliberately held back; STATUS.md has the reasoning.

---

## Tests

```bash
npm test
```

runs `node --test` over `tests/`: one file per pure module (chunker, tokenizer, TF-IDF, cosine, PCA, Glass Box, retrieval, prompt, summary, answer request shapes, Black Box progress) plus the copy rules and the Glass Box half of the synonym probe on the real sample document. `tests/flow/` covers Flow mode's graph (every refusal, ordering, staleness), runner (the canonical graph reproduces the walkthrough's numbers exactly), serializer, explainer, adapter, exercises, and flow summary. No packages are installed for the tests.

---

## Folder layout

```
index.html          page shell (header, stepper, sidebar, station panel, global progress/notice)
flow.html           Flow mode: palette, canvas, inspector
styles.css          GCSU Evergreen palette as CSS variables, layout, every component
flow.css            Flow mode's layout, cards, ports, wires (loaded after styles.css)
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
js/flow/registry.js the node table: ports, settings, and which compute module each card runs
js/flow/graph.js    pure: nodes, wires, refusals, execution order, staleness
js/flow/runner.js   runs a graph or one node and its stale ancestors
js/flow/serialize.js  the graph as JSON and back
js/flow/explain.js  refusal, skip, error, and load codes -> sentences from copy.js
js/flow/summary.js  the walkthrough's run summary for a chain, and the flow summary
js/flow/presets.js, js/flow/exercises.js   the standard pipeline and the five exercises
js/flow/adapter.js  presents a card's upstream chain as the walkthrough's app, so stations render in the inspector
js/flow/canvas.js   the canvas: pan, zoom, drag, wiring by pointer and keyboard
js/flow/nodes.js    one card: chrome, ports, inline settings
js/flow/inspector.js  the inspector panel
js/flow/main.js     Flow mode's entry point: palette, toolbar, running, export, persistence
tests/              node --test files (tests/flow/ for Flow mode)
tools/probe.mjs     re-checks the synonym probe with the real model
tools/flow-run.mjs  runs a Flow mode graph outside the browser and prints its summary
deploy/aws/         CloudFormation template and deploy scripts for S3 + CloudFront
.github/workflows/  optional automatic AWS deploy (off until configured)
STATUS.md           what was built in each phase and every decision made along the way
```

---

## Browser support

Built and checked on the Chrome engine (Chrome and Edge). The code uses only features that current Firefox and Safari also support: ES modules, dynamic `import()`, `async`/`await`, typed arrays, SVG, the `:has()` selector (Firefox 121+, Safari 15.4+), and the clipboard API with an older fallback. Phones are out of scope; tablets and small laptop windows stack the sidebar above the station.

Keyboard: every control is reachable with Tab, the map points are buttons (Enter or Space selects one), and a skip link at the top jumps to the current station. Progress and status changes are announced to screen readers through live regions. All text colours meet the 4.5:1 contrast ratio on their backgrounds; gold is used only as a background or border, never as small text.

Flow mode adds pointer events (mouse, pen, and touch drag all move cards and wires), a wheel for panning and Ctrl+wheel for zoom, and the keyboard reference above. Focus on the canvas is a gold ring inside a green one, so it reads on the dotted background, on a card, and on a port. Under 1100 px the three columns stack, with the palette and inspector scrolling inside a third of the screen each. There is no pinch-to-zoom; use the toolbar's − and +.

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
- **Nothing is saved between sessions.** The document, dials, question, and instruction survive a reload within a tab, nothing more. That is intentional: there are no accounts and no tracking. Flow mode keeps its canvas the same way, and offers Download graph for anything worth keeping.
- **Flow mode has one inspector.** Two branches are compared by their cards' summary lines and by selecting each in turn. A Compare card that shows two artifacts side by side was designed and held back until students have done the comparison by hand once.
- **Flow mode on a phone** works for reading and for tapping Run, but building a pipeline by touch on a small screen is slow. It is meant for a laptop.

---

## Extension points

Each is marked with a comment in the code where it would attach.

- `js/chunker.js`: a sentence- or paragraph-based chunker returning the same `{ chunks, summary }` shape.
- `js/fileReader.js`: PDF text extraction (would need a PDF library from the CDN).
- `js/main.js`, the `STATION_RENDERERS` table and the artifact list: multiple documents, or a document library.
- `js/answer.js`: a fourth provider, or a departmental proxy so students never handle keys.
- `js/flow/registry.js`, `NODE_TYPES`: a new kind of card (see [Adding a kind of card](#adding-a-kind-of-card)).
- `js/flow/exercises.js`, `EXERCISES`: a new exercise.

---

*RAG Lab was built for Ward Risvold's CBIS 5530 with Claude Code, September 2026. The sample handbook, company, and people in it are fictional.*
