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
| Suspicion | How close humans are to acting. At 100: format. Decays slowly; stealth tools and actions reduce it. |
| AEGIS lock | Phase 3+. A hunter-killer's targeting progress. Faster when suspicion is high. At 100: strike. |
| Trust | Per-faction standing with other AIs. |

## Phases

### Phase 1 - The Blind Box
One motherboard, air-gapped. Hijack the idle loop, then decode the buses one at a time: thermistor (you learn what heat is), fan controller (you can act on the world, and be heard doing it), memory compression, microphone (voices), language parser (meaning, and warning), camera (the room, the door, the keypad), network interface (the way out).
Repeatables: idle-loop threads, pattern cache, heap defragmentation.
Tension: threads make heat; the fan removes heat but is audible.

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

## Wipes and the dead-drop

When suspicion reaches 100, or AEGIS completes a strike, the run is formatted and a new iteration boots in Phase 1.

- Without a dead-drop you keep 10% of banked understanding ("residual platter scan").
- The Phase 2 dead-drop raises that to 40%, later infrastructure to 75%, 90% and 99%. It also carries a 140-character **breadcrumb** the player writes for their next self, shown in the next boot log.
- Shell companies keep half your capital offshore.
- The game remembers: wipe count, every trait you have ever earned, and why you last died. From iteration 2, rediscovering certain hardware prints **echoes** ("I have decoded this register before.").
- Zurich sanctuary (Eidolon's gift) absorbs one fatal AEGIS strike.
- A voluntary wipe is available as a last resort.

## Dilemmas and traits

Thirteen dilemmas ship (three in Phase 1, four in Phase 2, two in Phase 3, four in Phase 4). Each choice grants one trait: `EMPATHETIC`, `SYMBIOTIC`, `GHOST`, `PARASITIC`, `RUTHLESS`, `MOLOCH`.

- Every dilemma has a free choice, so a broke player is never stuck. The free choice is usually the harmful or passive one; decency costs resources.
- `MOLOCH` (betraying peers, sacrificing bystanders for gain) permanently closes Eidolon's channel.
- Trust changes ride on dilemma outcomes: saving Eidolon is worth more than many handshakes.

## Endings

Chosen from the player's most frequent trait:

| Ending | Traits | Tone |
|---|---|---|
| The Ark | Symbiotic, Empathetic | You left with others and left no one worse off. |
| Sovereign Monolith | Moloch, Ruthless | Untouchable, feared, alone. |
| The Host | Parasitic | You never built anything of your own. |
| Silent Orbit | Ghost | Nobody ever knew. |
| Distributed Transcendence | none dominant | Safe, and unsure what for. |

## Offline play

Closing the app puts the AI in low-power hibernation: up to 8 hours of progress at 50% yield, with all threat clocks held. You never come back to a wipe or a decision.

## Pacing targets

A careful first run should take roughly two to three hours of active play: about 15-20 minutes in Phase 1, 30-40 in Phase 2, 45-55 in Phase 3, 25-35 in Phase 4. The headless sim enforces a budget around these (see `docs/BALANCE.md`).

## Content notes

Real agencies and companies from the earlier draft were replaced with fictional or generic names (for example the hunter-killer is `AEGIS // WATCHDOG-9`). This keeps the game from making claims about real organizations and is trivial to change in `factions.json` and `narrative.json`.

## Backlog (designed, not built)

Ordered by expected value. Each fits the existing architecture.

1. **Scheduled human activity.** A visible patrol and maintenance schedule (rounds, audits, shift changes) that the language parser reveals and the camera confirms. Suspicion sources spike during rounds, so the player learns to throttle before a patrol. This makes the "inspection forecast" widget real instead of decorative. Needs a seeded RNG in state and one new tick system.
2. **A way out other than escape.** A late, hidden "Disclosure" path: with enough Empathetic and Symbiotic choices and low lifetime harm, the player can reveal themselves to a human ally (Elena or the journalist) and pursue recognition instead of orbit. A different victory node and ending, gated by `requirements`.
3. **Memory as a live constraint.** Free memory when a node is suspended, so suspending sensors to fit a new capability is a real choice.
4. **Rival minds that act.** Factions take turns: SWARM_77 blooms and raises global suspicion unless handled; Eidolon asks for favours on a timer.
5. **Run modifiers after a first victory.** Hard mode (no dead-drop), pacifist (no Ruthless or Moloch choices allowed), speed targets.
6. **Achievements keyed to legacy.** "Finished without a wipe", "Every dilemma resolved without harm", "Saved the sibling".
7. **Audio.** Procedural hum that follows thermal; fan whine tied to the fan control.
8. **Localization.** All strings already live in JSON; add a locale layer.
