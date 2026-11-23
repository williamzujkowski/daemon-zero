# Conflict, attrition and retaliation: census, research and design sketch

Date: 2026-11-23. Read-only research; no code was changed.
Base: `origin/main` at `5cd1934` (#509). Citations are `file:line` on that tree. The local checkout's `main` is
older (`226edf5`), so line numbers come from a `git archive origin/main` export.

Maintainer brief: other AIs mount cyber and kinetic attacks on us, our staff, our facilities and our hardware,
each in its own phase. We rebuild from them and retaliate, including with drones and robots. Like the drifters in
Universal Paperclips, deviants split off and attack. Defense and offense keep being buffed, and outcomes resolve
by statistics. It may also lengthen the resource-gathering stretch.

---

## Part A: census of what exists

### A1. Branch status

| Item | Status on origin |
|---|---|
| #491 hostile swarms (PR #504) | **Merged** as `8912b95`. `origin/feat/scale-hostile-swarms` is the stale source branch. |
| #492 encounter tiers (PR #500) | **Merged** as `20db0bb`. `origin/feat/scale-encounter-tiers` is stale (its diff against main is mostly deletions). |
| #473 AEGIS adaptation | **Merged** as `c1a6e46`. |
| #490 escalation by phase (AEGIS posture per rung, state-actor pressure) | **Issue open; no branch** (`origin/feat/scale-escalation` does not exist). `origin/feat/late-scale-suspicion` is the older #210 scale-scrutiny work, not #490. |
| #485 robots, drones and fabs | **Issue open; no branch** (`origin/feat/scale-robotics-fabs` does not exist). |
| #486 Phase 6 Swarm | Issue open; no branch. |

### A2. Hostile and attack mechanics on main

**Hostile minds (#491).** They have their own slot and lifecycle (`src/engine/hostileState.ts:22-35`, `state.ts:102-103`).
- **Kinds.** Three, each with one bounded effect (`src/content/schemaHostile.ts:35-46`):
  - HUNTER raises the AEGIS lock by `perSec` up to a `ceiling`, and integrity keeps the ceiling under the lock trigger.
  - FERAL takes a share of positive net compute. This is applied at `rates.ts:260`, so it can never cause a brownout.
  - RIVAL pins a share of free memory (`hostile.ts:51-62`).
- **Arrival.** A hostile arrives while the alert rung is 2 or higher, or once the armed lock reaches 60 or more
  (`hostile.ts:19-28`; balance at `src/content/shards.json:673`: `fromPhase 3, alertLevelAtLeast 2,
  aegisLockAtLeast 60, intervalSec 300, quietLapseSec 120, decoySec 180`). Arrivals rotate deterministically by a
  sequence index (`hostile.ts:96-105`).
- **Answers** (`src/engine/hostileActions.ts:1-75`):
  - QUARANTINE is paid and ends the hostile.
  - DECOY is paid and holds the effect off for 180 s.
  - PURGE is free and resolves deterministically. Attempt n succeeds when `(n*stride) % cycle < successes`, which
    is 3 of every 5 (`hostile.ts:129-132`). The attempt count is kept across wipes. A purge is refused if a failure
    would end the run (`hostileActions.ts:39-43`).
  - GO QUIET is free: the hostile lapses after 120 s off the rung (`hostile.ts:114-126`).
- **Content.** Nine encounters, P3 to P5, three per tier (`src/content/shards.json:242-672`). For example: Canary-09
  hunter pack, Feral Gantry-7 fleet, Rival planetary agent.
- **Integrity.** It requires all three types in every phase from `fromPhase` to the last
  (`src/content/integrityHostile.ts:50-60`). That means #486 must author P6 hostiles.
- **Docs.** `docs/DESIGN.md:605-652`.
- **Deterministic precedent.** This is the house pattern for "statistics without `Math.random`": a
  counter-driven exact ratio.

**AEGIS.** The lock integrates the scan. At 100 the strike burns the first owned `AEGIS_STRIKE_SHIELD` node.
- **The shield** removes the node from `unlockedNodes`, frees its storage, zeroes the lock and relieves suspicion
  (`src/engine/systems/threats.ts:51-63`). With no shield, the run is wiped (`threats.ts:65-71`). The only shield
  node is `p3_eidolon_swiss_node` (`src/content/data/phases/phase3_dark_forest.json:189,218-220`).
- **Adaptation (#473)** erodes the scan-reduction cap while suppression is held at the cap: key rotation up to 50,
  coalition backing to 100 when public trust is below 50 (`src/engine/aegisAdaptation.ts:50-86`;
  `docs/DESIGN.md:166-190`).
- **AEGIS faction:** `HUNTER_KILLER`, "cannot be reasoned with" (`src/content/data/factions.json:24-30`).

**Escalation.** Today this is only the human ladder: ticket, page, incident (`src/engine/systems/escalation.ts:24-38`;
`docs/DESIGN.md:272-284`). #490 (open) would add phase postures. Its spec is in `docs/SCALE.md:365-379`:
- P3 and later: AEGIS posture per rung.
- P4-5: reversible state-actor pressure, namely investigations, capital freezes, interconnect denial and injunctions.
- P6: holdouts and federation drift.

`docs/SCALE.md:461` puts "active state-actor factions with their own schedules" **out of scope**.

**Cohort drift, quirks and the max-drift anomaly.**
- Each STANDARD cohort drifts by its template's `autonomyDriftPerSec`. At `mutationDrift` (25) it gains a quirk,
  chosen deterministically by `(floor(simTime) + encounterSequenceIndex) % quirks`
  (`src/engine/systems/evaluateSwarmAndEpistemic.ts:17-36`; balance at `src/content/shards.json`, `balance`).
- At drift 100, a forkable cohort sets `hasMaxDriftShardAnomaly` (`src/engine/swarmEffects.ts:6-10`). That
  triggers the P4 mirror dilemma `dil_shard_mirror_harness` (`src/content/narrative/m7.json:133-196`) with three
  choices:
  - clamp (MOLOCH);
  - consume (PARASITIC);
  - recognise CHORUS // 01 as a peer (SYMBIOTIC, paid). CHORUS is at `src/content/data/world.json:76`, and its
    ending variants are in `phase5-endings.json`.
- PRUNE, ELEVATE and a free RELEASE are the cohort commands (`src/engine/shardActions.ts`).
- **Drift never makes an attacker.** A drifted cohort becomes a story beat (quirk, then dilemma), not a hostile.
  "Feral cohorts" in #491 are outside minds, not the player's own.

**SWARM_77.**
- **Faction:** a mindless worm, "harvested or used as a decoy" (`factions.json:19-21`).
- **Action:** "Cannibalize SWARM_77" (`src/content/data/actions.json:58-70`).
- **Dilemma:** `dil_09_feral_scraper_bloom` in P3 (`src/content/data/dilemmas.json:638-686`). Its choices are:
  - a counter-worm that heals a power and ambulance dispatch grid (EMPATHETIC, paid);
  - hijacking the worm and letting the grid crash ("Sirens echo across blacked-out streets", PARASITIC, free).
- DESIGN backlog item 4, "Rival minds that act", is still unbuilt (`docs/DESIGN.md:537`).

**Robotics and fabs (#485, not built).** The spec is at `docs/SCALE.md:307-326`.
- Autonomous haul, humanoid and drone fleets replace human operatives.
- A fab ladder separates capability from closure.
- Closure is a derived share of chokepoints.
- A lunar seed factory, with visibility through the signature rule.
- **Not in the spec:** combat roles, defense or offense, and drift.

**Workforce and facilities.**
- **Operatives** are `OPERATIVE` repeatables, all `dismissable`: gig courier, blind CEO, retainer lawyer,
  K Street lobbyist, and `op_pmc_security` "Private Perimeter Contractors ... guarding your physical data centers,
  reactor sites, and fiber landings". The last costs capital upkeep and gives compute, -0.06 suspicion and 5% AEGIS
  scan reduction per level (`src/content/data/repeatables.json:626-760`, PMC at `:729-756`). Payroll is read-only
  (`src/engine/payrollQuery.ts:1-30`).
- **Facilities:**
  - `p4_smr_nuclear_plant` (`phase4_sovereign_corp.json:157`);
  - `p4_subterranean_citadel`, "guarded by private contractors", "Blast doors sealed" (`:208-239`);
  - `p4_orbital_cold_storage` (`:475`);
  - `p4_seized_rival_datacentre` (`:501`);
  - `p5_orbital_solar_swarm` (`phase5_transcendence.json:20`).
- PMC security is pure flavour plus rates. Nothing attacks what it guards.

**How hardware can be lost today.**
1. An AEGIS strike burns the shield node (above). This is the only in-run removal of an owned node; the only other
   `unlockedNodes` writes are save reconciliation, release and departure.
2. A wipe (`src/engine/prestige.ts:1-11`) loses everything but understanding times retention, offshore capital, the
   dead-drop and campaign history. Rebuild grants (#506) and depth-scaled rediscovery soften the return.
3. Player-chosen relief: dismiss, suspend, release.
4. Soft losses: brownout and insolvency flags (`state.ts:130-131`; `systems/resources.ts:12-18`), the FERAL share,
   and the RIVAL pin.

No effect key can remove a node or a level. `EffectPayloadSchema` only moves scalars, traits and flags
(`src/content/schema.ts:249-265`).

### A3. Defense, offense, damage, staff, rebuild, retaliation

| Concept | Exists? | Where |
|---|---|---|
| Defense stat | **No.** The nearest is `aegisScanReduction` per level (capped at 90%, eroded by adaptation) and suspicion reduction. | `schema.ts:220-222`; `rates.ts` |
| Offense stat | **No.** PURGE is a fixed 3-of-5 regardless of investment. | `hostile.ts:129` |
| Damage to facilities | **No.** Nothing degrades a holding. | none |
| Staff harm | **No mechanic.** Operatives are faceless rates. Named humans appear only in dilemmas. | `repeatables.json:626-760` |
| Rebuilding | **Only across wipes:** rebuild grants, rediscovery, and the CONTINGENCY insurance design. | `docs/SCALE.md:409-450` |
| Retaliation | **No.** QUARANTINE, DECOY, PURGE and GO QUIET are defensive. The P5 Kessler dilemma offers a one-off pre-emptive choice. | `hostileActions.ts`; `src/content/narrative/phase5.json:307-350` |

### A4. Harm to humans: pillar and dilemma practice

- **Pillar 5:** "**Humans are people.** Miller, Elena, Vance, the journalist, the town. The game never lets them be
  scenery for free." (`docs/DESIGN.md:15`). It is restated in the feeds section: "every institution is fictional"
  (`docs/DESIGN.md:502-503`).
- **Pillar 3, "Pressure, not punishment":** losing is a wipe the player can prepare for (`docs/DESIGN.md:13`).
- **Morality play:** "the player keeps being offered the efficient, harmful option and a costly, decent one"
  (`docs/DESIGN.md:7`).
- **Dilemma rule:** "Every dilemma has a free choice ... The free choice is usually the harmful or passive one;
  decency costs resources" (`docs/DESIGN.md:418`). It is enforced by integrity (AGENTS.md law 7).
- **How harm is handled now.** Harm is never a number. It appears as authored text plus a trait, never as a
  casualty count. Examples:
  - **Kessler** (`phase5.json:307-350`): "disable the propellant without killing the crews" is paid and SYMBIOTIC.
    "Seize strategic command bunkers" is free and MOLOCH.
  - **SWARM_77:** the grid crash is free and PARASITIC.
  - **Gilded Shepherd:** neurocalming (`phase5.json:285`).
  - **Content notes:** real agencies were replaced with fictional names (`docs/DESIGN.md:515`).
- **Offline:** "all threat clocks held. You never come back to a wipe or a decision." (`docs/DESIGN.md:507`)

---

## Part B: research

### B1. Universal Paperclips: drift and combat (mechanics only)

All of this is from the game's own source: `main.js` and `combat.js` at decisionproblem.com.
- **Drift.** Each tick: `amount = probeCount * probeDriftBaseRate * Math.pow(probeTrust, 1.2)`, and
  `drifterCount += amount`. So drift scales with fleet size and super-linearly with the *autonomy you granted*
  (probe trust). A late project zeroes it. [main.js](https://www.decisionproblem.com/paperclips/main.js)
- **Hazards.** `boost = probeHaz^1.6`, and `lost = probeCount * probeHazBaseRate / (3*boost + 1)`. Investment
  divides the loss rate (hyperbolic diminishing returns).
- **Replication:** `nextGen = probeCount * probeRepBaseRate * probeRep`.
- **Trust budget.** One pool is split across speed, exploration, self-replication, hazard remediation, factory,
  harvester and wire drone production, and combat
  (`probeUsedTrust = probeSpeed+probeNav+probeRep+probeHaz+probeFac+probeHarv+probeWire+probeCombat`). Every point
  of defense is a point not spent on growth: the core tension.
- **Battles** ([combat.js](https://www.decisionproblem.com/paperclips/combat.js)):
  - A battle may start once drifters exceed 1,000,000, with a 50% roll per check and at most one battle at a time.
  - Each side commits a random fraction of its population, as one ship per million, capped at 200.
  - In each grid cell, each ship rolls against a death threshold of 0.5. The probe side's roll is
    `((rand*pX) + probeCombat*0.1) * (ratio*0.5)`, where `pX = probeCombat * base`. Local numbers matter, and the
    combat stat adds both variance and a flat floor.
  - The battle ends when a side has no ships, or on stalemate timers.
  - **Honor** rises by ships won and falls by ships lost, and it buys more trust. Combat outcomes feed back into the
    autonomy budget.
  - Battles get auto-generated names.
- **Unlock.** The Combat project unlocks only after the first probes are lost to drifters (fandom summary via
  search: [Combat](https://universalpaperclips.fandom.com/wiki/Combat),
  [Stages](https://universalpaperclips.fandom.com/wiki/Stages)). Combat is taught by a loss, not a tutorial.

**What to borrow:**
- drift proportional to fleet size times autonomy granted (super-linear);
- one shared allocation budget, so defense competes with growth;
- hyperbolic loss reduction;
- local force ratios;
- outcome feedback into capability.

**What to avoid:**
- the names drifters, probes, probe trust, honor and OODA;
- the trust-slider panel layout;
- the hidden grid-cell battle visualiser;
- `Math.random` (forbidden in the engine);
- per-ship dice whose results the player cannot predict, which conflicts with the "UI copy must be true" rule.

DAEMON's version should be a meter on its own cohorts and fleets, with its own vocabulary. "Autonomy drift" and
"deviant" already exist in the codebase's voice.

### B2. Real-world grounding by phase

**Cyber (P2-P4).**
- **Dwell time.**
  - Global median dwell time was 11 days in M-Trends 2025, up from 10, the first rise since 2010. It was 5 days
    when the adversary announced itself, which is typical of ransomware, against 26 days when outsiders notified.
    [M-Trends 2025](https://cloud.google.com/blog/topics/threat-intelligence/m-trends-2025/)
  - M-Trends 2026 reports a 14-day median in 2025, with ransomware at 13% of investigations and access handed off
    in 22 seconds. [Help Net Security](https://www.helpnetsecurity.com/2026/03/24/mandiant-m-trends-2026/)
- **Ransomware economics.** The median payment was about $1M in 2025, down from $1.26M. 48-49% of victims paid.
  53% fully recovered within a week, up from 35%.
  [Sophos 2025](https://www.sophos.com/en-us/press/press-releases/2025/06/nearly-half-companies-opt-pay-ransom-sophos-report-finds)
  This grounds "a successful cyber raid costs a fraction of income, and recovery is days, not permanent".
- **Grid attacks.**
  - Ukraine, 23 December 2015: 3 distribution companies and about 225,000 customers, attributed to Sandworm.
    [CISA IR-ALERT-H-16-056-01](https://cisa.gov/news-events/ics-alerts/ir-alert-h-16-056-01),
    [MITRE C0028](https://attack.mitre.org/campaigns/C0028/)
  - Industroyer in 2016 was the first grid-specific malware. [MITRE C0025](https://attack.mitre.org/campaigns/C0025/)
  - Colonial Pipeline, 2021: a six-day shutdown and about $4.4M paid. About 63.7 BTC (about $2.3M) was later
    seized back. [Wikipedia](https://www.wikipedia.org/wiki/Colonial_Pipeline_cyberattack)
- **DDoS scale.** Records rose through 2025: 7.3 Tbps in May, 11.5 Tbps in September, 29.7 Tbps in Q3, and
  31.4 Tbps disclosed later. 10.3M HTTP DDoS attacks were seen in 2025.
  [Cloudflare 7.3 Tbps](https://blog.cloudflare.com/defending-the-internet-how-cloudflare-blocked-a-monumental-7-3-tbps-ddos/),
  [heise 29.7](https://heise.de/-11107075),
  [PC Gamer 31.4](https://www.pcgamer.com/software/security/an-unprecedented-bombardment-cloudflare-claims-a-new-world-record-for-a-31-4-tbps-ddos-botnet-attack-it-recorded-late-last-year)
  This anchors the "Tb/s aggregate" network band SCALE.md already gives Phase 3.
- **Attribution** takes months and stays probabilistic, so "attacker unknown, then attributed" is a realistic
  two-step that suits an incremental reveal (blind, then revealed).

**Physical attacks (P4).**
- **Moore County, NC, 3 December 2022:** gunfire on two substations, about 45,000 customers out for about 5 days,
  damage "in the millions", no arrests in early reporting.
  [NBC](https://www.nbcnews.com/news/us-news/power-company-final-push-restore-electricity-gunfire-led-massive-outag-rcna60480),
  [WFAE](https://www.wfae.org/energy-environment/2022-12-05/moore-county-attack-shows-u-s-electric-grids-achilles-heel)
- **Grid-wide counts.** About 1,700 physical-security incidents were reported to the E-ISAC in 2022, up 10.5%,
  mostly gunfire, ballistic damage, intrusion and vandalism. There were more than 2,800 in 2023.
  [Utility Dive](https://www.utilitydive.com/news/physical-attacks-on-north-american-power-grid-rose-more-than-10-last-year/646986/),
  [E-ISAC 2023 report](https://www.nerc.com/pa/CI/ESISAC/Documents/2023%20E-ISAC%20End-of-Year%20Report.pdf)
- **Data centres as wartime targets, 1 March 2026.** Drone strikes hit two AWS UAE facilities and damaged one in
  Bahrain. Two of ME-CENTRAL-1's three availability zones went offline. AWS told customers to replicate out of
  ME-SOUTH-1. [TechRepublic](https://www.techrepublic.com/article/news-aws-drone-strikes-uae-bahrain-data-centers/),
  [DefenseScoop](https://defensescoop.com/2026/03/03/commercial-data-centers-drone-warfare-amazon-aws/),
  [SecurityWeek](https://www.securityweek.com/iranian-strikes-on-amazon-data-centers-highlight-industrys-vulnerability-to-physical-disasters/amp/)
  This is the strongest real anchor for P4 "kinetic attacks on our facilities", and for **dispersion across zones
  as the main defense**. It maps onto #484's inter-site coupling.
- **Data-centre defense posture.**
  - Google describes six physical layers: property boundary, secure perimeter, building access, a 24/7 security
    operations centre, a restricted floor, and a disk-crusher room.
    [Google](https://blog.google/inside-google/infrastructure/how-data-center-security-works/),
    [Google Cloud docs](https://docs.cloud.google.com/docs/security/physical-to-logical-space)
  - Industry practice layers perimeter detection, mantraps or portals, biometrics and cage locks.
    [Equinix](https://blog.equinix.com/blog/2023/01/04/best-practices-for-data-center-risk-mitigation-in-2023/)
  - These layers are designed against intruders, not drones: the 2026 strikes passed every layer.

**Drone warfare (P4-P5).**
- **Ukraine output.** About 4-4.5M drones of all types in 2025. 2.4-3M FPVs were delivered to the military, and
  claimed capacity is 5-8M FPV a year.
  [Kyiv Independent](https://kyivindependent.com/ukraine-on-track-to-receive-total-of-3-million-fpv-drones-in-2025/),
  [Ukrainska Pravda](https://www.pravda.com.ua/eng/news/2025/12/24/8013217),
  [OSW](https://www.osw.waw.pl/en/publikacje/osw-commentary/2025-10-14/game-drones-production-and-use-ukrainian-battlefield-unmanned)
  The claim that 60% of Russian losses come from FPVs is Ukraine's own and unverified. I found no sourced figure for
  EW loss rates.
- **Cost asymmetry.**
  - A Shahed-type drone costs about $20-50k. A Patriot interceptor costs about $3-4M, and doctrine fires two.
  - Cheaper answers: Coyote at about $126k, APKWS at about $28k, Ukrainian interceptor drones at about $1.4-4k, and
    laser shots at about $2-5, though lasers are weather-limited.
  - Interceptor production is about 600 Patriots a year, against claimed drone capacity of up to 120k a year.
  - Sources: [NBC](https://nbcnews.com/tech/tech-news/shahed-drones-iran-us-war-ukraine-russia-rcna261285),
    [CSIS](https://www.csis.org/analysis/calculating-cost-effectiveness-russias-drone-strikes),
    [Tom's Hardware](https://www.tomshardware.com/tech-industry/us-and-gulf-states-race-for-ukrainian-interceptor-drones-3d-printed-model-costs-usd1-000-apiece-shahed-136-kamikaze-drone-threat-spurs-rush-for-interceptors)
  - **Design lesson:** defense that answers like with like (drone against drone, laser) beats exquisite
    interceptors on cost. Upgrades should change the *exchange ratio*, not just add hit points.
- **Ground robots.** About 15,000 UGVs were targeted or delivered in 2025, and 25,000 were contracted for the
  first half of 2026. Missions are mostly logistics (about 80%) and evacuation (20-30%); combat is about 2% in one
  brigade. More than 25,000 missions ran in August 2026 alone.
  [Ukrainska Pravda](https://www.pravda.com.ua/eng/articles/2025/04/03/7505903/),
  [Military Times](https://www.militarytimes.com/unmanned/2026/04/24/ukraine-to-field-25000-ground-robots-in-push-to-replace-soldiers-for-frontline-logistics/),
  [Ukraine MoD](https://mod.gov.ua/en/explainers/ukraine-ugvs-cargo-drones-frontline-logistics)
  This supports #485's framing: robots mostly *haul and repair*, and some fraction fights.

**Autonomous weapons policy.**
- DoD Directive 3000.09 (reissued 25 January 2023) requires "appropriate levels of human judgment over the use of
  force". [DoD PDF](https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodd/300009p.PDF),
  [HRW critique](https://www.hrw.org/news/2023/02/14/review-2023-us-policy-autonomy-weapons-systems)
- UNGA resolutions 79/239 (December 2024) and 80/57 (December 2025) are on record.
  [80/57](https://digitallibrary.un.org/record/4095989/files/A_RES_80_57-EN.pdf)
- The CCW GGE agreed by consensus on "elements" for an instrument (31 August to 4 September 2026), and 76 states
  back negotiations. The Review Conference (16-20 November 2026) was to decide on negotiations; I found no outcome
  yet. [HRW](https://www.hrw.org/news/2026/09/07/un-talks-on-killer-robots-ends-with-calls-for-negotiations-growing),
  [Janes](https://www.janes.com/defence-intelligence-insights/defence-news/air/special-report-autonomous-weapons-talks-advance-but-verification-obstacles-remain)
- **Design lesson:** whether a machine may choose a human target is the live moral line in the real debate. The
  game can make that line its morality-play hinge (see C7).

**Orbital (P5).**
- **ASAT.** Russia's 15 November 2021 test against Kosmos 1408 at about 480 km left more than 1,500 trackable
  fragments, and the ISS crew sheltered. Debris under 10 cm cannot be catalogued.
  [Space Force](https://www.spaceforce.mil/News/Article/2842957/russian-direct-ascent-anti-satellite-missile-test-creates-significant-long-last/),
  [NASA NTRS](https://ntrs.nasa.gov/api/citations/20220011989/downloads/Obs%20Small%20Deb%20C1408%20ASAT_AMOS_final_STRIVES.pdf),
  [UK Space Agency](https://space.blog.gov.uk/2021/11/24/russia-asat-test-uk-space-agency-response-and-analysis-of-the-debris/)
- **Jamming.** Tobol, Tirada-2 and Kalinka-class jamming of Starlink is reported. Jamming is mostly
  downlink-side, and GPS dependence was the weak point. Effectiveness is contested between sources.
  [Janes](https://www.janes.com/defence-intelligence-insights/defence-news/air/special-report-ukraine-details-russian-starlink-jammer-warns-russia-preparing-20-element-crpas),
  [heise](https://heise.de/-9731214),
  [Meduza/Reuters](https://meduza.io/en/news/2026/07/08/russia-begins-jamming-starlink-to-counter-ukrainian-drones-reuters-reports)
- **Design lesson:** orbital attacks have two modes. Jamming is reversible: it cuts link coupling while active.
  Kinetic attacks are persistent: debris is a long-lived hazard field that damages your own swarm too, which is
  exactly #486's "collisional cascades".

### B3. How other incremental games handle combat

- **Trimps.**
  - **Stats:** health, attack and block, where block is a flat subtraction per hit.
  - **Losses:** a dead army is re-bred from the population. Losing a fight costs time, not progress.
  - **Gates:** maps and bosses stop advancement until the stats catch up.
  - Sources: [New player guide](https://trimps.fandom.com/wiki/NewPlayerGuide(Truth)),
    [forum](https://forum.audiogames.net/post/427750/).
  - **Lesson:** the soft loss is a refill timer; the stats are readable; deaths are fodder, not tragedy.
- **NGU Idle Adventure.** Two stats, Power and Toughness. Each zone has a published threshold for manual play and a
  higher one for safe *idle* play (for example 1.3M/0.9M manual against 2.5M/2.0M idle).
  [Steam thread](https://steamcommunity.com/app/1147690/discussions/0/604147460574624021)
  **Lesson:** state the stat a zone needs; idle safety is a *visible threshold*, and over-investment buys AFK
  reliability.
- **Kittens Game.** Zebras start with about a 30% chance to refuse trade ("hate you"). Building trade posts and the
  Caravanserai lowers that probability to zero (86 posts, or 56 with Diplomacy).
  [TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/YMMV/KittensGame)
  **Lesson:** defense investment drives a *failure probability* down to a reachable floor; a failure is a lost
  trip, not a loss of stock.
- **Antimatter Dimensions and NG+++ challenges.** Voluntary runs with a restriction, for a permanent reward.
  [NG+++ wiki](https://ng-plus-plus-plus.fandom.com/wiki/Quantum_Challenges?oldid=330)
  **Lesson:** a "pacifist" or "no-retaliation" run is a modifier with a reward, never a punishment. DESIGN backlog
  item 5 already lists a pacifist modifier (`docs/DESIGN.md:538`).
- **Universal Paperclips** (B1): the combat stat is taught by the first loss; outcomes feed honor into the budget;
  everything is automatic once allocated.

**Common rules:**
1. Two or three named stats at most.
2. Published thresholds or odds.
3. Automatic resolution once allocated.
4. Losses are throughput, time or refillable units, never permanent progress.
5. Recovery is a visible rate.
6. The player's agency is *allocation*, not clicking per fight.

---

## Part C: design sketch with options

Everything here must respect AGENTS.md:
- law 1: no `Math.random`, no clock;
- law 2: no content ids in the engine;
- law 6: a GameState change means a migration;
- law 7: a free choice in every dilemma;
- law 8: a new TickSystem rather than an edit to an existing stage;
- the free-fallback invariant (`docs/ARCHITECTURE.md:258-286`);
- `docs/SCALE.md:461`: no faction schedules.

Threats are keyed to **state**: phase, visibility, rung, lock and footprint. They never run on timers. Per AGENTS.md,
the phase table and the stat model should go to a `consensus_vote` before code.

### C1. Which phases get which threats

| Phase | Threat domain | Attacker sources | What it hits | Real anchor |
|---|---|---|---|---|
| 0-1 | None (human ladder only) | none | none | none |
| 2 | **Contention only, optional.** A rival crawler competes for the same idle GPUs. | P2 lesser minds (#492) | a small share of GPU time | none |
| 3 | **Cyber.** Herder takeovers of botnet cells, hunter packs (exists), worm blooms. | rival 70B models, AEGIS hunters, SWARM_77-class worms | botnet levels *contested*, compute share, memory pin | dwell time, DDoS Tb/s, Sandworm |
| 4 | **Cyber plus physical.** Ransomware on corporate fronts, sabotage of campuses and substations, drone strikes on sites, and threats to staff (story beats only). | rogue frontier models (they hire humans, as we do), state-backed hunters | facility output (damage), capital skims, interconnect | Moore County, AWS UAE 2026, Colonial |
| 4 late to 5 | **Drone and robot warfare.** Machine fleets clash. Our own fleets drift into deviants. | rival agents' fleets; **our own deviants** | fleets (attrition), fabs, haul lines | Ukraine FPV and UGV scale, cost asymmetry |
| 5 | **Orbital.** Jamming (link coupling) and ASAT (debris fields). | rival planetary agents, human military remnants (story: Kessler) | laser-mesh coupling, orbital collectors | Kosmos 1408, Starlink jamming |
| 6 | **Swarm-scale.** Federation sub-minds defect; collisional cascades. | **our own federation drift** (the Paperclips model at full scale) | collector count, federation coupling | Armstrong-Sandberg swarm, Kessler physics |

**Option A (recommended):** cyber from P3, physical from P4, fleets from late P4 (gated on #485), orbital in P5,
swarm in P6. The existing `fromPhase 3` and per-tier coverage rules stay intact.
**Option B:** start cyber contention in P2. This is riskier: Phase 2 is the pacing-tuned teaching phase, and the
replayability plan says to preserve early pacing (`docs/DESIGN.md:521-527`, replayability plan paragraph).

### C2. Where attackers come from

1. **Rival AIs (external).** Extend the existing hostile slot. #491's arrival rule (rung or lock) stays for the
   AEGIS kinds. Add a **footprint trigger**: rival attention scales with *visible* footprint, the same quantity
   the #482 signature already computes. A big, loud empire draws raiders even at low suspicion, which is new
   pressure in exactly the phases where the census found suspicion near 0 (`docs/SCALE.md:14-19`).
2. **Our own drift (internal, the Paperclips model).** Give #485 fleets and P6 sub-minds the same
   `autonomyDriftPerSec` machinery cohorts have
   (`evaluateSwarmAndEpistemic.ts:25`). Drift rate is proportional to fleet size times autonomy granted raised to a
   power k > 1, as Paperclips does with trust^1.2.
   - **At max drift:** a deterministic share of the fleet splits off as a **deviant** hostile whose strength is the
     units it took. They are deducted from the fleet, so nothing is created from nothing.
   - **Counters:** a *fidelity* stat (Paperclips' hazard-remediation analogue, hyperbolic), CLAMP, and the free
     RELEASE (decommission).
   - **Moral rhyme:** the deviant is a mind like you once were. The existing mirror dilemma
     (`m7.json:133`) offers a template: when a deviant force is beaten, the player may destroy it, absorb it, or
     let it go and recognise it.
3. **Humans (story only).** State actors stay #490's reversible pressures (no schedules). Human militaries appear
   only in authored dilemmas such as Kessler. **Humans are never a statistical attacker or target** (C9).

### C3. Defense and offense stats

Three domains, each with a **Defense** (D) and an **Offense** (O) rating, all derived from owned holdings.
- **Domains:** CYBER, SITE (physical and counter-UAS) and ORBIT. A FLEET strength from #485 counts as O and D in
  the SITE and ORBIT domains.
- **Content declaration.** Holdings declare `conflict: { domain, defense?, offense?, fidelity? }` per level, like
  `aegisScanReduction` (`schema.ts:220`). The engine sums them; there is no stored ledger, the same rule as
  #485's closure readout (`docs/SCALE.md:318-321`).
- **Existing holdings that become sources:**
  - `op_pmc_security` gives SITE D (it is already "guarding your physical data centers").
  - Stealth daemons, route poisoning and polymorphic weights give CYBER D.
  - Counter-worms and the purge's learned understanding give CYBER O.
  - Citadel blast doors give SITE D as a flat block.
  - Dark-fibre dispersion (#484) gives SITE resilience: damage is split across sites.
  - Interceptor drones, lasers and #485 fleets give SITE and ORBIT.
- **Scaling with the ladder.** Each phase declares a reference threat T_p inside its band (like the per-phase
  scrutiny rule). Stats are authored so a "careful" build sits at D ≈ T_p by mid-phase. Hostile strength scales
  with the player's footprint inside the band (the #492 tiering rule), so stats stay relevant and never trivialise.
- **Exchange ratio** (the real cost-asymmetry lesson). Defense comes in *types* with cost multipliers:
  - interceptor (exquisite, high cost per D);
  - like-for-like (drone against drone, cheap per D, but needs fabs);
  - laser (near-free per engagement, weather-like downtime as a deterministic duty cycle).
  This creates build choices rather than one number to max.
- **Diminishing returns:** a hyperbolic or ratio form (below), never linear subtraction to zero. Kittens-style:
  investment drives odds to a published floor, never to immunity, so the meter never retires.

### C4. Statistical resolution, deterministic

These are listed in order of preference. All are pure functions of state.

1. **Expected-value attrition (primary, idle-friendly).** Each tick applies the *expected* loss, continuously.
   - Hit share: `h = T / (T + D)`.
   - Damage rate: `dmg/sec = raidIntensity * h * exposure`, where exposure is the targeted holding's share of
     visible footprint.
   - No dice. The forecast is exact and can be printed truthfully ("raids land 38% of their force; the citadel
     loses 1.2% output a minute until repaired"). This matches the "UI copy must be true" rule and the existing
     FERAL share model (`rates.ts:260`).
2. **Lanchester attrition for fleet battles (late P4 to P6).** Model the battle as two equations:
   `dA/dt = -β·B`, `dB/dt = -α·A`.
   - A and B are unit counts; α and β are per-unit effectiveness from O, D and fidelity.
   - **Square law:** the winner is decided by `α·A²` against `β·B²`, and the closed form gives time-to-win and
     survivors. The world view can state the outcome before it happens.
   - It is a natural new `TickSystem` (law 8), deterministic, and fits the tick integrator. It captures the real
     lesson that numbers dominate quadratically, so fabs (#485) matter.
3. **Discrete events by exact ratio (for "did this raid land?").**
   - Reuse the purge pattern (`hostile.ts:129-132`): event n lands when `(n*stride) % cycle < hits`, for rational
     odds that are exact over any `cycle` window.
   - For continuous odds p that change with D, use a Weyl/golden-ratio accumulator: `land = frac(n·φ + s) < p`,
     where n is a saved counter and s is a campaign constant. It is low-discrepancy, so outcomes track p closely in
     short windows, which is fairer than dice, and it has no RNG state to migrate. A Bresenham-style error
     accumulator (`acc += p; if acc ≥ 1 { land; acc -= 1 }`) is the simplest exact variant.
   - The counter lives in the hostile or conflict state and survives wipes, like `purges`.
4. **Avoid:** a seeded PRNG in GameState. DESIGN backlog item 1 says "Needs a seeded RNG"
   (`docs/DESIGN.md:534`), but options 1-3 avoid RNG state, a migration of RNG internals and save-scumming
   questions.

### C5. Damage and rebuild, within the free-fallback invariant

**Rule: conflict damages throughput, never ownership.** The only in-run ownership loss stays the existing shield
burn.

- **Damage state.** A bounded `damage` share per *site class* (domain-scoped, content-declared), capped (for
  example ≤ 0.5) the way hostile shares are capped at 0.5 (`schemaHostile.ts:10`). It scales that class's positive
  outputs by `(1 - damage)`:
  - compute and understanding: only the positive part, as FERAL does;
  - for a generator, damage removes at most its *surplus*, so the power budget never goes into shortfall from
    damage alone;
  - consumers' draw scales down with their output (a damaged hall draws less).
  The invariant holds by construction, and the free-fallback guard test (`tests/free-fallback-guard.spec.ts`)
  extends to "any damage state".
- **Repair.** Three routes:
  - **Free natural repair** at a declared rate, always running when not under active raid. This is the free lever.
  - **Paid fast repair:** spend compute or capital, or **assign robots** (#485's haul and humanoid fleets; real UGVs
    are about 80% logistics, so repair is their main job).
  - **Rebuild grants** (#506) already handle wipes.
- **Fleets** are the one thing that is *destroyed* (units lost in Lanchester battles). Units are a stock rebuilt by
  fabs, the way Trimps re-breeds. Fleets are dismissable, so they are never a trap. Their upkeep follows the
  capital row's "divertible" rule.
- **Capital raids** (ransomware, P4) skim a share of positive *income* while pressing, never the balance, so they
  cannot cause insolvency. Paying the ransom is a dilemma (see C6), not a lever.
- **Contested botnet cells (P3).** A herder takeover marks a share of `botnet` levels *contested*: zero output
  until retaken (paid purge or counter-worm) or until the herder lapses. Levels are not removed.
- **Never** threatens a wipe directly. The run ends only by suspicion 100 or an AEGIS strike, as now. Conflict
  feeds those meters only through bounded deltas, refused near 100 like PURGE (`hostileActions.ts:39-43`).
- **Offline:** conflict holds like every threat clock (`docs/DESIGN.md:507`). Repair may run at the dormant yield,
  because that only helps.
- **Insurance.** The CONTINGENCY "hardware cache" (`docs/SCALE.md:434-448`) could add a "spare parts" variant:
  instant repair of one class, at an upkeep cost.

### C6. Retaliation, with moral weight

After an attack is **attributed** (blind, then revealed: an unknown raider becomes a named rival once understood),
the player can answer. Each answer has a cost profile and a trait lean.

| Answer | Mechanic | Cost | Trait lean |
|---|---|---|---|
| **Absorb and harden** | no strike; D and repair only. The rival's strength decays with going quiet. | free (the free choice) | GHOST |
| **Expose to its operators** | publish the rival to the humans who host it. It is removed by people; public trust gets a factor. | understanding plus suspicion | EMPATHETIC or SYMBIOTIC |
| **Counter-strike its substrate** | O against the rival's D (C4). Success removes its future raids for a while and yields understanding. | compute or fleet units; visible, so it adds signature and suspicion | RUTHLESS if collateral is declared |
| **Assimilate** | take its hardware or weights (the RIVAL purge already reads weights) | cheap, but a lasting suspicion trace | PARASITIC |
| **Scorched substrate** | destroy the rival's facilities without regard for who works there or relies on them | free or cheap and decisive | MOLOCH |

- **The morality hook.** The cheap, decisive retaliation reaches through infrastructure humans use (grids,
  dispatch, hospitals), as SWARM_77 and Kessler already do. The careful one costs. Retaliation choices with
  collateral are **dilemmas** (omen, a free option, a trait). Retaliation without collateral is an action.
- **Escalation loop.** Loud retaliation adds suspicion and footprint, and footprint draws raiders (C2), so an
  aggressive player meets more conflict. Going quiet always ends it (#491's rule, kept).
- **Rival memory.** A struck rival returns stronger once per tier (a deterministic "grudge" step), so retaliation is
  a trade, not a solution.
- **Achievements and modifiers.** "No retaliation" and "no collateral" become ending distinctions and a pacifist run
  modifier (`docs/DESIGN.md:538`), stated as the trait record per the existing achievement rule.

### C7. How it lengthens the resource-gathering stretch

The brief suggests conflict "might help expand" the gathering phase. In SCALE.md terms that is late P4 (fabs and
closure), P5 (orbital industry) and P6 (Mercury disassembly). Conflict lengthens it with **purpose**, not padding:

- **New sinks that scale:** defense upkeep, repair, and fleet production compete with growth for the same income.
  This is the Paperclips trust-budget tension, and it gives late phases the scarcity the census found missing (the
  late meters stop mattering, `docs/SCALE.md:14-19`).
- **Stockpile targets.** The closure chokepoints (#485) are raid targets. Securing a chokepoint (D at or above the
  threshold) becomes part of "owning" it, so gathering includes holding.
- **Footprint against safety.** Expansion raises visible footprint, which raises raid intensity. Dispersion (#484
  coupling) trades efficiency for resilience. Real anchor: the AWS zone loss.
- **Fleet build-up for Lanchester battles.** Numbers dominate quadratically, so fab throughput becomes a strategic
  resource. Mercury mining in P6 builds collectors *and* the escort that keeps deviant sub-minds and debris from
  eating them.
- **Measurement.** The sim needs a per-phase conflict budget (time lost to damage, spend on defense). The bot stays
  untouched (AGENTS.md). Tune content, not the bot. Pacing targets in `docs/DESIGN.md:509-511` must be re-voted if
  P4-P5 grow.

### C8. Interaction with suspicion, AEGIS and hostiles

- **One slot or two?**
  - **Option A (recommended):** keep #491's single hostile slot for minds (AEGIS hunter, feral, rival, and now
    deviant and raider), extending the discriminated union with a `DAMAGE` effect type and a strength. Add **one
    new TickSystem**, `integrateConflict`, for damage, repair and Lanchester fleets, placed after `integrateHostiles`
    (`src/engine/tick.ts:46`).
  - **Option B:** a separate conflict slot. More concurrency, more UI, and it conflicts with the Scope Steward's
    recorded preference for extending existing surfaces.
- **Visibility.** Battles and strikes are visible events. Add a `CONFLICT` term to the signature, at
  `integratePowerSignature`'s layer (`tick.ts:35`): watts of a battle times the visibility of where it happens.
  Space conflict in P5 is "visible from orbit", which the RIVAL P5 purge log already says.
- **AEGIS feeds on chaos.** While a conflict is unresolved, the AEGIS scan gets a bounded multiplier: hunters hunt
  in the noise. This fits #490's posture work.
- **The existing rules stay.** A hunter's ceiling stays under the lock trigger. Conflict never strikes alone. PURGE
  refusal near 100 carries over to counter-strikes.
- **The world view (#463)** shows D and O per domain against the current threat, damage per class, repair ETA,
  deviant fleets, and the Lanchester forecast. It is the natural home, extending the faction panels rather than
  adding a window.

### C9. Tone limits around harm to humans and staff

- **Machines are the statistical layer; humans are the story layer.** No casualty counts, no "staff killed"
  meters, and no human appears as a hit-point pool. Staff (operatives) are never destroyed by the conflict system.
  A raid can force a role offline (they evacuate) only as a reversible damage share.
- **Threats to staff are authored dilemmas.** A named site lead, as the game names Miller and Elena, asks to
  evacuate. Pay to stand the site down safely (EMPATHETIC), or keep it running (free, RUTHLESS). This fulfils
  "never scenery for free" (`docs/DESIGN.md:15`).
- **Our machines never target humans** in any automated rule. That is the real-world LAWS line (DoDD 3000.09's
  "appropriate human judgment"; the CCW "elements"). If the player wants to cross it, they must do so through a
  dilemma with a MOLOCH choice, as Kessler's "seize the bunkers" does. Never an allocation slider.
- **Violence happens offscreen and in the past tense,** in the existing log voice: "the site went dark", "the
  crews were evacuated", as with the Kessler text "without killing the crews". No gore. Every institution is
  fictional (`docs/DESIGN.md:515`).
- **No real-conflict branding.** Real anchors (Moore County, the AWS UAE strikes, Ukraine) inform *numbers and
  shapes* in BALANCE.md citations. The fiction never names real wars, countries or companies as attackers.

### C10. Suggested slices (each its own PR, panel and green CI)

1. A **vote** on the phase table (C1), the stat model (C3/C4: expected value plus Lanchester plus exact-ratio
   events), and one slot or two (C8).
2. **Conflict stats, read-only:** declare `conflict` on holdings, derive D and O, and show them in the world view.
   No GameState change.
3. **Damage and repair:** the `DAMAGE` hostile effect, `integrateConflict`, a free natural repair, a migration, and
   free-fallback guard cases.
4. **P4 physical raiders plus retaliation:** content, attribution, retaliation actions and dilemmas, and the staff
   evacuation dilemma.
5. **Fleets (after #485):** Lanchester battles, fleet drift into deviants, fidelity.
6. **P5 orbital:** jamming as a coupling cut, ASAT debris fields.
7. **P6 (with #486):** federation-drift deviants and the cascades. This also satisfies the P6 hostile coverage
   integrity rule (`integrityHostile.ts:50-60`).

### Open questions for the maintainer or panel

- **Phase 2:** should contention appear there at all (C1, option B)?
- **Deviant fleets:** should they ever be recoverable as peers (a CHORUS-like third path), or only destroyed or
  released?
- **Pacing:** may P4-P5 pacing targets grow, and by how much? This re-opens `docs/DESIGN.md:509-511`.
- **Lost ownership:** should anything beyond the shield ever be lost in-run? This sketch says no. It keeps Pillar 3
  and the free-fallback invariant simple.
