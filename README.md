# Threshold Ladder

**→ [Open the site](https://fortnitepredcomp.com/)** ·
*[Version française](README.fr.md)*

How many points a given finishing rank will take in a Fortnite tournament —
before the results exist, and more precisely once the session is running.

Thresholds are published after the fact. A player deciding whether to keep
playing, or how aggressively, is guessing. This estimates the answer from the
tournament's scoring table, its field size, and what earlier editions of
comparable tournaments did.

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
the ones running right now marked live and the ones already over left out.
Click one and the forecast opens on its own screen: name, region, team size,
mode, number of games, session length and scoring table are filled in, and the
answer is already there, because every one of those settings is Epic's own.
**All tournaments** at the top, or the browser's back button, returns to the
list.

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
known — and the scoring table pastes straight from the rules (`1 = 60`,
`1st 60`, `Top 1 : 60` and the rest all parse). **Confirm the settings**
freezes them so nothing shifts by accident.

The name field knows the tournaments in the model and matches loosely, so "FNCS
Div 2" finds "FNCS Division 2" — but never "FNCS Division 3", because the
numbers have to agree. When a name covers several stages, a second box lists
them with the number of editions behind each, and picking one fills in how many
games that stage usually runs.

**The number of games is the field that matters most.** The level scales with
it, so getting it wrong scales every threshold on the page. The rules cap is
what counts; the session length and the game length are a cross-check, and the
page says so when the clock does not leave room for the games the rules allow.

Type a rank, press **Predict**, and the number comes with the range around it.
Below the answer, the whole ladder from the top 1 down, with the rank asked for
marked.

### While the tournament runs

After each game, type what the standings show at two or three ranks and press
**Confirm**. That is the moment the forecast moves — nothing shifts while the
boxes are still being filled in. The reading is filed in a list with its game
number and the time, the points clear, the ranks stay where they were put, and
the counter goes to the next game. From one game to the next there is nothing to
do but type three numbers and press one button.

Each reading says how this cup is running against its history: a top-5 at 153
points after 3 of 6 games, in a cup whose previous edition closed at 246, is
running 23 % hot. How far along a threshold is at that point of the session is
measured rather than assumed — replaying past leaderboards game by game shows
that at half the games a threshold sits at half its final value, give or take
fifteen per cent from one cup to the next. Readings and history are then
combined by precision, whichever is sharper weighing more, so on the last game
the readings are the answer; the page says what share of it they carried.

How far a reading travels along the ladder was measured the same way, and the
two formats answer differently. In an open queue of thousands the whole board
moves together, so a reading at rank 20 prices rank 500 almost exactly. Inside
one closed lobby it does not: the same twenty teams share out a fixed pot, so a
team running away with the top takes the points that would have landed at rank
10. There a reading prices its own rank, the rest of the ladder keeps its
forecast from history, and the page says which of the two it is doing.

When the cup is under way and the site's live feed is on, the standings are
read for you every few minutes — the points at a handful of ranks — and filed
as readings marked *auto*: the forecast follows them without anyone typing. A
reading typed by hand still works and takes over while it is the fresher one.

**Finish** keeps the evening in the browser and goes back to the list, where
the tournaments followed sit under the calendar, reopenable; the arrow next to
each one downloads it as a small file.

Both languages, EN/FR, switched in the header.

## How it works

A cascade, most direct reading first, each rung answering only when the one
above it cannot:

1. **The previous edition of this cup, at this rank, read straight.** With a
   band measured from how much that rank moved between editions. This is first
   because nothing beat it: a strong evening lifts every rank together, and a
   number read whole keeps that where a level times a ratio loses it.
2. **The cup's level times a measured shape** — what each rank was worth
   relative to rank 20 across the cup's editions. A lookup, not a curve.
3. **The level times a fitted curve**, for ranks nobody has measured.
4. **The finals of the same format, by share of the lobby**, for a final played
   in a single lobby that no edition has been seen of — the usual case for a
   Round 2 whose Round 1 the model knows. The two rungs either side of it are
   measured on open queues of thousands and price a twenty-team lobby off its
   last place.
5. **The scoring table alone**, for a cup nobody has seen — the widest band, and
   the page says when it is in that mode.

The model is built from several thousand tournaments read from Osirion's public
API — the page shows exactly how many it was trained on, and which rung it
answered from.

## How well it works

Measured as a forecast: the newest 600 tournaments predicted from the 6,632
before them, nothing seeing the future.

| rank band | median error, cup seen before |
|---|---:|
| top 1 – 5 | 5.4 % |
| top 6 – 25 | 4.4 % |
| top 26 – 100 | 3.6 % |
| top 101 – 500 | 5.2 % |
| beyond 500 | 8.7 % |
| **overall** | **5.0 %** |

83 % of real thresholds land inside a band that claims 80 %.

These numbers are not typed into the page: they are carried in the model file
from the run that measured them, shown with that date, and shown as a dash when
there is nothing to show.

Two caveats the page repeats where they apply:

- A cup never seen before — half of a new season's tournaments — is forecast
  from its scoring table alone, at about 20 % median error rather than 5 %; a
  final in a single lobby never seen before, from the finals of its format, at
  about 13 %. The page says which of these it is doing.
- The pace curve behind the live refinement is measured, but the rule that
  blends readings with history has not been validated on held-out tournaments.
  The live number is an indication with a measured band, not a result.

## Privacy

Everything the page computes happens in the browser. No analytics, no storage
beyond the browser keeping an evening in progress and the evenings saved. The
page opens on the week's calendar and an empty form.

The hosted page shows one advertising banner, served by Google; visitors in
Europe are asked for consent first, and the banner has no bearing on anything
else on the page. While a tournament under way is open, it also asks the site's
own feed for that cup's current standings, a request that carries nothing about
you. The [privacy note](privacy.html) says exactly what each does.
The standalone file carries no banner and makes no request at all, apart from
falling back to a system font.

Tournament data comes from [Osirion](https://osirion.gg)'s public Fortnite API.

---

MIT licensed. This project is unaffiliated with Epic Games and uses no game
assets. Portions of the materials used are trademarks and/or copyrighted works
of Epic Games, Inc. All rights reserved by Epic. This material is not official
and is not endorsed by Epic.
