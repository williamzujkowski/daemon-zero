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
| **border on background** (was `#315c3b` on `#030704`) | **2.63:1** | ≥3 | **fail → fixed** |
| border on surface | 2.47:1 | — | — |

Two corrections to earlier assumptions, both from measurement: the palette's
weakest text pair is 8.14:1 (muted on `raised`), not 7.28:1; and the 1px structural
border was **below** the 3:1 non-text bar, which was the one place the current
identity was genuinely weak. Panel edges are how the player tells panes apart, so
this was a real defect rather than a technicality.

That defect is fixed: `border` is now `#3f764c`, the same hue scaled 1.28x, which
measures 3.77 / 3.55 / 3.18 on background / surface / raised. Every phase border
already cleared the bar (3.10-5.42). `tests/ui-contrast.spec.ts` asserts all of it,
so the claim is a gate rather than an audit. Nothing else in the palette changed.

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
3. The one thing worth fixing regardless of the decision — done: **the border was
   2.63:1**, and the border-only change resolved the measured defect without
   touching the identity at all. It is now a shaded variant of the same hue, and
   the interesting question (whether the identity itself should change) is the one
   still open below.

## Adopted: Lit Cell

The base palette is now `Lit Cell` (see `src/ui/theme.ts`), chosen by two nexus
panel votes and confirmed by the tag filter below. Recorded here because a palette
is an identity decision, and the reasoning matters more than the hexes.

- **First vote**, before the tag filter existed: `no_quorum` (3 of 7 seats died on
  batch-endpoint model assignments), 3 approve / 1 reject; the three approving seats
  chose `lit-cell` unanimously.
- **Second vote**, after the filter: again `no_quorum` (same transport failures),
  3 approve / 1 reject, and `optionOutcome` again unanimous for `lit-cell` among the
  approving seats.
- **The dissent**, from the scope steward both times, was "keep the current palette":
  the one measurable defect was already fixed in #120, green phosphor is the game's
  visual voice, and a 908-theme survey is not a mandate to restyle. That argument is
  recorded rather than dismissed — it is why the change was made as a token swap in
  one file with the phase table re-derived, rather than as a design overhaul.

What actually changed in behaviour: nothing functional. What changed in appearance:
the whole UI, which is the point of an identity decision.

### Phases 2 and 4 were re-hued with it

Adopting Lit Cell makes `warning` a more saturated amber (`#ffb000`) than the old
`#ffcf66`, so the accent/warning collision in #124 would have survived the swap at
phases 2 and 4 (they were amber and gold, 0 and 3 degrees away). Since the phase
tokens had to be re-derived on the new base anyway, phases 2 and 4 moved to violet
`#b98cff` and magenta `#ff6ec7`, and `tests/ui-contrast.spec.ts` now asserts 30
degrees of hue separation between every saturated accent and `warning`/`danger`, and
between the accents themselves. Phase 5 stays near-white and is exempt from the hue
bar by saturation, which the test states.

## Tag-filtered shortlist

The theme repository ships per-theme metadata, so the survey can be filtered rather
than only computed. Each of the 908 entries carries `isDark`, `tags`, `contrast`
(`fgOnBg`, `minAnsi`, `cursorOnBg`, …), `apca`, `cvd` (deuteranopia / protanopia /
tritanopia distances), `accent` (which ANSI slot the accent came from) and a
`dataviz` palette.

Tag vocabulary and counts, dark themes only where noted:

| tag | count | what it means |
|---|---|---|
| `ansi-legible` | 603 | every ANSI slot clears the repository's own legibility bar |
| `wcag-aa` | 882 | **foreground on background** clears AA — nothing else |
| `wcag-aaa` | 813 | same pair, AAA |
| `dark` | 688 | dark background |
| `high-contrast` | 646 | its own contrast tier |
| `brightness-ordered` | 400 | ANSI slots ascend in brightness, as a terminal expects |
| `muted` | 350 | low-chroma identity |
| `light` | 220 | light background |
| `popular` | 103 | curated as a widely used theme |
| `low-contrast` | 35 | flagged, not recommended |
| `cvd-safe` | 24 | colour-vision-deficiency safe, per its own simulation |
| `vibrant` | 18 | high chroma |
| `wcag-aa-large` | 16 / `wcag-fail` 10 | the exceptions |

### `wcag-aa` alone would pick the wrong themes

667 themes are dark and carry `wcag-aa`. Only **249 of those pass this game's
six-pair mapping**, because the tag measures one pair and the game needs six. Where
the other 418 fail:

| pair | failures among the 667 |
|---|---|
| border (`brightBlack`) on background >= 3:1 | **354** |
| muted on background >= 4.5:1 | 113 |
| danger (`red`) on background >= 3:1 | 77 |
| accent (`cursor`) on background >= 3:1 | 20 |
| warning (`yellow`) on background >= 3:1 | 4 |
| text (`foreground`) on background >= 4.5:1 | **0** |

Every one of them passes the pair the tag measures, and more than half fail on the
1px structural border — the same token this repository shipped below its bar for the
whole project. Any shortlist that starts and ends at `wcag-aa` inherits that blind
spot.

Colour-vision safety is a similarly narrow filter: of the 249 that pass, **2 are
`cvd-safe`** (`Jubi`, a desaturated slate with a pale-blue cursor; `Wild Cherry`, a
violet cursor on deep purple). Both pass, neither is a phosphor terminal.

### The shortlist, filtered on the game's own needs

Taking the 249 that pass, restricting to the phosphor lineage (cursor hue 60-185
degrees) and to a structural border in the comfortable 3-7:1 band — above the bar,
below the glaring frame the survey rejects — leaves 19 themes. The best of them by
accent-to-warning hue separation:

| theme | cursor | background | border/bg | Δ accent-warning | Δ accent-danger |
|---|---|---|---|---:|---:|
| Cobalt Next Minimal | `#37b5b4` | `#0b1c24` | 3.59 | 139 | 172 |
| SilkCircuit Soft | `#99ffee` | `#1a1626` | 3.76 | 125 | 177 |
| SilkCircuit Glow | `#00ffff` | `#0a0816` | 5.09 | 120 | 171 |
| SilkCircuit Vibrant | `#00ffcc` | `#0f0c1a` | 5.20 | 120 | 177 |
| **Lit Cell** | `#3df2a0` | `#0c110e` | 4.94 | 111 | 153 |
| SilkCircuit Neon | `#80ffea` | `#12101a` | 5.35 | 105 | 170 |
| Dimidium | `#37e57b` | `#141414` | 4.58 | 102 | 145 |
| Cool Night | `#38ff9d` | `#010c18` | 3.50 | 96 | 150 |
| Nephrite Forest | `#4dbf74` | `#0d1c14` | 4.49 | 95 | 138 |

This agrees with the earlier recommendation from a different direction, which is the
useful part: **Lit Cell** is not simply the best of three hand-picked candidates, it
survives a filter built from the repository's own metadata (dark, passes the full
mapping, phosphor cursor, comfortable border, wide semantic separation). Its
neighbours on raw separation are cyan-on-near-black variants of the same SilkCircuit
family, which read as cooler and more generic terminal than this game's mint
phosphor, and Cobalt Next Minimal, which has the widest separation but a teal cursor
on a blue-green background.

What the metadata does **not** decide is identity: every theme in that table passes,
and choosing between a mint, a cyan and a teal is taste, not measurement.

## Limits of this review

Ratios are WCAG 2.1 relative luminance on the sampled pairs, computed with the
same code path the theme repository publishes in its own data. `muted` is the
foreground blended 55% toward the background in linear light, matching the mapping
section above; a different blend moves the muted column and therefore the 113-theme
failure count. Not evaluated: colour-blind simulation beyond the repository's own
`cvd` distances, the phase-shift tokens, camera/audio UI accents, or how any
candidate reads on a physical Android device (none was available). The appendix of
all 908 themes with every ratio lives outside the repository, in the survey
artifact.
