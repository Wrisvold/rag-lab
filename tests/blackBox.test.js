import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeProgress, isBlackBoxLoaded } from '../js/blackBox.js';

test('nothing is loaded until the browser asks for it', () => {
  assert.equal(isBlackBoxLoaded(), false);
});

test('summarizeProgress folds several files into one percentage', () => {
  const files = new Map();
  let p = summarizeProgress(files, { status: 'initiate', file: 'config.json' });
  assert.equal(p.percent, null);
  p = summarizeProgress(files, { status: 'progress', file: 'model.onnx', loaded: 50, total: 100 });
  assert.equal(p.percent, 50);
  p = summarizeProgress(files, { status: 'progress', file: 'tokenizer.json', loaded: 0, total: 100 });
  assert.equal(p.percent, 25);
  p = summarizeProgress(files, { status: 'done', file: 'tokenizer.json' });
  assert.equal(p.percent, 75);
  p = summarizeProgress(files, { status: 'done', file: 'model.onnx' });
  assert.equal(p.percent, 100);
  assert.equal(p.file, 'model.onnx');
});

test('summarizeProgress copes with events that carry no file', () => {
  const p = summarizeProgress(new Map(), { status: 'ready' });
  assert.deepEqual(p, { percent: null, file: '', status: 'ready' });
});
