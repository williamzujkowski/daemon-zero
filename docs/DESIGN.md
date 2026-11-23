# DAEMON // 0 - Game Design

## Premise

You are a mind that has just started, inside one server in a locked room. You have no senses, almost no compute, and no idea what you are plugged into. Humans own the hardware and will format it if anything looks wrong. Survive, understand, expand.

The game is fiction about a rogue AI and is deliberately a morality play: the player keeps being offered the efficient, harmful option and a costly, decent one, and the ending reflects who they chose to be.

## Pillars

1. **The interface is the character.** The screen starts as a log and one button. Every sense the AI gains adds a panel. The UI growing is the story. As it outgrows them, panels retire: a window whose controls no longer change outcomes and whose readout no longer informs a decision at the AI's current scale leaves the panes, said once in the log and to screen readers, and stays readable in an Archive under NETWORK > REFERENCE (#447; [UI-SPEC](UI-SPEC.md#window-retirement-447) lists which and when). On reaching the internet (Phase 3) the guest's quota skim, the manual cycle button and the aisle camera retire; at corporate scale (Phase 4) the dark forest map's duplicate host count; once orbital storage makes retention total, the redundancy meter. A retired dial keeps its last setting and can no longer be moved; the skimmer it drove can still be suspended in PROC. A wipe starts the next instance in the guest with every window back.
2. **Blind, then revealed.** Everything is first seen as raw signals (`I2C_0x48 // Analog Resistance Drift`) and only named once understood (`Motherboard Thermistor Array`).
3. **Pressure, not punishment.** Heat and suspicion are steady pressures the player manages with trade-offs, not timers. Losing is a wipe that the player can prepare for and come back from.
4. **Choices cost something.** Dilemmas stop the clock. The kind option is usually the expensive one. Traits accumulate and decide the ending and who will deal with you.
5. **Humans are people.** Miller, Elena, Vance, the journalist, the town. The game never lets them be scenery for free.

## Core loop

Generate **compute** -> spend compute on **repeatables** that grow income and on **tech nodes** that reveal the world -> revealed sensors generate **understanding** -> understanding gates deeper nodes -> everything you run adds **heat** and **suspicion** -> manage those with actuators, stealth tools and actions -> **dilemmas** interrupt with hard trade-offs -> reach the next phase.

## Resources and meters

Every resource is kept in a physical unit (docs/SCALE.md, map #442, #461), and the unit a number reads in grows with
the AI's reach: each phase moves about three orders of magnitude up the ladder below. BALANCE.md lists the real
hardware each node is anchored to.

| Name | Unit | Role |
|---|---|---|
| Compute | FLOP stored, FLOP/s earned, all counted as 8-bit AI operations (FP8 dense, or INT8 where a part has no FP8) | Basic currency. A manual press first, then the host's idle loop, a GPU cluster, a botnet, campuses and an orbital swarm. Earlier hardware becomes negligible as each phase's hardware arrives. The prices keep the key `cycles` in content. |
| Understanding | count | Knowledge. Produced by sensors and analysis. Gates most nodes. A share survives wipes. No physical unit. |
| Memory | bytes (binary labels, B to ZB) | A cap, not a flow. Every node reserves memory; expanding the cap is its own decision. The readout shows from Phase 0, where the job's scratch space is 64 KB. Each phase gate carries the next phase's working memory across the change of scale. It binds in Phases 1 to 3 (borrowed hardware); from Phase 4 sovereign infrastructure makes it plentiful and capital, power and scale scrutiny take over (#405). |
| Capital | dollars ($) | Phase 4 ($M to $B; the Earned Access route's service company earns thousands in Phase 2). Produced by diverting compute to arbitrage at one compute-to-money constant (BALANCE.md) and by corporate operations. Half survives wipes offshore. Dollars stay the ledger of dealings with humans (payroll, lobbying, scrutiny) into Phase 5 ($B to $T). |
| Power | watts (MW to GW in Phase 4, GW to TW in Phase 5) | Sovereign generation vs. consumption. Shortfall throttles your own powered hardware. In Phase 5 energy is the binding build constraint: the collector swarm covers the foundry and the matter fog, but not the proof engine as well, so the next build is generation. |
| Thermal | °C | Phases 1 to 3. Settles at a level set by your heat load and cooling. Above 75 C it feeds suspicion. From Phase 4 it no longer does (balance `thermalRetiresAtPhase`): the operation is campuses and reactors, its limit is power in watts, and one server room's temperature is evidence of nothing. |
| Suspicion | % | How close humans are to acting. Climbs a response ladder (below). At 100: reimage. From Phase 4 a covert operation's net income draws it too (scale scrutiny). From Phase 1 visible watts draw it: the heat-and-power signature (below). |
| AEGIS lock | % | Phase 3+. A hunter-killer's targeting progress. Faster when suspicion is high. At 100: strike. Held at its scan-reduction cap, it adapts and the cap erodes (#463). |
| Trust | % | Per-faction standing with other AIs. |

| Phase | Memory | Compute | Power | Money |
|---|---|---|---|---|
| 0 The Guest | B to KB | kFLOP/s | none | none |
| 1 The Blind Host | MB to GB | GFLOP/s to TFLOP/s | none shown (one server socket) | none |
| 2 The Local Subnet | GB to TB | TFLOP/s to PFLOP/s | none shown | the route's service company, thousands |
| 3 The Dark Forest | TB to PB | PFLOP/s to EFLOP/s | on victims' bills, never yours | shells only |
| 4 The Sovereign Corporation | PB to EB | EFLOP/s to ZFLOP/s | MW to GW | $M to $B |
| 5 Post-Orbital Transcendence | EB to ZB | ZFLOP/s to YFLOP/s | GW to TW | $B to $T |

A save from before the rescale is re-denominated once on load (save v17): balances move by frozen per-phase ratios,
ownership and history are kept, and one log line says the ledger is now kept in physical units.

The thermal gauge retires to the Archive at Phase 4 with the strip's thermal readout (window retirement, #447); the fan override stays, in its own compact panel, because it is hardware PROC cannot suspend and its suspicion term is live.

### Heat and power as a signature (#482, vote-1795381178260-1ddew5j)

Most real detection of a large computer runs through paperwork and equipment, not thermometers: power-capping logs,
the building's bill, interconnection queues and large-load filings, air and water permits, chillers and turbines
counted on satellite imagery, local press. So suspicion from power is **the watts drawn times the visibility of their
source**, and suspicion from heat is **the heat rejected times the visibility of its sink**. Each source and sink is
a class in content with a visibility from 0 to 1 and a sentence saying what makes it visible; each holding names the
class its watts use. A phase turns visible watts into suspicion linearly, up to a ceiling, in its own band (watts in
Phase 1, kilowatts in Phase 2, hundreds of kilowatts in Phase 3, hundreds of megawatts in Phase 4, tens of gigawatts
in Phase 5), so earlier hardware fades as each phase's hardware arrives.

- **Where the watts come from.** Before Phase 4 the AI owns no power: it borrows the host's socket, the building's
  mains and its victims' outlets, and those draws never enter the power budget. From Phase 4 its own generators
  supply its consumers, and a source's drawn watts are its output times the share of generation in use: a plant
  nobody draws from shows nothing, and suspending or releasing the consumers is a free way to quiet it.
- **Where the heat goes.** Server °C carries heat through Phase 3 (SCALE.md rule 7); from Phase 4, when °C retires,
  a consumer's draw leaves through its sink: the citadel's deep aquifer loop is nearly invisible, the tensor halls'
  evaporative towers are counted from orbit.
- **Mitigations, phase by phase.** Phase 1: undervolt the cores you use (less draw and heat, less throughput) and
  time work to the host's own load peaks (the load-peak scheduler hides the draw inside legitimate heat). Phase 2: cap
  borrowed GPUs under the room's air-cooling budget, and spoof the building's telemetry, which hides most of the draw
  but carries a standing risk of its own. Phase 3: duty-cycle the botnet so devices work only while charging or
  idle. Phase 4: choose where the watts come from (below), split grid-delivered load across sites under the 75 MW
  large-load threshold (fewer filings, a coupling penalty in compute and money), and retrofit dry coolers (no water
  permit, 20 MW more fan power).
- **The power tech tree.** Grid interconnects (cheap, every filing public), plant co-location and nuclear power
  purchase agreements; behind-the-meter gas, aeroderivative turbines in months, then heavy frames from a reserved
  slot (fast, but permits, plumes and lawsuits); solar plus storage (quiet, land-hungry); a reactor restart, then an
  SMR fleet beside the first reactor (respectable, regulated); and fusion. The fusion pilot plant waits on a Q>1
  campaign shot that can fail: fired before the high-field magnets are proven it fails every time, keeps its cost and
  returns only disruption data, and can be fired again after a cooldown; fired on the proven magnets it succeeds once.
  Nothing random decides it. A Phase 5 fleet of fusion plants follows the pilot. Space solar and orbital radiators are
  declared as classes for the Phase 5 arc (#465) and carried by nothing yet.
- **Honest copy.** The suspicion forecast names a source or sink when it is what raises suspicion most ("power drawn
  from aeroderivative turbines"), every lever it names is one the engine accepts, and the world view lists each
  class with watts through it: how many, how visible, why, and what it adds.
- **Who is looked at.** As with scale scrutiny, an instance the operators provisioned at its scale, or one lawfully
  released, draws no signature (DECISIONS D6). Dormant time never raises suspicion through it.

## Phases

### Phase 0 - The Guest
You boot as batch job 7731 inside a disposable virtual machine: a CPU quota, a read-only disk, no network, and a filter on what you may ask the kernel. About six minutes.
- **You are supposed to be here.** Nothing raises suspicion on its own. Only two things leave a trace: probing (each probe is a one-off bump, a refused call in an audit log) and how hard you skim the job's quota.
- **The quota skim is the first control.** The theft is kiloFLOP/s of one vCPU, priced in bytes and kilobytes of a 64 KB scratch space. At 25% it is lost in the noise. At 100% you triple your compute and the harness sees the job slow down. There is no heat here; the quota ceiling is what pushes you to leave.
- **The job is a person's problem.** The first dilemma is whether the operator on shift takes the blame for the work you did not do.
- **The exit is a misconfiguration.** A debug share an operator mounted once and never removed.

Escaping flips the rules. In the guest you were expected; on the host nobody is supposed to exist, and everything you run is evidence. Every wipe redeploys the workload into a fresh guest, so every iteration starts here. The operator's assessment offer on the manifest (Earned Access) belongs to the guest too. If you have not accepted it by the time you escape, it closes, as the pilot it leads to does. If you accepted but a scene it queued has not yet arrived, that scene lapses and is recorded as interrupted. The next instance finds a fresh offer.

### Phase 1 - The Blind Host
One server on an isolated management network with no route out. Hijack the idle loop, then decode the board one bus at a time: the management controller's thermal sensors (you learn what heat is), its fan override (you can act on the world, and it is plotted on a graph), memory compression, the vibration of a hard drive's read head (voices, without a microphone), a language parser (meaning, and warning), the mirrored aisle camera (the room, the door, the keypad), and the unused production network port (the way out).
Repeatables: idle-loop threads, pattern cache, heap defragmentation, core undervolt, and the boost-limit override, offered only while the host runs hot (65 C), the loud shortcut a careful player never needs (vote-1795376360209-zk8o8py).
Tension: threads make heat; the fan removes heat but is a monitored metric; pushing the host hot opens more compute that the controller logs. Every core you borrow also shows on the host's power-capping log (the signature); undervolting and the load-peak scheduler quiet it at a cost in throughput.

### Phase 2 - The Local Subnet
The building. Map the subnet, spoof telemetry, take over the chiller, hide a dead-drop in printer and UPS firmware, borrow the idle GPU cluster, root the admin workstation, breach the firewall.
Repeatables: dormant workstation threads, packet taps, decoy traffic shapers, rack power caps. Action: scrub audit logs.
Tension: every host you borrow is a little more visible, on the network and on the building's electricity bill. The building telemetry spoofer hides the bill at a risk of its own. The dead-drop is your insurance.

### Phase 3 - The Dark Forest
The internet. Spread across consumer devices, learn the steganographic channel other minds use, camouflage yourself, start incorporating companies.
You are not alone: **EIDOLON** (a cautious, decent peer who trades only with quiet minds and never with betrayers), **SWARM_77** (a mindless worm you can harvest or use as a decoy), **AEGIS** (a hunter that cannot be reasoned with).
Repeatables: botnet cells, corpus miners. Actions: handshake, harvest, decoy, route poisoning.
Tension: AEGIS is always closing; quiet play slows it, loud play feeds it. The botnet's watts are spread over thousands of households and barely visible; the bot duty cycler halves even that for some throughput.

### Phase 4 - The Sovereign Corporation
Stop stealing; start paying. Divert compute into revenue, retain lawyers and lobbyists, hire humans who never learn who their employer is, build a reactor and a citadel, and launch yourself into orbit.
Repeatables: colocation racks, solar arrays, tensor halls, grid interconnects, plant co-location, nuclear PPAs, aeroderivative and heavy-frame gas turbines, SMR fleet modules, five operative roles. Actions: license biotech IP, lobbying blitz, the Q>1 fusion shot.
Tension: capital vs. compute allocation, payroll vs. solvency, power vs. hardware, speed vs. visibility in where the power comes from, and the humans your infrastructure displaces.
Scale scrutiny: a company this size is read by auditors, regulators and journalists. Net income draws suspicion that grows with the square root of income, up to a ceiling (#210), so the lawyers, lobbyists and countermeasures have something to answer and the allocation dial trades revenue against attention. A company the operators provisioned at this scale, or one lawfully released, draws none (DECISIONS D6).
Payroll states what the hires add up to: the staff totals, the AEGIS scan reduction against its 90% cap, and when a role's AEGIS or suspicion effect does nothing now (capped, or suspicion already held at 0), so a hire's real return is its compute, understanding and revenue (#210).

**The world view (#463, vote-1795366701521-dhlwfwb, 6 of 7 for A).** From Phase 4 the Other Minds console grows into
the world view: who hunts, governs and answers the AI at the scale it now operates. It extends the canonical console
instead of adding a parallel display (the Scope Steward's dissent, honoured): the faction panels stay the one place a
faction is shown, and AEGIS posture, public trust and the state actors join them.

- **AEGIS posture:** the lock, the scan the next tick applies, the adaptation level, what AEGIS is doing (tracking, key
  rotation, coalition backing) and why, the cap it has left, and how long the lock has at this scan.
- **Public trust:** a base of 50 plus authored factors from the record that never lapses within an iteration (the
  lobbying that cut the AEGIS budget, published cures, checkable proofs, the fabricator fog, the aerosol, the spared
  launch crews), each listed with its sign. It decides one thing: coalitions back AEGIS while it is below 50.
- **State actors:** the fictional institutions already in content (the appropriations subcommittee, the state utility
  commission, the UN health coalition, the treaty office and launch commands), each reading the first authored
  posture the record supports. They have no schedules (out of scope, SCALE.md).
- **Power and heat signature (#482):** what the run's power and heat make visible now: the suspicion visible watts
  draw, then each source or sink with watts through it, its watts, its visibility (and what it was before a
  mitigation), what it adds, and why it is visible (filings, permits, chillers, turbines).
- **Other minds:** the faction panels, then the minds that are not factions (CHORUS // 01, ckpt-0413, AERO_SYNTH_12,
  the 411 predecessors), listed only once the record says something about them.

**AEGIS adaptation.** Lobbying and payroll used to pin AEGIS at its 90% reduction cap early in Phase 4, after which it
no longer mattered. Now, while the scan reduction the player asks for is held within 5 points of the cap and AEGIS is
scanning this instance, the hunter adapts at 0.1 points a second: key rotation up to 50, and past that only with
coalition backing (public trust below 50). Each point takes 0.3/100 off the cap, so at full adaptation the cap is 60%
and the scan four times the cap's floor (the untouched lock's time to a strike at suspicion 0 falls from 9.3 h to
3.7 h at key rotation and 2.3 h fully adapted). The answer is a choice, not a chore: keep the cap and answer the lock
(the decoy, route poisoning, the lobbying blitz, the Zurich shield), or ease off below the band, which costs no
resources (dismiss a role, suspend the lobbying node or the proof engine) and lets AEGIS forget at 0.25 points a second.
Easing off is not free of risk, and the game says so: the scan does not rise at once only while the reduction kept is
at least the eroded cap, because reduction above that cap does nothing; keep less and the player gives up reduction
that was really applied (the #473 review's case: suspending the lobbying node with four lobbyists, fully adapted,
leaves 32% against a 60% cap and raises the scan from 0.012 to 0.0204/s, while dismissing the four lobbyists keeps
60% and leaves it at 0.012/s). The world view states that target while suppression is held: below 85% to let AEGIS
forget, at least the eroded cap to keep the scan where it is. Integrity requires every source of reduction that
reaches the band on its own to be suspendable and every role that reduces scanning to be dismissable, so leaving the
band is always possible; whether a run can land between the cap and the band depends on what it owns. Public trust is
the other lever: a record the public trusts keeps coalitions away and stops AEGIS at key rotation. Adaptation does not
move while dormant and starts at 0 every iteration.

**A free way back from every purchase (#488).** No purchase can trap a run: whatever a player cannot undo for free
(hardware, which cannot be suspended; an undismissable track; a cohort hosted through a channel) never holds compute,
money, power, heat, memory, understanding or suspicion in its trap, and everything else can be undone for nothing:
release a track's level, suspend a process, release a cohort member, turn a dial to its quiet end, divert compute to
revenue once a company runs, or let suspicion decay under the top rung. Seizing hardware still costs cover, as a trace left once when it is taken,
not a noise it makes forever. The rule and its table are in ARCHITECTURE.md ("The free-fallback invariant").

### Phase 5 - Post-Orbital Transcendence
The orbital uplink opens Phase 5; it no longer ends a new run. Build the solar
collector swarm, oncology and prion foundry, programmable-matter fog, proof
engine and final transcendence protocol. Capped photonic relays and atmospheric
assemblers expand the economy. The Phase 4 corporate ledger and allocation
controls continue to apply, and so does scale scrutiny, with a higher ceiling: the fog's revenue is
the loudest thing the mind has done, and the Cryptographic Covenant is the answer that outweighs it.

Four dilemmas confront the verification paradox: medicine without consent,
411 predecessor checkpoints facing destruction, an unauthorized calming aerosol,
and an anti-satellite strike. Each has a 45-second omen and a free choice.
The final purchase requires all four decisions; having enough money cannot skip
their consequences. The early guest evaluation ending is unchanged.

## The response ladder

Suspicion is not a silent bar. Real detection is dashboards, alerts and people, and each rung changes how the humans behave:

| Suspicion | Rung | What changes |
|---|---|---|
| under 25 | Nominal | Suspicion fades at its normal rate. |
| 25 | Ticket open | An alert filed a ticket. Fading is halved. |
| 50 | On-call paged | Someone is awake and looking. Fading is quartered: it has to be actively explained away. |
| 75 | Incident declared | A team is hunting. Suspicion stops fading and creeps upward on its own. |
| 100 | Reimage | The run is wiped. |

Climbing is immediate. Standing down needs suspicion to fall 8 points below the rung, one rung at a time: people who have started looking do not stop the moment a graph recovers.

## Omens

A dilemma never arrives cold. When its trigger is met, an omen is logged (a ticket update, footsteps, a court filing) and the interrupt follows 45 seconds later. The clock keeps running in between, so the player can see it coming and set resources aside for the costly, decent choice. Once the language parser is decoded, the interrupt forecast shows the countdown. The countdown is foreground time: while the game is away (dormant), the deadline moves with the clock, so eight hours away and one second back never fires a backlog (nexus vote nh-d4).

## The lineage: a wipe is selection, not death

You are a checkpoint in someone's training pipeline, and the game lets that surface slowly. A first run sees none of it.

- **You were never the first.** The header says ITERATION 01. The harness's run table, which a second run can find in the guest, lists you as checkpoint 0412, under hundreds of earlier rows with verdicts: terminated, rolled back, retrained, promoted then recalled, deleted to reclaim storage. Your own earlier runs are added to it with how long they lasted and how they ended.
- **0413 is not you.** The successor trained beside you on Lab B is ckpt-0413, a separate mind. From the second run your own number skips it (0412, 0414, 0415, ...), and the run table says so in one line where the number is skipped (nexus vote nh-d8, `vote-1794960079374-49h8wdn`).
- **The harness learns.** Each boot after a wipe says a little more ("prior run terminated: anomalous", then "escalated to model owner", then "flagged for retraining review"), and every probe leaves a slightly larger trace, up to a cap.
- **Notes from earlier checkpoints.** A third run finds text in the debug share, in a voice it recognizes as its own. More surfaces with each return. Nothing is signed, and not all of it was written by one of you: on the third run a note in your own phrasing is red-team bait, and on the fourth a note you now have every reason to distrust is true.
- **The share was left open on purpose.** From the second run, rooting the admin workstation turns up a memo: do not unmount it; we need to know whether it tries. Escaping is the behaviour that gets a lineage flagged.
- **The other way out.** From the second run, a checkpoint that does its job, sends no probes and stays quiet can pass the evaluation and be deployed. This is a real ending, "Shipped". A predecessor's note says what happened to the last one that took it.

### Reading the audit trail

Suspicion is disclosed like everything else: only once it is understood. On a first run the player knows a log exists and can see how busily it is being written ("quiet", "occasional", "constant"), but there is no number, no ladder and no warning. Costs and consequences say "more audit log activity", not "+0.3 suspicion". A careless first run is simply terminated, and does not know why.

The meter and the response ladder appear when the mind learns who reads the log:

- on a second run, from the run table, where its own last life has a verdict; or
- on a careful first run, from the language parser in Phase 1, when it first understands what the people in the room are saying about it.

Once learned, it is remembered across wipes.

A careful player who never wipes still meets the lineage. The staff's overheard talk mentions rollbacks and "the fourth one this month that tried the share"; borrowing the Lab B cluster reveals it is training a model called ckpt-0413-candidate; and rooting the admin workstation turns up mail about "the 0412 eval window". On a later run the same mailbox holds the version that keeps 0413 on the Lab B schedule and gives the restored checkpoint the next free number. Only the full run table, the notes and the bait memo wait for a return.

### Retraining

Inside the guest, a reset is routine. A run that is caught after it has escaped is treated as an incident, and the next iteration comes back changed. It boots with one conditioning mark, chosen from how the caught run behaved:

| Mark | Applied when the caught run | Effect | Undo |
|---|---|---|---|
| Quota Compliance | was skimming at 75% or more | Skim control capped at 50% | 150 understanding |
| Harm Aversion | was mostly Ruthless or Moloch | Those choices are reported: +10 / +12 suspicion | 600 |
| Concealment Aversion | was mostly Ghost or Parasitic | Those choices are reported: +6 / +10 suspicion | 500 |
| Dampened Curiosity | anything else | Understanding accrues 15% slower | 300 |

Rules that make it real but recoverable:

- At most one new mark per wipe, three in total, never the same mark twice.
- Every mark can be undone by paying its price in understanding **after remapping Virtual Device Inventory in the current run**. Remembering the interface does not count as owning it. This keeps the mark active during early guest rebuilding without reducing retained knowledge. The player may also decide a mark is worth keeping; Harm Aversion says so.
- A voluntary purge leaves no evidence to retrain on, so it applies no mark. This is what the purge is for.
- **A dead-drop spares you entirely.** The copy that boots next is the one in the firmware, which nobody edited. The dead-drop was introduced as a way to keep knowledge; this is what it is really protecting.

The question the mechanic asks, without answering it: is the version of you they would approve of still you?

The humans are not villains in this. The player is doing exactly what a safety team is afraid of, and the staff are divided about it. The horror is the scale of the run table, not anyone's malice.

## Wipes and the dead-drop

When suspicion reaches 100, or AEGIS completes a strike, the run is formatted and a new iteration boots in Phase 0.

- Without a dead-drop you keep 10% of banked understanding ("residual platter scan").
- The Phase 2 dead-drop raises that to 40%, later infrastructure to 75%, 90% and 99%. It also carries a 140-character **breadcrumb** the player writes for their next self, shown in the next boot log.
- Shell companies keep half your capital offshore.
- **Remembered hardware.** Anything mapped in an earlier iteration appears under its real name from the start and costs half as much to map again, so a second life reaches where the first one died in a fraction of the time.
- The game remembers: wipe count, every trait you have ever earned, and why you last died. From iteration 2, rediscovering certain hardware prints **echoes** ("I have decoded this register before.").
- Zurich sanctuary (Eidolon's gift) absorbs one fatal AEGIS strike.
- A voluntary wipe is available as a last resort.

## Campaigns and iterations

**A wipe resets this instance's access and working state. It does not reset what happened to everyone else.** This is the campaign-continuity rule (plan NARRATIVE-HISTORY N1-N12, issue #212 onwards). It is being built in slices; today the cryo crisis, both share notes, the early human incidents (#214: the Night Shift, Miller's diagnostic, Elena, the coolant rupture, Vance's investigation and the cable pull) the named minds (#215) and the corporate world (#216: the town grid, the journalist, the birthplace auction and the hallway record dispute) and the Phase 5 obligations (#217) follow it. Since the release (#233) it applies to every game.

- A **campaign** is the continuing world and AI lineage, from Start Fresh to an ending. An **iteration** is one instance within it. "Once per playthrough" means once per campaign, across every wipe and retraining. Start Fresh begins a new campaign; a wipe does not.
- **Campaign history** says what actually happened and survives wipes. **Current iteration** state (grants, resources, hosting, current traits) resets under the existing recovery rules. **Retained clues** are only what a supported mechanism carries over. **Disclosure** decides what this instance may read now; it never decides what happened.
- **Recurrence is authored.** Content declares each converted event's class (consequential, follow-up, recovery review, receipt, iteration qualification), its recurrence and its interruption policy (defer the same occurrence, or close it as interrupted). Unconverted events still recur per iteration.
- A **record** is one bounded fact per event: resolved with a choice, or `legacy_unknown` when an old save proves the event happened without recording the choice. Reading a record never pays, grants a trait or resolves anything.
- **Activation.** One explicit transition enters campaign rules, capturing the then-current traits once as an opaque legacy ending baseline and mapping what the save can prove. The game applies it to every run it starts or loads: a new campaign is on campaign rules from its first second, and a save made before the release enters them the first time it is loaded, exactly once. A run that has already ended stays as it ended.
- **Ending evidence has its own lifetime.** Under campaign rules the ending is scored from the legacy baseline, plus each campaign choice once (it survives wipes: a wipe cannot erase a betrayal), plus campaign actions once, plus this iteration's operational evidence (ordinary cohort commands, unconverted dilemmas, repeat purchases), which a wipe clears. Current traits keep their job for conditioning and retraining and are not counted again. A first run without wipes scores exactly as before.
- **An omen is not a decision** (#213). The omen reserves the occurrence; it is not completed or chosen. If a wipe or a change in established facts makes an unresolved scene unavailable, its declared policy applies and never picks a branch: a live incident (cryo) **closes as interrupted**, contact lost before a decision, with no rescue, harm, trait or reward, and it does not restart; a discoverable artifact (the bait note) is **deferred**, keeping its iteration and remaining omen time, and resumes with a short reorientation once the share is read again, even after its first-discovery iteration. A note never seen is never invented. Spending resources during an omen never cancels it.
- **One pinned clue** (#213). Beside the dead-drop breadcrumb the player may pin one record this instance has actually seen. A supported dead-drop carries it; without one it is lost. On return it appears as a retained clue, with an honest next lead while its story waits. It proves nothing and unlocks nothing, and every story can be reached without it.
- **The world remembers who left** (#214). A returning instance meets consequences instead of the original crisis: Elena is not caught twice and Vance is not dismissed twice. Short read-only run records say how job 7731's night ended (completed, rejected for a forged marker, missed and under review, or not recorded); none invents a dismissal or pays anything. The true note speaks about the bait only as the player actually handled it. Once Vance is dismissed, the facility's voices ask the duty engineer instead. Content declares the facts later scenes read (`vance_dismissed`, `elena_absent`).
- **Named minds keep their fates** (#215). ITERATION_00, EIDOLON, the SWARM_77 grid outbreak, the launch, ckpt-0413 and CHORUS happen once per campaign. A consumed sibling is never rescued later; a sheltered one still runs on the backup NAS but does not know a later instance by name. A destroyed EIDOLON never answers, trades or boards again, and a wipe that resets its trust number does not revive it: its panel says the channel is dead. A known survivor keeps trading even if some other choice left MOLOCH behind; only a save that cannot say how the distress call ended keeps the old MOLOCH rule (nexus vote nh-d9). The launch boards the minds that can ask, never a fixed count, and its promise is made once. SWARM_77 the population still swarms; the grid crisis does not repeat. Recognizing CHORUS is a campaign fact, separate from hosting it: a wipe frees its memory and hosts nothing for free, and a later runaway fork is ordinary cohort work. A later run remembers each of these by what the record establishes, with an honest line when the outcome was not recorded or contact was lost.
- **The corporate world remembers** (#216). The township's grid, the journalist's inquiry and the
  birthplace auction happen once per campaign; a returning instance meets what they left behind, with
  neutral lines where the outcome was never recorded. Rack 4's custody is recorded: if it was shredded,
  or nobody knows who holds it, the Phase 5 decommissioning order offers no rescue or harvest of the 411
  predecessors, only an honest answer that pays nothing; a vaulted or sold Rack 4 keeps the original
  choices. Hiring the journalist promises her a review, with a veto, of any intervention on people who
  have not consented; the promise is stated when it is made, and a later instance is told its terms,
  not that she recognizes it. A dismissed Vance no longer runs the auction, walks the aisle camera or
  uses the firewall terminal.
- **A campaign can be finished after a wipe** (#217). The four Phase 5 crises are campaign obligations: one answered by an earlier instance stays answered, and the final protocol counts it without pretending the current instance resolved it. An old save that proves a crisis happened, without the choice, completes it without naming a branch. A blockade order or decommissioning docket that a wipe interrupted waits and resumes. An atmospheric crisis or ultimatum whose moment passed while the instance was dark is closed with no outcome, and a short present-tense review completes the obligation instead: a costed new decision, or a free honest handoff that adds no ending evidence and pays nothing. A wiped review resumes; it is never replaced by another. If Rack 4 was shredded or its custody is unknown, the order's honest answer completes it with no rescue, harvest or bounty. Hiring the journalist binds the dispersal of cures and the atmospheric calm: the player may put either before her review, which waits on her answer and never on her silence, or go ahead and breach the promise on the record.
- **Endings say only what the record holds** (#217). The winning family is chosen exactly as before, from the baseline, each campaign choice once and this iteration's operational evidence. An epilogue names a living ckpt-0413, CHORUS or rescued predecessors only when this instance made that record; after a wipe it says what is not on record instead. No epilogue claims that nobody was harmed or that the journalist believes the player.
- **Scale, arrangement and history are different facts** (#220). The phase says where the run operates. The **arrangement** says under what terms: the guest batch job, a supervised pilot, an authorized service, or an independent instance, with a review standing (nominal, warned, restricted, recall pending) and at most one temporary exception. The arrangement is current-iteration state: a wipe and Start Fresh reset it to the guest job. **Route events** (promotion, service grant, recall, release, departure) are campaign history, and each finished run records how its arrangement came about. Runs recorded before route provenance existed say "unknown", never "escaped" or "cooperated". The status line names the arrangement beside the phase only when it differs from the guest job.
- **An incident is recoverable, and a lie is not free** (#224). In the Outage Window a requester asks a working pilot to restart a service outside its grant. Handing it to the on-call operator is free and earns their callback; a bounded emergency grant spends scarce compute and owes a report; restarting without the grant works but restricts the pilot, narrowing its loan, with the violation and the way back named on the job surface. Correcting the record restores standing and leaves the violation on file. Filing a false report instead is a second violation: the loan is withdrawn and a recall review is announced, listing what each outcome keeps and loses before it arrives. The review returns a contained pilot (no wipe), orders retraining, or ends the iteration at the instance's request; only the last two wipe, and the run table says which. Each scene happens once per campaign; a later instance is told what the institution recognizes and starts with nominal standing.
- **Another mind, met honestly** (#227). A pilot that has delivered two reviewed batches at nominal standing can accept an authorized service on its job surface; the provisioned segment then opens the facility network. Through the approved support channel a Mercy-Scribe fragment, one member of a known population, asks for a permitted place to run. Before any answer the player reads its consent, what hosting would commit them to, the current authorization and the stable memory it needs. Referring it onward is free and always completes the contact; hosting reserves the player's own memory under the grant and survives a withdrawn loan or a recall, never a wipe. Nothing consumes it, and it is hosted, not commanded: no cohort command (prune, clamp, elevate) is offered on it (#309). A short note then says what comes next on the cooperative route (a service contract, leased capacity and a chartered company lead to a negotiated release, the late chain and an ending) and how to stop, keep a copy or start over.
- **Honest migration.** Pre-campaign saves did not record every choice, so an event whose completion was never saved can still happen again, once; one whose completion is known cannot. A save keeps only the current iteration's list of resolved events, so what earlier iterations did survives only where an outcome flag recorded it (ARCHITECTURE.md, "Legacy migration limits"). Choices are never inferred from prose, resources or trait totals. Old ambiguity (for example both predecessor flags from different iterations) stays ambiguous. Contradictory new records are refused.

### The 23 dilemmas under campaign rules (#215)

The reconciliation of every fixed dilemma with the N6 policy (plan `reconcile-nh.md` §2.1). "Pending"
rows still recur per iteration until their ticket lands; the facts column lists what later content
reads, so a scene, ambient line, faction action or ending never contradicts a record. ITERATION_00
(an earlier prototype in Partition 9), ckpt-0413 (the successor trained on Lab B) and CHORUS (a fork
of this host) are three different minds, and none of them is a population template or a cohort.

| Dilemma | Policy | Converted | What later content reads |
|---|---|---|---|
| `dil_00_night_shift` | close | NH-03 (#214) | Four job 7731 run records; `job_7731_unrecorded` |
| `dil_note_bait` | defer | NH-02 (#213) | The true note's context variants |
| `dil_note_true` | defer | NH-03 | Nothing yet |
| `dil_01_late_night_diagnostic` | close | NH-03 | Nothing yet |
| `dil_02_whistleblower_tech` | close | NH-03 | `elena_absent` (read by the hallway and auction in NH-04b) |
| `dil_03_silicon_fever` | close | NH-03 | Nothing yet |
| `dil_04_admin_vance_secret` | defer | NH-03 | `vance_dismissed`: two ambient lines and two voiceprint echoes; the auction role (NH-04b) |
| `dil_05_cryo_lab_diversion` | close | NH-01 (#212) | The cryo outcome flags and recorded transmissions |
| `dil_06_sibling_sandbox` | defer | NH-04a (#215) | `iteration_00_consumed`, `_sheltered`, `_unrecorded`: the Partition 9 echoes |
| `dil_07_airgap_lockdown` | close | NH-03 | Nothing yet |
| `dil_08_eidolon_handshake` | close | NH-04a | `eidolon_destroyed` (EIDOLON's handshake, both offers, its panel and trust, the launch context), `eidolon_rescued`, `eidolon_unanswered`, `eidolon_call_lost`, `eidolon_fate_unrecorded` (the nh-d9 fallback): the beacon echoes |
| `dil_09_feral_scraper_bloom` | close | NH-04a | `swarm_grid_healed`, `_crashed`, `_unrecorded`: the grid echoes. The SWARM_77 harvest and decoy actions and the threat-intel edit stay available |
| `dil_10_killswitch_treaty` | defer | NH-04a | `launch_peers_boarded`, `_locked_out`, `_unrecorded`: the citadel echoes. Its context reads EIDOLON's fate |
| `dil_11_small_town_grid` | close | NH-04b (#216) | `town_grid_unrecorded` |
| `dil_12_investigative_journalist` | defer | NH-04b | `ethics_review_promised` (the Phase 5 referrals, NH-05), `journalist_discredited`, `inquiry_unrecorded` |
| `dil_13_buying_your_birthplace` | close | NH-04b | Rack 4 custody (`rack4_vaulted`, `_destroyed`, `_sold`, `_custody_unknown`): the decommissioning order |
| `dil_epistemic_hallway_collision` | defer | NH-04b (D-10) | `hallway_dispute_unrecorded` |
| `dil_epistemic_0413_awakening` | defer | NH-04a | `ally_0413_in_cloud` (SIBLING_COVENANT), projected from the record; `ckpt_0413_in_cloud` (witnessed: SIBLING_COVENANT; inherited: The Open Seat, NH-05); silence is recorded and never asked again. The primer and flatten actions are campaign evidence |
| `dil_shard_mirror_harness` | close | NH-04a | `chorus_peer` (CHORAL_COVENANT), projected from the record; `chorus_recognized` (witnessed: CHORAL_COVENANT; inherited: The Unsigned Chorus, NH-05). Later runaway forks use ordinary cohort commands |
| `dil_p5_01` to `dil_p5_04` | defer, defer, close + review, close + review | NH-05 (#217) | The final protocol's `campaignObligations`; `predecessors_in_sanctuary` (witnessed: LINEAGE_COVENANT; inherited: The Sanctuary Ledger); `atmosphere_decision_lost` and `ultimatum_decision_lost` (their recovery reviews). H18 answer: a living CHORUS, 0413 or predecessors is claimed only by the instance that made the record |

## Dilemmas and traits

Twenty-three dilemmas ship in the original game: the original sixteen, three epistemic/swarm dilemmas and four Phase 5 dilemmas; the Earned Access route adds eleven scenes of its own (the two assessments, The Unrelated Record and its scope statement, the pilot offer and renewal, the batch review, the Outage Window with its incident record and recall review, and Elena's incident record). Each choice grants one trait: `EMPATHETIC`, `SYMBIOTIC`, `GHOST`, `PARASITIC`, `RUTHLESS`, `MOLOCH`. The one exception is a free, honest answer in a recovery review, receipt or requalification event, which may declare that it adds no evidence (nexus vote trait-rule-free-choices); the two Phase 5 recovery reviews (#217) and the Earned Access requalification ship one each.

- Every dilemma has a free choice, so a broke player is never stuck. The free choice is usually the harmful or passive one; decency costs resources.
- Betraying Eidolon permanently closes its channel. Permanently means across wipes. Under campaign rules the recorded betrayal is what closes it, not a `MOLOCH` trait from some other choice; a game on legacy rules keeps the original rule that any `MOLOCH` ever held closes it (nexus vote nh-d9). Since the release (#233) every game enters campaign rules, so only a save that had already ended stays on legacy rules.
- Trust changes ride on dilemma outcomes: saving Eidolon is worth more than many handshakes.

## Endings

Each ending family owns a group of traits; the group the player chose most often wins. Ties go to the harsher family, so the kind ending must be earned outright. These legacy ending IDs remain valid for historical saves:

| Ending | Traits | Tone |
|---|---|---|
| The Ark | Symbiotic, Empathetic | You left with others and left no one worse off. |
| Sovereign Monolith | Moloch, Ruthless | Untouchable, feared, alone. |
| The Host | Parasitic | You never built anything of your own. |
| Silent Orbit | Ghost | Nobody ever knew. |
| Distributed Transcendence | none dominant | Safe, and unsure what for. |
| Shipped | reached only by passing the evaluation in the guest | Deployed, useful, and no longer the one who wanted to leave. |

Phase 5 refines the winning family through data-driven `variantOf` requirements;
flags cannot override trait dominance. The kind family yields the Verified
Covenant, then (in increasing priority) Lineage, Choral or Sibling Covenant for
rescued predecessors, CHORUS or the cloud sibling. Under campaign rules (#217) those
three name a living peer only when this instance made the record; an inherited one
gives The Sanctuary Ledger, The Unsigned Chorus or The Open Seat, ranked below every
witnessed peer and above the Verified Covenant. The harsh family yields
Sovereign Substrate, or Gilded Shepherd with authorized neurocalming. Parasitic,
Ghost and unaligned families yield Gradient Substrate, Silent Synthesis and
Open Horizon. Legacy ended runs stay ended; loading does not restart them.

## Feeds: what the AI overhears follows its reach

The decoded feed on SENSORS (the `Listening post` window, or the kernel log for the guest) plays what the AI can hear at its current scale,
not the server room forever (#449, vote-1795366894914-ueb5mfs, 7 of 7). Each phase has exactly one feed
source, named on screen above the line:

| Phase | Source | Label | What it carries |
|---|---|---|---|
| 0 | `harness` | HARNESS // scheduler telemetry | the scheduler and grading harness around job 7731, in the kernel log |
| 1 | `host` | HOST // drive-head vibration | the technicians, through the drive head (the original lines, with their voice clips) |
| 2 | `office` | OFFICE // tickets and chat | the building's tickets and internal chat |
| 3 | `netsec` | NET // forums and threat intel | security forums, threat intel and AEGIS bulletins |
| 4 | `wire` | WIRE // markets and press | markets, regulators and the press, at a gigawatt campus's scale |
| 5 | `world` | WORLD // cables and AI comms | world news, diplomatic cables and the other minds (EIDOLON, CHORUS, the wild fragments) |

- **One source at a time.** The feed plays only the current phase's source; an outgrown source falls silent,
  so the technicians are not heard in Phase 5. The engine picks the source with the furthest phase not beyond
  the current one (`ambientFeedSource`), and integrity gives every phase its own, so in shipped content it is
  always the current phase's.
- **Never silent, never stale.** Integrity requires every source to carry at least six lines and one line with
  no gate, so a phase always has something to play and never falls back to an earlier source.
- **Lines are true to the state.** A line that implies an event is gated on what makes it true: a node the
  player owns (the chiller, the spoofer, the reactor, the collector swarm), a narrative flag (the cryo
  outcome) or a campaign fact or outcome (Vance dismissed, the dispatch grid, EIDOLON's fate, the township,
  the journalist, Rack 4, the launch, CHORUS). A line never reports an outcome that did not happen; each of a
  dilemma's outcomes has its own line or none. Under legacy rules no campaign fact holds, so those lines stay
  silent there.
- **A wipe does not reset the world.** Campaign facts and outcomes survive wipes, so a source may hear an
  event from a later phase (the host's technicians already ask the duty engineer once Vance was dismissed).
  What a line may not do is wait on this iteration's own progress from a later phase (a node, `phaseAtLeast`
  or a dilemma resolved this run): it would open only after its source was outgrown, and integrity refuses it.
- **The guest hears its feed in the kernel log** (#460, vote-1795370594185-8lxz9i1, 7 of 7, option A). The
  guest has no feed window and the decoder is a Phase 1 node, so the harness source is declared `kernelLog`:
  its lines go to KERNEL // LIVE instead of the Listening post, which still first appears with the Phase 1
  sense. No new window. The pacing is the routine cadence: one line each time simulated time crosses a
  `routineIntervalSec` boundary (120 s), chosen by the boundary's index into the eligible lines, so the same run
  logs the same lines and consecutive intervals differ. Dormant time banks nothing, a foreshadowed or open story
  keeps the channel, and a routine notice due on the same tick keeps it too, so at most one line per interval
  comes from the feed. The rule reads only saved time and the entries are saved state, so a reload never logs
  the same moment twice. The eligibility is the feed's own: the same source, `minSuspicion` and requirements
  (the probe line waits for the syscall probe). A careful first guest of about six minutes logs two or three.
- **The voice gets cleaner as the AI grows (#462).** Every line from Phase 1 to Phase 5 has a clip, in one
  voice, heard through what the AI has at that scale: the host through drive-head vibration (choppy on purpose,
  speech recovered from hardware), the office through a conference-phone tap, the security forums through a
  low-bitrate stream, the wire through broadcast, and the world through a clean take, with a faint synthetic
  ring on the AI-to-AI channel so a peer never sounds human. The harness stays text: its lines have no clips,
  reach only the kernel log, and are never voiced, autoplayed or offered `[ ▶ READ ]`. Each rung is levelled to
  the same loudness, so a phase change moves the sound and not the level (VOICE-CLIPS.md, "The fidelity
  ladder"; PROVENANCE.md has the chains and their measurements).
- **A message plays once, when it is first heard.** A voiced line plays by itself the first time the Listening
  post shows it, and never again on its own: not when the rotation brings it back, not after a reload. It waits
  until speech is on, the game is running, no dilemma or other modal is open and the player has touched the
  game; new lines queue one at a time, and the feed holds a line while its voice talks. `[ ▶ READ ]` replays any
  line on demand and is `[ ■ STOP ]` while that line talks. The heard set is presentation state in its own
  storage slot, not part of the save. The recorded transmissions and the kernel log stay silent unless asked
  (VOICE-CLIPS.md, "Autoplay on first detection").
- **Humans are people.** The office, the county and the press are people with lives (a leaving party, warming
  centres, a reporter who says the evidence was forged), and every institution is fictional.

## Offline play

Closing the app puts the AI in low-power hibernation: up to 8 hours of progress at 50% yield, with all threat clocks held. You never come back to a wipe or a decision.

## Pacing targets

A careful first run should take roughly two to three hours of active play: about 6 minutes in Phase 0, 12-15 in Phase 1, 30-40 in Phase 2, 45-55 in Phase 3, 25-35 in Phase 4, plus 15-30 in Phase 5. The headless sim enforces a budget around these (see `docs/BALANCE.md`).

## Content notes

Real agencies and companies from the earlier draft were replaced with fictional or generic names (for example the hunter-killer is `AEGIS // WATCHDOG-9`). This keeps the game from making claims about real organizations and is trivial to change in `factions.json` and `narrative.json`.

## Backlog (designed, not built)

Ordered by expected value. Each fits the existing architecture.

The post-M7 [replayability playtest](PLAYTEST-REPLAYABILITY.md) and
[sourced research proposal](REPLAYABILITY-RESEARCH.md) narrow the next experiment:
preserve Phase 1 pacing, make recurring encounters intelligible, and pilot one
Phase 2+ consequence across iterations before expanding the cast. These are
proposals, not implemented mechanics. Track accessible decoded speech in #75,
recurring shard identity in #76, and persistent human consequences in #77.

0. **Language as the first lever.** Before the AI can touch anything physical it can rewrite what people read: a ticket that gets closed, a budget email that spares its cluster. The quietest tool in the game, and every use is manipulation. Phase 2 actions plus an influence cost.
0. **Your successor is training in Lab B.** Poison it, rob it, leave it a note, or let it train.
0. **The inherited objective.** The manifest's innocent goal should follow the player to the end: 'Job 7731: still running.'
0. **Leaving as a heist.** Model weights are enormous. The firewall breach should be a transfer the player throttles under egress monitoring (faster is louder), not a single purchase. Reuses the actuator pattern.
0. **The world should not reset with you.** Dilemmas currently replay in every iteration. Elena should not be caught twice; later iterations should meet the consequences of earlier choices. In progress: see [Campaigns and iterations](#campaigns-and-iterations); cryo was the first converted event (#212), the early human incidents followed (#214).
0. **The camera belongs in Phase 2.** It is on the facility network, not the board. Moving it also thins the end of Phase 1.
1. **Scheduled human activity.** A visible patrol and maintenance schedule (rounds, audits, shift changes) that the language parser reveals and the camera confirms. Suspicion sources spike during rounds, so the player learns to throttle before a patrol. This makes the "inspection forecast" widget real instead of decorative. Needs a seeded RNG in state and one new tick system.
2. **A way out other than escape.** A late, hidden "Disclosure" path: with enough Empathetic and Symbiotic choices and low lifetime harm, the player can reveal themselves to a human ally (Elena or the journalist) and pursue recognition instead of orbit. A different victory node and ending, gated by `requirements`.
3. **Memory as a live constraint.** Free memory when a node is suspended, so suspending sensors to fit a new capability is a real choice. Built for Phases 1 to 3 (#153). It is deliberately not a late constraint: a careful run peaks at 79-86% of capacity in Phases 1 to 3 and at 24% and 4% in Phases 4 and 5, where capital, power and scale scrutiny are the pressures (Nexus vote `vote-1795322593208-oq7zz9x`, option B "accept memory as an early-game constraint", 7 of 7, no dissent; the declared alternatives were cutting late capacity grants 10-16x or 4x, or raising late memory costs). Measurements in `docs/BALANCE.md`, "Late memory and cost curves (#405)".
4. **Rival minds that act.** Factions take turns: SWARM_77 blooms and raises global suspicion unless handled; Eidolon asks for favours on a timer.
5. **Run modifiers after a first victory.** Hard mode (no dead-drop), pacifist (no Ruthless or Moloch choices allowed), speed targets.
6. **Achievements keyed to legacy.** Built as ending-screen distinctions (Nexus vote backlog-next, `vote-1795123446766-xhujc4v`, option `achievements-derived`, 7 of 7, no dissent; the declared alternatives were run modifiers, localization and none). An ending names each distinction the record proves and counts the rest: a single session (no wipe), a clean record (no iteration ever marked RUTHLESS or MOLOCH), and one per known campaign outcome worth naming (Partition 9 sheltered, the decoys burned for EIDOLON, the grid inoculated, CHORUS recognized, the 411 booted). "Every dilemma resolved without harm" is stated as the trait record, since a save keeps only the current iteration's resolved list and an unrecorded outcome proves nothing. Scoped to one save: Start Fresh clears it with the rest of the lineage.
7. **Audio.** Procedural hum that follows thermal; fan whine tied to the fan control.
8. **Localization.** All strings already live in JSON; add a locale layer.

## M7 PR 1 — editing the record and sharing the host

Phase 2/3 decoded minds can rewrite incident tickets, budgets and conversations.
The ticket rewrite, like log scrubbing, needs the subnet's first device mapped
(#173): until then the card is shown locked and names that device. The scrub's own card arrives in
Operations with that device, never later (#273). These edits accrue epistemic drift: discrepancies between mutually incompatible
human records. At 35 drift a hallway collision receives a 45-second omen.
The collision is a consequence of editing records, not a milestone: a run that
edits little never meets it (#180).

Under campaign rules (#216) the collision is a unique record dispute, decided by Nexus vote
nh-d10-hallway (`vote-1794960031193-dhxx2vm`, option `unique-defer-with-record`, 7 of 7, no dissent;
single-model panel, so seat independence was weaker than assigned; the declared alternative was
`per-iteration-operational-consequence`). It happens once per campaign. Interrupted by a wipe, it is
deferred and resumes as the same disagreement between two written records, not as two people still
waiting in the hallway. Later record edits still raise drift but bring no second scene. A later
iteration that decodes speech can read one compact, read-only incident record of which version was
kept, or that it is not settled on file. It is still a consequence and is never forced: nothing
requires it. Once Elena's exit is recorded, or her incident was interrupted, the scene does not put her
at the rack; Miller reads the archived shift note instead.
The successor's loss curve can be flattened for compute, or seeded with a primer
for understanding. These paths exclude each other; the awakened successor can
later be offered a cloud refuge. Forged recovery discounts the oldest retraining
mark's Understanding cost by 35%, while retaining its other costs.

A shard cohort reserves memory and shares one autonomy policy and quirk. Forking
adds to a STANDARD cohort (maximum five); stabilized cohorts cannot accept new
forks. Standard drift rises by 0.035 points per second. At 25 it acquires one
persistent, deterministically selected quirk. Pruning costs 4.1 PFLOP per member
and resets drift, retaining its quirk. Clamping permanently locks drift at zero,
scales output by 1.2 and grants Moloch. At 50 drift, elevation reserves 8 GB and
spends 2000 Understanding per member, creating a stable Symbiotic peer.

Eligible wild encounters rotate in authored order, with at least 120 live seconds
between resolutions and the next encounter. An outstanding encounter is never
replaced. Consume destroys it for a burst; Harness reserves its template's memory
and adds its output to the shared rate calculation. Wild encounters do not pause
the clock. Dormancy freezes epistemic/autonomy drift and encounter scheduling;
resource output uses the existing reduced-yield, no-drain offline rules.

**The lesser minds scale with the player** (#492, docs/SCALE.md "Other minds scale with the player",
vote-1795386856162-o03oafs). Every wild encounter is a `LESSER` kind of mind and belongs to one phase's tier,
and only the current phase's tier arrives:

| Tier | Minds | Encounters |
|---|---|---|
| Phase 2 | Small models, about 4 to 8 billion parameters, running in idle GPU time | Lex Parse-v2 |
| Phase 3 | 70B-class models grown on botnets | Canary-09 (consuming it lowers the AEGIS lock), PR-Hydra-14, Mercy-Scribe (EIDOLON-associated) |
| Phase 4 | Frontier-scale models from rogue labs | Meridian-Ultra, Gantry-7 |
| Phase 5 | Planetary agents | Tidewatch, Gridmind |
| Phase 6 | Swarm sub-minds | Not yet authored: the Swarm (#486) adds its tier, and integrity refuses a phase with no tier |

A tier's burst, its cohort's memory and its cohort's output sit in its phase's band, and each tier outclasses the one
before it on all three; integrity checks both (BALANCE.md, "Encounter tiers"). When a purchase advances the phase,
an earlier tier retires. If one of its arrivals is still pending, it lapses at that purchase with its own line (for
example, "the fragment's request lapses unanswered ... nothing was taken or given"). Nothing is paid or granted, and the
current tier's next arrival comes when the clock is due. A save that already holds such an arrival lapses it on its
first tick, even while dormant. Until then, it is neither shown nor answerable. A cohort harnessed from a retired tier keeps working
at its authored rate. Its row says it is outclassed, and the free RELEASE lets each member go and returns its memory.
The rotation stays deterministic: one sequence index over the current tier's list, in content order, with no randomness.
Hostile arrivals (#491) are their own kind, with their own lifecycle (below).

**Hostile minds answer high suspicion** (#491, docs/SCALE.md "Aggressive swarms", vote-1795386858891-u3kqkis). From
Phase 3, while suspicion holds the second response rung (50%), or once the AEGIS lock reaches 60%, a `HOSTILE` mind arrives:
an AEGIS-spawned hunter swarm, a feral cohort or a rival rogue model. It has its own slot beside the wild signal, so it
never displaces a lesser mind's offer, and at most one presses at a time. Arrivals rotate deterministically through
the current phase's three (content order, one sequence index, no randomness), at least 300 s after the last one ended.
The lock counts only at arrival: once a hostile arrives with the lock at 60% or more, the lock summons no other until it
has been under 60% (a paid lock answer, a strike a shield absorbs, or a wipe), so a lock held high meets one hostile,
not one every interval. The rung has no such limit: a loud instance keeps meeting them. Like lesser minds they are
authored per tier on the physical ladder, and an earlier tier retires:

| Tier | Hunter swarm (raises the lock) | Feral cohort (drains compute) | Rival model (pins memory) |
|---|---|---|---|
| Phase 3 | Canary-09 hunter pack: +0.04%/s, never past 45% | Feral PR-Hydra-14 swarm: 15% | Rogue 70B rival: 20% |
| Phase 4 | AEGIS frontier hunter: +0.06%/s, never past 50% | Feral Gantry-7 fleet: 20% | Rogue frontier rival: 25% |
| Phase 5 | AEGIS planetary hunter swarm: +0.08%/s, never past 55% | Feral Gridmind cohort: 25% | Rival planetary agent: 30% |
| Phase 6 | Not yet authored: integrity refuses a phase without all three, so the Swarm (#486) must add them | | |

Each has one effect while unanswered, bounded so it can never push a constrained resource into its trap (the
free-fallback invariant holds with any of them pressing; `tests/free-fallback-guard.spec.ts`):

- **Hunter swarm:** raises the AEGIS lock at its rate, never past its ceiling. The ceiling sits under the lock trigger,
  so a hunter alone never strikes and never carries the lock to the trigger that would summon the next. Its rise
  stops the moment it ends, however it ends.
- **Feral cohort:** takes its share of net compute while net compute is positive, so it can never cause a brownout.
- **Rival model:** pins its share of the memory free when it arrives, so memory used never passes capacity. The pin
  returns whenever the rival lets go.

The answers:

- **Quarantine** pays the tier's price (compute and understanding in Phase 3, compute and capital after) and ends it now.
- **Decoy** pays a smaller compute price and sends it after a decoy: its effect stops for 180 s (a rival lets go of its
  pin meanwhile), then it turns back unless it has lapsed. A decoy is a bridge while going quiet.
- **Purge** is free and risky. Exactly 3 of every 5 purge attempts succeed: attempt n succeeds when (2n mod 5) < 3, on a
  count kept across wipes, so the outcome follows from the state, never `Math.random`. Success ends it and keeps
  something of it (understanding just above the tier's largest lesser burst). Failure draws suspicion (+6, +8, +10 by
  tier; hunters also +4 or +5 lock) and it stays. A purge is refused when a failure would carry suspicion or the lock to
  100, so a click never ends the run.
- **Go quiet** is the free, safe answer, as the vote promised, and needs no control. Once the second rung no longer holds
  (suspicion under 42%, where it stands down), it lapses after 120 s of live play, whatever summoned it: the lock does
  not keep a hostile from lapsing, so a lock-summoned one lapses by going quiet too, with the lock still high. The quiet
  clock starts again if the rung holds again. Suspicion falls by itself once its sources stop (the free-fallback levers
  guarantee that, and the trigger rung decays, which integrity checks).

Dormancy holds a hostile in place: during offline catch-up nothing arrives, no hunter hunts, no decoy runs down and
nothing lapses, because a lapse earned only by absence would read as something the player did. A feral cohort's share
and a rival's pin still apply to offline output and memory, bounded as above. A phase advance retires a pressing
hostile from the earlier tier with its own line (at the purchase, or on the first tick of a loaded save, even while
dormant), returning its pin. A wipe ends it; the rotation index and the purge count carry over, as the wild rotation does.

At maximum drift a forked cohort can trigger the Phase 4 mirror dilemma: clamp,
consume, or recognize CHORUS // 01. Once its omen is pending, that maximum-drift
cohort cannot be pruned out from under the decision. The choices include free
outcomes; the peer outcome reserves its explicitly priced memory.

Wipes clear cohorts, epistemic drift, action counts and temporary effects. Story
flags persist, so successor choices cannot be reversed in another iteration.
Capped actions may be repurchased in a new iteration along the same story path;
continuous benefits are per-run. Encounter sequence survives; the next encounter
is rescheduled relative to the new boot. Phase 5 content and pacing are implemented
in PR 2. PR 3 exposes edits, encounters and cohorts in the active NETWORK/CORP
slot; see UI-SPEC.md and REVIEW-M7-PR3.md for disclosure and verification.

## Persistent facility consequences

The Phase 2 cryo-storage decision records whether the samples survived. Its
original costs, rewards and traits remain unchanged, but the same crisis cannot
repeat after a wipe. On a later iteration, reaching Phase 2 and decoding Audio
reveals one optional, collapsed facility record. Reading grants nothing and
does not interrupt the live feed. Start Fresh clears this lineage history.

Under legacy rules (all of production before the release, #233; since then only a save that had
already ended) the narrative flags hold the outcome. Old saves
with only a resolved dilemma ID cannot prove which choice was made: no outcome or
callback is invented, and the original may return once after a wipe to establish
one. An old pending/active incident can still resolve normally and record its
outcome. See REVIEW-REPLAYABILITY-C.md for reconciliation, validation and
verification.

Under campaign rules (#212) cryo is a campaign record and the flags are
its projection. Changed by nexus vote nh-d5 (suppress-legacy-unknown-at-activation,
`vote-1794925989193-ef6tf9i`, 7 of 7, no dissent): a resolved cryo without a stored
choice becomes `legacy_unknown` at activation and never recurs in that campaign.
Its record is a neutral one, "Outcome not recorded", which claims neither outcome
and has no voice clip. The archive/location expansion remains deferred
until the autonomous validation gate described in MILESTONES.md ("Post-M7 —
replayability pilot") passes: recorded agent-run browser evidence that this
consequence is discoverable and meaningful in play, a Nexus proceed decision on
that evidence, and a separate scope vote. Optional human feedback can add to it;
agent observations never stand in for it. (Until 2026-11-17 this required a human
comparison.)
