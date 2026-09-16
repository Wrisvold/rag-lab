// Runs a Flow mode graph outside the browser and prints its run summary.
// The Phase 7 exit check: the canonical graph on the sample document must
// print the same summary the walkthrough prints.
//
//   node tools/flow-run.mjs                       the canonical graph, Glass Box, synonym probe
//   node tools/flow-run.mjs path/to/graph.json    an exported graph (document text must be inline or the sample)
//
// Black Box graphs need Transformers.js installed (see tools/probe.mjs).

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const js = (name) => new URL(`../js/${name}`, import.meta.url);

const C = await import(js('constants.js'));
const { SAMPLE_QUESTIONS } = await import(js('copy.js'));
const { canonicalGraph } = await import(js('flow/presets.js'));
const { fromJSON, toJSON } = await import(js('flow/serialize.js'));
const { runGraph } = await import(js('flow/runner.js'));
const { flowRunSummary } = await import(js('flow/summary.js'));
const { explainError, explainSkip } = await import(js('flow/explain.js'));

const sampleText = readFileSync(join(root, C.SAMPLE_DOCUMENT_PATH), 'utf8');

let graph;
if (process.argv[2]) {
  graph = fromJSON(JSON.parse(readFileSync(process.argv[2], 'utf8')));
  for (const node of graph.nodes.values()) {
    if (node.type === 'document' && node.params.name === C.SAMPLE_DOCUMENT_NAME && !node.params.text) {
      node.params.text = sampleText;
    }
  }
} else {
  graph = canonicalGraph({ text: sampleText, question: SAMPLE_QUESTIONS[0].text }).graph;
}

const report = await runGraph(graph, {}, {
  onStart: (node) => process.stdout.write(`  ${node.id} … `),
  onDone: () => process.stdout.write('done\n'),
  onError: (node, error) => process.stdout.write(`failed: ${explainError(error)}\n`),
});

for (const entry of report.skipped) {
  if (entry.reason !== 'notRunnable') console.log(`  ${entry.id}: skipped. ${explainSkip(entry)}`);
}

const assemble = [...graph.nodes.values()].find((node) => node.type === 'assemble' && node.artifact);
if (!assemble) {
  console.error('\nNo assembled prompt. The chain did not complete.');
  process.exit(1);
}
console.log('\n' + flowRunSummary(graph, assemble.id));
console.log('\nExported graph:\n' + JSON.stringify(toJSON(graph), null, 2));
