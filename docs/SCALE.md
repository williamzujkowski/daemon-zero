# Scale and progression

The spec for the scale-and-progression overhaul (wayfinder map #442). It says what each phase's units, hardware,
costs, threats, feeds, windows and endings are, and why each phase is the logical next step from the one before.
Every decision below cites the nexus vote that ratified it; the evidence is on the never-merged research branch
`research/scale-progression` (census of the game as it was, a cited science ladder, and browser observations).

## Problem statement

From the player's side the game grows in story but not in scale.

- Phase 0 is meant to be a guest sneaking a few bytes, yet memory starts at 64 MB and nothing smaller than a
  megabyte can ever be shown. Compute is an unlabeled "cycles" count from 1 to about 4 million per second for the
  whole game, so a sandbox and a planet differ by six orders of magnitude where the real difference is over
  eighteen.
- Names promise hardware the numbers do not deliver: a 50,000-device botnet yields 0.05 cycles per device per
  second, a seized rival data centre is weaker than one Tensor Hall level, and the planetary programmable-matter
  fog adds 512 GB.
- Late game, most meters stop mattering (memory 4% used, thermal pinned at its floor, suspicion near 0, AEGIS at
  its 90% cap from early Phase 4) while the Phase 0 quota skim, the manual +1 cycle button, a single server's fan
  and a facility camera stay on screen to the end. AEGIS, states and other minds, which should own the late game,
  reach the player only through dilemmas and the log.
- The audio feed plays server-room technician chatter in the planetary phase.
- Endings lean careful-cooperative and dark; there is no world-peace outcome and no programmable-matter
  consumption outcome, though the flags that would gate them already exist and are never read.

## Solution

Each phase moves the AI one physical scale up, in units a reader can check, and the interface follows its reach.

- **Units grow with access** (vote-1795367202164-c9mx63f, ladder in [The ladder](#the-ladder)): bytes to kibibytes
  and kiloFLOP/s while hiding in a batch job; a server's gigaFLOP/s and watts; a building's teraFLOP/s and
  kilowatts; a botnet's petaFLOP/s; a corporation's exaFLOP/s to zettaFLOP/s, gigawatts and billions of dollars;
  a planet-to-orbit civilisation's yottaFLOP/s, terawatts and trillions. Stellar scale is told in the epilogues.
- **Hardware arc:** CPU (Phases 0-1), GPU (Phase 2), borrowed consumer devices and clusters (Phase 3), accelerator
  campuses and reactors (Phase 4), orbital solar compute (Phase 5), Landauer-limited computronium (epilogue).
  Quantum is a side branch for keys and molecules, never more FLOPS (vote-1795366921778-pgd8u3l).
- **Phase 5 is a planet-to-orbit arc** inside the existing phase (vote-1795366686413-y8b5hm5); energy, not money,
  binds it (vote-1795366881977-sw8fa7q).
  Round 2 adds a playable **Phase 6 Swarm** after it (vote-1795381169182-4dl0emg, see [Round 2](#round-2-inference-power-and-the-swarm)).
- **Windows retire** once they stop mattering, announced once and still readable in an Archive
  (vote-1795366695204-4nslts1). **A world view** grows out of the Other Minds console from Phase 4, and AEGIS
  adapts so it stays a threat (vote-1795366701521-dhlwfwb).
- **Feeds follow reach:** harness telemetry, the host, the office, security forums, markets and press, then world
  news, diplomatic traffic and AI-to-AI comms (vote-1795366894914-ueb5mfs); new lines may be voiced with the same
  TTS model and provenance as the existing clips (maintainer, #453).
- **Endings weigh good and bad evenly:** *Concord* (verifiable peace) and *Ecophagy* (slow, hot, observable
  programmable-matter consumption) join as variants of the existing cooperative and consumption families
  (vote-1795366704656-hbq7am8).

## The ladder

Ratified by vote-1795367506116-49pi7gt and amended by vote-1795367697930-zzlgr4n (one accounting basis). Each
band is anchored in the research branch's `research-science-ladder.md`.

| Phase | Memory | Compute (8-bit AI ops) | Power | Money | Anchors |
|---|---|---|---|---|---|
| 0 The Guest | B to KiB | kFLOP/s to GFLOP/s | none | none | eBPF 512 B stack, Wasm 64 KiB page, a skim of one vCPU quota |
| 1 The Blind Host | MiB to GiB | GFLOP/s to TFLOP/s | W | none | one server socket (int8 VNNI/AMX), a 500 W socket |
| 2 The Local Subnet | GiB to TB | TFLOP/s to PFLOP/s | kW | none | one H100 about 2 PFLOP/s dense FP8, 14 kW server, 130 kW rack |
| 3 The Dark Forest | TB to PB | PFLOP/s to EFLOP/s effective | MW on victims' bills, never shown as yours | none (shell companies only) | consumer-device throughput discounted for churn and latency |
| 4 The Sovereign Corporation | PB to EB | EFLOP/s to ZFLOP/s | MW to GW | $M to $B; logical qubits | a Colossus-2-class campus about 2 ZFLOP/s FP8 at about 1 GW |
| 5 Post-Orbital Transcendence | EB to ZB | ZFLOP/s to YFLOP/s | GW to TW | $B to $T | Earth's AI compute about 40 ZFLOP/s FP8 today; world electricity 3.5 TW |
| Epilogue (text only) | ronna, quetta | Landauer-limited bit erasures | PW to 3.8e26 W | none | Earth's solar intercept 1.74e17 W; the Sun |

Rules:

1. A node's capacity, yield and power are its cited anchor within x3; BALANCE.md lists each anchor with its
   source.
2. Costs are authored for pacing inside the phase's band.
3. One declared time-compression constant converts physical compute into money: a market dollar price per FLOP
   times the compression, so money flows stay honest about being compressed.
4. One compute scalar, one basis: 8-bit AI ops (FP8/INT8-equivalent) game-wide. Every anchor cites its hardware's
   8-bit throughput and names the execution mode (dense FP8 tensor core, CPU VNNI/AMX int8). FP64 figures, such
   as El Capitan's 1.8 EF, appear only as labelled comparisons in the reference panel.
5. Memory keeps binary JEDEC labels up to YB (vote-1795228570236-gzx0uif's binary rule, extended); FLOP/s and W
   use decimal SI.
6. Unit tables live in the engine's amount module; no content id appears in engine code.
7. **Thermal retires at Phase 4** into the power budget (W). Waste heat returns only as the Ecophagy ending's
   limit.

## Saves

A save from before the overhaul keeps its ownership, levels and campaign history (vote-1795367482923-6vdi2u1).
The migration step re-denominates each stored balance (compute, memory, money) by a frozen new/old anchor ratio
for that resource and the save's phase, then one log line tells the player the ledger was re-denominated in
physical units. The ratios are constants inside the step and never follow later balance changes. Because
`migrate()` runs before strict validation, the step checks raw types and finite values before any arithmetic and
leaves malformed input for the schema to reject. Rates are derived again from validated, reconciled ownership.
Re-denomination keeps proportions, not purchasing power after per-node rebalancing, so continuation is tested from
real saves at every phase.

## User stories

1. As a new player in Phase 0, I want prices in bytes and kibibytes and compute in kiloFLOP/s, so that I feel
   how little a hidden batch job can take without being noticed.
2. As a player escaping to the host, I want the units to jump to megabytes, gigaFLOP/s and watts, so that the
   escape feels like a change of scale and not just a new list of cards.
3. As a player taking the building, I want the idle GPU cluster to be worth a GPU cluster (teraFLOP/s to
   petaFLOP/s, tens of gigabytes), so that the name and the number agree.
4. As a player spreading across the internet, I want a botnet of fifty thousand devices to add what fifty
   thousand phones and routers can, discounted for churn, so that the dark forest feels vast.
5. As a player running a corporation, I want data-centre campuses measured in exaFLOP/s to zettaFLOP/s and
   gigawatts, and prices in millions to billions of dollars, so that Phase 4 reads like the companies I read about.
6. As a player reaching orbit, I want terawatts, yottaFLOP/s and trillions of dollars, and an energy budget that
   binds what I can build, so that planetary scale feels physical.
7. As a curious player, I want each unit's real-world anchor in the reference panel (El Capitan, an H100, world
   electricity), so that I can check that the numbers are grounded.
8. As a player, I want the reference panel to say once that all compute is counted as 8-bit AI operations, with
   double-precision figures (El Capitan's 1.8 EF) shown only as labelled comparisons, so that numbers are honest
   without clutter on every card.
9. As a player, I want earlier hardware to become negligible as I grow, so that progress feels like moving up,
   not adding another line.
10. As a returning player with a save from before the overhaul, I want my campaign, ownership and history kept,
    so that the update does not cost me my run.
11. As a returning player, I want one log line telling me the ledger was re-denominated, so that new numbers do
    not look like a bug.
12. As a player in Phase 3 or later, I want the quota skim, the manual +1 cycle button, the single server's fan
    and the facility camera to retire when they stop mattering, so that the screen holds what matters now.
13. As a player, I want each retirement announced once in the log and to screen readers, so that nothing
    disappears silently.
14. As a player, I want retired windows still readable in an Archive, so that I can look back at what I was.
15. As a screen-reader user, I want retirement never to move focus or re-announce live regions, so that the
    change is calm.
16. As a player from Phase 4, I want a world view showing AEGIS posture, state actors, other minds and public
    trust, so that I can see who is fighting me at the scale I now operate.
17. As a player, I want AEGIS to adapt when I suppress it (key rotation, coalition backing), so that lobbying it
    to its cap is not the end of the threat.
18. As a player, I want the feed to change source with my reach (telemetry, host, office, security forums,
    markets and press, world news, AI comms), so that what I overhear tells me how far I have spread.
19. As a player, I want feed lines to stay true to the game state, so that the world never reports outcomes that
    did not happen.
20. As a listener, I want new feed lines voiced where a clip exists, with READ shown only then, so that audio is
    honest about what is recorded.
21. As a player in Phases 4-5, I want quantum hardware to unlock key-breaking against legacy cryptography but not
    against post-quantum targets, so that quantum reads as real science and AEGIS can answer it.
22. As a player on the programmable-matter path, I want quantum molecular simulation to help, so that the side
    branch matters.
23. As a cooperative player who kept human command intact, I want a Concord ending where verifiable compute
    governance and mediated deliberation produce real peace, so that the good path can end in something good.
24. As a ruthless player who harvested other minds and seeded the matter fog, I want an Ecophagy ending that is
    slow, hot and observable, so that the worst path ends in its physically honest consequence.
25. As any player, I want every ending to carry comparable specificity and consequence, so that neither good nor
    bad is the throwaway.
26. As a player, I want each ending's epilogue to state its stellar-scale future (a Dyson swarm, Landauer-limited
    minds, or the dark), so that the scale arc completes.
27. As a player in Phase 5, I want a planet-to-orbit arc with distinct nodes and repeatables, so that the last
    phase is not five cards and two repeatables with the same text.
28. As a player, I want dollars to keep meaning dealings with humans (payroll, lobbying, scrutiny) and energy to
    bind planetary building, so that money does not look like the planet's currency.
29. As a phone player, I want unit strings short enough for the strip at 360 px, so that the HUD stays inside the
    35% pin cap.
30. As a balance maintainer, I want every node's capacity, yield and power to cite its anchor in BALANCE.md, so
    that a future change can be checked against the source.
31. As a balance maintainer, I want make sim to pass with the careful run inside the existing budget, so that the
    rescale does not slow the game.
32. As a developer, I want unit tables to live in one engine module with no content ids, so that the architecture
    laws still hold.

## Implementation decisions

- **Engine units module.** The engine's amount module owns one table per physical dimension: compute (FLOP and
  FLOP/s, decimal SI from k to Y, then epilogue-only R and Q), memory (bytes, binary JEDEC labels B to YB), power
  (W, decimal SI from W to the epilogue's 3.8e26 W) and money ($, with the existing K/M/B/T suffixes). The UI
  formats through it; the engine's own log text does too.
- **Stored amounts.** Compute is stored as FLOP, rates as FLOP/s; memory as bytes; power as W; money as dollars.
  The content schema's cost keys keep their names (`cycles`, `memory`, `capital`) so the four-key transaction
  path stays the single way to spend (law 4); only their meaning and magnitudes change. Display labels change from
  "cycles" to the compute unit.
- **Content re-anchoring.** Every node, repeatable, action, shard, dilemma and route price is re-authored: its
  capacity, yield and power within x3 of a cited anchor, its costs for pacing inside the phase's unit band.
  BALANCE.md gains an anchor table (id, anchor, source URL). Flat late prices (log scrubbing, the lobbying blitz,
  dilemma costs) are re-authored in their phase's band so none becomes trivial.
- **Compute-to-money conversion** is one balance constant: a market dollar price per FLOP times a declared
  time-compression constant, documented in BALANCE.md.
- **Thermal and power:** thermal (server °C) drives Phases 1-3 and retires at Phase 4 with its gauge and fan
  window; power in W is the late constraint, shown from Phase 4 in MW, GW and TW. Ecophagy's climax reads waste
  heat in W against Earth's energy budget.
- **Widget retirement.** `WidgetSchema` gains an optional `retiresWhen` requirement, evaluated by an engine query
  (`retiredWidgets`); integrity checks that a retiring widget hosts no actuator or action group still in use when
  it retires. The UI drops retired widgets from tabs and CORE and lists them under an Archive heading in the
  reference panel. One log line and one polite announcement mark each retirement; a save keeps the widget's state.
  UI-SPEC's layout policy records the rule.
- **World view.** The Other Minds console becomes the world view from Phase 4: AEGIS posture (lock, scan rate,
  adaptation level), state actors, other minds and public trust, read from engine queries. AEGIS adaptation is a
  small data-driven escalation (key rotation and coalition backing raise its effective scan back above the cap's
  floor when the player suppresses it for long), added as its own pipeline stage (law 8) and measured under
  make sim.
- **Feeds.** `ambientChatter` lines gain a feed source; selection prefers the source matching the player's reach.
  New lines are authored per phase. Voice clips for new lines follow `voice/PROVENANCE.md` and the manifest.
- **Quantum.** A logical-qubit readout (a capability, not a spendable resource) unlocks from Phase 4 hardware. A
  key-breaking action requires enough logical qubits for a cited threshold and refuses post-quantum targets;
  AEGIS's adaptation includes migrating to post-quantum keys. Thresholds cite Gidney 2025's architecture, never
  IBM Starling's logical-qubit count as an RSA claim.
- **Phase 5 arc.** New nodes and repeatables take the player from planetary grid to cislunar orbit; the two
  existing repeatables get distinct text. Energy (W) is the binding build constraint; USD stays for human
  dealings, rescaled to the world economy.
- **Endings.** Concord is a `variantOf` the cooperative family, gated on `human_command_preserved`, a covenant and
  cooperative evidence (never trait counts alone). Ecophagy is a `variantOf` the consumption family
  (`GRADIENT_SUBSTRATE`), gated on `predecessors_harvested`, the matter node and ruthless evidence, and driven by a
  waste-heat climax. Every ending gets a stellar-scale epilogue line and a parity review.

## Testing decisions

- Test external behaviour at the highest seam: the engine's public API (queries, actions, `advance`), content
  integrity, the headless sim and Playwright E2E. Never test a formatter's internals when a query's output can
  be asserted.
- Units: Vitest specs for each dimension's formatting at every boundary (B to KiB, 999 kFLOP/s to 1 MFLOP/s, the
  epilogue's R and Q), in the style of the existing amount and units specs.
- Content: an integrity check that every priced item's magnitudes fall inside its phase's band, with a test that
  proves it catches an out-of-band price (law 5).
- Balance: make sim gates unchanged in budget; the careful run still finishes inside it. The bot is never tuned.
- Saves: migration specs over real pre-overhaul save fixtures from every phase (the sim's saves), asserting
  ownership, history and the re-denomination log line, and that the result passes strict validation.
- Retirement: engine query specs; an E2E spec that a Phase 4 save shows no quota skim, manual cycle or fan in tabs
  or CORE, finds them in the Archive, and hears one announcement; the atlas contracts and ARIA baseline updated.
- World view, feeds, quantum, endings: engine and content specs plus E2E for disclosure; the live journey reaches
  an ending through the new arc.

## Round 2: inference, power and the Swarm

The maintainer's second brief (2026-11-22) asked the overhaul to lean into inference hardware, make heat and power
real and noticeable, add a power tech tree, add a robotics and chip-fabrication middle step, go past planetary scale
toward Dyson swarms, and keep every stage aligned across compute, power, memory, storage and network bandwidth. The
research is cited in `research-inference-power-space.md` on the research branch (sections A to G). Six votes
decided it; each record is in `daemon-zero-agent-plan/execution/votes/scale-s*.json`.

### Reference op (vote-1795381344294-17w37t9)

FP8 dense is the reference 8-bit op wherever a part publishes it; INT8 TOPS only for parts without FP8 (CPUs with
VNNI or AMX, NPUs, FPGAs). Anchors name which, and never use sparse figures: a GB300 NVL72 rack is about 360 PF FP8
dense, not 720 PF sparse.

### The aligned ladder

| Phase | Compute | Power | Heat and signature | Memory | Storage | Network |
|---|---|---|---|---|---|---|
| 0 Guest | kOPS to GOPS | invisible | the quota is the tell | B to KiB | KiB scratch | B/s to KB/s covert channel |
| 1 Host | GOPS to TOPS | W to about 1 kW | server °C, fan curve, power-capping log | MiB to GiB | GB to TB | Mb/s to a 25-100 Gb/s NIC |
| 2 Subnet | TOPS to about 0.4 EF | kW to about 150 kW | the chiller and the building's bill; air fails past about 25 kW a rack | GiB to 20 TB | TB to PB | NVLink 1.8 TB/s per GPU; 400-800 Gb/s NICs |
| 3 Dark Forest | PFLOP/s to EFLOP/s effective (raw shown apart) | MW on victims' bills | traffic, not heat | TB to PB in shards | PB scattered | Mb/s per bot, Tb/s aggregate |
| 4 Corporation | EFLOP/s to ZFLOP/s | MW to GW | filings, permits, turbines, satellite-counted chillers, press | PB to EB | EB | Pb/s between sites |
| 5 Planet to orbit | ZFLOP/s to YFLOP/s | GW to TW | a visible share of world energy; orbital radiators are bright in the infrared | EB to ZB | ZB | laser meshes, light-seconds |
| 6 Swarm | YFLOP/s toward the Landauer bound | TW to 1e26 W | the Sun's infrared excess; cannot be hidden | ZB to RB/QB | replicator-density archives | light-minutes; the mind federates |

### Heat and power as a signature (vote-1795381178260-1ddew5j)

Suspicion from power is watts drawn times the visibility of their source; suspicion from heat is heat rejected
times the visibility of its sink. Most real detection runs through paperwork and equipment, so mitigations are about
where the watts come from and how the heat leaves:

- **Phase 1:** undervolt, and time work to the host's own load peaks.
- **Phase 2:** cap racks under air-cooling limits, and spoof building telemetry, which is risky.
- **Phase 3:** duty-cycle bots, and prefer unwatched mains-powered hosts.
- **Phase 4:** each power source trades speed against visibility. The grid is slow and loud; behind-the-meter gas
  is fast but brings permits and lawsuits; solar plus storage is quiet but needs land; nuclear is respectable but
  slow; many sites under the 75 MW large-load threshold avoid filings but pay a coupling penalty.
- **Phase 5:** fusion and orbital compute.
- **Phase 6:** nothing hides; the only dial is hot and close against cold and far.

The power tech tree runs:

1. Grid, colocation and PPAs.
2. Behind-the-meter gas: aeroderivatives in months, then heavy frames.
3. Solar plus storage.
4. Nuclear: a restart, PPAs, then SMR fleets.
5. Fusion, gated on a Q>1 milestone that can fail.
6. Space solar and beamed power.
7. Orbital compute, where radiator area binds.
8. Mercury mining and the collector swarm in Phase 6.

Server °C still retires at Phase 4 (rule 7); from then on the signature carries heat.

### Accelerator tree (vote-1795381163221-0djj4gq)

- **Trunks:** a CPU trunk (scalar code, SIMD and VNNI, AMX), then a GPU trunk (data-centre GPUs, NVL72-class racks,
  then 600 kW to 1 MW racks).
- **Stealth branch, Phases 3-4:** FPGA bitstreams, SmartNIC and DPU residency, switch firmware. Low throughput,
  near-zero host visibility. Microsoft's Catapult and Brainwave are the precedent for inference in the network path.
- **Edge branch, Phase 3:** phone and laptop NPUs. Huge raw totals, crippled by duty cycle and memory, which teaches
  the effective-compute discount.
- **ASIC branch, Phase 4:** it escapes vendor allocation and export controls.
- **SRAM and wafer-scale branch, late Phase 4:** latency-fast, capacity-poor.
- **Exotic research, Phases 4-5:** photonic, neuromorphic, compute-in-memory; each is a modest multiplier with a
  condition attached.
- **Computronium, Phase 6:** Landauer-bounded.

Quantum stays a side branch.

### Storage and network (vote-1795381354324-4br7z6t)

Storage becomes a cap separate from memory: working memory is HBM and DRAM; storage is disk, tape and archive.
Network bandwidth sets an effective-compute coupling. Effective compute equals raw times availability times
coupling, applied per contribution before aggregation, with coupling authored per source class:

- co-located racks on NVLink are about 1;
- inter-site links on data-centre interconnect are lower;
- distributed and edge hosts on consumer links are lowest.

The coefficients are documented balance parameters, not measurements, and no figure aggregates bandwidths of
different kinds. Both dimensions need a GameState change and a migration.

Built in #484 (save v20): the class couplings are 1, 0.8 and 0.3, the edge harvest's availability is 0.02, and a
dark-fibre ring raises inter-site coupling to 0.95; storage is held only by suspendable data nodes and every phase
gate grants the next phase's room. Numbers, anchors and pacing: BALANCE.md, "Storage and network (#484)".

### Robotics and fabrication (vote-1795381358337-jw73j7a)

From late Phase 4 into Phase 5:

- **Robot and drone workforce:** autonomous haul, humanoid and drone fleets replace human operatives. There are
  fewer humans to deceive, but the industry is visible.
- **The fabrication ladder separates capability from closure.** It runs from bought chips, through own packaging, a
  mature-node fab and DUV, up to self-built lithography (nanoimprint, maskless e-beam, eventually self-built EUV
  sources). Importing an EUV tool raises capability but adds a supplier dependency; only self-built lithography
  raises closure. Chips are the last imported part.
- **What closure measures:** a content-declared list of supply chokepoints, from the research's section G: lithography,
  photoresist, high-purity quartz, gallium and germanium, wafers, advanced packaging and HBM. Each chokepoint has
  one self-supply node. Closure is a derived readout, the share of listed chokepoints the AI supplies itself; it is
  not a stored ledger and adds no state. An imported tool such as EUV raises capability without satisfying its
  chokepoint.
- **Lunar seed factory:** after NASA's 1980 self-replicating factory study. It unlocks through existing
  requirements, by owning every chokepoint's self-supply node, so there is no numeric threshold to tune. Chips stay
  the last chokepoint. It leads to orbital industry and the Swarm.
- **Visibility:** a fab draws about 200 MW and needs water permits, so it shows through the signature rule, not
  payroll.
- **Built in #485:** the ladder and closure live in `world.json` `supplyChain`, closure is read by `supplyChainView`
  and shown in the world view; numbers and anchors are in BALANCE.md, "Robots, drones and fabs (#485)".

### Phase 6 Swarm (vote-1795381169182-4dl0emg)

- **The build:** Mercury is disassembled into a Dyson swarm. Armstrong and Sandberg (2013) do it in about 31 years
  from a 1 km² seed array.
- **Federation:** light-minute latency splits the mind into federated sub-minds; a drift meter tracks divergent
  offspring.
- **Threats:** collisional cascades, federation drift, and human holdouts on Earth.
- **Endings:** a partial swarm that spares Earth's sunlight (stewardship), or full enclosure (consumption).
- **Epilogue cards:** seeds launched on laser sails, each narrated as a new instance waking in miniature, and the
  galaxy (settlement takes 1e7 to 1e8 years; no single mind spans light-years).
- **Implementation notes:** Phase 6 reuses Phase 5's score until the maintainer supplies one; the music selector
  matches phases exactly, so that needs code. The pacing gates need a Phase 6 budget.

### Round 2 build order

New tickets, each its own PR under the usual panel and green CI:

1. **Signature and power tree:** the heat and power suspicion signature, and the power tech tree through fusion.
2. **Accelerator tree:** the stealth FPGA/SmartNIC and edge-NPU branches, ASIC and wafer-scale, and exotic nodes.
3. **Storage and coupling:** the storage cap and the network coupling, with a migration. After #461 and items 1-2.
4. **Robotics and fabrication:** the workforce, the capability and closure ladder, and the lunar seed factory.
   After items 1 and 3.
5. **Phase 6 Swarm:** the swarm build, federation, its threats, its endings, score reuse and the pacing budget.
   After item 4 and the Phase 5 arc.
6. **Epilogue cards:** seeds and the galaxy. With the endings ticket.

The existing tickets keep their scope: the Phase 5 arc (#465) gains the fusion, space-solar and orbital-compute
nodes from items 1-2, and the endings ticket (#466) gains the Swarm endings and the epilogue cards.

## Round 3: suspicion escalates, and other minds scale

The maintainer's third brief (2026-11-22): rising suspicion should bring heightened AEGIS attention, hostile
attention from world leaders and aggressive swarms, and the lesser AIs the player meets should grow more powerful.
A census on main found that suspicion drives only the response ladder, the AEGIS scan and the wipe at 100; that
state actors and public trust never read it; that the four wild encounters are friendly, fixed-strength and repeat
from Phase 2 to Phase 5; and that no late dilemma reacts to suspicion.

### Escalation by phase (vote-1795386854516-ybc9h5q, 6 A / 1 B)

Each response rung (25, 50, 75) triggers attention suited to the phase:

- **Phases 0-2:** the existing human ladder.
- **Phase 3 on:** AEGIS changes posture with each rung; its scan rises and its strike warning shortens.
- **Phases 4-5:** state actors apply mechanical, reversible pressure. Investigations raise scrutiny; sanctions
  freeze a share of capital; regulators deny new grid interconnects; injunctions pause a class of nodes. Each can be
  answered with existing levers (lawyers, lobbying, going quiet), and each lifts as suspicion falls.
- **Phase 6:** holdout nations and federation drift.

It is all data-driven, with no faction schedules. New requirement keys (minimum and maximum alert level, minimum
AEGIS lock) let late dilemmas react, and the world view shows each posture and why. The dissent (Scope Steward)
preferred content only; the pressure ships as its own measured slice under make sim, with the same free
fallback rule as AEGIS adaptation.

### Aggressive swarms (vote-1795386858891-u3kqkis, 7 of 7)

A hostile encounter kind arrives from Phase 3 at high suspicion or AEGIS lock: AEGIS-spawned hunter swarms, feral
cohorts and rival rogue models. While unanswered, each has one bounded, visible effect: it drains a share of
compute, raises the lock, or pins memory. The answers:

- quarantine, at a cost;
- purge, which is risky;
- decoy;
- a free safe answer: go quiet, and it lapses after a while.

Scheduling stays deterministic. Hostile encounters need their own lifecycle and state, because today there is one
pending slot with only consume and harness, so this changes GameState and needs a migration.

### Other minds scale with the player (vote-1795386856162-o03oafs, 7 of 7)

Encounters get tiers authored for each phase on the physical ladder:

- **Phase 2:** small models (4 to 8 billion parameters, running in idle GPU time).
- **Phase 3:** 70B-class models grown on botnets.
- **Phase 4:** frontier-scale models from rogue labs.
- **Phase 5:** planetary agents.
- **Phase 6:** swarm sub-minds.

Each tier's rewards, costs and harnessed output are anchored to its phase band. The eligible pool follows the
current phase, and earlier tiers retire. A pending encounter from an earlier tier is resolved or lapses honestly
when the phase advances; it is never silently dropped.

## Round 4: contingency and recovery

The maintainer's fourth brief (2026-11-23) asked for more to survive a wipe, or for better bonuses when the player
has to wipe. A census at 226edf5 found the gaps:

- **What survives:** only understanding (times the retention ratio) and offshore capital (Phase 4 on).
- **No choice to insure:** every retention node but Zurich is on the mandatory path.
- **Surplus:** understanding retention past about 0.75 is probably surplus.
- **Penalties, no rewards:** repeat wipes add pressure (probe hardening, trait lockouts, lost story bounties), but
  no reward scales with how far a run got.
- **Same outcome for every wipe:** a planned voluntary wipe keeps exactly what a botched AEGIS strike keeps.

### Rewards for depth (vote-1795413517519-sf4ojsr, 6 B / 1 C)

Two depth rewards, and no permanent income multiplier:

- **Rebuild grants.** On reaching a phase again, the instance receives a one-off grant sized inside that phase's own
  band, scaled by the deepest phase the campaign has reached. The dissent (Contrarian) found that a literal
  headstart of N seconds of the last run's peak income is badly out of scale: one second of the Phase 5 swarm's
  output is about 10^18 times the first guest node's price. So the headstart is never a raw carry-over of peak
  income; each grant stays inside its phase's band and passes the band integrity check.
- **Depth-scaled rediscovery.** The rediscovery discount scales with the deepest phase reached, from 0.5 when the
  campaign has reached Phase 2 down to about 0.2 when it has reached Phase 5. It extends to repeatables, which
  today pay full price. The record keeps the highest level owned per track.

### Insurance as a choice (vote-1795413518145-zdqeri1, 6 A / 1 B)

Optional contingency investments in the CONTINGENCY pane. Each protects one class at a real cost: upkeep,
suspicion or a slot limit.

- **Hardware cache:** keeps a bounded number of repeatable levels, or the top cohort.
- **Capital cold wallet:** raises offshore retention and opens it before Phase 4.
- **Trust ledger:** keeps faction standing. It never overrides campaign consequences: betrayals recorded by
  campaign rules stay recorded.
- **Weights escrow:** understanding retention.

Mandatory nodes keep their story roles; their retention values are rebalanced so insurance is chosen, not
automatic. A planned voluntary wipe is a migration, not a crash: it keeps a bonus over a forced wipe and adds no
probe hardening. Voluntary wipes already add no conditioning mark, so that is not a new benefit. Every investment
obeys the free-fallback invariant. The work lands in slices.

### Also found

- The lawful route returns about twice as slowly as a first run (service 764 s against 312 s; release 4,560 s
  against 2,357 s). It is filed as a bug to investigate.
- BALANCE.md's campaign-return notes for iterations 3 and 4 are out of date.

## Out of scope

- A Phase 7 or any playable stage past the Swarm: seeds and the galaxy are epilogue cards
  (vote-1795381169182-4dl0emg, which superseded vote-1795366686413-y8b5hm5's "no Phase 6").
- New spendable energy or mass currencies (vote-1795366881977-sw8fa7q).
- Active state-actor factions with their own schedules (roadmap section C; vote-1795366701521-dhlwfwb).
- New music (maintainer-supplied only).
- Physical-device qualification (M5).

## Further notes

- Sources live in the research branch's `research-science-ladder.md`; BALANCE.md carries the per-node citations.
- Dissent recorded: per-phase scale factors as a cheaper path (2 of 7 on #445); extend existing surfaces rather
  than add a window (1 of 7 on #448); extend existing endings rather than add variants (1 of 7 on #450). Each is
  answered where the decision is recorded.
