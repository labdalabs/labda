'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useKnowledgeCanvas } from '@/lib/knowledge/store';
import type { OkfNodeType } from '@/lib/knowledge/types';

const NODE_COLOR: Record<OkfNodeType, number> = {
  Project: 0x4a95cc,
  Hypothesis: 0x8b5cf6,
  Protocol: 0x10b981,
  Reference: 0xf59e0b,
};

// three.js rendering of the knowledge graph. Purely visual — it subscribes to
// the same zustand store the DOM overlay drives, so the two stay in sync
// (three.js ↔ React via the store). Guarded so a WebGL-less environment (e.g.
// some CI) degrades to just the overlay without crashing.
export function GraphScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // no WebGL — the DOM overlay remains fully functional
    }

    const width = mount.clientWidth || 640;
    const height = mount.clientHeight || 420;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-10, 10, 7.5, -7.5, 0.1, 100);
    camera.position.z = 10;

    const group = new THREE.Group();
    scene.add(group);

    // Simple pan/zoom.
    let zoom = 1;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom = Math.min(4, Math.max(0.3, zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
    };
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      camera.position.x -= ((e.clientX - lastX) / width) * 20 / zoom;
      camera.position.y += ((e.clientY - lastY) / height) * 15 / zoom;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = () => {
      dragging = false;
    };
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    const rebuild = () => {
      group.clear();
      const { graph, positions, selectedId } = useKnowledgeCanvas.getState();
      if (!graph) return;

      // Edges as lines.
      const lineMat = new THREE.LineBasicMaterial({ color: 0x999999 });
      for (const e of graph.edges) {
        const a = positions[e.from];
        const b = positions[e.to];
        if (!a || !b) continue;
        const geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(a.x, a.y, 0),
          new THREE.Vector3(b.x, b.y, 0),
        ]);
        group.add(new THREE.Line(geo, lineMat));
      }

      // Nodes as circles.
      for (const n of graph.nodes) {
        const p = positions[n.id];
        if (!p) continue;
        const isSel = n.id === selectedId;
        const geo = new THREE.CircleGeometry(isSel ? 0.7 : 0.5, 24);
        const mat = new THREE.MeshBasicMaterial({
          color: NODE_COLOR[n.type] ?? 0xffffff,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(p.x, p.y, 1);
        group.add(mesh);
      }
    };

    rebuild();
    const unsub = useKnowledgeCanvas.subscribe(rebuild);

    let raf = 0;
    const animate = () => {
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      unsub();
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0" data-testid="graph-scene" />;
}
