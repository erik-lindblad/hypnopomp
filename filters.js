/* Shared dream filters — the single source of truth for what counts as a dream.
 *
 * Used by BOTH the browser instrument (stream.js) and the headless collector
 * (collector.js), so a dream is judged identically no matter where it's caught.
 * UMD-ish: exports via CommonJS under Node, attaches to the global as
 * `DreamFilters` in the browser. No build step, works in both.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DreamFilters = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const INCLUDE = [
    /\bi (just )?(dreamt|dreamed)\b/i,
    /\bhad (a|the|this|such a|another) ?(weird|weirdest|strange|strangest|crazy|vivid|wild|awful|beautiful)? ?(dream|nightmare)\b/i,
    /\b(dream|dreamt|dreamed|nightmare)s? last night\b/i,
    /\blast night i (dreamt|dreamed|had a dream)\b/i,
    /\bwoke up from (a|this|that) (dream|nightmare)\b/i,
    /\brecurring (dream|nightmare)\b/i,
    /\bin my dream\b/i,
    /\bkept dreaming\b/i
  ];
  const EXCLUDE = /dream job|dream come true|dream team|dream house|dream home|dream car|dream girl|dream guy|in your dreams|wildest dreams|living the dream|dream big|dream come|dream of mine|dream collab|dream cast|dream blunt/i;
  const HAS_LINK = /https?:\/\/|www\./i;
  const MIN_LEN = 40;

  /* Judge one (already-trimmed) post. Returns a rejection reason
   * ("lang" | "length" | "link" | "exclude" | "noinclude") or null if accepted.
   * The reason strings match the stats.rej.* keys on both sides. */
  function classify(text, langs) {
    if (Array.isArray(langs) && langs.length && !langs.includes("en")) return "lang";
    if (text.length < MIN_LEN) return "length";
    if (HAS_LINK.test(text)) return "link";
    if (EXCLUDE.test(text)) return "exclude";
    if (!INCLUDE.some(rx => rx.test(text))) return "noinclude";
    return null;
  }

  return { INCLUDE, EXCLUDE, HAS_LINK, MIN_LEN, classify };
});
