import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitPca, applyPca, projectTo2D } from '../js/pca.js';

const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const norm = (a) => Math.sqrt(dot(a, a));

test('recovers the direction of greatest spread', () => {
  // Points along the line y = 2x with a little noise across it.
  const vectors = [];
  for (let t = -5; t <= 5; t += 1) vectors.push([t, 2 * t + (t % 2 ? 0.1 : -0.1)]);
  const fit = fitPca(vectors, { components: 2 });
  const [c1] = fit.components;
  const expected = [1 / Math.sqrt(5), 2 / Math.sqrt(5)];
  // Sign is arbitrary, so compare the absolute cosine.
  assert.ok(Math.abs(dot(c1, expected)) > 0.999, `first component was ${Array.from(c1)}`);
});

test('components are unit length and orthogonal', () => {
  const vectors = [[1, 2, 3], [2, 4, 5], [0, 1, 1], [5, 1, 0], [3, 3, 3]];
  const fit = fitPca(vectors, { components: 2 });
  const [c1, c2] = fit.components;
  assert.ok(Math.abs(norm(c1) - 1) < 1e-9);
  assert.ok(Math.abs(norm(c2) - 1) < 1e-9);
  assert.ok(Math.abs(dot(c1, c2)) < 1e-8);
  assert.ok(fit.variances[0] >= fit.variances[1]);
});

test('the mean projects to the origin', () => {
  const vectors = [[1, 2], [3, 4], [5, 0]];
  const fit = fitPca(vectors);
  const origin = applyPca(fit, Array.from(fit.mean));
  assert.ok(Math.abs(origin[0]) < 1e-12 && Math.abs(origin[1]) < 1e-12);
});

test('identical points give zeros, not NaN', () => {
  const { points } = projectTo2D([[1, 1, 1], [1, 1, 1], [1, 1, 1]]);
  for (const [x, y] of points) {
    assert.equal(Number.isNaN(x), false);
    assert.equal(Number.isNaN(y), false);
    assert.ok(Math.abs(x) < 1e-12 && Math.abs(y) < 1e-12);
  }
});

test('one-dimensional data has a negligible second component', () => {
  const vectors = [[0, 0], [1, 1], [2, 2], [3, 3]];
  const { points } = projectTo2D(vectors);
  for (const [, y] of points) assert.ok(Math.abs(y) < 1e-8);
});

test('projection of a new vector uses the same axes', () => {
  const vectors = [[0, 0], [2, 0], [0, 1], [2, 1]];
  const fit = fitPca(vectors);
  const a = applyPca(fit, [2, 0]);
  const b = applyPca(fit, [4, 0]);
  // Twice as far from the mean along x -> twice the coordinate along c1 (after centering).
  const meanX = fit.mean[0];
  assert.ok(Math.abs(Math.abs(b[0]) / Math.abs(a[0]) - Math.abs(4 - meanX) / Math.abs(2 - meanX)) < 1e-9);
});

test('works with typed arrays of higher dimension', () => {
  const vectors = Array.from({ length: 20 }, (_, i) => Float64Array.from({ length: 50 }, (__, j) => Math.sin(i * 0.3 + j) + (j % 5 === 0 ? i : 0)));
  const { points } = projectTo2D(vectors);
  assert.equal(points.length, 20);
  assert.ok(points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
});
