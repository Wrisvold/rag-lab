// Flow mode: the canvas. A pannable, zoomable surface with node cards in an
// HTML layer over an SVG layer of wires. Handles every pointer and keyboard
// interaction; the graph itself is changed only through graph.js.
//
// Coordinates: "world" pixels are node positions at 100% zoom. The world
// element is translated by the pan and scaled by the zoom; everything in it
// is positioned in world pixels. Screen -> world: subtract the pan, divide
// by the zoom.
//
// Keyboard: every node and port is in the tab order. Arrow keys move the
// focused node; Delete removes it. Enter on an output port starts a wire;
// Tab then reaches every input port (matching ones are highlighted), Enter
// on one either wires it or reads out why not; Escape cancels. Delete on a
// wired input, or on the small handle in the middle of a wire, removes it.

import { el, fill } from '../dom.js';
import { nodeType } from './registry.js';
import { addNode, removeNode, connect, canConnect, disconnect, moveNode, inputEdge, isStale } from './graph.js';
import { explainRefusal } from './explain.js';
import { buildNode, updateChrome } from './nodes.js';

const SVG = 'http://www.w3.org/2000/svg';

/**
 * @param app  { graph, copy, constants, busy, readout(text), graphChanged(), paramChanged(id), runNode(id),
 *               select(id), loadSample(id), onViewChange(view) }
 * @param els  { canvas, world, edges, nodes, handles }
 */
export function mountCanvas(app, els) {
  const { canvas, world, edges: edgeLayer, nodes: nodeLayer, handles: handleLayer } = els;
  const C = app.constants;
  const F = app.copy.FLOW;

  const view = { zoom: 1, pan: { x: 0, y: 0 } };
  const articles = new Map();  // nodeId -> article
  let wiring = null;           // { from: { node, port }, mode: 'drag' | 'sticky', origin: button, temp: path, hover: button|null }
  let selected = null;

  const hooks = {
    onParam: (id) => app.paramChanged(id),
    onRun: (id) => app.runNode(id),
    onRemove: (id) => api.removeNode(id),
    loadSample: (id) => app.loadSample(id),
  };

  // -------------------------------------------------------------------------
  // View
  // -------------------------------------------------------------------------
  function applyView(live = false) {
    view.zoom = clamp(view.zoom, C.FLOW_ZOOM_MIN, C.FLOW_ZOOM_MAX);
    world.classList.toggle('is-live', live);
    world.style.transform = `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})`;
    if (app.onViewChange) app.onViewChange({ zoom: view.zoom, pan: { ...view.pan } });
  }

  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return { x: (clientX - rect.left - view.pan.x) / view.zoom, y: (clientY - rect.top - view.pan.y) / view.zoom };
  }

  function zoomAt(clientX, clientY, factor) {
    const rect = canvas.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const next = clamp(view.zoom * factor, C.FLOW_ZOOM_MIN, C.FLOW_ZOOM_MAX);
    const ratio = next / view.zoom;
    view.pan.x = cx - (cx - view.pan.x) * ratio;
    view.pan.y = cy - (cy - view.pan.y) * ratio;
    view.zoom = next;
    applyView();
  }

  function zoomBy(factor) {
    const rect = canvas.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  }

  function fit() {
    const nodes = [...app.graph.nodes.values()];
    if (!nodes.length) { view.zoom = 1; view.pan = { x: 0, y: 0 }; applyView(); return; }
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const node of nodes) {
      const article = articles.get(node.id);
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + (article ? article.offsetWidth : C.FLOW_NODE_WIDTH));
      maxY = Math.max(maxY, node.position.y + (article ? article.offsetHeight : C.FLOW_NODE_WIDTH));
    }
    const pad = C.FLOW_CANVAS_PADDING;
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const zoom = clamp(Math.min((canvas.clientWidth - 2 * pad) / width, (canvas.clientHeight - 2 * pad) / height), C.FLOW_ZOOM_MIN, 1);
    view.zoom = zoom;
    view.pan = {
      x: (canvas.clientWidth - width * zoom) / 2 - minX * zoom,
      y: (canvas.clientHeight - height * zoom) / 2 - minY * zoom,
    };
    applyView();
  }

  function setView(next) {
    if (!next) return;
    view.zoom = clamp(Number(next.zoom) || 1, C.FLOW_ZOOM_MIN, C.FLOW_ZOOM_MAX);
    view.pan = { x: Number(next.pan && next.pan.x) || 0, y: Number(next.pan && next.pan.y) || 0 };
    applyView();
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------
  function renderAll() {
    stopWiring();
    nodeLayer.replaceChildren();
    articles.clear();
    for (const node of app.graph.nodes.values()) mountArticle(node);
    refresh();
  }

  function mountArticle(node) {
    const article = buildNode(node, app, hooks);
    articles.set(node.id, article);
    nodeLayer.append(article);
    attachNodeBehaviour(article, node.id);
    return article;
  }

  /** Update every card's chrome and redraw the wires. Cheap; safe to call often. */
  function refresh() {
    for (const [id, article] of articles) {
      const node = app.graph.nodes.get(id);
      if (node) updateChrome(article, node, app);
    }
    drawEdges();
  }

  function updateOne(id) {
    const article = articles.get(id);
    const node = app.graph.nodes.get(id);
    if (article && node) updateChrome(article, node, app);
  }

  function portButton(nodeId, side, portId) {
    const article = articles.get(nodeId);
    return article ? article.querySelector(`.flow-port[data-side="${side}"][data-port="${portId}"]`) : null;
  }

  function portCentre(button) {
    const rect = button.getBoundingClientRect();
    const origin = world.getBoundingClientRect();
    return { x: (rect.left + rect.width / 2 - origin.left) / view.zoom, y: (rect.top + rect.height / 2 - origin.top) / view.zoom };
  }

  function curve(a, b) {
    const dx = Math.max(40, Math.abs(b.x - a.x) / 2);
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  }

  function curveMidpoint(a, b) {
    const dx = Math.max(40, Math.abs(b.x - a.x) / 2);
    // A cubic Bézier at t = 0.5: (P0 + 3 P1 + 3 P2 + P3) / 8
    return { x: (a.x + 3 * (a.x + dx) + 3 * (b.x - dx) + b.x) / 8, y: (a.y + 3 * a.y + 3 * b.y + b.y) / 8 };
  }

  function drawEdges() {
    const temp = wiring ? wiring.temp : null;
    edgeLayer.replaceChildren();
    handleLayer.replaceChildren();
    for (const edge of app.graph.edges.values()) {
      const from = portButton(edge.from.node, 'out', edge.from.port);
      const to = portButton(edge.to.node, 'in', edge.to.port);
      if (!from || !to) continue;
      const a = portCentre(from);
      const b = portCentre(to);
      const target = app.graph.nodes.get(edge.to.node);
      const path = document.createElementNS(SVG, 'path');
      path.setAttribute('d', curve(a, b));
      path.setAttribute('class', `flow-edge${target && target.artifact && isStale(app.graph, target.id) ? ' is-stale' : ''}`);
      edgeLayer.append(path);

      const mid = curveMidpoint(a, b);
      const fromLabel = F.nodes[app.graph.nodes.get(edge.from.node).type].label;
      const toLabel = F.nodes[target.type].label;
      const handle = el('button', {
        type: 'button', class: 'flow-handle', text: '×',
        'data-edge': edge.id,
        'aria-label': fill(F.node.removeWire, { from: fromLabel, to: toLabel }),
        onclick: () => removeEdge(edge.id),
      });
      handle.style.left = `${mid.x}px`;
      handle.style.top = `${mid.y}px`;
      handleLayer.append(handle);
    }
    if (temp) edgeLayer.append(temp);
  }

  // -------------------------------------------------------------------------
  // Nodes: add, remove, select, drag, keyboard
  // -------------------------------------------------------------------------
  function freeSpot() {
    const rect = canvas.getBoundingClientRect();
    const centre = toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const spot = snap({ x: centre.x - C.FLOW_NODE_WIDTH / 2, y: centre.y - 80 });
    const taken = (p) => [...app.graph.nodes.values()].some((n) => Math.abs(n.position.x - p.x) < C.FLOW_GRID_STEP && Math.abs(n.position.y - p.y) < C.FLOW_GRID_STEP);
    while (taken(spot)) { spot.x += 2 * C.FLOW_GRID_STEP; spot.y += 2 * C.FLOW_GRID_STEP; }
    return spot;
  }

  function addNodeOfType(type) {
    stopWiring();
    const node = addNode(app.graph, type, { position: freeSpot() });
    const article = mountArticle(node);
    refresh();
    app.graphChanged();
    app.readout(fill(F.readout.added, { node: F.nodes[type].label }));
    article.focus({ preventScroll: true });
    return node;
  }

  function removeNodeById(id) {
    const node = app.graph.nodes.get(id);
    if (!node) return;
    stopWiring();
    const label = F.nodes[node.type].label;
    const article = articles.get(id);
    const neighbour = article && (article.nextElementSibling || article.previousElementSibling);
    removeNode(app.graph, id);
    if (article) article.remove();
    articles.delete(id);
    if (selected === id) select(null);
    refresh();
    app.graphChanged();
    app.readout(fill(F.readout.removed, { node: label }));
    (neighbour || canvas).focus({ preventScroll: true });
  }

  function removeEdge(edgeId) {
    const edge = app.graph.edges.get(edgeId);
    if (!edge) return;
    const fromLabel = F.nodes[app.graph.nodes.get(edge.from.node).type].label;
    const toLabel = F.nodes[app.graph.nodes.get(edge.to.node).type].label;
    const input = portButton(edge.to.node, 'in', edge.to.port);
    disconnect(app.graph, edgeId);
    refresh();
    app.graphChanged();
    app.readout(fill(F.readout.wireRemoved, { from: fromLabel, to: toLabel }));
    if (input) input.focus({ preventScroll: true });
  }

  function select(id) {
    selected = id;
    for (const [nodeId, article] of articles) article.classList.toggle('is-selected', nodeId === id);
    app.select(id);
  }

  function snap(position) {
    const g = C.FLOW_GRID_STEP;
    return { x: Math.round(position.x / g) * g, y: Math.round(position.y / g) * g };
  }

  function place(article, node, position) {
    node.position = position;
    article.style.left = `${position.x}px`;
    article.style.top = `${position.y}px`;
  }

  function attachNodeBehaviour(article, id) {
    const head = article.querySelector('.flow-node__head');

    article.addEventListener('focusin', () => select(id));
    // Clicking anywhere on a card except an input port ends a click-started wire.
    article.addEventListener('pointerdown', (event) => {
      if (wiring && wiring.mode === 'sticky' && !event.target.closest('.flow-port--in')) cancelWiring();
    }, true);

    // Drag by the title bar.
    head.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('button')) return;
      event.preventDefault();
      const node = app.graph.nodes.get(id);
      const start = { x: event.clientX, y: event.clientY, nx: node.position.x, ny: node.position.y };
      head.setPointerCapture(event.pointerId);
      article.classList.add('is-dragging');
      article.focus({ preventScroll: true });
      const move = (ev) => {
        place(article, node, { x: start.nx + (ev.clientX - start.x) / view.zoom, y: start.ny + (ev.clientY - start.y) / view.zoom });
        drawEdges();
      };
      const up = () => {
        head.removeEventListener('pointermove', move);
        head.removeEventListener('pointerup', up);
        head.removeEventListener('pointercancel', up);
        article.classList.remove('is-dragging');
        place(article, node, snap(node.position));
        moveNode(app.graph, id, node.position);
        drawEdges();
        app.graphChanged();
      };
      head.addEventListener('pointermove', move);
      head.addEventListener('pointerup', up);
      head.addEventListener('pointercancel', up);
    });

    // Keyboard on the card itself (not on a control inside it).
    article.addEventListener('keydown', (event) => {
      if (event.target !== article) return;
      const node = app.graph.nodes.get(id);
      const step = C.FLOW_GRID_STEP * (event.shiftKey ? C.FLOW_KEYBOARD_STEP_LARGE : 1);
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[event.key]) {
        event.preventDefault();
        const [dx, dy] = moves[event.key];
        place(article, node, snap({ x: node.position.x + dx, y: node.position.y + dy }));
        moveNode(app.graph, id, node.position);
        drawEdges();
        app.graphChanged();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeNodeById(id);
      }
    });

    for (const button of article.querySelectorAll('.flow-port')) attachPortBehaviour(button);
  }

  // -------------------------------------------------------------------------
  // Wiring
  // -------------------------------------------------------------------------
  function attachPortBehaviour(button) {
    const at = () => ({ node: button.dataset.node, port: button.dataset.port });

    if (button.dataset.side === 'out') {
      button.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        if (wiring) cancelWiring();
        // preventDefault above stops the browser focusing the port; do it by
        // hand so Escape works after a click-started wire.
        button.focus({ preventScroll: true });
        startWiring(at(), 'drag', button);
        button.setPointerCapture(event.pointerId);
        const origin = { x: event.clientX, y: event.clientY };
        let moved = false;
        const move = (ev) => {
          if (Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) > 4) moved = true;
          updateTemp(toWorld(ev.clientX, ev.clientY));
          setHover(inputPortAt(ev.clientX, ev.clientY));
        };
        const up = (ev) => {
          button.removeEventListener('pointermove', move);
          button.removeEventListener('pointerup', up);
          button.removeEventListener('pointercancel', up);
          if (!wiring) return;
          if (!moved) {
            // A click, not a drag: stay in wiring mode until the next click.
            wiring.mode = 'sticky';
            if (wiring.temp) { wiring.temp.remove(); wiring.temp = null; }
            app.readout(fill(F.readout.wiringPointer, { node: labelOf(at().node) }));
            return;
          }
          const target = inputPortAt(ev.clientX, ev.clientY);
          if (target) finishWiring(target); else cancelWiring();
        };
        button.addEventListener('pointermove', move);
        button.addEventListener('pointerup', up);
        button.addEventListener('pointercancel', up);
      });
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        if (wiring) cancelWiring();
        startWiring(at(), 'keyboard', button);
      });
    } else {
      button.addEventListener('click', () => {
        if (wiring) finishWiring(button);
      });
      button.addEventListener('keydown', (event) => {
        if ((event.key === 'Enter' || event.key === ' ') && wiring) {
          event.preventDefault();
          finishWiring(button);
        } else if (event.key === 'Delete' || event.key === 'Backspace') {
          const edge = inputEdge(app.graph, button.dataset.node, button.dataset.port);
          if (edge) { event.preventDefault(); removeEdge(edge.id); }
        }
      });
    }
  }

  function labelOf(nodeId) {
    const node = app.graph.nodes.get(nodeId);
    return node ? F.nodes[node.type].label : '';
  }

  function startWiring(from, mode, origin) {
    wiring = { from, mode, origin, temp: null, hover: null };
    canvas.classList.add('is-wiring');
    origin.classList.add('is-origin');
    const candidates = [];
    for (const input of canvas.querySelectorAll('.flow-port--in')) {
      const ok = canConnect(app.graph, from, { node: input.dataset.node, port: input.dataset.port }).ok;
      input.classList.toggle('is-candidate', ok);
      if (ok) candidates.push(input);
    }
    if (mode === 'keyboard') {
      if (candidates.length) {
        app.readout(fill(F.readout.wiringKeyboard, { node: labelOf(from.node) }));
        candidates[0].focus({ preventScroll: true });
      } else {
        app.readout(fill(F.readout.wiringNoTargets, { port: F.portNames[origin.dataset.type] }));
      }
    } else if (mode === 'drag') {
      wiring.temp = document.createElementNS(SVG, 'path');
      wiring.temp.setAttribute('class', 'flow-edge flow-edge--temp');
      edgeLayer.append(wiring.temp);
      updateTemp(portCentre(origin));
    }
  }

  function updateTemp(point) {
    if (!wiring || !wiring.temp) return;
    wiring.temp.setAttribute('d', curve(portCentre(wiring.origin), point));
  }

  function inputPortAt(clientX, clientY) {
    const element = document.elementFromPoint(clientX, clientY);
    return element ? element.closest('.flow-port--in') : null;
  }

  function setHover(target) {
    if (!wiring) return;
    if (wiring.hover && wiring.hover !== target) wiring.hover.classList.remove('is-ok', 'is-refused');
    wiring.hover = target;
    if (!target) return;
    const ok = canConnect(app.graph, wiring.from, { node: target.dataset.node, port: target.dataset.port }).ok;
    target.classList.toggle('is-ok', ok);
    target.classList.toggle('is-refused', !ok);
  }

  function finishWiring(target) {
    if (!wiring) return;
    const to = { node: target.dataset.node, port: target.dataset.port };
    const result = connect(app.graph, wiring.from, to);
    const fromLabel = labelOf(wiring.from.node);
    if (result.ok) {
      const mode = wiring.mode;
      stopWiring();
      refresh();
      app.graphChanged();
      app.readout(fill(F.readout.wired, { from: fromLabel, to: labelOf(to.node) }));
      if (mode !== 'drag') target.focus({ preventScroll: true });
      return;
    }
    app.readout(explainRefusal(result));
    target.classList.add('is-refused');
    setTimeout(() => target.classList.remove('is-refused'), 1200);
    if (wiring.mode === 'drag') stopWiring();
    // In sticky and keyboard modes the wire stays live: the student can try another input or press Escape.
  }

  function cancelWiring() {
    if (!wiring) return;
    const origin = wiring.origin;
    stopWiring();
    app.readout(F.readout.wireCancelled);
    if (origin.isConnected) origin.focus({ preventScroll: true });
  }

  function stopWiring() {
    if (!wiring) return;
    if (wiring.temp) wiring.temp.remove();
    if (wiring.hover) wiring.hover.classList.remove('is-ok', 'is-refused');
    wiring.origin.classList.remove('is-origin');
    for (const input of canvas.querySelectorAll('.flow-port--in')) input.classList.remove('is-candidate');
    canvas.classList.remove('is-wiring');
    wiring = null;
  }

  // -------------------------------------------------------------------------
  // Canvas-level events: pan, zoom, Escape, losing focus mid-wire
  // -------------------------------------------------------------------------
  canvas.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.flow-node, .flow-handle')) return;
    if (event.button !== 0 && event.button !== 1) return;
    if (wiring && wiring.mode === 'sticky') cancelWiring();
    event.preventDefault();
    const start = { x: event.clientX, y: event.clientY, px: view.pan.x, py: view.pan.y };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('is-panning');
    const move = (ev) => {
      view.pan = { x: start.px + ev.clientX - start.x, y: start.py + ev.clientY - start.y };
      applyView(true);
    };
    const up = () => {
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.classList.remove('is-panning');
      applyView();
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  });

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
    if (event.ctrlKey || event.metaKey) {
      zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? C.FLOW_ZOOM_STEP : 1 / C.FLOW_ZOOM_STEP);
    } else {
      view.pan.x -= event.deltaX * unit;
      view.pan.y -= event.deltaY * unit;
      applyView(true);
    }
  }, { passive: false });

  canvas.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && wiring) {
      event.preventDefault();
      cancelWiring();
    }
  });

  // Keyboard wiring navigates by focus, so focus leaving the canvas ends it.
  // A click-started wire ends on the next click instead (see pointerdown above).
  canvas.addEventListener('focusout', (event) => {
    if (wiring && wiring.mode === 'keyboard' && !canvas.contains(event.relatedTarget)) stopWiring();
  });

  const api = {
    renderAll,
    refresh,
    updateOne,
    addNode: addNodeOfType,
    removeNode: removeNodeById,
    setRunning(id, running) {
      const article = articles.get(id);
      if (article) article.classList.toggle('is-running', running);
    },
    zoomBy,
    fit,
    setView,
    getView: () => ({ zoom: view.zoom, pan: { ...view.pan } }),
    focusNode(id) {
      const article = articles.get(id);
      if (article) article.focus({ preventScroll: true });
    },
    cancelWiring,
  };
  return api;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
