"""Join the page and the model, for a site and for a single file - and build
the site around them.

`src/app.html` is the source: markup, style and logic, with a single
`__MODEL_JSON__` placeholder where the numbers go. `model.json` is exported by
the research code that trains the model, which checks the export reproduces
the Python model before writing it. This joins the two, twice:

    index.html + model.js   the pair a static host serves. The page is small
                            and cached; the model is a separate file, so it can
                            grow past anything that would be sane to inline and
                            a page edit does not force the model to be
                            re-downloaded.

    standalone.html         everything in one file. No network, no second
                            request, nothing to install: right-click, save,
                            double-click. It is the version that survives the
                            site going away.

and then the pages around them, from `src/site/` (see sitegen.py): the week's
cups with their forecasts, the guides, the method, about, contact, privacy -
in English and in French - with `sitemap.xml`, `robots.txt` and a `404.html`.

The model travels as `model.js` and not `model.json` on purpose. A page opened
from `file://` is forbidden to `fetch` a neighbouring file — browsers treat
every local file as its own origin — but it may always load a `<script>`. One
format therefore serves both the host and the folder, and the page needs no
async boot to read it. On the hosted page it loads at the end of the body,
after everything a reader sees: a megabyte and a half in the head held the
whole page blank until it had arrived.

Keeping the page and the model apart matters more than it looks: the page is
edited by hand and the model is regenerated whenever the training set grows, and
neither should force a merge on the other.

`site.json` beside this file holds the site's settings:

    {"live": "https://...",       the worker that reads the standings of the
                                  cups under way; empty, the page works on
                                  readings typed by hand
     "name": "Threshold Ladder",  the site's name, in every title and header
     "url": "https://...",        its address, for the canonical links and the
                                  sitemap; without it, the domain in CNAME
     "contact": "..."}            an address readers may write to; without
                                  it, the contact page offers GitHub alone

The standalone file never asks the live feed anything: it is the copy that
makes no request at all.

`ads.json` beside this file names the advertising account and unit, if any:
`{"client": "ca-pub-...", "slot": "..."}`. Given the account, every hosted page
carries its tags in the head and an `ads.txt` goes at the root for the
account to be checked against; given a unit as well, the predictor shows one
banner above its footer and the guides one unit in the text and none on the
pages that are lists or legal notices. Empty, or absent, means none of it. The
standalone file never carries any.

    python build.py            writes the page, the model, the standalone file and the site
    python build.py --check    verifies all of them match the sources
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import sitegen

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "src" / "app.html"
MODEL = HERE / "model.json"
CALENDAR = HERE / "calendar.js"
PAGE = HERE / "index.html"
SCRIPT = HERE / "model.js"
ALONE = HERE / "standalone.html"
PLACEHOLDER = "__MODEL_JSON__"
ADS = HERE / "ads.json"
ADS_TXT = HERE / "ads.txt"
ADS_JSON = "__ADS_JSON__"
ADS_HEAD = "__ADS_HEAD__"
SITE = HERE / "site.json"
SITE_JSON = "__SITE_JSON__"
CNAME = HERE / "CNAME"
MARKERS = ("<!--__HEAD__-->", "<!--__NAV__-->", "<!--__HOMELINKS__-->", "<!--__FOOTLINKS__-->", "<!--__DATA__-->")
# The seller id every AdSense ads.txt line ends with; it names Google, not the account.
ADS_TAG = "f08c47fec0942fa0"

# What the hosted page puts where the model would have been. `defer` is wrong
# here and `async` worse: the model has to be defined before the page's own
# script runs, and an ordinary tag just before that script guarantees it.
LOAD = '(window.MODEL || (() => { throw new Error("model.js did not load"); })())'
TITLE_EN = "Fortnite cup cutoffs, forecast before and during every cup"
DESCRIPTION_EN = ("How many points will it take to qualify? Forecasts of every Fortnite cup's point "
                  "thresholds, at any rank, before the cup and live while it runs, for every region, "
                  "with a measured range.")


def blob() -> str:
    model = json.loads(MODEL.read_text(encoding="utf-8"))
    for key in ("curve", "categories", "families", "modes", "messages"):
        if key not in model:
            raise SystemExit(f"{MODEL.name} is missing '{key}' — export it again.")
    # `</script>` inside the data would close the tag the data sits in.
    return json.dumps(model, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def ads() -> dict:
    """The advertising settings, or an empty dict when there is to be no banner."""
    if not ADS.exists():
        return {}
    try:
        given = json.loads(ADS.read_text(encoding="utf-8"))
    except ValueError as exc:
        raise SystemExit(f"{ADS.name} is not valid JSON: {exc}")
    client = str(given.get("client") or "").strip()
    slot = str(given.get("slot") or "").strip()
    if not client and not slot:
        return {}
    if not re.fullmatch(r"ca-pub-\d{16}", client):
        raise SystemExit(f"{ADS.name}: 'client' should look like ca-pub-0000000000000000, not {client!r}.")
    if slot and not re.fullmatch(r"\d{6,12}", slot):
        raise SystemExit(f"{ADS.name}: 'slot' should be the unit's number, not {slot!r}.")
    # An account without a unit yet: the head tags and ads.txt go up, which is
    # what the account's site check looks for; the banner waits for the unit.
    return {"client": client, "slot": slot} if slot else {"client": client}


def site() -> dict:
    """The site's own settings: the live feed, the name, the address, a contact."""
    if not SITE.exists():
        return {}
    try:
        given = json.loads(SITE.read_text(encoding="utf-8"))
    except ValueError as exc:
        raise SystemExit(f"{SITE.name} is not valid JSON: {exc}")
    out = {}
    live = str(given.get("live") or "").strip().rstrip("/")
    if live and not re.fullmatch(r"(?:https://[A-Za-z0-9.\-]+|http://(?:127\.0\.0\.1|localhost)(?::\d+)?)(?:/[^\s]*)?", live):
        raise SystemExit(f"{SITE.name}: 'live' should be an https address, not {live!r}.")
    if live:
        out["live"] = live
    url = str(given.get("url") or "").strip().rstrip("/")
    if url and not re.fullmatch(r"https://[A-Za-z0-9.\-]+(?:/[^\s]*)?", url):
        raise SystemExit(f"{SITE.name}: 'url' should be the site's https address, not {url!r}.")
    if url:
        out["url"] = url
    name = str(given.get("name") or "").strip()
    if name:
        out["name"] = name
    contact = str(given.get("contact") or "").strip()
    if contact and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[A-Za-z]{2,}", contact):
        raise SystemExit(f"{SITE.name}: 'contact' should be an email address, not {contact!r}.")
    if contact:
        out["contact"] = contact
    return out


def base_url(settings: dict) -> str:
    """The site's address: site.json's `url`, else the custom domain GitHub
    Pages serves it on, else nothing (and no canonical links or sitemap)."""
    if settings.get("url"):
        return settings["url"]
    lines = CNAME.read_text(encoding="utf-8").split() if CNAME.exists() else []
    if lines and re.fullmatch(r"[A-Za-z0-9.\-]+\.[A-Za-z]{2,}", lines[0]):
        return "https://" + lines[0]
    return ""


def calendar() -> dict | None:
    if not CALENDAR.exists():
        return None
    text = CALENDAR.read_text(encoding="utf-8")
    start, stop = text.find("{"), text.rfind("}")
    try:
        return json.loads(text[start:stop + 1]) if start >= 0 else None
    except ValueError:
        return None


def ads_head(settings: dict) -> str:
    """What the account's own snippet puts in the head: the meta tag its site
    check looks for, and the script that serves the unit."""
    if not settings:
        return ""
    client = settings["client"]
    return (f'<meta name="google-adsense-account" content="{client}">\n'
            f'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'
            f'?client={client}" crossorigin="anonymous"></script>\n')


def ads_txt(settings: dict) -> str:
    return f"google.com, {settings['client'][3:]}, DIRECT, {ADS_TAG}\n" if settings else ""


def head_meta(own: dict, base: str) -> str:
    """The predictor's description, canonical address and French counterpart."""
    name = own.get("name") or sitegen.DEFAULT_NAME
    esc = sitegen.esc
    lines = [f'<meta name="description" content="{esc(DESCRIPTION_EN)}">']
    if base:
        root = base.rstrip("/") + "/"
        lines += [f'<link rel="canonical" href="{root}">',
                  f'<link rel="alternate" hreflang="en" href="{root}">',
                  f'<link rel="alternate" hreflang="fr" href="{root}fr/">',
                  f'<link rel="alternate" hreflang="x-default" href="{root}">',
                  f'<meta property="og:title" content="{esc(name)} — {esc(TITLE_EN)}">',
                  f'<meta property="og:description" content="{esc(DESCRIPTION_EN)}">',
                  '<meta property="og:type" content="website">',
                  f'<meta property="og:url" content="{root}">',
                  f'<meta property="og:site_name" content="{esc(name)}">',
                  '<meta name="twitter:card" content="summary">',
                  '<script type="application/ld+json">' + json.dumps({
                      "@context": "https://schema.org", "@type": "WebApplication", "name": name, "url": root,
                      "applicationCategory": "GameApplication", "operatingSystem": "Any",
                      "description": DESCRIPTION_EN, "offers": {"@type": "Offer", "price": "0", "priceCurrency": "EUR"},
                      "inLanguage": ["en", "fr"]}, ensure_ascii=False) + "</script>"]
    lines.append('<meta name="theme-color" content="#e8a13a">')
    return "\n".join(lines) + "\n"


def chrome(page: str, own: dict, absolute: str) -> str:
    """The header's links, the front page's links and the footer's, pointing
    at the site's pages - relative on the site, absolute in the standalone
    file (which has no neighbours), absent there when the address is unknown."""
    if absolute is None:
        return page.replace("<!--__NAV__-->", "").replace("<!--__HOMELINKS__-->", "") \
                   .replace("<!--__FOOTLINKS__-->", "")
    parts = sitegen.tool_chrome(own, "en", absolute)
    base = absolute.rstrip("/") + "/" if absolute else ""
    def href(path_en, path_fr):
        return (base + path_en) if base else path_en, (base + path_fr) if base else path_fr
    links = []
    for (en, fr), key, text in ((href("guides/", "fr/guides/"), "home.guides", "The guides"),
                                ((href("this-week/", "fr/cette-semaine/")), "home.week", "This week's cups"),
                                ((href("methodology/", "fr/methode/")), "home.method", "Method and accuracy")):
        links.append(f'<a href="{en}" data-href-en="{en}" data-href-fr="{fr}" data-t="{key}">{text}</a>')
    home = '<p class="home-links">' + " · ".join(links) + "</p>"
    return page.replace("<!--__NAV__-->", parts["nav"]).replace("<!--__HOMELINKS__-->", home) \
               .replace("<!--__FOOTLINKS__-->", parts["foot"])


def render() -> tuple[str, str, str, str]:
    """(hosted page, model script, standalone page, ads.txt).

    The calendar is optional on both paths and deliberately so. The hosted page
    asks for `calendar.js` and carries on if the host has none — a 404 leaves
    `window.CALENDAR` undefined and the panel simply never appears. The
    standalone file gets whatever calendar existed when it was built, frozen,
    which is honest: it says the date it was made and stops offering a week that
    has passed.
    """
    page = SOURCE.read_text(encoding="utf-8")
    if PLACEHOLDER not in page:
        raise SystemExit(f"{SOURCE.name} has no {PLACEHOLDER} to fill.")
    data = blob()
    for marker in (ADS_JSON, ADS_HEAD, SITE_JSON) + MARKERS:
        if marker not in page:
            raise SystemExit(f"{SOURCE.name} has no {marker} to fill.")
    settings = ads()
    own = site()
    base = base_url(own)
    name = own.get("name") or sitegen.DEFAULT_NAME
    feed = {"live": own["live"]} if own.get("live") else {}

    hosted = page.replace(PLACEHOLDER, LOAD).replace(ADS_JSON, json.dumps(settings)) \
                 .replace(ADS_HEAD, ads_head(settings)).replace(SITE_JSON, json.dumps(feed))
    hosted = re.sub(r"<title>[^<]*</title>", f"<title>{sitegen.esc(name)} — {sitegen.esc(TITLE_EN)}</title>", hosted, 1)
    hosted = hosted.replace("<!--__HEAD__-->", head_meta(own, base).rstrip("\n"))
    hosted = chrome(hosted, own, "")
    hosted = hosted.replace("<!--__DATA__-->", '<script src="model.js"></script>\n<script src="calendar.js"></script>')

    alone = page.replace(PLACEHOLDER, data).replace(ADS_JSON, "{}").replace(ADS_HEAD, "") \
               .replace(SITE_JSON, "{}")
    alone = re.sub(r"<title>[^<]*</title>", f"<title>{sitegen.esc(name)}</title>", alone, 1)
    # A copy to keep, not a page to find: search engines are told so, and the
    # web fonts go, so that it makes no request at all - it falls back to the
    # system's own sans-serif.
    alone = alone.replace("<!--__HEAD__-->", '<meta name="robots" content="noindex">')
    alone = "\n".join(line for line in alone.split("\n")
                      if "fonts.googleapis.com" not in line and "fonts.gstatic.com" not in line)
    alone = chrome(alone, own, base if base else None)
    frozen = ""
    if CALENDAR.exists():
        frozen = "<script>\n" + CALENDAR.read_text(encoding="utf-8").replace("</", "<\\/") + "</script>"
    alone = alone.replace("<!--__DATA__-->", frozen)
    return hosted, f"window.MODEL = {data};\n", alone, ads_txt(settings)


def site_files() -> dict[str, str]:
    """The pages around the predictor, from src/site/ (see sitegen.py)."""
    model = json.loads(MODEL.read_text(encoding="utf-8"))
    own = site()
    return sitegen.build(own, ads(), model, calendar(), base_url(own))


def size(text: str) -> str:
    return f"{len(text.encode('utf-8')) / 1024:.0f} KB"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true",
                        help="fail if the built files are behind their sources")
    args = parser.parse_args()

    hosted, script, alone, sellers = render()
    built = [(PAGE, hosted), (SCRIPT, script), (ALONE, alone), (ADS_TXT, sellers)]
    pages = site_files()
    built += [(HERE / path, text) for path, text in sorted(pages.items())]

    if args.check:
        stale = [str(path.relative_to(HERE)) for path, want in built
                 if (path.read_text(encoding="utf-8") if path.exists() else "") != want]
        if stale:
            print(f"{', '.join(stale[:8])}{' …' if len(stale) > 8 else ''} out of date — run: python build.py")
            return 1
        print(f"index.html, model.js, standalone.html and the {len(pages)} files of the site match their sources.")
        return 0

    for path, want in built:
        if want:
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.exists() or path.read_text(encoding="utf-8") != want:
                path.write_text(want, encoding="utf-8")
        elif path.exists():
            path.unlink()                      # no banner, no ads.txt
    model = json.loads(MODEL.read_text(encoding="utf-8"))
    print(f"index.html      {size(hosted):>8}   + model.js {size(script)}  (the site)")
    cal = calendar()
    if cal:
        priced = sum(1 for e in cal.get("events") or [] if e.get("fc"))
        print(f"                calendar of {len(cal.get('events') or [])} windows, {priced} priced, "
              f"generated {cal.get('generated', '?')}")
    else:
        print("                no calendar.js — the what-is-on panel stays hidden")
    print(f"standalone.html {size(alone):>8}   one file, no network, no banner")
    guides = sum(1 for p in pages if p.startswith(("guides/", "fr/guides/")) and p.count("/") >= 2)
    print(f"site            {len(pages)} files: {guides} guide pages, the week, method, about, contact, "
          f"privacy, in English and French" + (f"; sitemap for {base_url(site())}" if "sitemap.xml" in pages else
                                                "; no address known (site.json 'url' or CNAME), so no sitemap"))
    given = ads()
    print("banner          " + (f"{given['client']} unit {given['slot']}, ads.txt written" if given.get("slot")
                                else f"{given['client']}: account tags and ads.txt only, no unit yet" if given
                                else "none (ads.json empty or absent)"))
    print("live feed       " + (site().get("live") or "none (site.json empty or absent)"))
    print(f"                model of {model['source']['tournaments']} tournaments, "
          f"{len(model['categories'])} categories, {len(model['families'])} families")
    return 0


if __name__ == "__main__":
    sys.exit(main())
