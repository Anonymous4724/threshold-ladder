# Threshold Ladder

*[Version française](README.fr.md)*

A page that tells you how many points a given finishing rank will take in a
Fortnite tournament — before the results exist, and again more precisely once
the session is running.

No installation, no account, no API key. Open the site, pick this week's
tournament from the list, type the rank you care about.

Two builds of the same source:

- **`index.html` + `model.js` + `calendar.js`** — the site. The model is a
  separate file so it can grow; the calendar is what is on this week.
- **`standalone.html`** — everything in one file, no network needed. Right-click,
  save, double-click. The calendar inside it is frozen at the date it was built,
  and says so.

---

## What it does

The page opens on **what is on this week**: every tournament in the calendar,
filtered by region and mode, searchable by name, with the ones running right now
marked live. Click one and the form fills itself — name, region, team size, mode,
number of games, session length, and the scoring table — and the answer comes
with the click: the settings are confirmed for you, since every one of them is
Epic's own, and the rank asked is **the cut that matters**. Each cup carries the
cuts it pays out on, read from its payout table: the top 2,000 go through to
Round 2, the top 25 reach the final, money from 8th place, a cosmetic down to
500th. They sit above the answer as chips — click one to price it — the widest
qualification cut is what the page asks first, and the ladder names them so
"top 2,000 · qualifies for Round 2" is a line you can find rather than a number
you have to know. A cut given as a share of the field (the top 25 %) is turned
into a rank with the field the forecast uses, and says so.

A final played by qualified teams in one lobby is recognised as a closed lobby:
the format is set to sealed and the field to the lobby size, and the page says
so under the field. The recognition uses the same loose name match as the
forecast, so a cup the model knows under a slightly different spelling is
still read right.

Or fill it in by hand — name, region, team size, mode, open window or sealed, how
long the session runs and how long a game takes, the field size if you know it —
and paste the scoring table straight from the rules (the parser accepts `1 = 60`,
`1st 60`, `Top 1 : 60` and the rest). Then press **Confirm the settings**, which
freezes them so nothing shifts under you by accident.

Type the rank you care about, press **Predict**, and you get the number with the
range around it. Change the rank, press again — the settings stay put. Below the
answer, the whole ladder from the top 1 down, with the rank you asked for
marked.

The name field knows the tournaments in the model and matches loosely, so "FNCS
Div 2" finds "FNCS Division 2" — but never "FNCS Division 3", because the
numbers have to agree. When the name covers several stages, a second box lists
them — Round 1, Qualification — with the number of editions behind each, and
picking one fills in how many games that stage usually runs.

**The number of games is the single most important field.** The level scales
with it, so getting it wrong scales every threshold on the page. The rules cap
is what counts; the session length and the game length are a cross-check, and
the page says so out loud when the clock does not leave room for the games the
rules allow.

Then, while you play, you follow it game by game. After each game you type what
the standings show at two or three ranks and press **Confirm**: that is the
moment the forecast moves — nothing shifts while you are still typing. The
reading is filed in a list with its game number and the time, the points clear,
the ranks stay where you put them, and the counter goes to the next game. So
from one game to the next there is nothing to do but type three numbers and
press one button. When it is over, **Finish and save** keeps the evening in the
browser and writes it to a file that `import_session.py` in the research
repository reads back into the database — which is how a followed evening
becomes the one thing the live model has never had: a tournament watched all
the way to the end with the answer known.

Each reading says how this cup is running against its history — a top-5 at 153
points after 3 of 6 games, in a cup whose previous edition closed at 246, is
running 23 % hot. How far along a threshold is at that point of the session is
measured, not assumed: `analysis/live.py` replays harvested boards game by game
and finds that at half the games a threshold sits at half its final value, give
or take fifteen per cent from one cup to the next. Readings and history are then
combined by precision — whichever is sharper weighs more — so at the last game
the readings are the answer, and the page says what share of it they carried.

How far a reading travels along the ladder is measured too, and the two formats
answer differently. In an open queue of thousands the whole board moves
together, so a reading at rank 20 prices rank 500 almost exactly (slope 0.86
between ranks, measured). Inside one closed lobby it does not: the same twenty
teams share out a fixed pot, so a team running away with the top takes the
points that would have landed at rank 10, and the measured slope is zero. There
a reading prices its own rank and the rest of the ladder keeps its forecast from
history — which is what the page does, and says.

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
4. **The scoring table alone**, for a cup nobody has seen — the widest band, and
   the page says when it is in that mode.

The model ships with 7,232 tournaments and 1,765 categories read from Osirion's
public API, and knows which rung it answered from: the page shows it.

## How well it works

Measured as a forecast: the newest 600 tournaments predicted from the 6,632
before them, nothing seeing the future.

| rank band | median error, cup seen before |
|---|---:|
| top 1 – 5 | 5.5 % |
| top 6 – 25 | 5.0 % |
| top 26 – 100 | 5.6 % |
| top 101 – 500 | 6.2 % |
| beyond 500 | 9.7 % |
| **overall** | **5.7 %** |

82 % of real thresholds land inside a band that claims 80 %.

These numbers are not typed into the page. `analysis/validate.py` writes them
to `validation.json`, the export carries them into `model.json`, and the
"what this rests on" panel prints what is there — with the date they were
measured, and a dash when they have not been.

Two caveats the page repeats where they apply:

- A cup the model has never seen — half of a new season's tournaments — is
  forecast from its scoring table alone, at about 19 % median error rather than
  6 %. The page says when it is in that mode.
- The live refinement's pace curve is measured on replayed boards (44 at the
  time of writing; the full harvest is a command away), but the rule that blends
  readings with history has not yet been validated on held-out tournaments.
  Treat the live number as an indication with a measured band, not a result.

Everything above comes from the research repository this file is built from,
which holds the data, the cross-validation and the methodology note.

## Building it, and putting it on the web

The built files are generated and committed, so the site is the repository.

```
python build.py          # src/app.html + model.json (+ calendar.js)
                         #   ->  index.html, model.js, standalone.html
python build.py --check  # fails if any of them is behind its sources
python publish.py        # first time only: repository, push, GitHub Pages on
```

Hosting takes no server: three static files and a CDN. `publish.py` does the
one-time setup — makes the folder a repository, commits under the account name,
creates it on GitHub (with `gh` if it is installed, otherwise it says which two
clicks to make), pushes, and turns Pages on. The site then lives at
`https://<account>.github.io/threshold-ladder/`, up whether or not anything of
yours is running. Afterwards `refresh.py --publish` in the research repository
rebuilds and pushes in one command; the calendar covers seven days, so that
wants to run at least weekly. Anyone who would rather have a file than a link
takes `standalone.html`: the whole thing in one page, no network at all.

`model.json` is written by `export_model.py` in the research repository, which
refuses to write it until it has reproduced the Python model to the decimal on a
sample of the training set. `calendar.js` is written by `calendar_snapshot.py`
there, from the week ahead. The JavaScript in `src/app.html` is a line-by-line
port of `predict_from_model()` — if you change one, change the other; the export
will refuse to write until they agree again.

## Privacy

Nothing leaves the page. There is no analytics, no request to anyone but the
host serving the page itself, no storage beyond your own browser remembering the
last tournament you typed. The standalone file behaves identically with the
network off, apart from falling back to a system font.

---

MIT licensed. Fortnite is a trademark of Epic Games; this project is
unaffiliated with them and uses no game assets.
