# The Dreaming

An ambient art project that listens to what the internet dreams.

At night, people post their dreams to social media — spontaneous, first-person,
unguarded. **The Dreaming** harvests those fragments from the live Bluesky
firehose, distills them into aggregate patterns, and eventually renders them
back as a generative artwork. It is built in three stages, of which the first
is complete.

## Files

| File                          | Role                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `index.html`                  | Markup and font/stylesheet links only.                                        |
| `style.css`                   | All presentation.                                                             |
| `filters.js`                  | The dream-detection rules. Shared by the browser and the collector.           |
| `ambience.js`                 | The fullscreen canvas of drifting motes. Defines the shared `energy` symbol.  |
| `stream.js`                   | The browser instrument: firehose, dream display, localStorage corpus, HUD, export. |
| `collector.js`                | The headless collector: same firehose + filters, writes the corpus to a file. |
| `package.json`                | Node manifest for the collector (its one dependency is `ws`).                  |
| `.github/workflows/collect.yml` | Scheduled job that runs the collector and commits the corpus (Stage 1 beta). |
| `public/index.html`           | The public display: a twistori-style drift of the collected corpus. Deployed as a static site. |

In the browser, load order matters — `filters.js`, `ambience.js`, `stream.js`
are classic (non-module) scripts sharing one global scope: `filters.js` defines
`DreamFilters`, `ambience.js` defines the `energy` value that `stream.js` nudges,
so both must load before `stream.js`.

`filters.js` is the **single source of truth** for what counts as a dream. Both
the browser (`stream.js`) and the headless `collector.js` call its `classify()`,
so a post is judged identically no matter where it's caught — the corpus never
depends on how it was collected.

## Running it

It's a static page — open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000   # then visit http://localhost:8000
```

No build step. The corpus lives in `localStorage`; press **d** for a debug HUD,
move the mouse to reveal the export tray.

## Collecting without a browser

The browser instrument only harvests while a tab is open and awake — no good for
overnight collection. `collector.js` is the headless twin: it opens the same
firehose, applies the same `filters.js` rules, and writes the corpus to a **file**
(`data/corpus.json`) in the exact `[{ text, at }]` shape the browser exports.

Run it locally:

```
npm install
OUTPUT=data/corpus.json DURATION_MS=60000 npm run collect   # listen 60s, then exit
```

Environment variables:

| Var            | Default            | Meaning                                          |
| -------------- | ------------------ | ------------------------------------------------ |
| `OUTPUT`       | `data/corpus.json` | Where to write the corpus.                       |
| `DURATION_MS`  | `0`                | Run length in ms. **`0` means run forever.**     |
| `FLUSH_MS`     | `30000`            | How often to save to disk.                       |
| `MAX_CORPUS`   | `0`                | Cap on corpus length (`0` = unbounded).          |

Repeated runs load the existing file first and accumulate (deduplicated by text),
so collection survives across separate runs.

## Deployment

### Now — GitHub Actions (Stage 1 beta)

`.github/workflows/collect.yml` runs the collector on a schedule, then commits
`data/corpus.json` back to the repo.

**This repo is private, and the window is kept short to stay free.** A private
repo gets ~2,000 Actions minutes/month. A full 5.5h nightly run would burn that
in ~6 nights, so the schedule instead listens **~50 min/night** during the
densest hour of US dream-posting (12:00 UTC ≈ 8am ET / 7am CT). That's
~52 min/night × 31 ≈ 1,600 min/month — nightly, year-round, comfortably free.

The tradeoff: a short window **samples the peak hour** rather than sweeping the
whole coast-to-coast morning. If you later want nightly *full-length* collection,
making the repo **public** unlocks unlimited Actions minutes — acceptable because
the corpus is anonymized (only `{ text, at }`, no handle/DID/link), consistent
with the amendment below. (Before going public, confirm no secrets are in the
tree or history — this project has none; it uses only the public Bluesky
jetstream, no auth.)

Setup:

1. Create a **private** GitHub repo and push this project to it.
2. In the repo, open **Actions** and enable workflows if prompted.
3. Trigger a test run: **Actions → collect-dreams → Run workflow** (defaults to a
   5-minute listen). Check the run log, then look for a `[skip ci] corpus: N
   dreams` commit.
4. Adjust the `cron` in `collect.yml` to your local peak (cron is UTC).

Collection here is *sampled*, not continuous — which is exactly what Stage 1
needs, since its job is to validate the material (dreams/hour, quality), not to
capture every dream.

### Later — a persistent worker (Stage 1 → continuous)

For gap-free 24/7 collection, run the **same `collector.js`** on an always-on
host (Render background worker, Fly.io machine, etc.) with `DURATION_MS=0` so it
runs forever, pointing `OUTPUT` at a persistent disk (or adapt the flush to push
to a store). No code changes — only the deploy wrapper differs. This is a paid,
always-on upgrade; the GitHub Actions path above is the free beta.

## The public display

`public/index.html` renders the collected corpus as a twistori-inspired drift —
anonymous dream fragments rising slowly through the dark, cycling endlessly
through a shuffled `corpus.json`. It's a self-contained static page: it fetches
`corpus.json` (served alongside it) and needs no backend.

**Deploy as a Render Static Site** (free, always-on, CDN-served — unlike the
paid always-on worker above):

1. Render → **New → Static Site**, connect this **private** repo.
2. **Build Command:** `cp data/corpus.json public/corpus.json`
   (this bakes the latest corpus into the published site).
3. **Publish Directory:** `public`
4. Leave **Auto-Deploy** on. Each nightly `[skip ci] corpus: N dreams` commit
   then redeploys the site with fresh dreams. (`[skip ci]` is a GitHub-Actions
   marker; Render uses its own `[skip render]`, so these commits still deploy —
   confirm on the first nightly run.)

Locally, mirror the build with `cp data/corpus.json public/corpus.json` and serve
the `public/` folder. `public/corpus.json` is git-ignored — it's generated, not
source.

Per the data-contract amendment, this displays raw dream text but only
anonymously (no handle, DID, or link is ever collected).

## The three-stage plan

### Stage 1 — The Instrument  *(implemented)*

Connect to the Bluesky Jetstream firehose, filter posts for spontaneous
first-person dream reports (regex include/exclude patterns), display matches one
at a time as an ambient fullscreen stream, and collect a deduplicated corpus in
`localStorage` with JSON export.

**Purpose:** validation — measure dreams/hour and assess the quality of the raw
material.

### Stage 2 — The Distiller  *(next)*

A scheduled backend worker (cron, e.g. hourly) takes each batch of collected
dreams, sends them to an LLM, and produces a structured distillation: recurring
motifs, emotional weather, a color palette, and one summary sentence in the form
*"Last night, the internet dreamt of…"*. Distillations are stored in a database
as the project's long-term memory.

**Privacy is architectural:** raw dreams are never published, quoted, or
attributed — only aggregate distillations leave this layer.

### Stage 3 — The Dream  *(final)*

Replace the text stream with a generative visual artwork driven entirely by the
Stage 2 distillation JSON: motifs become forms, emotional weather becomes motion
and turbulence, palette becomes light. An ambient, slowly evolving fullscreen
canvas — never the same twice, always derived from what was actually dreamt.

## Data contract

The stages are separated by a strict, one-directional flow of data. This is a
privacy guarantee, not just an architecture note:

- **Stage 1 output = raw dreams** — local only, never published *except* via the
  anonymized public display (see amendment below).
- **Stage 2 output = distillations** — the *only* data that ever leaves the machine.
- **Stage 3 input = distillations only** — the artwork never touches a raw dream,
  so it cannot leak one.

### Amendment — the anonymized public display

The original contract said raw dreams are *never* published. The `public/`
display is a deliberate, scoped exception: it shows raw dream **text** publicly,
but only under strict anonymity. This is considered acceptable because:

- The source posts are **already public** on the open social web.
- The collector stores **only `{ text, at }`** — no author handle, no DID, no
  post link. There is no stored path back to the person who dreamt it, so the
  display is anonymous by construction, not by promise.

The rest of the contract stands: nothing that could **re-attribute** a dream
(handle, DID, URL) is ever collected, stored, or shown.
