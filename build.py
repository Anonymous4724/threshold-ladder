"""Join the page and the model, for a site and for a single file.

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

The model travels as `model.js` and not `model.json` on purpose. A page opened
from `file://` is forbidden to `fetch` a neighbouring file — browsers treat
every local file as its own origin — but it may always load a `<script>`. One
format therefore serves both the host and the folder, and the page needs no
async boot to read it.

Keeping the page and the model apart matters more than it looks: the page is
edited by hand and the model is regenerated whenever the training set grows, and
neither should force a merge on the other.

`site.json` beside this file names the live feed, if any: `{"live": "https://..."}`,
the address of the worker that reads the standings of the cups under way every
few minutes. Given, the hosted page asks it for `live.json`; empty, or absent,
the page works the way it always has, on readings typed by hand. The standalone
file never asks: it is the copy that makes no request at all.

`ads.json` beside this file names the advertising account and unit, if any:
`{"client": "ca-pub-...", "slot": "..."}`. Given both, the hosted page carries
the account's tags in its head, one banner above the footer, and an `ads.txt`
at the root for the account to be checked against. Empty, or absent, means no
banner and no `ads.txt`. The standalone file never carries one: it is the copy
that makes no request at all.

    python build.py            writes index.html, model.js and standalone.html
    python build.py --check    verifies all three match the sources
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

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
# The seller id every AdSense ads.txt line ends with; it names Google, not the account.
ADS_TAG = "f08c47fec0942fa0"

# What the hosted page puts where the model would have been. `defer` is wrong
# here and `async` worse: the model has to be defined before the page's own
# script runs, and an ordinary tag in the head guarantees exactly that.
LOAD = '(window.MODEL || (() => { throw new Error("model.js did not load"); })())'


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
    """The site's own settings: the live feed's address, or nothing."""
    if not SITE.exists():
        return {}
    try:
        given = json.loads(SITE.read_text(encoding="utf-8"))
    except ValueError as exc:
        raise SystemExit(f"{SITE.name} is not valid JSON: {exc}")
    live = str(given.get("live") or "").strip().rstrip("/")
    if live and not re.fullmatch(r"(?:https://[A-Za-z0-9.\-]+|http://(?:127\.0\.0\.1|localhost)(?::\d+)?)(?:/[^\s]*)?", live):
        raise SystemExit(f"{SITE.name}: 'live' should be an https address, not {live!r}.")
    return {"live": live} if live else {}


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
    if "<script" not in page:
        raise SystemExit(f"{SOURCE.name} has no script tag to load the model before.")

    for marker in (ADS_JSON, ADS_HEAD, SITE_JSON):
        if marker not in page:
            raise SystemExit(f"{SOURCE.name} has no {marker} to fill.")
    settings = ads()
    own = site()

    hosted = page.replace(PLACEHOLDER, LOAD).replace(ADS_JSON, json.dumps(settings)) \
                 .replace(ADS_HEAD, ads_head(settings)).replace(SITE_JSON, json.dumps(own))
    # The head tags come first, so the account script is loading while the
    # rest of the head parses; the model still precedes the page's own script.
    hosted = hosted.replace(
        "<script", '<script src="model.js"></script>\n'
                   '<script src="calendar.js"></script>\n<script', 1) if not settings else hosted.replace(
        "<style>", '<script src="model.js"></script>\n'
                   '<script src="calendar.js"></script>\n<style>', 1)

    alone = page.replace(PLACEHOLDER, data).replace(ADS_JSON, "{}").replace(ADS_HEAD, "") \
               .replace(SITE_JSON, "{}")
    if CALENDAR.exists():
        frozen = CALENDAR.read_text(encoding="utf-8").replace("</", "<\\/")
        alone = alone.replace("<script", "<script>\n" + frozen + "</script>\n<script", 1)
    return hosted, f"window.MODEL = {data};\n", alone, ads_txt(settings)


def size(text: str) -> str:
    return f"{len(text.encode('utf-8')) / 1024:.0f} KB"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true",
                        help="fail if the built files are behind their sources")
    args = parser.parse_args()

    hosted, script, alone, sellers = render()
    built = ((PAGE, hosted), (SCRIPT, script), (ALONE, alone), (ADS_TXT, sellers))

    if args.check:
        stale = [path.name for path, want in built
                 if (path.read_text(encoding="utf-8") if path.exists() else "") != want]
        if stale:
            print(f"{', '.join(stale)} out of date — run: python build.py")
            return 1
        print("index.html, model.js and standalone.html match their sources.")
        return 0

    for path, want in built:
        if want:
            path.write_text(want, encoding="utf-8")
        elif path.exists():
            path.unlink()                      # no banner, no ads.txt
    model = json.loads(MODEL.read_text(encoding="utf-8"))
    print(f"index.html      {size(hosted):>8}   + model.js {size(script)}  (the site)")
    if CALENDAR.exists():
        cal = json.loads(CALENDAR.read_text(encoding="utf-8")
                         .split("=", 1)[1].rsplit(";", 1)[0])
        print(f"                calendar of {len(cal.get('events') or [])} windows, "
              f"generated {cal.get('generated', '?')}")
    else:
        print("                no calendar.js — the what-is-on panel stays hidden")
    print(f"standalone.html {size(alone):>8}   one file, no network, no banner")
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
