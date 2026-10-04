/* The live feed: a Cloudflare Worker that reads the standings of every cup
 * under way and publishes, per window, the thresholds at a handful of ranks
 * and how far along the session is. The page reads the result as one more
 * reading and runs the model itself; nothing is forecast here.
 *
 * On a schedule (every 5 minutes): the week's calendar comes from the site,
 * the windows that are live now are picked out, each one's standings are
 * asked of Osirion's public API - the first page, then the pages holding the
 * cups' cuts (qualification first, then money, then cosmetics) and the
 * ladder's deeper rungs, a few pages at most - and the result is kept under
 * one key. Around a window's close the same trigger looks again on each
 * minute until the next one: the first page and the cuts' pages only (see
 * `cycle`). On request: that key, as JSON, from any origin. A closed lobby's
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
 * evening followed by the feed becomes a tournament with a reading every five
 * minutes without anyone pressing anything. Each reading also carries the
 * board's page count at the time - a hundred rosters a page - and, where the
 * API pages the board whole, the exact count off its last page: how many
 * have played so far.
 *
 * Past ten thousand the API stops paging, but every roster still carries
 * Epic's percentile: its place in the whole field, the rosters past the last
 * page included, rounded down to the tenth - 0 in the top 10 %, 0.1 in the
 * next tenth. Where it steps up from one rank to the next, the field is ten
 * times that rank over the new tenth, to a few rosters, and the first step
 * sits at a tenth of the field: inside the ten thousand the API pages, for
 * any field up to a hundred thousand. So a board at the ceiling is read a
 * page or two further on each full pass, where the step should be, and the
 * count is published with `rankedFrom: "percentile"` - or, while the step is
 * still being looked for, the least the field can be, as "percentile-min"
 * (see `fieldBounds`).
 */

const API = "https://fnapi.osirion.gg/v1";
const AGENT = "threshold-ladder-live/1.0 (+https://github.com/Anonymous4724/threshold-ladder)";
const PAGE_SIZE = 100;                 // entries per leaderboard page
const RANKS = [1, 3, 5, 10, 20, 25, 50, 100];
const DEEP = [250, 500, 1000, 2500];   // the ladder's deeper rungs, read when a page is to spare
// A cut's page is one request, however deep: the FNCS Solo qualifiers send
// 8,000 players on in Europe, and a cut not read is a forecast left to guess.
// The API pages a board down to rank 10,000 and no further.
const MAX_CUT = 10000;
const MAX_PAGES = 3;                   // pages read per window beyond the first
// The API pages a board this deep at most. A board on its last page is ten
// thousand rosters or more, and how many more only the rosters' percentiles
// say (see `fieldBounds`).
const PAGES_CAP = 100;
// Pages read per full pass, beyond the ones read for the cuts, to find where
// the percentile steps up on a board at the ceiling; and how narrow the field
// has to be pinned, in rosters, before the search stops.
const FIELD_EXTRA = 3;
const FIELD_PIN = 20;
// One lobby holds this many teams; Reload and Blitz lobbies seat forty players.
const LOBBY = { Solo: 100, Duo: 50, Trio: 33, Squad: 25 };
const LOBBY_SMALL = { Solo: 40, Duo: 20, Trio: 13, Squad: 10 };
const GAME_OVER_MS = 35 * 60e3;        // a game whose first death is this old is over, winner seen or not
const LOBBY_SHARE = 0.5;               // a match fewer teams than this played is not the lobby's game
const SCORING_AGREE = 0.8;             // share of rosters whose points the scoring table reproduces
const LEAD_MINUTES = 5;                // a window is watched from this long before it opens
// ... until this long after it closes. The board keeps rising after the
// buzzer: twenty minutes for most cups, but the feed's own first forty evenings
// caught three-hour practice cups still 3 to 7 % short of their final board at
// +25, the minute the feed used to stop looking.
const TAIL_MINUTES = 45;
const LATE_MINUTES = 20;               // a lobby that started late has this long past the window to finish
// The endgame: from this many minutes before a window closes until this many
// after, the standings move fastest - a point a minute at the ranks a cup
// qualifies on - and a reading five minutes old is several points behind what
// a player sees. The cron runs every five minutes and each firing makes a full
// pass over every window under way; while a window is in its endgame the same
// firing then makes a light pass on each minute until the next one: the first
// page and the pages the cuts fall on, of the windows in their endgame only.
// What the API hands back for a page is a copy it renews every few minutes,
// so most of those looks find the board they already had and file nothing;
// the one that finds the new copy has it minutes sooner than the next full
// pass would.
const QUICK_BEFORE = 20;
const QUICK_AFTER = 20;
const STEP_MS = 60e3;                  // between the light passes of one firing
// A firing asks nothing of the API past this long after its mark: its last
// write is then more than a minute old when the next firing reads the
// namespace, which may serve a copy that old. Closer than that, the next
// firing could file the day on top of a copy without this one's last reading.
const CYCLE_MS = 230e3;
const GAP_MS = 250;                    // between requests; the API allows 60 a minute
// What a pass may ask of the API, shared among the windows it reads, and how
// long it may go on asking. A full pass and the light pass after it can fall
// in the same minute: together they stay under the API's sixty.
const PASS_REQUESTS = 46;
const STEP_REQUESTS = 12;
const WINDOW_REQUESTS = 9;             // the most one window may take of them, retries included
const PASS_MS = 45e3;
const STEP_PASS_MS = 30e3;
// A request the API has not answered by then is a page not read.
const FETCH_TIMEOUT_MS = 12e3;
const SAME_SNAPSHOT_MS = 60e3;         // pages stamped this close together are one board
const KEY = "live";
const HISTORY_DAYS = 31;               // a day's history expires after this
const HISTORY_MAX = 400;               // readings kept per window per day (a pass every five minutes is 288)
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
    // Cron every five minutes. The firing is awaited, not only handed to
    // waitUntil: it can go on for most of the five minutes (see `cycle`).
    const at = Number(event && event.scheduledTime) || Date.now();
    const work = cycle(env, at);
    ctx.waitUntil(work);
    await work;
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
      const out = await run(env, url.searchParams.get("quick") === "1");
      return new Response(JSON.stringify(out), { headers: { ...CORS, "Content-Type": "application/json" } });
    }
    return new Response("threshold-ladder live feed: GET /live.json", { headers: CORS });
  },
};

/* ------------------------------------------------------------------ */

/* One firing of the cron: the full pass, then - while a window is in its
 * endgame - a light pass on each minute until the next firing is due. The
 * passes of one firing follow one another and share what they know (`state`:
 * the calendar, the document last published, the day's history), so none of
 * them reads back from the namespace a copy older than what the pass before
 * it wrote. The minutes are counted from the firing's own mark, not from when
 * it started: a firing that starts late skips the looks it has missed rather
 * than running into the next one. */
async function cycle(env, at) {
  // No pass of this firing asks the API anything past `until`.
  const state = { until: at + CYCLE_MS };
  const results = [];
  try { results.push(await run(env, false, state)); } catch (err) { console.error(err); results.push({ error: String(err) }); }
  // A calendar that is not the list it should be has no window to look at.
  const closing = (row, t) => { try { return watched(row, t) && endgame(row, t); } catch (err) { return false; } };
  for (let due = at + STEP_MS; due < at + CYCLE_MS; due += STEP_MS) {
    const listed = (state.calendar || {}).events;
    const events = Array.isArray(listed) ? listed : [];
    // Nothing in its endgame between here and the next firing: nothing more
    // to do, and the firing ends here - which is most of them.
    let ahead = false;
    for (let t = Math.max(due, Date.now()); t < at + CYCLE_MS && !ahead; t += STEP_MS) {
      ahead = events.some(row => closing(row, t));
    }
    if (!ahead) break;
    const wait = due - Date.now();
    if (wait < -STEP_MS / 4) continue;               // this minute has gone by
    if (wait > 0) await sleep(wait);
    const now = Date.now();
    // A pass that has only just started - a firing that was late, a full pass
    // that ran long - has read what this look would.
    if (now - (state.started || 0) < STEP_MS / 2) continue;
    if (!events.some(row => closing(row, now))) continue;
    try { results.push(await run(env, true, state)); } catch (err) { console.error(err); results.push({ error: String(err) }); }
  }
  return results;
}

/* One pass. A full pass reads every window under way; a light one (`quick`)
 * the windows in their endgame only, the others keeping their last reading.
 * `state`, when one firing makes several passes, carries the calendar, the
 * document last published and the day's history from one to the next. */
async function run(env, quick, state) {
  const now = Date.now();
  // A firing that starts when its time is all but up has nothing to ask, and
  // nothing to publish over what the firing after it will.
  if (state && state.until && now >= state.until) return { quick: !!quick, watched: 0, published: 0, remembered: 0, late: true };
  if (state) state.started = now;
  const calendar = state && state.calendar ? state.calendar : await loadCalendar(env);
  const previous = state && state.doc ? state.doc : await readPrevious(env);
  if (state) state.calendar = calendar;
  const windows = (calendar.events || []).filter(row => watched(row, now));
  // The pass's requests are one pool, retries included. A window takes what
  // it needs of it, up to WINDOW_REQUESTS, as long as two are left for each
  // of the windows still to come: the first page and one more.
  let pool = quick ? STEP_REQUESTS : PASS_REQUESTS;
  let waiting = (quick ? windows.filter(row => endgame(row, now)) : windows).length;
  const until = Math.min(Date.now() + (quick ? STEP_PASS_MS : PASS_MS), state && state.until ? state.until : Infinity);
  // A pass that runs out of time leaves its last windows with the reading
  // they had: the window it starts with moves on by one at every pass, so it
  // is never the same ones. The document keeps the calendar's order.
  const first = windows.length ? Math.floor(now / (quick ? STEP_MS : 5 * STEP_MS)) % windows.length : 0;
  const entries = new Array(windows.length).fill(null);
  for (let k = 0; k < windows.length; k++) {
    const at = (first + k) % windows.length, row = windows[at];
    const before = (previous.windows || []).find(w => w.window === row.window && w.event === row.event) || null;
    // The light pass leaves everything but the endgame alone, with its last
    // reading standing: nothing is lost, and the calls go where the board is
    // actually moving.
    if (quick && !endgame(row, now)) { entries[at] = before; continue; }
    waiting -= 1;
    const meter = { left: Math.max(0, Math.min(WINDOW_REQUESTS, Math.max(pool - 2 * waiting, Math.min(2, pool)))), until: until };
    const granted = meter.left;
    // A window whose standings could not be read keeps its last reading, so a
    // hiccup at Osirion's end does not blank a cup until the next pass.
    try { entries[at] = (await readWindow(row, now, calendar, quick, before, meter)) || before; }
    catch (err) { entries[at] = before; }
    pool -= granted - meter.left;
    await sleep(GAP_MS);
  }
  const out = entries.filter(Boolean);
  // A light pass that found every board as the pass before it left them has
  // nothing to publish: the document stands, with the minute it was made.
  if (quick && state && state.doc && !state.unfiled && JSON.stringify(state.doc.windows || []) === JSON.stringify(out)) {
    return { quick: true, watched: windows.length, published: out.length, remembered: 0, unchanged: true };
  }
  const doc = { generated: new Date(now).toISOString().slice(0, 16) + "Z", windows: out };
  await env.LIVE.put(KEY, JSON.stringify(doc));
  if (state) state.doc = doc;
  let kept;
  try { kept = await remember(env, out, now, state); }
  catch (err) {
    // The day could not be written: what this firing holds of it is no
    // longer what the namespace holds. The next pass reads the day again and
    // files, whether or not it finds a new board.
    if (state) { state.history = null; state.unfiled = true; }
    throw err;
  }
  if (state) state.unfiled = false;
  return { quick: !!quick, watched: windows.length, published: out.length, remembered: kept };
}

/* The last minutes of a window and the settling that follows it: where the
 * standings move fast enough for a five-minute-old reading to be wrong by
 * several points. See QUICK_BEFORE. */
function endgame(row, now) {
  const end = Date.parse(row.end);
  if (!isFinite(end)) return false;
  return now >= end - QUICK_BEFORE * 60e3 && now <= end + QUICK_AFTER * 60e3;
}

/* The day's history: every window read today, with each distinct reading
 * the feed took of it. One read and one write per run at most, whatever the
 * number of cups: what a day costs in writes does not grow with the calendar. */
async function remember(env, out, now, state) {
  const day = new Date(now).toISOString().slice(0, 10);
  const key = "history-" + day;
  // The passes of one firing hand the day on to one another: read back from
  // the namespace a minute after it was written, it can still be the copy
  // from before, and filing on top of that would drop what the last pass
  // added.
  let doc = state && state.history && state.history.key === key ? state.history.doc : null;
  if (!doc) {
    // A day that cannot be read is not an empty one: written over, it would
    // lose every reading it holds - and a namespace that has served its
    // reads for the day fails every read until midnight UTC. It is left
    // alone this run; only a value that does not parse is started again.
    let stored;
    try { stored = await env.LIVE.get(key); } catch (err) { return 0; }
    try { doc = JSON.parse(stored || "null"); } catch (err) { doc = null; }
    if (!doc || typeof doc !== "object" || !doc.windows) doc = { day: day, windows: {} };
  }
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
    // The page count says how many rosters the board ranked when it was
    // read - who has played so far, growing through the session - and it
    // is kept so the research side can measure the pace of a cup's arrival
    // as well as its points.
    // A count past the ceiling is kept once the percentiles have pinned it;
    // the least the field can be, while the search goes on, is not a count.
    const counted = w.ranked && w.rankedFrom !== "percentile-min";
    // The calendar knows when a window ends, and it can move: the day's
    // record follows it, since the research side reads the close to tell a
    // settled board from one still running.
    for (const k of ["name", "begin", "end"]) if (w[k]) kept[k] = w[k];
    kept.readings.push({ updated: w.updated, games: w.games, teams: w.teams, pages: w.pages || null,
                         ranked: counted ? w.ranked : null, rankedFrom: counted ? w.rankedFrom || null : null, final: w.final,
                         partial: w.partial === undefined ? null : w.partial, readings: w.readings });
    if (kept.readings.length > HISTORY_MAX) kept.readings = kept.readings.slice(-HISTORY_MAX);
    added++;
  }
  if (added) await env.LIVE.put(key, JSON.stringify(doc), { expirationTtl: HISTORY_DAYS * 86400 });
  if (state) state.history = { key: key, doc: doc };
  return added;
}

/* The window is worth asking about: open now, give or take the minutes it
 * takes the standings to appear before and to settle after. Second rounds
 * played for first place only are left out, as they are on the site. A format
 * the model has never measured - an Arena evaluation on its own playlist - is
 * read like any other: the model cannot price it, but its standings are a
 * fact, and the page shows them for what they are. */
function watched(row, now) {
  const begin = Date.parse(row.begin), end = Date.parse(row.end);
  if (!isFinite(begin) || !row.event || !row.window) return false;
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

/* The last run's document. Anything else under its key - `null`, a hand
 * edit - is no previous reading: taken for one, it would fail every run that
 * has a cup to read, and none of them would write over it. */
async function readPrevious(env) {
  let doc;
  try { doc = JSON.parse((await env.LIVE.get(KEY)) || "{}"); } catch (err) { return {}; }
  return doc && Array.isArray(doc.windows) ? doc : {};
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
 * last page, and never more than MAX_PAGES. A light pass reads the cuts'
 * pages only. */
function pagesToRead(row, totalPages, light) {
  const last = totalPages > 0 ? totalPages * PAGE_SIZE : Infinity;
  const wanted = (light ? cutRanks(row) : cutRanks(row).concat(DEEP)).filter(r => r > PAGE_SIZE && r <= last);
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

async function readWindow(row, now, calendar, light, before, meter) {
  const text = await board(row.event, row.window, 0, meter);
  if (!text) return null;
  let first = readPage(text, 0);
  if (!first || !first.teams) return null;
  // The API can hand back a first page older than the one it gave a minute
  // ago. A look that finds one has found nothing: the reading stands.
  if (light && before && first.updatedAt && before.updated && Date.parse(first.updatedAt) < Date.parse(before.updated)) return null;
  // On a board at the ceiling, every page read says something about the
  // field through its rosters' percentiles (see fieldBounds).
  const capped = (first.totalPages || 0) >= PAGES_CAP;
  const bounds = [], readPages = [0];
  const noteField = page => {
    if (!capped || !page) return;
    const b = fieldBounds(page.pairs, page.tenths);
    if (b) bounds.push({ low: b.low, high: b.high, stamp: Date.parse(page.updatedAt || "") || 0 });
  };
  noteField(first);
  // How many rosters the board ranks: every page but the last holds a
  // hundred, and the last page says the rest - one more request on a full
  // pass, none on a board that fits on one page. A board that reaches the
  // API's last page has no last page to count: its rosters' percentiles say
  // the field instead (below). A light pass keeps the previous count while
  // the page count has not moved.
  const total = first.totalPages || 0;
  let ranked = null;
  if (total === 1) ranked = first.teams;
  else if (total > 1 && total < PAGES_CAP) {
    if (light) ranked = before && before.pages === total && before.ranked > 0 ? before.ranked : null;
  }
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
  // The light pass stops at the cuts' pages: the top hundred and the ranks a
  // cup pays out on, read minutes sooner. The ladder's deeper rungs keep their
  // reading from the full pass - the page holds each rank's latest reading
  // whichever run it arrived in.
  const pages = pagesToRead(row, first.totalPages, light);
  // The last page, for the count, when a full pass has not read it already.
  const last = total > 1 && total < PAGES_CAP ? total - 1 : -1;
  if (!light && last >= 0 && !pages.includes(last)) pages.push(last);
  for (const number of pages) {
    await sleep(GAP_MS);
    const more = await board(row.event, row.window, number, meter);
    const page = more ? readPage(more, number) : null;
    readPages.push(number);
    if (page) { takeFrom(page.pairs, page.updatedAt); noteField(page); }
    if (page && number === last && !light) ranked = await countFrom(row, page, number, meter);
  }
  let rankedFrom = ranked > 0 ? "last page" : null;
  let fieldOut = null;
  if (capped) {
    // The field only grows, so what the last pass knew of it is the least
    // it can be now; the pages read this pass bound it from above, and a page
    // or two more, where the percentile should step up, pin it. The search
    // goes on from pass to pass: the last pass's bounds, published beside the
    // count, say where to look first. A light pass does not search, and
    // keeps what the last full one found.
    const prev = before && Number(before.ranked) > 0 ? Number(before.ranked) : 0;
    const was = before && Array.isArray(before.field) ? before.field : null;
    const least = Math.max(was && Number(was[0]) > 0 ? Number(was[0]) : 0,
                           before && before.rankedFrom === "last page" && prev ? prev - 1 : 0);
    let field = light ? null : combineField(bounds, least);
    for (let extra = 0; field && extra < FIELD_EXTRA && field.high - field.low > FIELD_PIN; extra++) {
      // First where the step was last time, a little further on, since the
      // field has grown; or, while it is still being narrowed down, halfway
      // into what the last pass had narrowed it to; then halfway between the
      // bounds, which a field that grew faster than that has moved.
      let guess = 0;
      if (extra === 0 && before && before.rankedFrom === "percentile" && prev) guess = prev * 1.02;
      else if (extra === 0 && was && Number(was[1]) > 0) guess = (field.low + Math.min(Number(was[1]) * 1.02, field.high)) / 2;
      const number = fieldPage(field.low, field.high, guess);
      if (number < 0 || readPages.includes(number)) break;
      await sleep(GAP_MS);
      const more = await board(row.event, row.window, number, meter);
      const page = more ? readPage(more, number) : null;
      readPages.push(number);
      if (!page) break;
      takeFrom(page.pairs, page.updatedAt);
      noteField(page);
      field = combineField(bounds, least);
    }
    if (light) {
      if (prev) { ranked = prev; rankedFrom = before.rankedFrom === "percentile" ? "percentile" : "percentile-min"; fieldOut = was; }
    } else if (field) {
      fieldOut = [Math.floor(field.low), isFinite(field.high) ? Math.ceil(field.high) : null];
      if (field.high - field.low <= FIELD_PIN) {
        ranked = Math.round((field.low + field.high) / 2);
        rankedFrom = "percentile";
      } else if (field.low > PAGES_CAP * PAGE_SIZE) {
        // Not pinned yet: the least the field can be, said as such.
        ranked = Math.ceil(field.low);
        rankedFrom = "percentile-min";
      }
    }
  }
  // A pass that finds the first page it already had is the same board looked
  // at again. The ranks it did not read - a light pass does not ask for the
  // deeper rungs, and any pass can miss a page - keep the reading the last
  // pass published, and so does a rank whose page came back as an older copy
  // than the one in hand. The document loses nothing that way, and a look
  // that found nothing new comes out as the entry it started from.
  if (before && first.updatedAt && before.updated === first.updatedAt && Array.isArray(before.readings)) {
    const clock = (r, base) => Date.parse(r[2] || base);
    for (const r of before.readings) {
      if (!Array.isArray(r)) continue;
      const at = readings.findIndex(x => x[0] === r[0]);
      if (at < 0) { seen.add(r[0]); readings.push(r); }
      else if (clock(readings[at], first.updatedAt) < clock(r, before.updated)) readings[at] = r;
    }
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
    // The rosters the board ranks: exactly off the last page where the API
    // pages the board whole ("last page"); past the ceiling, from the
    // rosters' percentiles, to a few rosters once the step is found
    // ("percentile"), and the least it can be while it is looked for
    // ("percentile-min").
    ranked: ranked,
    rankedFrom: ranked > 0 ? rankedFrom : null,
    // On a board at the ceiling, what the percentiles bound the field to on
    // this pass, [more than, at most] - where the next pass looks first.
    field: fieldOut,
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

/* The count off the board's last page - and past it. The page count comes
 * off the first page, and the copies the API hands back are not all the same
 * age: on a board still filling, by the time the last page is read the board
 * has grown past it, the page comes back full, and the count would be the
 * page count times a hundred - which is what the first evening showed, every
 * ten minutes. So while the page read is full and says the board has more
 * pages than were counted, the next one is read, a page or two at most: the
 * board gains under a hundred rosters a minute. */
const COUNT_EXTRA = 2;
async function countFrom(row, page, number, meter) {
  let extra = 0;
  while (page && page.teams >= PAGE_SIZE && page.totalPages > number + 1 && number + 1 < PAGES_CAP
         && extra < COUNT_EXTRA) {
    await sleep(GAP_MS);
    number += 1; extra += 1;
    const more = await board(row.event, row.window, number, meter);
    page = more ? readPage(more, number) : null;
  }
  // Still full with more behind it: the board outran the reading; no count
  // is better than a wrong one, and the page count still says "about". An
  // empty page is a copy older than the page count that sent the reading
  // there: no count either.
  if (!page || !page.teams || (page.teams >= PAGE_SIZE && page.totalPages > number + 1)) return null;
  return number * PAGE_SIZE + page.teams;
}

/* What one page's percentiles say about the field: more than `low` rosters,
 * and at most `high`. Epic's percentile is a roster's place in the whole
 * field rounded down to the tenth, so tenth d at rank r means
 * d <= 10 r / N < d + 1; a step up inside the page pins the field to within
 * ten rosters over the tenth. Checked on boards the API pages whole: the
 * Oceania FNCS Solo qualifier of 28 September stepped to 0.2 at rank 905 for
 * its 4,525 players, and the Oceania Solo Series Cup's steps at ranks 547,
 * 1,094 and 1,640 all gave 5,466, a board of 55 pages. Null when the page
 * carries no percentile. */
function fieldBounds(pairs, tenths) {
  let low = 0, high = Infinity, rows = 0;
  for (let i = 0; i < (pairs || []).length; i++) {
    const d = tenths ? tenths[i] : undefined, rank = pairs[i][0];
    if (d === undefined || !isFinite(d) || d < 0 || d > 9 || !(rank >= 1)) continue;
    rows++;
    low = Math.max(low, 10 * rank / (d + 1));
    if (d > 0) high = Math.min(high, 10 * rank / d);
  }
  return rows ? { low: low, high: high } : null;
}

/* The pages' bounds together, and the least the field can be. Pages of one
 * pass can be copies of different ages, and the field grows between them:
 * where they disagree, the freshest copy alone. What the last pass knew is
 * the least the field can be now - unless this pass's copies are older. */
function combineField(bounds, least) {
  if (!bounds.length) return least > 0 ? { low: least, high: Infinity } : null;
  let low = 0, high = Infinity;
  for (const b of bounds) { low = Math.max(low, b.low); high = Math.min(high, b.high); }
  if (low >= high) {
    const fresh = bounds.slice().sort((a, b) => b.stamp - a.stamp)[0];
    low = fresh.low; high = fresh.high;
  }
  if (least > low && least < high) low = least;
  return { low: low, high: high };
}

/* The page worth reading to find the step: the first tenth whose step can
 * sit inside the ten thousand ranks the API pages, and the page holding the
 * rank it is expected at - near `guess` when there is one, halfway between
 * the bounds otherwise. -1 when no step can be inside, a field of more than
 * a hundred thousand. */
function fieldPage(low, high, guess) {
  const last = PAGES_CAP * PAGE_SIZE;
  let k = 1;
  while (k <= 9 && Math.floor(k * low / 10) + 1 > last) k++;
  if (k > 9) return -1;
  const from = Math.floor(k * low / 10) + 1;
  const to = isFinite(high) ? Math.min(Math.ceil(k * high / 10), last) : last;
  if (to < from) return -1;
  let rank = guess > low && (!isFinite(high) || guess <= high) ? Math.ceil(k * guess / 10) : Math.round((from + to) / 2);
  rank = Math.min(Math.max(rank, from), to);
  return Math.floor((rank - 1) / PAGE_SIZE);
}

/* One page of a board, as text; null when it could not be had. `meter`, when
 * the pass gives one, is what this window may still ask and until when: a
 * request refused by it is a page not read, like any other. */
async function board(eventId, windowId, page, meter) {
  const url = API + "/tournaments/leaderboard?" + new URLSearchParams({
    leaderboardEventId: eventId, leaderboardEventWindowId: windowId, page: String(page) });
  const headers = { "User-Agent": AGENT, "Accept": "application/json" };
  // One request of what the window may still ask, and how long it may take:
  // never past the pass's own time. Zero when there is none left of either.
  const allowed = () => {
    if (!meter) return FETCH_TIMEOUT_MS;
    const left = Math.min(FETCH_TIMEOUT_MS, meter.until - Date.now());
    if (!(meter.left > 0) || !(left > 0)) return 0;
    meter.left -= 1;
    return left;
  };
  const limit = ms => (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(Math.max(1, Math.ceil(ms))) : undefined);
  for (let attempt = 0; attempt < 3; attempt++) {
    let ms = allowed();
    if (!ms) return null;
    // Straight from the API, never from a copy this side kept: a board is
    // worth reading only as it is now. Older runtimes reject the option and
    // are asked again without it. A request that fails either way, that is
    // not answered in time, or whose body is cut off on the way, is a page
    // not read, as a 4xx is: the pages already in hand are still worth
    // publishing.
    let res;
    try { res = await fetch(url, { headers: headers, cache: "no-store", signal: limit(ms) }); }
    catch (err) {
      if (timedOut(err)) return null;
      ms = allowed();
      if (!ms) return null;
      try { res = await fetch(url, { headers: headers, signal: limit(ms) }); } catch (again) { return null; }
    }
    if (res.status === 429 || res.status >= 500) {
      // Asked again after a pause, unless that was the last attempt or the
      // pause would run past the pass's time.
      const pause = 2000 * (attempt + 1);
      if (attempt === 2 || (meter && Date.now() + pause >= meter.until)) return null;
      await sleep(pause);
      continue;
    }
    if (!res.ok) return null;
    try { return await res.text(); } catch (err) { return null; }
  }
  return null;
}

function timedOut(err) {
  const name = err && err.name;
  return name === "TimeoutError" || name === "AbortError";
}

/* What a page says: the (rank, points) of every roster on it, how many games
 * the leaders have played, the board's page count and its timestamp.
 *
 * A page is a hundred rosters with their game histories, a third of a
 * megabyte and more, and parsing it in full costs several times the CPU time
 * that reading the few numbers wanted does. So the fast path picks them
 * straight out of the text: every roster carries one
 * "rank" and one "pointsEarned", the two are paired as they come, and the
 * pairs are trusted only when they come out page-shaped - every pair in the
 * same order as the first, ranks consecutive from the page's first, points
 * never rising. Anything else, and the page is parsed properly. */
function readPage(text, page) {
  return scan(text, page) || parsePage(text);
}

function scan(text, page) {
  // A body cut short reads as a shorter page - fewer rosters, a count too
  // low taken for an exact one - so the fast path takes a whole document
  // only, one that ends where its outermost object closes; JSON.parse
  // judges the rest.
  if (!text.trimEnd().endsWith("}")) return null;
  const re = /"(rank|pointsEarned|percentile)"\s*:\s*(-?\d+(?:\.\d+)?|null)/g;
  const pairs = [], tenths = [];
  let order = null, rank = null, points = null, m;
  while ((m = re.exec(text))) {
    const key = m[1];
    // Epic's percentile comes after the rank in every roster: it belongs to
    // the pair just completed, and a roster without one simply has none.
    if (key === "percentile") {
      if (rank === null && points === null && pairs.length && tenths[pairs.length - 1] === undefined && m[2] !== "null") {
        tenths[pairs.length - 1] = Math.round(Number(m[2]) * 10);
      }
      continue;
    }
    if (m[2] === "null") return null;
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
  return { pairs: pairs, teams: pairs.length, games: games, tenths: tenths,
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
    tenths: entries.map(e => (e.percentile === null || e.percentile === undefined || !isFinite(Number(e.percentile)))
      ? undefined : Math.round(Number(e.percentile) * 10)),
    games: Math.max(0, ...entries.slice(0, 10).map(e => (e.sessionHistory || []).length)),
    totalPages: Number(inner.totalPages) || 0,
    updatedAt: inner.updatedAt || null,
    entries: entries,
    fast: false,
  };
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

export { run, cycle, watched, endgame, widestCut, cutRanks, pagesToRead, readWindow, readPage, settle, sealed, loadCalendar,
         fieldBounds, combineField, fieldPage };
