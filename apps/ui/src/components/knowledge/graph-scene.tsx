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

const LABEL_FONT =
  '"Avenir Next", "Avenir Next LT Pro", Avenir, "Nunito Sans", system-ui, sans-serif';
const NODE_RADIUS = 0.55;
const ROOT_RADIUS = 0.8;

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

// three.js rendering of the knowledge graph. Purely visual — it subscribes to
// the same zustand store the DOM overlay drives, so the two stay in sync
// (three.js ↔ React via the store). Clicking a node in the scene reports up
// through onNodeClick (select / link picking); hover glows in-scene. Guarded
// so a WebGL-less environment (e.g. some CI) degrades to just the overlay
// without crashing.
export function GraphScene({
  onNodeClick,
}: {
  onNodeClick?: (node: KnowledgeNode) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const clickRef = useRef(onNodeClick);
  clickRef.current = onNodeClick;

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
    let halos: { sprite: THREE.Sprite; base: number; phase: number; id: string }[] = [];
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

    const rebuild = () => {
      group.clear();
      for (const d of disposables) d.dispose();
      disposables = [];
      pickables = [];
      halos = [];

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

      // ── Nodes: white glass discs, type-colored rims, breathing halos ──
      graph.nodes.forEach((n, i) => {
        const p = positions[n.id];
        if (!p) return;
        const isRoot = n.id === graph.rootId;
        const isSel = n.id === selectedId;
        const isLinkFrom = n.id === linkFromId;
        const r = isRoot ? ROOT_RADIUS : NODE_RADIUS;
        const color = nodeColor(n.type);
        const node = new THREE.Group();
        node.position.set(p.x, p.y, 1);

        // Halo — soft glow behind the disc.
        const glow = track(makeGlowTexture(color));
        const haloMat = track(
          new THREE.SpriteMaterial({
            map: glow,
            transparent: true,
            opacity: isSel || isLinkFrom ? 0.6 : 0.38,
            depthWrite: false,
          }),
        );
        const halo = new THREE.Sprite(haloMat);
        const haloBase = r * (isSel || isLinkFrom ? 5 : 3.6);
        halo.scale.setScalar(haloBase);
        halo.position.z = -0.2;
        node.add(halo);
        halos.push({ sprite: halo, base: haloBase, phase: i * 0.7, id: n.id });

        // Disc — near-white glass.
        const discGeo = track(new THREE.CircleGeometry(r, 48));
        const discMat = track(
          new THREE.MeshBasicMaterial({
            color: '#ffffff',
            transparent: true,
            opacity: 0.94,
          }),
        );
        const disc = new THREE.Mesh(discGeo, discMat);
        disc.userData['node'] = n;
        node.add(disc);
        pickables.push(disc);

        // Rim — the node's type color.
        const rimGeo = track(new THREE.RingGeometry(r, r * 1.22, 48));
        const rimMat = track(
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: isSel ? 1 : 0.9,
          }),
        );
        const rim = new THREE.Mesh(rimGeo, rimMat);
        rim.position.z = 0.05;
        node.add(rim);

        // Selection ring — a fine white outline outside the rim.
        if (isSel || isLinkFrom) {
          const selGeo = track(new THREE.RingGeometry(r * 1.38, r * 1.46, 48));
          const selMat = track(
            new THREE.MeshBasicMaterial({
              color: '#ffffff',
              transparent: true,
              opacity: 0.9,
            }),
          );
          const sel = new THREE.Mesh(selGeo, selMat);
          sel.position.z = 0.05;
          node.add(sel);
        }

        // Label — beneath the disc.
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
    const animate = () => {
      const t = (performance.now() - start) / 1000;
      zoom += (targetZoom - zoom) * 0.12;
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
      // Breathing halos; the hovered node glows a little brighter.
      for (const h of halos) {
        const hovered = h.id === hoveredId;
        const breath = 1 + 0.05 * Math.sin(t * 1.6 + h.phase);
        h.sprite.scale.setScalar(h.base * breath * (hovered ? 1.25 : 1));
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      unsub();
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
