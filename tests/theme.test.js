// The two themes (agent-mode-plan.md, Appendix B): contrast of each text and
// each meaningful fill, and no color, size, or space typed outside a token.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const SHEETS = ['styles.css', 'flow.css', 'agent.css'];

/** The custom properties of the first block that starts with `opener`. */
function block(css, opener) {
  const start = css.indexOf(opener);
  assert.ok(start >= 0, `no block "${opener}"`);
  let depth = 0;
  let i = css.indexOf('{', start);
  const from = i;
  for (; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') { depth -= 1; if (depth === 0) break; }
  }
  return css.slice(from + 1, i);
}
const props = (text) => Object.fromEntries([...text.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

async function themes() {
  const css = await read('styles.css');
  const light = props(block(css, ':root {'));
  const darkMedia = props(block(block(css, '@media (prefers-color-scheme: dark)'), ':root:not([data-theme="light"])'));
  const darkSet = props(block(css, ':root[data-theme="dark"]'));
  return { light, dark: { ...light, ...darkSet }, darkMedia, darkSet };
}

function luminance(hex) {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const resolve = (tokens, name) => {
  let value = tokens[name];
  for (let i = 0; value && value.startsWith('var(') && i < 5; i += 1) value = tokens[value.slice(4, -1)];
  assert.match(value || '', /^#[0-9A-Fa-f]{6}$/, `${name} is not a 6-digit color`);
  return value;
};

// Text and the backgrounds it sits on. Each pair must pass 4.5:1.
const SURFACES = ['--paper', '--page', '--ice'];
const TEXT_ON_SURFACES = ['--ink', '--ink-soft', '--green', '--teal-ink', '--amber-ink', '--danger'];
const TEXT_PAIRS = [
  ['--teal-ink', '--teal-soft'], ['--amber-ink', '--amber-soft'], ['--danger', '--danger-soft'],
  ['--ink', '--gold-soft'], ['--ink-soft', '--gold-soft'], ['--ink', '--teal-soft'], ['--ink', '--amber-soft'], ['--ink', '--danger-soft'],
  ['--on-fill', '--green-fill'], ['--on-fill', '--green-fill-hover'], ['--on-fill', '--teal-fill'], ['--on-fill', '--amber-fill'],
  ['--on-gold', '--gold'], ['--header-ink', '--header-bg'], ['--header-ink', '--header-hover'], ['--code-ink', '--code-bg'],
];
// Fills and borders that carry meaning (lanes, context types, tools, stops, focus). Each must pass 3:1.
const FILLS = ['--green', '--teal', '--amber', '--gold-mark', '--danger', '--ink-soft', '--focus'];

for (const name of ['light', 'dark']) {
  test(`${name} theme: text passes 4.5:1, and each meaningful fill passes 3:1`, async () => {
    const tokens = (await themes())[name];
    const failures = [];
    const check = (fg, bg, min) => {
      const ratio = contrast(resolve(tokens, fg), resolve(tokens, bg));
      if (ratio < min) failures.push(`${fg} on ${bg}: ${ratio.toFixed(2)}:1 (needs ${min}:1)`);
    };
    for (const fg of TEXT_ON_SURFACES) for (const bg of SURFACES) check(fg, bg, 4.5);
    for (const [fg, bg] of TEXT_PAIRS) check(fg, bg, 4.5);
    for (const fill of FILLS) for (const bg of ['--paper', '--page']) check(fill, bg, 3);
    check('--focus-on-header', '--header-bg', 3);
    assert.deepEqual(failures, []);
  });
}

test('the two dark blocks are the same, and the dark theme changes each surface and text color', async () => {
  const { light, darkMedia, darkSet } = await themes();
  assert.deepEqual(darkMedia, darkSet, 'the @media block and the [data-theme="dark"] block must match');
  for (const name of ['--paper', '--page', '--ice', '--ink', '--ink-soft', '--line', '--green', '--teal-ink', '--amber-ink', '--danger']) {
    assert.notEqual(darkSet[name], light[name], `${name} has no dark value`);
  }
});

test('each text color in a rule with a background passes 4.5:1 on that background, in the two themes', async () => {
  const all = await themes();
  const failures = [];
  for (const sheet of SHEETS) {
    const css = await read(sheet);
    for (const [, body] of css.matchAll(/\{([^{}]*)\}/g)) {
      const fg = body.match(/(?:^|[;\s])color:\s*var\((--[\w-]+)\)/);
      const bg = body.match(/background(?:-color)?:\s*var\((--[\w-]+)\)/);
      if (!fg || !bg) continue;
      for (const name of ['light', 'dark']) {
        const ratio = contrast(resolve(all[name], fg[1]), resolve(all[name], bg[1]));
        if (ratio < 4.5) failures.push(`${sheet} (${name}): ${fg[1]} on ${bg[1]} is ${ratio.toFixed(2)}:1`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test('no rule types a color, a font size, a space, or a corner outside the tokens', async () => {
  const failures = [];
  for (const sheet of SHEETS) {
    let css = await read(sheet);
    // The token blocks are the only place for raw values.
    if (sheet === 'styles.css') {
      css = css.replace(/:root \{[\s\S]*?\n\}\n/, '').replace(/@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n\}\n/, '').replace(/:root\[data-theme="dark"\] \{[\s\S]*?\n\}\n/, '');
    }
    css = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const add = (what, text) => failures.push(`${sheet}: ${what}: ${text.trim()}`);
    for (const m of css.matchAll(/#[0-9A-Fa-f]{3,8}\b|rgba?\(/g)) add('color', css.slice(m.index, m.index + 30));
    for (const m of css.matchAll(/\b(?:padding|margin)(?:-[a-z]+)*:\s*([^;}]+)|\b(?:row-|column-)?gap:\s*([^;}]+)/g)) {
      // Negative pixel offsets place a port on a border. A percentage moves the progress animation.
      const value = (m[1] || m[2]).replace('!important', '').replace(/var\(--space-\d\)/g, '').replace(/-\d+px|\d+%/g, '').replace(/\b(0|auto)\b/g, '').trim();
      if (value) add('space', m[0]);
    }
    for (const m of css.matchAll(/font-size:\s*([^;}]+)/g)) {
      if (!/^(var\(--text-[\w-]+\)|[\d.]+em|inherit|17px)$/.test(m[1].trim())) add('font size', m[0]);
    }
    for (const m of css.matchAll(/border-radius:\s*([^;}]+)/g)) {
      const value = m[1].replace(/var\(--radius(?:-sm|-lg|-pill)?\)/g, '').replace(/50%/g, '').replace(/\b0\b/g, '').trim();
      if (value) add('corner', m[0]);
    }
    for (const m of css.matchAll(/box-shadow:\s*([^;}]+)/g)) {
      if (/\d+px\s+\d+px\s+\d+px/.test(m[1]) && !m[1].includes('var(--shadow-float)')) add('shadow', m[0]);
    }
  }
  assert.deepEqual(failures, []);
});
