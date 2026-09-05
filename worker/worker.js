/* The live feed: a Cloudflare Worker that reads the standings of every cup
 * under way and publishes, per window, the thresholds at a handful of ranks
 * and how far along the session is. The page reads the result as one more
 * reading and runs the model itself; nothing is forecast here.
 *
 * On a schedule (every 10 minutes): the week's calendar comes from the site,
 * the windows that are live now are picked out, each one's standings are
 * asked of Osirion's public API - the first page, then the pages holding the
 * cups' cuts (qualification first, then money, then cosmetics) and the
 * ladder's deeper rungs, a few pages at most - and the result is kept under
 * one key. On request: that key, as JSON, from any origin.
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
const DEEP = [250, 500, 1000, 2500];   // the ladder's deeper rungs, read when a page is to spare
const MAX_CUT = 5000;                  // deeper cuts are not fetched: too many pages
const MAX_PAGES = 3;                   // pages read per window beyond the first
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

/* The ranks a cup pays out on, as ranks, the ones that matter most first:
 * qualification, then money, then cosmetics. What the page asks for by
 * default, so their thresholds are read straight off the standings. */
function cutRanks(row) {
  const order = { q: 0, c: 1, i: 2 };
  return (row.tiers || [])
    .filter(t => order[t[0]] !== undefined && Number(t[1]) > 0 && Number(t[1]) <= MAX_CUT)
    .sort((a, b) => order[a[0]] - order[b[0]] || Number(a[1]) - Number(b[1]))
    .map(t => Number(t[1]))
    .filter((r, i, all) => all.indexOf(r) === i);
}

/* The widest of them: kept for the tests and the curious. */
function widestCut(row) {
  return Math.max(0, ...cutRanks(row));
}

/* The pages worth reading after the first, in the order they matter: the
 * cuts' pages first, then the ladder's deeper rungs, never past the board's
 * last page, and never more than MAX_PAGES. */
function pagesToRead(row, totalPages) {
  const last = totalPages > 0 ? totalPages * PAGE_SIZE : Infinity;
  const wanted = cutRanks(row).concat(DEEP).filter(r => r > PAGE_SIZE && r <= last);
  const pages = [];
  for (const rank of wanted) {
    const page = Math.floor((rank - 1) / PAGE_SIZE);
    if (!pages.includes(page)) pages.push(page);
    if (pages.length >= MAX_PAGES) break;
  }
  return pages;
}

async function readWindow(row, now) {
  const first = await board(row.event, row.window, 0);
  if (!first || !first.teams) return null;
  const readings = [];
  const seen = new Set();
  const wanted = RANKS.concat(cutRanks(row)).concat(DEEP);
  const takeFrom = (pairs) => {
    for (const [rank, points] of pairs) {
      if (rank >= 1 && points > 0 && wanted.includes(rank) && !seen.has(rank)) {
        seen.add(rank);
        readings.push([rank, points]);
      }
    }
  };
  takeFrom(first.pairs);
  for (const number of pagesToRead(row, first.totalPages)) {
    await sleep(GAP_MS);
    const page = await board(row.event, row.window, number);
    if (page) takeFrom(page.pairs);
  }
  readings.sort((a, b) => a[0] - b[0]);
  // Standings never rise with rank. A deeper page is read a moment after the
  // first, and early in an open queue the board is still being sorted between
  // the two: a rank read richer than a shallower one is the later board, not
  // this one, and is dropped so the reading is one snapshot.
  const settled = [];
  for (const r of readings) {
    if (!settled.length || r[1] <= settled[settled.length - 1][1]) settled.push(r);
  }
  const end = Date.parse(row.end);
  return {
    event: row.event, window: row.window, name: row.name, region: row.region,
    begin: row.begin, end: row.end,
    updated: first.updatedAt || new Date(now).toISOString(),
    // How many games the leaders have completed: the clock of a sealed lobby.
    games: first.games, teams: first.teams, pages: first.totalPages || null,
    readings: settled,
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
    return readPage(await res.text(), page);
  }
  return null;
}

/* What a page says: the (rank, points) of every roster on it, how many games
 * the leaders have played, the board's page count and its timestamp.
 *
 * A page is a hundred rosters with their game histories, a third of a
 * megabyte, and parsing it in full costs more of the CPU time the free plan
 * allows a run than reading several pages can afford. So the fast path picks
 * the few numbers it needs straight out of the text: every roster carries one
 * "rank" and one "pointsEarned", the two are paired as they come, and the
 * pairs are trusted only when they come out page-shaped - every pair in the
 * same order as the first, ranks consecutive from the page's first, points
 * never rising. Anything else, and the page is parsed properly. */
function readPage(text, page) {
  return scan(text, page) || parsePage(text);
}

function scan(text, page) {
  const re = /"(rank|pointsEarned)"\s*:\s*(-?\d+(?:\.\d+)?)/g;
  const pairs = [];
  let order = null, rank = null, points = null, m;
  while ((m = re.exec(text))) {
    const key = m[1];
    if (rank === null && points === null) {
      if (order === null) order = key;
      else if (key !== order) return null;              // a roster missing one of the two
    }
    if (key === "rank") { if (rank !== null) return null; rank = Number(m[2]); }
    else { if (points !== null) return null; points = Number(m[2]); }
    if (rank !== null && points !== null) { pairs.push([rank, points]); rank = points = null; }
  }
  if (rank !== null || points !== null) return null;
  if (!pairs.length || pairs.length > PAGE_SIZE) return null;
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i][0] !== page * PAGE_SIZE + i + 1) return null;
    if (i && pairs[i][1] > pairs[i - 1][1]) return null;
  }
  // The leaders' games: the sessions inside the first ten rosters' histories.
  const histories = /"sessionHistory"\s*:\s*\[/g;
  let games = 0, rosters = 0, h;
  while ((h = histories.exec(text))) {
    rosters++;
    if (rosters > 10) continue;
    const from = h.index + h[0].length, close = text.indexOf("]", from);
    if (close < 0) return null;
    const inside = text.slice(from, close);
    if (inside.indexOf("[") >= 0) return null;           // a shape this reader does not know
    const count = Math.max((inside.match(/"sessionId"/g) || []).length, (inside.match(/"endTime"/g) || []).length);
    if (count > games) games = count;
  }
  if (rosters && rosters !== pairs.length) return null;
  const total = text.match(/"totalPages"\s*:\s*(\d+)/);
  const updated = text.match(/"updatedAt"\s*:\s*"([^"]+)"/);
  return { pairs: pairs, teams: pairs.length, games: games,
           totalPages: total ? Number(total[1]) : 0, updatedAt: updated ? updated[1] : null, fast: true };
}

function parsePage(text) {
  let payload;
  try { payload = JSON.parse(text); } catch (err) { return null; }
  if (!payload || payload.success === false) return null;
  let inner = payload.leaderboard;
  if (!inner || !Array.isArray(inner.entries)) {
    if (!Array.isArray(payload.leaderboardData)) return null;
    inner = { entries: payload.leaderboardData, totalPages: payload.totalPages, updatedAt: payload.updatedAt };
  }
  const entries = inner.entries;
  return {
    pairs: entries.map(e => [Number(e.rank), Number(e.pointsEarned)]),
    teams: entries.length,
    games: Math.max(0, ...entries.slice(0, 10).map(e => (e.sessionHistory || []).length)),
    totalPages: Number(inner.totalPages) || 0,
    updatedAt: inner.updatedAt || null,
    fast: false,
  };
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

export { run, watched, widestCut, cutRanks, pagesToRead, readWindow, readPage, loadCalendar };
