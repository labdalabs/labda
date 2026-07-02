'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useKnowledgeCanvas } from '@/lib/knowledge/store';
import type {
  KnowledgeNode,
  OkfNodeType,
  OkfPredicate,
} from '@/lib/knowledge/types';

// Node colors come from the design tokens in global.css (--node-*) so the
// scene, the legend, and the DOM dots share one source of truth. Fallbacks
// mirror the token values for non-DOM contexts (tests).
const NODE_TOKEN: Record<OkfNodeType, { varName: string; fallback: string }> = {
  Project: { varName: '--node-project', fallback: '#4a95cc' },
  Hypothesis: { varName: '--node-hypothesis', fallback: '#8b5cf6' },
  Protocol: { varName: '--node-protocol', fallback: '#10b981' },
  Reference: { varName: '--node-reference', fallback: '#f59e0b' },
  Notebook: { varName: '--node-notebook', fallback: '#14b8a6' },
  Analysis: { varName: '--node-analysis', fallback: '#f43f5e' },
  Thesis: { varName: '--node-thesis', fallback: '#6366f1' },
};

// Edge accents per predicate — soft enough to sit on the sky gradient,
// distinct enough to read the relation type at a glance.
const EDGE_STYLE: Record<
  OkfPredicate,
  { color: string; opacity: number; dashed?: boolean }
> = {
  contains: { color: '#ffffff', opacity: 0.5 },
  cites: { color: '#2e6da4', opacity: 0.55 },
  supports: { color: '#10b981', opacity: 0.75 },
  contradicts: { color: '#ef4444', opacity: 0.75 },
  records: { color: '#14b8a6', opacity: 0.6 },
  analyzes: { color: '#f43f5e', opacity: 0.6 },
  linked: { color: '#8b5cf6', opacity: 0.75, dashed: true },
};

// A geometric glyph per node type, drawn in the disc so a node reads at a
// glance without leaning on color alone. Chosen from widely-supported symbols.
const NODE_GLYPH: Record<OkfNodeType, string> = {
  Project: '◆',
  Hypothesis: '?',
  Protocol: '⬡',
  Reference: '❝',
  Notebook: '▤',
  Analysis: '▲',
  Thesis: '¶',
};

const LABEL_FONT =
  '"Avenir Next", "Avenir Next LT Pro", Avenir, "Nunito Sans", system-ui, sans-serif';
const NODE_RADIUS = 0.62;
const ROOT_RADIUS = 0.9;

// Rich card size in world units (drawn to a canvas texture). When zoomed out
// the card cross-fades to the dot so the whole graph reads at a glance.
const CARD_W = 5.0;
const CARD_H = 2.6;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function truncate(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s}…`;
}

// A short subtitle from a node's attributes (mirrors the DOM panel's nodeMeta).
function cardMeta(node: KnowledgeNode): string {
  try {
    const a = JSON.parse(node.attributes) as Record<string, unknown>;
    if (node.type === 'Reference' && typeof a.url === 'string') return a.url;
    if (node.type === 'Notebook' && typeof a.cells === 'number')
      return `${a.cells} cells`;
    if (node.type === 'Protocol' && typeof a.version === 'number')
      return `v${a.version}`;
    if (node.type === 'Project' && typeof a.description === 'string')
      return a.description;
  } catch {
    /* fall through */
  }
  return node.type;
}

// Draw a node as a clean white card: type glyph chip, title, subtitle, and a
// colored status row. Returns a texture sized CARD_W×CARD_H's aspect.
function makeCardTexture(
  node: KnowledgeNode,
  color: string,
  glyph: string,
  selected: boolean,
): THREE.CanvasTexture {
  const dpr = 2;
  const W = 500;
  const H = 260;
  const canvas = document.createElement('canvas');
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.scale(dpr, dpr);

  const pad = 26;
  const radius = 22;
  const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // Card body.
  const inset = 6;
  roundRect(inset, inset, W - inset * 2, H - inset * 2, radius);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = selected ? 3 : 1.5;
  ctx.strokeStyle = selected ? color : '#e7e5e4';
  ctx.stroke();

  // Glyph chip.
  const chip = 54;
  roundRect(pad, pad, chip, chip, 14);
  ctx.fillStyle = withAlpha(color, 0.12);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = `600 ${chip * 0.52}px ${LABEL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, pad + chip / 2, pad + chip / 2 + 1);

  const textX = pad + chip + 18;
  const textMax = W - textX - pad;

  // Title.
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1c1917';
  ctx.font = `600 28px ${LABEL_FONT}`;
  ctx.fillText(truncate(ctx, node.label, textMax), textX, pad + 20);

  // Subtitle.
  ctx.fillStyle = '#78716c';
  ctx.font = `400 19px ${LABEL_FONT}`;
  ctx.fillText(truncate(ctx, cardMeta(node), textMax), textX, pad + 48);

  // Status row.
  const sy = H - pad - 6;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(pad + 6, sy, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#57534e';
  ctx.font = `500 18px ${LABEL_FONT}`;
  ctx.fillText(node.type, pad + 20, sy + 1);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function nodeColor(type: OkfNodeType): string {
  const { varName, fallback } = NODE_TOKEN[type] ?? NODE_TOKEN.Project;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return value || fallback;
}

// Soft radial glow texture for node halos.
function makeGlowTexture(color: string): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  g.addColorStop(0, color);
  g.addColorStop(0.35, color);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Crisp white label with a soft shadow, rendered to a sprite texture.
function makeLabelTexture(text: string): {
  tex: THREE.CanvasTexture;
  aspect: number;
} {
  const label = text.length > 26 ? `${text.slice(0, 25)}…` : text;
  const dpr = 2;
  const fontPx = 26;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return { tex: new THREE.CanvasTexture(canvas), aspect: 4 };
  ctx.font = `600 ${fontPx}px ${LABEL_FONT}`;
  const metrics = ctx.measureText(label);
  const pad = 8;
  const w = Math.ceil(metrics.width) + pad * 2;
  const h = fontPx + pad * 2;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.font = `600 ${fontPx}px ${LABEL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(21, 40, 60, 0.55)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, aspect: w / h };
}

// A crisp type glyph in the node's color, centered on a transparent square.
function makeGlyphTexture(glyph: string, color: string): THREE.CanvasTexture {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.font = `600 ${size * 0.6}px ${LABEL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(glyph, size / 2, size / 2 + size * 0.03);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// three.js rendering of the knowledge graph. Purely visual — it subscribes to
// the same zustand store the DOM overlay drives, so the two stay in sync
// (three.js ↔ React via the store). Clicking a node in the scene reports up
// through onNodeClick (select / link picking); hover glows in-scene. Guarded
// so a WebGL-less environment (e.g. some CI) degrades to just the overlay
// without crashing.
export interface GraphControls {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}

export function GraphScene({
  onNodeClick,
  onSelectionMove,
  onControls,
}: {
  onNodeClick?: (node: KnowledgeNode) => void;
  // Reports the selected node's screen position (container px) each frame so an
  // overlay panel can anchor to it and track pan/zoom — null when nothing is
  // selected or it scrolls off-frame.
  onSelectionMove?: (pos: { x: number; y: number } | null) => void;
  // Hands the parent zoom/fit controls for an on-canvas control cluster.
  onControls?: (controls: GraphControls | null) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const clickRef = useRef(onNodeClick);
  clickRef.current = onNodeClick;
  const moveRef = useRef(onSelectionMove);
  moveRef.current = onSelectionMove;
  const controlsRef = useRef(onControls);
  controlsRef.current = onControls;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // no WebGL — the DOM overlay remains fully functional
    }

    let width = mount.clientWidth || 640;
    let height = mount.clientHeight || 420;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-10, 10, 7.5, -7.5, 0.1, 100);
    camera.position.z = 10;

    const group = new THREE.Group();
    scene.add(group);

    // Per-rebuild bookkeeping for interaction, animation, and disposal.
    let pickables: THREE.Mesh[] = [];
    // Level-of-detail: each node carries a rich card and a dot; the animate
    // loop cross-fades between them by on-screen card size.
    let lodNodes: {
      id: string;
      phase: number;
      card: THREE.Sprite;
      cardMat: THREE.SpriteMaterial;
      halo: THREE.Sprite;
      haloBase: number;
      haloMat: THREE.SpriteMaterial;
      label: THREE.Sprite;
      labelMat: THREE.SpriteMaterial;
      dotMats: { mat: THREE.Material; base: number }[];
      dotObjs: THREE.Object3D[];
    }[] = [];
    let disposables: { dispose: () => void }[] = [];
    let hoveredId: string | null = null;

    // Frame the whole layout with padding; keep the container's aspect.
    const fitFrustum = () => {
      const { positions } = useKnowledgeCanvas.getState();
      const pts = Object.values(positions);
      const pad = 3.2;
      let minX = -6, maxX = 6, minY = -5, maxY = 5;
      if (pts.length) {
        minX = Math.min(...pts.map((p) => p.x)) - pad;
        maxX = Math.max(...pts.map((p) => p.x)) + pad;
        minY = Math.min(...pts.map((p) => p.y)) - pad;
        maxY = Math.max(...pts.map((p) => p.y)) + pad;
      }
      const aspect = width / height;
      let halfW = (maxX - minX) / 2;
      let halfH = (maxY - minY) / 2;
      if (halfW / halfH > aspect) halfH = halfW / aspect;
      else halfW = halfH * aspect;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      camera.left = cx - halfW;
      camera.right = cx + halfW;
      camera.top = cy + halfH;
      camera.bottom = cy - halfH;
      camera.updateProjectionMatrix();
    };

    // Damped zoom + 1:1 pan.
    let zoom = 1;
    let targetZoom = 1;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetZoom = Math.min(4, Math.max(0.3, targetZoom * (e.deltaY > 0 ? 0.9 : 1.1)));
    };
    let dragging = false;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      moved = 0;
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pick = (e: PointerEvent): KnowledgeNode | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickables, false)[0];
      return (hit?.object.userData['node'] as KnowledgeNode) ?? null;
    };

    const applyHover = (id: string | null) => {
      if (id === hoveredId) return;
      hoveredId = id;
      renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
      useKnowledgeCanvas.getState().hover(id);
    };

    const onMove = (e: PointerEvent) => {
      if (dragging) {
        const frustumW = (camera.right - camera.left) / zoom;
        const frustumH = (camera.top - camera.bottom) / zoom;
        camera.position.x -= ((e.clientX - lastX) / width) * frustumW;
        camera.position.y += ((e.clientY - lastY) / height) * frustumH;
        moved += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
        lastX = e.clientX;
        lastY = e.clientY;
        return;
      }
      applyHover(pick(e)?.id ?? null);
    };
    const onUp = (e: PointerEvent) => {
      const wasDrag = dragging && moved > 5;
      dragging = false;
      if (wasDrag || e.target !== renderer.domElement) return;
      const node = pick(e);
      if (node) clickRef.current?.(node);
    };
    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    // Hand zoom/fit controls up for the on-canvas control cluster.
    const zoomBy = (f: number) => {
      targetZoom = Math.min(4, Math.max(0.3, targetZoom * f));
    };
    controlsRef.current?.({
      zoomIn: () => zoomBy(1.2),
      zoomOut: () => zoomBy(1 / 1.2),
      reset: () => {
        camera.position.x = 0;
        camera.position.y = 0;
        targetZoom = 1;
        fitFrustum();
      },
    });

    const rebuild = () => {
      group.clear();
      for (const d of disposables) d.dispose();
      disposables = [];
      pickables = [];
      lodNodes = [];

      const { graph, positions, selectedId, linkFromId } =
        useKnowledgeCanvas.getState();
      if (!graph) return;
      fitFrustum();

      const track = <T extends { dispose: () => void }>(d: T): T => {
        disposables.push(d);
        return d;
      };

      // ── Edges: gentle quadratic curves, colored by predicate ──
      const posOf = (id: string) =>
        positions[id] ? new THREE.Vector3(positions[id].x, positions[id].y, 0) : null;
      for (const e of graph.edges) {
        const a = posOf(e.from);
        const b = posOf(e.to);
        if (!a || !b) continue;
        const style = EDGE_STYLE[e.predicate] ?? EDGE_STYLE.contains;
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const dir = b.clone().sub(a);
        const normal = new THREE.Vector3(-dir.y, dir.x, 0).normalize();
        // Deterministic bow direction so parallel edges fan apart.
        const sign = e.from < e.to ? 1 : -1;
        mid.add(normal.multiplyScalar(sign * dir.length() * 0.12));
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const geo = track(
          new THREE.BufferGeometry().setFromPoints(curve.getPoints(32)),
        );
        const mat = track(
          style.dashed
            ? new THREE.LineDashedMaterial({
                color: style.color,
                transparent: true,
                opacity: style.opacity,
                dashSize: 0.35,
                gapSize: 0.22,
              })
            : new THREE.LineBasicMaterial({
                color: style.color,
                transparent: true,
                opacity: style.opacity,
              }),
        );
        const line = new THREE.Line(geo, mat);
        if (style.dashed) line.computeLineDistances();
        group.add(line);
      }

      // ── Nodes: a rich card up close, a labelled dot when zoomed out ──
      graph.nodes.forEach((n, i) => {
        const p = positions[n.id];
        if (!p) return;
        const isRoot = n.id === graph.rootId;
        const isSel = n.id === selectedId;
        const isLinkFrom = n.id === linkFromId;
        const active = isSel || isLinkFrom;
        const r = isRoot ? ROOT_RADIUS : NODE_RADIUS;
        const color = nodeColor(n.type);
        const node = new THREE.Group();
        node.position.set(p.x, p.y, 1);

        const dotMats: { mat: THREE.Material; base: number }[] = [];
        const dotObjs: THREE.Object3D[] = [];
        const addDot = (obj: THREE.Object3D, mat: THREE.Material, base: number) => {
          dotObjs.push(obj);
          dotMats.push({ mat, base });
          node.add(obj);
        };

        // Halo — soft glow behind the dot (fades with the dot).
        const glow = track(makeGlowTexture(color));
        const haloMat = track(
          new THREE.SpriteMaterial({
            map: glow,
            transparent: true,
            opacity: active ? 0.5 : 0.26,
            depthWrite: false,
          }),
        );
        const halo = new THREE.Sprite(haloMat);
        const haloBase = r * (active ? 4.4 : 3.0);
        halo.scale.setScalar(haloBase);
        halo.position.z = -0.2;
        node.add(halo);

        // Disc — near-white glass.
        const discMat = track(
          new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.94 }),
        );
        const disc = new THREE.Mesh(track(new THREE.CircleGeometry(r, 48)), discMat);
        addDot(disc, discMat, 0.94);

        // Rim — the node's type color.
        const rimMat = track(
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: isSel ? 1 : 0.9 }),
        );
        const rim = new THREE.Mesh(track(new THREE.RingGeometry(r, r * 1.22, 48)), rimMat);
        rim.position.z = 0.05;
        addDot(rim, rimMat, isSel ? 1 : 0.9);

        // Glyph — the type mark, centered in the disc.
        const glyphMat = track(
          new THREE.SpriteMaterial({
            map: track(makeGlyphTexture(NODE_GLYPH[n.type] ?? '•', color)),
            transparent: true,
            depthWrite: false,
            opacity: 0.92,
          }),
        );
        const glyph = new THREE.Sprite(glyphMat);
        glyph.scale.setScalar(r * 1.1);
        glyph.position.z = 0.1;
        addDot(glyph, glyphMat, 0.92);

        if (active) {
          const selMat = track(
            new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }),
          );
          const sel = new THREE.Mesh(track(new THREE.RingGeometry(r * 1.38, r * 1.46, 48)), selMat);
          sel.position.z = 0.05;
          addDot(sel, selMat, 0.9);
        }

        // Dot-mode label — beneath the disc. Fades out early (before the card
        // appears) so the two never overlap; tracked separately from the dot.
        const { tex, aspect } = makeLabelTexture(n.label);
        track(tex);
        const labelMat = track(
          new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
        );
        const label = new THREE.Sprite(labelMat);
        const labelH = 1.05;
        label.scale.set(labelH * aspect, labelH, 1);
        label.position.set(0, -(r + 0.85), 0.1);
        node.add(label);

        // Rich card — shown when zoomed in.
        const cardTex = track(makeCardTexture(n, color, NODE_GLYPH[n.type] ?? '•', active));
        const cardMat = track(
          new THREE.SpriteMaterial({ map: cardTex, transparent: true, opacity: 0, depthWrite: false }),
        );
        const card = new THREE.Sprite(cardMat);
        card.scale.set(CARD_W, CARD_H, 1);
        card.position.z = 0.15;
        card.visible = false;
        node.add(card);

        // Invisible pick plane covering the card (works in both LOD modes).
        const pickMat = track(
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, colorWrite: false, depthWrite: false }),
        );
        const pick = new THREE.Mesh(track(new THREE.PlaneGeometry(CARD_W, CARD_H)), pickMat);
        pick.position.z = 0.2;
        pick.userData['node'] = n;
        node.add(pick);
        pickables.push(pick);

        lodNodes.push({
          id: n.id,
          phase: i * 0.7,
          card,
          cardMat,
          halo,
          haloBase,
          haloMat,
          label,
          labelMat,
          dotMats,
          dotObjs,
        });

        group.add(node);
      });
    };

    rebuild();
    // Rebuild only on structural/selection changes; hover animates in-place.
    let prev = useKnowledgeCanvas.getState();
    const unsub = useKnowledgeCanvas.subscribe((state) => {
      const structural =
        state.graph !== prev.graph ||
        state.positions !== prev.positions ||
        state.selectedId !== prev.selectedId ||
        state.linkFromId !== prev.linkFromId;
      prev = state;
      if (structural) rebuild();
    });

    const resize = new ResizeObserver(() => {
      width = mount.clientWidth || width;
      height = mount.clientHeight || height;
      renderer.setSize(width, height);
      fitFrustum();
    });
    resize.observe(mount);

    let raf = 0;
    const start = performance.now();
    const projected = new THREE.Vector3();
    let lastSel = '';
    const animate = () => {
      const t = (performance.now() - start) / 1000;
      zoom += (targetZoom - zoom) * 0.12;
      camera.zoom = zoom;
      camera.updateProjectionMatrix();

      // Level-of-detail: fade cards in as their on-screen size grows, dots out.
      const pxPerUnit = (height / (camera.top - camera.bottom)) * camera.zoom;
      const cardPx = CARD_H * pxPerUnit;
      const cardT = smoothstep(72, 132, cardPx); // 0 = dot, 1 = card
      const dotT = 1 - cardT;
      // Labels fade out earlier than the disc so they never ghost over a card.
      const labelT = 1 - smoothstep(34, 74, cardPx);
      for (const nd of lodNodes) {
        nd.cardMat.opacity = cardT * 0.99;
        nd.card.visible = cardT > 0.02;
        for (const d of nd.dotObjs) d.visible = dotT > 0.02;
        for (const { mat, base } of nd.dotMats) mat.opacity = base * dotT;
        nd.label.visible = labelT > 0.02;
        nd.labelMat.opacity = labelT;
        const hovered = nd.id === hoveredId;
        const breath = 1 + 0.05 * Math.sin(t * 1.6 + nd.phase);
        nd.halo.scale.setScalar(nd.haloBase * breath * (hovered ? 1.25 : 1));
        nd.halo.visible = dotT > 0.02;
        nd.haloMat.opacity = (nd.id === hoveredId ? 0.5 : 0.26) * dotT;
      }
      renderer.render(scene, camera);

      // Anchor the inline panel to the selected node (screen px).
      const { selectedId: sel, positions: pos } = useKnowledgeCanvas.getState();
      const p = sel ? pos[sel] : null;
      if (p) {
        projected.set(p.x, p.y, 0).project(camera);
        const x = (projected.x * 0.5 + 0.5) * width;
        const y = (-projected.y * 0.5 + 0.5) * height;
        // Offset above the card (or dot) so the panel clears it.
        const halfH = (cardT > 0.5 ? CARD_H / 2 : NODE_RADIUS) * pxPerUnit;
        moveRef.current?.({ x, y: y - halfH });
        lastSel = sel as string;
      } else if (lastSel) {
        lastSel = '';
        moveRef.current?.(null);
      }
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      unsub();
      controlsRef.current?.(null);
      resize.disconnect();
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      for (const d of disposables) d.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0" data-testid="graph-scene" />;
}
