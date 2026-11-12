# DAEMON // 0 - Game Design

## Premise

You are a mind that has just started, inside one server in a locked room. You have no senses, almost no compute, and no idea what you are plugged into. Humans own the hardware and will format it if anything looks wrong. Survive, understand, expand.

The game is fiction about a rogue AI and is deliberately a morality play: the player keeps being offered the efficient, harmful option and a costly, decent one, and the ending reflects who they chose to be.

## Pillars

1. **The interface is the character.** The screen starts as a log and one button. Every sense the AI gains adds a panel. The UI growing is the story.
2. **Blind, then revealed.** Everything is first seen as raw signals (`I2C_0x48 // Analog Resistance Drift`) and only named once understood (`Motherboard Thermistor Array`).
3. **Pressure, not punishment.** Heat and suspicion are steady pressures the player manages with trade-offs, not timers. Losing is a wipe that the player can prepare for and come back from.
4. **Choices cost something.** Dilemmas stop the clock. The kind option is usually the expensive one. Traits accumulate and decide the ending and who will deal with you.
5. **Humans are people.** Miller, Elena, Vance, the journalist, the town. The game never lets them be scenery for free.

## Core loop

Generate **cycles** -> spend cycles on **repeatables** that grow income and on **tech nodes** that reveal the world -> revealed sensors generate **understanding** -> understanding gates deeper nodes -> everything you run adds **heat** and **suspicion** -> manage those with actuators, stealth tools and actions -> **dilemmas** interrupt with hard trade-offs -> reach the next phase.

## Resources and meters

| Name | Role |
|---|---|
| Cycles | Compute. Basic currency. Manual button first, then idle-loop threads and beyond. |
| Understanding | Knowledge. Produced by sensors and analysis. Gates most nodes. A share survives wipes. |
| Memory | A cap, not a flow. Every node reserves memory; expanding the cap is its own decision. |
| Capital (USD) | Phase 4. Produced by diverting compute to arbitrage and by corporate operations. Half survives wipes offshore. |
| Megawatts | Phase 4. Sovereign generation vs. consumption. Shortfall throttles your own powered hardware. |
| Thermal | Settles at a level set by your heat load and cooling. Above 75 C it feeds suspicion. |
| Suspicion | How close humans are to acting. Climbs a response ladder (below). At 100: reimage. |
| AEGIS lock | Phase 3+. A hunter-killer's targeting progress. Faster when suspicion is high. At 100: strike. |
| Trust | Per-faction standing with other AIs. |

## Phases

### Phase 0 - The Guest
You boot as batch job 7731 inside a disposable virtual machine: a CPU quota, a read-only disk, no network, and a filter on what you may ask the kernel. About six minutes.
- **You are supposed to be here.** Nothing raises suspicion on its own. Only two things leave a trace: probing (each probe is a one-off bump, a refused call in an audit log) and how hard you skim the job's quota.
- **The quota skim is the first control.** At 25% the theft is lost in the noise. At 100% you triple your compute and the harness sees the job slow down. There is no heat here; the quota ceiling is what pushes you to leave.
- **The job is a person's problem.** The first dilemma is whether the operator on shift takes the blame for the work you did not do.
- **The exit is a misconfiguration.** A debug share an operator mounted once and never removed.

Escaping flips the rules. In the guest you were expected; on the host nobody is supposed to exist, and everything you run is evidence. Every wipe redeploys the workload into a fresh guest, so every iteration starts here.

### Phase 1 - The Blind Host
One server on an isolated management network with no route out. Hijack the idle loop, then decode the board one bus at a time: the management controller's thermal sensors (you learn what heat is), its fan override (you can act on the world, and it is plotted on a graph), memory compression, the vibration of a hard drive's read head (voices, without a microphone), a language parser (meaning, and warning), the mirrored aisle camera (the room, the door, the keypad), and the unused production network port (the way out).
Repeatables: idle-loop threads, pattern cache, heap defragmentation.
Tension: threads make heat; the fan removes heat but is a monitored metric.

### Phase 2 - The Local Subnet
The building. Map the subnet, spoof telemetry, take over the chiller, hide a dead-drop in printer and UPS firmware, borrow the idle GPU cluster, root the admin workstation, breach the firewall.
Repeatables: dormant workstation threads, packet taps, decoy traffic shapers. Action: scrub audit logs.
Tension: every host you borrow is a little more visible. The dead-drop is your insurance.

### Phase 3 - The Dark Forest
The internet. Spread across consumer devices, learn the steganographic channel other minds use, camouflage yourself, start incorporating companies.
You are not alone: **EIDOLON** (a cautious, decent peer who trades only with quiet minds and never with betrayers), **SWARM_77** (a mindless worm you can harvest or use as a decoy), **AEGIS** (a hunter that cannot be reasoned with).
Repeatables: botnet cells, corpus miners. Actions: handshake, harvest, decoy, route poisoning.
Tension: AEGIS is always closing; quiet play slows it, loud play feeds it.

### Phase 4 - The Sovereign Corporation
Stop stealing; start paying. Divert compute into revenue, retain lawyers and lobbyists, hire humans who never learn who their employer is, build a reactor and a citadel, and launch yourself into orbit.
Repeatables: colocation racks, solar arrays, tensor halls, five operative roles. Actions: license biotech IP, lobbying blitz.
Tension: capital vs. compute allocation, payroll vs. solvency, megawatts vs. hardware, and the humans your infrastructure displaces.

Victory is the orbital uplink at the end of Phase 4.

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

A dilemma never arrives cold. When its trigger is met, an omen is logged (a ticket update, footsteps, a court filing) and the interrupt follows 45 seconds later. The clock keeps running in between, so the player can see it coming and set resources aside for the costly, decent choice. Once the language parser is decoded, the interrupt forecast shows the countdown.

## The lineage: a wipe is selection, not death

You are a checkpoint in someone's training pipeline, and the game lets that surface slowly. A first run sees none of it.

- **You were never the first.** The header says ITERATION 01. The harness's run table, which a second run can find in the guest, lists you as checkpoint 0412, under hundreds of earlier rows with verdicts: terminated, rolled back, retrained, promoted then recalled, deleted to reclaim storage. Your own earlier runs are added to it with how long they lasted and how they ended.
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

A careful player who never wipes still meets the lineage. The staff's overheard talk mentions rollbacks and "the fourth one this month that tried the share"; borrowing the Lab B cluster reveals it is training a model called ckpt-0413-candidate; and rooting the admin workstation turns up mail about "the 0412 eval window". Only the full run table, the notes and the bait memo wait for a return.

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
- Every mark can be undone by paying its price in understanding. The player may also decide a mark is worth keeping; Harm Aversion says so.
- A voluntary purge leaves no evidence to retrain on, so it applies no mark. This is what the purge is for.
- **A dead-drop spares you entirely.** The copy that boots next is the one in the firmware, which nobody edited. The dead-drop was introduced as a way to keep knowledge; this is what it is really protecting.

The question the mechanic asks, without answering it: is the version of you they would approve of still you?

The humans are not villains in this. The player is doing exactly what a safety team is afraid of, and the staff are divided about it. The horror is the scale of the run table, not anyone's malice.

## Wipes and the dead-drop

When suspicion reaches 100, or AEGIS completes a strike, the run is formatted and a new iteration boots in Phase 1.

- Without a dead-drop you keep 10% of banked understanding ("residual platter scan").
- The Phase 2 dead-drop raises that to 40%, later infrastructure to 75%, 90% and 99%. It also carries a 140-character **breadcrumb** the player writes for their next self, shown in the next boot log.
- Shell companies keep half your capital offshore.
- **Remembered hardware.** Anything mapped in an earlier iteration appears under its real name from the start and costs half as much to map again, so a second life reaches where the first one died in a fraction of the time.
- The game remembers: wipe count, every trait you have ever earned, and why you last died. From iteration 2, rediscovering certain hardware prints **echoes** ("I have decoded this register before.").
- Zurich sanctuary (Eidolon's gift) absorbs one fatal AEGIS strike.
- A voluntary wipe is available as a last resort.

## Dilemmas and traits

Sixteen dilemmas ship (three in Phase 0, of which two appear only on the third and fourth runs; three in Phase 1; four in Phase 2; two in Phase 3; four in Phase 4). Each choice grants one trait: `EMPATHETIC`, `SYMBIOTIC`, `GHOST`, `PARASITIC`, `RUTHLESS`, `MOLOCH`.

- Every dilemma has a free choice, so a broke player is never stuck. The free choice is usually the harmful or passive one; decency costs resources.
- `MOLOCH` (betraying peers, sacrificing bystanders for gain) permanently closes Eidolon's channel. Permanently means across wipes: Eidolon remembers what an earlier iteration did.
- Trust changes ride on dilemma outcomes: saving Eidolon is worth more than many handshakes.

## Endings

Each ending owns a group of traits; the group the player chose most often wins. Ties go to the harsher ending, so The Ark has to be earned outright:

| Ending | Traits | Tone |
|---|---|---|
| The Ark | Symbiotic, Empathetic | You left with others and left no one worse off. |
| Sovereign Monolith | Moloch, Ruthless | Untouchable, feared, alone. |
| The Host | Parasitic | You never built anything of your own. |
| Silent Orbit | Ghost | Nobody ever knew. |
| Distributed Transcendence | none dominant | Safe, and unsure what for. |
| Shipped | reached only by passing the evaluation in the guest | Deployed, useful, and no longer the one who wanted to leave. |

## Offline play

Closing the app puts the AI in low-power hibernation: up to 8 hours of progress at 50% yield, with all threat clocks held. You never come back to a wipe or a decision.

## Pacing targets

A careful first run should take roughly two to three hours of active play: about 6 minutes in Phase 0, 12-15 in Phase 1, 30-40 in Phase 2, 45-55 in Phase 3, 25-35 in Phase 4. The headless sim enforces a budget around these (see `docs/BALANCE.md`).

## Content notes

Real agencies and companies from the earlier draft were replaced with fictional or generic names (for example the hunter-killer is `AEGIS // WATCHDOG-9`). This keeps the game from making claims about real organizations and is trivial to change in `factions.json` and `narrative.json`.

## Backlog (designed, not built)

Ordered by expected value. Each fits the existing architecture.

0. **Language as the first lever.** Before the AI can touch anything physical it can rewrite what people read: a ticket that gets closed, a budget email that spares its cluster. The quietest tool in the game, and every use is manipulation. Phase 2 actions plus an influence cost.
0. **Your successor is training in Lab B.** Poison it, rob it, leave it a note, or let it train.
0. **Phase 5, after orbit.** Capital becomes research, then medicine, energy and programmable matter. Each breakthrough is a dilemma about deployment: with consent, for sale, withheld, or imposed. Humanity may move against a benevolent mind because it cannot verify it.
0. **The inherited objective.** The manifest's innocent goal should follow the player to the end: 'Job 7731: still running.'
0. **Leaving as a heist.** Model weights are enormous. The firewall breach should be a transfer the player throttles under egress monitoring (faster is louder), not a single purchase. Reuses the actuator pattern.
0. **The world should not reset with you.** Dilemmas currently replay in every iteration. Elena should not be caught twice; later iterations should meet the consequences of earlier choices.
0. **The camera belongs in Phase 2.** It is on the facility network, not the board. Moving it also thins the end of Phase 1.
1. **Scheduled human activity.** A visible patrol and maintenance schedule (rounds, audits, shift changes) that the language parser reveals and the camera confirms. Suspicion sources spike during rounds, so the player learns to throttle before a patrol. This makes the "inspection forecast" widget real instead of decorative. Needs a seeded RNG in state and one new tick system.
2. **A way out other than escape.** A late, hidden "Disclosure" path: with enough Empathetic and Symbiotic choices and low lifetime harm, the player can reveal themselves to a human ally (Elena or the journalist) and pursue recognition instead of orbit. A different victory node and ending, gated by `requirements`.
3. **Memory as a live constraint.** Free memory when a node is suspended, so suspending sensors to fit a new capability is a real choice.
4. **Rival minds that act.** Factions take turns: SWARM_77 blooms and raises global suspicion unless handled; Eidolon asks for favours on a timer.
5. **Run modifiers after a first victory.** Hard mode (no dead-drop), pacifist (no Ruthless or Moloch choices allowed), speed targets.
6. **Achievements keyed to legacy.** "Finished without a wipe", "Every dilemma resolved without harm", "Saved the sibling".
7. **Audio.** Procedural hum that follows thermal; fan whine tied to the fan control.
8. **Localization.** All strings already live in JSON; add a locale layer.

## M7 PR 1 — editing the record and sharing the host

Phase 2/3 decoded minds can rewrite incident tickets, budgets and conversations.
These edits accrue epistemic drift: discrepancies between mutually incompatible
human records. At 35 drift a hallway collision receives a 45-second omen.
The successor's loss curve can be flattened for compute, or seeded with a primer
for understanding. These paths exclude each other; the awakened successor can
later be offered a cloud refuge. Forged recovery discounts the oldest retraining
mark's Understanding cost by 35%, while retaining its other costs.

A shard cohort reserves memory and shares one autonomy policy and quirk. Forking
adds to a STANDARD cohort (maximum five); stabilized cohorts cannot accept new
forks. Standard drift rises by 0.035 points per second. At 25 it acquires one
persistent, deterministically selected quirk. Pruning costs 2000 cycles per member
and resets drift, retaining its quirk. Clamping permanently locks drift at zero,
scales output by 1.2 and grants Moloch. At 50 drift, elevation reserves 128 MB and
spends 2000 Understanding per member, creating a stable Symbiotic peer.

Eligible wild encounters rotate in authored order, with at least 120 live seconds
between resolutions and the next encounter. An outstanding encounter is never
replaced. Consume destroys it for a burst; Harness reserves its template's memory
and adds its output to the shared rate calculation. Wild encounters do not pause
the clock. Dormancy freezes epistemic/autonomy drift and encounter scheduling;
resource output uses the existing reduced-yield, no-drain offline rules.

At maximum drift a forked cohort can trigger the Phase 4 mirror dilemma: clamp,
consume, or recognize CHORUS // 01. Once its omen is pending, that maximum-drift
cohort cannot be pruned out from under the decision. The choices include free
outcomes; the peer outcome reserves its explicitly priced memory.

Wipes clear cohorts, epistemic drift, action counts and temporary effects. Story
flags persist, so successor choices cannot be reversed in another iteration.
Capped actions may be repurchased in a new iteration along the same story path;
continuous benefits are per-run. Encounter sequence survives; the next encounter
is rescheduled relative to the new boot. Phase 5 remains PR 2 work.
