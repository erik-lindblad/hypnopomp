"use strict";

/* ---------- ambience ----------
 * Fullscreen canvas of drifting motes. `energy` is a shared runtime symbol:
 * stream.js nudges it upward each time a dream is accepted, and tick() decays
 * it back down. Because both files are classic (non-module) scripts, this
 * top-level `let` lives in the shared global lexical scope — but only if
 * ambience.js is loaded BEFORE stream.js.
 */
const canvas = document.getElementById("sky");
const ctx = canvas.getContext("2d");
let W, H, motes = [];
let energy = 0;
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

function resize() {
  W = canvas.width = innerWidth * devicePixelRatio;
  H = canvas.height = innerHeight * devicePixelRatio;
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
}
addEventListener("resize", resize); resize();

for (let i = 0; i < 90; i++) {
  motes.push({
    x: Math.random() * 2 - 1, y: Math.random() * 2 - 1,
    z: 0.2 + Math.random() * 0.8,
    a: Math.random() * Math.PI * 2,
    s: 0.00004 + Math.random() * 0.00012
  });
}

function tick() {
  ctx.clearRect(0, 0, W, H);
  energy *= 0.995;
  const drift = REDUCED ? 0 : (1 + energy);
  for (const p of motes) {
    p.a += p.s * 60 * drift;
    p.x += Math.cos(p.a) * p.s * 8 * drift;
    p.y += Math.sin(p.a * 0.7) * p.s * 8 * drift;
    if (p.x > 1.1) p.x = -1.1; if (p.x < -1.1) p.x = 1.1;
    if (p.y > 1.1) p.y = -1.1; if (p.y < -1.1) p.y = 1.1;
    const px = (p.x * 0.5 + 0.5) * W, py = (p.y * 0.5 + 0.5) * H;
    const r = p.z * 3.2 * devicePixelRatio;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r * 4);
    g.addColorStop(0, `rgba(196, 204, 232, ${0.10 + p.z * 0.12})`);
    g.addColorStop(1, "rgba(196, 204, 232, 0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, r * 4, 0, Math.PI * 2); ctx.fill();
  }
  requestAnimationFrame(tick);
}
tick();
