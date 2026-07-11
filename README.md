# The Dreaming

An ambient art project that listens to what the internet dreams.

At night, people post their dreams to social media — spontaneous, first-person,
unguarded. **The Dreaming** harvests those fragments from the live Bluesky
firehose, distills them into aggregate patterns, and eventually renders them
back as a generative artwork. It is built in three stages, of which the first
is complete.

## Files

| File           | Role                                                                       |
| -------------- | -------------------------------------------------------------------------- |
| `index.html`   | Markup and font/stylesheet links only.                                     |
| `style.css`    | All presentation.                                                          |
| `ambience.js`  | The fullscreen canvas of drifting motes. Defines the shared `energy` symbol. |
| `stream.js`    | Stage 1: firehose connection, filtering, dream display, corpus, HUD, export. |

`ambience.js` **must** load before `stream.js`: both are classic (non-module)
scripts sharing one global scope, and `stream.js` nudges the `energy` value that
`ambience.js` declares and animates.

## Running it

It's a static page — open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000   # then visit http://localhost:8000
```

No build step, no backend (yet — see Stage 2). The corpus lives in
`localStorage`; press **d** for a debug HUD, move the mouse to reveal the export
tray.

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

- **Stage 1 output = raw dreams** — local only, never published.
- **Stage 2 output = distillations** — the *only* data that ever leaves the machine.
- **Stage 3 input = distillations only** — the artwork never touches a raw dream,
  so it cannot leak one.
