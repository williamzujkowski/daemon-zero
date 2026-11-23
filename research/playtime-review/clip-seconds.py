"""Measures every bundled voice clip's duration with ffprobe (the unbundled `clean` takes are skipped).

Run from the repository root: python3 -I research/playtime-review/clip-seconds.py
Writes research/playtime-review/data/voice-clip-seconds.json as {clip id: seconds}.
"""
import json
import pathlib
import subprocess

root = pathlib.Path("assets/audio/voice")
out = {}
for clip in sorted(root.glob("*/*.mp3")):
    if clip.parent.name == "clean":
        continue
    seconds = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(clip)],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    out[clip.stem] = round(float(seconds), 3)
target = pathlib.Path("research/playtime-review/data/voice-clip-seconds.json")
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(out, indent=1) + "\n")
print(f"{len(out)} clips, {sum(out.values()):.1f} s in all, longest {max(out.items(), key=lambda kv: kv[1])}")
