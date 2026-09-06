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
 * one key. On request: that key, as JSON, from any origin. A closed lobby's
 * board is rebuilt as it stood when its last game ended (see `settle`), so
 * a reading taken mid-game does not carry half a game.
 *
 * Each page of a board is a request of its own, and the copies the API hands
 * back are not all the same age: a deeper page can be minutes older than the
 * first - or minutes younger - and a run can even be handed a first page
 * older than the one before. So every page's own timestamp is read, and a
 * reading from a page stamped at another time than the first carries that
 * time as a third element (`[rank, points, stamp]`): the page then clocks
 * each reading on its own time instead of taking the run as one snapshot.
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
// One lobby holds this many teams; Reload and Blitz lobbies seat forty players.
const LOBBY = { Solo: 100, Duo: 50, Trio: 33, Squad: 25 };
const LOBBY_SMALL = { Solo: 40, Duo: 20, Trio: 13, Squad: 10 };
const GAME_OVER_MS = 35 * 60e3;        // a game whose first death is this old is over, winner seen or not
const LOBBY_SHARE = 0.5;               // a match fewer teams than this played is not the lobby's game
const SCORING_AGREE = 0.8;             // share of rosters whose points the scoring table reproduces
const LEAD_MINUTES = 5;                // a window is watched from this long before it opens
const TAIL_MINUTES = 25;               // ... until this long after it closes, for the final standing
const LATE_MINUTES = 20;               // a lobby that started late has this long past the window to finish
const GAP_MS = 250;                    // between requests; the API allows 60 a minute
const SAME_SNAPSHOT_MS = 60e3;         // pages stamped this close together are one board
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
      let body = (await env.LIVE.get("history-" + day[1])) || JSON.stringify({ day: day[1], windows: {} });
      // One window's day, when asked for: what the page loads to draw an
      // evening it did not sit through.
      const eventId = url.searchParams.get("event"), windowId = url.searchParams.get("window");
      if (eventId && windowId) {
        let doc;
        try { doc = JSON.parse(body); } catch (err) { doc = { day: day[1], windows: {} }; }
        const id = eventId + "|" + windowId;
        const one = (doc.windows || {})[id];
        body = JSON.stringify({ day: doc.day || day[1], windows: one ? { [id]: one } : {} });
      }
      return new Response(body, { headers: { ...CORS, "Content-Type": "application/json; charset=utf-8",
                                             "Cache-Control": "public, max-age=120" } });
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
      const entry = await readWindow(row, now, calendar);
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
    // The same first page can come back with fresher deeper pages behind
    // it: a reading is the same one only when everything in it is.
    const body = JSON.stringify(w.readings);
    if (kept.readings.some(r => r.updated === w.updated && JSON.stringify(r.readings) === body)) continue;
    kept.readings.push({ updated: w.updated, games: w.games, teams: w.teams, final: w.final,
                         partial: w.partial === undefined ? null : w.partial, readings: w.readings });
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

function lobbyCap(team, mode) {
  return (/reload|blitz/i.test(mode || "") ? LOBBY_SMALL : LOBBY)[team] || 0;
}

/* One closed lobby, playing its games one after another: the calendar says
 * so when it knows the field, and a final whose field it does not know is
 * one when its board fits on a page and inside a lobby. */
function sealed(row, first) {
  const cap = lobbyCap(row.team, row.mode);
  if (!cap) return false;
  if (Number(row.field) > 0) return Number(row.field) <= cap;
  return Number(row.stage) >= 8 && (first.totalPages || 1) <= 1 && first.teams <= cap;
}

function stat(session, name) {
  const holder = session && typeof session.trackedStats === "object" && session.trackedStats ? session.trackedStats : session || {};
  const value = Number(holder[name]);
  return isFinite(value) ? value : 0;
}

function pointsFor(scoring, placement, elims) {
  let total = 0;
  for (const row of scoring.placement || []) {
    if (placement >= row[0] && placement <= row[1]) { total += Number(row[2]) || 0; break; }
  }
  const cap = scoring.kill_cap;
  const counted = cap ? Math.min(elims, Number(cap)) : elims;
  return total + counted * (Number(scoring.kill) || 0);
}

/* The standings of a closed lobby at the end of its last finished game.
 *
 * Mid-game, the board is half updated: the teams already out have their
 * placement and eliminations added, the teams still alive - the ones about
 * to take the most points - do not. Read then, a threshold is wrong by a
 * game's worth, in the wrong direction. Every roster carries its games one
 * by one, and the same match is the same session id for everyone in the
 * lobby, so the board can be rebuilt as it stood when the last game ended:
 * a game is over once a winner has been recorded in it (or once its first
 * death is half an hour old, for a match nobody won), and a team's settled
 * points are the sum of its finished games under the scoring table. A team
 * that missed a game is simply a team with one game fewer; nothing here
 * asks everyone to have played the same number.
 *
 * Returns null when the scoring table does not reproduce the rosters'
 * totals, so a table the calendar got wrong is never used to rewrite the
 * board. */
function settle(entries, scoring, now) {
  if (!scoring || !(scoring.placement || []).length) return null;
  const matches = new Map();
  const rosters = entries.map(e => (e.sessionHistory || []).filter(s => s && typeof s === "object"));
  rosters.forEach(sessions => sessions.forEach(s => {
    const id = String(s.sessionId || "");
    if (!id) return;
    const m = matches.get(id) || { won: false, teams: 0, first: Infinity };
    m.teams++;
    if (stat(s, "PLACEMENT_STAT_INDEX") === 1 || stat(s, "VICTORY_ROYALE_STAT") >= 1) m.won = true;
    const ended = Date.parse(s.endTime || "");
    if (isFinite(ended) && ended < m.first) m.first = ended;
    matches.set(id, m);
  }));
  const lobby = Math.max(1, Math.round(entries.length * LOBBY_SHARE));
  const over = new Set(), pending = new Set();
  matches.forEach((m, id) => {
    if (m.teams < lobby) return;                       // a stray match, not the lobby's game
    if (m.won || (isFinite(m.first) && now - m.first > GAME_OVER_MS)) over.add(id); else pending.add(id);
  });
  let agree = 0;
  const settled = entries.map((e, i) => {
    let all = 0, done = 0;
    rosters[i].forEach(s => {
      const points = pointsFor(scoring, stat(s, "PLACEMENT_STAT_INDEX") || 999, stat(s, "TEAM_ELIMS_STAT_INDEX"));
      all += points;
      if (over.has(String(s.sessionId || ""))) done += points;
    });
    if (Math.abs(all - (Number(e.pointsEarned) || 0)) <= 0.5) agree++;
    return { points: done, total: Number(e.pointsEarned) || 0, rank: Number(e.rank) || 0 };
  });
  if (!entries.length || agree / entries.length < SCORING_AGREE) return null;
  settled.sort((a, b) => b.points - a.points || b.total - a.total || a.rank - b.rank);
  return {
    pairs: settled.map((s, i) => [i + 1, s.points]),
    games: over.size,
    partial: pending.size > 0,
  };
}

async function readWindow(row, now, calendar) {
  const text = await board(row.event, row.window, 0);
  if (!text) return null;
  let first = readPage(text, 0);
  if (!first || !first.teams) return null;
  let partial = null;
  if (sealed(row, first)) {
    // The whole lobby is on the first page: rebuild it as of the last
    // finished game, when the scoring table lets us.
    const full = first.entries ? first : parsePage(text);
    const scoring = ((calendar || {}).scorings || [])[Number(row.scoring)];
    const stood = full && full.entries ? settle(full.entries, scoring, now) : null;
    if (stood) {
      first = { ...full, pairs: stood.pairs, games: stood.games };
      partial = stood.partial;
    }
  }
  const readings = [];
  const seen = new Set();
  const wanted = RANKS.concat(cutRanks(row)).concat(DEEP);
  const stamp0 = Date.parse(first.updatedAt || "");
  // A page stamped at another time than the first is another board: its
  // readings carry their own stamp, so nothing downstream mistakes the run
  // for one snapshot.
  const takeFrom = (pairs, stamp) => {
    const when = Date.parse(stamp || "");
    const same = !isFinite(when) || !isFinite(stamp0) || Math.abs(when - stamp0) < SAME_SNAPSHOT_MS;
    for (const [rank, points] of pairs) {
      if (rank >= 1 && points > 0 && wanted.includes(rank) && !seen.has(rank)) {
        seen.add(rank);
        readings.push(same ? [rank, points] : [rank, points, stamp]);
      }
    }
  };
  takeFrom(first.pairs, first.updatedAt);
  for (const number of pagesToRead(row, first.totalPages)) {
    await sleep(GAP_MS);
    const more = await board(row.event, row.window, number);
    const page = more ? readPage(more, number) : null;
    if (page) takeFrom(page.pairs, page.updatedAt);
  }
  readings.sort((a, b) => a[0] - b[0]);
  // Standings never rise with rank on one board. Among the readings of one
  // stamp, a rank read richer than a shallower one is a board still being
  // sorted, and is dropped; readings stamped at different times are
  // different boards and are not held against each other - an earlier
  // version did, and kept a stale page's low number while throwing away
  // the fresh pages that disagreed with it.
  const settled = [], lastOf = {};
  for (const r of readings) {
    const key = r[2] || "";
    if (lastOf[key] === undefined || r[1] <= lastOf[key]) { settled.push(r); lastOf[key] = r[1]; }
  }
  const end = Date.parse(row.end);
  return {
    event: row.event, window: row.window, name: row.name, region: row.region,
    begin: row.begin, end: row.end,
    updated: first.updatedAt || new Date(now).toISOString(),
    // How many games are finished: the clock of a sealed lobby. In an open
    // queue, the most the leaders have completed.
    games: first.games, teams: first.teams, pages: first.totalPages || null,
    // In a sealed lobby: whether a game is under way, the standings above
    // being those at the end of the last finished one. Null where that
    // reading is not made.
    partial: partial,
    readings: settled,
    // The window's clock has run out. A sealed lobby that started late is
    // still playing, though, and its board is not the final one while it
    // owes games: called final too early, the answer would be pinned to a
    // standing with a game missing.
    final: isFinite(end) && now > end &&
      !(partial !== null && Number(row.games) > 0 && Number(first.games) < Number(row.games)
        && now < end + LATE_MINUTES * 60e3),
  };
}

async function board(eventId, windowId, page) {
  const url = API + "/tournaments/leaderboard?" + new URLSearchParams({
    leaderboardEventId: eventId, leaderboardEventWindowId: windowId, page: String(page) });
  const headers = { "User-Agent": AGENT, "Accept": "application/json" };
  for (let attempt = 0; attempt < 3; attempt++) {
    // Straight from the API, never from a copy this side kept: a board is
    // worth reading only as it is now. Older runtimes reject the option and
    // are asked again without it.
    let res;
    try { res = await fetch(url, { headers: headers, cache: "no-store" }); }
    catch (err) { res = await fetch(url, { headers: headers }); }
    if (res.status === 429 || res.status >= 500) { await sleep(2000 * (attempt + 1)); continue; }
    if (!res.ok) return null;
    return res.text();
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
    entries: entries,
    fast: false,
  };
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

export { run, watched, widestCut, cutRanks, pagesToRead, readWindow, readPage, settle, sealed, loadCalendar };
