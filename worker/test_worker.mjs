/* The live feed's edge cases, replayed under node with no dependency:
 *
 *   node worker/test_worker.mjs [path/to/worker.js]
 *
 * The worker is copied to a temporary .mjs and imported. Osirion, the site's
 * calendar, the KV namespace, the clock and the timers are all simulated:
 * nothing leaves the machine, and the pauses between requests take no time.
 * The boards are synthetic but shaped like the API's: a hundred rosters a
 * page, each with its points, rank, percentile and game history. Exits with
 * a non-zero code when a check fails; the CPU figures at the end are for
 * information only, since they depend on the machine. */

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(process.argv[2] || join(here, "worker.js"));
const tmp = mkdtempSync(join(tmpdir(), "live-feed-"));
writeFileSync(join(tmp, "worker.mjs"), readFileSync(source, "utf8"));
const W = await import(pathToFileURL(join(tmp, "worker.mjs")).href);
rmSync(tmp, { recursive: true, force: true });

/* ---- the clock, the timers, the namespace, the network ---------------- */

let NOW = 0;
Date.now = () => NOW;
let slept = [];
// A pause takes no time, and moves the clock on by what it would have taken.
globalThis.setTimeout = (fn, ms, ...args) => { slept.push(ms || 0); NOW += ms || 0; return setImmediate(fn, ...args); };

function namespace(init = {}) {
  const store = new Map(Object.entries(init));
  return {
    store,
    gets: [], puts: [],
    failGet: () => false,
    // What a read hands back: the namespace's own value unless a test says a
    // location is still serving an older copy.
    served: (key, value) => value,
    async get(key) {
      this.gets.push(key);
      if (this.failGet(key)) throw new Error("KV GET failed: 429 Too Many Requests");
      return this.served(key, store.has(key) ? store.get(key) : null);
    },
    async put(key, value) { this.puts.push(key); store.set(key, value); },
  };
}

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => body });

/* ---- boards ------------------------------------------------------------ */

const STAMP = "2026-09-28T09:58:12.345Z";

function random(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const hex = (r, n) => { let out = ""; for (let i = 0; i < n; i++) out += "0123456789abcdef"[Math.floor(r() * 16)]; return out; };
const stats = (placement, elims) => ({ PLACEMENT_STAT_INDEX: placement, TEAM_ELIMS_STAT_INDEX: elims,
  PLACEMENT_TIEBREAKER_STAT: 101 - placement, TIME_ALIVE_STAT: 1500 - 7 * placement, MATCH_PLAYED_STAT: 1,
  VICTORY_ROYALE_STAT: placement === 1 ? 1 : 0 });

/* An open queue of `n` rosters with `games` games each, points falling with
 * rank, the percentile Epic gives (its place in the whole field, rounded down
 * to the tenth). The API pages it a hundred pages deep at most. */
function openBoard({ n, games = 2, updatedAt = STAMP, percentile = true }) {
  const totalPages = Math.min(100, Math.ceil(n / 100));
  const cache = new Map();
  const entry = rank => {
    if (!cache.has(rank)) {
      const r = random(rank + 17);
      const ids = [hex(r, 32)];
      const sessions = [];
      for (let g = 0; g < games; g++) {
        sessions.push({ sessionId: hex(r, 32), endTime: new Date(Date.parse("2026-09-28T08:00:00Z") + (g + 1) * 960e3 + Math.floor(r() * 600e3)).toISOString(),
                        trackedStats: stats(1 + Math.floor(r() * 100), Math.floor(r() * 6)) });
      }
      const points = Math.max(1, Math.round(520 - 62 * Math.log(rank)));
      cache.set(rank, JSON.stringify({ teamId: hex(r, 16), teamAccountIds: ids, displayNames: { [ids[0]]: "Player" + rank },
        pointsEarned: points, score: points + r() / 10, rank, ...(percentile ? { percentile: Math.floor(10 * rank / n) / 10 } : {}),
        sessionHistory: sessions }));
    }
    return cache.get(rank);
  };
  return {
    n, totalPages,
    text(page) {
      const list = [];
      for (let rank = page * 100 + 1; rank <= Math.min(n, (page + 1) * 100, 10000); rank++) list.push(entry(rank));
      return `{"success":true,"leaderboard":{"page":${page},"totalPages":${totalPages},"updatedAt":"${updatedAt}","entries":[${list.join(",")}]}}`;
    },
  };
}

const emptyPage = (page, totalPages) =>
  `{"success":true,"leaderboard":{"page":${page},"totalPages":${totalPages},"updatedAt":"${STAMP}","entries":[]}}`;

/* One closed lobby of `teams` teams: `finished` games over, and in the next
 * one the first `dead` teams out. `settled` is the board as it stood when the
 * last finished game ended, best first. */
function lobbyBoard({ teams, finished, dead, scoring, updatedAt = "2026-09-28T19:40:00.000Z" }) {
  const r = random(teams * 31 + finished);
  const hist = Array.from({ length: teams }, () => []);
  const pointsFor = (placement, elims) => {
    const row = scoring.placement.find(p => placement >= p[0] && placement <= p[1]);
    return (row ? row[2] : 0) + (scoring.kill_cap ? Math.min(elims, scoring.kill_cap) : elims) * scoring.kill;
  };
  const play = (game, out) => {
    const order = hist.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const sessionId = hex(r, 32), start = Date.parse("2026-09-28T18:00:00Z") + game * 22 * 60e3;
    for (let placement = teams; placement >= 1; placement--) {
      const death = teams - placement;
      if (death >= out) break;
      hist[order[placement - 1]].push({ sessionId, endTime: new Date(start + 300e3 + death * 12e3).toISOString(),
                                         trackedStats: stats(placement, Math.floor(r() * 4)) });
    }
  };
  for (let game = 0; game < finished; game++) play(game, teams);
  play(finished, dead);
  const total = h => h.reduce((sum, s) => sum + pointsFor(s.trackedStats.PLACEMENT_STAT_INDEX, s.trackedStats.TEAM_ELIMS_STAT_INDEX), 0);
  const rows = hist.map(h => ({ h, points: total(h) })).sort((a, b) => b.points - a.points);
  const entries = rows.map((x, i) => ({ teamId: "t" + i, pointsEarned: x.points, score: x.points, rank: i + 1,
                                         percentile: Math.floor(10 * (i + 1) / teams) / 10, sessionHistory: x.h }));
  return {
    text: `{"success":true,"leaderboard":{"page":0,"totalPages":1,"updatedAt":"${updatedAt}","entries":${JSON.stringify(entries)}}}`,
    raw: rows.map(x => x.points),
    settled: hist.map(h => total(h.slice(0, finished))).sort((a, b) => b - a),
  };
}

/* ---- one run of the worker --------------------------------------------- */

const cup = (extra = {}) => ({ kind: "Solo Series Cup", name: "Solo Series Cup", event: "ev1", window: "win1", stage: 0,
  region: "EU", team: "Solo", mode: "Battle Royale", games: 10, begin: "2026-09-28T08:00Z", end: "2026-09-28T11:00Z",
  tiers: [["q", 1000, "Round 2", 2]], entry: "", field: 0, scoring: 0, ...extra });

async function pass({ events, boards = {}, store = namespace(), at = "2026-09-28T10:00:00Z", quick = false,
                      scorings = [], intercept = null, calendar = true }) {
  const calendarText = "window.CALENDAR = " + JSON.stringify({ generated: "2026-09-28T06:00Z", days: 7, scorings, events }) + ";\n";
  const asked = [];
  globalThis.fetch = async url => {
    url = String(url);
    if (url.endsWith("calendar.js")) return calendar ? reply(200, calendarText) : reply(503, "unavailable");
    const q = new URL(url).searchParams;
    const ask = { event: q.get("leaderboardEventId"), window: q.get("leaderboardEventWindowId"), page: Number(q.get("page")) };
    asked.push(ask);
    if (intercept) { const r = await intercept(ask); if (r) return r; }
    const b = boards[ask.event];
    if (!b) return reply(404, '{"success":false}');
    return reply(200, typeof b === "string" ? b : b.text(ask.page));
  };
  NOW = Date.parse(at);
  slept = [];
  let result = null, error = null;
  try { result = await W.run({ LIVE: store }, quick); } catch (err) { error = String(err); }
  let live = null;
  try { live = JSON.parse(store.store.get("live")); } catch (err) { live = null; }
  const windows = live && Array.isArray(live.windows) ? live.windows : [];
  return { result, error, live, windows, one: windows[0] || null, asked, store, slept: slept.reduce((a, b) => a + b, 0) };
}

const day = store => { try { return JSON.parse(store.store.get("history-2026-09-28")); } catch (err) { return null; } };
const readingsKept = store => ((((day(store) || {}).windows || {})["ev1|win1"] || {}).readings || []).length;
const pointsAt = (w, rank) => { const r = ((w || {}).readings || []).find(x => x[0] === rank); return r ? r[1] : null; };

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log("ok    " + name); return; }
  failed++;
  console.log("FAIL  " + name + (detail === undefined ? "" : "\n        got " + JSON.stringify(detail)));
}
const section = title => console.log("\n# " + title);

const board = openBoard({ n: 5466 });         // 55 pages; the cut at 1,000 is on page 9, the last page is 54

/* ---- Osirion in error --------------------------------------------------- */

section("Osirion in error");
{
  const s = await pass({ events: [cup()], boards: { ev1: board }, intercept: q => q.page === 0 && reply(404, "not found") });
  check("404 on the first page: nothing published, not asked again", !s.error && s.windows.length === 0 && s.asked.length === 1,
        { error: s.error, windows: s.windows.length, asked: s.asked.length });
}
{
  const s = await pass({ events: [cup()], boards: { ev1: board }, intercept: q => q.page === 0 && reply(500, "error") });
  check("5xx on the first page: three attempts, then nothing", !s.error && s.windows.length === 0 && s.asked.length === 3,
        { windows: s.windows.length, asked: s.asked.length, slept: s.slept });
}
{
  let first = true;
  const s = await pass({ events: [cup()], boards: { ev1: board },
                         intercept: q => { if (q.page === 0 && first) { first = false; return reply(429, "slow down"); } } });
  check("429 once on the first page: asked again, then published",
        s.windows.length === 1 && s.asked.filter(q => q.page === 0).length === 2 && pointsAt(s.one, 1) > 0,
        { windows: s.windows.length, asked: s.asked.map(q => q.page) });
}
{
  const s = await pass({ events: [cup()], boards: { ev1: board }, intercept: q => q.page === 9 && reply(503, "busy") });
  check("5xx on a deeper page: that page is skipped, the rest is published",
        pointsAt(s.one, 100) > 0 && pointsAt(s.one, 1000) === null && pointsAt(s.one, 500) > 0 && s.one.ranked === 5466,
        s.one && { readings: s.one.readings, ranked: s.one.ranked });
}
{
  const store = namespace();
  await pass({ events: [cup()], boards: { ev1: board }, store });
  const s = await pass({ events: [cup()], boards: { ev1: board }, store, at: "2026-09-28T10:10:00Z",
                         intercept: q => { if (q.page === 0) throw new TypeError("fetch failed"); } });
  check("network error on the first page: the last reading stands", !s.error && s.windows.length === 1 && s.one.updated === STAMP,
        { error: s.error, windows: s.windows.length });
}
{
  const s = await pass({ events: [cup()], boards: { ev1: board }, intercept: q => { if (q.page === 9) throw new TypeError("fetch failed"); } });
  check("network error on a deeper page: the rest of the board is still published",
        !s.error && s.windows.length === 1 && pointsAt(s.one, 100) > 0 && pointsAt(s.one, 1000) === null && s.one.ranked === 5466,
        { error: s.error, windows: s.windows.length });
}
{
  const cutOff = { ok: true, status: 200, text: async () => { throw new TypeError("terminated"); } };
  const s = await pass({ events: [cup()], boards: { ev1: board }, intercept: q => q.page === 9 && cutOff });
  check("body cut off in transit on a deeper page: the rest of the board is still published",
        !s.error && s.windows.length === 1 && pointsAt(s.one, 100) > 0 && pointsAt(s.one, 1000) === null,
        { error: s.error, windows: s.windows.length });
}
{
  const s = await pass({ events: [cup()], boards: { ev1: board }, intercept: q => q.page === 0 && reply(200, '{"success":false,"error":"unknown window"}') });
  check("success:false: nothing published", !s.error && s.windows.length === 0, { error: s.error, windows: s.windows.length });
}
{
  const s = await pass({ events: [cup()], boards: { ev1: board }, intercept: q => q.page === 0 && reply(200, "<html><body>Bad gateway {}</body></html>") });
  check("an HTML error page with status 200: nothing published", !s.error && s.windows.length === 0, { error: s.error, windows: s.windows.length });
}
{
  const whole = openBoard({ n: 95 }).text(0);
  const cut = whole.slice(0, whole.indexOf('"pointsEarned"', Math.floor(whole.length * 0.6)));
  const s = await pass({ events: [cup()], boards: { ev1: cut } });
  check("one-page board cut short (truncated JSON): not published as a smaller board",
        !s.error && s.windows.length === 0, s.one && { teams: s.one.teams, ranked: s.one.ranked, rankedFrom: s.one.rankedFrom });
}
{
  const last = board.text(54);
  const cut = last.slice(0, last.indexOf('"pointsEarned"', Math.floor(last.length / 2)));
  const s = await pass({ events: [cup()], boards: { ev1: board }, intercept: q => q.page === 54 && reply(200, cut) });
  check("last page cut short: no count rather than a wrong one", s.one && s.one.ranked === null && pointsAt(s.one, 1000) > 0,
        s.one && { ranked: s.one.ranked, rankedFrom: s.one.rankedFrom });
}

/* ---- empty boards ------------------------------------------------------- */

section("Empty boards");
{
  const s = await pass({ events: [cup()], boards: { ev1: emptyPage(0, 0) } });
  check("empty board: nothing published, no deeper page asked for", !s.error && s.windows.length === 0 && s.asked.length === 1,
        { windows: s.windows.length, asked: s.asked.length });
}
{
  const store = namespace();
  await pass({ events: [cup()], boards: { ev1: board }, store });
  const s = await pass({ events: [cup()], boards: { ev1: emptyPage(0, 0) }, store, at: "2026-09-28T10:10:00Z" });
  check("board emptied after a reading: the last reading stands", s.windows.length === 1 && s.one.updated === STAMP && readingsKept(store) === 1,
        { windows: s.windows.length, history: readingsKept(store) });
}
{
  const s = await pass({ events: [cup()], boards: { ev1: board }, intercept: q => q.page === 2 && reply(200, emptyPage(2, 55)) });
  check("empty deeper page: no reading from it, the rest published", pointsAt(s.one, 250) === null && pointsAt(s.one, 1000) > 0 && pointsAt(s.one, 100) > 0,
        s.one && s.one.readings);
}
{
  const s = await pass({ events: [cup()], boards: { ev1: board }, intercept: q => q.page === 54 && reply(200, emptyPage(54, 55)) });
  check("empty last page: no count rather than one below the page count", s.one && s.one.ranked === null && s.one.pages === 55,
        s.one && { ranked: s.one.ranked, rankedFrom: s.one.rankedFrom, pages: s.one.pages });
}

/* ---- the 100-page ceiling ----------------------------------------------- */

section("The 100-page ceiling");
{
  const big = openBoard({ n: 34567 });
  const row = cup({ tiers: [["q", 8000, "Round 2", 2]] });
  const store = namespace();
  // The same field ten minutes on, on a copy the API has renewed since.
  const later = openBoard({ n: 34567, updatedAt: "2026-09-28T10:08:12.345Z" });
  const a = await pass({ events: [row], boards: { ev1: big }, store });
  const b = await pass({ events: [row], boards: { ev1: later }, store, at: "2026-09-28T10:10:00Z" });
  const pages = a.asked.concat(b.asked).map(q => q.page);
  check("board past the ceiling: never asked past page 99", Math.max(...pages) <= 99, pages);
  check("board past the ceiling: at most 7 pages a pass", a.asked.length <= 7 && b.asked.length <= 7, [a.asked.length, b.asked.length]);
  check("board past the ceiling: the least the field can be, then the field to within 20",
        a.one.rankedFrom === "percentile-min" && a.one.ranked <= 34567 && b.one.rankedFrom === "percentile" && Math.abs(b.one.ranked - 34567) <= 20,
        [[a.one.ranked, a.one.rankedFrom, a.one.field], [b.one.ranked, b.one.rankedFrom, b.one.field]]);
  check("board past the ceiling: the cut at rank 8,000 is read", pointsAt(b.one, 8000) > 0, b.one.readings);
  const q = await pass({ events: [row], boards: { ev1: later }, store, at: "2026-09-28T10:45:00Z", quick: true });
  check("light pass past the ceiling: the first page and the cut's, no search, the count kept",
        q.asked.map(x => x.page).join() === "0,79" && pointsAt(q.one, 8000) > 0
        && q.one.ranked === b.one.ranked && q.one.rankedFrom === "percentile",
        [q.asked.map(x => x.page), q.one.ranked, q.one.rankedFrom, q.one.readings]);
  check("light pass on the board the full pass read: the same entry, nothing filed twice",
        JSON.stringify(q.one) === JSON.stringify(b.one) && day(store).windows["ev1|win1"].readings.length === 2,
        [q.one.readings, day(store).windows["ev1|win1"].readings.length]);
  const moved = openBoard({ n: 34567, updatedAt: "2026-09-28T10:49:12.345Z" });
  const q2 = await pass({ events: [row], boards: { ev1: moved }, store, at: "2026-09-28T10:50:00Z", quick: true });
  check("light pass on a renewed board: the first page and the cut, the deeper rungs left to the full pass",
        q2.one.updated === "2026-09-28T10:49:12.345Z" && pointsAt(q2.one, 100) > 0 && pointsAt(q2.one, 8000) > 0 && pointsAt(q2.one, 500) === null
        && day(store).windows["ev1|win1"].readings.length === 3, [q2.one.updated, q2.one.readings]);
  const counted = day(store).windows["ev1|win1"].readings.map(r => r.ranked);
  check("history: the least the field can be is not filed as a count", counted[0] === null && counted[1] === b.one.ranked, counted);
}
{
  const s = await pass({ events: [cup()], boards: { ev1: openBoard({ n: 10000 }) } });
  check("board of exactly 10,000: counted to within 20", s.one.rankedFrom === "percentile" && Math.abs(s.one.ranked - 10000) <= 20,
        [s.one.ranked, s.one.rankedFrom]);
}
{
  const s = await pass({ events: [cup()], boards: { ev1: openBoard({ n: 34567, percentile: false }) } });
  check("board past the ceiling without percentiles: no count, readings published", !s.error && s.one.ranked === null && pointsAt(s.one, 1000) > 0,
        { error: s.error, ranked: s.one && s.one.ranked });
}

/* ---- solos, duos and trios ------------------------------------------------ */

section("Solos, duos and trios");
const table = n => Array.from({ length: n }, (_, i) => [i + 1, i + 1, Math.max(1, 60 - 2 * i)]);
for (const [team, teams, mode] of [["Solo", 100, "Battle Royale"], ["Duo", 50, "Zero Build"], ["Trio", 33, "Battle Royale"],
                                   ["Solo", 40, "Reload"], ["Duo", 20, "Reload"], ["Trio", 13, "Reload"]]) {
  const scoring = { kill: 2, kill_cap: null, placement: table(Math.min(teams, 30)) };
  const lobby = lobbyBoard({ teams, finished: 4, dead: Math.ceil(teams * 0.6), scoring });
  const row = cup({ name: "Final", team, mode, stage: 9, field: teams, games: 6, tiers: [], begin: "2026-09-28T18:00Z", end: "2026-09-28T20:30Z" });
  const s = await pass({ events: [row], boards: { ev1: lobby.text }, scorings: [scoring], at: "2026-09-28T19:41:00Z" });
  const w = s.one || {};
  const right = (w.readings || []).length > 0 && w.readings.every(([rank, points]) => points === lobby.settled[rank - 1]);
  const moved = (w.readings || []).some(([rank, points]) => points !== lobby.raw[rank - 1]);
  check(`${team} lobby of ${teams} (${mode}), game 5 under way: the board as it stood after game 4`,
        right && moved && w.games === 4 && w.partial === true && w.ranked === teams,
        { readings: w.readings, settled: lobby.settled.slice(0, 5), games: w.games, partial: w.partial });
}
{
  const scoring = { kill: 1, kill_cap: null, placement: table(25) };
  const lobby = lobbyBoard({ teams: 50, finished: 3, dead: 30, scoring });
  const row = cup({ name: "Final", team: "Duo", stage: 8, field: 0, games: 6, tiers: [], begin: "2026-09-28T18:00Z", end: "2026-09-28T20:30Z" });
  const s = await pass({ events: [row], boards: { ev1: lobby.text }, scorings: [scoring], at: "2026-09-28T19:41:00Z" });
  check("duo final whose field the calendar does not know: settled all the same", pointsAt(s.one, 1) === lobby.settled[0] && s.one.games === 3,
        s.one && s.one.readings);
}
{
  const scoring = { kill: 2, kill_cap: null, placement: table(30) };
  const lobby = lobbyBoard({ teams: 50, finished: 3, dead: 30, scoring });
  const row = cup({ team: "Duo", scoring: 5 });
  const s = await pass({ events: [row], boards: { ev1: lobby.text }, scorings: [scoring] });
  check("open duo cup: its board read as it is", pointsAt(s.one, 1) === lobby.raw[0] && s.one.partial === null, s.one && s.one.readings);
}

/* ---- windows cancelled or extended ---------------------------------------- */

section("Windows cancelled or extended");
{
  const store = namespace();
  await pass({ events: [cup()], boards: { ev1: board }, store, at: "2026-09-28T10:30:00Z" });
  const s = await pass({ events: [cup()], boards: {}, store, at: "2026-09-28T10:50:00Z" });
  check("cancelled mid-way (the board answers 404): the last reading stands", !s.error && s.windows.length === 1 && s.one.updated === STAMP,
        { error: s.error, windows: s.windows.length });
}
{
  const s = await pass({ events: [cup({ end: "2026-09-28T12:00Z" })], boards: { ev1: board }, at: "2026-09-28T11:50:00Z" });
  check("extended, and the calendar says so: still read, not final", s.result.watched === 1 && s.one.final === false, s.one && s.one.final);
}
{
  const store = namespace();
  await pass({ events: [cup()], boards: { ev1: board }, store, at: "2026-09-28T10:30:00Z" });
  const later = openBoard({ n: 5466, updatedAt: "2026-09-28T11:49:00.000Z" });
  await pass({ events: [cup({ end: "2026-09-28T12:00Z" })], boards: { ev1: later }, store, at: "2026-09-28T11:50:00Z" });
  const kept = ((day(store) || {}).windows || {})["ev1|win1"] || {};
  check("extended, and the calendar says so: the day's record carries the new close", kept.end === "2026-09-28T12:00Z",
        { end: kept.end, readings: (kept.readings || []).length });
}
{
  const late = openBoard({ n: 5466, updatedAt: "2026-09-28T11:14:00.000Z" });
  const a = await pass({ events: [cup()], boards: { ev1: late }, at: "2026-09-28T11:15:00Z" });
  const b = await pass({ events: [cup()], boards: { ev1: late }, at: "2026-09-28T11:50:00Z" });
  check("extended without the calendar knowing: final at the old close, no longer read 45 minutes after it",
        a.one.final === true && b.result.watched === 0 && b.asked.length === 0, [a.one.final, b.result.watched]);
}
{
  const s = await pass({ events: [cup({ begin: "2026-09-28T10:03Z", end: "2026-09-28T13:00Z" })], boards: { ev1: emptyPage(0, 0) } });
  check("put back a few minutes, board still empty: nothing published", !s.error && s.result.watched === 1 && s.windows.length === 0,
        { watched: s.result && s.result.watched, windows: s.windows.length });
}

/* ---- the KV namespace ------------------------------------------------------ */

section("The KV namespace");
{
  const store = namespace();
  const s = await pass({ events: [cup()], boards: { ev1: board }, store });
  check("empty namespace: the first run publishes and starts the day", s.windows.length === 1 && readingsKept(store) === 1,
        { windows: s.windows.length, history: readingsKept(store) });
}
{
  const store = namespace({ live: '{"generated":"2026-09-28T09:50Z","windows":[{"event":"ev1"' });
  const s = await pass({ events: [cup()], boards: { ev1: board }, store });
  check("live document cut short: the run publishes over it", !s.error && s.windows.length === 1, { error: s.error });
}
{
  const store = namespace();
  store.failGet = key => key === "live";
  const s = await pass({ events: [cup()], boards: { ev1: board }, store });
  check("live document unreadable (KV error): the run still publishes", !s.error && s.windows.length === 1, { error: s.error });
}
for (const value of ["null", '{"generated":"2026-09-28T09:50Z","windows":{}}']) {
  const store = namespace({ live: value });
  const s = await pass({ events: [cup()], boards: { ev1: board }, store });
  check(`live document holding ${value}: the run publishes over it`, !s.error && s.windows.length === 1 && readingsKept(store) === 1,
        { error: s.error, live: String(store.store.get("live")).slice(0, 60) });
}
{
  const store = namespace({ "history-2026-09-28": "{not json" });
  const s = await pass({ events: [cup()], boards: { ev1: board }, store });
  check("day's history that does not parse: started again", !s.error && readingsKept(store) === 1, { error: s.error, history: readingsKept(store) });
}
{
  const earlier = { event: "ev1", window: "win1", name: "Solo Series Cup", region: "EU", begin: "2026-09-28T08:00Z", end: "2026-09-28T11:00Z", readings: [] };
  for (let i = 0; i < 12; i++) earlier.readings.push({ updated: new Date(Date.parse("2026-09-28T08:05:00Z") + i * 600e3).toISOString(), readings: [[1, 100 + i]] });
  const store = namespace({ "history-2026-09-28": JSON.stringify({ day: "2026-09-28", windows: { "ev1|win1": earlier } }) });
  store.failGet = key => key.startsWith("history-");
  const s = await pass({ events: [cup()], boards: { ev1: board }, store });
  check("day's history out of reach (KV read quota spent): its twelve readings are not written over",
        !s.error && s.windows.length === 1 && readingsKept(store) === 12, { error: s.error, history: readingsKept(store) });
}

/* ---- a cup the calendar does not list --------------------------------------- */

section("A cup the calendar does not list");
{
  const s = await pass({ events: [], boards: { ev1: board } });
  check("cup under way but not on the calendar: never asked for", !s.error && s.asked.length === 0 && s.windows.length === 0,
        { asked: s.asked.length, windows: s.windows.length });
}
{
  const store = namespace();
  await pass({ events: [cup()], boards: { ev1: board }, store });
  const s = await pass({ events: [cup({ event: "ev2", window: "win2" })], boards: { ev1: board, ev2: board }, store, at: "2026-09-28T10:10:00Z" });
  check("cup dropped from the calendar: no longer published, its history kept",
        s.windows.length === 1 && s.one.event === "ev2" && readingsKept(store) === 1, { windows: s.windows.map(w => w.event), history: readingsKept(store) });
}
{
  const s = await pass({ events: [cup()], boards: { ev1: board }, calendar: false });
  check("calendar out of reach: no request to Osirion, the run completes", !s.error && s.asked.length === 0 && s.result.watched === 0,
        { error: s.error, asked: s.asked.length });
}
{
  const s = await pass({ events: [cup({ name: "Solo Victory Cup - Round 2", stage: 2 })], boards: { ev1: board } });
  check("second round of a Victory Cup: left out, as on the site", s.asked.length === 0 && s.result.watched === 0, s.asked.length);
}

/* ---- one firing: the full pass, then a look a minute ---------------------- */

section("One firing of the cron");

/* A board Osirion renews as time goes by: every page stamped on the minute
 * `every` minutes back at the most, so a look a minute later finds the same
 * copy until it turns over. */
function movingBoard({ n = 5466, every = 1 } = {}) {
  const made = new Map();
  return {
    text(page) {
      const stamp = new Date(Math.floor(NOW / (every * 60e3)) * every * 60e3).toISOString();
      if (!made.has(stamp)) made.set(stamp, openBoard({ n, updatedAt: stamp }));
      return made.get(stamp).text(page);
    },
  };
}

async function firing({ events, boards = {}, store = namespace(), mark = "2026-09-28T10:00:00Z", startsLate = 0, intercept = null, scheduled = false }) {
  const calendarText = "window.CALENDAR = " + JSON.stringify({ generated: "2026-09-28T06:00Z", days: 7, scorings: [], events }) + ";\n";
  const asked = [], calendarAsked = [];
  globalThis.fetch = async url => {
    url = String(url);
    if (url.endsWith("calendar.js")) { calendarAsked.push(NOW); return reply(200, calendarText); }
    const q = new URL(url).searchParams;
    const ask = { event: q.get("leaderboardEventId"), window: q.get("leaderboardEventWindowId"), page: Number(q.get("page")), at: NOW };
    asked.push(ask);
    if (intercept) { const r = await intercept(ask); if (r) return r; }
    const b = boards[ask.event];
    if (!b) return reply(404, '{"success":false}');
    return reply(200, typeof b === "string" ? b : b.text(ask.page));
  };
  const at = Date.parse(mark);
  NOW = at + startsLate;
  slept = [];
  let results = null, error = null;
  try {
    if (scheduled) {
      const waited = [];
      await W.default.scheduled({ scheduledTime: at }, { LIVE: store }, { waitUntil: p => waited.push(p) });
      results = await waited[0];
    } else results = await W.cycle({ LIVE: store }, at);
  } catch (err) { error = String(err); }
  // The passes, told apart by the minute their requests were made in.
  const minutes = [...new Set(asked.map(q => Math.round((q.at - at) / 60e3)))];
  const pagesAt = minute => asked.filter(q => Math.round((q.at - at) / 60e3) === minute).map(q => q.page);
  let live = null;
  try { live = JSON.parse(store.store.get("live")); } catch (err) { live = null; }
  return { results, error, asked, minutes, pagesAt, calendarAsked, store, live, ended: NOW - at };
}
const kept = (store, id = "ev1|win1") => ((((day(store) || {}).windows || {})[id] || {}).readings || []);

{
  // 10:00, a cup that closes at 11:00: an hour from its endgame.
  const f = await firing({ events: [cup()], boards: { ev1: movingBoard() } });
  check("away from the endgame: one full pass, and the firing is over within the minute",
        !f.error && f.results.length === 1 && f.results[0].quick === false && f.pagesAt(0).join() === "0,9,2,4,54" && f.ended < 60e3,
        { error: f.error, results: f.results, pages: f.asked.map(q => q.page), ended: f.ended });
}
{
  // The firing on a five-minute mark that used to be a quick one.
  const f = await firing({ events: [cup()], boards: { ev1: movingBoard() }, mark: "2026-09-28T10:05:00Z", scheduled: true });
  check("the scheduled handler on a :05 mark: a full pass, awaited",
        !f.error && Array.isArray(f.results) && f.results.length === 1 && f.pagesAt(0).join() === "0,9,2,4,54" && kept(f.store).length === 1,
        { error: f.error, results: f.results, pages: f.asked.map(q => q.page) });
}
{
  // 10:45: fifteen minutes from the close. The board turns over every minute.
  const store = namespace();
  const f = await firing({ events: [cup()], boards: { ev1: movingBoard() }, store, mark: "2026-09-28T10:45:00Z" });
  check("in the endgame: the full pass, then a light one on each of the three minutes after",
        !f.error && f.results.length === 4 && f.minutes.join() === "0,1,2,3" && f.pagesAt(0).join() === "0,9,2,4,54"
        && [1, 2, 3].every(m => f.pagesAt(m).join() === "0,9"),
        { error: f.error, results: f.results, minutes: f.minutes, pages: [0, 1, 2, 3].map(m => f.pagesAt(m)) });
  check("in the endgame: every look that found a new board is filed, the cut with it",
        kept(store).length === 4 && kept(store).every(r => r.readings.some(x => x[0] === 1000)),
        kept(store).map(r => [r.updated, r.readings.length]));
  check("in the endgame: the firing's last write is more than a minute before the next one is due", f.ended < 235e3, f.ended);
  check("one firing reads the calendar once, and the day's history once",
        f.calendarAsked.length === 1 && store.gets.filter(k => k.startsWith("history-")).length === 1 && store.gets.filter(k => k === "live").length === 1,
        { calendar: f.calendarAsked.length, gets: store.gets });
}
{
  // A copy renewed every five minutes: the looks in between find the board
  // they already had.
  const store = namespace();
  const f = await firing({ events: [cup()], boards: { ev1: movingBoard({ every: 5 }) }, store, mark: "2026-09-28T10:45:00Z" });
  check("a board that has not turned over: looked at, nothing published or filed again",
        !f.error && f.results.length === 4 && f.results.slice(1).every(r => r.unchanged === true)
        && store.puts.filter(k => k === "live").length === 1 && kept(store).length === 1,
        { results: f.results, puts: store.puts, history: kept(store).length });
}
{
  // The first page unchanged, the cut's page renewed: the new cut is
  // published beside the rungs the full pass read, and filed.
  const firstPage = openBoard({ n: 5466, updatedAt: "2026-09-28T10:44:10.000Z" });
  const boards = { ev1: { text(page) {
    if (page !== 9) return firstPage.text(page);
    const stamp = new Date(Math.floor(NOW / 60e3) * 60e3).toISOString();
    return openBoard({ n: 5466, updatedAt: stamp }).text(9);
  } } };
  const store = namespace();
  const f = await firing({ events: [cup()], boards, store, mark: "2026-09-28T10:45:00Z" });
  const one = f.live.windows[0], filed = kept(store);
  const cut = (one.readings.find(r => r[0] === 1000) || [])[2];
  check("the cut's page renewed under the same first page: the new cut published, the deeper rungs kept",
        !f.error && one.updated === "2026-09-28T10:44:10.000Z" && cut === "2026-09-28T10:48:00.000Z"
        && pointsAt(one, 250) > 0 && pointsAt(one, 500) > 0 && one.ranked === 5466,
        { updated: one.updated, readings: one.readings, ranked: one.ranked });
  check("the cut's page renewed under the same first page: each renewal filed, every record whole",
        filed.length === 4 && filed.every(r => r.updated === "2026-09-28T10:44:10.000Z" && r.readings.some(x => x[0] === 500)),
        filed.map(r => [r.updated, r.readings.length, (r.readings.find(x => x[0] === 1000) || [])[2]]));
}
{
  // The namespace still serving, a minute later, the day as it stood before
  // the firing: what a pass read back there must not be what it files on.
  const store = namespace();
  await pass({ events: [cup()], boards: { ev1: openBoard({ n: 5466, updatedAt: "2026-09-28T10:39:10.000Z" }) }, store, at: "2026-09-28T10:40:00Z" });
  const stale = store.store.get("history-2026-09-28");
  store.gets = []; store.puts = [];
  store.served = (key, value) => key.startsWith("history-") ? stale : value;
  const f = await firing({ events: [cup()], boards: { ev1: movingBoard() }, store, mark: "2026-09-28T10:45:00Z" });
  check("a stale read of the day's history cannot drop a reading: one before the firing and four in it",
        !f.error && kept(store).length === 5, kept(store).map(r => r.updated));
}
{
  // The firing itself starts 130 s late.
  const f = await firing({ events: [cup()], boards: { ev1: movingBoard() }, mark: "2026-09-28T10:45:00Z", startsLate: 130e3 });
  check("a firing that starts late: its full pass, then only the minutes still ahead",
        !f.error && f.results.length === 2 && f.minutes.join() === "2,3" && f.pagesAt(2).join() === "0,9,2,4,54" && f.ended < 235e3,
        { results: f.results, minutes: f.minutes, pages: f.pagesAt(2), ended: f.ended });
}
{
  // A firing that starts after its five minutes are all but gone asks nothing.
  const f = await firing({ events: [cup()], boards: { ev1: movingBoard() }, mark: "2026-09-28T10:45:00Z", startsLate: 280e3 });
  check("a firing that starts as the next one is due: no request, nothing written, no error",
        !f.error && f.asked.length === 0 && f.results.length === 1 && f.results[0].late === true && f.store.puts.length === 0 && f.calendarAsked.length === 0,
        { error: f.error, asked: f.asked.length, results: f.results, puts: f.store.puts });
}
{
  // The endgame begins at 10:40: the firing of 10:35 picks it up on its way.
  const f = await firing({ events: [cup()], boards: { ev1: movingBoard() }, mark: "2026-09-28T10:37:00Z" });
  check("the endgame opening during a firing: light passes from that minute on",
        !f.error && f.minutes.join() === "0,3" && f.pagesAt(3).join() === "0,9", { minutes: f.minutes, results: f.results });
}
{
  // Twenty-five minutes after the close: still read, every five minutes.
  const f = await firing({ events: [cup()], boards: { ev1: movingBoard() }, mark: "2026-09-28T11:25:00Z" });
  check("past the settling: the full pass only", !f.error && f.results.length === 1 && f.minutes.join() === "0", { minutes: f.minutes });
}
{
  // Two windows, one in its endgame: the other keeps its reading in between.
  const rows = [cup(), cup({ event: "ev2", window: "win2", end: "2026-09-28T12:30Z" })];
  const store = namespace();
  const f = await firing({ events: rows, boards: { ev1: movingBoard(), ev2: movingBoard() }, store, mark: "2026-09-28T10:50:00Z" });
  const light = f.asked.filter(q => q.at - Date.parse("2026-09-28T10:50:00Z") > 50e3);
  check("a light pass reads the windows in their endgame only, the others stand",
        !f.error && light.length === 6 && light.every(q => q.event === "ev1") && f.live.windows.length === 2 && kept(store, "ev2|win2").length === 1,
        { light: light.map(q => q.event + ":" + q.page), windows: f.live && f.live.windows.length, other: kept(store, "ev2|win2").length });
}
{
  // A cut inside the top hundred: the light pass is the first page alone.
  const f = await firing({ events: [cup({ tiers: [["q", 100, "Round 3", 3]] })], boards: { ev1: movingBoard() }, mark: "2026-09-28T10:45:00Z" });
  check("a cut on the first page: one request a look", [1, 2, 3].every(m => f.pagesAt(m).join() === "0"), [1, 2, 3].map(m => f.pagesAt(m)));
}
{
  // The full pass throws (the namespace refuses the write): the looks go on.
  const store = namespace();
  let refused = 0;
  const put = store.put.bind(store);
  store.put = async (key, value) => { if (key === "live" && refused++ === 0) throw new Error("KV PUT failed: 500"); return put(key, value); };
  const said = [], report = console.error;
  console.error = err => said.push(String(err));
  const f = await firing({ events: [cup()], boards: { ev1: movingBoard() }, store, mark: "2026-09-28T10:45:00Z" });
  console.error = report;
  check("a pass that fails does not end the firing: the next look publishes, and the failure is reported",
        !f.error && f.results.length === 4 && !!f.results[0].error && f.live && f.live.windows.length === 1 && kept(store).length === 3 && said.length === 1,
        { error: f.error, results: f.results, history: kept(store).length, said });
}
{
  // The day's history refuses one write, on a board that then stands still:
  // the reading is owed, and the next look files it without a new board.
  const store = namespace();
  let refused = 0;
  const put = store.put.bind(store);
  store.put = async (key, value) => { if (key.startsWith("history-") && refused++ === 0) throw new Error("KV PUT failed: 500"); return put(key, value); };
  const report = console.error;
  console.error = () => {};
  const f = await firing({ events: [cup()], boards: { ev1: movingBoard({ every: 5 }) }, store, mark: "2026-09-28T10:45:00Z" });
  console.error = report;
  check("a reading the day could not take: filed at the next look, the published document left as it was",
        !f.error && !!f.results[0].error && kept(store).length === 1 && kept(store)[0].readings.length === 11
        && f.live.windows[0].ranked === 5466 && pointsAt(f.live.windows[0], 500) > 0,
        { results: f.results, history: kept(store).map(r => r.readings.length), ranked: f.live.windows[0].ranked });
}

{
  // The API hands back an older first page after a newer one.
  const A = openBoard({ n: 5466, updatedAt: "2026-09-28T10:44:10.000Z" }), B = openBoard({ n: 5466, updatedAt: "2026-09-28T10:45:40.000Z" });
  const at = Date.parse("2026-09-28T10:45:00Z");
  const boards = { ev1: { text(page) { const m = Math.round((NOW - at) / 60e3); return (m === 1 ? B : A).text(page); } } };
  const store = namespace();
  const f = await firing({ events: [cup()], boards, store, mark: "2026-09-28T10:45:00Z" });
  check("an older first page after a newer one: the newer reading stands, nothing filed for it",
        !f.error && f.live.windows[0].updated === "2026-09-28T10:45:40.000Z" && kept(store).map(r => r.updated).join() === "2026-09-28T10:44:10.000Z,2026-09-28T10:45:40.000Z",
        { live: f.live.windows[0].updated, history: kept(store).map(r => [r.updated, r.readings.length]) });
}
{
  // Three full passes handed A, B, then A again: the day keeps two records.
  const A = openBoard({ n: 5466, updatedAt: "2026-09-28T09:58:10.000Z" }), B = openBoard({ n: 5466, updatedAt: "2026-09-28T10:03:40.000Z" });
  const store = namespace();
  await pass({ events: [cup()], boards: { ev1: A }, store, at: "2026-09-28T10:00:00Z" });
  await pass({ events: [cup()], boards: { ev1: B }, store, at: "2026-09-28T10:05:00Z" });
  await pass({ events: [cup()], boards: { ev1: A }, store, at: "2026-09-28T10:10:00Z" });
  check("the same board handed back two passes later: not filed a second time", readingsKept(store) === 2, readingsKept(store));
}
{
  // The same first page ten minutes on, and the cut's page out of reach.
  const store = namespace();
  await pass({ events: [cup()], boards: { ev1: board }, store });
  const s = await pass({ events: [cup()], boards: { ev1: board }, store, at: "2026-09-28T10:05:00Z", intercept: q => q.page === 9 && reply(404, "gone") });
  check("a full pass that misses a page of the board it already had: that rank keeps its reading",
        !s.error && pointsAt(s.one, 1000) > 0 && pointsAt(s.one, 500) > 0 && s.one.ranked === 5466 && readingsKept(store) === 1,
        s.one && { readings: s.one.readings, history: readingsKept(store) });
}
{
  // The cut's page stamped after the first; a look later is handed an older
  // copy of it. The reading in hand is the newer one, and keeps its stamp.
  const newer = openBoard({ n: 5466, updatedAt: "2026-09-28T10:44:30.000Z" }), older = openBoard({ n: 5000, updatedAt: "2026-09-28T10:40:00.000Z" });
  const base = openBoard({ n: 5466, updatedAt: "2026-09-28T10:42:00.000Z" });
  const store = namespace();
  const a = await pass({ events: [cup()], boards: { ev1: { text: page => (page === 9 ? newer : base).text(page) } }, store, at: "2026-09-28T10:45:00Z" });
  const b = await pass({ events: [cup()], boards: { ev1: { text: page => (page === 9 ? older : base).text(page) } }, store, at: "2026-09-28T10:46:00Z", quick: true });
  const cutA = a.one.readings.find(r => r[0] === 1000), cutB = b.one.readings.find(r => r[0] === 1000);
  check("an older copy of the cut's page: the newer reading stands, with its own stamp",
        cutA.length === 3 && cutA[2] === "2026-09-28T10:44:30.000Z" && JSON.stringify(cutB) === JSON.stringify(cutA) && readingsKept(store) === 1,
        { cutA, cutB, history: readingsKept(store) });
}
{
  // A firing across midnight UTC: each reading is filed under its own day.
  const row = cup({ begin: "2026-09-28T21:00Z", end: "2026-09-29T00:05Z" });
  const store = namespace();
  const f = await firing({ events: [row], boards: { ev1: movingBoard() }, store, mark: "2026-09-28T23:57:00Z" });
  const next = (((JSON.parse(store.store.get("history-2026-09-29") || "{}").windows || {})["ev1|win1"] || {}).readings || []);
  check("a firing across midnight: three readings under the day ending, the fourth under the next",
        !f.error && f.results.length === 4 && kept(store).length === 3 && next.length === 1,
        { results: f.results, first: kept(store).length, second: next.length });
}
{
  // The handler itself is not done before its looks are.
  const store = namespace();
  const calendarText = "window.CALENDAR = " + JSON.stringify({ generated: "x", days: 7, scorings: [], events: [cup()] }) + ";\n";
  const moving = movingBoard();
  globalThis.fetch = async url => {
    url = String(url);
    if (url.endsWith("calendar.js")) return reply(200, calendarText);
    return reply(200, moving.text(Number(new URL(url).searchParams.get("page"))));
  };
  NOW = Date.parse("2026-09-28T10:45:00Z");
  await W.default.scheduled({ scheduledTime: NOW }, { LIVE: store }, { waitUntil: () => {} });
  check("the scheduled handler returns once its last look is filed", kept(store).length === 4, kept(store).length);
}
{
  // A calendar that is not a list of windows ends the firing quietly.
  for (const events of [{ a: 1 }, [null, 7, "x"]]) {
    const calendarText = "window.CALENDAR = " + JSON.stringify({ generated: "x", days: 7, scorings: [], events }) + ";\n";
    globalThis.fetch = async url => String(url).endsWith("calendar.js") ? reply(200, calendarText) : reply(404, "{}");
    NOW = Date.parse("2026-09-28T10:45:00Z");
    let error = null, results = null;
    const report = console.error;
    console.error = () => {};
    try { results = await W.cycle({ LIVE: namespace() }, NOW); } catch (err) { error = String(err); }
    console.error = report;
    check(`a calendar whose events are ${JSON.stringify(events)}: the firing ends without throwing`, !error && Array.isArray(results), { error, results });
  }
}

/* ---- what a pass may ask of the API ------------------------------------------ */

section("What a pass may ask of the API");
{
  const rows = [], boards = {};
  for (let i = 0; i < 12; i++) { rows.push(cup({ event: "ev" + i, window: "win" + i })); boards["ev" + i] = board; }
  const s = await pass({ events: rows, boards });
  const per = rows.map(r => s.asked.filter(q => q.event === r.event).length);
  check("twelve windows at once: under the API's sixty a minute, every window read, its cut with it",
        s.asked.length <= 46 && s.windows.length === 12 && per.every(n => n >= 2) && s.windows.every(w => pointsAt(w, 1000) > 0),
        { asked: s.asked.length, per });
  const nine = await pass({ events: rows.slice(0, 9), boards });
  check("nine windows at once: nothing given up", nine.asked.length === 45 && nine.windows.every(w => w.ranked === 5466 && pointsAt(w, 500) > 0),
        { asked: nine.asked.length, ranked: nine.windows.map(w => w.ranked) });
}
{
  const rows = [], boards = {};
  for (let i = 0; i < 6; i++) { rows.push(cup({ event: "ev" + i, window: "win" + i })); boards["ev" + i] = board; }
  const s = await pass({ events: rows, boards });
  check("six windows at once: nothing given up", s.asked.length === 30 && s.windows.every(w => w.ranked === 5466 && pointsAt(w, 500) > 0),
        { asked: s.asked.length, ranked: s.windows.map(w => w.ranked) });
}
{
  // Every answer a 429: three attempts a window, never the retries of a
  // whole board.
  const rows = [], boards = {};
  for (let i = 0; i < 6; i++) { rows.push(cup({ event: "ev" + i, window: "win" + i })); boards["ev" + i] = board; }
  const s = await pass({ events: rows, boards, intercept: () => reply(429, "slow down") });
  const most = Math.max(...rows.map(r => s.asked.filter(q => q.event === r.event).length));
  check("the API refusing everything: three attempts a window, no pause after the last, the pass completes",
        !s.error && most === 3 && s.asked.length === 18 && s.slept <= 45e3 && s.windows.length === 0,
        { error: s.error, asked: s.asked.length, most, slept: s.slept });
}
{
  // An API that takes twenty seconds a page: the pass stops asking in time.
  const rows = [], boards = {};
  for (let i = 0; i < 4; i++) { rows.push(cup({ event: "ev" + i, window: "win" + i })); boards["ev" + i] = board; }
  const store = namespace();
  await pass({ events: rows, boards, store, at: "2026-09-28T09:50:00Z" });
  const s = await pass({ events: rows, boards: Object.fromEntries(rows.map(r => [r.event, openBoard({ n: 5466, updatedAt: "2026-09-28T09:59:30.000Z" })])),
                         store, intercept: () => { NOW += 20e3; } });
  const fresh = s.windows.filter(w => w.updated === "2026-09-28T09:59:30.000Z").length;
  check("a slow API: the pass stops asking after 45 s, publishes what it has, the rest keep their reading",
        !s.error && s.asked.length === 3 && s.windows.length === 4 && fresh === 1 && s.windows.filter(w => w.updated === STAMP).length === 3
        && s.windows.map(w => w.event).join() === "ev0,ev1,ev2,ev3",
        { error: s.error, asked: s.asked.length, updated: s.windows.map(w => w.updated) });
  // The pass after it starts with the next window: none is always last.
  const slow = Object.fromEntries(rows.map(r => [r.event, openBoard({ n: 5466, updatedAt: "2026-09-28T10:04:30.000Z" })]));
  const next = await pass({ events: rows, boards: slow, store, at: "2026-09-28T10:05:00Z", intercept: () => { NOW += 20e3; } });
  check("a slow API: the next pass starts with the next window",
        next.asked[0].event !== s.asked[0].event && next.windows.filter(w => w.updated === "2026-09-28T10:04:30.000Z").length === 1,
        { first: [s.asked[0].event, next.asked[0].event], updated: next.windows.map(w => w.updated) });
}
{
  const late = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
  const s = await pass({ events: [cup()], boards: { ev1: board }, intercept: q => { if (q.page === 9) throw late; } });
  check("a request not answered in time: a page not read, not asked a second time",
        !s.error && s.asked.filter(q => q.page === 9).length === 1 && pointsAt(s.one, 1000) === null && pointsAt(s.one, 500) > 0,
        { error: s.error, asked: s.asked.map(q => q.page) });
}
{
  let options = null;
  const s = await pass({ events: [cup()], boards: { ev1: board }, intercept: () => null });
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => { if (!String(url).endsWith("calendar.js")) options = init; return real(url, init); };
  NOW = Date.parse("2026-09-28T10:00:00Z");
  await W.run({ LIVE: namespace() }, false);
  check("every request to the API carries a time limit", !!options && !!options.signal && typeof options.signal.aborted === "boolean", options && Object.keys(options));
}

/* ---- CPU time ------------------------------------------------------------------ */

section("CPU time (information)");
{
  const median = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const cpu = fn => { const t = process.cpuUsage(); fn(); const d = process.cpuUsage(t); return (d.user + d.system) / 1000; };
  const late = openBoard({ n: 5466, games: 10 });
  const page = late.text(3), wide = page.replace('"Player301"', '"プレイヤー301"');
  const ascii = Buffer.from(page), utf8 = Buffer.from(wide);
  for (let i = 0; i < 20; i++) { W.readPage(page, 3); JSON.parse(page); }
  const fast = W.readPage(page, 3);
  check("a page of ten-game rosters goes through the fast path", fast && fast.fast === true && fast.teams === 100);
  const each = fn => median(Array.from({ length: 25 }, () => cpu(fn))).toFixed(2);
  console.log(`info  one page, ${Math.round(page.length / 1024)} KB: fast path ${each(() => W.readPage(page, 3))} ms,` +
              ` full parse ${each(() => JSON.parse(page))} ms, UTF-8 decoding ${each(() => ascii.toString("utf8"))} ms,` +
              ` or ${each(() => utf8.toString("utf8"))} ms when one name on the page is not ASCII`);

  // Six windows at once, as the calendar holds at its busiest: bodies are
  // decoded on every request, as `res.text()` does, one name on each page
  // outside ASCII.
  const rows = [], bodies = new Map();
  for (let i = 0; i < 6; i++) {
    rows.push(cup({ event: "ev" + i, window: "win" + i, region: "R" + i }));
    for (const p of [0, 2, 4, 9, 54]) bodies.set("ev" + i + "|" + p, Buffer.from(late.text(p).replace('"Player' + (p * 100 + 1) + '"', '"Jogador' + (p * 100 + 1) + 'ñ"')));
  }
  const calendarText = "window.CALENDAR = " + JSON.stringify({ generated: "x", days: 7, scorings: [], events: rows }) + ";";
  globalThis.fetch = async url => {
    url = String(url);
    if (url.endsWith("calendar.js")) return reply(200, calendarText);
    const q = new URL(url).searchParams;
    const body = bodies.get(q.get("leaderboardEventId") + "|" + q.get("page"));
    return { ok: !!body, status: body ? 200 : 404, text: async () => body.toString("utf8") };
  };
  const timeRun = async quick => {
    const t = process.cpuUsage();
    await W.run({ LIVE: namespace() }, quick);
    const d = process.cpuUsage(t);
    return (d.user + d.system) / 1000;
  };
  NOW = Date.parse("2026-09-28T10:00:00Z");
  const full = [];
  for (let i = 0; i < 5; i++) full.push(await timeRun(false));
  NOW = Date.parse("2026-09-28T10:45:00Z");
  const quick = [];
  for (let i = 0; i < 5; i++) quick.push(await timeRun(true));
  console.log(`info  full pass over six windows (30 pages): ${median(full).toFixed(1)} ms; light pass in their endgame (12 pages): ${median(quick).toFixed(1)} ms`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
