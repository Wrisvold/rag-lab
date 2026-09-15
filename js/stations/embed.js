// Station 2 — Embed. Artifact 2: an embedding. Mode toggle, the map, and the
// vector inspector.

import { el, fill } from '../dom.js';
import { formatNumber, padNumber } from '../text.js';
import { renderMap, updateMapSelection } from '../map.js';

const PREVIEW_LENGTH = 80;

export function renderEmbedStation(panel, app) {
  const { state, copy } = app;
  const text = copy.STATION_EMBED;
  const artifact = state.artifacts.embeddings;

  panel.append(renderModeToggle(app));

  if (!artifact) {
    panel.append(
      el('p', { text: text.notYet }),
      el('div', { class: 'toolbar' }, [
        el('button', { type: 'button', class: 'button button--primary', text: text.runButton, onclick: () => app.runEmbedding() }),
      ]),
    );
    return;
  }

  const stale = app.isStale('embeddings');
  const { embedding, projection } = artifact;
  const chunks = state.artifacts.chunks.chunks;

  if (stale) {
    panel.append(el('div', { class: 'stale-notice', role: 'status' }, [
      copy.DIALS.staleNotice + ' ',
      el('button', { type: 'button', class: 'button button--primary', text: text.rerunButton, onclick: () => app.runEmbedding() }),
    ]));
    // The chunks may already have been redone; then the old vectors no longer
    // line up with them and there is nothing sensible to draw.
    if (projection.points.length !== chunks.length) return;
  }

  const summaryText = embedding.mode === 'glass'
    ? fill(text.summaryGlass, { count: formatNumber(embedding.vectors.length), dimensions: formatNumber(embedding.dimensions) })
    : fill(text.summaryBlack, { count: formatNumber(embedding.vectors.length), dimensions: formatNumber(embedding.dimensions) });

  panel.append(el('div', { class: 'toolbar' }, [
    el('p', { class: 'summary', role: 'status' }, [
      el('strong', { text: summaryText }),
      embedding.mode === 'glass'
        ? el('span', { class: 'hint block', text: fill(text.droppedWords, { dropped: formatNumber(embedding.stats.droppedStopwords), kept: formatNumber(embedding.stats.keptTokens) }) })
        : null,
    ]),
    el('span', { class: 'toolbar__spacer' }),
    !stale && el('button', { type: 'button', class: 'button', text: text.rerunButton, onclick: () => app.runEmbedding() }),
    el('button', { type: 'button', class: 'button button--primary', text: text.continueButton, disabled: true, title: copy.UI.notBuilt }),
  ]));

  const content = el('div', { class: stale ? 'stale' : '' });
  panel.append(content);

  // ---- The map ----
  const points = chunks.map((chunk, i) => ({
    id: chunk.index,
    label: fill(copy.STATION_CHUNK.cardTitle, { n: padNumber(chunk.number, chunks.length) }),
    x: projection.points[i][0],
    y: projection.points[i][1],
    preview: preview(chunk.text),
  }));
  const readout = el('p', { class: 'map__readout', 'aria-live': 'polite', text: text.mapHover });
  const inspector = el('div', { class: 'inspector', id: 'vector-inspector' });

  let selectedId = state.ui.selectedChunk;
  const map = renderMap({
    points,
    selectedId,
    ariaLabel: text.mapHeading,
    onSelect: (id) => select(id),
    onHover: (point) => { readout.textContent = point ? `${point.label}: ${point.preview}` : text.mapHover; },
  });

  content.append(
    el('section', { class: 'map-section', 'aria-labelledby': 'map-heading' }, [
      el('h3', { id: 'map-heading', text: text.mapHeading }),
      el('p', { class: 'hint', text: text.mapIntro }),
      map,
      readout,
    ]),
  );

  // ---- The inspector ----
  const chips = el('div', { class: 'chip-row', role: 'group', 'aria-label': text.inspectHeading });
  for (const chunk of chunks) {
    chips.append(el('button', {
      type: 'button',
      class: `chip${chunk.index === selectedId ? ' is-selected' : ''}`,
      'data-id': chunk.index,
      text: padNumber(chunk.number, chunks.length),
      title: preview(chunk.text),
      'aria-pressed': chunk.index === selectedId ? 'true' : 'false',
      onclick: () => select(chunk.index),
    }));
  }

  content.append(
    el('section', { class: 'inspector-section', 'aria-labelledby': 'inspector-heading' }, [
      el('h3', { id: 'inspector-heading', text: text.inspectHeading }),
      el('p', { class: 'hint', text: text.inspectIntro }),
      chips,
      inspector,
    ]),
  );

  function select(id) {
    selectedId = id;
    state.ui.selectedChunk = id;
    updateMapSelection(map, id);
    for (const chip of chips.children) {
      const active = Number(chip.dataset.id) === id;
      chip.classList.toggle('is-selected', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    renderInspector(inspector, app, id);
  }

  renderInspector(inspector, app, selectedId);
}

function renderInspector(container, app, chunkIndex) {
  const { state, copy, constants } = app;
  const text = copy.STATION_EMBED;
  container.replaceChildren();
  if (chunkIndex === null || chunkIndex === undefined) {
    container.append(el('p', { class: 'hint', text: text.noSelection }));
    return;
  }
  const chunks = state.artifacts.chunks.chunks;
  const chunk = chunks[chunkIndex];
  const { embedding } = state.artifacts.embeddings;
  const view = embedding.inspect(chunkIndex);
  const number = padNumber(chunk.number, chunks.length);

  if (embedding.mode === 'glass') {
    const shown = view.topTerms.length;
    const maxWeight = shown ? view.topTerms[0].weight : 1;
    const rows = el('ol', { class: 'bars', 'aria-label': fill(text.inspectTitleGlass, { n: number, dimensions: formatNumber(view.dimensions), shown }) });
    for (const { term, weight } of view.topTerms) {
      rows.append(el('li', { class: 'bar' }, [
        el('span', { class: 'bar__term mono', text: term }),
        el('span', { class: 'bar__track' }, [
          el('span', { class: 'bar__fill', style: `width:${Math.max(2, (weight / maxWeight) * 100).toFixed(1)}%` }),
        ]),
        el('span', { class: 'bar__value mono', text: weight.toFixed(3) }),
      ]));
    }
    container.append(
      el('h4', { text: fill(text.inspectTitleGlass, { n: number, dimensions: formatNumber(view.dimensions), shown }) }),
      el('p', { class: 'chunk-preview', text: preview(chunk.text, 160) }),
      rows,
      el('p', { class: 'hint', text: fill(text.inspectNonZero, { nonZero: formatNumber(view.nonZero), dimensions: formatNumber(view.dimensions) }) }),
      el('p', { class: 'hint', text: fill(text.inspectDropped, { dropped: view.droppedStopwords, kept: view.tokenCount }) }),
      el('p', { class: 'hint', text: text.inspectZeroWeight }),
    );
    return;
  }

  // Black Box inspector arrives in Phase 5; this branch is unreachable until then.
  container.append(el('p', { class: 'hint', text: copy.UI.notBuilt }));
  void constants;
}

function renderModeToggle(app) {
  const { state, copy } = app;
  const text = copy.STATION_EMBED;
  const glass = el('input', { type: 'radio', name: 'embedding-mode', id: 'mode-glass', value: 'glass', checked: state.embeddingMode === 'glass' });
  const black = el('input', { type: 'radio', name: 'embedding-mode', id: 'mode-black', value: 'black', checked: state.embeddingMode === 'black', disabled: true, title: copy.UI.notBuilt });
  glass.addEventListener('change', () => { if (glass.checked) app.setEmbeddingMode('glass'); });
  black.addEventListener('change', () => { if (black.checked) app.setEmbeddingMode('black'); });
  return el('fieldset', { class: 'mode-toggle' }, [
    el('legend', { text: text.modeLabel }),
    el('label', { class: 'mode-toggle__option', for: 'mode-glass' }, [
      glass,
      el('span', { class: 'mode-toggle__name', text: text.modeGlass }),
      el('span', { class: 'mode-toggle__help', text: text.modeGlassHelp }),
    ]),
    el('label', { class: 'mode-toggle__option is-disabled', for: 'mode-black' }, [
      black,
      el('span', { class: 'mode-toggle__name', text: text.modeBlack }),
      el('span', { class: 'mode-toggle__help', text: text.modeBlackHelp + ' ' + copy.UI.notBuiltParenthetical }),
    ]),
  ]);
}

function preview(chunkText, length = PREVIEW_LENGTH) {
  const flat = chunkText.replace(/\s+/g, ' ').trim();
  return flat.length > length ? `${flat.slice(0, length)}…` : flat;
}
