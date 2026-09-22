# Threshold Ladder

**→ [Open the site](https://fortnitepredcomp.com/)** ·
*[Version française](README.fr.md)*

How many points a given finishing rank will take in a Fortnite tournament —
before the results exist, and more precisely once the session is running.

Thresholds are published after the fact. A player deciding whether to keep
playing, or how aggressively, is guessing. This estimates the answer from the
tournament's scoring table, its field size, and what earlier editions of
comparable tournaments did.

Around it, the site has [this week's cups](https://fortnitepredcomp.com/this-week/)
with the forecast at each one's qualifying rank, and
[guides](https://fortnitepredcomp.com/guides/) to what sets a cutoff — scoring,
the pace of a session, regions, deep ranks, new seasons, brand-new cups — each
built from the same data as the model, in English and in French.

No installation, no account, no API key. There are two ways to have it:

- **the site** — [open it](https://fortnitepredcomp.com/)
  and it works, on a phone as well as a desktop;
- **[`standalone.html`](https://fortnitepredcomp.com/standalone.html)**
  — the whole thing in one file. Right-click that link, *Save link as…*,
  double-click the file: it runs with no network at all. The calendar inside it
  is frozen at the date it was built, and says so.

---

## Using it

The page opens on **what is on this week**: every tournament still to come in
the calendar, filtered by region, mode and team size, searchable by name, with
the ones running right now marked live. The day's finished cups stay in the list,
greyed, a scroll above; older ones are gone.
Click one and the forecast opens on its own screen, in three tabs so nothing
sits stacked under anything else: **Forecast** — the rank asked, the answer,
the ladder; **Live** — the evening as it runs, its chart and its readings;
**Settings** — name, region, team size, mode, number of games, session length,
who may enter and the scoring table, all filled in, so the answer is already
there, because every one of those settings is Epic's own. **All tournaments**
at the top, or the browser's back button, returns to the list; **Full standings
on osirion.gg** opens the whole board there, in a new tab.

The rank it prices first is **the cut that matters**. Each cup carries the cuts
it pays out on, read from its payout table: the top 2,000 go through to Round 2,
the top 25 reach the final, money from 8th place, a cosmetic down to 500th.
They sit above the answer as chips — click one to price it — and the ladder
names them, so "top 2,000 · qualifies for Round 2" is a line to find rather than
a number to know by heart. A cut given as a share of the field (the top 25 %)
becomes a rank, and says so.

A final played by qualified teams in a single lobby is recognised as such: the
format switches to sealed, the field becomes the lobby size, and the page says
so under the field.

A tournament that is not in the calendar can be typed in by hand, from the
button under the list — name, region, team size, mode, open window or sealed,
how long the session runs and how long a game takes, the field size if it is
known — and the scoring table pastes straight from osirion.gg or the rules
(`1 = 60`, `1st 60`, `Top 1 : 60`, `Victory Royale - 60` and the rest all
parse). **Confirm the settings** freezes them so nothing shifts by accident.

The name field knows the tournaments in the model and matches loosely, so "FNCS
Div 2" finds "FNCS Division 2" — but never "FNCS Division 3", because the
numbers have to agree. When a name covers several stages, a second box lists
them with the number of editions behind each, and picking one fills in how many
games that stage usually runs.

**The number of games is the field that matters most.** The level scales with
it, so getting it wrong scales every threshold on the page. The rules cap is
what counts; the session length and the game length are a cross-check, and the
page says so when the clock does not leave room for the games the rules allow.

Type a rank, press **Predict**, and the number comes with two ranges around
it. The cup's own clock sits at the top of the page - the day, the hours it
runs and how long there is to wait - on the reader's own time zone, whichever
that is. A reload comes back to the page it was on: the forecast if that is
where it was, the list otherwise.
Below the answer, the whole ladder from the top 1 down, with the rank asked for
marked — and the ladder read the other way: type the points you expect to finish
with and the page says which rank they land at, with the range the band allows.

### While the tournament runs

A line under the progress bar says when the forecast last moved and when it
will next — the standings read at 18:40, the next reading around 18:52 — or that
it is still the pre-tournament forecast.

**Predict now** unfolds the manual entry: after each game, type what the standings
show at two or three ranks and press **Confirm**. That is the moment the forecast
moves — nothing shifts while the boxes are still being filled in. The reading is
filed in a list with its game number and the time, the points clear, the ranks
stay where they were put, and the counter goes to the next game. From one game
to the next there is nothing to do but type three numbers and press one button.

Each reading says how this cup is running against its history: a top-5 at 153
points after 3 of 6 games, in a cup whose previous edition closed at 246, is
running 23 % hot. How far along a threshold is at that point of the session is
measured rather than assumed — replaying past leaderboards game by game shows
that at half the games a threshold sits at half its final value, give or take
fifteen per cent from one cup to the next. Readings and history are then
combined by precision, whichever is sharper weighing more, so on the last game
the readings are the answer; the page says what share of it they carried.

That curve is the curve of this cup's own kind, not of every open queue
pooled. Replayed per family — game mode, team size, window length, game cap —
the share reached at half time runs from 0.42 to 0.53 and the share on the
hour from 0.87 to 0.94: a two-hour Battle Royale cup has a thirty-minute game
still in the air at the buzzer, a cup capped at ten short Reload games has
nothing left to play in its last half hour. Within a family the kind of cup
matters too: at half the session the FNCS practice cups had reached 45 % of
their final where the skin cups of the same format had reached 56 %, so the
family rows are kept per kind of cup and platform as well as pooled. The page
reads the cup's own recent editions first — as the feed read them once it has
followed four, since the harvest's replay of a casual Solo cup runs 4 to 9 %
low at half time, its first pages missing the players who led early and then
stopped, and only while those editions are within 45 days and of the same
length and game count — then the family by kind, then the family pooled, then
the pooled curve, and says which. The deep end of a queue runs on
its own clock too, set by how deep into the field the rank sits rather than by
the rank: the thousandth of a field of two thousand is the casual half, done by
the last fifth of the session; the thousandth of ten thousand keeps the top's
pace. That ratio is measured on the feed's own evenings, and the field it is
measured against is the board's own count of who has played so far — the
number under the progress bar — which the feed reads with every standing.
On a full pass the feed also reads the board's last page, so the count is
exact — 6,743 players, not about 6,750 — and the line says so by dropping
the "≈". The API pages a board a hundred pages deep at most, so past ten
thousand the line says "10,000 or more": the leaderboard stops there, where
Osirion's own site, which counts players from the games it parses, can say
fifteen thousand.
Replayed over 110 evenings with only what was known each morning, the median
error falls from 5.0 to 4.2 % at three to five tenths of the session, from 4.7
to 3.6 % at five to seven, from 2.1 to 1.4 % in the ten minutes after the
close; the ranges of a live answer are measured on those evenings as well,
where they used to borrow the pre-tournament forecast's.

How far a reading travels along the ladder was measured the same way, and the
two formats answer differently. In an open queue of thousands the whole board
moves together, so a reading at rank 20 prices rank 500 almost exactly. Inside
one closed lobby it does not: the same twenty teams share out a fixed pot, so a
team running away with the top takes the points that would have landed at rank
10. There a reading prices its own rank, the rest of the ladder keeps its
forecast from history, and the page says which of the two it is doing. A rank
read on both sides is a third case, and the easiest: the top 160 sits between
a top 100 and a top 250 read off the standings, so it is priced between them,
log-linear in rank — an interpolation that is off by 1 to 3 % at the median on
past boards down to the top 250, 5 to 7 % deeper, against a pace band of ten
and more. The ladder marks those rungs with a hollow dot.

When the cup is under way and the site's live feed is on, the standings are
read for you every ten minutes — the points at the top 1, 3, 5, 10, 20, 25, 50
and 100, at every cut the cup pays out on (the qualification rank first) and at
the ladder's deeper rungs as far as a few pages reach — and filed as readings
marked *auto*: the forecast follows them without anyone typing. Over a cup's
last twenty minutes and while its board settles, where the standings move
about a point a minute at the ranks a cup qualifies on, the top hundred is
read every five minutes instead, and the page asks for it every two. A reading typed
by hand still works and takes over while it is the fresher one. The feed keeps
every reading it took, so a cup opened late, on another device, or after it
ended shows the whole evening, not what this browser happened to see.

The feed follows the cups on the published calendar, and the calendar used to
be written only by the machine that harvests, when it ran: a cup Epic announced
between two runs ran unfollowed, and an evening the feed did not sit through
cannot be recovered afterwards. The repository's own workflow now refreshes
the calendar every three hours, so the list — and the feed behind it — is
never further behind Epic than that. A cup that is over with nothing from the
feed says so on its Live tab, and points at the full board on osirion.gg.

A run of the feed is not one snapshot. Every page of a board is a request of
its own and the copies the API hands back are not all the same age: the page
holding the top 160 can be minutes older than the first, or missing from the
run altogether. So each reading is clocked at the minute its own page was
stamped, and the answer rests on the evening's standing — the reading of each
rank that stands now, whichever run it arrived in, a rank the feed has not
been handed for half an hour let go. Between two of the feed's readings of a
rank the richer is the fresher, since a threshold never falls; one typed by
hand outranks the feed up to the minute it was typed. That is where the jumps
in the forecast line came from: on six evenings replayed from the feed's own
history the forecast now moves about half as much from one reading to the
next, and the largest move of all falls from 34 % of the final threshold to
15 %.

In a sealed lobby the board is half updated while a game runs — the teams
already out have their game added, the teams still alive, the ones about to
take the most points, do not — so the feed reads the board as it stood when
the last game ended, rebuilt from each team's own games (the same match is the
same session for everyone in the lobby, and a game is over once a winner is
recorded in it; a team that missed a game is simply a team with one fewer).
The status line then says which game is under way and which standing the
forecast rests on. A lobby that starts late plays on past the window's end,
so its board is not called final until its games are in.

The window's close is not the end of the cup: the games under way when the
clock stops keep landing for a quarter of an hour, and the board rises with
them. How much is measured too, in minutes past the close rather than in
tenths of the session — about 93 % of the final board at the close, 97 % ten
minutes later, settled by twenty — so a reading taken after the hour is priced
for the minute it was taken. Before that the page added the same uplift to
every late reading and the answer climbed with the standings instead of
converging: on a cash cup whose top 20 finished at 607, it said 600 at the
close and 651 twenty minutes later. It now says 600 and 607, and the range
closes as the board settles.

A threshold never falls, and the page holds that as a rule rather than as a
tendency: a team's points only rise, so the k-th score of an evening only
rises, so the final threshold at a rank cannot be below what the standings
already show there. The forecast and the low end of both ranges are held at
the board's own reading — and where a rank was not read, at the nearest deeper
rank that was, since rank 50 stands at least where rank 100 does. Weighing
readings against history had been able to land under the board they were
built on: 82 of 10,182 replayed forecasts did.

Whether the top of the board settles later than its bottom is measured rather
than assumed, per band of rank — and the answer is no, on 25,642 readings: the
board has the same 8 % left to give at the close whether the rank asked is the
top 25 or the top 500. What does differ is how sure that is. The deep end is
half again to twice as unpredictable at the same minute (±10 % against ±7 % at
the close, ±6 % against ±3 % fifteen minutes later), so the range a deep rank
gets past the close is wider, and the page reads the band of the rank it is
asked about.

Past the close the page is looking at a board that is still being published.
The settling above is measured from each team's own game times, where twenty
minutes past the buzzer every game has ended and nothing is left to come; but
the page reads Osirion's copy, and Osirion lands minutes behind the games. So
the *width* of the range past the close is measured on the feed's own
evenings instead, and split on the one signal that separates a board still
being published from one that is done: whether the same standing has been
read again. Unchanged for ten minutes, it is the final board in every reading
measured; fresher than that, it is 3 % short once in ten and 5 % once in
twenty, where the page used to quote about 1 %. The centre is untouched — the
board's own rate of climb, and a settling curve shifted or capped while the
board moved, were all tried as ways to anticipate the rest of the rise, and
every one of them was worse than the measured curve. So the page says how far
the board can still travel rather than pretending to know where it will stop,
and says in words that the last games are still landing.

The window's clock running out is not the end of the board: the games that
started on the hour land for another twenty minutes, and a reading taken at
21:59 is not the final standings however round the clock looks. The page waits
for the feed to read the same standings twice - that is the board saying it
has stopped, about this cup rather than on average - and says which of the
three it is meanwhile: still running, the last games still landing (with the
minute they should be in by), or final and unchanged since a given minute.

When the cup is over and the standings have stopped moving, the page stops
forecasting: a rank the feed read off the final board is shown as the result
it is - the number, the minute it was collected, and what the model had said
before the cup, for the record - with no range around it, because there is
nothing left to be uncertain about. Ranks the feed never read keep a forecast
and say so.

The chart reads with a finger as well as a pointer: dragging along it moves
the crosshair, and the numbers appear beside the chart rather than in a bubble
over it - on a phone the bubble covered what it described and a finger could
not summon it at all. Each line in the legend is a switch: a line switched off
leaves the chart, the numbers and the scale. The evening's readings are a
record rather than something to read, so they sit folded under a heading that
says how many there are.

From the second reading on, a chart under the ladder shows how it moved: the
points at the ranks read, reading by reading, and what the forecast said each
time with its range — over games in a sealed lobby, over minutes in an open
queue — against the pre-tournament forecast drawn as a hairline. The forecast
line is for the rank asked now, worked out again at every reading from
everything the evening had read by that minute, so asking another rank
redraws the whole line.

The cup last opened stays in the browser as it was left: reload the page and
it is back, a setting corrected by hand included, and the same row in the list
reopens it rather than the calendar's copy — another row, or **Type a
tournament by hand**, starts over. **Finish** keeps the evening and goes back to the
list, where the tournaments followed sit under the calendar, reopenable; the
arrow next to each one downloads it as a small file.

Both languages, EN/FR, switched in the header.

## How it works

A cascade, most direct reading first, each rung answering only when the one
above it cannot:

1. **The previous edition of this cup, in this format, at this rank, read
   straight.** With a band measured from how much that rank moved between
   editions. This is first because nothing beat it: a strong evening lifts every
   rank together, and a number read whole keeps that where a level times a ratio
   loses it. Four corrections, all said out loud on the page. Who was let in:
   the same cup admitting Unreal alone one week and Diamond upwards the next is
   two fields of different sizes, so the edition read is the last one with the
   same entry bar when it was played in the same season as the latest, and
   otherwise the latest with the band widened by half. The format: a cup that
   has never run as Duo reads its last Trio edition with the band widened by
   half, and a lobby that changed size is priced by rung 4 instead. The field:
   when the number of teams is known — typed in, or a later round's cut — and
   is not the edition's, the value moves along the curve from the edition's
   share of its field to this cup's share of its own, capped at about a fifth.
   And the season: a new season lifts every cup at once — +5 % at the top and
   +11 % past rank 500 at the turn of season 42, nothing at the turn of season
   41 — so an edition read from an earlier season is moved by what the season's
   earlier cups showed at that band of rank, its band widened by what that
   move leaves; before any cup of the season has run it is carried as it is,
   the band widened. The latest edition is read as deep as it was harvested,
   and a rank past that comes from an older one: the page says which edition
   it read, and from which season. The reading itself is the run of recent
   editions played the same way as the latest — same entry bar, season, games
   and table — averaged in log terms with the latest weighing 0.7 and each one
   before it 0.7 of what is left: one team's great night no longer sets next
   week's number, which trims the tail of the error without moving its median.
2. **The cup's level times a measured shape** — what each rank was worth
   relative to rank 20 across the cup's editions. A lookup, not a curve.
3. **The level times the ladder**, for ranks nobody has measured — what each
   rank is worth relative to rank 20 across every open queue of the same band
   of field size and game mode, a median per rank over at least twenty boards.
   A fitted curve used to answer here and ran 9 % low at rank 500 and 13 % low
   at rank 1,000 (two parameters cannot bend both ends of a ladder); it still
   answers for queues under three hundred teams and where the ladder has too
   few boards.
4. **Recent boards replayed under this cup's scoring table**, for a cup with no
   finished edition in its region. Every board carries each roster's placement
   and eliminations in each game; re-scored under the new table, the same
   games give the standings that table would have produced, and rank 20 of
   them is the forecast for rank 20 here — the six most recent boards of the
   same region, team size, mode and platform, the median across them, trusted
   down to a third of the rosters loaded and continued along the ladder past
   that. Where the cup has already run in other regions, half of that reading
   and half of this one. The replay is written beside the week's calendar by
   the machine that holds the boards; the page reads a dozen numbers per cup
   and says how many boards they rest on and to what depth. A cup opened from
   the calendar is the cup the calendar names — its own label, the model's —
   and never a neighbour whose name shares its words: matching names once
   priced a Solo Zero Build cup off a Trio cup, 463 points at rank 100 where
   the replay of its own format read 294.
5. **The finals of the same format, by share of the lobby**, for a final played
   in a single lobby that no edition has been seen of — the usual case for a
   Round 2 whose Round 1 the model knows. The two rungs either side of it are
   measured on open queues of thousands and price a twenty-team lobby off its
   last place. The last places themselves — past 90 % of the lobby — get no
   number unless the previous edition published them: they are teams that left
   after a game or two.
6. **The scoring table alone**, for a cup nobody has seen and no board to replay
   — the widest band, and the page says when it is in that mode. A cup's later
   round is its own kind of cup here: a few hundred qualified teams in a short
   session score another share of the maximum than the open round did.

The model is built from several thousand tournaments read from Osirion's public
API — the page shows exactly how many it was trained on, and which rung it
answered from.

## How well it works

Measured as a forecast: each of the newest 600 tournaments predicted from
everything that had finished before its day, nothing seeing the future
(7,632 tournaments on 22 September 2026; the figures are re-measured every three
days and travel with the model).

| rank band | median error, cup seen before |
|---|---:|
| top 1 – 5 | 4.3 % |
| top 6 – 25 | 2.1 % |
| top 26 – 100 | 2.2 % |
| top 101 – 500 | 2.6 % |
| beyond 500 | 5.6 % |
| **overall** | **2.8 %** |

94 % of real thresholds land inside a band that claims 80 %. Reading last
week's result straight gives 3.1 % on the same rows, and 9.2 % past rank 500
where the model reads 5.6 %; the top five ranks are the one band where it is as
good as the model.

The forecast is quoted with two ranges rather than one, and both are measured
on those held-out cups rather than assumed: the quantiles of the error, in
units of the band the model quotes, on every held-out threshold. Half the
cups land in the near range, nine in ten in the wide one. "Between 500 and
1,000 points" is no forecast at all; "between 700 and 750, one time in two"
says something a player can act on, and the wide range says how wrong it can
be when it is wrong. The two are asymmetric, because the errors are: a
threshold can come in at double the forecast, it cannot come in at less than
nothing.

These numbers are not typed into the page: they are carried in the model file
from the run that measured them, shown with that date, and shown as a dash when
there is nothing to show.

Two caveats the page repeats where they apply:

- A cup never seen in its region is forecast by replaying recent boards under
  its table, at 4 to 5 % median error at ranks 1–250 and about 6 % to rank
  1,000 (102 cups since mid-August, each read from boards played before it),
  where the scoring table alone read 8 to 11 %; a cup with no board to replay still
  reads the scoring table, at about 14 %; a final in a single lobby never seen
  before, from the finals of its format, at about 7 %. The page says which of
  these it is doing.
- The live refinement is measured on held-out evenings: between a third and
  two thirds of the session the answer was about 3 % off the final in median,
  and its ranges held 46 % and 88 % of the finals where they claim 50 % and
  90 %. How much the readings weigh against the history is measured again
  every three days on the evenings the feed followed. It is still a forecast
  with a band, not a result, until the board is final.

## Privacy

Everything the page computes happens in the browser. No analytics, no storage
beyond the browser keeping an evening in progress and the evenings saved. The
page opens on the week's calendar and an empty form.

The hosted pages may show advertising served by Google; visitors in Europe are
asked for their choice first, and the advertising has no bearing on anything
else on the page. The pages load their typeface from Google Fonts, and while a
tournament under way is open the forecast asks the site's own feed for that
cup's current standings, a request that carries nothing about you. The
[privacy note](https://fortnitepredcomp.com/privacy/) says exactly what each does.
The standalone file carries no advertising and no web font, and makes no request
at all.

Tournament data comes from [Osirion](https://osirion.gg)'s public Fortnite API.

## Building it

`python build.py` writes everything the host serves from what is in this
folder, standard library only:

| from | to |
|---|---|
| `src/app.html` + `model.json` + `calendar.js` | `index.html` + `model.js`, and `standalone.html` |
| `src/site/pages/en/*.html`, `src/site/pages/fr/*.html` | the guides, the week, method, about, contact, privacy — one folder per page, `fr/` for French |
| `src/site/site.css`, `src/site/site.js` | the same two files, shared by those pages |
| everything above | `sitemap.xml`, `robots.txt`, `404.html`, `privacy.html` (which now points at `privacy/`) |

A page under `src/site/pages/` is an HTML fragment behind a short JSON header
(its address, title, description, and the page it translates). The figures in
its prose are not typed in: `{{model_ape}}`, `{{pace_open 0.5}}` or
`<!--data:region_chart {"rank": "100"}-->` are read off the model and the
calendar at every build, so a guide never quotes a number the model has since
revised. `sitegen.py` says which exist. `python build.py --check` fails when any
built file is behind its sources.

`site.json` holds the site's settings, all optional but the feed:

```json
{"live": "https://…workers.dev", "name": "Threshold Ladder",
 "url": "https://fortnitepredcomp.com", "contact": "hello@example.com"}
```

`name` is the site's name in every title and header; `url` its address for the
canonical links and the sitemap (without it, the domain in `CNAME`); `contact`
an address readers may write to (without it, the contact page offers the
issue tracker alone). Moving the site to another name or domain is these two
lines, `CNAME`, the worker's `SITE` in `worker/wrangler.toml`, and the domain's
DNS; the pages follow at the next build.

The week's list reads each cup's forecast from `calendar.js`, where the
tracker's `calendar_snapshot.py` writes it from the same model
(`export_model.calendar_forecast`, checked against this page row by row), so the
list says what the page would say without running it. The repository's own
workflow rebuilds everything every three hours with the calendar and commits
what changed.

---

MIT licensed. This project is unaffiliated with Epic Games and uses no game
assets. Portions of the materials used are trademarks and/or copyrighted works
of Epic Games, Inc. All rights reserved by Epic. This material is not official
and is not endorsed by Epic.
