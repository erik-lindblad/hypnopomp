"use strict";

/* Stage 1 — The Instrument.
 * Streams the Bluesky Jetstream firehose, filters for spontaneous first-person
 * dream reports, displays matches one at a time, and collects a deduplicated
 * corpus in localStorage. Reads/writes `energy`, defined in ambience.js, and
 * uses `DreamFilters` from filters.js — both must load first.
 */

/* ---------- state ---------- */
const stats = {
  raw: 0, posts: 0, matches: 0, reconnects: 0,
  rej: { lang: 0, exclude: 0, length: 0, link: 0, noinclude: 0 },
  lastRaw: "", lastMatches: [],
  windowRaw: [], windowPosts: []
};
let corpus = [];
try { corpus = JSON.parse(localStorage.getItem("dreaming-corpus") || "[]"); } catch (e) { corpus = []; }
const seen = new Set(corpus.map(d => d.text));
document.getElementById("total").textContent = corpus.length;

const queue = [];
let showing = false;

/* ---------- websocket ---------- */
const URL_JS = "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post";
let ws;

function connect() {
  ws = new WebSocket(URL_JS);
  ws.onopen = () => setConn(true);
  ws.onclose = () => { setConn(false); stats.reconnects++; setTimeout(connect, 2000 + Math.random() * 3000); };
  ws.onerror = () => ws.close();
  ws.onmessage = (ev) => {
    stats.raw++; stats.windowRaw.push(Date.now());
    let m;
    try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.kind !== "commit") return;
    const c = m.commit;
    if (!c || c.operation !== "create" || c.collection !== "app.bsky.feed.post") return;
    const r = c.record;
    if (!r || typeof r.text !== "string") return;

    stats.posts++; stats.windowPosts.push(Date.now());
    const text = r.text.trim();
    stats.lastRaw = text.slice(0, 120);

    const reason = DreamFilters.classify(text, r.langs);
    if (reason) { stats.rej[reason]++; return; }

    acceptDream(text);
  };
}

function setConn(up) {
  document.getElementById("dot").className = up ? "" : "down";
  document.getElementById("conn").textContent = up ? "live · jetstream" : "reconnecting…";
}

/* ---------- dreams ---------- */
function acceptDream(text) {
  stats.matches++;
  document.getElementById("count").textContent = stats.matches;
  stats.lastMatches.unshift(text.slice(0, 140));
  stats.lastMatches = stats.lastMatches.slice(0, 3);

  if (!seen.has(text)) {
    seen.add(text);
    corpus.push({ text, at: new Date().toISOString() });
    if (corpus.length > 5000) corpus = corpus.slice(-5000);
    try { localStorage.setItem("dreaming-corpus", JSON.stringify(corpus)); } catch (e) {}
    document.getElementById("total").textContent = corpus.length;
  }

  if (queue.length < 50) queue.push(text);
  pump();
  energy = Math.min(energy + 0.35, 1.6);
}

function pump() {
  if (showing || queue.length === 0) return;
  showing = true;
  const el = document.getElementById("dreamText");
  el.textContent = queue.shift();
  requestAnimationFrame(() => el.classList.add("visible"));
  setTimeout(() => {
    el.classList.remove("visible");
    setTimeout(() => { showing = false; pump(); }, 3200);
  }, 9000);
}

/* ---------- hud ---------- */
const hud = document.getElementById("hud");
addEventListener("keydown", (e) => { if (e.key === "d") hud.classList.toggle("open"); });

function rate(arr) {
  const now = Date.now();
  while (arr.length && arr[0] < now - 10000) arr.shift();
  return (arr.length / 10).toFixed(1);
}
setInterval(() => {
  if (!hud.classList.contains("open")) return;
  const s = stats;
  hud.innerHTML =
    `<b>debug · press "d" to hide</b>\n` +
    `ws.readyState: ${ws ? ws.readyState : "-"} · reconnects: ${s.reconnects}\n` +
    `raw msgs/s: ${rate(s.windowRaw)} · posts/s: ${rate(s.windowPosts)}\n` +
    `matches: ${s.matches} · corpus: ${corpus.length}\n` +
    `rejections — lang: ${s.rej.lang} · exclude: ${s.rej.exclude} · length: ${s.rej.length} · link: ${s.rej.link} · no-include: ${s.rej.noinclude}\n` +
    `last raw: ${s.lastRaw || "—"}\n` +
    `last matches:\n${s.lastMatches.map((t, i) => `  ${i + 1}. ${t}`).join("\n") || "  none yet"}`;
}, 1000);

/* ---------- tray / export ---------- */
let wakeTimer;
addEventListener("mousemove", () => {
  document.body.classList.add("awake");
  clearTimeout(wakeTimer);
  wakeTimer = setTimeout(() => document.body.classList.remove("awake"), 3500);
});
document.getElementById("export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(corpus, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `dreaming-corpus-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

connect();
