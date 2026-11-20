# Playwright harness for a stage x phase x state x viewport UI audit

Research date: 2026-11-19. Scope: what Playwright 1.65.1 and axe-core 4.14.1 can do for a deterministic
"stage atlas" audit of the DAEMON // 0 web export (Expo + React Native Web 0.21.4).

## How to read this

- **[doc]**: stated in the primary source linked beside it.
- **[types]**: stated in the installed 1.65.1 type definitions, which are generated from the API docs
  (`node_modules/.pnpm/playwright-core@1.65.1/node_modules/playwright-core/types/types.d.ts`,
  `node_modules/.pnpm/playwright@1.65.1/node_modules/playwright/types/test.d.ts`).
- **[src]**: read in installed package source (react-native-web 0.21.4, axe-core 4.14.1).
- **[probe]**: I ran it in headless Chromium 159 (Playwright 1.65.1) from the scratchpad, against a
  synthetic page or the existing `dist/` export, on my own port, with a fresh profile. Probe scripts:
  `/tmp/claude-1000/-home-william-git-daemon-zero/1c9b44ef-4c39-40d2-b808-73eb2133f953/scratchpad/uireview/probe/`.
- **[unverified]**: my inference or estimate. Not checked against a source or a run.

### What the repo already has

Grounding facts from the repo, read 2026-11-19:

- `@playwright/test` 1.65.1 and `axe-core` 4.14.1 are devDependencies. **`@axe-core/playwright` is NOT
  installed** (`package.json`). The repo injects `node_modules/axe-core/axe.min.js` with
  `page.addScriptTag` and calls `axe.run` in `page.evaluate` (`tests/e2e/axe.ts`). Its rule set is
  `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice`.
- `tests/e2e/config.ts` already defines `phone` (390x844) and `desktop` (1440x900) projects and a
  `sizes` project. It sets `testIdAttribute: 'data-testid'`, `workers: 2`, `trace: 'retain-on-failure'`,
  and serves `dist/` with `python3 -m http.server`.
- Saves are seeded through `page.addInitScript` writing `daemon-zero.save.v1` (`tests/e2e/routeSave.ts`,
  `tests/e2e/helpers.ts`). Readiness is `terminal-screen[aria-busy=false]`, or `ending-screen` for an
  ended run. `tests/e2e/routeStates.ts` already lists 31 engine-built route states.
- `boot()` installs the clock and pauses it (`page.clock.install(); page.clock.pauseAt(Date.now()+1000)`).
  The axe specs deliberately do **not** pause the clock. The comment in `tests/e2e/a11y-audit.e2e.ts`
  says: "axe's own async work never settles against a frozen clock". I reproduced this; see section 3.
- The UI font is the generic `monospace` on web (`src/ui/theme.ts`: `Platform.OS === 'ios' ? 'Menlo' : 'monospace'`).
  It resolves to whatever font the host OS has, which matters for screenshots (section 2).

---

## 1. ARIA snapshots (`toMatchAriaSnapshot`, `ariaSnapshot()`)

**Format.** The snapshot is YAML. Each node is roughly `- role "name" [attribute=value]`. A quoted name
must match exactly, `/pattern/` is a regular expression, brackets hold states (`[checked]`,
`[disabled]`, `[expanded]`, `[level=2]`, `[pressed]`, `[selected]`), and indentation shows nesting.
[doc] https://playwright.dev/docs/aria-snapshots

**Matching rules.** [doc] https://playwright.dev/docs/aria-snapshots

- Matching is case-sensitive and order-sensitive. It normalises whitespace.
- **Partial by default.** Leave out a name or an attribute and that check is skipped (`- button`
  matches any button). By default a template's children only have to *appear in order* (`contain`).
- `/children: equal` requires exactly the listed children at that level. `/children: deep-equal`
  applies the same rule at every nested level. `expect.toMatchAriaSnapshot.children` in the config sets
  the default for every call ([types] `test.d.ts`, the `toMatchAriaSnapshot.children` config key:
  `"contain"|"equal"|"deep-equal"`).
- Names, text and `/url` accept regular expressions, for example `- heading /Issues \d+/`.

**Baselines.** [doc] https://playwright.dev/docs/aria-snapshots

- To keep a snapshot in its own file:
  `await expect(locator).toMatchAriaSnapshot({ name: 'main.aria.yml' })`. It goes in
  `<testfile>-snapshots/` unless `expect.toMatchAriaSnapshot.pathTemplate` says otherwise. The default
  aria template is `{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}`
  ([src] `playwright/lib/worker/workerProcessEntry.js`). Unlike the screenshot template it has no
  platform suffix.
- To update: `npx playwright test --update-snapshots` (`-u`), with modes `missing|changed|all|none`.
  An inline template is rewritten through `--update-source-method=patch|3way|overwrite`.

**Generating snapshots.** `page.ariaSnapshot()` (1.59) and `locator.ariaSnapshot()` return YAML. The
options in 1.65.1 are listed below ([types] `types.d.ts` `ariaSnapshot(options?)`; versions from
[doc] https://playwright.dev/docs/release-notes):

- `boxes: true` (1.60) appends `[box=x,y,width,height]` in viewport CSS pixels taken from
  `getBoundingClientRect()`. This gives geometry for every accessible node in one call.
- `depth`.
- `mode: 'ai'`, which adds `[ref=eN]` references.
- `locator.ariaSnapshotJSON()` / `page.ariaSnapshotJSON()` (1.63) return the same tree as JSON nodes
  `{role, name, text, children, checked, disabled, expanded, level, pressed, selected, url, box?}`.
  [types]

[probe] On a synthetic page, `ariaSnapshot({ boxes: true })` printed
`- button "x" [box=8,66,10,10]` and `- status [box=8,168,374,18]: ok`. On the fresh `dist/` boot screen
one call took about 5 ms.

**1.65 behaviour change.** "Text that the browser does not render ... is no longer part of accessible
names and aria snapshots." This can change `getByRole({ name })` results and snapshot output.
[doc] https://github.com/microsoft/playwright/releases/tag/v1.65.0. Take baselines on 1.65.x and
regenerate them on any Playwright bump.

**Robustness against screenshots.** An aria snapshot ignores pixels, fonts, colours and layout. It
changes only when roles, names, states or structure change, so it does not depend on the platform and
is cheap to diff in review. It cannot see clipping, overlap, contrast, colour or position (unless you
use `boxes`, which brings the platform back in). [inference from the format; the docs make no
comparative claim]

**Fit for "this stage exposes exactly these regions and controls."** Good, with two caveats:

1. Write *structural* templates by hand. Use landmarks, headings and buttons by role, with names as
   regular expressions wherever a number ticks. Pin the top level with `/children: equal` so an extra
   or missing region fails. Do not pin `deep-equal` across the whole page; every log line would become
   a baseline change.
2. Keep live numbers out of names (`/\d+(\.\d+)?\s*cycles/`), or freeze the clock before snapshotting.

```ts
// Stage contract: these regions, in this order, and nothing else at the top level.
await expect(page.getByTestId('terminal-screen')).toMatchAriaSnapshot(`
  - /children: equal
  - banner
  - main:
    - heading /CORE/ [level=2]
    - button /COMPILE/
  - navigation
`);
// Or a file baseline per stage (reviewable YAML in git):
await expect(page.getByTestId('terminal-screen')).toMatchAriaSnapshot({ name: `${stageId}.aria.yml` });
```

The role names in the template above are illustrative. Generate the real ones with `ariaSnapshot()`
first. [unverified for this app]

---

## 2. Visual comparison (`toHaveScreenshot`)

**Mechanics.** "This function will wait until two consecutive page screenshots yield the same result,
and then compare the last screenshot with the expectation." [types] `test.d.ts`, page and locator
variants. On the first run there is no reference: the test fails and writes the actual image.
[doc] https://playwright.dev/docs/test-snapshots

**Options in 1.65.1.** [types] `test.d.ts`; per-option docs at
https://playwright.dev/docs/api/class-pageassertions#page-assertions-to-have-screenshot-1

| option | default | what it does |
|---|---|---|
| `animations` | `"disabled"` | Stops CSS animations, transitions and Web Animations. Finite ones are fast-forwarded to completion; infinite ones are reset to their initial state. **JS/rAF-driven motion is not affected**; freeze it with the clock (section 3). |
| `caret` | `"hide"` | Hides the text caret. |
| `mask` / `maskColor` | — / `#FF00FF` | Paints an opaque box over each locator. The box is also applied to invisible elements. |
| `maxDiffPixels` / `maxDiffPixelRatio` | unset | How many differing pixels are tolerated (a count or a ratio from 0 to 1). |
| `threshold` | `0.2` | Per-pixel YIQ colour tolerance. |
| `stylePath` | — | A CSS file applied during capture. It pierces shadow DOM and frames. Use it to hide volatile elements. |
| `scale` | `"css"` | One pixel per CSS pixel, which keeps HiDPI baselines small. |
| `fullPage`, `clip` | false | Page variant only. |
| `type` (config) / `.webp` name | png | 1.62+ stores lossless WebP when the name ends `.webp`; 1.64 added `expect.toHaveScreenshot.type`. [doc] release notes |

**Cross-platform baselines.**

- "Screenshots differ between browsers and platforms due to different rendering, fonts and more." The
  default file name carries a browser-platform suffix such as `chromium-darwin`.
  [doc] https://playwright.dev/docs/test-snapshots
- The default screenshot template is
  `{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{-snapshotSuffix}{ext}`
  ([src] `workerProcessEntry.js`). `snapshotPathTemplate` has the tokens `{arg} {ext} {platform}
  {projectName} {snapshotDir} {testDir} {testFileDir} {testFileBaseName} {testFileName} {testFilePath}
  {testName}`. A single leading character is emitted only when its token is non-empty, as in
  `{/projectName}`. [types] `test.d.ts` `snapshotPathTemplate`
- This app is especially exposed: it renders in the generic `monospace` family, so a Linux host, a Mac
  and CI can each pick a different face and different metrics. Every glyph-width change shifts the
  whole terminal. [repo fact + inference]

**Docker for stable rendering.** The official image is `mcr.microsoft.com/playwright:v<version>-<distro>`.
Use `--init` "to avoid special treatment for processes with PID=1" and `--ipc=host` because "Without it,
Chromium can run out of memory and crash". [doc] https://playwright.dev/docs/docker. The docs page
itself shows `v1.64.1-noble`. I listed the registry: `v1.65.1-noble`, `-jammy` and `-resolute` exist
(`https://mcr.microsoft.com/v2/playwright/tags/list`, checked 2026-11-19). The image version must match
`@playwright/test`. Remote mode (`playwright run-server` in the container, then
`PW_TEST_CONNECT_WS_ENDPOINT` on the host) runs the browser in the container while the runner stays on
the host. [doc] same page. The Docker page makes no claim about screenshot consistency. Pinning image,
fonts and browser together is the standard reason to use it [unverified, but it follows from the
test-snapshots warning above].

**Recommendation for a 40-80 image atlas.**

- Generate and compare baselines **only inside the pinned image**: `mcr.microsoft.com/playwright:v1.65.1-noble`,
  run with `--init --ipc=host`. Drop `{platform}` from the template, since only one platform produces
  baselines, and refuse to compare outside the container (for example with an env guard).
  `snapshotPathTemplate: '{testDir}/__atlas__/{projectName}/{arg}{ext}'`.
- Store `.webp`, since 80 PNGs of 1440x900 terminal screens bloat the repo [inference].
- Keep `threshold` at 0.2 and use a small `maxDiffPixelRatio` (about `0.001`) instead of
  `maxDiffPixels`, so the bar scales across 390-wide and 1440-wide viewports [recommendation].
- Mask or `stylePath`-hide anything wall-clock driven that the frozen clock does not freeze.
- Treat the visual diff as a **review artifact, not a hard gate** at first. A 60-image diff every time
  copy changes trains people to run `-u` blindly. The aria snapshot and the geometry metrics are the
  hard gates (see the end of this document) [recommendation].

---

## 3. Freezing time (`page.clock`)

**What is faked.** `install()` replaces `Date`, `Temporal.Now`, `setTimeout`/`clearTimeout`,
`setInterval`/`clearInterval`, `requestAnimationFrame`/`cancelAnimationFrame`,
`requestIdleCallback`/`cancelIdleCallback` and `performance`. [types] `Clock.install`;
[doc] https://playwright.dev/docs/clock (the docs also list `Event.timeStamp`). `install` "MUST occur
before any other clock related calls". [doc]

| method | effect [types] |
|---|---|
| `install({ time })` | Fake timers start, and time keeps flowing. |
| `pauseAt(t)` | Jumps to `t` and pauses. "no timers are fired unless runFor, fastForward, pauseAt or resume is called". Fires due timers at most once. |
| `runFor(ms)` | "Advance the clock, firing all the time-related callbacks". Every interval tick and animation frame in the window fires. |
| `fastForward(ms)` | "Only fires due timers at most once", like closing a laptop lid. |
| `resume()` | Time flows again. |
| `setFixedTime(t)` | Only `Date.now()`/`new Date()` are fixed, and "keeps all the timers running". **Not enough to freeze a game loop.** |
| `setSystemTime(t)` | Shifts the wall clock without firing timers. |

The documented recipe is to "install the clock before navigating the page and set it to a time slightly
before the intended test time ... Once the page has fully loaded, you can safely use pauseAt." [types]
`Clock.pauseAt`

**How it treats a rAF + setInterval game loop.** [probe] A page with a self-rescheduling
`requestAnimationFrame` counter and a 100 ms `setInterval` counter gave these readings:

| step | rAF count | interval count |
|---|---|---|
| installed, running, at load | 5 | 1 |
| +500 ms real time, running | 37 | 6 |
| `pauseAt(+5s)` | 38 | 7 |
| +500 ms real time, **paused** | 38 | 7 (frozen) |
| `runFor(1000)` | 101 (+63, about 16 ms frames) | 17 (+10) |
| `fastForward(1000)` | 102 (+1) | 18 (+1) |

So `pauseAt` freezes both kinds of loop. `runFor` replays every frame and tick, so the engine's `advance()`
sees each step. `fastForward` collapses the window into one tick, which is the "returning player"
(offline catch-up) path. `tests/e2e/helpers.ts` notes the matching trap: a resumed clock "fires every
interval tick it missed at once, where a browser drops them".

**Deterministic idle-game render.** [recommendation, built on the facts above]

1. Seed the save with `addInitScript` (existing `seedRouteSave`). Save the envelope with a **fixed**
   `savedAtMs`, not `Date.now()`, and call `clock.install({ time: SAME_FIXED_MS })` so offline catch-up
   is zero and identical on every run. The current helpers write `savedAtMs: Date.now()` against
   `install()` at the real time. That is close to zero but not byte-identical, so check it if numbers
   drift.
2. `goto`, wait for `terminal-screen[aria-busy=false]`, then `pauseAt(fixed + 1000)`.
3. If a stage needs N seconds of play, use `runFor(N*1000)`, then stay paused.
4. `page.emulateMedia({ reducedMotion: 'reduce' })` for any scramble or decrypt effect the app gates on
   it (the repo's `route-motion.e2e.ts` already checks that reduced motion removes them).
   https://playwright.dev/docs/api/class-page#page-emulate-media
5. Take the screenshot, aria snapshot and geometry while paused.

**Pitfall I verified: axe hangs under a paused clock.** [probe] `axe.run(document)` did not settle
within 15 s with the clock paused, and still did not after a `runFor(1000)`. It took about 35 ms with the
clock running or not installed. axe-core 4.14.1 calls `setTimeout` internally (14 occurrences in
`axe.js`). There are two fixes:

- (a) **Swap real timers in just for the axe call.** This works and does not advance game time
  [probe: axe completed, and the page's interval counter stayed at 1 before and after]:

  ```ts
  // Register BEFORE page.clock.install() so it captures the native timers.
  await page.addInitScript(() => {
    (globalThis as any).__realTimers = { setTimeout: setTimeout.bind(globalThis), clearTimeout: clearTimeout.bind(globalThis) };
  });
  // ...later, while paused:
  const result = await page.evaluate(async (opts) => {
    const g = globalThis as any; const fake = { setTimeout: g.setTimeout, clearTimeout: g.clearTimeout };
    Object.assign(g, g.__realTimers);
    try { return await g.axe.run(document, opts); } finally { Object.assign(g, fake); }
  }, { runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] });
  ```

  A probe check: `addInitScript` does not run for `page.setContent()`, so you need a real navigation
  (`goto`), which the harness always has.
- (b) `resume()` for the axe pass and accept drift in the numbers (what the repo does today).
  @axe-core/playwright runs the same `axe.run` inside the page, so it should hang the same way
  [unverified inference].

---

## 4. Geometry checks

**First viewport ("above the fold").**

- `expect(locator).toBeInViewport({ ratio })` uses IntersectionObserver. `ratio` is "The minimal ratio
  of the element to intersect viewport"; `0` (the default) means any positive intersection.
  [doc] https://playwright.dev/docs/api/class-locatorassertions#locator-assertions-to-be-in-viewport
- RN Web panes are often their own `overflow:auto` containers. IntersectionObserver against the
  viewport still clips by ancestor scroll containers [unverified for RN Web; W3C IntersectionObserver
  computes intersection through clipping ancestors, https://www.w3.org/TR/intersection-observer/]. For a
  numeric metric, compute it yourself after the page is settled. Measure without scrolling first,
  because a Playwright action may scroll the element into view.

```ts
const vp = page.viewportSize()!;
const box = await locator.boundingBox();      // page-relative CSS px; null if not visible
const visibleArea = box ? Math.max(0, Math.min(box.x + box.width, vp.width) - Math.max(box.x, 0))
  * Math.max(0, Math.min(box.y + box.height, vp.height) - Math.max(box.y, 0)) : 0;
const firstViewportRatio = box ? visibleArea / (box.width * box.height) : 0;
```

`boundingBox()` returns coordinates "relative to the main frame viewport"
(https://playwright.dev/docs/api/class-locator#locator-bounding-box). If the window has not scrolled,
this is the first viewport.

**Occlusion.** Playwright's actionability check "Receives Events" is "the hit target of the pointer
event at the action point". It applies to click, tap, check and hover, not to screenshot, focus or press.
[doc] https://playwright.dev/docs/actionability. `locator.click({ trial: true })` runs the actionability
checks without clicking
(https://playwright.dev/docs/api/class-locator#locator-click-option-trial), so a pass/fail occlusion
probe is `await btn.click({ trial: true, timeout: 1000 })`. That probe can scroll. For a non-mutating,
per-point metric, use `document.elementFromPoint` at the centre and at the four inset corners
(https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint):

```ts
const occluded = await locator.evaluate((el) => {
  const r = el.getBoundingClientRect(); const pts = [[.5,.5],[.1,.1],[.9,.1],[.1,.9],[.9,.9]];
  return pts.filter(([fx, fy]) => { const hit = document.elementFromPoint(r.left + r.width*fx, r.top + r.height*fy);
    return !(hit && (hit === el || el.contains(hit))); }).length;      // 0 = fully hittable
});
```

**Target size.**

- WCAG 2.5.8 (AA): "at least 24 by 24 CSS pixels". It has exceptions for spacing (24 px diameter circles
  centred on undersized targets must not intersect), equivalent, inline, user-agent control and
  essential. 2.5.5 "uses the larger 44 by 44 CSS pixel measure".
  [doc] https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- axe `target-size` (tags `wcag22aa, wcag258`) is **disabled by default** (`enabled:!1` in
  `axe.min.js` [src]). It runs when `runOnly` names `wcag22aa` [probe]. It implements the spacing
  exception: [probe] two adjacent 10x10 buttons failed `target-size`/`target-offset`, and an isolated
  10x10 button passed through `target-offset`. Its `minSize` option defaults to 24
  ([doc] https://github.com/dequelabs/axe-core/blob/develop/doc/check-options.md). Set
  `checks: { 'target-size': { options: { minSize: 44 } } }` to enforce the 44 px rule
  [unverified syntax for per-check options; see axe API `checks`].
- The repo's own rule is 44 px (`UI-SIZES.md`, `route-sizes.e2e.ts`). Measure it directly with
  `boundingBox()` on every `getByRole('button')` (or read `[box=…]` from `ariaSnapshot({ boxes: true })`)
  and gate it at 44; report 24 as the WCAG floor.

**Truncation and overflow.**

- RN Web `numberOfLines={1}` produces `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`.
  `numberOfLines > 1` produces `display:-webkit-box; -webkit-line-clamp:N; overflow:clip`. [src]
  `react-native-web/dist/exports/Text/index.js`
- So: single line truncated ⇔ `scrollWidth > clientWidth`; clamped ⇔ `scrollHeight > clientHeight`.
  [probe] a 50 px nowrap ellipsis box gave `scrollWidth 139 > clientWidth 50`. MDN:
  https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollWidth
- Page horizontal overflow: `document.documentElement.scrollWidth > innerWidth`. WCAG 1.4.10 Reflow asks
  for no two-dimensional scrolling at "a width equivalent to 320 CSS pixels".
  [doc] https://www.w3.org/WAI/WCAG22/Understanding/reflow.html

**Overlap between elements.** Take boxes for all controls and text runs (from one
`ariaSnapshotJSON({ boxes: true })` walk, or from `evaluateAll` of `getBoundingClientRect`) and test
pairwise rectangle intersection, skipping ancestor/descendant pairs. This is O(n²), which is fine at a
few hundred nodes [recommendation]. The repo's `route-text.e2e.ts` and `large-text.e2e.ts` already do
this kind of check.

---

## 5. Contrast

**axe `color-contrast`.** Tags `cat.color, wcag2aa, wcag143`. Its issue types are "failure, needs review".
[doc] https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md

- **Handled:** opacity and alpha compositing. [probe] black text at `opacity:.5` on white was reported as
  `#808080` on `#ffffff` = 3.94:1, a violation. Text shadows are handled within limits
  (`shadowOutlineEmMax` 0.1 em, `complexTextShadows` goes to incomplete), and so is `-webkit-text-stroke`
  (`textStrokeEmMin`). Large-text thresholds use `largeTextPt` 18 and `boldTextPt` 14 with `boldValue` 700.
  [doc] check-options.md, which matches WCAG's "at least 18 point or 14 point bold"
  (https://www.w3.org/TR/WCAG22/#dfn-large-scale).
- **Returned as `incomplete` (needs review), never as a pass.** These are the messageKeys in the
  installed locale ([src] `axe-core/locales/_template.json`): `bgImage`, `bgGradient`, `imgNode`,
  `bgOverlap`, `complexTextShadows`, `fgAlpha`, `elmPartiallyObscured`, `elmPartiallyObscuring`,
  **`outsideViewport`**, `equalRatio`, `shortTextContent`, `emptyValue`, `nonBmp`, `pseudoContent`,
  `colorParse`. [probe] I reproduced `bgGradient`, `bgImage`, `bgOverlap` (a translucent absolutely
  positioned layer over text) and `shortTextContent`. The last one hit every one-character button
  label.
- **Skipped silently:** `ignoreUnicode: true` by default skips non-BMP/symbol glyph text.
  [doc] check-options.md
- **Off-screen text**: an element scrolled out of its pane comes back `outsideViewport`/incomplete. The
  repo's `axeEachControl` already scrolls each control into view for the same reason
  (`tests/e2e/axe.ts`).

**@axe-core/playwright (if added).** API: `new AxeBuilder({ page })` then `.include()`, `.exclude()`,
`.withTags()`, `.withRules()`, `.disableRules()`, `.options()`, `.setLegacyMode()`, `.analyze()`. It
"automatically injects into all frames". [doc]
https://github.com/dequelabs/axe-core-npm/blob/develop/packages/playwright/README.md;
https://playwright.dev/docs/accessibility-testing. Registry facts, checked 2026-11-19
(`npm view`-equivalent JSON): `latest` 4.14.0 (published 2026-10-15), dependency `axe-core ~4.14.0`,
peer `playwright-core >= 1.0.0`, **license MPL-2.0**. axe-core itself is also MPL-2.0, so the licence
class is already accepted as a devDependency here.

**Recommendation:** do not add it. The repo's direct injection already does the same job with
the same rule tags, and the paused-clock wrapper above needs control of the `axe.run` call anyway.

```ts
// If you do adopt it:
const results = await new AxeBuilder({ page })
  .include('[data-testid="terminal-screen"]')
  .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
  .disableRules(['region'])          // only with a written reason
  .analyze();
```

Note on tags: `runOnly` with several tags is not an AND of the tags. "To run both WCAG 2.0 Level A and
Level AA rules, you must specify both". `resultTypes` limits the *other* result types to one node each,
for speed. [doc] https://github.com/dequelabs/axe-core/blob/develop/doc/API.md. For the incomplete
follow-up below you need `incomplete` in `resultTypes`, which the repo's helper currently excludes
(`resultTypes: ['violations']`).

**Computing contrast for the incomplete nodes.** Use the WCAG formulas: relative luminance
`L = 0.2126R + 0.7152G + 0.0722B`, with each channel `c/12.92` if `c ≤ 0.04045`, else
`((c+0.055)/1.055)^2.4`. Contrast ratio = `(L1 + 0.05)/(L2 + 0.05)`, and values are not rounded
("4.499:1 would not meet"). [doc] https://www.w3.org/TR/WCAG22/#dfn-relative-luminance,
https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio,
https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

Two practical methods [recommendation]:

1. **Computed-style walk.** Read `getComputedStyle(el).color`. Walk ancestors compositing each
   `backgroundColor` with its alpha and multiplying `opacity`, until you reach an opaque colour. This
   resolves `fgAlpha` and simple stacked translucent layers. It cannot resolve gradients or images.
2. **Pixel sampling.** For `bgGradient`, `bgImage` or `bgOverlap`, take a screenshot of the element's
   box twice. The first time, the text is styled `color: transparent` through
   `page.addStyleTag`/`stylePath`, which leaves only the background. Sample the background pixels (all
   of them, then use the **worst** luminance against the text colour). WCAG measures against "the
   specified background over which the text is rendered in normal usage", so the worst point under the
   glyphs is the conservative reading. Decode with a PNG reader in Node, or draw onto a `<canvas>` in
   the page. This is heavier, so run it only on axe's incomplete nodes.

---

## 6. Accessibility-tree checks

- **Names.** `page.getByRole('button', { name: /compile/i })`, `toHaveAccessibleName`,
  `toHaveAccessibleDescription`, `toHaveRole` ("matched as a string, disregarding the ARIA role
  hierarchy"). [doc] https://playwright.dev/docs/api/class-locatorassertions. Since 1.60, `getByRole`
  also accepts `description`. [doc] release notes
- **Live regions for timely events.** `status` has an implicit `aria-live` of polite and `aria-atomic`
  true. `alert` defaults to assertive and atomic. `log` defaults to polite, and new items are added at
  the end. [doc] https://www.w3.org/TR/wai-aria-1.2/#status, #alert, #log. RN Web maps
  `accessibilityLiveRegion`/`aria-live` to `aria-live`, with `'none'` mapped to `'off'`. [src]
  `createDOMProps`. Assertion pattern: before the event, the region exists (the region itself must be
  present before content is injected for screen readers to announce it [unverified, common AT
  behaviour, not in the ARIA spec text I read]). After `runFor`, `await expect(page.getByRole('status'))
  .toContainText(...)`. Also assert the region is in the first viewport, which is the "main view holds
  the timely info" metric.
- **Focus order.** Loop `page.keyboard.press('Tab')`
  (https://playwright.dev/docs/api/class-keyboard#keyboard-press). After each press, read
  `document.activeElement`: its `data-testid`, role, name and `getBoundingClientRect()`. Stop when the
  first id repeats or a cap is reached. Hard checks: every enabled control is reached; the focused box
  is not *entirely* hidden by author content (WCAG 2.4.11: "not entirely hidden due to author-created
  content", https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html); and DOM
  order roughly follows visual order (top-to-bottom, then left-to-right, within a tolerance) as a
  reported metric. The repo's `route-keyboard.e2e.ts` already does reachability and the focus ring.
  Reuse it rather than duplicate it.

```ts
const order: { id: string | null; name: string; y: number; x: number }[] = [];
for (let i = 0; i < 80; i++) {
  await page.keyboard.press('Tab');
  const f = await page.evaluate(() => { const e = document.activeElement as HTMLElement | null; if (!e || e === document.body) return null;
    const r = e.getBoundingClientRect(); return { id: e.getAttribute('data-testid'), name: e.getAttribute('aria-label') ?? e.innerText.slice(0, 40), y: r.top, x: r.left }; });
  if (!f || (order.length && f.id === order[0]!.id)) break;
  order.push(f);
}
```

The focus loop moves no game time, but each press is a round trip; keep it to one pass per state, not
one per viewport per check.

---

## 7. Reporting: per-stage artifacts and an HTML atlas

- `testInfo.attach(name, { body | path, contentType })` adds an attachment to the HTML report and to
  `TestResult.attachments` for reporters. A string body defaults to `text/plain`.
  [types] `TestInfo.attach`, `testReporter.d.ts` `attachments`. `testStepInfo.attach` attaches to a
  step (1.51+). https://playwright.dev/docs/api/class-testinfo#test-info-attach
- **Custom reporter.** Implement `onBegin`, `onTestEnd(test, result)` and `onEnd`, and register it
  alongside the defaults: `reporter: [['list'], ['html', { open: 'never' }], ['./atlas-reporter.ts']]`.
  [doc] https://playwright.dev/docs/test-reporters. In `onTestEnd`, read
  `result.attachments` (screenshot path, `aria.yml`, `metrics.json`) and
  `test.parent.project()?.name` for the viewport. In `onEnd`, write one static `atlas/index.html` that
  shows a grid of stage rows and viewport columns, each cell with its thumbnail, a metrics badge and a
  link to the aria YAML [recommendation]. `json` reporter output (`outputFile`) is an alternative input
  for a standalone generator script. [doc] same page
- **Sharded runs.** Use `reporter: 'blob'` on each shard, then
  `npx playwright merge-reports --reporter html ./blob-report`. Blob reports "contain all the details
  ... and can be used later to produce any other report", attachments included. A custom reporter
  passed to `merge-reports --reporter` sees the merged attachments [doc for blob/merge; the custom
  reporter on merge is my inference]. https://playwright.dev/docs/test-sharding
- **Trace viewer.** `trace: 'retain-on-failure'` (already set). 1.63 traces can "record aria and screen
  snapshots on every action", and the viewer has a "Display Aria" mode. [doc] release notes. For the
  atlas, an explicit attach is better than a trace, which is heavy and a poor gallery input.
- **Soft failures for metrics.** `expect.soft(...)` records a failure and continues, so a single test
  can report every budget breach for a stage. https://playwright.dev/docs/test-assertions#soft-assertions
- 1.65 added a `failures` reporter and `onlyFailures` for html/json/junit. Do **not** use `onlyFailures`
  for the atlas run, because it drops the passing cells the gallery needs. [doc]
  https://github.com/microsoft/playwright/releases/tag/v1.65.0

```ts
await testInfo.attach('screen', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
await testInfo.attach('aria', { body: await page.ariaSnapshot(), contentType: 'text/yaml' });
await testInfo.attach('metrics', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
```

---

## 8. React Native Web specifics (0.21.4, read from installed source)

- **testID → `data-testid`.** [src] `modules/createDOMProps/index.js`: `domProps['data-testid'] = testID`.
  The repo's config sets `testIdAttribute: 'data-testid'`, which is also the default.
- **Roles.** `role`/`accessibilityRole` → the `role` attribute. RN-only roles map as follows:
  `button→button`, `header→heading`, `image→img`, `adjustable→slider`, `link→link`, `summary→region`,
  `none→presentation`, `search→search`. **`text`, `label`, `imagebutton` and `keyboardkey` emit no role**.
  [src] `AccessibilityUtil/propsToAriaRole.js`
- **Native elements.** `createElement` swaps the tag for a role: button→`<button>`, heading→`<hN>`
  (`aria-level`, default `h1`), main→`<main>`, navigation→`<nav>`, banner→`<header>`,
  complementary→`<aside>`, contentinfo→`<footer>`, region→`<section>`, list→`<ul>`,
  listitem→`<li>`, paragraph→`<p>`, form→`<form>`. [src] `propsToAccessibilityComponent.js`,
  `exports/createElement/index.js`
  - A heading with no level renders `<h1>`. Many unlevelled headings flatten the outline, so assert
    `[level=N]` in snapshots.
  - `role="button"` (or any role in `button/checkbox/link/radio/textbox/switch`) gets `tabIndex=0`
    unless `focusable={false}`. A disabled native control gets `tabIndex=-1`. [src] `createDOMProps`
- **Text is a `div` (or a `span` inside another Text) with `dir="auto"`**, with no role. [src]
  `exports/Text/index.js`. So:
  - `getByRole('paragraph')` finds nothing unless `role="paragraph"` is set. Use `getByText`/test ids
    for text, and role queries only for interactive elements and landmarks.
  - axe evaluates contrast per text node, so a div is no problem. One-character labels (`[x]`, `▶`) hit
    `shortTextContent`/`nonBmp` and come back incomplete, not passing (see section 5).
  - A View with `onPress` but no `role` is a plain div. It is invisible to `getByRole('button')` and to
    the Tab loop. Count elements with `cursor:pointer` but no role as a "hidden action" finding
    [recommendation].
- **Styles are atomic classes.** RN Web compiles styles to generated class names
  (`r-…`/`css-…`), so class selectors are useless. Read final values with
  `locator.evaluate(e => getComputedStyle(e).color)` or
  `expect(locator).toHaveCSS('color', 'rgb(…)')`
  (https://playwright.dev/docs/api/class-locatorassertions#locator-assertions-to-have-css). I saw the
  class-name pattern in the RN Web DOM, but it is not documented as API, so do not depend on it
  [unverified as a contract].
- Live regions: `accessibilityLiveRegion`/`aria-live` → `aria-live` (see 6). `aria-*` props pass
  through as written; the `accessibility*` props are their aliases. [src] `createDOMProps` `_excluded`
  list.

---

## 9. Performance budget

[probe] I timed the existing `dist/` fresh-boot screen in headless Chromium, 3 runs per viewport, on a
new context each time:

| step | 390x844 | 1440x900 |
|---|---|---|
| context + `goto` + ready (`aria-busy=false`) + `pauseAt` | 177-186 ms | 176-185 ms |
| inject axe + `axe.run` (wcag2a/aa/21aa/22aa, real-timer swap) | 119-127 ms | 122-128 ms |
| `page.screenshot` (viewport) | 11-18 ms | 22-29 ms |
| `ariaSnapshot({ boxes:true })` | 4-5 ms | 5-8 ms |

That screen is tiny (a 10-12 line aria tree). [estimate, unverified] A late-phase state has a much
larger DOM. Budget each combination (stage x viewport) at:

- boot and seed: 0.3-0.6 s, plus the Node-side `importSave`/`serialize` of the fixture.
- axe: 0.3-1.5 s, more if each control is scrolled into view and audited separately.
- `toHaveScreenshot`: 0.1-0.5 s, since it takes at least two captures until stable.
- geometry and truncation `evaluate`: under 0.1 s.
- Tab loop: about 20-40 ms per press × controls.
- worker start-up: amortised.

That comes to roughly 1-4 s per combination. About 60 combinations is 1-4 minutes of serial work, or
**about 0.5-2 minutes with the repo's `workers: 2`**. That fits the existing 60 s per-test timeout with a
wide margin. Measure the first real run and record it rather than trusting this estimate.

Scaling options [doc] https://playwright.dev/docs/test-sharding:

- One **project per viewport**, already the repo's pattern.
- `fullyParallel: true` (already set) lets sharding split at test level, not file level.
- `--shard=i/n` with the blob reporter and `merge-reports` in CI.
- Generate one test per stage from a data table (`for (const s of STAGES) test(s.id, …)`) so shards
  balance and `-g` selects a stage.
- `scripts/e2e-lock.sh` gives each suite its own port. Run the atlas through it (AGENTS.md).

---

## Recommended harness architecture

**Config (`tests/e2e/config.ts`, or a dedicated `tests/e2e/atlas.config.ts`)**

- Projects: one per viewport, for example `atlas-320x568`, `atlas-390x844`, `atlas-768x1024`,
  `atlas-1440x900`. All match `**/*.atlas.ts` and are kept out of the existing `phone`/`desktop`
  projects so the default `make e2e` stays the same size.
- `use`: `testIdAttribute: 'data-testid'`, `deviceScaleFactor: 1`, `colorScheme` pinned,
  `reducedMotion` per state (a state can opt into `'reduce'`), `trace: 'retain-on-failure'`.
- `expect.toHaveScreenshot`: `{ animations: 'disabled', caret: 'hide', scale: 'css', threshold: 0.2,
  maxDiffPixelRatio: 0.001, type: 'webp', stylePath: 'tests/e2e/atlas.css' }`.
- `expect.toMatchAriaSnapshot`: `{ pathTemplate: '{testDir}/__atlas__/aria/{arg}{ext}' }`, with no
  platform or project in the path so one YAML file serves every viewport where the structure is shared.
  Use `{projectName}` only for the stages whose structure differs by tier (the phone has no kernel band).
- `snapshotPathTemplate: '{testDir}/__atlas__/screens/{projectName}/{arg}{ext}'`. Screenshots are
  generated and compared only in `mcr.microsoft.com/playwright:v1.65.1-noble` (`--init --ipc=host`).
- Reporters: `list` (or `github` on CI), `html`, and `./atlas-reporter.ts`. Use `blob` when sharded.

**Data: `tests/e2e/atlasStages.ts`.** Extend, do not fork, `routeStates.ts`. Each entry is
`{ id, disclosureStage, phase, special?, state(): GameState, pane?, area?, prepare?, contract }`. The
`contract` names the regions and controls this stage must expose: a hand-written aria template and a
list of `mustBeAboveFold` and `mustBeActionable` test ids, each with a reason. States are built through
public engine actions, the same as `routeStates.ts`.

**Fixture: `atlasState`.** It extends the repo's `test` (keeping the `cleanConsole` auto fixture).

1. `addInitScript` captures the real `setTimeout`/`clearTimeout` (before `clock.install`).
2. `clock.install({ time: FIXED })`, then seed the save with `savedAtMs: FIXED` through
   `seedRouteSave`.
3. `goto('./')`, wait for `terminal-screen[aria-busy=false]` (or `ending-screen`), then
   `clock.pauseAt(FIXED + 1000)`.
4. Run the entry's `prepare`. Use `runFor` if the stage needs elapsed play, then stay paused.
5. Hand the test a ready `page`.

**Audit helper: `audit(page, stage): Promise<StageMetrics>`.** One call, no assertions inside, run
while paused:

```ts
interface StageMetrics {
  stage: string; viewport: { width: number; height: number };
  regions: string[];                                    // top-level roles/names from ariaSnapshotJSON
  controls: { id: string | null; role: string; name: string; box: Box; inFirstViewport: number; // ratio 0..1
              occludedPoints: number; minSide: number; enabled: boolean }[];
  timely: { id: string; inFirstViewport: number; liveRegion: 'off'|'polite'|'assertive'|null }[];
  truncated: { id: string | null; text: string; axis: 'x'|'y' }[];
  overlaps: [string, string][];
  pageOverflowX: number;                                // documentElement.scrollWidth - innerWidth
  hiddenActions: number;                                // cursor:pointer with no role
  axe: { violations: Finding[]; contrastIncomplete: { target: string; reason: string; measured?: number }[] };
  focus: { order: string[]; unreached: string[]; obscured: string[] };
}
```

Then attach `screen` (png/webp), `aria` (yaml) and `metrics` (json) through `testInfo.attach`.

**Hard gates (fail the test).**

- The aria contract: `toMatchAriaSnapshot` with `/children: equal` at the top level. It ignores
  platform and fonts, so it is a reliable gate.
- Every `mustBeActionable` control is enabled, has `occludedPoints === 0`, and is at least 44 px on its
  shorter side (the repo's rule; WCAG 2.5.8's 24 px is the floor below it).
- Every `mustBeAboveFold` id (the stage's timely info and primary action) has `inFirstViewport ≥ 0.5`
  at the project's viewport.
- `pageOverflowX === 0`, with no overlaps between controls or text runs, and no truncated text inside
  a control's accessible name.
- axe violations === 0 (`wcag2a/2aa/21a/21aa/22aa`).
- Every enabled control of the stage is reached by Tab, and none is entirely hidden when focused.
- The console is clean (the existing `cleanConsole` fixture).

**Reported metrics (`expect.soft`, or attach only).**

- Visual diff against the atlas baseline. It starts report-only and becomes a gate once the Docker
  baseline flow is routine.
- Contrast for axe-incomplete nodes, computed by the style walk or pixel sampling, with the
  worst-case ratio listed.
- Focus-order versus visual-order inversions, the count of controls below the fold, the count of
  hidden actions, and the live-region coverage of timely items.
- Tab-stop count and the scroll distance to the furthest required control.

### Pitfalls

1. **axe never finishes under a paused `page.clock`** [probe]. Swap real timers in for the call, or
   resume. A hang looks like a test timeout, not an axe error.
2. `setFixedTime` does not stop timers; only `pauseAt` does. `runFor` replays every rAF and interval
   tick; `fastForward` fires each due timer once. Pick the one that matches the player path you mean.
3. `animations: 'disabled'` stops only CSS and Web Animations. JS/rAF scramble or typewriter effects
   need the paused clock or `reducedMotion`.
4. Install the clock before `goto`, and pause only after the app is ready. Pausing during boot can stall
   the boot sequence [doc, `pauseAt` note].
5. `addInitScript` runs on navigation, not on `setContent` [probe].
6. The `helpers.ts` `boot()` writes the save only if storage is empty. Two states on one page silently
   re-measure the first (#138 in the repo). Use one context per state.
7. Generic `monospace` makes screenshots host-dependent. Compare baselines only in the pinned Docker
   image, and never commit baselines generated on a laptop.
8. axe `target-size` is off unless `wcag22aa` is in `runOnly` [src+probe], and it applies the 24 px
   spacing exception, so it will not enforce the repo's 44 px rule. Measure that yourself.
9. axe marks gradient, image, overlap, off-viewport, one-character and symbol text as **incomplete**.
   The repo helper keeps only `violations`, so those nodes currently disappear from the report. Request
   `incomplete` and follow up on it.
10. Off-screen controls inside RN Web scroll panes are skipped by contrast and by
    `label-content-name-mismatch` until scrolled into view (`tests/e2e/axe.ts` header). Scrolling
    changes "first viewport" metrics, so take the geometry first and audit after.
11. RN Web Text has no role. A pressable View without `role` is neither a button nor a tab stop.
    Unlevelled headings all become `<h1>`.
12. Playwright 1.65 changed accessible-name computation (unrendered text dropped). Regenerate aria
    baselines on every Playwright bump and review the diff.
13. `toBeInViewport` passes on any 1 px intersection by default. Always pass `ratio`.
14. A one-off `-u` across 60 screenshots hides regressions. Require the diff images in the PR, and keep
    the visual check report-only until the baseline process is trusted.
15. `@axe-core/playwright` and `axe-core` are MPL-2.0 (the project is MIT). axe-core is already a
    devDependency, so this is not new, but record it if the wrapper is added.

### Open items not verified here

- Exact `checks` option syntax for raising axe `target-size` `minSize` to 44.
- Whether `@axe-core/playwright`'s `analyze()` hangs under a paused clock (inferred from the shared
  `axe.run`).
- Real per-combination timings on late-phase states. The probe measured only the fresh boot screen.
- IntersectionObserver behaviour against RN Web's nested scroll containers.
