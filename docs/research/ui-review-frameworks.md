# Design-evaluation frameworks for the DAEMON // 0 systematic UI review

Research date: 2026-11-19. Scope: which well-regarded evaluation frameworks should anchor a
review of every disclosure stage x game phase x viewport (phone 390x844, desktop), and how
each turns into checks a Playwright suite or a multi-model panel can run.

Conventions used below:

- **AUTO** means a Playwright (or axe-core, or screenshot/pixel) check can decide pass/fail.
- **JUDGMENT** means a human or LLM panel decides, ideally from a screenshot plus the DOM/a11y
  snapshot of that exact stage.
- **Project-set** marks a threshold that the cited source does not give; the number is a
  proposal for this project, not a claim about the source.
- **Unverified** marks anything I could not confirm at a primary source.
- "Stage" means one disclosure stage (a set of unlocked widgets) inside one game phase, on one
  viewport.

---

## 1. Nielsen's 10 usability heuristics, severity scale, and how heuristic evaluation is run

**Summary.** Jakob Nielsen's ten heuristics (first published 1994, last reviewed by NN/g on
2024-01-30) are: (1) visibility of system status, (2) match between system and the real world,
(3) user control and freedom, (4) consistency and standards, (5) error prevention, (6) recognition
rather than recall, (7) flexibility and efficiency of use, (8) aesthetic and minimalist design,
(9) help users recognize, diagnose and recover from errors, (10) help and documentation
([NN/g, Nielsen, "10 Usability Heuristics"](https://www.nngroup.com/articles/ten-usability-heuristics/)).
Severity is rated 0-4: 0 "I don't agree that this is a usability problem at all", 1 "Cosmetic
problem only", 2 "Minor usability problem", 3 "Major usability problem: important to fix", 4
"Usability catastrophe: imperative to fix this before product can be released"; severity combines
frequency, impact and persistence, with market impact considered too. Ratings must be made
independently, "severity ratings from a single evaluator are too unreliable to be trusted", and
"the mean of a set of ratings from three evaluators is satisfactory for many practical purposes"
([NN/g, Nielsen, "Severity Ratings"](https://www.nngroup.com/articles/how-to-rate-the-severity-of-usability-problems/)).
On process: "three to five people should independently evaluate the same interface", each
timeboxed to about 1-2 hours, in two passes (first to learn the product, second to find
violations), without seeing each other's notes until done, then consolidated by clustering
([NN/g, "How to Conduct a Heuristic Evaluation"](https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/)).
"Single evaluators found only 35 percent of the usability problems", and Nielsen recommends
"about five evaluators, but certainly at least three"
([NN/g, Nielsen, "Theory of Heuristic Evaluations"](https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/theory-heuristic-evaluations/)).
(The often-quoted "five evaluators find about 75%" figure is shown only as an unlabeled curve on
that page: unverified as a number.)

**How it maps to an LLM panel.** Each model is one evaluator: give each the same stage
screenshot + a11y snapshot + heuristic list, no access to the others' output; two passes (a
"describe what you see and what you would do" pass, then a violations pass); cluster findings;
each seat then rates every clustered finding 0-4 independently; report the mean and keep only
findings with mean >= 2 as fix candidates. Minimum three seats per stage, five preferred.

| Heuristic / criterion | How to check | Pass threshold |
|---|---|---|
| H1 Visibility of system status: every action produces visible feedback | AUTO: click each enabled action, record `performance.now()` to first DOM mutation inside the target widget or log (MutationObserver) | Visible change <= 100 ms (Nielsen 0.1 s limit, see section 7); hard fail > 1 s |
| H1 Current resources, threats and progress are visible without navigation | AUTO: for each stage, assert the state readouts the engine marks as live are in the viewport and not occluded (`elementFromPoint` at the readout centre returns the readout) | 100% of required readouts visible at load, phone and desktop |
| H2 Match with real world: wording uses the player's concepts, natural order | JUDGMENT | Panel mean severity < 2 |
| H3 User control and freedom: every modal/overlay has a clear exit | AUTO: for each modal, assert a visible close/back control and that Escape (desktop) or Android back dismisses it | 100% of modals |
| H4 Consistency: same function, same label and style across stages | AUTO: collect accessible name + computed style per `testID` across all stage snapshots; diff | 0 label changes for an unchanged function; 0 style drift for a component class |
| H5 Error prevention: irreversible actions confirm first | AUTO for a declared list of destructive actions (assert confirm step appears); JUDGMENT to decide which actions are destructive | 100% of declared destructive actions |
| H6 Recognition over recall: costs, requirements and the reason an action is unavailable are shown next to it | AUTO: every disabled/locked action has visible adjacent reason text or `aria-describedby` with non-empty text | 100% |
| H7 Flexibility/efficiency: shortcuts for repeated actions without burdening novices | JUDGMENT (AUTO only for presence of keyboard shortcuts on desktop) | Panel mean < 2 |
| H8 Aesthetic and minimalist design: nothing irrelevant competes with essentials | JUDGMENT, supported by AUTO counts from section 7 (visible controls, live numbers) | Panel mean < 2 |
| H9 Errors recognized, diagnosed, recovered | AUTO: trigger known failure states (insufficient resources, failed action) and assert a plain-text message appears; JUDGMENT on wording | Message present 100%; wording mean < 2 |
| H10 Help and documentation is findable and task-focused | JUDGMENT; AUTO that a help/glossary entry exists for each widget introduced | Every widget has help text |

---

## 2. Cognitive walkthrough (Wharton, Rieman, Lewis, Polson)

**Summary.** A cognitive walkthrough steps through a defined task screen by screen and asks, at
each step: (1) "Will users try to achieve the right result?" (2) "Will users notice that the
correct action is available?" (3) "Will users associate the correct action with the result they're
trying to achieve?" (4) "After the action is performed, will users see that progress is made toward
the goal?"; "a 'No' on any question fails the step". It is "most effective for systems with complex,
new, or unfamiliar workflows" and targets learnability for first-time users
([NN/g, "Evaluate Interface Learnability with Cognitive Walkthroughs"](https://www.nngroup.com/articles/cognitive-walkthroughs/)).
The originating papers are Lewis, Polson, Wharton & Rieman, "Testing a walkthrough methodology for
theory-based design of walk-up-and-use interfaces", CHI '90, pp. 235-242
([DOI 10.1145/97243.97279, Crossref-verified](https://doi.org/10.1145/97243.97279)) and Wharton,
Rieman, Lewis & Polson, "The cognitive walkthrough method: a practitioner's guide", in Nielsen & Mack
(eds.), *Usability Inspection Methods*, Wiley 1994
([book page, NN/g](https://www.nngroup.com/jakob/inspectbook.html)). The 1994 original phrasing
("Will the user try to achieve the right effect?" ...) is reported by
[usabilitybok.org](https://usabilitybok.org/print/cognitive-walkthrough) citing p. 106; I did not
read the chapter itself, so the exact 1994 wording is unverified at primary.

**Why it fits an unfolding UI.** Progressive disclosure means every new stage is, by construction,
a "new or unfamiliar" interface for a player who has never seen it. Each unlock is a natural
walkthrough step: the player's goal (survive, expand, stay hidden) is known, a new widget appears,
and the four questions ask exactly whether the player will notice it, understand it, and see the
effect. Run one walkthrough per unlock event, with the before/after screenshots as the "screen".

| Criterion | How to check | Pass threshold |
|---|---|---|
| Q1 Goal: at this stage the player has a reason to want the new capability | JUDGMENT: panel given the persona ("first-time player, has read nothing"), the prior log lines and the stage screenshot | All seats answer yes, or mean severity < 2 |
| Q2 Notice: the newly unlocked control is visible and draws attention | AUTO precondition: the new element is in the initial viewport (phone and desktop), not occluded, and has an unlock cue (highlight, log line or status message). JUDGMENT for salience | AUTO 100%; JUDGMENT all yes |
| Q3 Associate: label/affordance connects to the goal | AUTO precondition: accessible name non-empty, not a generic word (see section 3). JUDGMENT for meaning | AUTO 100%; JUDGMENT all yes |
| Q4 Progress: after the action, the effect is visible | AUTO: after activating, some readout tied to that action changes within 1 s (or a log line appears); JUDGMENT that the change is legible as progress | AUTO 100%; JUDGMENT all yes |

---

## 3. Progressive disclosure and information scent / information foraging

**Summary.** Progressive disclosure "defers advanced or rarely used features to a secondary
screen". Two requirements: get the split right (everything frequently needed up front, the initial
display not crowded) and make the progression obvious: "It must be obvious how users progress
from the primary to the secondary disclosure levels", with labels that give strong "information
scent". Staged disclosure (a linear sequence the user moves through, like a wizard) is distinguished
from progressive (hierarchical). Designs beyond two levels "typically have low usability because
users often get lost when moving between the levels"
([NN/g, Nielsen, "Progressive Disclosure"](https://www.nngroup.com/articles/progressive-disclosure/)).
Note that DAEMON's unlock-over-time model is closer to *staged* disclosure across the game, with
*progressive* disclosure (panels, modals, expanders) inside each stage; the two-level rule applies
to the latter. Information scent is "the user's imperfect estimate of the value that the source
will deliver"; it comes from the label, surrounding content and context, and vague labels like
"More" or "Learn more" give little to go on
([NN/g, Budiu, "Information Scent"](https://www.nngroup.com/articles/information-scent/)). The
underlying theory is Pirolli & Card, "Information foraging", *Psychological Review* 106(4):643-675,
1999 ([DOI 10.1037/0033-295X.106.4.643, Crossref-verified](https://doi.org/10.1037/0033-295X.106.4.643));
I could not read the full text, so I rely on the NN/g account for definitions (abstract content
unverified at primary).

| Criterion | How to check | Pass threshold |
|---|---|---|
| Frequently needed controls are at the primary level | AUTO: per stage, list actions the sim bot (or a recorded playthrough) uses most; assert they are reachable with 0 clicks (visible in main view) | Top-N actions (N project-set, e.g. 5) at level 0 |
| Disclosure depth | AUTO: crawl expanders/modals/tabs; compute clicks needed to reach every actionable control | Max depth <= 2 (NN/g) |
| Path to secondary level is obvious | AUTO precondition: every expander/tab has a non-empty, specific label; JUDGMENT on scent | 100% labelled; panel mean < 2 |
| Labels carry scent (not generic) | AUTO: lint accessible names against a deny-list ("More", "Info", "Details", "Open", "Click", "...", icon-only without name) | 0 hits |
| Initial display not crowded | AUTO counts (section 7) + JUDGMENT | Within project-set budgets |
| A newly disclosed element is announced | AUTO: on unlock, a log entry or status message (`role=status`/`aria-live`) appears and the element is in view | 100% of unlocks |
| Disclosed content does not displace timely info | AUTO: after each unlock, re-run the "timely readouts visible" check | No regression |

---

## 4. Game-specific heuristics (PLAY, Hodent, Federoff, Pinelle)

Source status at a glance:

| Framework | Source read | Primary? |
|---|---|---|
| HEP (Desurvire, Caplan, Toth 2004) | Full paper, ACM format, third-party mirror | Primary (mirror) |
| PLAY (Desurvire, Wiberg 2009) | Authors' manuscript (not the Springer version) | Primary manuscript; final wording unverified |
| Hodent, *The Gamer's Brain* (CRC Press 2017) | Her own site and GDC talk pages; book not read (paywalled) | Primary for pillar names; book text unverified |
| Federoff 2002 | Full MS thesis PDF (course mirror) | Primary (mirror) |
| Pinelle, Wong, Stach 2008 | Full paper via Wayback copy of a course mirror | Primary (mirror) |

**HEP and PLAY (Desurvire et al.).** HEP is Desurvire, Caplan & Toth, "Using heuristics to evaluate
the playability of games", CHI '04 EA, pp. 1509-1512
([DOI 10.1145/985921.986102](https://doi.org/10.1145/985921.986102); full text read at
[hci.rwth-aachen.de mirror](https://hci.rwth-aachen.de/materials/conferences/CHI2004/2p1509.pdf)),
with four categories: Game Play, Game Story, Mechanics, Usability. UI-relevant items: "A player
should always be able to identify their score/status and goal in the game"; "Provide immediate
feedback for user actions"; "The Player experiences the user interface as consistent (in control,
color, typography, and dialog design) but the game play is varied"; "Upon initially turning the
game on the Player has enough information to get started to play"; "Players should be given context
sensitive help while playing so that they do not get stuck"; "The interface should be as
non-intrusive to the Player as possible"; "The first player action is painfully obvious and should
result in immediate positive feedback". PLAY is Desurvire & Wiberg, "Game Usability Heuristics
(PLAY) for Evaluating and Designing Better Games: The Next Iteration", HCII 2009, LNCS 5621,
pp. 557-566 ([DOI 10.1007/978-3-642-02774-1_60](https://doi.org/10.1007/978-3-642-02774-1_60),
paywalled); read as the authors' manuscript at
[ocw.metu.edu.tr](https://ocw.metu.edu.tr/pluginfile.php/4129/mod_resource/content/0/ceit706_2/10/game_usability-_heuristics.pdf).
It derived 48 heuristics from 116 candidates by having 54 gamers rate high- vs low-ranked games, in
three top-level categories: Game Play; Coolness/Entertainment/Humor/Emotional Immersion; Usability &
Game Mechanics. UI-relevant items: "Player does not need to read the manual or documentation to
play"; "Status score Indicators are seamless, obvious, available and do not interfere with game
play"; "Game provides feedback and reacts in a consistent, immediate, challenging and exciting way";
"The game does not put an unnecessary burden on the player"; "Screen layout is efficient,
integrated, and visually pleasing"; "Art is recognizable to the player and speaks to its function";
"Navigation is consistent, logical and minimalist"; "Player error is avoided"; "Upon turning on the
game, the player has enough information to begin play"; and (Game Play) "The first ten minutes of
play and player actions are painfully obvious and should result in immediate and positive feedback
for all types of players". Caveat: "player should not have to memorize" is often attributed to PLAY
but is not in the manuscript; the closest is that players "preferred games that rewarded skill and
did not rely on rote memory". The manuscript's "Terminology" sub-heading duplicates its Goals text,
so do not cite it.

**Celia Hodent (Game UX = Usability + Engage-ability).** From her own site: "Game UX = Usability +
Engage-ability"; usability heuristics "Signs and feedback", "Clarity", "Form follows function",
"Consistency", "Minimum workload", "Error prevention and recovery", "Flexibility and accessibility"
([celiahodent.com, Fortnite UX article, 2019](https://celiahodent.com/understanding-the-success-of-fortnite-ux/));
the 2014 talk transcript names the seventh just "Flexibility" and defines signs and feedback as
"give meaningful information about the system"
([celiahodent.com, UX practices at Epic Games](https://celiahodent.com/ux-practices-epic-games/));
her GDC15 page includes slides "Attention: Minimum Workload" and "Reduce Memory Load"
([celiahodent.com, The Gamer's Brain](https://celiahodent.com/the-gamers-brain/)). Engage-ability
pillars: "Motivation", "Emotion", "Game flow"
([celiahodent.com, GDC17 talk](https://celiahodent.com/gamers-brain-part-3-ux-engagement-immersion-retention-gdc17-talk/)).
Book: Hodent, *The Gamer's Brain: How Neuroscience and UX Can Impact Video Game Design*, CRC Press,
2017 (DOI 10.1201/9781315154725; not read, paywalled, so the book's own definitions are unverified).

**Federoff (2002).** M.S. thesis, Indiana University, "Heuristics and Usability Guidelines for the
Creation and Evaluation of Fun in Video Games"
([PDF, ocw.metu.edu.tr](https://ocw.metu.edu.tr/pluginfile.php/2510/mod_resource/content/0/ceit706_2/10/MelissaFederoff_Heuiristics.pdf)).
Heuristics tagged Game Interface / Game Mechanics / Game Play. Interface items include "Minimize
control options", "The interface should be as non-intrusive as possible", "A player should always
be able to identify their score/status in the game", "Interfaces should be consistent in control,
color, typography, and dialog design", "Minimize the menu layers of an interface", "Do not expect
the user to read a manual", "Provide means for error prevention and recovery through the use of
warning messages"; mechanics: "Feedback should be given immediately to display user control"; play:
"The game should give hints, but not too many", "Teach skills early that you expect the players to
use later".

**Pinelle, Wong & Stach (2008).** "Heuristic evaluation for games: usability principles for video
game design", CHI '08, pp. 1453-1462 ([DOI 10.1145/1357054.1357282](https://doi.org/10.1145/1357054.1357282);
read via [Wayback copy of a course mirror](https://web.archive.org/web/2020/https://course.ccs.neu.edu/is4300f15/ssl/pinelle-chi08.pdf)),
derived from 108 GameSpot reviews (285 problems). The ten, verbatim: (1) "Provide consistent
responses to the user's actions." (2) "Allow users to customize video and audio settings,
difficulty and game speed." (3) "Provide predictable and reasonable behavior for computer controlled
units." (4) "Provide unobstructed views that are appropriate for the user's current actions" (5)
"Allow users to skip non-playable and frequently repeated content." (6) "Provide intuitive and
customizable input mappings." (7) "Provide controls that are easy to manage, and that have an
appropriate level of sensitivity and responsiveness." (8) "Provide users with information on game
status." (9) "Provide instructions, training, and help." (10) "Provide visual representations that
are easy to interpret and that minimize the need for micromanagement." Pinelle is the most
evidence-based and usability-focused of the four and maps best to Nielsen-style evaluation; #10
(micromanagement) is directly relevant to idle games.

| Criterion (sources) | How to check | Pass threshold |
|---|---|---|
| Status/score and goal always identifiable (HEP Mechanics 3; PLAY B2; Federoff; Pinelle 8) | AUTO: same as A1 in rubric (timely readouts in viewport); plus an objective/next-goal element present | 100% of stages |
| Status indicators do not interfere with play (PLAY B2; HEP/Federoff "non-intrusive") | AUTO: status elements never overlap actionable controls (bounding-box intersection) | 0 overlaps |
| Immediate, consistent feedback (HEP U1; PLAY C1; Pinelle 1; Hodent signs and feedback) | AUTO: click-to-mutation timing and same feedback pattern for the same action class | <= 100 ms; 1 feedback pattern per action class |
| Enough information to begin; first action painfully obvious (HEP U5, GP13; PLAY H3, E3) | AUTO: on a fresh save, exactly one enabled primary action is visible and emphasised; JUDGMENT: first-time persona can name what to do | AUTO 100%; panel all yes |
| No manual/tutorial needed (PLAY A1/A2; Federoff) | JUDGMENT via cognitive walkthrough per unlock | All four questions yes |
| Context-sensitive help so player is not stuck (HEP U6; PLAY H4; Pinelle 9) | AUTO: every widget has an inline hint/help entry; sim/playtest detects stalls (no affordable action for > N minutes, project-set) and checks a hint is shown | 100% widgets; hint on every stall |
| UI consistent in control, colour, typography, dialogue (HEP U3; PLAY F2; Federoff; Hodent consistency) | AUTO: style-token audit per component class across stages | 0 drift |
| Minimize control options / menu layers (Federoff; PLAY G1) | AUTO: B2 and A9 in rubric | Budgets met; depth <= 2 |
| Minimum workload / reduce memory load (Hodent; PLAY E1) | AUTO: A2 (live numbers) and B7 (cost next to balance) | As in rubric |
| Visuals easy to interpret, minimise micromanagement (Pinelle 10) | JUDGMENT; AUTO proxy: count of actions requiring repeated manual clicks per minute in sim playthrough at each phase | Project-set ceiling; panel mean < 2 |
| Form follows function; art speaks to its function (Hodent; PLAY F4) | JUDGMENT: panel identifies each widget's purpose from screenshot alone | >= 2/3 of seats correct per widget |
| Clarity (Hodent) | JUDGMENT plus AUTO contrast/size floors (sections 5-6) | As in rubric |
| Error prevention and recovery with warnings (Hodent; PLAY H1; Federoff) | AUTO: B10 in rubric | 100% |
| Flexibility and accessibility; customise game speed (Hodent; Pinelle 2; GAG) | AUTO: settings exist for text size, motion, audio, (where design allows) speed | Present |
| Unobstructed views (Pinelle 4) | AUTO: no modal/toast covers a timely readout for > N s without dismiss (project-set) | 0 violations |
| Allow skipping repeated content (Pinelle 5) | AUTO: repeated narrative/log sequences and cutscene-like effects are skippable | 100% |

---

## 5. WCAG 2.2 AA success criteria testable in a browser

**Summary.** WCAG 2.2 is the W3C Recommendation for web accessibility; the criteria below are
quoted from the normative text ([W3C, WCAG 2.2](https://www.w3.org/TR/WCAG22/)). React Native
for Web renders a DOM, so these apply to the web build and approximate the Android build. Most
can be checked with axe-core (current release v4.14.1, 2026-11-16, per
[GitHub releases](https://github.com/dequelabs/axe-core/releases); rule list in
[rule-descriptions.md](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md):
`color-contrast`, `target-size` tagged `wcag22aa`/`wcag258`, `avoid-inline-spacing`,
`meta-viewport`, `button-name`, `nested-interactive`, `scrollable-region-focusable`), plus custom
Playwright assertions where axe has no rule.

Exact thresholds (all from [WCAG 2.2](https://www.w3.org/TR/WCAG22/) unless noted):

- **1.4.1 Use of Color (A)**: "Color is not used as the only visual means of conveying
  information, indicating an action, prompting a response, or distinguishing a visual element."
- **1.4.3 Contrast (Minimum) (AA)**: text at least **4.5:1**; large-scale text at least **3:1**;
  inactive UI components, pure decoration and logotypes exempt. Large scale is "at least 18 point
  or 14 point bold"; the Understanding document gives 1pt = 1.333px, so about **24px** and
  **18.5px bold**, and says ratios are thresholds that "should not be rounded (e.g., 4.499:1 would
  not meet the 4.5:1 threshold)"
  ([Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)).
  Contrast ratio = (L1 + 0.05) / (L2 + 0.05).
- **1.4.4 Resize Text (AA)**: text resizable "up to 200 percent without loss of content or
  functionality".
- **1.4.10 Reflow (AA)**: no two-dimensional scrolling at a width equivalent to **320 CSS px**
  (vertical-scrolling content) or a height of **256 CSS px** (horizontal-scrolling content), except
  content needing 2-D layout.
- **1.4.11 Non-text Contrast (AA)**: visual information needed to identify UI components and
  states, and graphics needed to understand content, at least **3:1** against adjacent colours;
  inactive components exempt.
- **1.4.12 Text Spacing (AA)**: no loss of content or function when the user sets line height
  **1.5x** font size, paragraph spacing **2x**, letter spacing **0.12x**, word spacing **0.16x**.
- **1.4.13 Content on Hover or Focus (AA)**: hover/focus content is dismissible, hoverable and
  persistent.
- **2.2.1 Timing Adjustable (A)**: for each content time limit, the user can turn it off, adjust
  it to at least **10x** the default, or be warned and given at least **20 seconds** to extend with
  a simple action (at least 10 times); exceptions for real-time events, essential limits, and
  limits longer than **20 hours**.
- **2.2.2 Pause, Stop, Hide (A)**: moving/blinking/scrolling content that starts automatically and
  lasts more than **5 seconds** needs a pause/stop/hide mechanism; auto-updating information that
  starts automatically and "is presented in parallel with other content" needs a mechanism to
  "pause, stop, or hide it or to control the frequency of the update". This bites directly on
  idle-game tickers and counters; whether the core resource counter is "essential" is a judgment
  call to record.
- **2.3.1 Three Flashes or Below Threshold (A)**: nothing flashes "more than three times in any
  one second period" unless below the general and red flash thresholds.
- **2.4.3 Focus Order (A)**: focus order "preserves meaning and operability".
- **2.4.6 Headings and Labels (AA)**: "Headings and labels describe topic or purpose."
- **2.4.7 Focus Visible (AA)**: the keyboard focus indicator is visible.
- **2.4.11 Focus Not Obscured (Minimum) (AA)**: a focused component "is not entirely hidden due to
  author-created content".
- **2.5.8 Target Size (Minimum) (AA)**: pointer targets at least **24 x 24 CSS px**, except when
  undersized targets are spaced so 24px-diameter circles centred on them do not intersect another
  target or circle, an equivalent control meets the size, the target is inline in text, the size is
  user-agent controlled, or the presentation is essential.
- **3.2.3 Consistent Navigation (AA)** / **3.2.4 Consistent Identification (AA)**: repeated
  navigation in the same relative order; components with the same function identified consistently.
- **4.1.2 Name, Role, Value (A)**: name and role programmatically determinable; state changes
  notified.
- **4.1.3 Status Messages (AA)**: status messages "can be programmatically determined through role
  or properties such that they can be presented to the user by assistive technologies without
  receiving focus". A status message is a change "on the success or results of an action, on the
  waiting state of an application, on the progress of a process, or on the existence of errors".

| Criterion | How to check (Playwright) | Pass threshold |
|---|---|---|
| 1.4.3 text contrast | AUTO: axe `color-contrast` per stage; plus custom sampler for text over CRT effects (scanlines, glow, gradients) where axe returns "needs review": screenshot the text box, take the lowest-contrast background pixel (method from XAG 102, section 6) | >= 4.5:1 (>= 3:1 if >= 24px or >= 18.5px bold), unrounded |
| 1.4.11 non-text contrast | AUTO: for each control, compare border/fill colour to adjacent background; for state indicators compare state colours | >= 3:1 |
| 1.4.1 colour not sole channel | AUTO: diff computed styles of each component in enabled vs disabled vs warning state; at least one non-colour property (text, icon, weight, border style, glyph) must differ. Also screenshot under a greyscale filter and run the same state assertions | 100% of stateful components |
| 1.4.4 resize 200% | AUTO: set root font-size 200% (or browser zoom 200%), assert no element with `overflow:hidden` clips text (`scrollWidth > clientWidth` or `scrollHeight > clientHeight`) and all actions still reachable | 0 clipped, 0 unreachable |
| 1.4.10 reflow | AUTO: viewport 320x(any); `document.documentElement.scrollWidth <= clientWidth` | No horizontal scroll |
| 1.4.12 text spacing | AUTO: inject the four spacing overrides as a stylesheet; re-run clipping and overlap checks; axe `avoid-inline-spacing` | 0 clipped/overlapping text |
| 2.2.1 timing | AUTO: inventory every UI timer (toast auto-dismiss, timed dilemma); assert a setting to extend/disable or that it is >= 20 h; JUDGMENT for "essential" claims | 100% compliant or documented exception |
| 2.2.2 pause/stop/hide | AUTO: detect elements whose text changes > 1 per 5 s (MutationObserver over 10 s) and any CSS animation > 5 s; assert a pause/reduce-motion control exists and works | Control present and effective |
| 2.3.1 flashes | AUTO (approximate): record frames at >= 30 fps for 10 s per stage; count luminance transitions > 10% over >= ~20% of the viewport per second (XAG 118 operationalisation) | <= 3 per second |
| 2.4.7 focus visible | AUTO: Tab through all focusables; screenshot element before/after focus; pixel diff in the element's box + 2px | Non-zero visible diff on 100% |
| 2.4.11 focus not obscured | AUTO: for each focused element, sample `elementFromPoint` at its centre and four inset corners; at least one must return the element or a descendant | 100% |
| 2.4.3 focus order | AUTO: record tab order of bounding boxes; flag backwards jumps against reading order; JUDGMENT for flagged cases | No unexplained backward jumps |
| 2.5.8 target size | AUTO: axe `target-size`, plus custom `getBoundingClientRect` on every `role=button`/pressable | >= 24x24 CSS px or spacing exception |
| 3.2.4 consistent identification | AUTO: same as H4 table row | 0 inconsistencies |
| 4.1.2 name/role/value | AUTO: axe `button-name`, `nested-interactive`, `aria-*` rules; all pressables expose a role | 0 violations |
| 4.1.3 status messages | AUTO: the game log, toasts and unlock notices are inside `role=status`/`role=log`/`aria-live` containers; trigger an event and assert the live region text changed | 100% |

---

## 6. Game Accessibility Guidelines and Xbox Accessibility Guidelines

**Summary (GAG).** gameaccessibilityguidelines.com sorts guidance into Basic, Intermediate and
Advanced. Basic items relevant to a text-heavy incremental game include "Use simple clear
language", "Use simple clear text formatting", "Use an easily readable default font size",
"Provide high contrast between text/UI and background", "Ensure no essential information is
conveyed by a fixed colour alone", "Ensure interactive elements / virtual controls are large and
well spaced, particularly on small or touch screens", "Allow players to progress through text
prompts at their own pace", "Include an option to adjust the game speed", "Avoid flickering images
and repetitive patterns", "Ensure no essential information is conveyed by sounds alone", "Provide
separate volume controls or mutes for effects, speech and background / music", and "Ensure that
all settings are saved/remembered"
([GAG Basic](https://gameaccessibilityguidelines.com/basic/)). Intermediate items include "Highlight
important words", "Allow interfaces to be resized", "Indicate / allow reminder of current
objectives during gameplay", "Include contextual in-game help / guidance / tips", "Give a clear
indication that interactive elements are interactive", "Provide an option to turn off / hide
background movement", "Avoid placing essential temporary information outside the player's
eye-line", "If using a long overarching narrative, provide summaries of progress", "Provide an
autosave feature" and "Provide a choice of text colour, low/high contrast choice as a minimum"
([GAG Intermediate](https://gameaccessibilityguidelines.com/intermediate/)). Numbers given by GAG
pages: contrast "at least 4.5:1"
([GAG contrast](https://gameaccessibilityguidelines.com/provide-high-contrast-between-text-ui-and-background/));
"28px minimum when viewed on a 1080p screen", as a floor, sourced from Amazon's 10-foot TV
guidance, so not directly applicable to phone/desktop
([GAG font size](https://gameaccessibilityguidelines.com/use-an-easily-readable-default-font-size/));
touch targets 2.4 cm ideal, 0.96 cm on phones, as minimums, no spacing number
([GAG target size](https://gameaccessibilityguidelines.com/ensure-interactive-elements-virtual-controls-are-large-and-well-spaced-particularly-on-small-or-touch-screens/)).
My conversion: 0.96 cm at the CSS reference of 96 px/inch is about 36 CSS px (derived, not stated
by GAG).

**Summary (XAG).** The Xbox Accessibility Guidelines (version 3.2, published 2023-06-08) are
"best practices" meant for designers, developers and "test teams as a checklist"
([XAG overview](https://learn.microsoft.com/en-us/gaming/accessibility/guidelines)). The most
relevant items:

- **XAG 101 Text display**: minimum default text *body height* (ascender to descender) of
  **18 px at 1080p** for PC, and for mobile **18 px at 100 DPI, 36 px at 200 DPI, 72 px at 400 DPI**,
  scaling linearly; text scalable to **200%** without loss and without two-direction scrolling;
  at least one sans-serif option; for blocks of more than two lines, line width **<= 80
  characters**, line spacing **>= 1.5**, paragraph spacing **>= 2x** line spacing, letter spacing
  **>= 0.12x**, word spacing **>= 0.16x**; offer sentence case rather than all caps for lines of
  text (one- or two-word labels exempt); left/right aligned, not centred or justified
  ([XAG 101](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/101)).
  My conversion: 18 px at 100 DPI is 0.18 in, about **17 CSS px of body height** (96 CSS px/in);
  body height is typically close to the font-size for most fonts, so roughly a 17-18 px font-size
  floor (derived, verify per font).
- **XAG 102 Contrast**: standard text and visual elements **4.5:1**; large text **3:1**;
  **inactive-element text 3:1** (explicitly including not-yet-unlocked items, unlike WCAG which
  exempts inactive components); high-contrast mode **7:1**; over non-solid backgrounds, measure
  against "the lowest contrasting area of the background"; avoid colour alone, or let players
  choose colours
  ([XAG 102](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/102)).
- **XAG 103 Additional channels for visual and audio cues**: critical information conveyed by
  colour also needs "at least one additional signifier such as shape, pattern, iconography, or text
  labels"; if greying shows an unavailable control, "another method is also used"; critical audio
  also has a visual equivalent; avoid Unicode glyphs whose screen-reader names differ from their
  in-game meaning
  ([XAG 103](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/103)).
  The last point matters for a terminal aesthetic that uses box-drawing and symbol glyphs.
- **XAG 112 UI navigation**: logical, consistent navigation order; repeated components in the same
  relative order; every submenu has a persistent way back; focus can always leave an element by the
  input that entered it
  ([XAG 112](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/112)).
- **XAG 115 Error messages and destructive actions**: errors described with the fix; error text
  visually distinct; permanent or destructive actions offer review, confirm and undo; no
  hold-to-confirm without alternative
  ([XAG 115](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/115)).
- **XAG 116 Time limits**: non-core time limits extendable to **at least 10x**, or warned with
  **at least 20 seconds** to extend, or disabled; timed on-screen elements (tutorials,
  notifications) adjustable up to 10x or dismissed on input
  ([XAG 116](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/116)).
- **XAG 117 Visual distractions and motion settings**: players can "pause or completely stop any
  content that scrolls, blinks, auto-updates, or otherwise moves"; auto-updating content gets a
  frequency control and pause/hide
  ([XAG 117](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117)).
- **XAG 118 Photosensitivity**: a flash is a 10% luminance change; failure is more than about three
  per second over about 20% or more of the screen; red-flash and spatial-pattern rules
  ([XAG 118](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/118)).

| Criterion | How to check | Pass threshold |
|---|---|---|
| Readable default font size (GAG Basic; XAG 101) | AUTO: for every visible text node, measure body height via canvas `measureText('Hfgy')` `actualBoundingBoxAscent + actualBoundingBoxDescent` at the computed font, or from computed font-size as a proxy | Project-set from XAG: >= 17 CSS px body height for primary text on phone and desktop; secondary/meta text flagged below 14 px |
| Sentence case for lines of text (XAG 101) | AUTO: flag text nodes of >= 3 words that are fully uppercase (CSS `text-transform: uppercase` or source) | 0 flagged, or a setting exists to switch |
| Line length (XAG 101) | AUTO: for blocks with > 2 lines, characters per rendered line (width / average glyph advance) | <= 80 characters |
| Line spacing (XAG 101; WCAG 1.4.12 as user override) | AUTO: computed `line-height / font-size` on multi-line blocks | >= 1.5 default (XAG), or survives the WCAG override |
| Contrast incl. inactive/locked text (XAG 102) | AUTO: as WCAG 1.4.3 plus: locked/disabled text measured too | >= 4.5:1 active, >= 3:1 inactive |
| Lowest-contrast background area (XAG 102) | AUTO: pixel sampler over text bounding boxes with CRT effects on | Thresholds above hold against the worst background pixel cluster |
| No essential info by colour alone (GAG Basic; XAG 103) | AUTO: greyscale-render diff plus non-colour state property check (see WCAG 1.4.1 row) | 100% |
| Greyed-out unavailable controls have a second cue (XAG 103) | AUTO: disabled/locked controls carry a text or icon cue (e.g. "LOCKED", lock glyph with accessible name) | 100% |
| Interactive elements clearly look interactive (GAG Intermediate) | JUDGMENT from screenshot; AUTO proxy: every pressable has a border/fill or cursor:pointer distinct from static text | Panel all yes |
| Large, well-spaced touch targets (GAG Basic) | AUTO: bounding boxes on phone viewport | Project-set: >= 36x36 CSS px (GAG 0.96 cm, converted) for primary actions; WCAG 24x24 hard floor for all |
| Reminder of current objectives (GAG Intermediate) | AUTO: an objective/next-step element is present in the main view in every stage; JUDGMENT on usefulness | Present 100% |
| Summaries of progress (GAG Intermediate) | AUTO: after a resume from save, a "since you were away"/summary exists; JUDGMENT on content | Present |
| Text prompts at own pace; timed notifications (GAG Basic; XAG 116) | AUTO: every auto-dismissing toast lingers or is retrievable in a log; durations adjustable or >= 20 s extend | 100% |
| Pause/stop moving and auto-updating content (GAG Intermediate; XAG 117) | AUTO: reduce-motion setting and `prefers-reduced-motion` both stop non-essential animation (measure frame diff with setting on) | No non-essential motion with setting on |
| Flashing (GAG Basic; XAG 118) | AUTO: frame analysis as in WCAG 2.3.1 row | <= 3 flashes/s over >= 20% area |
| Destructive actions review/confirm/undo (XAG 115) | AUTO for declared destructive actions | 100% |
| Persistent way back from every submenu (XAG 112) | AUTO: crawl modals/submenus; assert a back/close control | 100% |
| Glyph names match meaning (XAG 103) | AUTO: every decorative glyph is `aria-hidden`; every meaningful glyph has an accessible name that is not its Unicode name | 100% |
| Settings remembered (GAG Basic) | AUTO: change each setting, reload, assert persisted | 100% |
| Separate audio controls / no info by sound alone (GAG Basic; XAG 103) | AUTO: separate music/effects controls exist; every sound cue has a visual counterpart event in the log | 100% |

---

## 7. Laws of UX that matter here, with the underlying research

lawsofux.com is used only as a pointer; each law below is tied to its original paper (citation
metadata verified on Crossref unless noted). None of these laws supplies a pass/fail number for a
UI on its own, so the thresholds in the table are project-set unless a source is named.

- **Hick-Hyman law**: decision time rises with the number and complexity of choices; takeaways
  include "use progressive onboarding"
  ([lawsofux, Hick's Law](https://lawsofux.com/hicks-law/)). Originals: Hick, "On the Rate of
  Gain of Information", *QJEP* 4(1):11-26, 1952
  ([DOI 10.1080/17470215208416600](https://doi.org/10.1080/17470215208416600)); Hyman, "Stimulus
  information as a determinant of reaction time", *J. Exp. Psych.* 45(3):188-196, 1953
  ([DOI 10.1037/h0056940](https://doi.org/10.1037/h0056940)). The relationship is logarithmic in
  the number of equally likely alternatives (well known; not re-read at the primary here, so the
  formula is unverified in this file).
- **Fitts's law**: time to acquire a target depends on distance and size
  ([lawsofux, Fitts's Law](https://lawsofux.com/fittss-law/)). Original: Fitts, "The information
  capacity of the human motor system in controlling the amplitude of movement", *J. Exp. Psych.*
  47(6):381-391, 1954 ([DOI 10.1037/h0055392](https://doi.org/10.1037/h0055392)).
- **Working memory (Miller, Cowan)**: Miller, "The magical number seven, plus or minus two",
  *Psychological Review* 63(2):81-97, 1956 ([DOI 10.1037/h0043158](https://doi.org/10.1037/h0043158));
  lawsofux itself warns against using 7 to justify arbitrary limits
  ([lawsofux, Miller's Law](https://lawsofux.com/millers-law/)). Cowan's reconsideration: "a
  single, central capacity limit averaging about four chunks", earlier estimates "three to five
  chunks" (Cowan, "The magical number 4 in short-term memory", *BBS* 24(1):87-114, 2001,
  [Cambridge abstract](https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/magical-number-4-in-shortterm-memory-a-reconsideration-of-mental-storage-capacity/44023F1147D4A1D44BDC0AD226838496)).
  NN/g's design consequence: "limit the burden put on the users' working memory" and keep needed
  information visible as external memory; small screens show less, so offer less external memory
  ([NN/g, Budiu, "Working Memory and External Memory"](https://www.nngroup.com/articles/working-memory-external-memory/)).
- **Response time (Nielsen) and Doherty threshold**: 0.1 s "about the limit for having the user
  feel that the system is reacting instantaneously"; 1.0 s for "the user's flow of thought to stay
  uninterrupted"; 10 s for "keeping the user's attention focused"
  ([NN/g, Nielsen, "Response Times: The 3 Important Limits"](https://www.nngroup.com/articles/response-times-3-important-limits/)).
  The Doherty threshold (feedback within **400 ms**) is attributed to Doherty & Thadani, IBM, 1982
  ([lawsofux, Doherty Threshold](https://lawsofux.com/doherty-threshold/)); I could not reach the
  IBM report (the IBM-hosted copy redirects away), so the 400 ms figure is **unverified at
  primary**. Use Nielsen's 0.1 s / 1 s as the cited gates.
- **Jakob's law**: "Users spend most of their time on other sites", so they expect yours to work
  like those they know ([NN/g, Nielsen, Jakob's Law](https://www.nngroup.com/videos/jakobs-law-internet-ux/)).
  For DAEMON, the relevant conventions are those of incremental games and terminals (e.g. resource
  bar at top, buy buttons showing cost); which conventions players expect is a JUDGMENT.
- **Serial position effect**: people best remember the first and last items in a series
  ([lawsofux, Serial Position](https://lawsofux.com/serial-position-effect/)); experimental basis
  Murdock, "The serial position effect of free recall", *J. Exp. Psych.* 64(5):482-488, 1962
  ([DOI 10.1037/h0045106](https://doi.org/10.1037/h0045106)). lawsofux attributes the term to
  Ebbinghaus (not verified at primary).
- **Von Restorff (isolation) effect**: the item that differs is remembered; use emphasis
  sparingly, do not rely on colour alone, be careful with motion
  ([lawsofux, Von Restorff](https://lawsofux.com/von-restorff-effect/)). Original: von Restorff,
  "Über die Wirkung von Bereichsbildungen im Spurenfeld", *Psychologische Forschung* 18:299-342,
  1933 ([DOI 10.1007/BF02409636](https://doi.org/10.1007/BF02409636)).

| Law | Criterion | How to check | Pass threshold |
|---|---|---|---|
| Hick-Hyman | Number of simultaneously enabled choices in the main view | AUTO: count visible, enabled pressables per stage; record the curve across stages | Project-set budget per viewport (e.g. phone <= 8 enabled primary actions); flag any stage that jumps by > 3 at once |
| Hick-Hyman | Recommended/next action highlighted when choices are many | AUTO: when count > budget, exactly one element carries the "recommended" style; JUDGMENT on correctness | Present when over budget |
| Fitts | Primary actions large and near the thumb/eye focus | AUTO: primary action boxes (size per section 6); on phone, primary actions within the first viewport and in the lower two-thirds or a fixed action bar (project-set) | Size floor met; 0 primary actions requiring scroll |
| Fitts | Frequently repeated actions do not move | AUTO: record each primary action's bounding box across 30 s of play and across unlocks | Displacement 0 px during play; unlock shifts flagged |
| Miller/Cowan | Number of live-updating numbers visible at once | AUTO: MutationObserver over 10 s, count distinct elements whose numeric text changed | Project-set: <= 4 ungrouped live numbers per visual group (Cowan ~4 chunks); groups labelled |
| Miller/Cowan + NN/g external memory | Values needed for a decision are visible at the decision point (cost next to button, current balance visible while buying) | AUTO: for each buy action, its cost and the relevant balance are both in viewport | 100% |
| Nielsen 0.1/1/10 s | Feedback latency after an action | AUTO: click-to-mutation timing | <= 100 ms pass; 100 ms-1 s warn; > 1 s fail; > 10 s operations show progress |
| Jakob | Follows incremental-game/terminal conventions | JUDGMENT (panel told which reference games) | Mean severity < 2 |
| Serial position | Most important items first/last in lists and bars | AUTO: in each list/bar, compare item order to a declared priority | Top-priority item at first or last position |
| Von Restorff | At most a few emphasised elements per view; emphasis tracks importance | AUTO: count elements with emphasis styles (accent colour, glow, blink, bold) per viewport; JUDGMENT that the emphasised one is the most important | Project-set: <= 2 emphasised elements per view (consistent with NN/g's "no more than 2 elements at the largest size", section 8) |

---

## 8. Visual hierarchy and layout

**Summary.** NN/g eyetracking: the F-pattern is "the default pattern when there are no strong cues
to attract the eyes towards meaningful information"; it occurs with unformatted text and
efficiency-minded users, and is "bad for users and businesses". Alternatives include layer-cake
(eyes hit headings, skip body), spotted (hunting a specific number or word), marking (eyes fixed
while content scrolls, more common on mobile), bypassing and commitment. Remedies: front-load key
information, prominent headings, and "if users see only the first 2 words, they should still get
the gist" ([NN/g, Pernice, "F-Shaped Pattern"](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/)).
Layer-cake is, after reading everything, "the most effective scanning pattern"; make subheadings
stand out consistently, make clear which body belongs to which heading, and chunk mixed layouts
with borders, background or spacing ([NN/g, Pernice, "Layer-Cake Pattern"](https://www.nngroup.com/articles/layer-cake-pattern-scanning/)).
NN/g's visual hierarchy article names three tools (colour/contrast, scale, grouping) and gives
checkable rules of thumb: no more than **3 type sizes**, no more than **2 elements at the largest
size**, in simple designs **2 primary and 2 secondary colours**, no more than **3 contrast
variations** in complex designs, reserve bright warm colours like red for warnings, do not rely on
colour alone, and use a squint/blur test (5-10 px blur should reveal the intended hierarchy)
([NN/g, Gordon, "Visual Hierarchy in UX: Definition"](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/)).
*Refactoring UI* (book, Adam Wathan and Steve Schoger; publication year not given on the site,
unverified) has a "Hierarchy is Everything" section with chapters such as "Not all elements are
equal", "De-emphasize to emphasize", "Labels are a last resort", "Don't use grey text on coloured
backgrounds" and "Separate visual hierarchy from document hierarchy", and layout chapters
"Establish a spacing and sizing system" and "Avoid ambiguous spacing"
([refactoringui.com](https://www.refactoringui.com/)). Cite it as a book; it is practitioner
guidance, not research.

| Criterion | How to check | Pass threshold |
|---|---|---|
| Type scale discipline | AUTO: collect distinct computed font-sizes among visible text per stage | <= 3 sizes for content (NN/g); chrome/meta text counted separately |
| Few largest elements | AUTO: count elements at the maximum font-size/visual weight | <= 2 (NN/g) |
| Palette discipline and red reserved for danger | AUTO: cluster visible foreground colours; check that the "danger" colour appears only on elements tagged warning/error | <= 2 primary + 2 secondary hues (project adopts NN/g's simple-design rule); danger colour 0 misuse |
| Contrast variations limited | AUTO: count distinct text colour/opacity levels | <= 3 (NN/g) |
| Squint/blur test | AUTO + JUDGMENT: screenshot, apply 5-10 px Gaussian blur, ask panel "what is most prominent?"; compare answer with the stage's declared top-priority element | Panel majority names the declared top element |
| Headings front-loaded and scannable | AUTO: each widget has a visible title; JUDGMENT that its first two words convey purpose | 100% titled; panel all yes |
| Grouping/proximity unambiguous | AUTO proxy: spacing between groups > spacing within groups (bounding-box gaps); JUDGMENT for ambiguous cases | Inter-group gap >= 2x intra-group gap (project-set) |
| Spacing system | AUTO: margins/paddings snap to a declared scale | >= 95% of measured gaps on the scale (project-set) |
| Marking pattern on mobile: scrolling log does not hide timely info | AUTO: while the log scrolls, required readouts stay fixed in viewport | 100% |

---

## Proposed combined rubric

Deduplicated, grouped by the review's goals. Run every check for every stage x phase x viewport
(phone 390x844 and desktop; plus 320 px for reflow). JUDGMENT checks run on a panel of at least
three independent models (five preferred), each scoring 0-4 on Nielsen's scale, aggregated by
mean; a finding is actionable at mean >= 2, and any single seat scoring 4 forces human review.

### A. Find information

1. **A1 AUTO** Every timely readout the engine marks live (resources, threats/suspicion, active
   timers, pending dilemmas) is in the initial viewport and unoccluded. (Nielsen H1; HEP
   Mechanics 3; PLAY B2; Pinelle 8; GAG "objectives reminder"; NN/g external memory)
2. **A2 AUTO** Live-updating numbers per visual group <= 4 ungrouped; groups carry labels.
   (Cowan 2001; NN/g working memory) *Project-set threshold.*
3. **A3 AUTO** Each widget has a visible title; titles unique and stable across stages.
   (WCAG 2.4.6, 3.2.4; NN/g layer-cake)
4. **A4 JUDGMENT** Widget titles and first two words of each line convey purpose. (NN/g F-pattern,
   layer-cake; information scent)
5. **A5 AUTO** <= 3 content type sizes; <= 2 largest elements; <= 3 contrast levels. (NN/g visual
   hierarchy)
6. **A6 AUTO + JUDGMENT** Blurred screenshot: panel majority identifies the stage's declared top
   item as most prominent. (NN/g squint test; von Restorff)
7. **A7 AUTO** Danger/warning colour used only on warning elements; every warning also has a
   non-colour cue. (NN/g hierarchy; WCAG 1.4.1; XAG 103)
8. **A8 AUTO** Groups separated more than their contents (inter-group gap >= 2x intra-group).
   (NN/g grouping; Refactoring UI "Avoid ambiguous spacing") *Project-set.*
9. **A9 AUTO** Disclosure depth <= 2 to reach any information or action. (NN/g progressive
   disclosure)
10. **A10 JUDGMENT** Resume-after-absence summary explains what changed. (GAG Intermediate
    "summaries of progress")

### B. Find actions

11. **B1 AUTO** Every enabled action has a non-generic accessible name (deny-list: More, Info,
    Details, Open, icon-only). (NN/g information scent; WCAG 4.1.2)
12. **B2 AUTO** Enabled primary actions in main view within the per-viewport budget; stage-to-stage
    increase <= 3. (Hick-Hyman; NN/g progressive disclosure) *Project-set.*
13. **B3 AUTO** Primary actions reachable without scrolling on phone. (Fitts; NN/g progressive
    disclosure "frequently needed up front")
14. **B4 AUTO** Target size >= 24x24 CSS px everywhere (or spacing exception); primary actions on
    phone >= 36x36. (WCAG 2.5.8; GAG Basic, converted) *36 px project-set from GAG.*
15. **B5 AUTO** Primary actions do not move during play; shifts at unlock are flagged. (Fitts;
    Nielsen H4)
16. **B6 AUTO** Every disabled/locked action states why (cost, requirement) next to it, and has a
    non-colour cue. (Nielsen H6; XAG 103; WCAG 1.4.1)
17. **B7 AUTO** Each action's cost and the relevant balance are visible together. (NN/g external
    memory; Nielsen H6)
18. **B8 JUDGMENT** Interactive elements look interactive; static text does not. (GAG Intermediate)
19. **B9 JUDGMENT** Cognitive walkthrough per unlock: all four questions answered yes for a
    first-time persona. (Wharton et al.; NN/g; PLAY A1/A2 "no manual or tutorial needed")
20. **B10 AUTO** Declared destructive/irreversible actions confirm first; no hold-to-confirm only.
    (Nielsen H5; XAG 115)
21. **B11 AUTO** Every modal/submenu has a visible exit; Escape/back dismisses. (Nielsen H3;
    XAG 112)
22. **B12 JUDGMENT** Layout follows incremental-game/terminal conventions the panel recognises.
    (Jakob's law; HEP Mechanics 5; PLAY B4)
    Also: **B13 AUTO + JUDGMENT** On a fresh save, exactly one enabled, emphasised primary action;
    first-time persona can say what to do. (HEP GP13; PLAY E3, H3)

### C. Timely main view

23. **C1 AUTO** On each unlock, the new element appears in viewport and is announced via log or
    `role=status`/`aria-live`. (Cognitive walkthrough Q2; NN/g scent; WCAG 4.1.3)
24. **C2 AUTO** After each unlock, A1 still passes (new content did not push timely info out).
    (NN/g progressive disclosure "initial display not crowded")
25. **C3 AUTO** Action feedback within 100 ms (warn to 1 s, fail beyond). (Nielsen response times;
    Nielsen H1; HEP U1; PLAY C1; Pinelle 1) *Doherty 400 ms unverified at primary.*
26. **C4 AUTO** After an action, a related readout or log line changes within 1 s. (Cognitive
    walkthrough Q4)
27. **C5 AUTO** Essential temporary information (alerts, timed dilemmas) appears in the main view,
    not in a collapsed or scrolled-away panel, on both viewports. (GAG Intermediate "player's
    eye-line")
28. **C6 AUTO** Timed UI (toasts, dilemma timers) extendable to >= 10x, or >= 20 s warning to
    extend, or retrievable in a log; or documented as essential. (WCAG 2.2.1; XAG 116)
29. **C7 JUDGMENT** For each stage, panel lists what a player must know right now to decide; every
    item on that list is in the main view. (Nielsen H1, H6, H8)
30. **C8 JUDGMENT** Nothing irrelevant to the current phase competes with timely items. (Nielsen H8)

### D. Accessibility floor

31. **D1 AUTO** Text contrast >= 4.5:1 (>= 3:1 at >= 24px or >= 18.5px bold), unrounded, measured
    against the lowest-contrast background area with CRT effects on. (WCAG 1.4.3; XAG 102)
32. **D2 AUTO** Locked/inactive text >= 3:1. (XAG 102; goes beyond WCAG)
33. **D3 AUTO** Control boundaries and state indicators >= 3:1. (WCAG 1.4.11)
34. **D4 AUTO** No horizontal scroll at 320 CSS px; no clipping at 200% text; no clipping with
    WCAG text-spacing overrides. (WCAG 1.4.10, 1.4.4, 1.4.12; XAG 101)
35. **D5 AUTO** Focus visible on every focusable and never fully obscured; tab order follows
    reading order. (WCAG 2.4.7, 2.4.11, 2.4.3)
36. **D6 AUTO** Auto-updating and moving content can be paused or slowed; reduce-motion stops
    non-essential animation. (WCAG 2.2.2; XAG 117; GAG Intermediate)
37. **D7 AUTO** <= 3 flashes per second over >= ~20% of the viewport. (WCAG 2.3.1; XAG 118)
38. **D8 AUTO** Decorative glyphs `aria-hidden`; meaningful glyphs named by meaning; axe-core run
    with `wcag2a, wcag2aa, wcag21aa, wcag22aa` tags reports 0 violations. (XAG 103; WCAG 4.1.2)

### E. Text and tone

39. **E1 AUTO** Lines of text of >= 3 words are not all caps (or a sentence-case setting exists);
    one- and two-word labels exempt. (XAG 101)
40. **E2 AUTO** Multi-line blocks: <= 80 characters per line, line-height >= 1.5, left aligned.
    (XAG 101)
41. **E3 AUTO** Primary text body height >= ~17 CSS px on phone and desktop. (XAG 101, converted;
    GAG Basic) *Conversion is derived; verify against the actual monospace font.*
42. **E4 JUDGMENT** Simple, clear language; jargon is either explained in-game or obviously
    diegetic flavour that does not hide a mechanic. (GAG Basic; Nielsen H2; NN/g scent warning on
    jargon)
43. **E5 JUDGMENT** Error and warning text says what happened and what to do. (Nielsen H9; XAG 115)
44. **E6 AUTO** Same function, same words across stages and phases. (Nielsen H4; WCAG 3.2.4)

Notes on applying the rubric:

- AUTO checks need a per-stage oracle: which readouts are "timely", which actions are "primary",
  which are "destructive", and the declared top-priority item. These should come from content data
  or a small review manifest, not be hard-coded in specs, so they stay valid as content changes.
- JUDGMENT checks should receive the same inputs for every seat (screenshot, a11y snapshot, prior
  log lines, persona) and never see other seats' answers before scoring (NN/g independence rule).
- Thresholds marked project-set should go to a design vote before becoming gates, because they are
  not given by the cited source.
