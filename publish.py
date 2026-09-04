"""Put this page on the web, once. After this, `refresh.py --publish` keeps it there.

The predictor is a folder of static files — a page, a model, a calendar — so
hosting it needs no server, no database and no process of yours running
anywhere. GitHub Pages serves the folder from its own CDN: the site is up
whether your computer is on or off, over HTTPS, free, for as many readers as
turn up.

    python publish.py                     first time: create the repo and push
    python publish.py --repo <git URL>    ... into a repository you made yourself
    python publish.py --dry-run           say what would happen, do nothing

What it does, in order: makes this folder a git repository if it is not one,
sets the commit identity to the GitHub account below, commits everything,
creates the repository on GitHub (with `gh` if you have it, otherwise it tells
you the two clicks), pushes, and turns Pages on.

Afterwards, one command publishes an update:

    ..\\fortnite-tracker\\refresh.bat --publish

Nothing private goes up. `.gitignore` keeps caches out, and the model and the
calendar are derived numbers — medians per category and rank, the fields a
form needs — never a copy of anyone's API responses.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

# The identity every commit carries. GitHub's noreply address keeps a real one
# out of the repository's history, where it would stay forever and be scraped.
ACCOUNT = "Anonymous4724"
EMAIL = "323191219+Anonymous4724@users.noreply.github.com"
REPO = "threshold-ladder"

# What has to be there for the site to work at all.
REQUIRED = ("index.html", "model.js")


def run(*command: str, check: bool = True, quiet: bool = False, dry: bool = False):
    """A command in this folder. Returns (code, output)."""
    if not quiet:
        print("  " + " ".join(command))
    if dry:
        return 0, ""
    done = subprocess.run(command, cwd=str(HERE), capture_output=True, text=True)
    out = (done.stdout + done.stderr).strip()
    if done.returncode and check and not quiet:
        print("    " + out.replace("\n", "\n    "))
    return done.returncode, out


def have(program: str) -> bool:
    return shutil.which(program) is not None


def remote_url() -> str:
    code, out = run("git", "remote", "get-url", "origin", check=False, quiet=True)
    return out if code == 0 else ""


def owner_and_repo(url: str) -> tuple[str, str] | None:
    """(owner, repo) from either URL spelling, or None if it is neither."""
    text = url.strip().removesuffix(".git")
    for prefix in ("https://github.com/", "git@github.com:", "ssh://git@github.com/"):
        if text.startswith(prefix):
            parts = text[len(prefix):].split("/")
            if len(parts) >= 2:
                return parts[-2], parts[-1]
    return None


def page_url(owner: str, repo: str) -> str:
    return f"https://{owner.lower()}.github.io/{repo}/"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--repo", help="the git URL of a repository you created yourself")
    parser.add_argument("--dry-run", action="store_true", help="print the commands, run none")
    args = parser.parse_args()
    dry = args.dry_run

    missing = [name for name in REQUIRED if not (HERE / name).exists()]
    if missing:
        print(f"Nothing to publish: {', '.join(missing)} is missing.")
        print("Build the site first:  python build.py")
        return 1
    if not have("git"):
        print("git is not installed. Get it from https://git-scm.com and run this again.")
        return 1

    print(f"folder    : {HERE}")
    print(f"identity  : {ACCOUNT} <{EMAIL}>\n")

    if not (HERE / ".git").exists():
        print("1. Make this folder a repository")
        run("git", "init", "-b", "main", dry=dry)
    else:
        print("1. Already a repository")
    # Pages serves a branch by name, and the name it offers first is `main`.
    # A folder initialised by an older git sits on `master`, and pushing `main`
    # from it fails with a refspec error that says nothing about the cause.
    run("git", "branch", "-M", "main", check=False, quiet=True, dry=dry)

    print("\n2. Set the commit identity for this repository only")
    run("git", "config", "user.name", ACCOUNT, dry=dry)
    run("git", "config", "user.email", EMAIL, dry=dry)

    print("\n3. Commit what is here")
    run("git", "add", "-A", dry=dry)
    code, _ = run("git", "commit", "-m", "Threshold Ladder: the page, the model, this week's calendar",
                  check=False, dry=dry)
    if code and not dry:
        print("  (nothing new to commit — carrying on)")

    print("\n4. The repository on GitHub")
    url = args.repo or remote_url()
    if url and not args.repo:
        print(f"  already pointed at {url}")
    elif args.repo:
        run("git", "remote", "remove", "origin", check=False, quiet=True, dry=dry)
        run("git", "remote", "add", "origin", args.repo, dry=dry)
    elif have("gh"):
        code, out = run("gh", "repo", "create", f"{ACCOUNT}/{REPO}", "--public",
                        "--source=.", "--remote=origin", "--push", check=False, dry=dry)
        if code and not dry:
            print("\n  gh could not create it (not signed in, or the name is taken).")
            print("  Sign in with  gh auth login  and run this again, or create the")
            print(f"  repository yourself and pass it:  python publish.py --repo <URL>")
            return 1
        url = args.repo or remote_url()
    else:
        print(f"""
  No remote yet, and `gh` is not installed. Two clicks and one command:

    a. Go to https://github.com/new
       Owner {ACCOUNT} · name {REPO} · Public · do NOT add a README
    b. Create repository, then run:

       python publish.py --repo https://github.com/{ACCOUNT}/{REPO}.git
""")
        return 1

    print("\n5. Push")
    code, out = run("git", "push", "-u", "origin", "main", check=False, dry=dry)
    if code and not dry:
        if "rejected" in out or "non-fast-forward" in out:
            print("\n  The repository on GitHub already has commits this folder does not.")
            print("  If it was created with a README, delete it there and run this again.")
        return 1

    found = owner_and_repo(url or remote_url() or "")
    if not found:
        print("\nPushed. Turn on Pages in the repository: Settings -> Pages -> "
              "Deploy from a branch -> main / (root).")
        return 0
    owner, repo = found

    print("\n6. Turn on GitHub Pages")
    enabled = False
    if have("gh"):
        code, out = run("gh", "api", "-X", "POST", f"repos/{owner}/{repo}/pages",
                        "-f", "source[branch]=main", "-f", "source[path]=/",
                        check=False, dry=dry)
        enabled = code == 0 or "already exists" in out.lower()
        if not enabled and not dry:
            print("  (could not turn it on from here — the two clicks below do it)")
    if not enabled:
        print(f"  Open https://github.com/{owner}/{repo}/settings/pages")
        print("  Source: Deploy from a branch · Branch: main · Folder: / (root) · Save")

    print(f"""
Done. In a minute or two the site is live, and stays live with your computer off:

    {page_url(owner, repo)}

Share that link with anyone. To update it later, one command from the tracker:

    ..\\fortnite-tracker\\refresh.bat --publish

The calendar covers seven days from the moment it was built, so publish at
least weekly; the page says the date it was made and falls back to the form
when it runs out. Anyone who would rather have a file than a link can take
standalone.html from the repository — it is the whole thing in one page and
works with no network at all.
""")
    return 0


if __name__ == "__main__":
    sys.exit(main())
