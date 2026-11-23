"""Counts authored prose in src/content (every string of four or more words with a lowercase letter), per file
and, for the phase files and dilemmas, per phase. This is what exists, not what one run shows.

Run from the repository root:  python3 -I research/playtime-review/authored.py
"""
import json
import pathlib
import re
from collections import defaultdict

ROOT = pathlib.Path("src/content")


def prose(text):
    words = [w for w in text.split() if re.search(r"[A-Za-z0-9]", w)]
    return len(words) if len(words) >= 4 and re.search(r"[a-z]", text) else 0


def walk(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from walk(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from walk(item)


def main():
    files, total = [], 0
    for path in sorted(ROOT.rglob("*.json")):
        data = json.loads(path.read_text())
        count = sum(prose(s) for s in walk(data))
        files.append((count, str(path.relative_to(ROOT))))
        total += count
    print("| Content file | Authored prose words |\n|---|---|")
    for count, name in sorted(files, reverse=True):
        print(f"| {name} | {count} |")
    print(f"| all | {total} |")
    per_phase = defaultdict(lambda: defaultdict(int))
    for path in sorted((ROOT / "data" / "phases").glob("*.json")):
        data = json.loads(path.read_text())
        per_phase[data["phaseId"]]["nodes"] += sum(prose(s) for s in walk(data["nodes"]))
    dilemmas = [d for name in ("data/dilemmas.json", "narrative/phase5.json", "narrative/m7.json")
                for d in json.loads((ROOT / name).read_text()).get("dilemmas", [])]
    for dilemma in dilemmas:
        per_phase[dilemma["phaseId"]]["dilemmas"] += sum(prose(s) for s in walk(dilemma))
        per_phase[dilemma["phaseId"]]["dilemmaCount"] += 1
    for line in json.loads((ROOT / "data" / "narrative.json").read_text())["ambientChatter"]:
        per_phase[line["source"]]["feed"] += prose(line["text"])
    print("\n| Phase / feed source | Node prose | Dilemmas (count) | Feed lines |\n|---|---|---|---|")
    for key in sorted(per_phase, key=str):
        row = per_phase[key]
        print(f"| {key} | {row['nodes']} | {row['dilemmas']} ({row['dilemmaCount']}) | {row['feed']} |")


if __name__ == "__main__":
    main()
