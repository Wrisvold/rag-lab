// Station 3 — Retrieve. Artifact 3: the retrieved passages.
// Question box, sample questions, ranked table of every chunk, the top-k
// cards, and the question drawn on the map with lines to its neighbours.

import { el, fill } from '../dom.js';
import { formatNumber, padNumber } from '../text.js';
import { renderMap } from '../map.js';

const PREVIEW_LENGTH = 90;

export function renderRetrieveStation(panel, app) {
  const { state, copy } = app;
  const text = copy.STATION_RETRIEVE;

  // ---- Question box ----
  const input = el('input', {
    type: 'text',
    id: 'question-text',
    class: 'question-input',
    placeholder: text.questionPlaceholder,
    autocomplete: 'off',
  });
  input.value = state.question;

  const note = el('p', { class: 'hint question-note', id: 'question-note' });

  const select = el('select', { id: 'sample-question', class: 'select', 'aria-label': text.sampleLabel });
  select.append(el('option', { value: '', text: text.samplePlaceholder }));
  for (const sample of copy.SAMPLE_QUESTIONS) {
    select.append(el('option', { value: sample.key, text: `${sample.label}: ${sample.text}` }));
  }
  select.addEventListener('change', () => {
    const sample = copy.SAMPLE_QUESTIONS.find((q) => q.key === select.value);
    if (!sample) return;
    input.value = sample.text;
    app.setQuestion(sample.text);
    refresh();
  });

  const message = el('p', { class: 'message--error', role: 'alert' });
  const runButton = el('button', {
    type: 'button',
    class: 'button button--primary',
    text: state.artifacts.retrieval ? text.rerunButton : text.runButton,
    onclick: () => {
      if (!state.question.trim()) { message.textContent = text.emptyQuestion; input.focus(); return; }
      message.textContent = '';
      app.runRetrieval();
    },
  });

  input.addEventListener('input', () => { app.setQuestion(input.value); refresh(); });
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') runButton.click(); });

  panel.append(
    el('div', { class: 'question-box' }, [
      el('label', { for: 'question-text', class: 'question-label', text: text.questionLabel }),
      el('div', { class: 'toolbar' }, [input, runButton]),
      el('div', { class: 'toolbar' }, [
        el('label', { for: 'sample-question', class: 'hint', text: text.sampleLabel }),
        select,
      ]),
      note,
      message,
    ]),
  );

  const results = el('div', { id: 'retrieval-results' });
  panel.append(results);

  function refresh() {
    const sample = copy.SAMPLE_QUESTIONS.find((q) => q.text === state.question.trim());
    note.textContent = sample ? sample.note : '';
    select.value = sample ? sample.key : '';
    // The results are stale as soon as the question differs from the one that produced them.
    const notice = results.querySelector('.stale-notice');
    const body = results.querySelector('.retrieval-body');
    if (notice && body) {
      const stale = app.isStale('retrieval');
      notice.hidden = !stale;
      body.classList.toggle('stale', stale);
    }
  }

  renderResults(results, app, runButton);
  refresh();
}

function renderResults(container, app, runButton) {
  const { state, copy } = app;
  const text = copy.STATION_RETRIEVE;
  const artifact = state.artifacts.retrieval;
  container.replaceChildren();

  if (!artifact) {
    container.append(el('p', { class: 'hint', text: text.notYet }));
    return;
  }

  const stale = app.isStale('retrieval');
  const chunks = state.artifacts.chunks.chunks;
  const { embedding, projection } = state.artifacts.embeddings;
  const { ranked, topK, query, topKValue } = artifact;
  const topIds = topK.map((r) => r.index);

  container.append(el('div', { class: 'stale-notice', role: 'status', hidden: !stale }, [
    copy.DIALS.staleNotice + ' ',
    el('button', { type: 'button', class: 'button button--primary', text: text.rerunButton, onclick: () => runButton.click() }),
  ]));

  const body = el('div', { class: `retrieval-body${stale ? ' stale' : ''}` });
  container.append(body);

  // ---- Summary and continue ----
  body.append(el('div', { class: 'toolbar' }, [
    el('p', { class: 'summary', role: 'status' }, [
      el('strong', { text: fill(text.summary, { count: formatNumber(ranked.length), topK: topKValue }) }),
      el('span', { class: 'hint mono block', text: `${copy.DIALS.topK.label}=${topKValue}  ·  ${embedding.mode === 'glass' ? copy.STATION_EMBED.modeGlass : copy.STATION_EMBED.modeBlack}` }),
    ]),
    el('span', { class: 'toolbar__spacer' }),
    el('button', { type: 'button', class: 'button button--primary', text: text.continueButton, disabled: stale, onclick: () => app.runAssembly({ goToStation: true }) }),
  ]));

  // ---- How the question was read (Glass Box only: words are visible) ----
  if (embedding.mode === 'glass') {
    const wordChips = (words, cls) => el('span', { class: 'word-list' }, words.map((w) => el('span', { class: `word ${cls}`, text: w })));
    const section = el('section', { class: 'question-words', 'aria-labelledby': 'question-words-heading' }, [
      el('h3', { id: 'question-words-heading', text: text.wordsHeading }),
    ]);
    if (query.known.length === 0) {
      section.append(el('p', { class: 'callout', text: text.noKnownWords }));
    } else {
      section.append(el('p', {}, [text.knownWords + ' ', wordChips(query.known, 'word--known')]));
    }
    if (query.unknown.length) {
      section.append(el('p', {}, [text.unknownWords + ' ', wordChips(query.unknown, 'word--unknown')]));
    }
    if (query.dropped && query.dropped.length) {
      section.append(el('p', { class: 'hint' }, [text.droppedWords + ' ', wordChips(query.dropped, 'word--dropped')]));
    }
    body.append(section);
  } else {
    body.append(el('section', { class: 'question-words' }, [
      el('h3', { text: text.wordsHeading }),
      el('p', { text: fill(text.blackBoxNote, { dimensions: embedding.dimensions }) }),
    ]));
  }

  // ---- The map with the question on it ----
  const points = chunks.map((chunk, i) => ({
    id: chunk.index,
    label: fill(copy.STATION_CHUNK.cardTitle, { n: padNumber(chunk.number, chunks.length) }),
    x: projection.points[i][0],
    y: projection.points[i][1],
    preview: preview(chunk.text, 80),
  }));
  const readout = el('p', { class: 'map__readout', 'aria-live': 'polite', text: artifact.questionHasDirection ? copy.STATION_EMBED.mapHover : text.questionNoDirection });
  const map = renderMap({
    points,
    selectedId: null,
    ariaLabel: text.mapHeading,
    question: { x: artifact.questionPoint[0], y: artifact.questionPoint[1], label: `${text.questionMarker}: ${artifact.question}` },
    neighborIds: topIds,
    onSelect: () => {},
    onHover: (point) => { readout.textContent = point ? `${point.label}: ${point.preview}` : (artifact.questionHasDirection ? copy.STATION_EMBED.mapHover : text.questionNoDirection); },
  });
  body.append(el('section', { class: 'map-section', 'aria-labelledby': 'retrieve-map-heading' }, [
    el('h3', { id: 'retrieve-map-heading', text: text.mapHeading }),
    el('p', { class: 'hint', text: text.mapIntro }),
    map,
    readout,
  ]));

  // ---- Ranked table of every chunk ----
  const table = el('table', { class: 'rank-table' }, [
    el('caption', { class: 'visually-hidden', text: text.tableHeading }),
    el('thead', {}, [el('tr', {}, [
      el('th', { scope: 'col', text: text.colRank }),
      el('th', { scope: 'col', text: text.colChunk }),
      el('th', { scope: 'col', text: text.colScore }),
      el('th', { scope: 'col', text: text.colPreview }),
      el('th', { scope: 'col', text: text.colTopK }),
    ])]),
  ]);
  const tbody = el('tbody');
  for (const entry of ranked) {
    const chunk = chunks[entry.index];
    const kept = entry.rank <= topKValue;
    tbody.append(el('tr', { class: kept ? 'is-topk' : '' }, [
      el('td', { class: 'mono', text: String(entry.rank) }),
      el('td', { class: 'mono', text: padNumber(chunk.number, chunks.length) }),
      el('td', { class: 'mono', text: entry.score.toFixed(2) }),
      el('td', { class: 'rank-table__preview', text: preview(chunk.text, PREVIEW_LENGTH) }),
      el('td', { text: kept ? text.topKMark : '' }),
    ]));
  }
  table.append(tbody);
  body.append(el('section', { class: 'table-section', 'aria-labelledby': 'rank-table-heading' }, [
    el('h3', { id: 'rank-table-heading', text: text.tableHeading }),
    el('p', { class: 'hint', text: text.tableIntro }),
    table,
  ]));

  // ---- Top-k cards ----
  const cards = el('ol', { class: 'chunk-list', 'aria-label': fill(text.cardsHeading, { topK: topKValue }) });
  for (const entry of topK) {
    const chunk = chunks[entry.index];
    cards.append(el('li', { class: 'chunk-card chunk-card--retrieved' }, [
      el('header', { class: 'chunk-card__header' }, [
        el('span', { class: 'badge badge--rank', text: fill(text.rankBadge, { rank: entry.rank }) }),
        el('h3', { text: fill(copy.STATION_CHUNK.cardTitle, { n: padNumber(chunk.number, chunks.length) }) }),
        el('span', { class: 'mono', text: fill(copy.STATION_CHUNK.cardSpan, { start: formatNumber(chunk.start), end: formatNumber(chunk.end - 1) }) }),
        el('span', { class: 'badge badge--score', text: fill(text.scoreBadge, { score: entry.score.toFixed(2) }) }),
      ]),
      el('p', { class: 'chunk-card__text', text: chunk.text }),
    ]));
  }
  body.append(el('section', { class: 'cards-section', 'aria-labelledby': 'topk-heading' }, [
    el('h3', { id: 'topk-heading', text: fill(text.cardsHeading, { topK: topKValue }) }),
    cards,
  ]));
}

function preview(chunkText, length) {
  const flat = chunkText.replace(/\s+/g, ' ').trim();
  return flat.length > length ? `${flat.slice(0, length)}…` : flat;
}
