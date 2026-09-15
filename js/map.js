// The 2D map: an SVG scatter plot of chunk vectors after PCA.
// Used by Station 2 (all chunks) and Station 3 (plus the question and lines
// to its top-k neighbours). The same component in both modes, so a student
// can flip Glass Box / Black Box and watch the points rearrange.

const SVG_NS = 'http://www.w3.org/2000/svg';
const WIDTH = 640;
const HEIGHT = 400;
const PADDING = 36;

function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined) node.setAttribute(key, value);
  }
  return node;
}

/**
 * @param {object} options
 * @param {{ id: number, label: string, x: number, y: number, preview: string }[]} options.points
 * @param {number|null} options.selectedId
 * @param {(id: number) => void} options.onSelect
 * @param {(point: object|null) => void} options.onHover
 * @param {{ x: number, y: number, label: string }|null} [options.question]
 * @param {number[]} [options.neighborIds]   ids of the top-k chunks (lines drawn to them)
 * @param {string} options.ariaLabel
 * @returns {SVGSVGElement}
 */
export function renderMap({ points, selectedId, onSelect, onHover, question = null, neighborIds = [], ariaLabel }) {
  const all = question ? [...points, question] : points;
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const scaleX = makeScale(Math.min(...xs), Math.max(...xs), PADDING, WIDTH - PADDING);
  const scaleY = makeScale(Math.min(...ys), Math.max(...ys), HEIGHT - PADDING, PADDING); // flip so "up" is up

  const root = svg('svg', { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, class: 'map', role: 'group', 'aria-label': ariaLabel });
  root.append(svg('rect', { x: 0, y: 0, width: WIDTH, height: HEIGHT, class: 'map__background' }));

  // Lines from the question to its neighbours go underneath the points.
  if (question) {
    const qx = scaleX(question.x);
    const qy = scaleY(question.y);
    for (const id of neighborIds) {
      const target = points.find((p) => p.id === id);
      if (!target) continue;
      root.append(svg('line', { x1: qx, y1: qy, x2: scaleX(target.x), y2: scaleY(target.y), class: 'map__link' }));
    }
  }

  for (const point of points) {
    const cx = scaleX(point.x);
    const cy = scaleY(point.y);
    const isNeighbor = neighborIds.includes(point.id);
    const group = svg('g', {
      class: `map__point${point.id === selectedId ? ' is-selected' : ''}${isNeighbor ? ' is-neighbor' : ''}`,
      tabindex: '0',
      role: 'button',
      'aria-label': `${point.label}: ${point.preview}`,
      'data-id': point.id,
    });
    const title = svg('title');
    title.textContent = `${point.label}: ${point.preview}`;
    group.append(title);
    group.append(svg('circle', { cx, cy, r: 9 }));
    const text = svg('text', { x: cx, y: cy + 3.5, 'text-anchor': 'middle' });
    text.textContent = point.label.replace(/^Chunk\s+/i, '');
    group.append(text);

    group.addEventListener('click', () => onSelect(point.id));
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(point.id); }
    });
    group.addEventListener('mouseenter', () => onHover(point));
    group.addEventListener('focus', () => onHover(point));
    group.addEventListener('mouseleave', () => onHover(null));
    group.addEventListener('blur', () => onHover(null));
    root.append(group);
  }

  if (question) {
    const qx = scaleX(question.x);
    const qy = scaleY(question.y);
    const group = svg('g', { class: 'map__question', role: 'img', 'aria-label': question.label });
    const title = svg('title');
    title.textContent = question.label;
    group.append(title);
    const size = 11;
    group.append(svg('polygon', { points: `${qx},${qy - size} ${qx + size},${qy} ${qx},${qy + size} ${qx - size},${qy}` }));
    const text = svg('text', { x: qx, y: qy + 3.5, 'text-anchor': 'middle' });
    text.textContent = '?';
    group.append(text);
    root.append(group);
  }

  return root;
}

/** Marks one point as selected without rebuilding the SVG. */
export function updateMapSelection(root, selectedId) {
  for (const group of root.querySelectorAll('.map__point')) {
    group.classList.toggle('is-selected', Number(group.dataset.id) === selectedId);
  }
}

function makeScale(min, max, outMin, outMax) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max - min < 1e-12) {
    const middle = (outMin + outMax) / 2;
    return () => middle;
  }
  return (value) => outMin + ((value - min) / (max - min)) * (outMax - outMin);
}
