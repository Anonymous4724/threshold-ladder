"""Join the page and the model, for a site and for a single file.

`src/app.html` is the source: markup, style and logic, with a single
`__MODEL_JSON__` placeholder where the numbers go. `model.json` is written by
`export_model.py` in the tracker repository, which checks it reproduces the
Python model before writing it. This joins the two, twice:

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

    python build.py            writes index.html, model.js and standalone.html
    python build.py --check    verifies all three match the sources
"""
from __future__ import annotations

import argparse
import json
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


def render() -> tuple[str, str, str]:
    """(hosted page, model script, standalone page).

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

    hosted = page.replace(PLACEHOLDER, LOAD).replace(
        "<script", '<script src="model.js"></script>\n'
                   '<script src="calendar.js"></script>\n<script', 1)

    alone = page.replace(PLACEHOLDER, data)
    if CALENDAR.exists():
        frozen = CALENDAR.read_text(encoding="utf-8").replace("</", "<\\/")
        alone = alone.replace("<script", "<script>\n" + frozen + "</script>\n<script", 1)
    return hosted, f"window.MODEL = {data};\n", alone


def size(text: str) -> str:
    return f"{len(text.encode('utf-8')) / 1024:.0f} KB"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true",
                        help="fail if the built files are behind their sources")
    args = parser.parse_args()

    hosted, script, alone = render()
    built = ((PAGE, hosted), (SCRIPT, script), (ALONE, alone))

    if args.check:
        stale = [path.name for path, want in built
                 if (path.read_text(encoding="utf-8") if path.exists() else "") != want]
        if stale:
            print(f"{', '.join(stale)} out of date — run: python build.py")
            return 1
        print("index.html, model.js and standalone.html match their sources.")
        return 0

    for path, want in built:
        path.write_text(want, encoding="utf-8")
    model = json.loads(MODEL.read_text(encoding="utf-8"))
    print(f"index.html      {size(hosted):>8}   + model.js {size(script)}  (the site)")
    if CALENDAR.exists():
        cal = json.loads(CALENDAR.read_text(encoding="utf-8")
                         .split("=", 1)[1].rsplit(";", 1)[0])
        print(f"                calendar of {len(cal.get('events') or [])} windows, "
              f"generated {cal.get('generated', '?')}")
    else:
        print("                no calendar.js — the what-is-on panel stays hidden")
    print(f"standalone.html {size(alone):>8}   one file, no network")
    print(f"                model of {model['source']['tournaments']} tournaments, "
          f"{len(model['categories'])} categories, {len(model['families'])} families")
    return 0


if __name__ == "__main__":
    sys.exit(main())
