'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// The dark fluorescence-microscopy field the neural tissue floats in: a deep
// indigo ground, a slow drifting nebula of teal/violet, and faint out-of-focus
// specks — quiet enough that the glowing cells are the whole show. Rendered to
// its own fullscreen WebGL canvas behind the graph scene; it does NOT pan/zoom
// with it. Guarded so a WebGL-less environment simply shows the CSS gradient
// underneath.

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;

  // Dark microscopy field (sRGB): deep indigo ground with teal/violet nebula.
  const vec3 DEEP  = vec3(0.024, 0.035, 0.078); // #060914
  const vec3 GROUND= vec3(0.043, 0.063, 0.125); // #0b1020
  const vec3 TEAL  = vec3(0.078, 0.298, 0.325); // #144c53
  const vec3 VIOLET= vec3(0.157, 0.106, 0.290); // #281b4a

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      v += amp * noise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(1.0, uResolution.y);
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

    // Deep radial ground — darkest at the edges so the tissue sits in a pool
    // of light near the centre.
    float rad = length(p);
    vec3 col = mix(GROUND, DEEP, smoothstep(0.15, 0.95, rad));

    // Two slow, counter-drifting nebula clouds tint the field teal and violet.
    float n1 = fbm(p * 1.6 + vec2(uTime * 0.015, uTime * 0.01));
    float n2 = fbm(p * 2.1 - vec2(uTime * 0.012, uTime * 0.017) + 5.0);
    col += TEAL * smoothstep(0.45, 0.95, n1) * 0.5;
    col += VIOLET * smoothstep(0.5, 1.0, n2) * 0.45;

    // Faint out-of-focus specks — a rotated grid of soft dots drifting slowly,
    // like fluorophores just off the focal plane.
    float ca = cos(0.4), sa = sin(0.4);
    vec2 rot = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca);
    vec2 grid = fract(rot * 9.0 + vec2(0.0, uTime * 0.04)) - 0.5;
    float twinkle = 0.6 + 0.4 * fbm(rot * 4.0 + uTime * 0.08);
    float speck = smoothstep(0.16, 0.0, length(grid)) * twinkle;
    col += vec3(0.30, 0.55, 0.70) * speck * 0.06;

    // Fine sensor grain.
    float grain = noise(uv * uResolution.xy * 0.5 + uTime) - 0.5;
    col += grain * 0.02;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function ShaderBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      return; // no WebGL — the CSS gradient underneath remains
    }

    let width = mount.clientWidth || 640;
    let height = mount.clientHeight || 480;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(width, height) },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(quad);

    const resize = new ResizeObserver(() => {
      width = mount.clientWidth || width;
      height = mount.clientHeight || height;
      renderer.setSize(width, height);
      uniforms.uResolution.value.set(width, height);
    });
    resize.observe(mount);

    let raf = 0;
    const start = performance.now();
    const animate = () => {
      uniforms.uTime.value = (performance.now() - start) / 1000;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      material.dispose();
      quad.geometry.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0" aria-hidden />;
}
