# Palette candidates from oklch-terminal-themes

Review of <https://github.com/williamzujkowski/oklch-terminal-themes> as a source
for DAEMON // 0's colour identity. Read-only survey: nothing here has been applied,
and `src/ui/theme.ts` is unchanged. The question this answers is "is there a
better-grounded palette than the hand-tuned one, and if so which", not "may we
restyle".

## Why look at all

The current palette is a hand-tuned green phosphor on near-black that passes every
contrast bar the UI-SPEC sets — except one, which nobody had measured:

| pair | current | bar | |
|---|---:|---:|---|
| text on background | 16.02:1 | ≥4.5 | pass |
| muted on raised (the 12px HUD case) | 8.14:1 | ≥4.5 | pass |
| accent / warning / danger on background | 14.00 / 13.87 / 8.63 | ≥3 | pass |
| accent / warning / danger on surface | 13.16 / 13.04 / 8.12 | ≥3 | pass |
| **border on background** (`#315c3b` on `#030704`) | **2.63:1** | ≥3 | **fail** |
| border on surface | 2.47:1 | — | — |

Two corrections to earlier assumptions, both from measurement: the palette's
weakest text pair is 8.14:1 (muted on `raised`), not 7.28:1; and the 1px structural
border is **below** the 3:1 non-text bar, which is the one place the current
identity is genuinely weak. Panel edges are how the player tells panes apart, so
this is a real defect rather than a technicality.

## Source inventory

- 908 themes (688 dark, 220 light), each `data/by-name/<slug>.json` with 20 ANSI
  slots in hex **and** OKLCH (`oklchCss`), plus `themes.json` / `themes-slim.json`,
  per-theme CSS custom properties (`--terminal-*`) and W3C token files.
- Licence **MIT** (`Copyright (c) 2026 William Zujkowski`), compatible with this
  repo. `NOTICE` flags three upstream ingestions under Apache-2.0 (Monoglow,
  jb.nvim, Warp Themes) and one under BSD-3 (Token); anything taken from those
  would need a third-party notice, so they were excluded from consideration.
  All three candidates below come from the iTerm2-Color-Schemes ingest (MIT), so
  one attribution line in the file header covers adoption.
- Role mapping used: `background` = theme background, `text` = foreground,
  `accent` = cursor, `warning` = yellow, `danger` = red, `border` = brightBlack,
  with `surface`/`raised` and `muted` derived (see the method note below).
- Method validated by reproduction: the contrast code in this survey re-derives
  the repository's own published `contrast.fgOnBg` for all 908 themes and
  `cursorOnBg` for all 469 cursor-accented themes with zero difference.

## Which themes are even eligible

**237 of 908 (26.1%, all dark) pass every criterion.** 671 fail: body text 354,
semantic colours 247, border 424. No light theme passes body text (0 of 220).

Two failure shapes matter:

- All six native CRT palettes (`amber-crt`, `dec-vt220-amber`, `ibm-5151-mda`,
  `apple-ii-green`, `tektronix-4014`, `hercules`) fail **only** on border
  (1.51-2.16:1) — their text, accent and semantics are excellent.
- Conversely 136 themes fail the other way, with a `brightBlack` at 8:1 or more:
  a glaring frame around every panel.

Amber/CRT identities were considered and set aside as full palettes for a specific
reason: in every amber theme, `accent` and `warning` resolve to the same colour
(`grok-night` and `lumina-quartz-dark-contrast` have identical hexes for the two
roles), so an amber CRT would make the warning state indistinguishable from normal
emphasis. That is not a contrast failure; it is a semantic one.

## Candidates

All three sit on a near-black background (OKLCH L 0.147-0.182), keep a
phosphor/industrial lineage rather than pastel, and beat the current border
measurement (2.63 → 3.24-4.94). Method for the two derived slots: `surface` and
`raised` are the background lifted +0.045 and +0.085 in OKLCH lightness; `muted` is
the foreground blended 55% toward the background in linear light, chosen so 12px
labels clear 7:1 while keeping roughly the current 1.7x step to 14px values
(today: 1.66x).

### 1. Lit Cell — `lit-cell` (recommended)

Alien mint phosphor on cold near-black, amber warning, coral danger.

| role | hex | OKLCH | source |
|---|---|---|---|
| `background` | `#0c110e` | `oklch(0.171 0.010 158.8)` | theme |
| `surface` | `#161b18` | `oklch(0.216 0.010 159.2)` | derived |
| `raised` | `#1f2521` | `oklch(0.257 0.011 156.3)` | derived |
| `border` | `#758679` | `oklch(0.602 0.028 152.5)` | theme brightBlack |
| `accent` | `#3df2a0` | `oklch(0.854 0.183 158.2)` | theme cursor |
| `text` | `#cfddd3` | `oklch(0.884 0.020 154.9)` | theme foreground |
| `muted` | `#9faaa2` | `oklch(0.727 0.017 154.3)` | derived, 55% blend |
| `warning` | `#ffb000` | `oklch(0.812 0.170 76.4)` | theme yellow |
| `danger` | `#ff6b6b` | `oklch(0.712 0.181 22.8)` | theme red |

| pair | ratio | bar |
|---|---:|---:|
| text on background | 13.55:1 | ≥4.5 |
| muted on background | 7.94:1 | ≥4.5 |
| accent on background / surface | 13.07 / 11.97 | ≥3 |
| warning on background / surface | 10.40 / 9.52 | ≥3 |
| danger on background / surface | 6.87 / 6.28 | ≥3 |
| border on background / surface | 4.94 / 4.52 | ≥3 |
| muted on surface | 7.26:1 | ref |

Why it leads: the widest accent-to-warning hue separation of the set (82° — H 158
against H 76, with danger at H 23), so the three semantic states never depend on
glyphs alone; the strongest border of the three (4.94 / 4.52), which fixes the one
measured defect; and a near-neutral `text` (chroma 0.020) that keeps 12px HUD
labels from reading as tinted noise. The name also lands on the game's own first
minutes: a mind waking in a lit, sealed cell.

### 2. Citrus Ink — `citrus-ink`

Chartreuse on teal-black. Best measured numbers, most brutal industrial feel.

| role | hex | OKLCH | source |
|---|---|---|---|
| `background` | `#0b1413` | `oklch(0.182 0.014 187.4)` | theme |
| `surface` | `#151e1d` | `oklch(0.226 0.013 187.9)` | derived |
| `raised` | `#1e2827` | `oklch(0.267 0.014 188.8)` | derived |
| `border` | `#577466` | `oklch(0.532 0.040 163.8)` | theme brightBlack, L 0.502 → 0.532 |
| `accent` | `#b8e62e` | `oklch(0.862 0.201 123.6)` | theme cursor |
| `text` | `#eaf0e2` | `oklch(0.947 0.020 125.8)` | theme foreground |
| `muted` | `#b4b9ae` | `oklch(0.779 0.016 126.9)` | derived, 55% blend |
| `warning` | `#e6c84a` | `oklch(0.836 0.145 95.6)` | theme yellow |
| `danger` | `#ff6b5b` | `oklch(0.709 0.184 28.7)` | theme red |

text 16.07, muted 9.34, accent 12.81 / 11.65, warning 11.32 / 10.30, danger
6.68 / 6.08, border 3.64 / 3.32. The only colour altered from the theme is its
`brightBlack`, lifted from L 0.502 to 0.532 so the border clears 3:1 on both
background and surface; everything else is verbatim.

### 3. Acid Lime — `acid-lime`

Toxic lime with near-white green text. The most "machine that is not friendly",
and the most faithful to the phosphor-green lineage.

| role | hex | OKLCH | source |
|---|---|---|---|
| `background` | `#080c05` | `oklch(0.147 0.018 130.5)` | theme |
| `surface` | `#11160d` | `oklch(0.192 0.019 131.6)` | derived |
| `raised` | `#1a1f16` | `oklch(0.231 0.018 131.4)` | derived |
| `border` | `#4a6b36` | `oklch(0.489 0.088 134.7)` | theme brightBlack |
| `accent` | `#c2ff33` | `oklch(0.926 0.222 125.9)` | theme cursor |
| `text` | `#d4efbc` | `oklch(0.919 0.073 130.5)` | theme foreground |
| `muted` | `#a2b790` | `oklch(0.753 0.059 130.8)` | derived, 55% blend |
| `warning` | `#eeff5c` | `oklch(0.958 0.182 115.0)` | theme yellow |
| `danger` | `#ff3344` | `oklch(0.651 0.235 23.2)` | theme red |

text 15.84, muted 9.12, accent 16.57 / 15.42, warning 17.93 / 16.68, danger
5.45 / 5.08, border 3.24 / 3.01. Caveat: its `warning` (H 115) is 11° from the
accent (H 126) at 0.9x the luminance, so a warning would be distinguishable by
glyph and motion rather than colour. That is acceptable under the review contract
forbidding colour-only meaning, but it is weaker than Citrus Ink and weaker than
Lit Cell.

### Considered and rejected

`vacuum-tube`, `ember-peak`, `black-box-recorder`, `after-hours` (strong amber/CRT
identities, but accent and warning collapse into one colour and `brightBlack` is a
~12:1 white), `green-screen`, `ghost-circuit`, `night-pharmacy` (good hues, border
11.9-12.2), `5150-mode` (IBM lineage, but background L 0.251 is a green field
rather than near-black, and muted is 6.80).

## What adoption would cost

1. `src/ui/theme.ts` is the only file with colour values, so a change is one file
   plus whatever asserts the tokens. Phase shifts touch accent and border only, so
   phase palettes need re-deriving too (§ "Palette shifts by phase" in UI-SPEC).
2. The palette is not only contrast: it carries identity. Whichever candidate is
   chosen, the decision is a visual one and wants a human eye on the export at
   390x844 and 1440x900 before merge — contrast tables cannot tell you a palette
   looks wrong.
3. The one thing worth fixing regardless of the decision: **the current border is
   2.63:1**, and a border-only change (`#315c3b` → something at 3:1+ on both
   background and surface) would resolve the measured defect without touching the
   identity at all.

## Limits of this review

Ratios are WCAG 2.1 relative luminance on the sampled pairs, computed with the
same code path the theme repository publishes in its own data. Not evaluated:
colour-blind simulation, the phase-shift tokens, camera/audio UI accents, or how
any candidate reads on a physical Android device (none was available). The
appendix of all 908 themes with every ratio lives outside the repository, in the
survey artifact.
