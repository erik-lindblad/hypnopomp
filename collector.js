"use strict";

/* Headless Stage 1 collector — the server-side twin of stream.js.
 *
 * Connects to the Bluesky Jetstream firehose, filters with the SAME rules the
 * browser uses (filters.js), and appends matches to a JSON file instead of
 * localStorage. Corpus format is identical to the browser export: [{ text, at }].
 *
 * Runs in two modes, chosen by DURATION_MS:
 *   - DURATION_MS > 0  → listen for that long, then flush and exit.
 *                        (GitHub Actions: bounded ~6h runs.)
 *   - DURATION_MS = 0  → run forever, flushing periodically.
 *                        (A persistent Render/Fly worker later.)
 *
 * Config via env:
 *   OUTPUT        output file path            (default: data/corpus.json)
 *   DURATION_MS   run length in ms, 0=forever (default: 0)
 *   FLUSH_MS      how often to save to disk   (default: 30000)
 *   LOG_MS        how often to log progress   (default: 60000)
 *   MAX_CORPUS    cap corpus length, 0=none   (default: 0)
 *   JETSTREAM_URL firehose endpoint           (default: jetstream2.us-east)
 */

const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const { classify } = require("./filters.js");

const OUTPUT = process.env.OUTPUT || path.join("data", "corpus.json");
const DURATION_MS = Number(process.env.DURATION_MS || 0);
const FLUSH_MS = Number(process.env.FLUSH_MS || 30000);
const LOG_MS = Number(process.env.LOG_MS || 60000);
const MAX_CORPUS = Number(process.env.MAX_CORPUS || 0);
const URL_JS = process.env.JETSTREAM_URL ||
  "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post";

/* ---------- load existing corpus (so repeated runs accumulate) ---------- */
let corpus = [];
try {
  const parsed = JSON.parse(fs.readFileSync(OUTPUT, "utf8"));
  if (Array.isArray(parsed)) corpus = parsed;
} catch (e) { corpus = []; }
const seen = new Set(corpus.map(d => d.text));
const startCount = corpus.length;

let dirty = false;
const stats = {
  raw: 0, posts: 0, matches: 0, reconnects: 0,
  rej: { lang: 0, exclude: 0, length: 0, link: 0, noinclude: 0 }
};

/* ---------- persistence (atomic: write temp, then rename) ---------- */
fs.mkdirSync(path.dirname(path.resolve(OUTPUT)), { recursive: true });

function flush() {
  if (!dirty) return;
  try {
    const tmp = OUTPUT + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(corpus));
    fs.renameSync(tmp, OUTPUT);
    dirty = false;
  } catch (e) {
    console.error("flush failed:", e.message);
  }
}

// Guarantee the output file exists from the start, even if this run catches
// zero dreams — otherwise downstream tooling (the commit step) has no file.
if (!fs.existsSync(OUTPUT)) { dirty = true; flush(); }

/* ---------- firehose ---------- */
let ws;
let stopping = false;

function connect() {
  ws = new WebSocket(URL_JS);
  ws.on("open", () => console.log("connected · jetstream"));
  ws.on("error", (e) => { console.error("ws error:", e.message); try { ws.close(); } catch (_) {} });
  ws.on("close", () => {
    if (stopping) return;
    stats.reconnects++;
    setTimeout(connect, 2000 + Math.random() * 3000);
  });
  ws.on("message", (data) => {
    stats.raw++;
    let m;
    try { m = JSON.parse(data); } catch (e) { return; }
    if (m.kind !== "commit") return;
    const c = m.commit;
    if (!c || c.operation !== "create" || c.collection !== "app.bsky.feed.post") return;
    const r = c.record;
    if (!r || typeof r.text !== "string") return;

    stats.posts++;
    const text = r.text.trim();
    const reason = classify(text, r.langs);
    if (reason) { stats.rej[reason]++; return; }

    stats.matches++;
    if (!seen.has(text)) {
      seen.add(text);
      corpus.push({ text, at: new Date().toISOString() });
      if (MAX_CORPUS > 0 && corpus.length > MAX_CORPUS) corpus = corpus.slice(-MAX_CORPUS);
      dirty = true;
    }
  });
}

/* ---------- timers ---------- */
const flushTimer = setInterval(flush, FLUSH_MS);
const logTimer = setInterval(() => {
  console.log(
    `[${new Date().toISOString()}] raw=${stats.raw} posts=${stats.posts} ` +
    `matches=${stats.matches} corpus=${corpus.length} (+${corpus.length - startCount}) ` +
    `reconnects=${stats.reconnects} rej=${JSON.stringify(stats.rej)}`
  );
}, LOG_MS);

/* ---------- shutdown ---------- */
function shutdown(code) {
  if (stopping) return;
  stopping = true;
  clearInterval(flushTimer);
  clearInterval(logTimer);
  flush();
  console.log(
    `done. corpus=${corpus.length} (+${corpus.length - startCount} this run) ` +
    `matches=${stats.matches}`
  );
  try { if (ws) ws.close(); } catch (_) {}
  process.exit(code || 0);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

if (DURATION_MS > 0) {
  setTimeout(() => { console.log(`duration ${DURATION_MS}ms reached, stopping`); shutdown(0); }, DURATION_MS);
}

console.log(
  `collector starting. output=${OUTPUT} duration=${DURATION_MS || "forever"} existing=${startCount}`
);
connect();
