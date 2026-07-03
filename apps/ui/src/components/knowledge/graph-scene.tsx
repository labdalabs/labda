'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useKnowledgeCanvas } from '@/lib/knowledge/store';
import type {
  KnowledgeNode,
  OkfNodeType,
  OkfPredicate,
} from '@/lib/knowledge/types';

// Cell colors come from the design tokens in global.css (--node-*) so the
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
  Idea: { varName: '--node-idea', fallback: '#facc15' },
  Observation: { varName: '--node-observation', fallback: '#38bdf8' },
  Conclusion: { varName: '--node-conclusion', fallback: '#a3e635' },
  Knowledge: { varName: '--node-knowledge', fallback: '#d946ef' },
  Data: { varName: '--node-data', fallback: '#22d3ee' },
  Paper: { varName: '--node-paper', fallback: '#fb923c' },
};

// Dendrite (edge) accents per predicate, tuned to glow on the dark field.
// `fires` marks the semantic ties along which an action-potential pulse runs.
const EDGE_STYLE: Record<
  OkfPredicate,
  { color: string; opacity: number; fires: boolean }
> = {
  contains: { color: '#7fb2d8', opacity: 0.32, fires: false },
  cites: { color: '#5b8fc4', opacity: 0.34, fires: false },
  records: { color: '#39c0b0', opacity: 0.38, fires: false },
  analyzes: { color: '#f4718a', opacity: 0.4, fires: false },
  supports: { color: '#34d399', opacity: 0.62, fires: true },
  contradicts: { color: '#f87171', opacity: 0.62, fires: true },
  linked: { color: '#a78bfa', opacity: 0.66, fires: true },
};

const NODE_GLYPH: Record<OkfNodeType, string> = {
  Project: '◆',
  Hypothesis: '?',
  Protocol: '⬡',
  Reference: '❝',
  Notebook: '▤',
  Analysis: '▲',
  Thesis: '¶',
  Idea: '✦',
  Observation: '◎',
  Conclusion: '✓',
  Knowledge: '❖',
  Data: '▦',
  Paper: '§',
};

const LABEL_FONT =
  '"Avenir Next", "Avenir Next LT Pro", Avenir, "Nunito Sans", system-ui, sans-serif';
const CELL_R = 0.66;
const ROOT_R = 1.0;
const FOCUS_ZOOM = 2.4;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// Darken a color toward the field — the cytoplasm interior of the membrane.
function cytoplasm(hex: string): string {
  const [r, g, b] = hexRgb(hex);
  const mix = (c: number) => Math.round(c * 0.32 + 8);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function nodeColor(type: OkfNodeType): string {
  const { varName, fallback } = NODE_TOKEN[type] ?? NODE_TOKEN.Project;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return value || fallback;
}

// Soft radial glow — a membrane halo / nucleus core depending on the stops.
function radialTexture(
  inner: string,
  innerStop: number,
): THREE.CanvasTexture {
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
  g.addColorStop(0, inner);
  g.addColorStop(innerStop, inner);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Crisp light label with a soft shadow, for the dark field.
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
  const pad = 10;
  const w = Math.ceil(metrics.width) + pad * 2;
  const h = fontPx + pad * 2;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.font = `600 ${fontPx}px ${LABEL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 9;
  ctx.fillStyle = '#eaf2fb';
  ctx.fillText(label, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, aspect: w / h };
}

// A crisp type glyph in the cell's color on a transparent square.
function makeGlyphTexture(glyph: string, color: string): THREE.CanvasTexture {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.font = `600 ${size * 0.58}px ${LABEL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(glyph, size / 2, size / 2 + size * 0.03);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface GraphControls {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}

interface Cell {
  id: string;
  group: THREE.Group;
  baseScale: number;
  phase: number;
  halo: THREE.Sprite;
  haloMat: THREE.SpriteMaterial;
  nucleusMat: THREE.SpriteMaterial;
  membraneMat: THREE.MeshBasicMaterial;
  bodyMat: THREE.MeshBasicMaterial;
  glyphMat: THREE.SpriteMaterial;
  labelMat: THREE.SpriteMaterial;
  ringMat: THREE.MeshBasicMaterial | null; // selection/link ring
  arborMats: THREE.LineBasicMaterial[]; // branching dendrite tendrils
  dim: number; // animated 1 → focused-out
  bloom: number; // animated 1 → focused-in size
}

interface Dendrite {
  from: string;
  to: string;
  mat: THREE.LineBasicMaterial;
  baseOpacity: number;
  dim: number;
  pulse: {
    sprite: THREE.Sprite;
    mat: THREE.SpriteMaterial;
    pts: THREE.Vector3[];
    speed: number;
    phase: number;
  } | null;
}

// three.js rendering of the knowledge graph as living neural tissue. Cells glow
// and breathe; dendrites connect related cells (closer = more related, per the
// force layout) and fire pulses along semantic ties. Clicking a cell focuses
// it — the camera dives in, the cell blooms, its neighbours stay lit and the
// rest of the tissue recedes. Purely visual: it subscribes to the same zustand
// store the DOM overlay drives, so the two stay in sync. Guarded so a WebGL-less
// environment degrades to the overlay without crashing.
export function GraphScene({
  onNodeClick,
  onControls,
}: {
  onNodeClick?: (node: KnowledgeNode) => void;
  onControls?: (controls: GraphControls | null) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const clickRef = useRef(onNodeClick);
  clickRef.current = onNodeClick;
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

    let pickables: THREE.Mesh[] = [];
    let cells: Cell[] = [];
    let dendrites: Dendrite[] = [];
    let disposables: { dispose: () => void }[] = [];
    let hoveredId: string | null = null;

    // Symmetric frustum around the origin (the layout is centered there), sized
    // to frame the whole tissue with padding. Pan/focus then move the camera.
    const fitFrustum = () => {
      const { positions } = useKnowledgeCanvas.getState();
      const pts = Object.values(positions);
      const pad = 2.6;
      let halfW = 8;
      let halfH = 6;
      if (pts.length) {
        halfW = Math.max(...pts.map((p) => Math.abs(p.x))) + pad;
        halfH = Math.max(...pts.map((p) => Math.abs(p.y))) + pad;
      }
      const aspect = width / height;
      if (halfW / halfH > aspect) halfH = halfW / aspect;
      else halfW = halfH * aspect;
      camera.left = -halfW;
      camera.right = halfW;
      camera.top = halfH;
      camera.bottom = -halfH;
      camera.updateProjectionMatrix();
    };

    // Camera model: pan/zoom are targets the camera eases toward. Focus mode
    // overrides them to dive onto the selected cell; leaving focus eases back to
    // the prior pan.
    let panX = 0;
    let panY = 0;
    let targetZoom = 1;
    let zoom = 1;
    let driftAmp = 1; // ambient drift strength; eases to 0 while focused

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (focused()) useKnowledgeCanvas.getState().select(null); // wheel exits focus
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

    const focused = () => {
      const s = useKnowledgeCanvas.getState();
      return !!s.selectedId && !s.linkMode;
    };

    const applyHover = (id: string | null) => {
      if (id === hoveredId) return;
      hoveredId = id;
      renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
      useKnowledgeCanvas.getState().hover(id);
    };

    const onMove = (e: PointerEvent) => {
      if (dragging) {
        if (focused()) useKnowledgeCanvas.getState().select(null); // drag to explore
        const frustumW = (camera.right - camera.left) / zoom;
        const frustumH = (camera.top - camera.bottom) / zoom;
        panX -= ((e.clientX - lastX) / width) * frustumW;
        panY += ((e.clientY - lastY) / height) * frustumH;
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
      else if (focused()) useKnowledgeCanvas.getState().select(null); // click field = unfocus
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focused()) useKnowledgeCanvas.getState().select(null);
    };
    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);

    const zoomBy = (f: number) => {
      if (focused()) useKnowledgeCanvas.getState().select(null);
      targetZoom = Math.min(4, Math.max(0.3, targetZoom * f));
    };
    controlsRef.current?.({
      zoomIn: () => zoomBy(1.2),
      zoomOut: () => zoomBy(1 / 1.2),
      reset: () => {
        useKnowledgeCanvas.getState().select(null);
        panX = 0;
        panY = 0;
        targetZoom = 1;
        fitFrustum();
      },
    });

    const rebuild = () => {
      group.clear();
      for (const d of disposables) d.dispose();
      disposables = [];
      pickables = [];
      cells = [];
      dendrites = [];

      const { graph, positions, selectedId, linkFromId } =
        useKnowledgeCanvas.getState();
      if (!graph) return;
      fitFrustum();

      const track = <T extends { dispose: () => void }>(d: T): T => {
        disposables.push(d);
        return d;
      };
      const posOf = (id: string) =>
        positions[id] ? new THREE.Vector3(positions[id].x, positions[id].y, 0) : null;

      // Cell size grows a little with connectivity — hubs are bigger somata.
      const degree = new Map<string, number>();
      for (const e of graph.edges) {
        degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
        degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
      }

      // ── Dendrites: glowing filaments; semantic ties carry a firing pulse ──
      const pulseTex = track(radialTexture('rgba(233,247,255,1)', 0.25));
      for (let i = 0; i < graph.edges.length; i++) {
        const e = graph.edges[i];
        const a = posOf(e.from);
        const b = posOf(e.to);
        if (!a || !b) continue;
        const style = EDGE_STYLE[e.predicate] ?? EDGE_STYLE.contains;
        // A gentle organic bow so parallel dendrites fan apart.
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const dir = b.clone().sub(a);
        const normal = new THREE.Vector3(-dir.y, dir.x, 0).normalize();
        const sign = e.from < e.to ? 1 : -1;
        mid.add(normal.multiplyScalar(sign * dir.length() * 0.14));
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const pts = curve.getPoints(40);
        const geo = track(new THREE.BufferGeometry().setFromPoints(pts));
        const mat = track(
          new THREE.LineBasicMaterial({
            color: style.color,
            transparent: true,
            opacity: style.opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        const line = new THREE.Line(geo, mat);
        line.position.z = -0.3;
        group.add(line);

        let pulse: Dendrite['pulse'] = null;
        if (style.fires) {
          const pMat = track(
            new THREE.SpriteMaterial({
              map: pulseTex,
              color: style.color,
              transparent: true,
              opacity: 0,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          );
          const sprite = new THREE.Sprite(pMat);
          sprite.scale.setScalar(0.7);
          sprite.position.z = -0.25;
          group.add(sprite);
          pulse = { sprite, mat: pMat, pts, speed: 0.16 + (i % 5) * 0.02, phase: (i * 0.37) % 1 };
        }
        dendrites.push({
          from: e.from,
          to: e.to,
          mat,
          baseOpacity: style.opacity,
          dim: 1,
          pulse,
        });
      }

      // Directions from each cell toward its neighbours — dendrites root along
      // these, so the arbor reaches toward what the cell is connected to.
      const neighborDirs = new Map<string, number[]>();
      const pushDir = (id: string, ang: number) => {
        const list = neighborDirs.get(id) ?? [];
        list.push(ang);
        neighborDirs.set(id, list);
      };
      for (const e of graph.edges) {
        const pa = positions[e.from];
        const pb = positions[e.to];
        if (!pa || !pb) continue;
        pushDir(e.from, Math.atan2(pb.y - pa.y, pb.x - pa.x));
        pushDir(e.to, Math.atan2(pa.y - pb.y, pa.x - pb.x));
      }

      // ── Cells: halo + cytoplasm body + glowing membrane + bright nucleus ──
      graph.nodes.forEach((n, i) => {
        const p = positions[n.id];
        if (!p) return;
        const isRoot = n.id === graph.rootId;
        const isSel = n.id === selectedId;
        const isLinkFrom = n.id === linkFromId;
        const active = isSel || isLinkFrom;
        const color = nodeColor(n.type);
        const deg = degree.get(n.id) ?? 0;
        const r =
          (isRoot ? ROOT_R : CELL_R) * (1 + Math.min(0.45, deg * 0.05));

        const cell = new THREE.Group();
        cell.position.set(p.x, p.y, 1);

        // Membrane halo — soft glow that breathes.
        const haloMat = track(
          new THREE.SpriteMaterial({
            map: track(radialTexture(color, 0.18)),
            transparent: true,
            opacity: active ? 0.55 : 0.32,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        const halo = new THREE.Sprite(haloMat);
        halo.scale.setScalar(r * 4.2);
        halo.position.z = -0.2;
        cell.add(halo);

        // Cytoplasm — a dark-tinted disc so the membrane and nucleus read.
        const bodyMat = track(
          new THREE.MeshBasicMaterial({
            color: cytoplasm(color),
            transparent: true,
            opacity: 0.82,
          }),
        );
        const body = new THREE.Mesh(track(new THREE.CircleGeometry(r, 48)), bodyMat);
        cell.add(body);

        // Membrane — the glowing rim.
        const membraneMat = track(
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.92,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        const membrane = new THREE.Mesh(
          track(new THREE.RingGeometry(r * 0.9, r * 1.08, 48)),
          membraneMat,
        );
        membrane.position.z = 0.05;
        cell.add(membrane);

        // Nucleus — a bright core.
        const nucleusMat = track(
          new THREE.SpriteMaterial({
            map: track(radialTexture('rgba(240,250,255,1)', 0.2)),
            color,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        const nucleus = new THREE.Sprite(nucleusMat);
        nucleus.scale.setScalar(r * 0.95);
        nucleus.position.z = 0.08;
        cell.add(nucleus);

        // Branching dendrite arbor — tendrils sprout from the membrane, mostly
        // toward neighbours, and fork once into finer branches that fade at the
        // tips (vertex colour → black under additive blending). This gives each
        // soma a bushy, neuronal silhouette.
        const arborMats: THREE.LineBasicMaterial[] = [];
        const col3 = new THREE.Color(color);
        const hash = (k: number) => {
          const s = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
          return s - Math.floor(s);
        };
        const addTendril = (
          ax: number,
          ay: number,
          angle: number,
          len: number,
          bow: number,
          fork: boolean,
        ) => {
          const N = 10;
          const pts: THREE.Vector3[] = [];
          const cols: number[] = [];
          const nx = Math.cos(angle);
          const ny = Math.sin(angle);
          const ox = -ny;
          const oy = nx;
          for (let s = 0; s <= N; s++) {
            const u = s / N;
            const wob = bow * Math.sin(u * Math.PI);
            pts.push(new THREE.Vector3(ax + nx * len * u + ox * wob, ay + ny * len * u + oy * wob, -0.28));
            const fade = 1 - u;
            cols.push(col3.r * fade, col3.g * fade, col3.b * fade);
          }
          const geo = track(new THREE.BufferGeometry().setFromPoints(pts));
          geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
          const mat = track(
            new THREE.LineBasicMaterial({
              vertexColors: true,
              transparent: true,
              opacity: 0.5,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          );
          cell.add(new THREE.Line(geo, mat));
          arborMats.push(mat);
          if (fork) {
            const ex = ax + nx * len;
            const ey = ay + ny * len;
            const spread = 0.45 + hash(len) * 0.3;
            addTendril(ex, ey, angle + spread, len * 0.6, bow * 0.6, false);
            addTendril(ex, ey, angle - spread, len * 0.62, -bow * 0.5, false);
          }
        };
        // Neighbour directions first (capped), then a few free spines to fill
        // out the arbor — kept sparse so the graph stays readable.
        const dirs = (neighborDirs.get(n.id) ?? []).slice(0, 5);
        for (let k = dirs.length; k < Math.min(5, Math.max(3, dirs.length + 1)); k++) {
          dirs.push(k * 2.399 + i * 0.7);
        }
        dirs.forEach((ang, k) => {
          const a = ang + (hash(k) - 0.5) * 0.3;
          addTendril(
            Math.cos(a) * r * 0.95,
            Math.sin(a) * r * 0.95,
            a,
            r * (1.5 + hash(k + 9) * 0.7),
            r * 0.32 * (hash(k + 3) < 0.5 ? 1 : -1),
            true,
          );
        });

        // Type glyph, faint over the nucleus.
        const glyphMat = track(
          new THREE.SpriteMaterial({
            map: track(makeGlyphTexture(NODE_GLYPH[n.type] ?? '•', '#e8f2fb')),
            transparent: true,
            opacity: 0.72,
            depthWrite: false,
          }),
        );
        const glyph = new THREE.Sprite(glyphMat);
        glyph.scale.setScalar(r * 0.85);
        glyph.position.z = 0.12;
        cell.add(glyph);

        // Selection / link-source ring.
        let ringMat: THREE.MeshBasicMaterial | null = null;
        if (active) {
          ringMat = track(
            new THREE.MeshBasicMaterial({
              color: isLinkFrom ? '#a78bfa' : '#e8f2fb',
              transparent: true,
              opacity: 0.9,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          );
          const ring = new THREE.Mesh(
            track(new THREE.RingGeometry(r * 1.3, r * 1.4, 48)),
            ringMat,
          );
          ring.position.z = 0.06;
          cell.add(ring);
        }

        // Label beneath the cell.
        const { tex, aspect } = makeLabelTexture(n.label);
        track(tex);
        const labelMat = track(
          new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false }),
        );
        const label = new THREE.Sprite(labelMat);
        const labelH = 0.92;
        label.scale.set(labelH * aspect, labelH, 1);
        label.position.set(0, -(r + 0.72), 0.1);
        cell.add(label);

        // Invisible pick disc.
        const pickMat = track(
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, colorWrite: false, depthWrite: false }),
        );
        const pickMesh = new THREE.Mesh(track(new THREE.CircleGeometry(r * 1.35, 24)), pickMat);
        pickMesh.position.z = 0.2;
        pickMesh.userData['node'] = n;
        cell.add(pickMesh);
        pickables.push(pickMesh);

        cells.push({
          id: n.id,
          group: cell,
          baseScale: 1,
          phase: i * 0.7,
          halo,
          haloMat,
          nucleusMat,
          membraneMat,
          bodyMat,
          glyphMat,
          labelMat,
          ringMat,
          arborMats,
          dim: 1,
          bloom: 1,
        });

        group.add(cell);
      });
    };

    rebuild();
    let prev = useKnowledgeCanvas.getState();
    const unsub = useKnowledgeCanvas.subscribe((state) => {
      const structural =
        state.graph !== prev.graph ||
        state.positions !== prev.positions ||
        state.linkFromId !== prev.linkFromId;
      // Selection changes only re-focus (animated), no rebuild — unless the
      // selection ring needs (un)drawing, which we fold into a light rebuild.
      const selectionRing = state.selectedId !== prev.selectedId;
      prev = state;
      if (structural || selectionRing) rebuild();
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
    const animate = () => {
      const t = (performance.now() - start) / 1000;
      const { selectedId, linkMode, positions, graph } =
        useKnowledgeCanvas.getState();
      const isFocused = !!selectedId && !linkMode;

      // Neighbours that stay lit while focused.
      const lit = new Set<string>();
      if (isFocused && selectedId && graph) {
        lit.add(selectedId);
        for (const e of graph.edges) {
          if (e.from === selectedId) lit.add(e.to);
          if (e.to === selectedId) lit.add(e.from);
        }
      }

      // Ambient drift: the whole tissue sways slowly, like a field under the
      // microscope — then stills when a cell is focused so attention can land.
      driftAmp = lerp(driftAmp, isFocused ? 0 : 1, 0.05);
      group.position.x = driftAmp * (Math.sin(t * 0.11) * 0.5 + Math.sin(t * 0.07 + 1.3) * 0.3);
      group.position.y = driftAmp * (Math.cos(t * 0.09) * 0.45 + Math.sin(t * 0.13 + 2.1) * 0.22);
      group.rotation.z = driftAmp * 0.02 * Math.sin(t * 0.05);

      // Camera: dive onto the focused cell, else ease toward the user's pan.
      const focusP = isFocused && selectedId ? positions[selectedId] : null;
      const camTX = focusP ? focusP.x : panX;
      const camTY = focusP ? focusP.y : panY;
      const camTZoom = isFocused ? FOCUS_ZOOM : targetZoom;
      camera.position.x = lerp(camera.position.x, camTX, 0.1);
      camera.position.y = lerp(camera.position.y, camTY, 0.1);
      zoom += (camTZoom - zoom) * 0.1;
      camera.zoom = zoom;
      camera.updateProjectionMatrix();

      for (const c of cells) {
        const isSel = c.id === selectedId;
        const hovered = c.id === hoveredId;
        const dimTarget = !isFocused ? 1 : lit.has(c.id) ? 1 : 0.12;
        c.dim = lerp(c.dim, dimTarget, 0.12);
        c.bloom = lerp(c.bloom, isFocused && isSel ? 1.7 : 1, 0.12);

        const breath = 1 + 0.035 * Math.sin(t * 1.3 + c.phase);
        c.group.scale.setScalar(breath * c.bloom);

        const emph = hovered || isSel ? 1.35 : 1;
        c.haloMat.opacity = (isSel ? 0.6 : hovered ? 0.5 : 0.32) * c.dim;
        c.halo.scale.setScalar(
          (c.id === selectedId ? 4.8 : 4.2) *
            (c.group.scale.x / c.bloom) *
            (hovered ? 1.15 : 1),
        );
        c.membraneMat.opacity = 0.92 * c.dim * emph;
        c.nucleusMat.opacity = 0.9 * c.dim * emph;
        c.bodyMat.opacity = 0.82 * Math.max(c.dim, 0.25);
        c.glyphMat.opacity = 0.72 * c.dim;
        // Hide the focused cell's own in-scene label — it blooms with the cell
        // and the dossier panel already carries the title; keep neighbour labels.
        c.labelMat.opacity = isFocused
          ? isSel
            ? 0
            : lit.has(c.id)
              ? 1
              : 0
          : hovered
            ? 1
            : 0.85;
        if (c.ringMat) c.ringMat.opacity = 0.9 * c.dim;
        const arborOp = 0.42 * c.dim * (hovered || isSel ? 1.4 : 1);
        for (const m of c.arborMats) m.opacity = arborOp;
      }

      for (const d of dendrites) {
        const litEdge = !isFocused || (lit.has(d.from) && lit.has(d.to));
        d.dim = lerp(d.dim, litEdge ? 1 : 0.06, 0.12);
        d.mat.opacity = d.baseOpacity * d.dim * (isFocused && litEdge ? 1.5 : 1);
        if (d.pulse) {
          const u = (t * d.pulse.speed + d.pulse.phase) % 1;
          const pt = d.pulse.pts[Math.min(d.pulse.pts.length - 1, Math.floor(u * (d.pulse.pts.length - 1)))];
          d.pulse.sprite.position.set(pt.x, pt.y, -0.25);
          // Pulse brightens in the middle of its run, fades at the ends.
          const bright = Math.sin(u * Math.PI);
          d.pulse.mat.opacity = bright * 0.9 * d.dim * (isFocused && litEdge ? 1.4 : 1);
          d.pulse.sprite.scale.setScalar(0.55 + bright * 0.35);
        }
      }

      renderer.render(scene, camera);
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
      window.removeEventListener('keydown', onKey);
      for (const d of disposables) d.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0" data-testid="graph-scene" />;
}
