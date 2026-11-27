#!/usr/bin/env python3
"""Fill in game developers from Wikipedia game articles.

Reads a Wikipedia "List of ... games" page, keeps the rows with a North
American release, follows each title's link to its article, and reads the
developer from the article's {{Infobox video game}}. Developer names are
matched to guids in content/developers/index.json (new developers are added).

Articles are fetched through the MediaWiki API in batches of 50 titles per
request and cached on disk, so a run makes a handful of requests and re-runs
make none.

Each result gets a confidence level:
  exact      the infobox, a footnote or the article text names the developer
             of the TurboGrafx-16 / PC Engine version, or the game is
             exclusive to the TurboGrafx/PC Engine family
  multi      the game is on other platforms too and the infobox gives one
             developer for all of them; this is often the developer of the
             original (e.g. arcade) version, not the TurboGrafx port
  skipped    no link, no infobox, no developer, or the article is not about a
             TurboGrafx/PC Engine game

By default this is a dry run that prints a report. --write updates records
with "exact" results (add --include-multi for "multi" results too). Existing
developers are kept unless --overwrite is given. Run `npm run optimize` and
`npm run validate` afterwards.

Usage:
  python3 scripts/wikipedia_developers.py [--write] [--include-multi]
      [--report report.md] [--refresh]

Only the Python standard library is used.
"""

import argparse
import difflib
import gzip
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
API = "https://en.wikipedia.org/w/api.php"
DEFAULT_UA = "game-db-tools/1.0 (developer import script; python-urllib)"
BATCH = 50

# Which list page to read, and which platform folder each format goes to.
LIST_PAGE = "List of TurboGrafx-16 games"
REGION = "us"
FORMAT_TO_PLATFORM = [  # first match wins
    (re.compile(r"HuCard"), "NEC/TG16"),
    (re.compile(r"CD-ROM"), "NEC/TGCD"),
]
# Platform names that count as "this game is on the TurboGrafx/PC Engine".
TARGET_PLATFORM = re.compile(
    r"turbo\s*-?grafx|pc[\s-]*engine|turbo\s*duo|super\s*grafx|\bpce\b|\btg-?16\b|"
    r"\bt-16\b|cd-rom\s*(?:²|2|\^2)|super cd-rom",
    re.I,
)
# Platforms that are re-release services, not separate versions of a game.
RERELEASE_PLATFORM = re.compile(
    r"virtual console|playstation (?:network|store)|\bpsn\b|nintendo switch online|project egg|"
    r"\bmini\b|^wii(?: u)?$|^wii \(",
    re.I,
)
# List titles that don't match their database names after normalizing.
NAME_OVERRIDES = {
    "Parasol Stars: The Story of Bubble Bobble III": "Parasol Stars",
    "Sonic Spike": "Sonic Spike Volleyball",
}
# Developer names Wikipedia spells differently from the developer index:
# normalized name -> (guid, display name used if the guid is new).
DEVELOPER_SYNONYMS = {
    "nippontelenet": ("Telenet_Japan", "Telenet Japan"),
    "sinnihonlasersoft": ("Laser_Soft", "Laser Soft"),
    "shinnihonlasersoft": ("Laser_Soft", "Laser Soft"),
    "turbotechnologies": ("TTI", "TTI"),
}


# --------------------------------------------------------------------------
# Wiki markup helpers


def find_templates(text, name_re):
    """Yield (start, end) of every top-level {{template}} whose name matches."""
    i = 0
    pat = re.compile(r"\{\{\s*(?:" + name_re + r")\s*[|}\n]", re.I)
    while True:
        m = pat.search(text, i)
        if not m:
            return
        end = matching_braces(text, m.start())
        yield m.start(), end
        i = end


def matching_braces(text, start):
    """Index just past the }} that closes the {{ at text[start]."""
    depth = 0
    i = start
    while i < len(text) - 1:
        two = text[i : i + 2]
        if two == "{{":
            depth += 1
            i += 2
        elif two == "}}":
            depth -= 1
            i += 2
            if depth == 0:
                return i
        else:
            i += 1
    return len(text)


def split_top(text, sep="|"):
    """Split on sep, ignoring separators inside {{ }} and [[ ]]."""
    parts, depth, cur, i = [], 0, [], 0
    while i < len(text):
        two = text[i : i + 2]
        if two in ("{{", "[["):
            depth += 1
            cur.append(two)
            i += 2
        elif two in ("}}", "]]"):
            depth -= 1
            cur.append(two)
            i += 2
        elif text[i] == sep and depth == 0:
            parts.append("".join(cur))
            cur = []
            i += 1
        else:
            cur.append(text[i])
            i += 1
    parts.append("".join(cur))
    return parts


def template_params(tpl):
    """{{Name|a|k=v}} -> (positional list, named dict)."""
    inner = tpl[2:-2]
    parts = split_top(inner)
    pos, named = [], {}
    for p in parts[1:]:
        k, eq, v = p.partition("=")
        if eq and re.fullmatch(r"\s*[\w -]+\s*", k) and "[[" not in k:
            named[k.strip().lower()] = v.strip()
        else:
            pos.append(p.strip())
    return pos, named


def strip_refs(text):
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    text = re.sub(r"<ref[^>]*/>", "", text)
    text = re.sub(r"<ref[^>]*>.*?</ref\s*>", "", text, flags=re.S)
    return text


def take_notes(text):
    """Remove {{efn}}-style footnotes; return (text, [note texts])."""
    notes = []
    for s, e in reversed(list(find_templates(text, r"efn(?:-\w+)?|refn|NoteTag|note"))):
        pos, named = template_params(text[s:e])
        notes.append(" ".join(pos) or named.get("1", ""))
        text = text[:s] + text[e:]
    return text, notes


LIST_TEMPLATES = r"ubl|unbulleted list|plainlist|plain list|flatlist|flat list|hlist|collapsible list|bulleted list|ublist"


def flatten_lists(text):
    """Turn list templates into newline-separated items."""
    while True:
        found = list(find_templates(text, LIST_TEMPLATES))
        if not found:
            break
        s, e = found[0]
        pos, named = template_params(text[s:e])
        items = []
        for p in pos:
            items += [x.strip().lstrip("*#").strip() for x in p.split("\n")]
        text = text[:s] + "\n" + "\n".join(x for x in items if x) + "\n" + text[e:]
    # Unwrap simple formatting templates such as {{nowrap|...}}.
    for s, e in reversed(list(find_templates(text, r"nowrap|nobr|small|nobold|lang|nihongo"))):
        pos, _ = template_params(text[s:e])
        text = text[:s] + (pos[0] if pos else "") + text[e:]
    return text


LINK = re.compile(r"\[\[([^\]|#]*)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]")


def plain(text):
    text = LINK.sub(lambda m: m.group(2) or m.group(1), text)
    text = re.sub(r"\{\{[^{}]*\}\}", "", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("'''", "").replace("''", "")
    return re.sub(r"\s+", " ", text).strip()


def items_of(value):
    value = flatten_lists(value)
    value = re.sub(r"</?small\s*>|''+", "", value)
    out = []
    for raw in re.split(r"<br\s*/?>|\n", value):
        raw = raw.strip().lstrip("*#").strip()
        if not raw:
            continue
        if re.fullmatch(r"\([^()]*\)", raw) and out:
            out[-1] += " " + raw  # a qualifier on its own line belongs to the line above
        else:
            out.append(raw)
    return out


QUALIFIER_PAREN = re.compile(r"\(([^()]*)\)\s*$")
QUALIFIER_PREFIX = re.compile(r"^\s*(?:''+)?([^:\[\]]{2,40}?)(?:''+)?\s*:\s*(?=\S)")


def parse_item(raw):
    """One developer line -> (names [(display, link target)], qualifier)."""
    qual = ""
    s = raw
    m = QUALIFIER_PAREN.search(plain(s))
    if m:
        qual = m.group(1)
        # drop the trailing parenthetical from the markup too
        s = re.sub(r"\s*\([^()]*\)\s*$", "", s)
    else:
        m = QUALIFIER_PREFIX.match(s)
        if m:
            qual = plain(m.group(1))
            s = s[m.end() :]
    links = LINK.findall(s)
    names = []
    if links:
        for target, display in links:
            target = target.strip()
            names.append(((display or target).strip(), target))
    else:
        for part in re.split(r"\s*(?:/|;|\band\b)\s*", plain(s)):
            part = part.strip(" ,")
            if part:
                names.append((part, ""))
    return names, qual


# --------------------------------------------------------------------------
# Wikipedia API with a disk cache


class Wiki:
    def __init__(self, cache_dir, user_agent, refresh=False):
        self.cache_path = Path(cache_dir) / "pages.json"
        self.cache = {}
        if self.cache_path.exists() and not refresh:
            self.cache = json.loads(self.cache_path.read_text())
        self.ua = user_agent
        self.requests = 0

    def save(self):
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self.cache_path.write_text(json.dumps(self.cache, ensure_ascii=False))

    def _get(self, params):
        params = {**params, "format": "json", "formatversion": "2", "maxlag": "5"}
        url = API + "?" + urllib.parse.urlencode(params)
        for attempt in range(5):
            req = urllib.request.Request(url, headers={"User-Agent": self.ua, "Accept-Encoding": "gzip"})
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    body = r.read()
                    if r.headers.get("Content-Encoding") == "gzip":
                        body = gzip.decompress(body)
                self.requests += 1
                data = json.loads(body)
                if data.get("error", {}).get("code") == "maxlag":
                    time.sleep(5 * (attempt + 1))
                    continue
                return data
            except urllib.error.HTTPError as e:
                if e.code in (429, 503):
                    time.sleep(int(e.headers.get("Retry-After", 5 * (attempt + 1))))
                    continue
                raise
        raise RuntimeError("Wikipedia API kept refusing the request")

    def pages(self, titles):
        """Fetch wikitext for many titles. Returns {requested title: page}.

        page = {"title": final title, "fragment": section or "", "text": wikitext or None}
        """
        out = {}
        todo = [t for t in dict.fromkeys(titles) if t not in self.cache]
        for i in range(0, len(todo), BATCH):
            batch = todo[i : i + BATCH]
            params = {
                "action": "query",
                "prop": "revisions",
                "rvprop": "content",
                "rvslots": "main",
                "redirects": "1",
                "titles": "|".join(batch),
            }
            pages, norm, redir = {}, {}, {}
            while True:
                data = self._get(params)
                q = data.get("query", {})
                for n in q.get("normalized", []):
                    norm[n["from"]] = n["to"]
                for r in q.get("redirects", []):
                    redir[r["from"]] = (r["to"], r.get("tofragment", ""))
                for p in q.get("pages", []):
                    revs = p.get("revisions")
                    if revs:
                        pages[p["title"]] = revs[0]["slots"]["main"]["content"]
                    else:
                        pages.setdefault(p["title"], None)
                if "continue" not in data:
                    break
                params = {**params, **data["continue"]}
            for t in batch:
                cur, frag = norm.get(t, t), ""
                seen = set()
                while cur in redir and cur not in seen:
                    seen.add(cur)
                    cur, f = redir[cur]
                    frag = f or frag
                self.cache[t] = {"title": cur, "fragment": frag, "text": pages.get(cur)}
            print(f"  fetched {min(i + BATCH, len(todo))}/{len(todo)} articles", file=sys.stderr)
        for t in titles:
            out[t] = self.cache[t]
        return out

    def wikitext(self, title):
        return self.pages([title])[title]["text"]


# --------------------------------------------------------------------------
# The list page


def parse_list(text):
    """Rows of the main game table that have a North American release."""
    start = text.index('id="softwarelist"')
    body = text[start:]
    body = body[: body.index("\n|}")]
    rows = []
    for r in body.split("\n|-")[2:]:
        cells = [c for c in re.split(r"\n\|", "\n" + r.strip()) if c.strip()]
        flat = []
        for c in cells:
            flat += c.split("||")
        if len(flat) < 5:
            continue
        title, dist, _jp, na, fmt = flat[:5]
        if re.search(r"\{\{\s*unreleased", na, re.I) or not na.strip():
            continue
        first = re.split(r"<br\s*/?>", title)[0]
        first = strip_refs(first)
        first, _ = take_notes(first)
        link = re.search(r"\[\[([^\]|]+)", first)  # target, including any #section
        rows.append(
            {
                "title": plain(first).lstrip("•").strip(),
                "link": link.group(1).strip() if link else None,
                "format": plain(fmt.split("|")[-1].replace("<br>", " / ")),
            }
        )
    return rows


# --------------------------------------------------------------------------
# Reading the developer out of an article


def find_infobox(text, fragment):
    boxes = list(find_templates(text, r"Infobox[ _](?:video[ _]games?|VG|cvg)"))
    if not boxes:
        return None, "no infobox"
    if fragment and len(boxes) > 1:
        frag = fragment.replace("_", " ")
        h = re.search(r"^=+\s*" + re.escape(frag) + r"\s*=+\s*$", text, re.M | re.I)
        if h:
            after = [b for b in boxes if b[0] > h.start()]
            if after:
                return text[after[0][0] : after[0][1]], ""
    if fragment and len(boxes) == 1:
        return text[boxes[0][0] : boxes[0][1]], "section link; infobox may describe the parent article"
    return text[boxes[0][0] : boxes[0][1]], ""


# A company name: a [[link]], or a run of capitalized words ("Bits Laboratory").
WORD = r"[A-Z0-9](?:[\w&'-]|\.(?=\w))*"  # a period only inside a word, as in "A.I"
NAME = r"(\[\[[^\]]+\]\]|" + WORD + r"(?:\s+(?:" + WORD + r"|of|&))*)"
TG = r"(?i:TurboGrafx|PC[ -]Engine|TurboDuo|\[\[TurboGrafx|\[\[PC Engine)"
VERB = r"(?i:developed|ported|programmed|converted)"
BODY_PATTERNS = [
    # "The TurboGrafx-16 version was developed by X (and Y)"
    re.compile(TG + r"[^.;\n]{0,100}?" + VERB + r"\s+by\s+(?:the\s+)?" + NAME + r"(?:\s+and\s+" + NAME + r")?"),
    # lead sentence: "... developed (and published) by X (and published by Z) for the TurboGrafx-16"
    re.compile(
        r"(?i:developed)\s+(?:and\s+(?:originally\s+)?(?:published|released)\s+)?by\s+" + NAME
        + r"(?:\s+and\s+" + NAME + r")?(?:\s+and\s+(?:originally\s+)?published\s+by\s+[^.\n]{0,60}?)?"
        + r"\s+for\s+the\s+[^.\n]{0,40}?" + TG
    ),
    # "[[X]] developed a port of the game for the TurboGrafx-16"
    re.compile(
        r"(\[\[[^\]]+\]\])()\s+(?:also\s+)?" + VERB + r"\s+(?:a|an|the)\s[^.\n]{0,60}?"
        r"(?:port|version|conversion)\b[^.\n]{0,40}?" + TG
    ),
]


def names_from_match(m):
    names = []
    for s in m.groups():
        if not s:
            continue
        links = LINK.findall(s)
        if links:
            names += [((d or t).strip(), t.strip()) for t, d in links[:1]]
        else:
            names.append((plain(s), ""))
    return names


def read_developers(text, fragment):
    """-> dict(confidence, source, names [(display, target)], note)."""
    box, warn = find_infobox(text, fragment)
    if box is None:
        return {"confidence": "skipped", "source": "", "names": [], "note": warn}
    _, params = template_params(box)
    dev = params.get("developer") or params.get("developers") or ""
    platforms = params.get("platforms") or params.get("platform") or ""
    dev = strip_refs(dev)
    dev, notes = take_notes(dev)
    plat_items = [plain(x) for x in items_of(strip_refs(take_notes(platforms)[0]))]
    plat_items = [p for x in plat_items for p in re.split(r"\s*,\s*", x) if p]
    on_target = any(TARGET_PLATFORM.search(p) for p in plat_items)
    others = [p for p in plat_items if not TARGET_PLATFORM.search(p) and not RERELEASE_PLATFORM.search(p)]

    entries = [parse_item(x) for x in items_of(dev)]
    targeted = [n for names, q in entries if q and TARGET_PLATFORM.search(q) for n in names]
    unqualified = [n for names, q in entries if not q for n in names]

    def result(conf, src, names, note=warn):
        return {"confidence": conf, "source": src, "names": names, "note": note}

    # 1. the infobox names the developer of the TurboGrafx/PC Engine version
    if targeted:
        return result("exact", "infobox (TurboGrafx qualifier)", targeted)
    # 2. an infobox footnote does ("TurboGrafx-16 version developed by X")
    for note in notes:
        for clause in re.split(r";\s*", note):
            m = BODY_PATTERNS[0].search(clause)
            if m:
                return result("exact", "infobox footnote", names_from_match(m), "matched: " + plain(clause)[:120])
    # 3. the game only came out on TurboGrafx/PC Engine family hardware
    if on_target and unqualified and not others and not warn:
        return result("exact", "infobox (TurboGrafx/PC Engine exclusive)", unqualified)
    # 4. the article text does
    s, e = text.find(box), text.find(box) + len(box)
    body = strip_refs(text[:s] + text[e:])
    if on_target or warn:
        for pat in BODY_PATTERNS:
            m = pat.search(body)
            if m:
                return result("exact", "article text", names_from_match(m),
                              (warn + "; " if warn else "") + "matched: " + plain(m.group(0))[:120])
    if not dev.strip():
        return result("skipped", "", [], "infobox has no developer")
    if not on_target:
        return result("skipped", "", [], "article is not about a TurboGrafx/PC Engine game (platforms: "
                      + ", ".join(plat_items[:5]) + ")")
    if not unqualified:
        quals = ", ".join(q for _, q in entries)
        return result("skipped", "", [], f"developers are only given for other versions ({quals})")
    # 5. one developer listed for every version; may be the original's developer
    shared = ", ".join(others[:4]) if others else "parent article"
    return result("multi", f"infobox (shared by {shared})", unqualified)


# --------------------------------------------------------------------------
# Database side


def norm(s):
    s = s.lower().replace("&", "and")
    s = re.sub(r"\bthe\b", "", s)
    return re.sub(r"[^a-z0-9]", "", s)


def load_records():
    recs = {}
    for _, platform in FORMAT_TO_PLATFORM:
        for f in sorted((CONTENT / "platforms" / platform / REGION).glob("*/index.json")):
            d = json.loads(f.read_text())
            recs.setdefault(platform, {})[norm(d["name"])] = (f, d)
    return recs


def match_record(row, recs):
    for pat, platform in FORMAT_TO_PLATFORM:
        if pat.search(row["format"]):
            name = NAME_OVERRIDES.get(row["title"], row["title"])
            name = re.sub(r"\s*\(CD\)$", "", name)
            return recs.get(platform, {}).get(norm(name))
    return None


def dev_norm(s):
    """Normalize a company name, ignoring suffixes such as "Co., Ltd." or "Inc."."""
    s = re.sub(r"[,.]?\s*\b(?:co|ltd|inc|corp|corporation|company|k\.?k|limited|llc)\b\.?", " ", s, flags=re.I)
    return norm(s)


GUID_BAD = re.compile(r"[^A-Za-z0-9._~!$&'()+,;=@-]")


def make_guid(name):
    g = GUID_BAD.sub("", re.sub(r"\s+", "_", name.strip()))
    return g.strip("_.")


class Developers:
    def __init__(self):
        self.path = CONTENT / "developers" / "index.json"
        self.index = json.loads(self.path.read_text())
        aliases = json.loads((CONTENT / "_config" / "aliases.json").read_text()).get("developers", {})
        self.lookup = {}
        for g, v in self.index.items():
            self.lookup.setdefault(dev_norm(v["name"]), g)
            self.lookup.setdefault(dev_norm(g), g)
        for old, new in aliases.items():
            self.lookup.setdefault(dev_norm(old), new)
        self.added = {}

    def guid_for(self, display, target):
        for key in (display, target, re.sub(r"\s*\([^)]*\)$", "", target or "")):
            if not key:
                continue
            k = dev_norm(key)
            if k in DEVELOPER_SYNONYMS:
                guid, name = DEVELOPER_SYNONYMS[k]
                if guid not in self.index:
                    self.added[guid] = name
                return guid, guid not in self.index
            if k in self.lookup:
                return self.lookup[k], False
        guid = make_guid(display)
        self.lookup[dev_norm(display)] = guid
        self.added[guid] = display
        return guid, True

    def similar(self, name):
        names = {v["name"]: g for g, v in self.index.items()}
        return [names[n] for n in difflib.get_close_matches(name, names, n=3, cutoff=0.75)]

    def save(self):
        for g, name in self.added.items():
            self.index[g] = {"name": name}
        self.index = dict(sorted(self.index.items(), key=lambda kv: kv[0].lower()))
        self.path.write_text(json.dumps(self.index, indent=2, ensure_ascii=False) + "\n")


# --------------------------------------------------------------------------


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--write", action="store_true", help="update records (default: dry run)")
    ap.add_argument("--include-multi", action="store_true", help='also write "multi" confidence results')
    ap.add_argument("--overwrite", action="store_true", help="replace developers already on a record")
    ap.add_argument("--report", help="write a Markdown report to this file")
    ap.add_argument("--cache", default=str(ROOT / ".cache" / "wikipedia"), help="cache directory")
    ap.add_argument("--refresh", action="store_true", help="ignore the cache and download again")
    ap.add_argument("--user-agent", default=os.environ.get("WIKI_USER_AGENT", DEFAULT_UA),
                    help="User-Agent for Wikipedia (or set WIKI_USER_AGENT)")
    args = ap.parse_args()

    wiki = Wiki(args.cache, args.user_agent, args.refresh)
    print(f"Reading {LIST_PAGE}", file=sys.stderr)
    rows = parse_list(wiki.wikitext(LIST_PAGE))
    linked = [r for r in rows if r["link"]]
    pages = wiki.pages([r["link"].split("#")[0] for r in linked])
    wiki.save()

    recs = load_records()
    devs = Developers()
    results = []
    for row in rows:
        rec = match_record(row, recs)
        res = {"row": row, "record": rec}
        if not row["link"]:
            res.update(confidence="skipped", source="", names=[], note="no article link in the list")
        else:
            base, _, frag = row["link"].partition("#")
            page = pages[base]
            frag = frag or page["fragment"]
            if page["text"] is None:
                res.update(confidence="skipped", source="", names=[], note="article does not exist")
            else:
                res.update(read_developers(page["text"], frag))
            res["article"] = page["title"] + ("#" + frag if frag else "")
        res["guids"] = []
        for display, target in res["names"]:
            g, new = devs.guid_for(display, target)
            if g not in res["guids"]:
                res["guids"].append(g)
        results.append(res)

    write_levels = {"exact"} | ({"multi"} if args.include_multi else set())
    written = 0
    used_new = set()
    for res in results:
        rec = res["record"]
        res["action"] = ""
        if not rec:
            res["action"] = "no matching record"
            continue
        if res["confidence"] not in write_levels or not res["guids"]:
            continue
        f, d = rec
        if d.get("developers") and not args.overwrite:
            res["action"] = "kept existing " + ";".join(d["developers"])
            continue
        if d.get("developers") == res["guids"]:
            res["action"] = "unchanged"
            continue
        res["action"] = "write"
        used_new.update(g for g in res["guids"] if g in devs.added)
        if args.write:
            d = {**d, "developers": res["guids"]}
            f.write_text(json.dumps(dict(sorted(d.items())), indent=2, ensure_ascii=False) + "\n")
        written += 1
    devs.added = {g: n for g, n in devs.added.items() if g in used_new}
    if args.write and devs.added:
        devs.save()

    # ---- report
    from collections import Counter
    counts = Counter(r["confidence"] for r in results)
    lines = [f"# Developers from Wikipedia: {LIST_PAGE}", "",
             f"{len(rows)} North American rows, {wiki.requests} API request(s) this run.", "",
             "| confidence | rows |", "|---|---|"]
    lines += [f"| {k} | {counts[k]} |" for k in ("exact", "multi", "skipped")]
    lines += ["", f"Records {'updated' if args.write else 'that would be updated'}: {written}", ""]
    if devs.added:
        lines += ["## New developers", "", "| guid | name | similar existing |", "|---|---|---|"]
        for g, n in sorted(devs.added.items()):
            lines.append(f"| {g} | {n} | {', '.join(devs.similar(n))} |")
        lines.append("")
    for level in ("exact", "multi", "skipped"):
        group = [r for r in results if r["confidence"] == level]
        if not group:
            continue
        lines += [f"## {level}", "", "| record | developers | source | article | action / note |", "|---|---|---|---|---|"]
        for r in sorted(group, key=lambda r: r["row"]["title"].lower()):
            rec = r["record"]
            ident = (str(rec[0].parent.relative_to(CONTENT / "platforms"))) if rec else r["row"]["title"] + " (no record)"
            note = "; ".join(x for x in (r.get("action"), r.get("note")) if x)
            lines.append(f"| {ident} | {', '.join(r['guids'])} | {r['source']} | {r.get('article', '')} | {note} |")
        lines.append("")
    report = "\n".join(lines)
    if args.report:
        Path(args.report).write_text(report)
        print(f"Report written to {args.report}", file=sys.stderr)
    else:
        print(report)
    print(f"{counts['exact']} exact, {counts['multi']} multi, {counts['skipped']} skipped; "
          f"{written} record(s) {'updated' if args.write else 'would be updated'}; "
          f"{len(devs.added)} new developer(s); {wiki.requests} request(s)", file=sys.stderr)


if __name__ == "__main__":
    main()
