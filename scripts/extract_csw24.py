"""Extract CSW24 from the local Zyzzyva SQLite lexicon.

Source (untouched): data/source/csw24.* + manifest
Derived app data:   src/data/csw24.json and src/data/csw24-with-definitions.json
Reads from Zyzzyva's SQLite DB and the original word text for provenance.
Re-run to refresh after Zyzzyva updates. No network required.
"""
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = Path("/home/iu/Zyzzyva/lexicons/CSW24.db")
ORIG_TXT = Path("/home/iu/zyzzyva/data/words/British/CSW24.txt")

SRC_TXT = ROOT / "data/source/csw24.txt"
SRC_MANIFEST = ROOT / "data/source/csw24-manifest.json"
SRC_JSON_DEFS = ROOT / "data/source/csw24-with-definitions.json"
SRC_TSV_DEFS = ROOT / "data/source/csw24-with-definitions.tsv"
DERIVED_JSON = ROOT / "src/data/csw24.json"
DERIVED_JSON_DEFS = ROOT / "src/data/csw24-with-definitions.json"

con = sqlite3.connect(str(DB))
cur = con.cursor()
cur.execute("SELECT word, definition FROM words ORDER BY word")
rows = cur.fetchall()

words = [w for w, _ in rows]

SRC_TXT.parent.mkdir(parents=True, exist_ok=True)
SRC_TXT.write_text("\n".join(words) + "\n")

DERIVED_JSON.parent.mkdir(parents=True, exist_ok=True)
DERIVED_JSON.write_text(json.dumps(words) + "\n")

payload = [{"word": w, "definition": d} for w, d in rows]
SRC_JSON_DEFS.write_text(json.dumps(payload) + "\n")
DERIVED_JSON_DEFS.write_text(json.dumps(payload) + "\n")

with open(SRC_TSV_DEFS, "w", encoding="utf-8") as f:
    for w, d in rows:
        f.write(f"{w}\t{d}\n")

SRC_MANIFEST.write_text(json.dumps({
    "lexicon": "CSW24",
    "source": f"Zyzzyva sqlite lexicon at {DB} (original word text at {ORIG_TXT})",
    "word_count": len(words),
    "min_length": min(len(w) for w in words),
    "max_length": max(len(w) for w in words),
}, indent=2) + "\n")

print(f"Wrote {len(words)} words to {SRC_TXT} and {DERIVED_JSON}")
print(f"With definitions: {SRC_JSON_DEFS}, {SRC_TSV_DEFS}, {DERIVED_JSON_DEFS}")
print(f"Manifest: {SRC_MANIFEST}")
