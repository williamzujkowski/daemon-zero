"""Post-processes the runs measure.ts wrote into per-phase reading load, density and human-time estimates.

Run from the repository root after measure.ts:  python3 -I research/playtime-review/analyze.py
Prints Markdown tables and writes research/playtime-review/data/summary.json.

Model (see report.md, "Method"):
  reading rate   238 wpm central (Brysbaert 2019, English non-fiction silent reading), range 200-250 wpm
  floor          reading overlaps all game time; only a backlog left at a phase's end, dilemma reading and
                 deliberation, and the ending add wall time
  low            250 wpm, tiers A+B, distinct texts; reading overlaps only the policy's waits: before each
                 progress decision the reader finishes what has arrived (a queue with a decision barrier);
                 a dilemma adds its modal words + 15 s deliberation (the clock is paused)
  high           200 wpm, tiers A+B+C, every log line including repeats, no overlap at all; a dilemma adds
                 its modal words + 60 s deliberation
"""
import json
import pathlib
from collections import defaultdict

DATA = pathlib.Path("research/playtime-review/data")
CENTRAL, FAST, SLOW = 238.0, 250.0, 200.0
DELIB_LOW, DELIB_HIGH = 15.0, 60.0
FEED_SLOT_SEC = 8.0  # src/ui/widgets/Speech.tsx rotates the decoded line every 8 simulated seconds
GATES_MIN = {0: (3, 12), 1: (8, 120), 2: (8, 120), 3: (8, 120), 4: (8, 120), 5: (15, 30)}
DESIGN_MIN = {0: (6, 6), 1: (12, 15), 2: (30, 40), 3: (45, 55), 4: (25, 35), 5: (15, 30)}


def load(label):
    return json.loads((DATA / f"{label}.json").read_text())


def pushed(event):
    """Tiers A and B, distinct texts, no dilemma modal (counted apart, on paused time)."""
    return event["tier"] in "AB" and not event.get("repeat") and event["source"] != "dilemma"


def phase_of(run, t):
    reached = sorted((v, int(k)) for k, v in run["phaseReachedAtSec"].items())
    phase = reached[0][1]
    for at, p in reached:
        if t >= at:
            phase = p
    return phase


def words_by(run):
    out = defaultdict(lambda: defaultdict(int))
    for e in run["events"]:
        p = e["phase"]
        if e["source"] == "dilemma":
            out[p]["dilemma"] += e["words"]
            out[p]["dilemmas"] += 1
            continue
        if e.get("repeat"):
            out[p]["repeat"] += e["words"]
            continue
        out[p]["tier" + e["tier"]] += e["words"]
        out[p]["src:" + e["source"]] += e["words"]
        if e["source"] == "feed":
            out[p]["clipSec"] += e.get("clipSec", 0.0)
    return out


def queue_model(run, rate, include, barrier, delib):
    """Wall-time delay per phase: text queues for a reader; a barrier decision waits for the queue."""
    events = sorted(((e["t"], 0, e) for e in run["events"] if include(e)), key=lambda x: (x[0], x[1]))
    decisions = [(d["t"], 1, None) for d in run["decisions"]] if barrier else []
    dilemmas = [(d["t"], 2, d) for d in run["dilemmas"]]
    timeline = sorted(events + decisions + dilemmas, key=lambda x: (x[0], x[1]))
    delay, free_at, extra = 0.0, 0.0, defaultdict(float)
    for t, kind, item in timeline:
        wall = t + delay
        phase = phase_of(run, t)
        if kind == 0:
            free_at = max(free_at, wall) + item["words"] / rate * 60
        elif kind == 1 and free_at > wall:
            extra[phase] += free_at - wall
            delay += free_at - wall
        elif kind == 2:
            cost = item["words"] / rate * 60 + delib
            extra[phase] += cost
            delay += cost
            free_at = max(free_at, wall) + cost
    end_wall = run["simSeconds"] + delay
    if free_at > end_wall:  # the ending and anything still unread
        extra[5] += free_at - end_wall
    return extra


def floor_model(run):
    """Reading overlaps all game time; a phase pays only for what it cannot fit, plus dilemmas."""
    extra = defaultdict(float)
    w = words_by(run)
    for p, secs in run["phaseSec"].items():
        p = int(p)
        reading = (w[p]["tierA"] + w[p]["tierB"]) / FAST * 60
        extra[p] += max(0.0, reading - secs) + w[p]["dilemma"] / FAST * 60 + w[p]["dilemmas"] * DELIB_LOW
    return extra


def high_model(run):
    extra = defaultdict(float)
    w = words_by(run)
    for p in w:
        allw = w[p]["tierA"] + w[p]["tierB"] + w[p]["tierC"] + w[p]["repeat"] + w[p]["dilemma"]
        extra[p] += allw / SLOW * 60 + w[p]["dilemmas"] * DELIB_HIGH
    return extra


def windows(run, width):
    """Pushed words (A+B, log repeats included: they still arrive) per sliding window of game time."""
    arrivals = sorted(((e["t"], e["words"], e) for e in run["events"]
                       if e["tier"] in "AB" and e["source"] != "dilemma" and e["t"] > 0), key=lambda x: x[0])
    out, j, total = [], 0, 0
    for i, (t, w, e) in enumerate(arrivals):
        total += w
        while arrivals[j][0] <= t - width:
            total -= arrivals[j][1]
            j += 1
        out.append((t, total, arrivals[j:i + 1]))
    return out


def log_bursts(run, span=5.0, minimum=3):
    logs = sorted(e["t"] for e in run["events"] if e["source"] == "log")
    bursts, i = [], 0
    while i < len(logs):
        j = i
        while j + 1 < len(logs) and logs[j + 1] - logs[i] <= span:
            j += 1
        if j - i + 1 >= minimum:
            bursts.append((logs[i], j - i + 1))
            i = j + 1
        else:
            i += 1
    return bursts


def summarize(label):
    run = load(label)
    w = words_by(run)
    low = queue_model(run, FAST, pushed, True, DELIB_LOW)
    flo = floor_model(run)
    high = high_model(run)
    decisions = defaultdict(int)
    for d in run["decisions"]:
        decisions[d["phase"]] += 1
    rows = []
    for p in sorted(int(k) for k in run["phaseSec"]):
        secs = run["phaseSec"][str(p)]
        ab = w[p]["tierA"] + w[p]["tierB"]
        rows.append({
            "phase": p, "botSec": secs, "botMin": secs / 60, "decisions": decisions[p],
            "waitSec": max(0.0, secs - decisions[p]),
            "wordsA": w[p]["tierA"], "wordsB": w[p]["tierB"], "wordsC": w[p]["tierC"], "wordsRepeat": w[p]["repeat"],
            "wordsDilemma": w[p]["dilemma"], "dilemmas": w[p]["dilemmas"],
            "sources": {k[4:]: v for k, v in w[p].items() if k.startswith("src:")},
            "clipSec": w[p]["clipSec"],
            "readMinCentral": (ab + w[p]["dilemma"]) / CENTRAL,
            "readMinFast": (ab + w[p]["dilemma"]) / FAST, "readMinSlow": (ab + w[p]["dilemma"]) / SLOW,
            "readMinAll": (ab + w[p]["tierC"] + w[p]["repeat"] + w[p]["dilemma"]) / SLOW,
            "densityWpm": ab / (secs / 60) if secs else 0.0,
            "floorMin": (secs + flo[p]) / 60, "lowMin": (secs + low[p]) / 60, "highMin": (secs + high[p]) / 60,
        })
    return run, rows


def print_table(label, rows, run):
    print(f"\n### {label}: {run['simSeconds']:.1f} s, ending {run['ending']}, wipes {run['wipes']}, {run['verified']}\n")
    print("| Phase | Bot min | Decisions | Words A / B / C / repeats | Dilemmas (words) | Read min 238 (200-250) | "
          "All text min at 200 | Density wpm (A+B) | Human floor / low / high min |")
    print("|---|---|---|---|---|---|---|---|---|")
    tot = defaultdict(float)
    for r in rows:
        print(f"| {r['phase']} | {r['botMin']:.1f} | {r['decisions']} | {r['wordsA']} / {r['wordsB']} / {r['wordsC']} / {r['wordsRepeat']} | "
              f"{r['dilemmas']} ({r['wordsDilemma']}) | {r['readMinCentral']:.1f} ({r['readMinFast']:.1f}-{r['readMinSlow']:.1f}) | "
              f"{r['readMinAll']:.1f} | {r['densityWpm']:.1f} | {r['floorMin']:.1f} / {r['lowMin']:.1f} / {r['highMin']:.1f} |")
        for k in ("botMin", "wordsA", "wordsB", "wordsC", "wordsRepeat", "wordsDilemma", "dilemmas", "readMinCentral",
                  "readMinFast", "readMinSlow", "readMinAll", "floorMin", "lowMin", "highMin"):
            tot[k] += r[k]
    print(f"| all | {tot['botMin']:.1f} | | {tot['wordsA']:.0f} / {tot['wordsB']:.0f} / {tot['wordsC']:.0f} / {tot['wordsRepeat']:.0f} | "
          f"{tot['dilemmas']:.0f} ({tot['wordsDilemma']:.0f}) | {tot['readMinCentral']:.1f} ({tot['readMinFast']:.1f}-{tot['readMinSlow']:.1f}) | "
          f"{tot['readMinAll']:.1f} | | {tot['floorMin']:.1f} / {tot['lowMin']:.1f} / {tot['highMin']:.1f} |")


def print_density(label, run):
    print(f"\n#### {label}: windows where pushed text outruns a {CENTRAL:.0f} wpm reader\n")
    for width in (60, 30, 10):
        cap = CENTRAL * width / 60
        hot = [(t, total, items) for t, total, items in windows(run, width) if total > cap]
        by_phase = defaultdict(int)
        for t, _, _ in hot:
            by_phase[phase_of(run, t)] += 1
        print(f"- {width} s windows over {cap:.0f} words: {len(hot)} arrivals in hot windows; by phase {dict(sorted(by_phase.items()))}")
    worst = sorted(windows(run, 60), key=lambda x: -x[1])  # noqa: the window list is small
    shown, used = 0, []
    for t, total, items in worst:
        if any(abs(t - u) < 120 for u in used):
            continue
        used.append(t)
        mix = defaultdict(int)
        for _, wds, e in items:
            mix[e["source"] + ("*" if e.get("repeat") else "")] += wds
        print(f"  - P{phase_of(run, t)} at {t / 60:.1f} min: {total} words in 60 s ({dict(mix)})")
        shown += 1
        if shown == 8:
            break
    bursts = log_bursts(run)
    by_phase = defaultdict(int)
    for t, n in bursts:
        by_phase[phase_of(run, t)] += 1
    print(f"- log bursts (3+ lines within 5 s; the desktop dock previews only the newest line): {len(bursts)}; by phase {dict(sorted(by_phase.items()))}")


def print_feed(run):
    feed = [e for e in run["events"] if e["source"] == "feed"]
    slot_words = CENTRAL * FEED_SLOT_SEC / 60
    long_lines = [e for e in feed if e["words"] > slot_words]
    long_clips = [e for e in feed if e.get("clipSec", 0) > FEED_SLOT_SEC]
    print(f"\n- decoded feed: {len(feed)} distinct lines; {len(long_lines)} longer than one 8 s slot at {CENTRAL:.0f} wpm "
          f"({slot_words:.0f} words); {len(long_clips)} voiced clips longer than 8 s; longest line {max((e['words'] for e in feed), default=0)} words")


def gate_table(rows):
    print("\n| Phase | Bot min | Gate min-max | Headroom to gate max | DESIGN.md target | Low-high human min |")
    print("|---|---|---|---|---|---|")
    for r in rows:
        lo, hi = GATES_MIN[r["phase"]]
        dlo, dhi = DESIGN_MIN[r["phase"]]
        print(f"| {r['phase']} | {r['botMin']:.1f} | {lo}-{hi} | {hi - r['botMin']:.1f} min ({(hi - r['botMin']) / hi * 100:.0f}%) | "
              f"{dlo}-{dhi} | {r['lowMin']:.1f}-{r['highMin']:.1f} |")


def greedy_table(label, run):
    """The reckless bot replays the early phases after each wipe: time per visit, and words in its first iteration."""
    visits = defaultdict(list)
    for phases in run["phaseSecByIteration"].values():
        for p, secs in phases.items():
            visits[int(p)].append(secs)
    first = defaultdict(int)
    for e in run["events"]:
        if e["iteration"] == 1 and e["tier"] in "AB" and not e.get("repeat"):
            first[e["phase"]] += e["words"]
    print(f"\n### {label}: {run['simSeconds']:.1f} s, ending {run['ending']}, wipes {run['wipes']}, {run['verified']}\n")
    print("| Phase | Iterations entering | Mean min per visit | Median | Longest | Total min | Iteration 1 words (A+B incl. dilemmas) |")
    print("|---|---|---|---|---|---|---|")
    for p in sorted(visits):
        v = sorted(visits[p])
        print(f"| {p} | {len(v)} | {sum(v) / len(v) / 60:.1f} | {v[len(v) // 2] / 60:.1f} | {v[-1] / 60:.1f} | {sum(v) / 60:.1f} | {first[p]} |")


def main():
    summary = {}
    for label in ("stealth-legacy", "stealth-campaign", "greedy-legacy", "greedy-campaign"):
        if not (DATA / f"{label}.json").exists():
            continue
        if label.startswith("greedy"):
            greedy_table(label, load(label))
            continue
        run, rows = summarize(label)
        summary[label] = {"simSeconds": run["simSeconds"], "ending": run["ending"], "wipes": run["wipes"],
                          "phaseReachedAtSec": run["phaseReachedAtSec"], "rows": rows, "verified": run["verified"]}
        print_table(label, rows, run)
        if label.startswith("stealth"):
            print_density(label, run)
            print_feed(run)
            gate_table(rows)
    (DATA / "summary.json").write_text(json.dumps(summary, indent=1) + "\n")


if __name__ == "__main__":
    main()
