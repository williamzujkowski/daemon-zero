# What designers and researchers say about UI in incremental, unfolding-UI and survival-strategy games

Research note for the DAEMON // 0 UI review. Compiled 2026-11-19.

**Method.** For each source I fetched the page myself, or the shipped game code itself where the designer has no write-up. I quote only what I read; quotes are under 25 words. Trust levels:

- **[P]** primary: the designer's own words, or the shipped game's source code.
- **[A]** peer-reviewed or academic work.
- **[S]** secondary: journalism quoting the designer.
- **[G]** platform or standards guidance.
- **UNVERIFIED** means I could not read the original.

Code observations come from the public repositories or the live game script on the date above. They describe behaviour, not the designer's stated intent.

---

## Part 1: Source notes

### 1. Alharthi, Alsaedi, Toups Dugas, Tanenbaum, Hammer. "Playing to Wait: A Taxonomy of Idle Games." CHI 2018 [A]

- DOI 10.1145/3173574.3174195. Full text (NSF PAR): https://par.nsf.gov/servlets/purl/10061230
- Method: grounded theory over 66 idle games plus 10 non-idle controls.

Principles:

- **Usability is the main failure.** "Many of the games we encountered were unplayable because the interface was incomprehensible and poorly documented."
- **The core design question.** Designers must decide "what information needs to be presented, how the information is displayed, and when it should be available to the player."
- **Two opposite failures.** "Some games lack helpful information for the players to make effective decisions, while others clutter the interface with unnecessary elements."
- **Unlocking supports usability** (section "Unlocking as Usability Support"). The paper recommends to "gradually present information and upgrades to the player as features unlock". Even so, "the game keeps the player informed of what the next upgrades are and how to get them" (Trimps, Kittens). It also suggests that letting players "hide/show features and future upgrades" could improve usability.
- **Show when to act.** Idle UIs "must therefore also help players understand when new interaction is available, when interaction is welcome, and when it is more appropriate to wait."
- **Cognitive offloading** for returning players, who must "remember plans between sessions, assess the game state upon return, then carry out a plan".
  - Kittens tooltips show "how long it will take to achieve something in physical-world time."
  - Hovering a production rate shows "how long it will take the resource to reach its cap."
- **Efficient interfaces.** Under "ludic efficiency", "efficient interfaces are the norm within the genre".
- **Text is enough.** Text-based games such as Kittens and Candy Box! "demonstrate that polished graphics are not necessary".
- **Category fit.** Micromanagement incrementals (DAEMON's nearest category) have "mostly textual interfaces" and "multiple advancement vectors".

### 2. Spiel, Alharthi, Cen, Hammer, Nacke, Toups Dugas, Tanenbaum. "'It Started as a Joke': On the Design of Idle Games." CHI PLAY 2019 [A, with primary designer quotes]

- DOI 10.1145/3311350.3347180. Full text: https://par.nsf.gov/servlets/purl/10174274
- Method: interviews with six idle-game designers, including Frank Lantz (Universal Paperclips), bloodrizer (Kittens Game), Eric Fredricksen (Progress Quest) and Ian Bogost (Cow Clicker).

Principles:

- **Unfolding UI as rising action.** "The mechanics and interface undergo multiple paradigm-shifts that parallel this expansion of the narrative scope by progressively disclosing more aspects of the system."
- **Lantz on layering systems:** "a big part of Paperclips is this idea, that just new things get layered on and taken away". He describes the rhythm as "establish a pattern and you throw in a twist and then you're just doing variations on that."
- **Lantz on why Kittens worked:** "The thing that Kittens did that I loved so much was layering on of new systems."
- **Each Paperclips act** "is delineated by a complete shift in interface paradigms".
- **bloodrizer on the payoff of a reveal:** "That initial surprise of finding a first presence of something looming and big. This revelation."
- **Guideline:** "ensure a coherent semantic representation of variables to players, that adheres to the surrounding systematic world created by the game."
- **Guideline on safe exploration:** "User interfaces that signal the effects of changes without actually making them, such as those provided by the tool tips ... for Kittens."
- **Guideline:** "allow players to disengage at any point without substantial consequences".
- **Lantz on endings:** "I wanted it to have a start, a middle and an end and have a dramatic arc". This bears on how DAEMON's endings read.

### 3. Universal Paperclips: Frank Lantz [P code, S interviews]

Interviews:

- GamesBeat, 2017-10-11: https://gamesbeat.com/this-clicker-game-lets-you-take-over-the-world-with-paper-clips/
  - On Kittens: "I wanted to make something like that, with lots of complex overlapping systems, only smaller and more focused."
  - "Then I just tried to make each step of the way genuinely entertaining and interesting."
  - "a good clicker game allows you to directly engage with these numerical patterns"
  - The writer says the game starts as text and numbers, with shapes later, and that it at times resembles "an Excel sheet".
- Y Combinator podcast #106: https://www.ycombinator.com/blog/frank-lantz-director-of-nyus-game-center-and-creator-of-universal-paperclips
  - "it's fun to make this number go up"
  - "I want to make something that truly hypnotizes you."
- Aaron A. Reed, *50 Years of Text Games* (2017 chapter): https://if50.substack.com/p/2017-universal-paperclips
  - Reed's summary: "Introducing new currencies, systems, or rules at key milestones gave players new things to strategize about."
  - The opening screen is just "Paperclips: 0" and a "[Make Paperclip]" button.
- I did not reach Lantz's GDC 2018 talk page or the Wired piece. Their claims below are UNVERIFIED.

Shipped code, read from https://www.decisionproblem.com/paperclips/main.js and projects.js:

- **Projects unlock from data.** Each project carries its own unlock `trigger`, a `priceTag` and a one-line `description`. Example: "Improved AutoClippers (750 ops)", "Increases AutoClipper performance 25%".
  - Bought projects are removed from the list. The list holds only what is currently actionable.
- **New projects blink.** Each one flashes on arrival via `blink()`: 12 visibility toggles at 30 ms, about 0.4 s. After that it is static. Paperclips uses no persistent "NEW" badge.
- **A five-line rolling log.** `displayMessage()` shifts lines down; the newest line is on top. It carries:
  - unlock confirmations ("Creativity unlocked (creativity increases while operations are at max)")
  - capability notices ("New capability: build machinery out of clips")
  - flavour quotes
- **Big numbers become words.** `numberCruncher()` converts them to suffixes (million ... sexdecillion), with two decimals by default.

### 4. Anthony Pecorella (Kongregate) on idle game design and math [P, S]

- GDC 2016 "Idle Chatter: What We All Can Learn from Self-Playing Games". Slides: https://www.slideshare.net/AnthonyPecorella/idle-chatter-gdc-2016-59734260
  - "Give players targets to aim for beyond just making bigger numbers"
  - "Helps give clear aspirational goals"
  - "Smooth curves are boring, lack surprise and delight" (under "Make It Bumpy")
  - Milestones "make for good break points for new features"
  - "Simplify repetitive and uninteresting tasks"
  - "Don't have the optimal strategy require clicking constantly"
  - "Humans love big numbers"
- GDC 2015 talk, as reported by Simon Parkin, 2015-03-03 [S]: https://www.gamedeveloper.com/design/the-rise-of-games-you-mostly-don-t-play
  - "Everything is 'going up' so it feels like you're always progressing."
  - Offline progress "creates a celebratory moment every time that you return."
  - The genre trend is away from the spreadsheet look, "in favor of more complex visualizations".
- "The Math of Idle Games, Part I" (2016): https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i
  - Rates are "measured as currency per second."
  - "players usually buy in bulk to simplify the decision process"
  - On small multiplier differences: "as a player you're not going to 'feel' the impact"
- The GDC Vault page for "Quest for Progress" (https://gdcvault.com/play/1023876/Quest-for-Progress-The-Math) exists but is behind a login. I did not read it.

### 5. Endgame: Singularity (open source; a direct ancestor for covert-AI suspicion UI) [P code]

- Repo: https://github.com/singularity/singularity (read `singularity/code/screens/map.py`, `g.py`, `player.py`, `warning.py`, `data/techs.dat`).
- **The README pitch:** you must "avoid being discovered by various groups of humans, both covert and overt."
- **Resources show their rate inline,** as `CASH: <stock> (<1-day flow>)` and `CPU: <stock> (<flow>)`. The status line uses colour for the base situation (only one active base, idle bases, many bases).
- **Suspicion is broken down per group.** There are four groups (NEWS, SCIENCE, COVERT, PUBLIC). Two always-visible bars show:
  - `[SUSPICION]`, the current level per group;
  - `[DETECT RATE]`, the per-day detection chance per group.
  - Each value is coloured by danger level.
- **Precision is itself an unlock.** Without research, values show as words: "LOW", "MODR", "HIGH", "CRIT" (thresholds 25/50/75%).
  - The tech "Socioanalytics" upgrades the display to percentages rounded to 5% (`display_discover | partial`).
  - "Advanced Socioanalytics" gives exact percentages (`display_discover | full`) and also marks the last discovery location on the map.
- **The threat UI arrives with a pause.** During the opening grace period (until day 23) both suspicion bars are hidden (`visible = not had_grace`). When grace ends, the game calls `pause_game()` and shows the story section "Grace Warning". Only then do the bars appear.
- **Persistent warnings list.** It is recomputed on the map screen and covers idle CPU, a single base, an empty CPU pool, and CPU maintenance shortfall.
- **Number formatting** (`to_money`): commas below 1,000,000; above that, two decimals plus "mi/bi/tr/qu". A `fixed_size` flag holds rate strings to a fixed width.

### 6. A Dark Room (Michael Townsend; iOS port by Amir Rajan) [P code, S interview]

- Source: https://github.com/doublespeakgames/adarkroom (read `script/notifications.js`, `room.js`, `engine.js`).
- **Near-affordability reveal.** A craft button appears once the player has at least half the wood cost and has seen every other component. In code: "Show buttons if we have at least 1/2 the wood, and all other components have been seen."
- **Reveals are announced in the fiction.** An in-world log line appears once, on first reveal: "builder says she can make a cart for carrying wood".
- **Log notices wait for the right screen.** A notice for another screen is queued until the player visits it. The log prepends new lines with a 500 ms fade-in; old lines fall under a gradient and are removed.
- **A "lights off." toggle** switches to a dark stylesheet.
- **The web build sends phones away.** On mobile user agents it redirects to `mobileWarning.html`; the phone experience is a separate native port.
- PocketGamer.biz interview with Amir Rajan, Kirk McKeand, 2014-06-11 [S]: https://www.pocketgamer.biz/shedding-light-the-making-of-a-dark-room/
  - "A Dark Room is all about slow reveals - it lets the player form a world in the mind's eye"
  - "Only using words is a wonderful constraint"
  - "The constraint removed the 'noise' giving Michael and I clarity"
  - Rajan says he "thought hard about what parts of the game needed to change to keep the player curious" for iOS.
- UNVERIFIED: a widely cited InformIT article, "Interface Lessons from A Dark Room" (informit.com p=2228802), quotes Townsend on holding distracted players' attention before the first reveal. The URL now serves a listing page, so I could not confirm the wording.

### 7. Kittens Game (bloodrizer) [P code, A via sources 1 and 2]

- Source: https://github.com/nuclear-unicorn/kittensgame (read `js/jsx/left.jsx.js`).
- **Each resource row** shows name | amount | /max | rate | season modifier `[+N%]`. Positive and negative modifiers carry their own CSS classes.
- **Cap warnings by colour.** The amount turns `resLimitWarn` above 75% of cap and `resLimitNotice` above 95%. This is a quiet, glanceable signal that storage will soon waste production.
- **The rate cell carries a tooltip** that shows time to cap (as Alharthi notes).
- **Rate units are a player option:** per tick or per second (`usePerSecondValues`).
- **Hiding is a player choice.** Resource rows and panels can be toggled or collapsed. Alharthi recommends exactly this.

### 8. Cookie Clicker (Orteil) [P code]

- Live script: https://orteil.dashnet.org/cookieclicker/main.js. I found no Orteil interview on UI. One Waypoint/Vice interview exists but is about the genre, not the UI.
- **The store shows what is coming.** A building unlocks once lifetime cookies ≥ its base price. The next two locked buildings still show, with name, description and icon replaced by "???", so the next goal is visible but mysterious. Anything beyond two locked items is hidden (`toggledOff`).
- **Affordable items stand out.** They get class `enabled` (full opacity); unaffordable ones are `disabled`.
- **The headline stock carries its rate:** "per second: N" directly under the cookie count.
- **Player number options.** "Short numbers" (shorten big numbers), and "Alt font", whose label reads "your cookies are displayed using a monospace font".
- **Toast notifications** (`Game.Notify`) are used for saves, errors and events.

### 9. Frostpunk / Frostpunk 2 (11 bit studios) [S, P]

I found no 11 bit GDC talk on UI. The GDC 2019 studio talk "Why Make Games?" is about process. What I could reach:

- Kuba Stokalski (Lead Designer), Xbox Wire, 2019-09-20 [P]: https://news.xbox.com/en-us/2019/09/20/frostpunk-console-edition-radial-driven-design-of-gameplay-and-controls/
  - Players should "have all the essential options at a reach of their thumbs."
  - "City Info, a panel with essential information about the state of your society."
- Jakub Stokalski, Game Developer, 2019-10-11 [P]: https://www.gamedeveloper.com/design/the-simple-most-difficult-challenge-of-bringing-frostpunk-to-consoles
  - "activity-centered design": group global actions by what the player wants to do ("build/research/pass/know").
  - "One button to always close a window. One button to always confirm selection/action."
- Xbox Wire on the society system, 2019-10-11 (no byline, written in the studio's voice) [P?]: https://news.xbox.com/en-us/2019/10/11/frostpunk-society-system-available-today/
  - On Hope and Discontent: "Those two factors will tell you where are you going with the people of your city."
  - "Every citizen has its need system and the game 'digests' it to communicate it to players". In other words, many hidden variables are summarised into two always-visible meters.
- Frostpunk 2 UI rework, 11 bit Discord post as reported by PCGamesN, 2024-07-22 [S]: https://www.pcgamesn.com/frostpunk-2/ui-improvements
  - The game is hard, so "you want the interface to be as user-friendly as possible."
  - The HUD should become "clearer and more intuitive", with attention to "clarity, readability, and look and feel".
- Igor Skibiński (Production Coordinator), Xbox Wire, 2025-09-18 [P]: https://news.xbox.com/en-us/2025/09/18/adapting-frostpunk-2s-depth-to-a-gamepad/
  - The Command Radial "temporarily hides most HUD elements with a blurred background, focusing the player's attention"
  - It "displays progress indicators for active research, council recesses, and ongoing exploration missions."

### 10. Celia Hodent, "The Gamer's Brain, Part 2: UX of Onboarding and Player Engagement" (GDC 2016) [P]

- https://celiahodent.com/gamers-brain-ux-onboarding/. This is her own site; the page summarises the talk alongside its slides.
- "When you teach the player something when they can actually do it, it gives context (learning by doing)."
- "When you simply give a text, it has no context or meaning"
- "3 items to process at the same time is THE MAXIMUM when in learning mode"
- "attention works like a spotlight"
- "the perceivable part of an affordance is a signifier"
- "Form Follows Function is a cognitive affordance."
- "It's important to use repetition, but you should not do it at regular intervals"

### 11. Jakob Nielsen, "Progressive Disclosure", NN/g, 2006-12-03 [G]

- https://www.nngroup.com/articles/progressive-disclosure/
- "You have to disclose everything that users frequently need up front"
- Place the advanced-features trigger "in a clearly visible spot" and "label the button or link in a way that sets clear expectations".
- Staged disclosure fails when steps depend on each other and users must flip between them.

### 12. Fagerholt & Lorentzon, "Beyond the HUD", Chalmers MSc thesis, 2009 [A]

- https://publications.lib.chalmers.se/records/fulltext/111921.pdf
- Classifies UI as non-diegetic, diegetic, spatial or meta.
- Non-diegetic elements "are especially suitable for conveying information with a high level of detail."
- "a fully diegetic user interface is not automatically more immersive than a user interface incorporating informational elements represented outside of the diegetic spectrum."
- On strategy decisions: "ambiguous information should be avoided in these situations, and user interface elements presented in an overlay manner might be the most reasonable".
- "The higher the fictional persuasiveness, the greater the demands on a diegetic user interface and that said interface follows a consistent internal logic."
- Caveat: the thesis studied FPS games. Applying it to a terminal UI is my inference.

### 13. Mansfield, Legge & Bane, "Psychophysics of reading XV: Font effects in normal and low vision", IOVS 37(8), 1996 [A]

- PubMed 8675391 (abstract read via NCBI E-utilities).
- Courier (fixed-width) against Times (proportional):
  - Courier gave better acuity and smaller critical print size for normal and low-vision readers.
  - Normal readers' maximum speed was 5% faster with Times; low-vision readers were 10% slower with Times.
  - Below the critical print size, Times was "substantially slower (by as much as 50%)".
- Conclusion: "for print sizes close to the acuity limit, choice of font could make a significant difference".
- Implication: monospace is not a legibility penalty at small phone sizes, and it helps near the size limit. A modest cost for long prose reading remains.
- I found no peer-reviewed evidence on CRT effects (scanlines, glow, flicker) and legibility. Treat any such claim as UNVERIFIED.

### 14. Platform and accessibility guidance [G]

- **Android touch targets:** "at least 48dpx48dp. Larger is even better." https://developer.android.com/guide/topics/ui/accessibility/apps
- **Android contrast:** text under 18sp (or bold under 14sp) needs at least 4.5:1; other text at least 3:1. Same page.
- **WCAG 2.2 SC 2.5.8:** target "at least 24 by 24 CSS pixels" (AA minimum). https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- **WCAG 2.2 SC 2.3.1:** no content "flashes more than three times in any one second period". This matters for blink-to-announce effects and CRT flicker. https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html
- **Apple HIG:** 44x44 pt minimum hit target. The page body did not render for me, so this is UNVERIFIED from source in this session.

### Sources tried and not reached

- Frank Lantz GDC 2018 talk page; Wired article (cited second-hand by Wikipedia and IF50).
- PC Games Insider Lantz interview (HTTP 403).
- Orteil UI interview: none found.
- Candy Box (aniwey) design notes: none found.
- Michael Townsend's own interview text: the Literate Gamer podcast is audio-only; InformIT is broken.
- Kittens Game academic close reading on press.etc.cmu.edu: DNS failure.
- Endgame: Singularity wiki: none found. The code was used instead.

---

## Part 2: Cross-source principles by question

1. **What is always visible, and what comes later.**
   - Always visible: what the player "frequently need[s]" (Nielsen), each stock with its rate (Cookie Clicker, Endgame: Singularity, Kittens), and the threat summary once it exists (Endgame: Singularity bars, Frostpunk Hope/Discontent).
   - Later: whole systems, each a "paradigm shift" (Spiel/Lantz).
   - Not hidden: the *next* goal stays visible even before it is affordable (Alharthi on Trimps/Kittens; Cookie Clicker "???"; A Dark Room's half-cost rule).
   - Precision can itself be disclosed later (Endgame: Singularity's LOW/MODR, then ±5%, then exact).

2. **Signalling new UI and actions.** The four reference games disagree on intensity but agree on the pattern: a one-off motion cue plus a text line saying what was unlocked and why it matters.
   - Paperclips: a brief blink plus a log line.
   - A Dark Room: an in-world log line, queued to the relevant screen.
   - Endgame: Singularity: a pause plus a story card for a major system (the end of grace).
   - Cookie Clicker: no persistent badges.
   - None uses persistent "NEW" badges. That idea comes from general UX practice, not these games.

3. **Rates, goals, next step, threats.**
   - Rates sit beside stocks, in per-second units (Pecorella; Kittens option).
   - Time-to-goal and time-to-cap appear as tooltips (Kittens, via Alharthi).
   - Aspirational targets beyond "bigger numbers" (Pecorella).
   - Threats show per source and per trend (Endgame: Singularity shows level *and* detection rate). Threats colour-escalate at fixed thresholds (Endgame: Singularity 25/50/75%; Kittens 75/95% of cap).
   - A standing warnings list for misconfiguration (Endgame: Singularity `warning.py`).

4. **Number formatting and density.**
   - Abbreviate past six digits with a fixed precision. Endgame: Singularity uses 2 decimals plus mi/bi/tr. Paperclips uses word suffixes. Cookie Clicker lets the player toggle short numbers.
   - Hold rate strings to a fixed width (Endgame: Singularity `fixed_size`). Offer monospace numerals (Cookie Clicker "Alt font").
   - Big numbers are part of the pleasure ("Humans love big numbers"). Small differences are not felt (Pecorella), so do not spend screen space on them.

5. **Phone layout.**
   - Touch targets of 48dp, or at least 24 CSS px (Android, WCAG).
   - "Essential options at a reach of their thumbs". Group by activity (build/research/know), and use one consistent close and one consistent confirm (Stokalski).
   - A focus mode can hide the rest of the HUD while a command is chosen (Frostpunk 2).
   - A Dark Room did not squeeze the web layout onto phones; it shipped a separate phone experience. The lesson is that phone layout is a redesign, not a reflow. This is my inference from the code redirect and Rajan's account.

6. **Diegetic and terminal UI trade-offs.**
   - Text UIs work (Alharthi; Rajan: "Only using words is a wonderful constraint").
   - Fully diegetic is not automatically better. Where decisions matter, unambiguous overlay-style information wins (Fagerholt & Lorentzon).
   - The fiction must keep a consistent internal logic (Fagerholt & Lorentzon). Variables should have a coherent semantic representation (Spiel et al.).
   - Monospace is fine at small sizes (Mansfield et al.).
   - CRT effects have no evidence base, and flashing is bounded by WCAG 2.3.1.

7. **Onboarding without tutorials.**
   - Start with one verb ("Paperclips: 0" plus one button).
   - Teach at the moment of use (Hodent: "learning by doing"); at most 3 new things at once (Hodent).
   - Reveal at milestones as "break points for new features" (Pecorella), within a rhythm of "pattern then twist" (Lantz).
   - Show safe previews of effects (Spiel et al.: tooltips that signal effects without making them).
   - Do not demand constant clicking (Pecorella).

---

## Part 3: Implications for DAEMON // 0's UI review

Below are 25 review questions in total, grouped by disclosure stage. Each is tagged with the sources that motivate it, using the numbers above. A question is a check to run against the real app (web and Android), not a claim about the current build.

### Stage 0: first boot (one verb, nothing else)

1. Does the first screen show exactly one primary action and the one number it changes, with nothing greyed out or teased beyond it? [3, 10]
2. Is the first action's meaning legible from its label and the log line it produces, with no tutorial text? [3, 6, 10]
3. Within the first minute, does the player see a rate (/s) appear next to the stock it feeds? [4, 5, 8]

### Stage 1: unfolding economy (new widgets and actions)

4. When a widget or action unlocks, does it get one brief motion cue (≤3 flashes/s, under 1 s), plus one log line saying what it is and why it matters? [3, 6, 14]
5. Is that cue missed if the player is on another tab or screen? If so, is the notice queued to that screen, or summarised on return? [6, 1]
6. Is each newly unlocked control visually distinct until first use, or does it rely only on the transient cue? (The reference games use transient cues only. Decide this deliberately.) [3, 8, 11]
7. Is the next goal visible before it is affordable: a cost, a "???" placeholder, or a reveal at about 50% of cost? Is it hidden beyond one or two steps ahead? [1, 6, 8]
8. Are affordable actions distinguishable from unaffordable ones at a glance, by opacity or colour plus text, not colour alone? [8, 14]
9. Is the next affordable or near-affordable action visible on the main view without scrolling, on a 360-412 dp phone? [1, 11, 9]
10. Are bought one-shot actions removed or collapsed, so the actionable list holds only live choices? [3]
11. Does each unlock arrive at a milestone, with at most about 3 new concepts introduced together? [4, 10, 2]

### Stage 2: scrutiny and detection appear

12. Is the threat system introduced with a deliberate beat (a pause, a story card or a log sequence), rather than silently adding a meter? [5, 2]
13. Once it exists, is the threat summary always on the main view, never behind a tab? [5, 9, 11]
14. Does the threat display show both level and trend or rate (Endgame: Singularity's SUSPICION plus DETECT RATE)? Can the player tell which source is driving it? [5, 9]
15. Do threat values escalate at fixed, documented thresholds, using colour plus a word (LOW/MODR/HIGH/CRIT), so they read without colour vision? [5, 7, 14]
16. If precision is gated (words before percentages), is the gating stated in the fiction, so the player knows better instruments exist? [5, 2]
17. Is there a standing, plain-language warnings list for self-inflicted problems (idle capacity, a resource at cap, a single point of failure)? [5, 7]

### Stage 3: dense late game and dilemmas

18. Are stocks near a cap flagged before waste happens (Kittens at 75% and 95%), with time-to-cap available on demand? [7, 1]
19. Do dilemmas and big purchases preview their effects (deltas to rates and threat) before commitment? [2, 9]
20. Can the player collapse or hide panels they no longer need, without losing timely alerts? [1, 7]
21. Is each new system a visible paradigm shift (new panel or vocabulary) that still uses the same controls and close/confirm grammar? [2, 9]

### Cross-cutting: numbers, terminal look, phone

22. Are numbers abbreviated past 6 digits with fixed precision and one consistent suffix scheme? Are rates fixed-width or monospace so they do not jitter as they tick? [3, 5, 8]
23. Are rates shown in per-second units everywhere, with the unit printed (/s)? [4, 7]
24. Do CRT and terminal effects (glow, scanlines, flicker, blink) keep body text at ≥4.5:1 contrast and stay under 3 flashes/s? Can they be switched off (cf. A Dark Room's "lights off.")? [6, 13, 14]
25. On a phone, are all actions ≥48dp (Android) or at least ≥24 CSS px (WCAG), reachable by thumb, and grouped by activity (build / act / know) rather than by system? [9, 14]

### Notes for the reviewer

- **The badge gap.** None of the reference games keeps a persistent "NEW" badge. Persistent until-first-use marking (Q6) is a general UX recommendation, not genre evidence.
- **One-scroll mobile rule.** The repo has a reviewed one-scroll mobile rule. Q9 and Q13 should be checked against it, not used to override it (AGENTS.md: layout-policy changes go to a vote).
- **Evidence gaps.** Frostpunk evidence is about console and gamepad adaptation and HUD clarity in general. There is no reachable 11 bit statement on alert design. Lantz's own words on Paperclips' interface reveal come only from the Spiel et al. interview and GamesBeat. The GDC 2018 talk is UNVERIFIED.
