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
globalThis.setTimeout = (fn, ms, ...args) => { slept.push(ms || 0); return setImmediate(fn, ...args); };

function namespace(init = {}) {
  const store = new Map(Object.entries(init));
  return {
    store,
    failGet: () => false,
    async get(key) {
      if (this.failGet(key)) throw new Error("KV GET failed: 429 Too Many Requests");
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) { store.set(key, value); },
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
  const a = await pass({ events: [row], boards: { ev1: big }, store });
  const b = await pass({ events: [row], boards: { ev1: big }, store, at: "2026-09-28T10:10:00Z" });
  const pages = a.asked.concat(b.asked).map(q => q.page);
  check("board past the ceiling: never asked past page 99", Math.max(...pages) <= 99, pages);
  check("board past the ceiling: at most 7 pages a pass", a.asked.length <= 7 && b.asked.length <= 7, [a.asked.length, b.asked.length]);
  check("board past the ceiling: the least the field can be, then the field to within 20",
        a.one.rankedFrom === "percentile-min" && a.one.ranked <= 34567 && b.one.rankedFrom === "percentile" && Math.abs(b.one.ranked - 34567) <= 20,
        [[a.one.ranked, a.one.rankedFrom, a.one.field], [b.one.ranked, b.one.rankedFrom, b.one.field]]);
  check("board past the ceiling: the cut at rank 8,000 is read", pointsAt(b.one, 8000) > 0, b.one.readings);
  const q = await pass({ events: [row], boards: { ev1: big }, store, at: "2026-09-28T10:45:00Z", quick: true });
  check("quick pass past the ceiling: the first page only, the count kept",
        q.asked.length === 1 && q.one.ranked === b.one.ranked && q.one.rankedFrom === "percentile", [q.asked.length, q.one.ranked, q.one.rankedFrom]);
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

/* ---- CPU time ------------------------------------------------------------------ */

section("CPU time (information: the free plan allows a run 10 ms)");
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
  console.log(`info  full pass over six windows (30 pages): ${median(full).toFixed(1)} ms; quick pass in their endgame (6 pages): ${median(quick).toFixed(1)} ms`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
