'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// An animated brand-gradient background with a halftone-dot field and paper
// grain — the same family of effect as paper.design's shaders, hand-written so
// we own it. Rendered to its own fullscreen WebGL canvas that sits behind the
// graph scene and does NOT pan/zoom with it. Guarded so a WebGL-less
// environment simply shows the CSS gradient underneath.

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

  // Brand palette (sRGB) — the landing-page sky→cream gradient.
  const vec3 SKY   = vec3(0.290, 0.584, 0.800); // #4a95cc
  const vec3 SKYLT = vec3(0.561, 0.753, 0.871); // #8fc0de
  const vec3 CREAM = vec3(0.941, 0.910, 0.824); // #f0e8d2

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

    // Vertical brand gradient (top sky → cream at the bottom), with a gentle
    // drifting fbm warp so the sky feels alive.
    float warp = fbm(vec2(uv.x * 2.0, uv.y * 2.0 - uTime * 0.03)) * 0.12;
    float t = clamp(1.0 - uv.y + warp - 0.06, 0.0, 1.0);
    vec3 col = t < 0.5
      ? mix(SKY, SKYLT, smoothstep(0.0, 0.5, t))
      : mix(SKYLT, CREAM, smoothstep(0.5, 1.0, t));

    // Halftone dots: a rotated screen-space grid whose dot radius grows toward
    // the warm bottom and pulses with a slow fbm field. Soft white ink, low
    // opacity — a printed, tactile feel.
    float ca = cos(0.5), sa = sin(0.5);
    vec2 rot = vec2(uv.x * aspect * ca - uv.y * sa, uv.x * aspect * sa + uv.y * ca);
    float cells = 46.0;
    vec2 grid = fract(rot * cells) - 0.5;
    float field = fbm(rot * 3.0 + uTime * 0.05);
    float radius = mix(0.05, 0.34, uv.y) * (0.6 + 0.8 * field);
    float dot = smoothstep(radius, radius - 0.12, length(grid));
    col = mix(col, col + vec3(1.0), dot * 0.06);

    // Paper grain — fine multiplicative noise.
    float grain = noise(uv * uResolution.xy * 0.5 + uTime) - 0.5;
    col += grain * 0.025;

    // Soft vignette to seat the graph in the centre.
    float vig = smoothstep(1.15, 0.35, distance(uv, vec2(0.5)));
    col *= mix(0.94, 1.0, vig);

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
