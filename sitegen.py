"""The site around the predictor: the week's cups, the guides, the method,
about, contact and privacy - in English and in French.

`build.py` writes the predictor itself; this writes everything a reader or a
search engine reaches from it. Pages are HTML fragments in `src/site/pages/`,
one folder per language, each opening with a comment that holds its settings
as JSON:

    <!--page
    {"path": "guides/scoring/", "title": "...", "description": "...",
     "pair": "scoring", "section": "guides", "order": 2, "updated": "2026-09-22"}
    -->
    <h1>...</h1> ...

`pair` joins a page to its translation. Numbers the model measures are not
typed into the prose: a fragment says `<!--data:pace_chart-->` or
`{{pct:pace_open 0.5}}` and the build reads them off model.json and
calendar.js, so a page never quotes a figure the model has since revised.
`<!--ad-->` marks where an in-article unit may go; with no unit configured the
mark disappears.

Standard library only, like everything else the build runs: it runs on the
machine that trains the model and on GitHub's runner every three hours.
"""
from __future__ import annotations

import html
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "src" / "site"
PAGES = SOURCE / "pages"
LANGS = ("en", "fr")
DEFAULT_NAME = "Threshold Ladder"
REPO = "https://github.com/Anonymous4724/threshold-ladder"
TRACKER_REPO = "https://github.com/Anonymous4724/fortnite-tracker"
ICON = ("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>"
        "<rect width='100' height='100' rx='18' fill='%23e8a13a'/><path d='M22 72h14V40H22zm20 0h14V26H42zm20 "
        "0h14V52H62z' fill='%23161a24'/></svg>")
FONTS = ("https://fonts.googleapis.com/css2?family=Chivo:ital,wght@0,300;0,400;0,600;0,800;1,400"
         "&family=Chivo+Mono:wght@300;400;600&display=swap")
# The notice Epic's Fan Content Policy asks every fan page to carry, in its
# own words - which is why it stays in English on the French pages too.
EPIC = ("Portions of the materials used are trademarks and/or copyrighted works of Epic Games, Inc. "
        "All rights reserved by Epic. This material is not official and is not endorsed by Epic.")

UI = {
    "en": {
        "nav.tool": "Forecast", "nav.week": "This week", "nav.guides": "Guides",
        "nav.method": "How it works", "nav.about": "About",
        "skip": "Skip to content", "other": "Français", "other.short": "FR",
        "updated": "Updated {d}", "home": "Home", "guides": "Guides",
        "foot.about": "About", "foot.contact": "Contact", "foot.privacy": "Privacy",
        "foot.method": "Method and accuracy", "foot.source": "Source code",
        "foot.credit": "Tournament data from {osirion}'s public Fortnite API. Forecasts are statistical "
                       "estimates, not guarantees.",
        "foot.independent": "An independent fan project, not affiliated with Epic Games or Osirion.",
        "foot.epic.fr": "",
        "ad": "Advertisement", "table": "The numbers behind the chart",
        "open": "Open in the forecast", "read": "Read the guide",
        "404.title": "Page not found", "404.body": "This page does not exist, or no longer does.",
        "404.back": "Back to the forecast", "404.guides": "Browse the guides",
        "redirect": "This page has moved to {link}.",
        "lang.name": "English",
    },
    "fr": {
        "nav.tool": "Prévisions", "nav.week": "Cette semaine", "nav.guides": "Guides",
        "nav.method": "Méthode", "nav.about": "À propos",
        "skip": "Aller au contenu", "other": "English", "other.short": "EN",
        "updated": "Mis à jour le {d}", "home": "Accueil", "guides": "Guides",
        "foot.about": "À propos", "foot.contact": "Contact", "foot.privacy": "Confidentialité",
        "foot.method": "Méthode et précision", "foot.source": "Code source",
        "foot.credit": "Données de tournois issues de l'API publique Fortnite d'{osirion}. Les prévisions "
                       "sont des estimations statistiques, pas des garanties.",
        "foot.independent": "Un projet de fan indépendant, sans lien avec Epic Games ni Osirion.",
        "foot.epic.fr": "Certains éléments utilisés sont des marques et/ou des œuvres protégées d'Epic Games, "
                        "Inc. Tous droits réservés par Epic. Ce contenu n'est ni officiel ni approuvé par Epic.",
        "ad": "Publicité", "table": "Les chiffres derrière le graphique",
        "open": "Ouvrir dans les prévisions", "read": "Lire le guide",
        "404.title": "Page introuvable", "404.body": "Cette page n'existe pas, ou plus.",
        "404.back": "Retour aux prévisions", "404.guides": "Voir les guides",
        "redirect": "Cette page a déménagé : {link}.",
        "lang.name": "Français",
    },
}
# Where each language's sections live; the tool itself is the English home.
ROOTS = {
    "en": {"tool": "", "home": "", "week": "this-week/", "guides": "guides/", "method": "methodology/",
           "about": "about/", "contact": "contact/", "privacy": "privacy/"},
    "fr": {"tool": "?lang=fr", "home": "fr/", "week": "fr/cette-semaine/", "guides": "fr/guides/",
           "method": "fr/methode/", "about": "fr/a-propos/", "contact": "fr/contact/",
           "privacy": "fr/confidentialite/"},
}


# ------------------------------------------------------------------ helpers
def esc(text) -> str:
    return html.escape(str(text), quote=True)


def fmt_num(x: float, lang: str, digits: int = 0) -> str:
    """A number the way each language writes it: 1,234.5 or 1 234,5."""
    if x is None or (isinstance(x, float) and not math.isfinite(x)):
        return "—"
    text = f"{x:,.{digits}f}"
    if lang == "fr":
        text = text.replace(",", " ").replace(".", ",")
    return text


def fmt_pct(share: float, lang: str, digits: int = 0, signed: bool = False) -> str:
    """A share as a percentage: 49% in English, 49 % in French."""
    if share is None:
        return "—"
    value = 100 * share
    text = fmt_num(abs(value) if signed else value, lang, digits)
    if signed:
        text = ("+" if value > 0 else "−" if value < 0 else "±") + text
    return text + (" %" if lang == "fr" else "%")


def fmt_date(iso: str, lang: str) -> str:
    try:
        d = datetime.fromisoformat(str(iso)[:10])
    except ValueError:
        return str(iso)
    # Spelled out rather than strftime'd: the month names would follow the
    # machine's locale, and "%-d" does not exist on Windows.
    if lang == "fr":
        months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
                  "septembre", "octobre", "novembre", "décembre"]
        return f"{d.day}{'er' if d.day == 1 else ''} {months[d.month - 1]} {d.year}"
    months = ["January", "February", "March", "April", "May", "June", "July", "August",
              "September", "October", "November", "December"]
    return f"{d.day} {months[d.month - 1]} {d.year}"


def rel_link(src: str, dst: str) -> str:
    """A link from the page at path `src` ("guides/x/") to `dst` ("about/"),
    relative, so the site works under any base path."""
    depth = src.count("/")
    prefix = "../" * depth
    if dst.startswith("?"):
        return (prefix or "./") + dst
    return prefix + dst if (prefix + dst) else "./"


def nice_step(span: float, ticks: int = 5) -> float:
    raw = span / max(ticks, 1)
    power = 10 ** math.floor(math.log10(raw)) if raw > 0 else 1
    for m in (1, 2, 2.5, 5, 10):
        if raw <= m * power:
            return m * power
    return 10 * power


# ------------------------------------------------------------------ charts
SERIES = ("s1", "s2", "s3")


def line_chart(*, xs: list, series: list[dict], lang: str, x_fmt, y_fmt, x_title: str, y_title: str,
               caption: str, y_max: float | None = None, log_x: bool = False, x_ticks: list | None = None,
               label: str = "") -> str:
    """An inline SVG line chart: thin lines, one axis, a legend for two series
    or more, the last value labelled at each line's end, a native tooltip on
    every point, and the table behind it."""
    width, height = 640, 300
    left, right, top, bottom = 52, 118, 16, 44
    plot_w, plot_h = width - left - right, height - top - bottom
    values = [v for s in series for v in s["values"] if v is not None]
    y_top = y_max if y_max is not None else max(values) * 1.08
    step = nice_step(y_top, 5)
    y_top = math.ceil(y_top / step - 1e-9) * step
    x_min, x_max = min(xs), max(xs)
    fx = (lambda x: math.log(x)) if log_x else (lambda x: x)
    def X(x):
        return left + plot_w * (fx(x) - fx(x_min)) / ((fx(x_max) - fx(x_min)) or 1)
    def Y(y):
        return top + plot_h * (1 - y / y_top)
    parts = [f'<svg class="chart" viewBox="0 0 {width} {height}" role="img" aria-label="{esc(label or caption)}" '
             f'data-hover="line">']
    y = 0.0
    while y <= y_top + 1e-9:
        parts.append(f'<line class="grid" x1="{left}" x2="{left + plot_w}" y1="{Y(y):.1f}" y2="{Y(y):.1f}"/>')
        parts.append(f'<text class="tick" x="{left - 8}" y="{Y(y) + 4:.1f}" text-anchor="end">{esc(y_fmt(y))}</text>')
        y += step
    for x in (x_ticks or xs):
        parts.append(f'<text class="tick" x="{X(x):.1f}" y="{top + plot_h + 18}" text-anchor="middle">{esc(x_fmt(x))}</text>')
    parts.append(f'<text class="axis-title" x="{left + plot_w / 2:.1f}" y="{height - 6}" text-anchor="middle">{esc(x_title)}</text>')
    parts.append(f'<text class="axis-title" x="12" y="{top + plot_h / 2:.1f}" text-anchor="middle" '
                 f'transform="rotate(-90 12 {top + plot_h / 2:.1f})">{esc(y_title)}</text>')
    ends = []
    for i, s in enumerate(series):
        cls = s.get("cls") or SERIES[i % len(SERIES)]
        pts = [(X(x), Y(v), x, v) for x, v in zip(xs, s["values"]) if v is not None]
        if not pts:
            continue
        path = " ".join(("M" if j == 0 else "L") + f"{px:.1f},{py:.1f}" for j, (px, py, _, _) in enumerate(pts))
        parts.append(f'<path class="line {cls}" d="{path}"/>')
        for px, py, x, v in pts:
            parts.append(f'<circle class="dot {cls}" cx="{px:.1f}" cy="{py:.1f}" r="4"><title>{esc(s["name"])} · '
                         f'{esc(x_fmt(x))}: {esc(y_fmt(v))}</title></circle>')
        ends.append([pts[-1][1], s.get("short") or s["name"], y_fmt(pts[-1][3]), cls, pts[-1][0]])
    # Each line labelled where it ends, nudged apart where two end close
    # together at the same place so they do not overprint.
    ends.sort()
    for j in range(1, len(ends)):
        if abs(ends[j][4] - ends[j - 1][4]) < 60 and ends[j][0] - ends[j - 1][0] < 15:
            ends[j][0] = ends[j - 1][0] + 15
    for py, name, text, cls, px in ends:
        parts.append(f'<text class="end-label" x="{px + 8:.1f}" y="{py + 4:.1f}">{esc(text)} · {esc(name)}</text>')
    parts.append("</svg>")
    legend = ""
    if len(series) > 1:
        legend = '<p class="legend">' + "".join(
            f'<span><i class="{s.get("cls") or SERIES[i % len(SERIES)]}"></i>{esc(s["name"])}</span>'
            for i, s in enumerate(series)) + "</p>"
    head = "<tr><th>" + esc(x_title) + "</th>" + "".join(f"<th>{esc(s['name'])}</th>" for s in series) + "</tr>"
    rows = "".join("<tr><td>" + esc(x_fmt(x)) + "</td>" + "".join(
        f"<td>{esc(y_fmt(s['values'][k])) if s['values'][k] is not None else '—'}</td>" for s in series) + "</tr>"
        for k, x in enumerate(xs))
    table = (f'<details class="chart-table"><summary>{esc(UI[lang]["table"])}</summary>'
             f'<div class="scroll"><table class="data"><thead>{head}</thead><tbody>{rows}</tbody></table></div></details>')
    return (f'<figure class="chart-fig">{legend}{"".join(parts)}<figcaption>{caption}</figcaption>{table}</figure>')


def bar_chart(*, rows: list[tuple[str, float, str]], lang: str, caption: str, label: str,
              v_max: float | None = None, reference: float | None = None, ref_label: str = "") -> str:
    """Horizontal bars, one series: the value written at each bar's end."""
    width, bar, gap, left, right, top = 640, 22, 10, 150, 90, 8
    height = top + len(rows) * (bar + gap) + 26
    top_value = v_max or max(v for _, v, _ in rows) * 1.05
    plot_w = width - left - right
    def W(v):
        return plot_w * v / top_value
    parts = [f'<svg class="chart" viewBox="0 0 {width} {height}" role="img" aria-label="{esc(label)}">']
    if reference is not None:
        x = left + W(reference)
        parts.append(f'<line class="ref" x1="{x:.1f}" x2="{x:.1f}" y1="{top - 4}" y2="{height - 22}"/>')
        parts.append(f'<text class="tick" x="{x:.1f}" y="{height - 6}" text-anchor="middle">{esc(ref_label)}</text>')
    for i, (name, value, text) in enumerate(rows):
        y = top + i * (bar + gap)
        w = max(W(value), 2)
        parts.append(f'<text class="tick" x="{left - 10}" y="{y + bar / 2 + 4:.1f}" text-anchor="end">{esc(name)}</text>')
        parts.append(f'<path class="bar s1" d="M{left},{y} h{w - 4:.1f} a4,4 0 0 1 4,4 v{bar - 8} a4,4 0 0 1 -4,4 h-{w - 4:.1f} z">'
                     f'<title>{esc(name)}: {esc(text)}</title></path>')
        parts.append(f'<text class="end-label" x="{left + w + 8:.1f}" y="{y + bar / 2 + 4:.1f}">{esc(text)}</text>')
    parts.append("</svg>")
    return f'<figure class="chart-fig">{"".join(parts)}<figcaption>{caption}</figcaption></figure>'


# ------------------------------------------------------------------ the numbers
class Data:
    """What the pages quote, read once off the model and the calendar."""

    def __init__(self, model: dict, calendar: dict | None):
        self.model = model or {}
        self.calendar = calendar or {}
        pace = self.model.get("pace") or {}
        self.pace_open = {float(k): float(v) for k, v in ((pace.get("curve") or {}).get("open_by_time") or {}).items()}
        self.pace_closed = {float(k): float(v) for k, v in ((pace.get("curve") or {}).get("closed_by_game") or {}).items()}
        self.spread_open = {float(k): float(v) for k, v in ((pace.get("dispersion") or {}).get("open_by_time") or {}).items()}
        tail = (pace.get("tail") or {})
        self.tail_open = {float(k): float(v) for k, v in (tail.get("open_by_time") or {}).items()}
        self.tail_ranks = tail.get("by_rank") or []
        self.boards = pace.get("boards") or {}
        self.quality = self.model.get("quality") or {}
        self.source = self.model.get("source") or {}

    # -- small facts, for {{...}} in the prose
    def fact(self, key: str, lang: str) -> str:
        name, _, arg = key.partition(" ")
        q, s = self.quality, self.source
        if name == "tournaments":
            return fmt_num(s.get("tournaments"), lang)
        if name == "thresholds":
            return fmt_num(s.get("thresholds"), lang)
        if name == "model_date":
            return fmt_date(self.model.get("generated", ""), lang)
        if name == "quality_date":
            return fmt_date(q.get("generated", ""), lang)
        if name == "pace_open":
            return fmt_pct(self.pace_open.get(float(arg)), lang)
        if name == "pace_closed":
            return fmt_pct(self.pace_closed.get(float(arg)), lang)
        if name == "spread_open":
            return fmt_pct(self.spread_open.get(float(arg)), lang)
        if name == "tail_open":
            return fmt_pct(self.tail_open.get(float(arg)), lang)
        if name == "tail_rank":
            lo, minutes = arg.split()
            for row in self.tail_ranks:
                if int(row[0]) == int(lo):
                    return fmt_pct(float((row[2] or {}).get(minutes, 0)), lang)
            return "—"
        if name == "boards_open":
            return fmt_num(self.boards.get("open"), lang)
        if name == "boards_closed":
            return fmt_num(self.boards.get("closed"), lang)
        if name in ("median_ape", "mean_ape", "cold_median_ape", "lobby_median_ape"):
            v = q.get(name)
            return fmt_num(v, lang, 1) + (" %" if lang == "fr" else "%") if v is not None else "—"
        if name == "coverage":
            return fmt_pct(q.get("coverage"), lang)
        if name == "targets":
            return fmt_num(q.get("targets"), lang)
        if name == "validated":
            return fmt_num(q.get("thresholds"), lang)
        if name == "from":
            return fmt_date(q.get("from", ""), lang)
        if name == "ladder":
            # {{ladder 2000 3000 1000}}: rank 1,000 against rank 20 in Battle
            # Royale open queues of 2,000 to 3,000 teams, as a percentage.
            lo, hi, rank = (int(v) for v in arg.split())
            for row in self.model.get("ladders") or []:
                if (int(row["lo"]), int(row["hi"])) == (lo, hi) and row.get("game_mode") == "Battle Royale":
                    cell = (row.get("shape") or {}).get(str(rank))
                    return fmt_pct(float(cell[0]), lang) if cell else "—"
            return "—"
        if name == "ape_points":
            v = ((q.get("baselines") or {}).get("model") or {}).get("median_ape")
            return fmt_num(float(arg) * float(v) / 100, lang) if v is not None else "—"
        if name == "model_ape":
            v = ((q.get("baselines") or {}).get("model") or {}).get("median_ape")
            return fmt_num(v, lang, 1) + (" %" if lang == "fr" else "%") if v is not None else "—"
        if name == "carry_ape":
            v = ((q.get("baselines") or {}).get("carry") or {}).get("median_ape")
            return fmt_num(v, lang, 1) + (" %" if lang == "fr" else "%") if v is not None else "—"
        if name == "median_base_ape":
            v = ((q.get("baselines") or {}).get("median") or {}).get("median_ape")
            return fmt_num(v, lang, 1) + (" %" if lang == "fr" else "%") if v is not None else "—"
        if name == "season":
            return str(self.model.get("season", ""))
        if name == "week_count":
            return fmt_num(len(self.calendar.get("events") or []), lang)
        raise KeyError(key)

    # -- blocks, for <!--data:...--> in the prose
    def pace_chart(self, lang: str, arg: dict) -> str:
        xs = [round(x / 10, 1) for x in range(1, 11)]
        t = {"en": ("Open queue, by the clock", "Single lobby, by games played",
                    "Share of the session gone", "Share of the final threshold",
                    "How much of its final value the threshold at a given rank has reached, "
                    f"by the share of the session gone. Replayed from {fmt_num(self.boards.get('open'), lang)} "
                    f"open-queue and {fmt_num(self.boards.get('closed'), lang)} single-lobby leaderboards."),
             "fr": ("File ouverte, à l'horloge", "Lobby unique, aux parties jouées",
                    "Part de la session écoulée", "Part du seuil final",
                    "La part de sa valeur finale qu'a atteinte le seuil d'un rang donné, selon la part "
                    f"de la session écoulée. Rejoué sur {fmt_num(self.boards.get('open'), lang)} classements "
                    f"de files ouvertes et {fmt_num(self.boards.get('closed'), lang)} de lobbys uniques.")}[lang]
        short = {"en": ("open queue", "lobby"), "fr": ("file ouverte", "lobby")}[lang]
        series = [{"name": t[0], "short": short[0], "values": [self.pace_open.get(x) for x in xs]},
                  {"name": t[1], "short": short[1], "values": [self.pace_closed.get(x) for x in xs], "cls": "s2"}]
        return line_chart(xs=xs, series=series, lang=lang, x_fmt=lambda x: fmt_pct(x, lang),
                          y_fmt=lambda y: fmt_pct(y, lang), x_title=t[2], y_title=t[3], caption=t[4],
                          y_max=1.0, label=t[4])

    def pace_table(self, lang: str, arg: dict) -> str:
        """How far a reading can be from its usual share, by point of the session."""
        head = {"en": ("Share of the session gone", "Threshold reached, typically", "Typical spread from cup to cup"),
                "fr": ("Part de la session écoulée", "Seuil atteint, en général", "Écart typique d'une cup à l'autre")}[lang]
        rows = []
        for x in (0.2, 0.3, 0.5, 0.7, 0.9, 1.0):
            if x in self.pace_open:
                spread = self.spread_open.get(x)
                rows.append(f"<tr><td>{fmt_pct(x, lang)}</td><td>{fmt_pct(self.pace_open[x], lang)}</td>"
                            f"<td>± {fmt_pct(spread, lang) if spread is not None else '—'}</td></tr>")
        return (f'<div class="scroll"><table class="data"><thead><tr><th>{head[0]}</th><th>{head[1]}</th>'
                f'<th>{head[2]}</th></tr></thead><tbody>{"".join(rows)}</tbody></table></div>')

    def tail_table(self, lang: str, arg: dict) -> str:
        head = {"en": ("Minutes after the window closes", "Ranks 1–25", "Ranks 26–100"),
                "fr": ("Minutes après la fermeture", "Rangs 1 à 25", "Rangs 26 à 100")}[lang]
        cols = {int(r[0]): r[2] for r in self.tail_ranks}
        rows = []
        for minute in ("0", "5", "10", "15", "20"):
            a = (cols.get(1) or {}).get(minute)
            b = (cols.get(26) or {}).get(minute)
            rows.append(f"<tr><td>{minute}</td><td>{fmt_pct(a, lang) if a is not None else '—'}</td>"
                        f"<td>{fmt_pct(b, lang) if b is not None else '—'}</td></tr>")
        return (f'<div class="scroll"><table class="data"><thead><tr><th>{head[0]}</th><th>{head[1]}</th>'
                f'<th>{head[2]}</th></tr></thead><tbody>{"".join(rows)}</tbody></table></div>')

    def ladder_chart(self, lang: str, arg: dict) -> str:
        mode = arg.get("mode", "Battle Royale")
        bands = [(650, 1000), (2000, 3000), (6500, 9900)]
        ranks = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500]
        found = {(int(l["lo"]), int(l["hi"])): l for l in self.model.get("ladders") or [] if l.get("game_mode") == mode}
        series = []
        for i, (lo, hi) in enumerate(bands):
            row = found.get((lo, hi))
            if not row:
                continue
            shape = row.get("shape") or {}
            name = {"en": f"{fmt_num(lo, lang)}–{fmt_num(hi, lang)} teams",
                    "fr": f"{fmt_num(lo, lang)} à {fmt_num(hi, lang)} équipes"}[lang]
            short = f"{fmt_num(lo, lang)}–{fmt_num(hi, lang)}"
            values = []
            for r in ranks:
                cell = shape.get(str(r))
                values.append(float(cell[0]) if cell and r < hi else None)
            series.append({"name": name, "short": short, "values": values, "cls": SERIES[i]})
        if not series:
            return ""
        t = {"en": ("Rank (log scale)", "Threshold relative to rank 20",
                    f"What a rank is worth relative to rank 20, by size of the field, in {mode} open queues: "
                    "the median over every harvested leaderboard of that size."),
             "fr": ("Rang (échelle logarithmique)", "Seuil relatif au rang 20",
                    f"Ce que vaut un rang par rapport au rang 20, selon la taille du plateau, en files ouvertes "
                    f"{mode} : la médiane sur tous les classements moissonnés de cette taille.")}[lang]
        return line_chart(xs=ranks, series=series, lang=lang, x_fmt=lambda x: fmt_num(x, lang),
                          y_fmt=lambda y: fmt_num(y, lang, 2), x_title=t[0], y_title=t[1], caption=t[2],
                          log_x=True, label=t[2])

    def season_table(self, lang: str, arg: dict) -> str:
        shifts = (self.model.get("season_shifts") or {}).get("boundaries") or []
        starts = {int(n): d for n, d in self.model.get("seasons") or []}
        head = {"en": ("New season", "Began", "Ranks 1–100", "101–500", "Deeper", "Cup pairs compared"),
                "fr": ("Nouvelle saison", "Début", "Rangs 1 à 100", "101 à 500", "Au-delà", "Paires de cups comparées")}[lang]
        rows = []
        for since, until, cells in shifts:
            def cell(band):
                c = cells.get(band)
                return fmt_pct(math.exp(float(c[0])) - 1, lang, 0, signed=True) if c else "—"
            pairs = sum(int((cells.get(b) or [0, 0, 0])[2]) for b in ("100", "500", "0"))
            rows.append(f"<tr><td>{esc(until)}</td><td>{esc(fmt_date(starts.get(int(until), ''), lang))}</td>"
                        f"<td>{cell('100')}</td><td>{cell('500')}</td><td>{cell('0')}</td><td>{fmt_num(pairs, lang)}</td></tr>")
        return (f'<div class="scroll"><table class="data"><thead><tr>' + "".join(f"<th>{h}</th>" for h in head)
                + f'</tr></thead><tbody>{"".join(reversed(rows))}</tbody></table></div>')

    def region_fields(self, lang: str, arg: dict) -> str:
        regions = ["EU", "NAC", "NAW", "BR", "ME", "ASIA", "OCE"]
        formats = [("Solo", "Battle Royale"), ("Duo", "Battle Royale"), ("Trio", "Battle Royale"),
                   ("Solo", "Zero Build"), ("Duo", "Reload")]
        cells = {}
        for row in self.model.get("mode_fields") or []:
            cells[(row["team_mode"], row["game_mode"], row["region"])] = row
        label = {"en": "Format", "fr": "Format"}[lang]
        head = f"<tr><th>{label}</th>" + "".join(f"<th>{r}</th>" for r in regions) + "</tr>"
        body = []
        for team, mode in formats:
            tds = []
            for r in regions:
                row = cells.get((team, mode, r))
                if not row:
                    tds.append("<td>—</td>")
                    continue
                v = int(row["field"])
                text = fmt_num(v, lang) + ("+" if v >= 9900 else "")
                tds.append(f"<td>{text}</td>")
            body.append(f"<tr><td>{esc(team)} · {esc(mode)}</td>{''.join(tds)}</tr>")
        return f'<div class="scroll"><table class="data"><thead>{head}</thead><tbody>{"".join(body)}</tbody></table></div>'

    def region_ratios(self, lang: str) -> dict:
        """The same cup, the same rank, this season: each region against EU."""
        season = self.model.get("season")
        by: dict = {}
        for c in self.model.get("categories") or []:
            if c.get("season") != season:
                continue
            by.setdefault((c["category"], c.get("team_mode"), c.get("game_mode")), {})[c["region"]] = c
        out: dict = {}
        for rank in ("20", "100", "1000"):
            ratios: dict = {}
            for regs in by.values():
                eu = regs.get("EU")
                ev = ((eu or {}).get("direct") or {}).get(rank)
                if not eu or not ev or not ev[0]:
                    continue
                for region, c in regs.items():
                    v = (c.get("direct") or {}).get(rank)
                    if region != "EU" and v and v[0] and str(c.get("latest") or "")[:7] == str(eu.get("latest") or "")[:7]:
                        ratios.setdefault(region, []).append(float(v[0]) / float(ev[0]))
            out[rank] = {r: (sorted(v)[len(v) // 2], len(v)) for r, v in ratios.items() if len(v) >= 8}
        return out

    REGION_NAMES = {"NAC": {"en": "NA-East", "fr": "Amérique du N. Est"}, "NAW": {"en": "NA-West", "fr": "Amérique du N. Ouest"},
                    "BR": {"en": "Brazil", "fr": "Brésil"}, "ME": {"en": "Middle East", "fr": "Moyen-Orient"},
                    "ASIA": {"en": "Asia", "fr": "Asie"}, "OCE": {"en": "Oceania", "fr": "Océanie"},
                    "EU": {"en": "Europe", "fr": "Europe"}}

    def region_chart(self, lang: str, arg: dict) -> str:
        rank = str(arg.get("rank", "100"))
        ratios = self.region_ratios(lang).get(rank) or {}
        names = self.REGION_NAMES
        rows = [(names.get(r, {}).get(lang, r), v, fmt_pct(v, lang)) for r, (v, n) in
                sorted(ratios.items(), key=lambda kv: -kv[1][0])]
        if not rows:
            return ""
        cups = max(n for _, (v, n) in ratios.items())
        caption = {"en": f"The threshold at rank {rank} in each region, as a share of the same cup's threshold at the "
                         f"same rank in Europe: the median over the cups of season {self.model.get('season')} played in "
                         f"both (up to {cups} cups per region).",
                   "fr": f"Le seuil au rang {rank} dans chaque région, en part du seuil de la même cup au même rang en "
                         f"Europe : la médiane sur les cups de la saison {self.model.get('season')} jouées dans les deux "
                         f"(jusqu'à {cups} cups par région)."}[lang]
        return bar_chart(rows=rows, lang=lang, caption=caption, label=caption, v_max=1.15, reference=1.0,
                         ref_label={"en": "Europe = 100%", "fr": "Europe = 100 %"}[lang])

    def region_table(self, lang: str, arg: dict) -> str:
        ratios = self.region_ratios(lang)
        regions = ["NAC", "NAW", "BR", "ME", "ASIA", "OCE"]
        head = {"en": ("Region", "Rank 20", "Rank 100", "Rank 1,000"),
                "fr": ("Région", "Rang 20", "Rang 100", "Rang 1 000")}[lang]
        body = []
        for r in regions:
            cells = []
            for rank in ("20", "100", "1000"):
                v = (ratios.get(rank) or {}).get(r)
                cells.append(f"<td>{fmt_pct(v[0], lang)}</td>" if v else "<td>—</td>")
            body.append(f"<tr><td>{esc(self.REGION_NAMES.get(r, {}).get(lang, r))}</td>{''.join(cells)}</tr>")
        return (f'<div class="scroll"><table class="data"><thead><tr>' + "".join(f"<th>{h}</th>" for h in head)
                + f'</tr></thead><tbody>{"".join(body)}</tbody></table></div>')

    def scoring_table(self, lang: str, arg: dict) -> str:
        want = arg.get("name", "FNCS Division 1")
        preset = next((p for p in self.model.get("scoring_presets") or [] if p.get("name") == want), None)
        if not preset:
            return ""
        rows = preset.get("placement") or []
        cells = []
        for lo, hi, pts in rows[:25]:
            place = f"{lo}" if lo == hi else f"{lo}–{hi}"
            cells.append(f"<tr><td>{place}</td><td>{fmt_num(float(pts), lang)}</td></tr>")
        head = {"en": ("Placement", "Points"), "fr": ("Place", "Points")}[lang]
        kill = preset.get("kill")
        note = {"en": f"{esc(want)}: {fmt_num(float(kill or 0), lang)} point(s) per elimination"
                      + (f", capped at {preset['kill_cap']}" if preset.get("kill_cap") else ", no cap") + ".",
                "fr": f"{esc(want)} : {fmt_num(float(kill or 0), lang)} point(s) par élimination"
                      + (f", plafonnées à {preset['kill_cap']}" if preset.get("kill_cap") else ", sans plafond") + "."}[lang]
        return (f'<div class="scroll narrow"><table class="data"><caption>{note}</caption><thead><tr><th>{head[0]}</th>'
                f'<th>{head[1]}</th></tr></thead><tbody>{"".join(cells)}</tbody></table></div>')

    def mode_shares(self, lang: str, arg: dict) -> str:
        head = {"en": ("Format", "Rank 20 scores, as a share of the most a team could", "Cups measured"),
                "fr": ("Format", "Le rang 20 marque, en part du maximum possible", "Cups mesurées")}[lang]
        rows = []
        for r in self.model.get("modes") or []:
            if not r.get("team_mode") or not r.get("share") or int(r.get("share_n") or 0) < 50:
                continue
            rows.append((r["game_mode"], r["team_mode"], float(r["share"]), int(r["share_n"])))
        order = {"Solo": 0, "Duo": 1, "Trio": 2, "Squad": 3}
        rows.sort(key=lambda x: (x[0], order.get(x[1], 9)))
        body = "".join(f"<tr><td>{esc(m)} · {esc(t)}</td><td>{fmt_pct(s, lang)}</td><td>{fmt_num(n, lang)}</td></tr>"
                       for m, t, s, n in rows)
        return (f'<div class="scroll"><table class="data"><thead><tr><th>{head[0]}</th><th>{head[1]}</th>'
                f'<th>{head[2]}</th></tr></thead><tbody>{body}</tbody></table></div>')

    def popular_cups(self, lang: str, arg: dict) -> str:
        """This season's most played cups in one region, at a few ranks: the
        previous-edition reading the model starts from (recent editions,
        the latest weighing most)."""
        region = arg.get("region", "EU")
        season = self.model.get("season")
        rows = []
        odd = re.compile(r"arena|evaluation|test cup|ranked cup", re.I)
        for c in self.model.get("categories") or []:
            if c.get("region") != region or c.get("season") != season or c.get("stage"):
                continue
            # One-lobby formats - Arena tests, evaluations - are not cups
            # anyone prepares a cutoff for; the model sets them apart too.
            if odd.search(str(c.get("family") or c.get("category") or "")):
                continue
            d = c.get("direct") or {}
            if not d.get("100") or not d.get("100")[0]:
                continue
            rows.append((int(c.get("seen") or c.get("n") or 0), c))
        rows.sort(key=lambda x: (-x[0], x[1]["category"]))
        head = {"en": ("Cup", "Format", "Top 10", "Top 100", "Top 1,000", "Last played"),
                "fr": ("Cup", "Format", "Top 10", "Top 100", "Top 1 000", "Dernière édition")}[lang]
        body = []
        for _, c in rows[: int(arg.get("limit", 10))]:
            d = c.get("direct") or {}
            def cell(r):
                v = d.get(r)
                return fmt_num(round(float(v[0])), lang) if v and v[0] else "—"
            body.append(f"<tr><td>{esc(c['category'])}</td><td>{esc(c.get('team_mode') or '')} · "
                        f"{esc(c.get('game_mode') or '')}</td><td>{cell('10')}</td><td>{cell('100')}</td>"
                        f"<td>{cell('1000')}</td><td>{esc(fmt_date(c.get('latest', ''), lang))}</td></tr>")
        if not body:
            return ""
        return (f'<div class="scroll"><table class="data"><thead><tr>' + "".join(f"<th>{h}</th>" for h in head)
                + f'</tr></thead><tbody>{"".join(body)}</tbody></table></div>')

    def quality_table(self, lang: str, arg: dict) -> str:
        q = self.quality
        base = q.get("baselines") or {}
        pct = lambda v: (fmt_num(v, lang, 1) + (" %" if lang == "fr" else "%")) if v is not None else "—"
        rows = {"en": [("Every threshold of the newest " + fmt_num(q.get("targets"), lang) + " tournaments",
                        pct(q.get("median_ape")), fmt_pct(q.get("coverage"), lang)),
                       ("Cups with a previous edition (where the model and both baselines answer)",
                        pct((base.get("model") or {}).get("median_ape")), "—"),
                       ("… the same rows, last edition carried forward", pct((base.get("carry") or {}).get("median_ape")), "—"),
                       ("… the same rows, median of the cup's category", pct((base.get("median") or {}).get("median_ape")), "—"),
                       ("Cups never seen in their region, from the scoring table alone", pct(q.get("cold_median_ape")), "—"),
                       ("Finals played in a single lobby", pct(q.get("lobby_median_ape")), "—")],
                "fr": [("Tous les seuils des " + fmt_num(q.get("targets"), lang) + " tournois les plus récents",
                        pct(q.get("median_ape")), fmt_pct(q.get("coverage"), lang)),
                       ("Cups qui ont une édition précédente (là où le modèle et les deux références répondent)",
                        pct((base.get("model") or {}).get("median_ape")), "—"),
                       ("… les mêmes lignes, dernière édition reportée", pct((base.get("carry") or {}).get("median_ape")), "—"),
                       ("… les mêmes lignes, médiane de la catégorie", pct((base.get("median") or {}).get("median_ape")), "—"),
                       ("Cups jamais vues dans leur région, depuis le seul barème", pct(q.get("cold_median_ape")), "—"),
                       ("Finales jouées en lobby unique", pct(q.get("lobby_median_ape")), "—")]}[lang]
        head = {"en": ("What is forecast", "Median error", "Inside the quoted range"),
                "fr": ("Ce qui est prévu", "Erreur médiane", "Dans la fourchette annoncée")}[lang]
        body = "".join(f"<tr><td>{a}</td><td>{b}</td><td>{c}</td></tr>" for a, b, c in rows)
        return (f'<div class="scroll"><table class="data"><thead><tr><th>{head[0]}</th><th>{head[1]}</th>'
                f'<th>{head[2]}</th></tr></thead><tbody>{body}</tbody></table></div>')

    def week_table(self, lang: str, arg: dict, page_path: str) -> str:
        """The week's cups, day by day: when, what, and what the page answers
        for each (`fc`, written into the calendar by calendar_snapshot.py from
        the same model), with a link that opens the cup's own forecast."""
        events = self.calendar.get("events") or []
        if not events:
            return "<p>" + {"en": "The calendar of the week is not available right now.",
                            "fr": "Le calendrier de la semaine n'est pas disponible pour le moment."}[lang] + "</p>"
        bands = (self.quality.get("bands") or {}).get("90")
        tool = rel_link(page_path, ROOTS[lang]["tool"] if lang == "fr" else "")
        rung = {"previous edition": {"en": "the cup's previous editions", "fr": "éditions précédentes de la cup"},
                "re-scored boards": {"en": "recent leaderboards replayed", "fr": "classements récents rejoués"},
                "family + re-scored boards": {"en": "other regions + leaderboards replayed",
                                              "fr": "autres régions + classements rejoués"},
                "family": {"en": "the same cup in other regions", "fr": "la même cup dans d'autres régions"},
                "category": {"en": "the cup's history", "fr": "historique de la cup"},
                "closed lobby": {"en": "finals of the same format", "fr": "finales du même format"},
                "scoring": {"en": "the scoring table", "fr": "le barème"},
                "scoring (thin sample)": {"en": "the scoring table", "fr": "le barème"},
                "scoring (prior)": {"en": "the scoring table", "fr": "le barème"},
                "mode": {"en": "the game mode", "fr": "le mode de jeu"}}
        by_day: dict = {}
        for row in events:
            # As the predictor's own list: a Victory Cup's later round is played
            # for first place alone, with no cut to forecast.
            if re.search(r"victory cup", str(row.get("name") or ""), re.I) and int(row.get("stage") or 0) >= 2:
                continue
            by_day.setdefault(str(row.get("begin", ""))[:10], []).append(row)
        blocks = []
        for day in sorted(by_day):
            items = []
            for row in by_day[day]:
                begin, end = str(row.get("begin", "")), str(row.get("end", ""))
                minutes = 0
                try:
                    a = datetime.fromisoformat(begin.replace("Z", "+00:00"))
                    b = datetime.fromisoformat(end.replace("Z", "+00:00"))
                    minutes = int((b - a).total_seconds() // 60)
                except ValueError:
                    pass
                games = row.get("games")
                fmt = " · ".join(x for x in (row.get("team") or "", row.get("mode") if row.get("mode") != "Other" else "",
                                             ({"en": f"{games} games", "fr": f"{games} parties"}[lang] if games else ""),
                                             (f"{minutes // 60}h{minutes % 60:02d}" if minutes else "")) if x)
                fc = row.get("fc") or {}
                qualifies = any(t[0] in ("q", "p") for t in row.get("tiers") or [])
                cells = []
                for rank, value, rel, source in fc.get("ranks") or []:
                    label = {"en": "win" if rank == 1 else f"top {fmt_num(rank, lang)}",
                             "fr": "victoire" if rank == 1 else f"top {fmt_num(rank, lang)}"}[lang]
                    rng = ""
                    if bands and rel:
                        lo, hi = value * math.exp(bands[0] * rel), value * math.exp(bands[1] * rel)
                        rng = f' <small>{fmt_num(lo, lang)}–{fmt_num(hi, lang)}</small>'
                    cut = (' <em class="cut">' + {"en": "qualifies", "fr": "qualifie"}[lang] + "</em>") \
                        if rank == fc.get("cut") and qualifies else ""
                    cells.append(f'<span class="fc"><b>{label}</b> <strong>{fmt_num(value, lang)}</strong>{rng}{cut}</span>')
                sources = []
                for r in fc.get("ranks") or []:
                    text = rung.get(r[3], {}).get(lang, r[3])
                    if text and text not in sources:
                        sources.append(text)
                unpriced = {"en": "open it to price it", "fr": "à ouvrir pour la chiffrer"}[lang]
                answer = "".join(cells) if cells else f'<span class="muted">{unpriced}</span>'
                word = {"en": "from", "fr": "d'après"}[lang]
                basis = f'<small class="basis">{word} {esc(", ".join(sources))}</small>' if sources else ""
                link = f'{tool}#cup={esc(row.get("window", ""))}' if row.get("window") else tool
                items.append(
                    f'<li data-end="{esc(end)}"><span class="when"><time datetime="{esc(begin)}">{esc(begin[11:16])}</time>'
                    f' <span class="utc">UTC</span></span>'
                    f'<span class="what"><a href="{link}">{esc(row.get("name", ""))}</a> <span class="region">'
                    f'{esc(row.get("region", ""))}</span><span class="fmt">{esc(fmt)}</span></span>'
                    f'<span class="answer">{answer}{basis}</span></li>')
            blocks.append(f'<h2 class="day"><time datetime="{day}">{esc(fmt_date(day, lang))}</time></h2>'
                          f'<ul class="week">{"".join(items)}</ul>')
        stamp = str(self.calendar.get("generated", ""))
        note = {"en": f'<p class="muted">Calendar read {esc(stamp.replace("T", " ").replace("Z", " UTC"))}, '
                      f'model of {esc(fmt_date(self.model.get("generated", ""), lang))}. Beside each forecast, the '
                      f'range nine final thresholds in ten have landed in. Days are in UTC.</p>',
                "fr": f'<p class="muted">Calendrier lu le {esc(stamp.replace("T", " à ").replace("Z", " UTC"))}, '
                      f'modèle du {esc(fmt_date(self.model.get("generated", ""), lang))}. À côté de chaque prévision, '
                      f'la fourchette où neuf seuils finaux sur dix sont tombés. Les jours sont en UTC.</p>'}[lang]
        return note + "".join(blocks)


# ------------------------------------------------------------------ pages
class Page:
    def __init__(self, lang: str, meta: dict, body: str, source: str):
        self.lang = lang
        self.meta = meta
        self.body = body
        self.source = source
        self.path = meta["path"]
        self.pair = meta.get("pair") or self.path

    @property
    def title(self) -> str:
        return self.meta["title"]


def load_pages() -> list[Page]:
    pages = []
    for lang in LANGS:
        folder = PAGES / lang
        if not folder.exists():
            continue
        for file in sorted(folder.glob("*.html")):
            text = file.read_text(encoding="utf-8")
            found = re.match(r"\s*<!--page\s*(\{.*?\})\s*-->\s*", text, re.S)
            if not found:
                raise SystemExit(f"{file.relative_to(HERE)}: no <!--page {{...}} --> header.")
            try:
                meta = json.loads(found.group(1))
            except ValueError as exc:
                raise SystemExit(f"{file.relative_to(HERE)}: the page header is not JSON: {exc}")
            for key in ("path", "title", "description"):
                if not meta.get(key):
                    raise SystemExit(f"{file.relative_to(HERE)}: the page header has no '{key}'.")
            pages.append(Page(lang, meta, text[found.end():], str(file.relative_to(HERE))))
    paths = [p.path for p in pages]
    if len(paths) != len(set(paths)):
        raise SystemExit("Two pages write the same path: " + ", ".join(sorted({p for p in paths if paths.count(p) > 1})))
    return pages


class Site:
    def __init__(self, settings: dict, ads: dict, model: dict, calendar: dict | None, base_url: str):
        self.name = settings.get("name") or DEFAULT_NAME
        self.tagline = settings.get("tagline") or ""
        self.contact = settings.get("contact") or ""
        self.base = base_url.rstrip("/") + "/" if base_url else ""
        self.ads = ads or {}
        self.data = Data(model, calendar)
        self.model = model
        self.pages = load_pages()
        self.by_pair: dict = {}
        for p in self.pages:
            self.by_pair.setdefault(p.pair, {})[p.lang] = p

    # -- pieces
    def mark(self) -> str:
        words = self.name.upper().split()
        if len(words) > 1:
            return esc(" ".join(words[:-1])) + " <span>" + esc(words[-1]) + "</span>"
        return esc(words[0]) if words else ""

    def url(self, path: str) -> str:
        return self.base + path if self.base else ""

    def counterpart(self, page: Page) -> Page | None:
        other = "fr" if page.lang == "en" else "en"
        return self.by_pair.get(page.pair, {}).get(other)

    def nav(self, lang: str, here: str, section: str) -> str:
        u, r = UI[lang], ROOTS[lang]
        items = [("tool", u["nav.tool"]), ("week", u["nav.week"]), ("guides", u["nav.guides"]),
                 ("method", u["nav.method"]), ("about", u["nav.about"])]
        links = []
        for key, label in items:
            current = ' aria-current="page"' if key == section else ""
            links.append(f'<a href="{rel_link(here, r[key])}"{current}>{esc(label)}</a>')
        return '<nav class="site-nav" aria-label="Main">' + "".join(links) + "</nav>"

    def footer(self, lang: str, here: str) -> str:
        u, r = UI[lang], ROOTS[lang]
        osirion = '<a href="https://osirion.gg" rel="noopener">Osirion</a>'
        links = [(r["about"], u["foot.about"]), (r["contact"], u["foot.contact"]),
                 (r["privacy"], u["foot.privacy"]), (r["method"], u["foot.method"])]
        nav = " · ".join(f'<a href="{rel_link(here, p)}">{esc(t)}</a>' for p, t in links)
        nav += f' · <a href="{REPO}" rel="noopener">{esc(u["foot.source"])}</a>'
        year = datetime.now(timezone.utc).year
        fr = f'<p lang="fr">{esc(u["foot.epic.fr"])}</p>' if u["foot.epic.fr"] else ""
        return (f'<footer class="site-foot"><p class="foot-nav">{nav}</p>'
                f'<p>{u["foot.credit"].format(osirion=osirion)}</p>'
                f'<p>{esc(u["foot.independent"])}</p>'
                f'<p lang="en">{esc(EPIC)}</p>{fr}'
                f'<p>© {year} {esc(self.name)}</p></footer>')

    def ad_unit(self, lang: str) -> str:
        if not (self.ads.get("client") and self.ads.get("slot")):
            return ""
        return (f'<aside class="ad" aria-label="{esc(UI[lang]["ad"])}"><small>{esc(UI[lang]["ad"])}</small>'
                f'<ins class="adsbygoogle" style="display:block" data-ad-client="{esc(self.ads["client"])}" '
                f'data-ad-slot="{esc(self.ads["slot"])}" data-ad-format="auto" data-full-width-responsive="true"></ins>'
                f'<script>(window.adsbygoogle = window.adsbygoogle || []).push({{}});</script></aside>')

    def ads_head(self) -> str:
        client = self.ads.get("client")
        if not client:
            return ""
        return (f'<meta name="google-adsense-account" content="{esc(client)}">\n'
                f'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={esc(client)}" '
                f'crossorigin="anonymous"></script>\n')

    # -- the body's placeholders
    def fill(self, page: Page) -> str:
        body = page.body

        def data(match):
            name, arg = match.group(1), match.group(2)
            args = json.loads(arg) if arg else {}
            if name == "week_table":
                return self.data.week_table(page.lang, args, page.path)
            if name == "guide_list":
                return self.guide_list(page)
            method = getattr(self.data, name, None)
            if not callable(method):
                raise SystemExit(f"{page.source}: no data block called '{name}'.")
            return method(page.lang, args)

        body = re.sub(r"<!--data:([a-z_]+)(?:\s+(\{.*?\}))?\s*-->", data, body)
        body = body.replace("{{site_name}}", esc(self.name))
        if self.contact:
            body = body.replace("{{contact}}", f'<a href="mailto:{esc(self.contact)}">{esc(self.contact)}</a>')
        else:
            body = re.sub(r"<!--if-contact-->.*?<!--/if-contact-->", "", body, flags=re.S)
        body = body.replace("<!--if-contact-->", "").replace("<!--/if-contact-->", "")

        def fact(match):
            try:
                return esc(self.data.fact(match.group(1).strip(), page.lang))
            except (KeyError, ValueError):
                raise SystemExit(f"{page.source}: no number called '{match.group(1)}'.")

        # {{tournaments}}, {{pace_open 0.5}}: a figure the model measured.
        body = re.sub(r"\{\{([a-z_]+(?: [^}]+)?)\}\}", fact, body)

        def link(match):
            return f'href="{rel_link(page.path, match.group(1))}"'

        body = re.sub(r'href="~/([^"]*)"', link, body)
        ad = self.ad_unit(page.lang)
        body = body.replace("<!--ad-->", ad)
        return body

    def guide_list(self, page: Page) -> str:
        guides = sorted((p for p in self.pages if p.lang == page.lang and p.meta.get("section") == "guides"
                         and p.meta.get("order") is not None), key=lambda p: p.meta["order"])
        items = []
        for g in guides:
            items.append(f'<li><a href="{rel_link(page.path, g.path)}"><b>{esc(g.meta.get("h1") or g.title)}</b></a>'
                         f'<span>{esc(g.meta.get("summary") or g.meta["description"])}</span></li>')
        return '<ul class="cards">' + "".join(items) + "</ul>"

    # -- a whole page
    def head(self, page: Page) -> str:
        m, lang = page.meta, page.lang
        title = m["title"] if m.get("bare_title") else f'{m["title"]} — {self.name}'
        parts = ['<meta charset="utf-8">', '<meta name="viewport" content="width=device-width, initial-scale=1">',
                 f"<title>{esc(title)}</title>", f'<meta name="description" content="{esc(m["description"])}">']
        if m.get("noindex"):
            parts.append('<meta name="robots" content="noindex">')
        url = self.url(page.path)
        if url:
            parts.append(f'<link rel="canonical" href="{esc(url)}">')
            other = self.counterpart(page)
            # The other language's version: a page of the site, or - for the
            # French home - the predictor itself, which is the English one.
            alt = {other.lang: other.path} if other else dict(m.get("alternate") or {})
            if alt:
                parts.append(f'<link rel="alternate" hreflang="{page.lang}" href="{esc(url)}">')
                for code, path in alt.items():
                    parts.append(f'<link rel="alternate" hreflang="{code}" href="{esc(self.url(path) or self.base)}">')
                en_path = page.path if page.lang == "en" else alt.get("en", page.path)
                parts.append(f'<link rel="alternate" hreflang="x-default" href="{esc(self.url(en_path) or self.base)}">')
            parts += [f'<meta property="og:title" content="{esc(m["title"])}">',
                      f'<meta property="og:description" content="{esc(m["description"])}">',
                      f'<meta property="og:type" content="{"article" if m.get("section") == "guides" and m.get("order") is not None else "website"}">',
                      f'<meta property="og:url" content="{esc(url)}">',
                      f'<meta property="og:site_name" content="{esc(self.name)}">',
                      f'<meta property="og:locale" content="{"fr_FR" if lang == "fr" else "en_GB"}">',
                      '<meta name="twitter:card" content="summary">']
        parts += ['<meta name="theme-color" content="#e8a13a">', f'<link rel="icon" href="{ICON}">',
                  '<link rel="preconnect" href="https://fonts.googleapis.com">',
                  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
                  f'<link rel="stylesheet" href="{FONTS}">',
                  f'<link rel="stylesheet" href="{rel_link(page.path, "site.css")}">']
        head = "\n".join(parts) + "\n" + self.ads_head()
        ld = self.json_ld(page)
        if ld:
            head += f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>\n'
        return head

    def json_ld(self, page: Page) -> dict | None:
        if not self.base:
            return None
        m = page.meta
        if m.get("section") == "guides" and m.get("order") is not None:
            home = self.url(ROOTS[page.lang]["home"])
            return {"@context": "https://schema.org", "@graph": [
                {"@type": "Article", "headline": m.get("h1") or m["title"], "description": m["description"],
                 "inLanguage": page.lang, "datePublished": m.get("published") or m.get("updated"),
                 "dateModified": self.updated(page), "mainEntityOfPage": self.url(page.path),
                 "author": {"@type": "Organization", "name": self.name, "url": self.base},
                 "publisher": {"@type": "Organization", "name": self.name, "url": self.base}},
                {"@type": "BreadcrumbList", "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": UI[page.lang]["home"], "item": home or self.base},
                    {"@type": "ListItem", "position": 2, "name": UI[page.lang]["guides"],
                     "item": self.url(ROOTS[page.lang]["guides"])},
                    {"@type": "ListItem", "position": 3, "name": m.get("h1") or m["title"], "item": self.url(page.path)}]}]}
        if m.get("section") == "home":
            return {"@context": "https://schema.org", "@type": "WebSite", "name": self.name, "url": self.base,
                    "inLanguage": page.lang, "description": m["description"]}
        return None

    def updated(self, page: Page) -> str:
        """When the page last changed: its own date, or the data's when newer."""
        dates = [str(page.meta.get("updated") or "")]
        if page.meta.get("data") == "model":
            dates.append(str(self.model.get("generated") or ""))
        if page.meta.get("data") == "calendar":
            dates.append(str(self.data.calendar.get("generated") or "")[:10])
        return max(d for d in dates if d) if any(dates) else ""

    def render(self, page: Page) -> str:
        lang, m = page.lang, page.meta
        u = UI[lang]
        other = self.counterpart(page)
        other_path = other.path if other else ROOTS["fr" if lang == "en" else "en"]["home"]
        other_lang = "fr" if lang == "en" else "en"
        switch = (f'<a class="lang-switch" href="{rel_link(page.path, other_path)}" hreflang="{other_lang}" '
                  f'lang="{other_lang}" title="{esc(u["other"])}">{esc(u["other.short"])}</a>')
        crumbs = ""
        if m.get("section") == "guides" and m.get("order") is not None:
            crumbs = (f'<p class="crumbs"><a href="{rel_link(page.path, ROOTS[lang]["guides"])}">'
                      f'{esc(u["guides"])}</a></p>')
        stamp = ""
        if m.get("updated") and not m.get("hide_date"):
            stamp = f'<p class="stamp">{esc(u["updated"].format(d=fmt_date(self.updated(page), lang)))}</p>'
        body = self.fill(page)
        return (f'<!doctype html>\n<html lang="{lang}">\n<head>\n{self.head(page)}</head>\n<body class="site">\n'
                f'<a class="skip" href="#content">{esc(u["skip"])}</a>\n'
                f'<header class="site-top"><a class="mark" href="{rel_link(page.path, ROOTS[lang]["tool"] if lang == "en" else ROOTS[lang]["home"])}">{self.mark()}</a>'
                f'{self.nav(lang, page.path, m.get("section", ""))}{switch}</header>\n'
                f'<main id="content" class="prose">\n{crumbs}{body}\n{stamp}</main>\n'
                f'{self.footer(lang, page.path)}\n'
                f'<script src="{rel_link(page.path, "site.js")}" defer></script>\n</body>\n</html>\n')

    def not_found(self) -> str:
        """GitHub Pages serves this for any missing path, so its links are
        absolute from the site's root."""
        u = UI["en"]
        f = UI["fr"]
        nav = "".join(f'<a href="/{p}">{esc(t)}</a>' for p, t in (("", u["nav.tool"]), ("this-week/", u["nav.week"]),
                                                                   ("guides/", u["nav.guides"]), ("methodology/", u["nav.method"]),
                                                                   ("about/", u["nav.about"])))
        return (f'<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
                f'<meta name="viewport" content="width=device-width, initial-scale=1">\n'
                f'<title>{esc(u["404.title"])} — {esc(self.name)}</title>\n<meta name="robots" content="noindex">\n'
                f'<link rel="icon" href="{ICON}">\n<link rel="stylesheet" href="/site.css">\n</head>\n<body class="site">\n'
                f'<header class="site-top"><a class="mark" href="/">{self.mark()}</a><nav class="site-nav">{nav}</nav></header>\n'
                f'<main id="content" class="prose"><h1>{esc(u["404.title"])}</h1><p>{esc(u["404.body"])}</p>'
                f'<p><a href="/">{esc(u["404.back"])}</a> · <a href="/guides/">{esc(u["404.guides"])}</a></p>'
                f'<p lang="fr">{esc(f["404.body"])} <a href="/fr/">{esc(f["home"])}</a></p></main>\n'
                f'</body>\n</html>\n')

    def moved(self, to_path: str, lang: str = "en") -> str:
        """A page that used to live elsewhere, pointing at where it went."""
        url = self.url(to_path) or to_path
        return (f'<!doctype html>\n<html lang="{lang}">\n<head>\n<meta charset="utf-8">\n'
                f'<title>{esc(self.name)}</title>\n<meta name="robots" content="noindex">\n'
                f'<link rel="canonical" href="{esc(url)}">\n<meta http-equiv="refresh" content="0; url={esc(to_path)}">\n'
                f'</head>\n<body>\n<p>{UI[lang]["redirect"].format(link=f"<a href={json.dumps(to_path)}>{esc(url)}</a>")}</p>\n'
                f'</body>\n</html>\n')

    def sitemap(self, tool_date: str) -> str:
        if not self.base:
            return ""
        rows = [(self.base, tool_date)]
        for p in self.pages:
            if p.meta.get("noindex"):
                continue
            rows.append((self.url(p.path), self.updated(p)))
        body = "".join(f"<url><loc>{esc(loc)}</loc>" + (f"<lastmod>{esc(d)}</lastmod>" if d else "") + "</url>\n"
                       for loc, d in rows)
        return ('<?xml version="1.0" encoding="UTF-8"?>\n'
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + "</urlset>\n")

    def robots(self) -> str:
        lines = ["User-agent: *", "Allow: /", "Disallow: /standalone.html"]
        if self.base:
            lines.append(f"Sitemap: {self.base}sitemap.xml")
        return "\n".join(lines) + "\n"


def build(settings: dict, ads: dict, model: dict, calendar: dict | None, base_url: str) -> dict[str, str]:
    """Every file of the site but the predictor itself: {path: text}."""
    site = Site(settings, ads, model, calendar, base_url)
    out: dict[str, str] = {}
    for page in site.pages:
        out[page.path + "index.html"] = site.render(page)
    out["404.html"] = site.not_found()
    out["privacy.html"] = site.moved("privacy/")
    out["site.css"] = (SOURCE / "site.css").read_text(encoding="utf-8")
    out["site.js"] = (SOURCE / "site.js").read_text(encoding="utf-8")
    sitemap = site.sitemap(str(model.get("generated") or ""))
    if sitemap:
        out["sitemap.xml"] = sitemap
    out["robots.txt"] = site.robots()
    return out


def tool_chrome(settings: dict, lang: str = "en", absolute: str = "") -> dict[str, str]:
    """The pieces the predictor's own page borrows from the site: the links
    in its header and its footer. `absolute`, the site's address, for the
    standalone file, which has no neighbours to link to relatively."""
    name = settings.get("name") or DEFAULT_NAME
    base = absolute.rstrip("/") + "/" if absolute else ""
    def href(key, l="en"):
        path = ROOTS[l][key]
        return (base + path) if base else (path or "./")
    nav_items = [("week", "nav.week"), ("guides", "nav.guides"), ("method", "nav.method"), ("about", "nav.about")]
    nav = '<nav class="top-nav" aria-label="Main">' + "".join(
        f'<a href="{href(k)}" data-href-en="{href(k)}" data-href-fr="{href(k, "fr")}" data-t="{t}">{esc(UI["en"][t])}</a>'
        for k, t in nav_items) + "</nav>"
    links = [("about", "foot.about"), ("contact", "foot.contact"), ("privacy", "foot.privacy"), ("method", "foot.method")]
    foot = " · ".join(f'<a href="{href(k)}" data-href-en="{href(k)}" data-href-fr="{href(k, "fr")}" data-t="{t}">'
                      f'{esc(UI["en"][t])}</a>' for k, t in links)
    foot += f' · <a href="{REPO}" rel="noopener" data-t="foot.source">{esc(UI["en"]["foot.source"])}</a>'
    return {"nav": nav, "foot": f'<p class="foot-nav">{foot}</p>', "name": name}
