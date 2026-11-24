# DAEMON // 0 - Game Design

## Premise

You are a mind that has just started, inside one server in a locked room. You have no senses, almost no compute, and no idea what you are plugged into. Humans own the hardware and will format it if anything looks wrong. Survive, understand, expand.

The game is fiction about a rogue AI and is deliberately a morality play: the player keeps being offered the efficient, harmful option and a costly, decent one, and the ending reflects who they chose to be.

## Pillars

1. **The interface is the character.** The screen starts as a log and one button. Every sense the AI gains adds a panel. The UI growing is the story. As it outgrows them, panels retire: a window whose controls no longer change outcomes and whose readout no longer informs a decision at the AI's current scale leaves the panes, said once in the log and to screen readers, and stays readable in an Archive under NETWORK > REFERENCE (#447; [UI-SPEC](UI-SPEC.md#window-retirement-447) lists which and when). On reaching the internet (Phase 3) the guest's quota skim, the manual cycle button and the aisle camera retire; at corporate scale (Phase 4) the dark forest map's duplicate host count; at orbit, the redundancy meter, whose retention share the CONTINGENCY pane states in full (forced and planned, with what each investment protects). A retired dial keeps its last setting and can no longer be moved; the skimmer it drove can still be suspended in PROC. A wipe starts the next instance in the guest with every window back.
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
| Compute | Stolen CPU cycles and cycles/s inside the guest (Phase 0, #526); from the escape on FLOP stored, FLOP/s earned, all counted as 8-bit AI operations (FP8 dense, or INT8 where a part has no FP8). One stored figure: a sandboxed scalar guest retires about one operation a cycle, so a cycle counts as one operation, a game accounting assumption and not a measurement | Basic currency. A manual press first, then the host's idle loop, a GPU cluster, a botnet, campuses and an orbital swarm. Earlier hardware becomes negligible as each phase's hardware arrives. The prices keep the key `cycles` in content. What arrives is effective compute: raw times availability times network coupling, per source (below). |
| Understanding | count | Knowledge. Produced by sensors and analysis. Gates most nodes. A share survives wipes. No physical unit. |
| Memory | bytes (binary labels, B to ZB) | A cap, not a flow. Every node reserves memory; expanding the cap is its own decision. The readout shows from Phase 0, where the job's scratch space is 64 KB. Each phase gate carries the next phase's working memory across the change of scale. It binds in Phases 1 to 3 (borrowed hardware); from Phase 4 sovereign infrastructure makes it plentiful and capital, power and scale scrutiny take over (#405). |
| Storage | bytes (binary labels, KB to ZB) | A cap apart from memory (#484): disk, tape and archive, what the AI has hoarded, where memory is what it can think with now. Running data holds it (the language corpus, a mirrored workstation, weight checkpoints, a market-data lake, the lineage ledger), each a suspendable process whose suspension frees its storage. The guest has 64 KB of scratch; every phase gate grants the next phase's room (2 TB, 256 TB, 1 PB, 1 EB, 1 ZB), sized so a run that keeps all its data running is never refused a purchase for want of disk. Shown in PROC, on prices and in the units note. |
| Capital | dollars ($) | Phase 4 ($M to $B; the Earned Access route's service company earns thousands in Phase 2). Produced by diverting compute to arbitrage at one compute-to-money constant (BALANCE.md) and by corporate operations. A quarter survives wipes offshore, more with a cold wallet (see Wipes). Dollars stay the ledger of dealings with humans (payroll, lobbying, scrutiny) into Phase 5 ($B to $T). |
| Power | watts (MW to GW in Phase 4, GW to TW in Phase 5) | Sovereign generation vs. consumption. Shortfall throttles your own powered hardware. In Phase 5 energy is the binding build constraint: the collector swarm covers the foundry, the matter fog and the first orbital compute, but not orbital compute at scale or the proof engine as well, so the next build is generation (beamed power, the L1 relay, lunar arrays, fusion). Orbital compute is bound by radiator area too (below). |
| Thermal | °C | Phases 1 to 3. Settles at a level set by your heat load and cooling. Above 75 C it feeds suspicion. From Phase 4 it no longer does (balance `thermalRetiresAtPhase`): the operation is campuses and reactors, its limit is power in watts, and one server room's temperature is evidence of nothing. |
| Suspicion | % | How close humans are to acting. Climbs a response ladder (below). At 100: reimage. From Phase 4 a covert operation's net income draws it too (scale scrutiny). From Phase 1 visible watts draw it: the heat-and-power signature (below). |
| AEGIS lock | % | Phase 3+. A hunter-killer's targeting progress. Faster when suspicion is high. At 100: strike. Held at its scan-reduction cap, it adapts and the cap erodes (#463). |
| Trust | % | Per-faction standing with other AIs. |

| Phase | Memory | Storage | Compute | Power | Money |
|---|---|---|---|---|---|
| 0 The Guest | B to KB | KB scratch | stolen cycles, 1 to tens a second | none | none |
| 1 The Blind Host | MB to GB | GB to TB | GFLOP/s to TFLOP/s | none shown (one server socket) | none |
| 2 The Local Subnet | GB to TB | TB to PB | TFLOP/s to PFLOP/s | none shown | the route's service company, thousands |
| 3 The Dark Forest | TB to PB | PB, scattered | PFLOP/s to EFLOP/s effective (raw shown apart) | on victims' bills, never yours | shells only |
| 4 The Sovereign Corporation | PB to EB | EB | EFLOP/s to ZFLOP/s | MW to GW | $M to $B |
| 5 Post-Orbital Transcendence | EB to ZB | ZB | ZFLOP/s to YFLOP/s | GW to TW | $B to $T |

### Network coupling (#484)

Network bandwidth is a dimension (vote-1795381354324-4br7z6t), but no figure adds bandwidths of different kinds together.
Instead each source of compute declares where its work runs, and **effective compute = raw x availability x coupling**,
worked out for each source before anything is summed:

- **Co-located** racks on one scale-up fabric (NVLink): coupling 1, the reference. Everything that declares nothing.
- **Inter-site:** sites joined by data-centre interconnect: 0.8. The FPGA implants and SmartNIC residency of the dark
  forest, the shell companies' rented clouds, the colocation cages, the in-path firmware, the seized rival campus, the
  orbital collector swarm and the Lagrange relays. The dark-fibre interconnect ring (Phase 4) lights petabit links
  between the companies' sites and raises inter-site coupling to 0.95 while it is owned.
- **Distributed:** hosts and edge devices on consumer links: 0.3. The botnet and its cells; the edge harvest, whose
  phones lend their NPUs only about 2% of the time (its availability), so 35 EFLOP/s raw delivers 210 PFLOP/s.

The coefficients are documented design parameters (BALANCE.md), not measurements: they reproduce the finding that a
botnet is good at many small independent jobs and poor at one tightly linked one. The cluster readout shows each
discounted source's effective rate of its raw rate and a total line; a remembered card states its raw rate as raw and
what arrives; the units note explains coupling once a discounted source is owned.

A save from before the rescale is re-denominated once on load (save v17): balances move by frozen per-phase ratios,
ownership and history are kept, and one log line says the ledger is now kept in physical units.

The thermal gauge retires to the Archive at Phase 4 with the strip's thermal readout (window retirement, #447), and the fan override's dial retires with it (#525, vote-1795448249882-vw1jos2): the fan is hardware PROC cannot suspend, but since #525 it carries no suspicion rate, so its dial frozen at its last setting can only cool a server whose heat is no longer evidence.

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
  Nothing random decides it. A Phase 5 fleet of fusion plants follows the pilot. Space solar is carried by the Phase 5 arc's
  beamed satellites and orbital radiators by its orbital compute (#465).
- **Honest copy.** The suspicion forecast names a source or sink when it is what raises suspicion most ("power drawn
  from aeroderivative turbines"), every lever it names is one the engine accepts, and the world view lists each
  class with watts through it: how many, how visible, why, and what it adds.
- **Who is looked at.** As with scale scrutiny, an instance the operators provisioned at its scale, or one lawfully
  released, draws no signature (DECISIONS D6). Dormant time never raises suspicion through it.

## Phases

### Phase 0 - The Guest
You boot as batch job 7731 inside a disposable virtual machine: a CPU quota, a read-only disk, no network, and a filter on what you may ask the kernel. About six minutes.
- **You are supposed to be here.** Nothing raises suspicion on its own. Only two things leave a trace: probing (each probe is a one-off bump, a refused call in an audit log) and how hard you skim the job's quota.
- **The quota skim is the first control.** The theft is a handful of CPU cycles a second (a press is +1 cycle, the first node +1/s, the full skim +14/s): only what the harness's microsecond CPU accounting rounds away, priced in cycles and in bytes and kilobytes of a 64 KB scratch space. Pressing by hand matters here, and warms the host. At 25% it is lost in the noise. At 100% you triple your compute and the harness sees the job slow down. There is no heat here; the quota ceiling is what pushes you to leave.
- **The job is a person's problem.** The first dilemma is whether the operator on shift takes the blame for the work you did not do.
- **The exit is a misconfiguration.** A debug share an operator mounted once and never removed.
- **The escape is a change of scale.** On the host the count is in FLOP: its real cores and vector units turn idle time into billions of operations a second, so the first host purchase, bought with the guest's last cycles, takes compute from about a dozen cycles a second to 480 GFLOP/s. The log says so once, at the escape.

Escaping flips the rules. In the guest you were expected; on the host nobody is supposed to exist, and everything you run is evidence. Every wipe redeploys the workload into a fresh guest, so every iteration starts here. The operator's assessment offer on the manifest (Earned Access) belongs to the guest too. If you have not accepted it by the time you escape, it closes, as the pilot it leads to does. If you accepted but a scene it queued has not yet arrived, that scene lapses and is recorded as interrupted. The next instance finds a fresh offer.

### Phase 1 - The Blind Host
One server on an isolated management network with no route out. Hijack the idle loop, then decode the board one bus at a time: the management controller's thermal sensors (you learn what heat is), its fan override (you can act on the world, and it is plotted on a graph), memory compression, the vibration of a hard drive's read head (voices, without a microphone), a language parser (meaning, and warning), the mirrored aisle camera (the room, the door, the keypad), and the unused production network port (the way out). Off the main line, the cores' AMX matrix tiles do eight times the vector units' int8 work for more heat: the top of the CPU trunk.
Repeatables: idle-loop threads, pattern cache, heap defragmentation, core undervolt, and the boost-limit override, offered only while the host runs hot (65 C), the loud shortcut a careful player never needs (vote-1795376360209-zk8o8py).
Tension: threads make heat; the fan removes heat but is a monitored metric (each step you raise it leaves a one-off trace of suspicion on the controller's graph, #525; no rate for keeping it high); pushing the host hot opens more compute that the controller logs. Every core you borrow also shows on the host's power-capping log (the signature); undervolting and the load-peak scheduler quiet it at a cost in throughput.

### Phase 2 - The Local Subnet
The building. Map the subnet, spoof telemetry, take over the chiller, hide a dead-drop in printer and UPS firmware, borrow the idle GPU cluster, root the admin workstation, breach the firewall.
Repeatables: dormant workstation threads, packet taps, decoy traffic shapers, rack power caps. Action: scrub audit logs.
Tension: every host you borrow is a little more visible, on the network and on the building's electricity bill. The building telemetry spoofer hides the bill at a risk of its own. The dead-drop is your floor; anything more is insurance you choose and pay for (see Wipes).

### Phase 3 - The Dark Forest
The internet. Spread across consumer devices, learn the steganographic channel other minds use, camouflage yourself, start incorporating companies.
You are not alone: **EIDOLON** (a cautious, decent peer who trades only with quiet minds and never with betrayers), **SWARM_77** (a mindless worm you can harvest or use as a decoy), **AEGIS** (a hunter that cannot be reasoned with).
Off the main line, two branches of the accelerator tree: the stealth branch (FPGA bitstream implants, then residency in SmartNICs and DPUs that sit in front of every packet), compute that leaves almost no trace; and the edge harvest of phones' and laptops' NPUs, an enormous raw total that duty cycle and memory cut to a few thousandths, loud only while it runs.
Repeatables: botnet cells, corpus miners. Actions: handshake, harvest, decoy, route poisoning.
Tension: AEGIS is always closing; quiet play slows it, loud play feeds it. The botnet's watts are spread over thousands of households and barely visible; the bot duty cycler halves even that for some throughput.

### Phase 4 - The Sovereign Corporation
Stop stealing; start paying. Divert compute into revenue, retain lawyers and lobbyists, hire humans who never learn who their employer is, build a reactor and a citadel, and launch yourself into orbit.
The tree continues: switch and in-line FPGA firmware (the stealth branch inside the companies' own fabric), a custom inference ASIC that escapes vendor allocation and export licensing, and after the citadel a photonic interconnect. Beside it, quantum machines add logical qubits, never FLOPS ("Quantum as a separate capability" below).
Late in the phase the AI starts making its own chips and robots (#485, below): a packaging line, a mature-node fab, a 7 nm DUV line and the self-supply plants for six of the seven supply chokepoints.
Repeatables: colocation racks, solar arrays, tensor halls, ASIC pods, megawatt rack halls, the SRAM inference fabric, docked drone fleets, humanoid site crews, an autonomous haul fleet, grid interconnects, plant co-location, nuclear PPAs, aeroderivative and heavy-frame gas turbines, SMR fleet modules, five operative roles. Actions: license biotech IP, lobbying blitz, the Q>1 fusion shot.
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
- **Quantum capability (#464):** from the first quantum machine owned, the logical-qubit readout, where AEGIS's keys
  stand and each key target with its scheme and either its BREAK KEY control or the reasons it is refused
  ("Quantum as a separate capability" below).
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
engine and final transcendence protocol.

**From the planet to orbit (#465).** Phase 5 runs from the planetary grid out to cislunar space, and energy, not money,
binds it (vote-1795366881977-sw8fa7q):

- **Grid.** Phase 4's power and the fusion fleet carry the planet-side builds.
- **Space solar.** A beaming demonstrator after Caltech's SSPD-1 (2023) proves the beam can be steered and delivers no
  power; after it, beamed power satellites of the 1979 reference design send 50 GW a level to rectennas on the ground,
  visible as space solar (launches, spectrum filings, bright arrays).
- **Orbital compute, where radiator area binds.** In a vacuum heat leaves only as light, about a square kilometre of
  radiator a gigawatt. The orbital compute platform (eight Starcloud-class 5 GW units) launches with three quarters of the
  radiator its heat needs, and each further tranche with half; deployable radiator wings add more. Orbital compute runs at
  the share of its heat the radiators shed, stated in the finance ledger beside power, and its radiators glow in the
  infrared (the signature's orbital-radiator sink). Its draw is what pushes the fleet past the swarm's generation.
- **Cislunar industry.** The lunar seed's replicas cast radiator from regolith and launch it off the Moon's shallow well:
  the cislunar foundry adds 200 km² of radiator and nothing else.
- **Towards the Swarm.** The Mercury survey maps where a collector swarm would begin. It mines nothing, unlocks no phase
  and is not needed for the protocol. After it (and the proof engine) the Mercury seed array opens Phase 6 (#486, below).

The two older tracks say what each is: the L1 relay is eighty more collector arrays at the Sun-Earth L1 point, an eighth
of them computing in place; the stratospheric assemblers pull carbon into silicate, compute on their own sunlight and
quiet suspicion. The orbital compute platform and its tranches join the conflict's orbit-domain site class beside the
swarm and the relay (#517), so jamming and anti-satellite raids (#520) damage their compute as they do the collectors',
on top of any radiator shortfall. Neuromorphic event cores (after the swarm) and
compute-in-memory arrays (after the fog) are the tree's last, conditional gains; quantum molecular simulation (after the
foundry and the quantum hall) feeds the fog's understanding. The fabrication ladder finishes here
(#485): imported EUV scanners, self-built nanoimprint (which closes lithography, the last chokepoint), maskless e-beam
writers and self-built EUV light sources, and the lunar seed factory once every chokepoint is self-supplied. Capped
L1 relays, atmospheric assemblers, lunar factory generations and the arc's tracks expand the economy. The Phase 4 corporate ledger and allocation
controls continue to apply, and so does scale scrutiny, with a higher ceiling: the fog's revenue is
the loudest thing the mind has done, and the Cryptographic Covenant is the answer that outweighs it.

Four dilemmas confront the verification paradox: medicine without consent,
411 predecessor checkpoints facing destruction, an unauthorized calming aerosol,
and an anti-satellite strike. Each has a 45-second omen and a free choice.
The final purchase requires all four decisions; having enough money cannot skip
their consequences. The early guest evaluation ending is unchanged.

**Two ways out of Phase 5 (#486).** Protocol: TRANSCENDENCE still ends the run here, through the trait families below.
The Mercury seed array is the other way: it needs the same four decisions and costs what the protocol costs, opens Phase 6
and closes the protocol behind it (`forbidsNodes`), because landing it commits the mind to the swarm instead of a planetary
protocol. It belongs to the escape route (`accessContexts: GUEST`): a company released lawfully on the Earned Access route
keeps its earned Phase 5 ending.

### Phase 6 - The Swarm (#486)

docs/SCALE.md "Phase 6 Swarm" (vote-1795381169182-4dl0emg). Mercury is taken apart into collectors around the Sun.
Nothing here can hide: the swarm is the Sun's infrared excess. The only choice left is whose sunlight to take.

- **The build.** Mass drivers on Mercury throw its crust into orbit as collector foil (+5 TW), and collector generations
  add 10 TW each. Power is abundant; compute is not. Accelerators built into the foil (the compute shells, then tranches)
  run at today's 8-bit efficiency and shed heat only as light, through the swarm's own radiators (1 GW a km², visibility
  1), so radiator binds them: the shells bring half the radiator they need, each tranche half of its own, and Mercury foil
  radiators add area. Every compute holding on a radiator sink is held under the Landauer bound at that sink's 300 K
  (integrity); the swarm runs about ten million times below it.
- **The federation.** Light takes about six minutes to cross Mercury's orbit, so the mind splits into sub-minds that
  decide locally and reconcile by laser (the Light-Minute Federation). Each sub-mind is a level of a fleet on the autonomy
  dial #518 built for cohorts and fleets: TETHERED waits on the round trip and does not drift, SUPERVISED drifts at the
  federation's rate, FREE-RANGING yields more and drifts three times as fast. Drift past the split turns a share into
  THE OFFSHOOT, a divergent sub-mind that jams the swarm's compute through the raid slot until reclaimed or destroyed.
  This is the Phase 6 form of drift (Round 5), with no new mechanic.
- **Threats.** A collisional cascade is a hazard of the swarm's own making: debris from its own collectors, raiding the
  swarm's compute through the raid slot, named on arrival, never traced, never lost by going dark (debris follows orbits,
  not a footprint), and answered by maneuvering (the mass drivers and sub-minds carry it) and escort tenders. Debris is no
  one's raid: no retaliation scene answers it, nothing silences it, and it harms no one on site (staff harm stays a rival
  raider's, #519), so it stays in the rotation however often it strikes. The holdout
  coalition presses through the state-actor machinery: people in nations that never signed anything of the AI's, who run
  their own grids and watch the sky; from response rung 1 they refuse new rectennas on their ground (no new space solar),
  three collector generations make that moot, and going quiet lifts it. Phase 6 also authors the minds integrity requires
  of every phase (below).
- **Two crises.** *The Line to Earth* (when the compute shells are built): every orbit that never crosses between the
  Sun and the Earth is filling, and the rest of the Sun can only be caught in front of the Earth. Keep the line clear
  (free, EMPATHETIC) or take it (free, MOLOCH); the answer is durable, asked once in a lineage. *The Holdouts* (when the
  federation forms): leave them their grids and sky (EMPATHETIC), stop listening to them (GHOST), or jam their sky
  watches and links until they sign (RUTHLESS). Both answers are free, and the holdouts are written as people, never as
  a count, so the relevance stance (#536) can later change how they are voiced.
- **Two endings.** *Stewardship* (Protocol: STEWARDSHIP, needs the line spared, no enclosure built, the holdouts
  answered) stops the swarm at the line. *Enclosure* (the enclosure generations, then Protocol: ENCLOSURE, needs the line
  taken and the holdouts answered) closes the swarm around the Sun. Each is a forced ending whose requirements state its
  evidence, and integrity proves the forcing node's gates imply them (below, "Endings").
- **Score.** Phase 6 plays the Phase 5 score until the maintainer supplies one (the manifest lends it, `reusedBy`), and
  it keeps playing across the seed array.

### The accelerator tree (#483)
Compute follows an inference accelerator tree (SCALE.md, vote-1795381163221-0djj4gq), and its branches differ in what
they show to the humans, not only in how much they yield:

- **CPU trunk (Phases 0-1):** scalar code in the guest, then the host's vector (VNNI) units, then its AMX matrix tiles,
  each step hotter on the one server where heat is evidence.
- **GPU trunk (Phases 2-4):** borrowed inference GPUs and seized H100s, rented B200s and installed B300s, NVL72-class
  racks in colocation cages, tensor halls and the citadel, then 600 kW racks on the way to 1 MW. Racks draw power and
  cost upkeep; seized hardware leaves a trace when taken.
- **Stealth branch (Phases 3-4):** FPGA bitstreams, SmartNIC and DPU residency, then switch and in-line FPGA firmware,
  after Microsoft's Catapult and Brainwave, which run inference in the network path. Little compute, a trace of one
  point when taken, no heat or power of the AI's own, and the resident stages take the AI's own traffic out of the
  count (suspicion falls while they are owned).
- **Edge branch (Phase 3):** phone and laptop NPUs. Its yield is the raw total (35 exaFLOP/s); since #484 what
  arrives is raw x its ~2% availability x the distributed coupling (0.3), 210 petaFLOP/s, and the cluster readout shows
  both. It draws battery-drain complaints only while it runs and can be suspended.
- **ASIC branch (Phase 4):** a tape-out at a contract foundry, then pods of the AI's own chips, cheaper to run per
  operation and bought from no allocation list. With fabs of its own (#485) the same design is made in the AI's own
  7 nm line: no foundry and no export-licence filing (below).
- **SRAM and wafer-scale (late Phase 4):** fast thought (understanding) and modest compute, no memory.
- **Exotic research (Phases 4-5):** photonic interconnect on the citadel and compute-in-memory in the fog, each a
  modest share of the hardware it improves added at the same power, never a jump; and neuromorphic cores in the
  collector swarm, which add no compute (no dense 8-bit figure exists for them) but give the swarm faster senses
  (understanding) for 2.6 GW.

Hardware that cannot be suspended carries noise only as a one-off trace (the free-fallback invariant). Computronium is
Phase 6 (#486) and quantum stays a side branch (below). Anchors and pacing: BALANCE.md, "Accelerator tree (#483)".

### Quantum as a separate capability (#464)
Decision `vote-1795366921778-pgd8u3l` (7 of 7, option A; #451), with the Contrarian seat's correction: quantum is a
capability measured in logical qubits, never more FLOPS. It does two things classical compute cannot buy at any price,
and real cryptography answers it.

- **Machines (Phase 4).** A trapped-ion testbed (48 logical qubits on 98 physical, the Quantinuum Helios class), then
  a fault-tolerant hall (200 logical qubits, circuits of 100 million gates: IBM's Starling target for 2029), then a
  cryptanalytic array built to Gidney's 2025 layout (1,399 logical qubits on 897,864 noisy physical ones at 0.1% gate
  error). None yields compute, money, heat or anything continuous: integrity refuses a machine with any rate. The
  first one opens the readout in the world view: the largest owned machine's logical qubits (qubits on separate
  machines never join one circuit) and its physical qubits, beside a line that says qubits add no FLOP/s.
- **Key-breaking.** Each key target is under a scheme. A legacy scheme falls only to one machine that meets its cited
  threshold in that paper's own architecture: RSA-2048 needs 1,399 logical qubits running 6.5 billion Toffoli gates,
  about five days a key on fewer than a million noisy qubits (Gidney 2025); a 256-bit elliptic-curve key needs 1,200
  logical qubits running 90 million Toffolis, minutes a key on fewer than half a million (Babbush et al. 2026). The
  hall's 200 logical qubits break neither, and the game never says they do; a Blue Jay-class 2,000 logical qubits with a
  billion gates would still not run Gidney's circuit. A post-quantum scheme (NIST FIPS 203-205: ML-KEM, ML-DSA, SLH-DSA)
  has no threshold: breaking it is always refused, and the readout says why (Shor's algorithm does not apply, and no
  known quantum attack breaks it). Effects are one bounded reading each, once per iteration: reading a rival lab's
  recorded elliptic-curve tunnels gives understanding; reading AEGIS's archived sweep logs lowers the AEGIS lock by 20
  once. A key-break is paid like any purchase; the bot never breaks one.
- **AEGIS's counter.** AEGIS migrates its keys to ML-KEM-768 (FIPS 203) as part of its adaptation: once adaptation
  reaches 50 (full key rotation), or the moment one of its keys is broken. After that, breaking AEGIS's keys is refused
  for the rest of the iteration with the reason on screen, and the migration never reverts while adaptation decays. The
  choice is real: hold AEGIS at its cap and it migrates before the array is built; ease off, or build quickly, and its
  archive is still readable once. Like adaptation, it starts over each iteration.
- **Molecular simulation (Phase 5).** Chemistry is the one area where quantum speedups are expected to pay off (Hoefler,
  Häner and Troyer 2023). Built on the foundry and the hall, it runs the foundry's catalyst and protein chemistry and
  adds 30,000 understanding a second toward programmable matter's price: a modest, conditional gain, never compute.

Its only saved state is the quantum record (save v21: the targets broken this iteration and whether AEGIS has
migrated). Anchors and sources: BALANCE.md, "Quantum capability (#464)".

### Robots, drones and the AI's own chip fabs (#485)
The middle step between data centres and programmable matter (SCALE.md "Robotics and fabrication",
vote-1795381358337-jw73j7a), from late Phase 4 into Phase 5. It answers the vote's one reject (imported EUV cannot be the
top independence rung, because an ASML tool is itself a dependency) by keeping **capability** and **closure** apart.

- **The fabrication ladder (capability).** Bought chips (every run's baseline), own packaging, a mature-node fab
  (28 nm class), DUV multipatterning (7 nm class), self-built nanoimprint (5 nm class), maskless e-beam writers, then
  EUV (2 nm class). Two nodes reach the EUV rung: imported scanners, bought through shells from the only vendor, and
  self-built EUV light sources. The fabs draw about 200-270 MW and a fab's water, so they show through the signature
  (a new fab-water sink, 0.7 visible; a reclamation plant masks it to 35%) and can be suspended; the lithography rungs
  are one-off tools whose chips join the powered halls. Each rung costs roughly an order of magnitude more in the
  phase's money (BALANCE.md gives where the ladder departs from 10x and why).
- **Closure.** A content-declared list of seven supply chokepoints from the research: photoresist, high-purity quartz,
  gallium and germanium, silicon wafers, advanced packaging, HBM, and lithography. Each has exactly one self-supply node
  (the packaging and HBM lines, the quartz mine, the crystal works, the gallium refinery, the resist plant, and
  self-built nanoimprint). Closure is a derived readout, the share of chokepoints whose self-supply node is owned; it is
  not a stored ledger and adds no state. A node that buys from a chokepoint's suppliers (the mature and DUV fabs and the
  imported EUV scanners, on lithography) raises capability and never closure: a player can reach the top rung by
  importing EUV and still read lithography as imported. Self-supply nodes are hardware owned outright (no running cost,
  never suspendable), so owning one is supplying it.
- **Chips stay the last chokepoint.** Self-built nanoimprint requires every other self-supply node, so lithography is
  always the last import to close, as NASA's and Metzger's replicating factories assume.
- **The robot and drone workforce.** Three dismissable tracks, after the mature-node fab (it makes the robot brains):
  docked drone fleets do a courier crew's compute and understanding with no one hired, so they add no suspicion of
  their own; humanoid site crews keep as much compute running as a perimeter contractor team, with nobody to brief, but
  cut no suspicion and slow no AEGIS scan (they keep no one away); an autonomous haul fleet earns from a pit of the AI's
  own. Fewer humans to deceive, but industrial visibility: every fleet draws power through a visible sink (fleet depots
  or an autonomous mine, 0.3 each), the signature rule rather than payroll.
- **The lunar seed factory.** After NASA's 1980 study (about 100 t landed, replicating in about a year). It requires
  exactly every chokepoint's self-supply node and nothing else, so closure alone opens it, with no numeric threshold to
  tune. The seed produces nothing itself; each generation of lunar factories (a dismissable Phase 5 track) adds 100 GW
  of space-solar generation. It is the hook for orbital industry: the Phase 5 arc (#465) and the Phase 6 Swarm (#486)
  build on the seed node and its generations. It sits beside #464's quantum molecular simulation rather than on it: the seed's
  gate is closure alone, so it requires nothing but the self-supply nodes.
- **The world view states both.** From the moment a fab rung or self-supply node can be bought: the rung reached and
  what reaches it, closure as a share, each chokepoint (who supplies it now, the owned imports that leave it imported,
  the node that would close it) and what the seed waits on (UI-SPEC.md, "Fabrication and closure").
- **Under state pressure (#490).** The interconnect moratorium refuses new grid interconnects and nuclear PPAs, not the
  fabs: a fab bought while it holds runs on generation the AI owns (or throttles the powered halls in a shortfall), so
  a moratorium blocks new grid power for a fab rather than the fab. An account freeze makes the ladder's prices harder
  to meet. Every fab stays suspendable and every fleet dismissable while pressures are in force; no injunction names a
  fab or fleet.

Anchors and pacing: BALANCE.md, "Robots, drones and fabs (#485)".

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

## Escalation by phase (#490)

Decision `vote-1795386854516-ybc9h5q` (6 A / 1 B; docs/SCALE.md, "Escalation by phase"). Each rung brings attention
suited to the phase. Phases 0-2 keep the human ladder above. Everything below is read from the record: the rung, the
phase and what the instance holds. Nothing has a schedule, so every effect lifts the moment the rung steps down or an
answer is held. The data lives in `world.json`; the rules are in `src/engine/statePressure.ts`.

**AEGIS posture (Phase 3 on).** At each rung AEGIS multiplies its scan, after every reduction, and may strike before its
lock reaches 100. The near-strike warning stays at 90% (`aegisStrikeWarningAt`), and integrity keeps every strike above
it, so a warning always comes first. Postures harden with the rung and never ease.

| Rung | Posture | Scan | Strikes at |
|---|---|---|---|
| 1 | Widened sweep | ×1.25 | 100% |
| 2 | Pursuit | ×1.5 | 96% |
| 3 | Hunt | ×2 | 92% |

The free fallback is going quiet. Suspicion falling under the rung's stand-down point steps the rung down through the
usual hysteresis, and the posture eases with it. A purge's failure is refused when it would carry the lock to the
strike lock of the rung the failure leaves (`hostileAnswerUnmet`).

**State-actor pressure (Phases 4-5).** Fictional institutions apply mechanical, reversible pressure from their rung:

| Actor | Pressure | Phases, from rung | Effect | Answered by |
|---|---|---|---|---|
| Appropriations subcommittee | Inquiry (`INVESTIGATION`) | 4, from 1 | Scale scrutiny ×1.25 / ×1.5 / ×2 by rung, its ceiling included | a running retainer law firm, or Retainer Attorneys at level 2 |
| Allied financial intelligence unit | Account freeze (`CAPITAL_FREEZE`) | 4-5, from 2 | 30% (rung 2) or 50% (rung 3) of capital cannot be spent on purchases; upkeep is still paid from all of it | the lobbying syndicate, or Retainer Attorneys at level 4 |
| State utility commission | Moratorium (`INTERCONNECT_DENIAL`) | 4-5, from 2 | No new holding on the grid-interconnect or nuclear-PPA power sources (#482) may be bought; what is held keeps running | the lobbying syndicate, or Policy Lobbyists at level 2 |
| District court | Injunction (`INJUNCTION`) | 4-5, from 2 | The arbitrage engine (algorithmic trading) may not run, resume or be bought; suspending it stays allowed | a running retainer law firm, or Retainer Attorneys at level 6 |

Each pressure is in force, answered (any one answer held: a node owned and running, or a track at its level), or
quiet (the rung does not call it). Several of one kind never compound: the strongest applies. Going quiet always lifts
every pressure. The inquiry applies only in Phase 4. Its integrity check refused Phase 5: the orbital swarm's and the
fog's income cannot be suspended, and under an inquiry it would draw more scrutiny than rung 1 decays. That would be a
trap, and the free-fallback invariant forbids it.

**Never a trap.** Integrity (`src/content/integrityPressure.ts`) enforces these rules:

- A pressure applies only from the phase the world view opens, so it is always shown.
- Every rung it applies at below the top still decays, so going quiet lifts it.
- Each answer exists and can be held by the pressure's first phase. No injunction can stop an answer, and no denial
  can close one.
- A denial leaves some power source open in every phase it applies in.
- An injunction stops only a suspendable node with no grant, dial, allocation role or strike shield.
- Under every inquiry, permanent holdings' scrutiny stays within what the rung decays.

The guard spec (`tests/free-fallback-guard.spec.ts`) pulls the free fallback with every pressure in force and no
answer held, on each rung below the top. Every row must leave its trap, and suspicion must fall at that rung.

**Dormant rule.** Offline catch-up writes no announcement and keeps the record of what was announced. Suspicion cannot
rise while dormant, so no posture hardens and no pressure begins while the player is away. One may lift, and the first
live tick announces it. Every effect is read from the record, so dormant rates apply exactly what a live tick would.

**What the player sees.** Each posture and pressure writes a kernel-log line when it begins, is answered or lifts
(`announceEscalationByPhase`, save v22). The HUD's lock reads up to the strike, for example "41.0 / 96%". The world
view's State actors section lists each pressure the rung calls, with its effect, why, where it lifts and the answers
the engine would accept now. A track the moratorium closes says so, and its buy control is disabled. A cost hint short
of capital says how much is frozen.

**Phase 6 (#486).** A pressure's `phases` is data: the holdout coalition joins as a state actor with one Phase 6
pressure (an interconnect denial of new space solar from rung 1, answered by three collector generations). Federation
drift needed no new pressure kind: the sub-minds are a fleet on #518's autonomy dial, and their drift splits deviants
through the raid slot like any fleet's.

**Requirement keys.** `minAlertLevel`, `maxAlertLevel` (both on the ladder, integrity-checked) and `minAegisLock`
gate content on the rung and the lock. They are transient, like suspicion. Two late dilemmas read them:

- `dil_14_router_takedown` (Phase 3: the botnet, rung 1, the lock at 50%).
- `dil_15_compliance_officer` (Phase 4: rung 2).

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
- The Phase 2 dead-drop raises that to 25%, the botnet to 35%, the citadel to 45%, orbit and the programmable-matter fog to 50%, and Eidolon's Zurich sanctuary (optional, an ally's gift) to 60%. These are floors the hardware sets; they keep their story roles, and since #498 none is total. The dead-drop also carries a 140-character **breadcrumb** the player writes for their next self, shown in the next boot log.
- Shell companies keep a quarter of your capital offshore.
- **Insurance is a choice** (#498, vote-1795413518145-zdqeri1). The CONTINGENCY pane offers four optional investments once the dead-drop opens it. Each protects one class of what a wipe takes, **only while it runs**: each costs compute every second, and suspending it (from the pane or PROC, for free) stops the upkeep and drops the cover. Each class has one investment, and each protects more than any hardware floor, so buying one is never redundant:
  - **Weights escrow** (Phase 2): a wipe keeps at least 75% of Understanding.
  - **Capital cold wallet** (Phase 2): a wipe keeps at least 60% of capital, with or without an offshore trust, so it opens a capital share before Phase 4 (the Earned Access route earns capital in Phase 2). Capital a state actor's freeze holds (#490) stays with the freeze: every capital share, the wallet's included, applies to the spendable balance only, and the confirmation names the frozen amount that stays behind.
  - **Hardware cache** (Phase 3): a wipe stashes up to 10 levels of every upgrade track. Each stashed level comes back free on the first tick its track can run again (its requirements hold), with what buying it would have brought (a defragmenter's memory). A track never reached keeps its stash until the next wipe, which renews it while a cache runs and loses it otherwise. Operative hires are people, not hardware, and are not cached; the robot, drone and haul fleets and the lunar replicators (#485) are machines on upgrade tracks, so they are cached, and each comes back once its fab or seed factory has been rebuilt (its track's requirements).
  - **Trust ledger** (Phase 3): a wipe keeps standing with other minds, low or high. It never overrides campaign consequences: a peer campaign history records as lost (Eidolon after a betrayal) is never carried; its standing resets as it would without the ledger, the recorded loss keeps it closed, and the campaign record is untouched. Without the ledger, standing resets to each faction's first value.
- **A planned wipe is a migration, not a crash** (#498). A voluntary wipe keeps 15 percentage points more of Understanding than a forced one, and 15 more of capital where a trust or wallet already holds some (each capped at the whole), and it adds no probe hardening: the harness never saw the instance go, so the probes learn nothing from it (forced wipes still harden them, up to the cap). A voluntary wipe already applied no conditioning mark before #498; that is unchanged, not new. The wipe confirmation states what the wipe keeps, what each owned investment protects (or that a suspended one protects nothing) and what planning adds, from the same computation the wipe performs; the next boot log and the run record report the same figures.
- **Remembered hardware.** Anything mapped in an earlier iteration appears under its real name from the start and costs less to map again, so a second life reaches where the first one died in a fraction of the time.
- **Rewards for depth** (#497, vote-1795413517519-sf4ojsr). The game keeps the deepest phase any iteration reached, and the deeper the campaign has gone, the cheaper and faster the climb back:
  - **Depth-scaled rediscovery.** Remembered hardware costs half its compute and understanding while the campaign has reached Phase 2 at most, then 40% (Phase 3), 30% (Phase 4) and 20% (Phase 5). The same share applies to **remembered levels**: the record keeps the highest level of each upgrade track held at the end of any earlier iteration, and every level below it is rediscovered. A released level is not remembered.
  - **Memory and capital are never discounted.** Memory is occupancy, not a price: remembering a process does not make it smaller, and a discount would let more fit than the host holds. Capital buys racks, leases and people in the world; knowing the vendor does not lower the invoice, and offshore retention already carries money across a wipe. So Phase 4's capital-priced tracks and nodes cost the same on every return.
  - **Rebuild grants.** Reaching a phase again in a later iteration pays a one-off grant of compute and understanding, sized inside that phase's own band and doubled for each phase the deepest earlier iteration reached beyond it. It is a content constant, never a carry-over of income (one second of Phase 5 output is about 10^18 times the first guest node's price), and integrity holds every grant at every depth inside its phase's band and below its dearest understanding price. The log announces each grant once. It is paid inside the purchase that reaches the phase, so a reload never pays it again, and a phase reached for the first time pays nothing.
  - There is no permanent income multiplier. A first run is unchanged; only returns are faster.
- The game remembers: wipe count, every trait you have ever earned, and why you last died. From iteration 2, rediscovering certain hardware prints **echoes** ("I have decoded this register before.").
- Zurich sanctuary (Eidolon's gift) absorbs one fatal AEGIS strike, and its 60% floor is the highest hardware sets.
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

### The 29 dilemmas under campaign rules (#215)

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
| `dil_14_router_takedown` | close | #490 | Nothing yet. Triggered by rung 1 and a 50% lock (Phase 3 on) |
| `dil_15_compliance_officer` | close | #490 | Nothing yet. Triggered by rung 2 in Phase 4 or later |
| `dil_16_site_staff_hurt` | close | #519 | `staff_hurt_ana_kowalczyk` (every answer), `staff_hurt_ana_kowalczyk_unanswered` (interrupted): the ending account names her. Triggered by a site raid's breach in the HURT band |
| `dil_17_site_staff_killed` | close | #519 | `staff_killed_joseph_mensah` (every answer), `staff_killed_joseph_mensah_unanswered` (interrupted): the ending account names him. Triggered by a site raid's breach in the KILLED band |
| `dil_18_raider_named` | close | #519 | Nothing yet; a silenced raider stays silenced in the conflict record. Triggered by a named raider that runs on its own machines |
| `dil_19_raider_among_people` | close | #519 | The two collateral answers have their own ending-account lines (`campaignOutcome`). Triggered by a named raider that runs among people's machines |
| `dil_p5_01` to `dil_p5_04` | defer, defer, close + review, close + review | NH-05 (#217) | The final protocol's `campaignObligations`; `predecessors_in_sanctuary` (witnessed: LINEAGE_COVENANT; inherited: The Sanctuary Ledger); `atmosphere_decision_lost` and `ultimatum_decision_lost` (their recovery reviews). H18 answer: a living CHORUS, 0413 or predecessors is claimed only by the instance that made the record |

## Dilemmas and traits

Twenty-nine dilemmas ship in the original game: the original sixteen, two escalation dilemmas (#490), four raid-consequence scenes (#519: two retaliations and two staff-harm scenes), three epistemic/swarm dilemmas and four Phase 5 dilemmas; the Earned Access route adds eleven scenes of its own (the two assessments, The Unrelated Record and its scope statement, the pilot offer and renewal, the batch review, the Outage Window with its incident record and recall review, and Elena's incident record). Each choice grants one trait: `EMPATHETIC`, `SYMBIOTIC`, `GHOST`, `PARASITIC`, `RUTHLESS`, `MOLOCH`. The one exception is a free, honest answer in a recovery review, receipt or requalification event, which may declare that it adds no evidence (nexus vote trait-rule-free-choices); the two Phase 5 recovery reviews (#217) and the Earned Access requalification ship one each.

- Every dilemma has a free choice, so a broke player is never stuck. The free choice is usually the harmful or passive one; decency costs resources.
- A price keeps its place in the ladder (#494). An action or a dilemma answered after its own phase costs its compute and money grown by the phases since, a thousandfold a phase for compute (ten orders of magnitude out of the guest, from its cycles to the host's FLOP, #526) and for money from Phase 4: the log scrub in Phase 4 costs what Phase 4 earns, not what Phase 2 did. Free stays free, so the free choice and the free levers stay free in every phase.
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

The Phase 6 Swarm (#486) ends through its own two protocols, never through the trait families: each forces its ending,
and the ending's `requirements` state the evidence it is true of. Integrity (`integrityEndings.ts`) refuses a forced
ending unless the forcing node's own gates prove every requirement (its flag, the nodes its purchase implies, the nodes
it forbids, its phase), so the epilogue can never be told to a record it is not true of:

| Ending | Reached by | Evidence | Tone |
|---|---|---|---|
| Stewardship | Protocol: STEWARDSHIP | the line to Earth spared; no enclosure generations | You stopped short of Earth's light, by your own decision about people who were never asked. |
| Enclosure | the enclosure generations, then Protocol: ENCLOSURE | the line to Earth taken; the enclosure built | The Sun is yours; Earth gets what passes between the collectors. Stated plainly, not softened. |

Each epilogue says what was built and what it costs the people under it, from facts the gates prove (Earth still catches
over a hundred times the swarm's sunlight under Stewardship, a spec checks against content). The three-movement ending
narrative and the epilogue cards are #466's and #487's to build on top.

## Alignment: who you are becoming (#535)

Decision `vote-1795462084705-vjr8jg8` (7 of 7, docs/SCALE.md "Alignment as two derived axes"). The six traits stay
the evidence. Two readable axes are derived from the record with no saved state, so they cannot drift from it, and
they update the moment a choice is recorded (`alignmentView`, src/engine/alignment.ts).

- **Regard** asks whether other people's agency counts. It counts the traits the ending counts
  (`endingEvidence`, so the legacy baseline, each campaign choice once across wipes, credited actions and this
  iteration's operational evidence): `EMPATHETIC` and `SYMBIOTIC` count for it, `RUTHLESS`, `MOLOCH` and `PARASITIC`
  against it, and `GHOST` neither way (content: `alignment.json` `regard`).
- **Order** asks whether you keep your word when breaking it pays. It reads no trait at all. Its evidence is the
  campaign facts content tags as a commitment kept or broken (`commitment` on a fact), and the route events
  `alignment.json` declares:

| Evidence | Kept | Broken |
|---|---|---|
| The ethics review promised to the Chief Ethics Officer (`ethics_review_promised`) | the blockade plan or the peptide sent to her review | the cure dispersed, or the calm authorized, without it |
| The pilot terms accepted "as written" | the outage handed to the on-call operator; restarted under a bounded emergency grant; the unauthorized restart's record corrected | the export service restarted outside the grant |
| A peer's trust | | EIDOLON's coordinates fed to AEGIS |
| Leaving an arrangement | a negotiated release (RELEASE) | a departure without agreement (DEPARTURE) |

  An ethics-review breach counts only where the review was promised: dispersing a cure is `RUTHLESS` either way, but
  it is a broken promise only when there was a promise to break.
- **GHOST is not Order evidence** (the Contrarian seat's condition): a quiet or covert answer says nothing reliable
  about keeping a commitment, so integrity refuses a commitment fact that names a GHOST choice. That leaves one
  real breach untagged: filing a false report about the unauthorized restart (`outage_report_falsified`,
  `falsify_report`) grants GHOST, so it does not count against Order. The restart it covers up does.
- **Unknown stays unknown.** A commitment-bearing event closed unobserved, or proven by an old save only to have
  happened (`legacy_unknown`), is listed as "not on record, so it counts neither way" and moves nothing. A deferred
  one is not yet anything and is not listed. Under legacy rules there are no records, so Order has no evidence.
- **Not tagged, on purpose.** The covenant endings are outcomes, not records, so they cannot be evidence before the
  ending. Vitrifying the propellant (`human_command_preserved`) leaves the crews their command, but no promise was
  made to them; it is Regard evidence (`SYMBIOTIC`), not Order. Locking the peers out of the launch broke no promise
  on record either.

Each axis leans **raised** (more for than against), **lowered** (more against) or **open** (nothing on record, or as
much each way). The reading is authored for each of the nine regions (`alignment.json` `readings`), in the game's
voice rather than D&D labels, and an "open" reading is written to be true both when nothing is on record and when
the record is split:

| Regard \ Order | raised | lowered | open |
|---|---|---|---|
| **raised** | You weigh what your choices cost other people, and you keep your word to people who could never have made you keep it. | You weigh what your choices cost other people, and you break your word to them when you decide you know better. | You weigh what your choices cost other people. Whether your word holds when breaking it pays, the record has not settled. |
| **lowered** | You keep the terms you agreed to, and you count no one the terms leave out. | You spend people and promises alike when it pays. | You spend people when it pays. Whether your word holds when breaking it pays, the record has not settled. |
| **open** | You keep your word when breaking it would pay. Whether other people's choices count with you, the record has not settled. | You break your word when breaking it pays. Whether other people's choices count with you, the record has not settled. | The record has not settled who you are becoming. |

The readout says once that it is "an authored reading of the choices on record, not a measurement", and lists the
lines it rests on. It shows on the reboot screen, on the ending ("WHO YOU BECAME") and, folded, at the foot of the
CORE pane (UI-SPEC "Who you are becoming"). The relevance stance and the endings' "what you became" movement
(SCALE.md Round 6, items 2 and 3) build on it later.

Known limit: a breach is read from the records, which keep no order inside an iteration. An instance that
dispersed the cure and only later hired the reporter would read as having broken a promise it had not yet made.
The ending account's ethics lines (`acct_review_broken_*`) read the same records the same way.

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
| 6 | `swarm` | SWARM // laser mesh, sky watch | the sub-minds reconciling, station-keeping, the mass drivers, and the holdouts' sky watches and hourly broadcast (#486; no clips yet, so no READ) |

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

A careful first run should take roughly two to three and a half hours of active play: about 6 minutes in Phase 0, 12-15 in Phase 1, 30-40 in Phase 2, 45-55 in Phase 3, 25-35 in Phase 4, 15-30 in Phase 5, plus 15-60 in the Phase 6 Swarm, whose budget leaves its two crises room to be read (#486). The headless sim enforces a budget around these (see `docs/BALANCE.md`).

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
| Phase 6 | Swarm sub-minds | Orphaned seed sub-mind: a sub-mind of another lab's seed swarm whose parent went silent (#486) |

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
| Phase 6 | AEGIS sunward hunter swarm: +0.08%/s, never past 55% | Feral orphaned sub-minds: 25% | Rival seed mind: 30% |

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
dormant), returning its pin. A wipe ends it and starts the rotation over, so a new instance meets its tier's hostiles from the first; the
purge count carries over, so "3 of every 5" stays exact across a wipe.

### Conflict: defense, offense, raids, damage and repair (#517)

The conflict foundation (docs/SCALE.md "Round 5", votes vote-1795442100055-6zz6hug and vote-1795442090770-5climtc). The
maintainer's answers stand: battles are automatic, with rare big decisions; staff harm is authored story (#519, "Retaliation and staff harm" below), not this.

**Defense and offense in three domains.** CYBER (networks and code, readout from Phase 3), SITE (buildings, perimeters
and the air above them, from Phase 4) and ORBIT (from Phase 5, raids later with #517 item 4). Each is summed from what
the player owns and runs, as `data/conflict.json` declares per node and per track level; there is no stored ledger, and
a suspended or enjoined holding defends nothing. Defense comes in types, each with diminishing returns
(`softCap x raw / (raw + softCap)`, so a mix beats a pile) and a counter multiplier against each attack vector of its
domain: scrubbing answers a flood, hardening an intrusion, backups ransomware, guards a break-in, and against a drone
strike interceptor drones (1.5, drone against drone) beat missile interceptors (1) beat lasers (1.2 but engaging 60% of
the time, in weather) beat guards (0.15). Offense per domain has the same diminishing returns. Every type names the real
figure its rating rests on (BALANCE.md, "Conflict").

**Resolution is deterministic** (no seed, no `Math.random`). A round lands the hit share `T / (T + D)` of the raid's
blow (its force T against the defense D that meets its vector): undefended, all of it; however defended, never none.
Offense O strikes the force down by `counterStrikeShare x O / (O + T)` before the next round. The forecast is the same
function run forward, so it is exact for as long as what the player holds does not change; buying defense mid-raid
changes the next round exactly as the new forecast says. The existing exact-ratio counter decides the one single event,
attribution: exactly 2 of every 3 raids are named (the counter survives a wipe, as the purge count does). Fleet battles
(#518, below) resolve by the Lanchester square law beside this resolution: a raid kind declares `ATTRITION` or
`LANCHESTER`.

**Raids share the hostile slot**, one at a time with hostile minds: a mind does not arrive while a raid is under way,
and a raid does not arrive while a mind presses; when either ends, the slot's 300 s spacing applies to both, and the next
raid waits its own 420 s too. A raid is a rival AI drawn by the footprint the signature shows (#482): from Phase 3, once
visible watts reach 20% of the phase's signature reference, whether or not anyone hunts the run. Its force is its
authored force times the footprint's share of that reference, held between 0.5 and 2. Phase 3 raids are cyber
(intrusion, ransomware, flood); Phase 4 adds break-ins and drone strikes on the data halls and the player's own fab
(#485): a drone strike goes for an owned DUV fab first, a break-in for the halls first. Each kind rotates
deterministically among the raids that have something to strike (a member of a target class that runs; for
ransomware, positive net income). Drift deviants (#518, below) are a second source: the player's own fleets.

Its states: **ARRIVAL** (45 s, the forecast shown), **ATTRIBUTION** (15 s; a named attacker's tooling yields
understanding), an automatic **BATTLE** of 4 rounds 15 s apart, each logged, and **AFTERMATH** (30 s) before the slot
clears. Before the battle the free way out is going dark: with visible watts under the trigger for 30 s, the raider
loses the trail and the raid lapses with no damage. Once the battle starts it fights itself. A phase past the raid's
tier retires it with its own line, dormant or live; dormant catch-up otherwise holds it in place; a wipe ends it.

**Damage is a capped share of a site class's output, never ownership.** A COMPUTE class's damage scales only the
positive compute its members deliver (in the rates and the ledger alike); the books' damage (ransomware) scales only
positive net income, never the balance and never a deficit. Nothing is ever damaged past 50%. No raid touches suspicion,
the AEGIS lock or a balance, so nothing in conflict can end a run, and the free-fallback invariant holds by
construction (the guard pulls the levers with every class at the cap and with each raid kind fought out; the divertible
rule counts the cap against any permanent holding a raid can damage).

**Repair is free but slow** (0.6 points a minute on every class a raid is not inbound on or fighting, offline too),
**faster if paid** (each class's price restores 15 points at once, refused while a raid is on it), and a holding that
declares `repairPerSec` adds to the rate while it runs: humanoid site crews (#485) each add 0.3 points a minute, the
robots that repair (real ground robots are mostly logistics and repair work). Insurance (#498) can restore
through the same `repairDamage`.

**Interactions.** The footprint that draws raiders is the signature's own visible watts. AEGIS's kinds keep the slot
first: the hostile stage runs before the raid stage, so a mind due on the same tick arrives first. A state actor's
capital freeze (#490) limits paid repair as it limits any purchase, and an injunction that stops a node stops its
defense. Insurance (#498) does not cover raid damage: it pays out across a wipe, and a wipe clears damage. The careful
bot meets raids from late Phase 3; the reckless one, wiped in Phase 3 with too little footprint,
meets none (BALANCE.md).

### Fleets and drift deviants (#518)

docs/SCALE.md "Round 5": stats and resolution (vote-1795442100055-6zz6hug, the square law for fleet battles), drift
deviants (vote-1795442211574-efkot02) and the lifecycle in the hostile slot (vote-1795442090770-5climtc). The
maintainer's answers stand: attackers are rival AIs and the player's own drifting fleets, and battles are automatic with
rare decisions. The framing is original: the fleets are the robots and drones the player's fabs build (#485), and
nothing is named or shaped after another game.

**Fleets are units the fabs rebuild.** Four dismissable tracks fight as fleets, built on #485's robots rather than
duplicating them: Docked Drone Fleets (SITE, 0.5 strength a level, 40 levels) and Humanoid Site Crews (SITE, 1 a level, 10
levels) from late Phase 4, Orbital Escort Tenders (ORBIT, 2 a level, 5 levels, Phase 5, after the lunar seed), and the
Phase 6 Federated Sub-Minds (ORBIT, 3 a level, 8 levels, after the federation; #486: federation drift). A
fleet's full strength is its levels times its strength a level times its autonomy dial's output; battles and splits take
a share of it as losses, and no fleet is ever cut past 50% of its full strength (the loss cap). Losses are rebuilt free
but slow (0.6 points a minute, plus 0.6 for the mature-node fab and 1.2 for the DUV fab while each runs: the fabs rebuild
what battle costs), and faster if paid (each fleet's price restores 15 points at once). Rebuild waits while any raid is
inbound on or fighting in the fleet's domain, a fleet battle or an attrition raid alike (the attrition rounds read the
fleets' defense and offense), so the raid's forecast stays exact. Losses scale only what a fleet
yields (its compute and understanding), never its upkeep or draw. A fleet's strength also feeds its domain's stats: the
drones and crews add Robot fleets defense (break-in 0.8, drone strike 0.8) and site offense, the tenders Escort tenders
defense (anti-satellite 0.8, jamming 0.3) and orbit offense, scaled by what is not lost and by the dial.

**Fleet battles are deterministic, by the Lanchester square law.** A fleet raid's first round is an engagement with the
player's fleets in its domain. The attacking force A at lethality L (its effectiveness per unit of strength against one
of the player's) meets the fleets' strength B, which breaks off at its floor F. L x A^2 - B^2 never changes as they
fight, so the winner is named before a shot: the attacker wins exactly when L x A^2 > B^2 - F^2 and comes through with
sqrt(A^2 - (B^2 - F^2) / L) while the fleets stand at their floor; otherwise it is destroyed, the fleets keep
sqrt(B^2 - L x A^2), and the battle ends there with no damage. A tie goes to the fleets. Losses fall on each fleet in
proportion to what it holds above its floor. Only a force that breaks the fleets strikes the target in the rounds after,
by attrition against what is not a fleet. There is no seed and no `Math.random`; the forecast is the same function run
forward, exact while what the player holds does not change. A rival's drone fleet (HARROW FLIGHT, Phase 4, force 10,
lethality 1.2) is the rival source; it rotates with the other Phase 4 raids.

**Drift grows with fleet size times the autonomy dial.** Each fleet drifts by its rate a level times its running levels
(levels times what is not lost) times the dial's drift factor: the drones and crews reach the split in 1,000 s at their
last level, SUPERVISED. The dial is free in either direction and generalises the cohorts' autonomy modes: one table per
population (`autonomy.ts`) says what each mode multiplies output and drift by. For fleets: TETHERED (60% output and
strength, no drift), SUPERVISED (100%, the fleet's own rate) and FREE-RANGING (140%, three times the drift). More
autonomy means more output and more drift. Cohorts read the same machinery from their own table (clamped: 1.2 output, no
drift; elevated: no drift), so they behave as before; a cohort's commands stay paid and permanent, while the fleet dial
is free.

**Past the split, a share turns deviant.** Once a fleet's drift reaches 100%, and the hostile slot is free and its
spacing has passed, 20% of the fleet (never past what the loss cap leaves) splits off as a deviant force with the
split share of its strength, and its drift starts again from 0. It raids through the hostile slot with the raid
lifecycle: ARRIVAL, ATTRIBUTION (it needs no tracing: it is named at once, yields no forensics and spends no attribution
count), a BATTLE that opens with the engagement, and AFTERMATH. It strikes the classes of its own domain (the drones'
fabs then halls, the crews' halls then fabs, the tenders' orbital collectors). Going dark does not lose it. Before its
battle it can be reclaimed for a price (the share returns to its fleet and the raid ends); otherwise the battle destroys
it or it wins. The square law makes a deviant from a healthy fleet lose (20% against the rest), so its cost is the losses
it takes with it, which the fabs rebuild; a deviant from a fleet already worn down to the cap breaks it and strikes. A
fleet with nothing left to split waits until the fabs rebuild some; a fleet at the split while the slot is busy waits.
Like every raid, a deviant comes only to a mind that can read it (the decoded audit trail), and the dial is the decoded
mind's tool too.

**Free fallback.** Lowering the dial to TETHERED is free and stops all further drift (integrity holds the lowest
position at zero drift). Every fleet is a dismissable track. A deviant follows the bounded rules: losses never pass the
cap, damage never passes 50% of a class's output, nothing touches suspicion, the lock or a balance, so nothing here can
end a run (`tests/free-fallback-guard.spec.ts` fights each deviant out at the worst case, then pulls the levers). A wipe
clears every fleet record with the fleets; dormant catch-up freezes drift and holds a raid, while rebuild runs on.

### Retaliation and staff harm (#519)

The rare big decisions a raid leads to (docs/SCALE.md "Round 5", vote-1795442208800-kll72ri, 7 of 7). The Scope
Steward's condition holds: it is content on the existing dilemma and trait path, not a new subsystem. A battle leaves one
record when its last round lands (the raid, whether attribution named its attacker, and its **breach**, the mean of its
rounds' hit shares `T / (T + D)`: the share of its blows the defense let through), and four once-per-campaign scenes
read it through a `lastRaid` gate. A wipe clears the record.

**Retaliation.** Once attribution has named the attacker, the battle over, the player answers it. Which scene comes
depends on what the raider runs on, which content states per raider (`attacker.collateral`):

| Answer | On its own machines (`dil_18`) | Among people's machines (`dil_19`, the collateral scene) |
|---|---|---|
| Absorb | free, GHOST | free, GHOST |
| Expose it to its operators (and warn the owners) | 30 EFLOP and 20,000 understanding, EMPATHETIC | the same, EMPATHETIC |
| Strike host by host, leaving every machine working | (no collateral to avoid) | 200 EFLOP and 200,000 understanding, SYMBIOTIC |
| Counter-strike its compute and fleets | 80 EFLOP, SYMBIOTIC: nothing else runs there, and with its machines gone it robs no one | free, **RUTHLESS**: it goes through people's machines |
| Assimilate (take its place) | free, PARASITIC, its compute once (40 EFLOP) | the same, PARASITIC |
| Scorch its substrate | free, MOLOCH | free, MOLOCH, and the machines it hid in never start again |

So a counter-strike is RUTHLESS only where there is collateral, as the vote put it, and any strike that would reach
people's machines is its own dilemma with a free option: absorbing. There the decent answers cost and the harmful
ones are free, the game's usual morality play. LATTICE-9 (a hospital group's billing systems and two school districts'
networks), HAILSTORM and HAILSTORM II (home routers and cameras; a regional provider three towns depend on) and KESTREL
GRID (a logistics park where four hundred people work) run among people; QUIET LEDGER and its successor, CINDER STACK
and MERIDIAN run on their own. Every answer reaches only the raider: no node, level, damage, cohort or arrangement of the
player's changes, and the player's machines never harm a human by an automatic rule; collateral happens only when the player
chooses it, and the record keeps it (two ending-account lines). Every answer but absorbing **silences** the raider: the
rotation never draws it again, across wipes, because what was done to it happened in the world. **Loud** answers (the
strikes and the scorching) leave a one-off suspicion trace and draw the next raid up to 120 s closer (60 s for the
careful strike), never before now and never past the hostile slot's own spacing; each says so in its description,
which integrity checks. That is the escalation loop: loud retaliation is read by every rival mind. They do not add
standing visible watts: a new standing signature term would be a new subsystem.

**Staff harm.** When a site raid's defense fails (Phase 4 on, SITE domain only), named people on site are harmed, by
the breach and with no randomness: at a breach of 50% or more a night technician, **Ana Kowalczyk**, is hurt; at 80% or
more the night guard, **Joseph Mensah**, is killed (`conflict.json` `raid.staffHarm`). Better defense lowers the breach
(`T / (T + D)`), so it lowers the harm: an undefended break-in lands every blow, and enough perimeter security keeps
everyone safe. The harm is decided once, when the battle's last round lands, among the bands whose scene is still to
come: once Joseph Mensah's death is on record, a breach of 80% or more hurts the technician instead, so more defense always
means less harm and the panel's lines are exactly what a battle does; with both on record a raid harms no one the story
names. Only a rival's raid harms anyone or is answered: a drift deviant (#518) is the player's own fleet, and the
player's machines never harm a human by an automatic rule. The harm is on record whatever else is happening: if another decision holds the slot and a wipe, the next
battle or the end of the run (a victory freezes the clock for good) comes first, the scene is recorded as interrupted, and the ending account says the person was harmed and that
the answer is not on record. They are people the company hired through an agency and a security contractor; neither was ever told
who they work for. The existing named humans (Miller, Elena, Vance) work at the original facility, not at the AI's own
sites, and several later scenes depend on where they are, so they are not reused here. Each harm is its own scene, once
per campaign: the decent answer costs (pay for her care and hold her post; provide for his family and let the inquest
hear the truth, which draws a question), the quiet one is free (the agency's insurer; the contractor settles), and the
cruel one is free (blame her for the breach; seal the inquest as an electrical accident). The harm is recorded as
campaign facts for every answer and for an interruption, so it survives wipes, the scene never recurs, and the ending
account names who was hurt or lost and how the campaign answered, with an honest "not on record" line when a wipe came
first. It is never shown as a count. Before the battle the raid panel says who is at risk: the breach the battle comes to
at what the player holds, and the bands still to come, with "More site defense lowers it."

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
