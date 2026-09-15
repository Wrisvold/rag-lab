// Station 1 — Chunk. Artifact 1: the chunks, as numbered cards.

import { el, fill } from '../dom.js';
import { formatNumber, padNumber } from '../text.js';

export function renderChunkStation(panel, app) {
  const { state, copy } = app;
  const text = copy.STATION_CHUNK;
  const artifact = state.artifacts.chunks;

  if (!artifact) {
    panel.append(
      el('p', { text: text.notYet }),
      el('div', { class: 'toolbar' }, [
        el('button', { type: 'button', class: 'button button--primary', text: text.runButton, onclick: () => app.runChunking() }),
      ]),
    );
    return;
  }

  const stale = app.isStale('chunks');
  const { chunks, summary, settings } = artifact;

  if (stale) {
    panel.append(el('div', { class: 'stale-notice', role: 'status' }, [
      copy.DIALS.staleNotice + ' ',
      el('button', { type: 'button', class: 'button button--primary', text: text.rerunButton, onclick: () => app.runChunking() }),
    ]));
  }

  panel.append(
    el('div', { class: 'toolbar' }, [
      el('p', { class: 'summary', role: 'status' }, [
        el('strong', { text: fill(text.summaryCount, { count: formatNumber(summary.count) }) }),
        ' · ',
        fill(text.summaryAverage, { average: formatNumber(summary.averageLength) }),
        ' · ',
        el('span', { class: summary.midSentenceCuts ? 'warn-text' : '' }, [
          fill(text.summaryCuts, { mid: summary.midSentenceCuts, boundaries: summary.boundaries }),
        ]),
        el('span', { class: 'hint mono block', text: fill(text.settingsUsed, settings) }),
      ]),
      el('span', { class: 'toolbar__spacer' }),
      !stale && el('button', { type: 'button', class: 'button', text: text.rerunButton, onclick: () => app.runChunking() }),
      el('button', { type: 'button', class: 'button button--primary', text: text.continueButton, disabled: stale, onclick: () => app.runEmbedding({ goToStation: true }) }),
    ]),
  );

  const list = el('ol', { class: `chunk-list${stale ? ' stale' : ''}`, 'aria-label': text.heading });
  for (const chunk of chunks) {
    list.append(renderChunkCard(chunk, chunks.length, text));
  }
  panel.append(list);
}

function renderChunkCard(chunk, total, text) {
  const number = padNumber(chunk.number, total);
  const isLast = chunk.number === total;
  const headingId = `chunk-${chunk.number}-heading`;

  const body = el('p', { class: 'chunk-card__text' });
  if (chunk.overlapWithPrevious > 0) {
    body.append(el('mark', {
      class: 'overlap',
      title: fill(text.overlapLabel, { n: padNumber(chunk.number - 1, total), count: chunk.overlapWithPrevious }),
    }, chunk.text.slice(0, chunk.overlapWithPrevious)));
    body.append(chunk.text.slice(chunk.overlapWithPrevious));
  } else {
    body.append(chunk.text);
  }
  if (chunk.endsMidSentence) {
    body.append(el('span', { class: 'cut', role: 'img', 'aria-label': text.cutLabel, title: text.cutLabel, text: '✂' }));
  }

  let footerText = text.cleanCutLabel;
  let footerClass = 'chunk-card__footer chunk-card__footer--clean';
  if (isLast) {
    footerText = text.endLabel;
    footerClass = 'chunk-card__footer';
  } else if (chunk.endsMidSentence) {
    footerText = '⚠ ' + text.cutLabel;
    footerClass = 'chunk-card__footer chunk-card__footer--warn';
  }

  return el('li', { class: `chunk-card${chunk.endsMidSentence ? ' chunk-card--cut' : ''}`, 'aria-labelledby': headingId }, [
    el('header', { class: 'chunk-card__header' }, [
      el('h3', { id: headingId, text: fill(text.cardTitle, { n: number }) }),
      el('span', { class: 'mono', text: fill(text.cardSpan, { start: formatNumber(chunk.start), end: formatNumber(chunk.end - 1) }) }),
      el('span', { class: 'mono', text: fill(text.cardLength, { length: formatNumber(chunk.length) }) }),
    ]),
    body,
    el('footer', { class: footerClass, text: footerText }),
  ]);
}
