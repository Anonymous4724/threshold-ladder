/* The live feed: a Cloudflare Worker that reads the standings of every cup
 * under way and publishes, per window, the thresholds at a handful of ranks
 * and how far along the session is. The page reads the result as one more
 * reading and runs the model itself; nothing is forecast here.
 *
 * On a schedule (every 10 minutes): the week's calendar comes from the site,
 * the windows that are live now are picked out, each one's standings are
 * asked of Osirion's public API - the first page, and the page holding the
 * widest cut - and the result is kept under one key. On request: that key,
 * as JSON, from any origin.
 *
 * Two things are kept. `live`, replaced at every run: the current reading of
 * the cups under way, what the page shows. And one key per day, `history-
 * YYYY-MM-DD`, to which every run appends its readings and which expires
 * after a month: what the research side pulls back into its database, so an
 * evening followed by the feed becomes a tournament with a reading every ten
 * minutes without anyone pressing anything.
 */

const API = "https://fnapi.osirion.gg/v1";
const AGENT = "threshold-ladder-live/1.0 (+https://github.com/Anonymous4724/threshold-ladder)";
const PAGE_SIZE = 100;                 // entries per leaderboard page
const RANKS = [1, 3, 5, 10, 20, 25, 50, 100];
const MAX_CUT = 5000;                  // deeper cuts are not fetched: too many pages
const LEAD_MINUTES = 5;                // a window is watched from this long before it opens
const TAIL_MINUTES = 25;               // ... until this long after it closes, for the final standing
const GAP_MS = 250;                    // between requests; the API allows 60 a minute
const KEY = "live";
const HISTORY_DAYS = 31;               // a day's history expires after this
const HISTORY_MAX = 400;               // readings kept per window per day (a run every 10 min is 144)
// Where the calendar comes from when the dashboard sets no variables: the
// site itself, then the repository's copy of the same file.
const DEFAULT_SITE = "https://fortnitepredcomp.com";
const DEFAULT_CALENDAR = "https://raw.githubusercontent.com/Anonymous4724/threshold-ladder/main/calendar.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(run(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (url.pathname === "/live.json") {
      const body = (await env.LIVE.get(KEY)) || JSON.stringify({ generated: null, windows: [] });
      return new Response(body, { headers: { ...CORS, "Content-Type": "application/json; charset=utf-8",
                                             "Cache-Control": "public, max-age=60" } });
    }
    const day = url.pathname.match(/^\/history\/(\d{4}-\d{2}-\d{2})\.json$/);
    if (day) {
      const body = (await env.LIVE.get("history-" + day[1])) || JSON.stringify({ day: day[1], windows: {} });
      return new Response(body, { headers: { ...CORS, "Content-Type": "application/json; charset=utf-8",
                                             "Cache-Control": "public, max-age=300" } });
    }
    if (url.pathname === "/refresh" && env.REFRESH_TOKEN && url.searchParams.get("token") === env.REFRESH_TOKEN) {
      const out = await run(env);
      return new Response(JSON.stringify(out), { headers: { ...CORS, "Content-Type": "application/json" } });
    }
    return new Response("threshold-ladder live feed: GET /live.json", { headers: CORS });
  },
};

/* ------------------------------------------------------------------ */

async function run(env) {
  const now = Date.now();
  const calendar = await loadCalendar(env);
  const previous = await readPrevious(env);
  const windows = (calendar.events || []).filter(row => watched(row, now));
  const out = [];
  for (const row of windows) {
    try {
      const entry = await readWindow(row, now);
      if (entry) out.push(entry);
      else keep(previous, row, out);
    } catch (err) {
      keep(previous, row, out);
    }
    await sleep(GAP_MS);
  }
  const doc = { generated: new Date(now).toISOString().slice(0, 16) + "Z", windows: out };
  await env.LIVE.put(KEY, JSON.stringify(doc));
  const kept = await remember(env, out, now);
  return { watched: windows.length, published: out.length, remembered: kept };
}

/* The day's history: every window read today, with each distinct reading
 * the feed took of it. One read and one write per run, whatever the number
 * of cups, so the free plan's daily write allowance is never in question. */
async function remember(env, out, now) {
  const day = new Date(now).toISOString().slice(0, 10);
  const key = "history-" + day;
  let doc;
  try { doc = JSON.parse((await env.LIVE.get(key)) || "null"); } catch (err) { doc = null; }
  if (!doc || typeof doc !== "object" || !doc.windows) doc = { day: day, windows: {} };
  let added = 0;
  for (const w of out) {
    if (!w.readings || !w.readings.length) continue;
    const id = w.event + "|" + w.window;
    const kept = doc.windows[id] || (doc.windows[id] = {
      event: w.event, window: w.window, name: w.name, region: w.region, begin: w.begin, end: w.end, readings: [] });
    if (kept.readings.some(r => r.updated === w.updated)) continue;
    kept.readings.push({ updated: w.updated, games: w.games, teams: w.teams, final: w.final, readings: w.readings });
    if (kept.readings.length > HISTORY_MAX) kept.readings = kept.readings.slice(-HISTORY_MAX);
    added++;
  }
  if (added) await env.LIVE.put(key, JSON.stringify(doc), { expirationTtl: HISTORY_DAYS * 86400 });
  return added;
}

/* The window is worth asking about: open now, give or take the minutes it
 * takes the standings to appear before and to settle after. Test formats the
 * model cannot read and second rounds played for first place only are left
 * out, as they are on the site. */
function watched(row, now) {
  const begin = Date.parse(row.begin), end = Date.parse(row.end);
  if (!isFinite(begin) || !row.event || !row.window) return false;
  if (row.mode === "Other") return false;
  if (/victory cup/i.test(row.name || "") && Number(row.stage) >= 2) return false;
  const opens = begin - LEAD_MINUTES * 60e3;
  const closes = (isFinite(end) ? end : begin + 4 * 3600e3) + TAIL_MINUTES * 60e3;
  return opens <= now && now <= closes;
}

async function loadCalendar(env) {
  // The site's own calendar first; the repository's copy when the site is
  // between two names. Either way it is `window.CALENDAR = {...};`.
  const site = (env.SITE || DEFAULT_SITE).replace(/\/$/, "");
  const sources = [site + "/calendar.js", env.CALENDAR_URL || DEFAULT_CALENDAR];
  for (const source of sources) {
    try {
      const res = await fetch(source, { headers: { "User-Agent": AGENT }, cf: { cacheTtl: 300 } });
      if (!res.ok) continue;
      const text = await res.text();
      const start = text.indexOf("{"), stop = text.lastIndexOf("}");
      if (start < 0 || stop < 0) continue;
      return JSON.parse(text.slice(start, stop + 1));
    } catch (err) { /* try the next */ }
  }
  return { events: [] };
}

async function readPrevious(env) {
  try { return JSON.parse((await env.LIVE.get(KEY)) || "{}"); } catch (err) { return {}; }
}

/* A window whose standings could not be read keeps its last reading, so a
 * hiccup at Osirion's end does not blank a cup for ten minutes. */
function keep(previous, row, out) {
  const old = (previous.windows || []).find(w => w.window === row.window && w.event === row.event);
  if (old) out.push(old);
}

/* The widest cut the cup pays out on, as a rank: what the page asks for by
 * default, so its threshold is read straight off the standings. */
function widestCut(row) {
  let cut = 0;
  for (const tier of row.tiers || []) {
    if ((tier[0] === "q" || tier[0] === "c" || tier[0] === "i") && Number(tier[1]) > cut) cut = Number(tier[1]);
  }
  return cut > 0 && cut <= MAX_CUT ? cut : 0;
}

async function readWindow(row, now) {
  const first = await board(row.event, row.window, 0);
  if (!first) return null;
  const entries = first.entries || [];
  if (!entries.length) return null;
  const readings = [];
  const seen = new Set();
  const take = (entry) => {
    const rank = Number(entry.rank), points = Number(entry.pointsEarned);
    if (rank >= 1 && points > 0 && !seen.has(rank)) { seen.add(rank); readings.push([rank, points]); }
  };
  for (const rank of RANKS) {
    const entry = entries.find(e => Number(e.rank) === rank);
    if (entry) take(entry);
  }
  const cut = widestCut(row);
  if (cut > PAGE_SIZE && !seen.has(cut)) {
    await sleep(GAP_MS);
    const page = await board(row.event, row.window, Math.floor((cut - 1) / PAGE_SIZE));
    const entry = ((page || {}).entries || []).find(e => Number(e.rank) === cut);
    if (entry) take(entry);
  } else if (cut && !seen.has(cut)) {
    const entry = entries.find(e => Number(e.rank) === cut);
    if (entry) take(entry);
  }
  readings.sort((a, b) => a[0] - b[0]);
  // How many games the leaders have completed: the clock of a sealed lobby.
  const games = Math.max(0, ...entries.slice(0, 10).map(e => (e.sessionHistory || []).length));
  const end = Date.parse(row.end);
  return {
    event: row.event, window: row.window, name: row.name, region: row.region,
    begin: row.begin, end: row.end,
    updated: first.updatedAt || new Date(now).toISOString(),
    games: games, teams: entries.length, pages: first.totalPages || null,
    readings: readings,
    final: isFinite(end) && now > end,
  };
}

async function board(eventId, windowId, page) {
  const url = API + "/tournaments/leaderboard?" + new URLSearchParams({
    leaderboardEventId: eventId, leaderboardEventWindowId: windowId, page: String(page) });
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": AGENT, "Accept": "application/json" } });
    if (res.status === 429 || res.status >= 500) { await sleep(2000 * (attempt + 1)); continue; }
    if (!res.ok) return null;
    const payload = await res.json();
    if (payload && payload.success === false) return null;
    const inner = payload && payload.leaderboard;
    if (inner && Array.isArray(inner.entries)) return inner;
    if (payload && Array.isArray(payload.leaderboardData)) {
      return { entries: payload.leaderboardData, totalPages: payload.totalPages, updatedAt: payload.updatedAt };
    }
    return null;
  }
  return null;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

export { run, watched, widestCut, readWindow, loadCalendar };
