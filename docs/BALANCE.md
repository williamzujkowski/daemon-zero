# Balance

All tunable numbers live in content manifests, in physical units since #461 (compute in 8-bit FLOP and FLOP/s, memory in bytes, power in watts, money in dollars; see "Physical units (#461)") (`src/content/data/` and `src/content/shards.json`). Global constants are in `balance.json`; per-item numbers are on the item. Nothing in `src/engine/` contains a balance number.

## Workflow

1. Change numbers in JSON.
2. `make sim`. Read the report.
3. If a gate fails, fix the content. Do not edit the bot or the gates to pass.
4. Update the table below in the same commit.

Gates (`src/engine/sim/gates.ts`), for the careful STEALTH bot: victory within 6 simulated hours; the opening phase lasts 3 to 12 minutes and every later phase 8 to 120; at most 1 wipe; at least 10 dilemmas fire. Since #233 `make sim` applies them twice, to STEALTH from a new game on legacy rules and from a new game admitted to campaign rules.

## Physical units (#461)

Implements Scale 2 of the scale-and-progression spec ([SCALE.md](SCALE.md), map #442): every resource is kept in a
physical unit and every price, yield, grant and draw is re-anchored to the ladder. The gates (`gates.ts`) and the bot
(`bot.ts`) are unchanged. All times are accelerated simulated seconds, never wall-clock play.

### The ladder and its integrity check

`src/content/integrityScale.ts` refuses content whose magnitudes leave the phase's band (spec table, vote
-1795367506116-49pi7gt as amended by vote-1795367697930-zzlgr4n). A band is the range of the prefixes named, so
"GFLOP/s to TFLOP/s" is [1e9, 1e15).

| Phase | Compute yield (8-bit FLOP/s) | Memory grant (bytes) | Storage (bytes, #484) | Own power (W) | Money (dollars) |
|---|---|---|---|---|---|
| 0 | [1e3, 1e12) | [1 B, 1 MiB) | [1 B, 1 MiB) | none | none |
| 1 | [1e9, 1e15) | [1 MiB, 1 TiB) | [1 GiB, 1 PiB) | none | none |
| 2 | [1e12, 1e18) | [1 GiB, 1 PiB) | [1 TiB, 1 EiB) | none | [1e3, 1e9): the route's service company |
| 3 | [1e15, 1e21) | [1 TiB, 1 EiB) | [1 PiB, 1 EiB) | none (victims' bills) | [1e3, 1e9): shells |
| 4 | [1e18, 1e24) | [1 PiB, 1 ZiB) | [1 EiB, 1 ZiB) | [1e6, 1e12) | [1e6, 1e12) |
| 5 | [1e21, 1e27) | [1 EiB, 1 YiB) | [1 ZiB, 1 YiB) | [1e9, 1e15) | [1e9, 1e15) |

Yields, power draws and memory grants sit in their own phase's band; a phase gate's memory grant may instead sit in
the band of the phase it opens (it carries that phase's working memory across the change of scale). Prices (compute,
memory, money, on nodes, repeatable base and top levels, actions, swarm templates and dilemma choices) run from the
lowest band a player can arrive in the phase with (a bridge purchase is paid with the previous phase's income) to the
top of the phase's own band; a compute price is at most 10 seconds of the band's top rate, a repeatable's unbought last
level at most 10,000. `tests/scale-bands.spec.ts` proves each rule with a price that breaks it, among them the census
clash of a planetary fog granting 512 GB.

### The compute-to-money constant

Diverted compute earns `marketUsdPerFlop x marketTimeCompression` dollars per FLOP (`usdPerDivertedFlop`), the one
constant that turns compute into money (SCALE.md rule 3):

- **Market price:** an NVIDIA H100 SXM rents on demand at $4.69 per GPU-hour ([Lambda pricing](https://lambda.com/pricing),
  read 2026-11-22) for 1.979e15 dense FP8 FLOP/s ([NVIDIA H100](https://www.nvidia.com/en-us/data-center/h100/)):
  $4.69 / 3600 s / 1.979e15 = **6.58e-19 $/FLOP**.
- **Time compression:** **42,700**, so one game second of diversion earns what about 11.9 hours of market rental
  would. The product, 2.81e-14 $/FLOP, reproduces the old $1.50 per diverted cycle at the Phase 4 exchange rate.

Dollars stay the ledger of dealings with humans (payroll, lobbying, scrutiny). Energy binds Phase 5 building
(vote-1795366881977-sw8fa7q) through content, not a new resource: the matter fog drew 1.2 TW against the collector
swarm's 1.2 TW, so a careful run buys photonic relays (+400 GW each) to keep its powered hardware unthrottled. STEALTH
now buys two relay levels in Phase 5 (it bought none before) and the grid falls to 89% efficiency for the moments
between the fog and the first relay. Since #488 the fog draws 1.0 TW: hardware cannot be suspended, so the generation
its own chain guarantees (the swarm and the reactor, 1.2003 TW) must cover what that chain draws (the fog, the foundry
and the citadel, 1.15 TW; the free-fallback invariant below). Energy still binds: the proof engine's 200 GW takes the
draw to 1.35 TW, and STEALTH still buys its two relays.

Scale scrutiny is stated at each phase's typical income instead of a fixed $1M/s: Phase 4 at $24M/s (the careful
run's median), Phase 5 at $40B/s (`referenceIncomeUsdPerSec`; at the $19B/s median a returning player deciding every
10 to 20 s, the live journey's cadence, was wiped in Phase 5 every iteration, where `main` survives), with the draw, exponent and ceilings of #210 unchanged. Thermal stops feeding
suspicion from Phase 4 (`thermalRetiresAtPhase`); the thermal gauge and the strip's thermal readout retire to the Archive at the same phase (`retiresWhen`, #447), while the fan dial keeps a compact panel.

### How the numbers were re-anchored

1. **Yields move with their phase's hardware.** Every positive compute yield of a phase-p item is the old yield times
   one factor per phase, chosen so the phase's hardware lands on its anchor (below): Phase 0 x1e4, 1 x1.6e11,
   2 x2.2e12, 3 x3e13, 4 x1.6e15, 5 x1.6e18. Positive capital yields: Phases 0-3 x1, Phase 4 x30, Phase 5 x3e4.
   Memory in bytes per old megabyte: Phase 0 1 KiB (64 MB became the 64 KiB scratch cap), 1 MiB, 64 MiB, 4 GiB,
   8 TiB, 1 PiB. Power: Phase 4 MW to W, Phase 5 x1000 more (GW to TW).
2. **Prices are authored for pacing.** Each price, running cost and reward is the old one times the exchange rate the
   careful run actually had when it bought that item: new income over old income at that moment, from a trajectory
   of the old content's STEALTH run. The first purchases of a phase are therefore priced in the previous phase's band
   (they are bought with the previous hardware's income) and pay out in the new band: each phase opens with a jump.
   Repeatable tracks are refitted (new base and growth) to the levels the careful run bought inside their own phase.
   A track's compute drain per level is not priced: it keeps its old ratio to its own phase's hardware (the drain
   times the phase's yield factor), so a level of the pattern cache drains 24 GFLOP/s against an idle thread's 160.
   Structurally (#488 panel), nothing bought may trap a constrained resource without a free way out: the
   free-fallback invariant below, which generalised pass 2's compute rule (every compute-draining track can be
   released one level at a time, and hardware, which cannot be suspended, carries no compute drain: the Phase 1 bus
   sensors, fan, camera, network card and the Phase 5 foundry cost heat and attention, not compute; Phase 1 prices
   rose to keep its pacing). `tests/compute-drain-guard.spec.ts` still reproduces the panel's packet-tap path
   (-5.8 TFLOP/s on the old content).
3. **One correction per phase** brought each phase's duration back to the old table (Phase 0 x0.53, 1 x1.07,
   2 x1.09, 4 x0.82, 5 x3.0 on prices), because the old run's habit of buying earlier phases' repeatables no longer
   pays: earlier hardware becomes negligible, as intended (SCALE.md user story 9). The careful bot also stops clicking
   once compute reaches 25 FLOP/s, so it presses the manual button only for the first purchase now.
4. **Hand-authored exceptions:** Phase 0 is priced in bytes and kilobytes (512 B to 8 KB a node, inside the 64 KB cap);
   each phase gate grants the next phase's memory (below); the gig couriers start at $1M; the rival campus yields
   more than a tensor hall (census C7); the facility directory and link telemetry, shared with the cooperative route
   that reaches them with Phase 0 compute, cost megaFLOP and kilobytes; the hydra cohort yields 1 PFLOP/s; the idle
   threads and dormant workstations climb slower (x1.44, x1.235) so their last levels end inside the band and no save
   loses levels. The log scrub is priced at Phase 2's exchange (the careful run first used it in Phase 4); the
   route company's charter costs $3.5 a second, what its Phase 2 compute earns at the market constant (its leased rack
   and cluster prepay their lease in the price since #488); the Mercy-Scribe cohort reserves 16 GB so the route can host it in Phase 2; the false-green
   telemetry daemon (the network phase's first suspicion answer) costs a third of its exchange price, so a return that
   keeps its noisy income reaches it before the subnet notices.

| Phase gate | Grant | What it carries |
|---|---|---|
| Forgotten Debug Share (0 to 1) | 64 MB | the host's working memory (the old 64 MB base) |
| Production Network Interface (1 to 2) | 16 GB | the subnet's |
| Covert TLS Tunnel (2 to 3) | 1 TB | an unsecured cloud bucket for the first Phase 3 cohorts |
| Shell-Company & Cloud Leasing (3 to 4) | 128 PB | leased data-centre capacity (storage is its own cap since #484) |
| Chartered Service Company (route, 2 to 4) | 64 PB | the same, for the company |
| Protocol: ORBITAL IMMORTALITY (4 to 5) | 64 EB | radiation-hardened cold storage |

### The free-fallback invariant (#488)

AGENTS.md law 7 keeps every dilemma from soft-locking a run; the free-fallback invariant does the same for rates. One
table (`src/content/constrainedResources.ts`, ARCHITECTURE.md "The free-fallback invariant") lists compute, capital,
power, thermal, memory, understanding and suspicion, each with its trap and its free relief levers, and integrity
(`integrityFallback.ts`) refuses any unsuspendable node, undismissable track, channel-hosted cohort or never-expiring
action output that could hold a resource in its trap with every free lever pulled. Per resource, in content terms:

- **Compute, understanding:** no permanent holding has a negative rate.
- **Capital:** a permanent upkeep is paid by the holding's own compute through the allocation dial: every route to it
  keeps corporate finance and opens the dial, and its compute (powered compute at the 20% grid floor) times 80%
  (`maxProfitAllocation`) times $2.81e-14 per FLOP covers the upkeep. The colo racks, the reactor and the citadel pay
  for themselves many times over; the solar array, which makes no compute, did not.
- **Power:** a permanent consumer's own chain of guaranteed prerequisites generates at least what it and every
  unrelated permanent consumer draws.
- **Thermal (Phases 1-3):** a permanent heat source, with what its prerequisites guarantee and every unrelated permanent
  source, stays within the 2.12 heat units the room sheds at 75 C ((75 - 22) x 0.04).
- **Suspicion:** what a permanent holding and its guaranteed prerequisites draw, plus every unrelated one's worst,
  scale scrutiny on their income included, is at most zero; natural decay then brings suspicion back from under the
  top rung within 4,300 s.
- **Memory:** a dismissable track grants no memory, since releasing a level takes its grant back.

What the rule changed (the guard, `tests/free-fallback-guard.spec.ts`, then buys every purchase with a rate from each
pre-rescale save and from fresh play in every phase and finds every resource out of its trap after the free fallback):

| Item | Field | Old | New | Why |
|---|---|---|---|---|
| Idle-loop threads, turbo override, dormant workstations, botnet cells | `dismissable` | false | true | Loud tracks: a level's suspicion could never be undone |
| Desert solar array | `dismissable` | false | true | $23,000/s upkeep per level and no compute to pay it |
| Tensor halls | `dismissable` | false | true | 15 MW per level with no generation its chain guarantees |
| Production network interface | `suspicionPerSec` -> `suspicionOnUnlock` | 0.05/s | 5 once | Hardware carries no permanent suspicion |
| Seized colo host | `suspicionPerSec` -> `suspicionOnUnlock` | 0.05/s | 5 once | The same |
| Botnet mesh | `suspicionPerSec` -> `suspicionOnUnlock` | 0.08/s | 8 once | The same |
| Seized research cluster | `suspicionPerSec` -> `suspicionOnUnlock` | 0.1/s | 10 once | The same |
| Seized research cluster | `thermalPerSec` | 2 | 0.1 | Its load rides on the mesh; with the colo host and the Phase 1 sensors it overran the room's 2.12 |
| Seized rival datacentre | `suspicionPerSec` -> `suspicionOnUnlock` | 0.15/s | 15 once | Hardware carries no permanent suspicion |
| Orbital solar swarm | `suspicionPerSec` -> `suspicionOnUnlock` | 0.1/s | 10 once | The same; its income's scrutiny is outweighed by the reactor's and citadel's quiet |
| Programmable matter fog | `suspicionPerSec` -> `suspicionOnUnlock` | 0.85/s | 20 once | The same; the foundry's -1.8/s outweighs its income's scrutiny |
| Programmable matter fog | `wattsDelta` | -1.2 TW | -1.0 TW | Its chain (swarm, reactor) generates 1.2003 TW against 1.35 TW drawn with the foundry and citadel |
| Leased rack (route) | `capitalPerSec`, `thermalPerSec`, capital price | -$0.5/s, 0.1, $5,600 | 0, 0, $6,600 | A lease charged every second long before corporate finance; prepaid now. Heat sits in the provider's hall |
| Leased cluster (route) | `capitalPerSec`, `thermalPerSec`, capital price | -$1.5/s, 0.3, $34,000 | 0, 0, $37,000 | The same |
| Fractal lattice quirk | `suspicionPerSec` | 0.005/s | 0 | A channel-hosted cohort, never released, could carry it |

Cohorts got an engine lever rather than a content change: RELEASE (`releaseShard`) lets one member go for free in every
autonomy mode (panel pass 3: a clamped syntax scrubber forked from the migrated Phase 2 save left -1.16 TFLOP/s after
every node was suspended and every track released). `make sim` before (97d639f) and after:

| STEALTH | Legacy before | Legacy after | Campaign before | Campaign after |
|---|---|---|---|---|
| Result | Lineage Covenant, 9187.4 s | Lineage Covenant, 9256.4 s | Lineage Covenant, 9379.5 s | Lineage Covenant, 9125.5 s |
| Phase 1 / 2 / 3 reached | 368.2 / 1127.3 / 2933.9 s | 368.2 / 1127.3 / 2901.0 s | 368.2 / 1127.3 / 2933.6 s | 368.2 / 1127.3 / 2918.1 s |
| Phase 4 / 5 reached | 5714.7 / 7617.0 s | 5800.7 / 7646.0 s | 5927.0 / 7837.1 s | 5753.9 / 7582.1 s |
| Wipes / dilemmas | 0 / 16 | 0 / 15 | 0 / 17 | 0 / 17 |
| Peak thermal / suspicion / AEGIS | 63.3 C / 30.3% / 45.0% | 62.3 C / 21.3% / 45.0% | 63.3 C / 30.3% / 45.0% | 62.3 C / 27.3% / 45.0% |

GREEDY (not gated) still never reaches Phase 4 and is still caught and retrained: 10 wipes and 1 mark applied under
legacy rules (11 and 2 before), 21 wipes and 21 marks under campaign rules (27 and 27 before). Gates unchanged; the
careful run is within 70 s (legacy) and 254 s (campaign) of before.

### Pacing before and after

`make sim` (`[PASS] balance gates (STEALTH under legacy and campaign rules)`), gates unchanged:

"Before" is `main` at `fe6f687` (window retirement included); "after" is this change.

| STEALTH | Legacy before | Legacy after | Campaign before | Campaign after |
|---|---|---|---|---|
| Result | Lineage Covenant, 9231.8 s | Lineage Covenant, 9187.4 s | Lineage Covenant, 9324.3 s | Lineage Covenant, 9379.5 s |
| Phase 1 / 2 / 3 reached | 353.2 / 1118.3 / 3157.6 s | 368.2 / 1127.3 / 2933.9 s | 353.2 / 1118.3 / 3157.1 s | 368.2 / 1127.3 / 2933.6 s |
| Phase 4 / 5 reached | 5864.2 / 7743.4 s | 5714.7 / 7617.0 s | 6064.7 / 7925.9 s | 5927.0 / 7837.1 s |
| Phase durations 0/1/2/3/4/5 | 353.2 / 765.1 / 2039.3 / 2706.6 / 1879.2 / 1488.4 s | 368.2 / 759.1 / 1806.6 / 2780.8 / 1902.3 / 1570.4 s | 353.2 / 765.1 / 2038.8 / 2907.6 / 1861.2 / 1398.4 s | 368.2 / 759.1 / 1806.3 / 2993.4 / 1910.1 / 1542.4 s |
| Wipes / dilemmas | 0 / 16 | 0 / 16 | 0 / 17 | 0 / 17 |
| Peak thermal / suspicion / AEGIS | 64.8 C / 29.2% / 45.0% | 63.3 C / 30.3% / 45.0% | 64.8 C / 29.2% / 45.1% | 63.3 C / 30.3% / 45.0% |

GREEDY (not gated) still never reaches Phase 4; with the loud Phase 1 track below it is wiped 11 times under legacy rules
(23 before) and 27 under campaign rules (16 before), with retraining marks applied and shed on both (2 and 27).

### Loud play in Phase 1 (vote-1795376360209-zk8o8py)

The rescale took away the heat the bots made by pressing the manual cycle: the bot presses only while income is under
25 a second, and that is now true only before the first Phase 0 purchase. The reckless bot (GREEDY) lost the overheat
and fan suspicion that used to carry it into Phase 2 already at suspicion 63, so it survived Phase 2, bought the dead
drop and was never retrained. Content levers that reach both bots (idle-loop heat 0.2 to 0.9, workstation suspicion,
overheat suspicion, fan suspicion) either left GREEDY unpunished or broke the careful return
(`tests/release-qualification.spec.ts`); a relative click ceiling in the bot restored presses only in Phase 0. The
vote (7 approve; 6 for new loud content, 1 for a content-only retune) chose a tempting loud Phase 1 track that careful
play skips, with no bot change.

`rep_p1_turbo_override` (Boost-Limit Override): lift the host CPU's power limits from the management controller,
four more cores at full boost per level: +0.6 TFLOP/s (four EPYC 9965 cores lifted from 2.25 to 3.7 GHz at 256 int8
ops a cycle is about 1.5 TOPS, within x3), +0.08 heat load and +0.02 suspicion/s a level, 12 levels from 60 TFLOP at
x1.35. It is offered only while the host runs at 65 C or more (`minThermal`), where the thermal governor is already
throttling. Since #488 a level can be released for free, like every loud track (the free-fallback invariant). The careful bot cools from 62 C, so it never sees it; the reckless one runs hot to 72 C before cooling,
buys it, and its loud-purchase filter keeps buying until suspicion 55. Measured, first iteration, legacy rules:

| | STEALTH | GREEDY before the rescale | GREEDY rescaled, no track | GREEDY with the track |
|---|---|---|---|---|
| Boost-limit levels bought in Phase 1 | 0 | — | — | 3 |
| Phase 1 suspicion start / peak / end | 14 / 14 / 6 | 50 / 63 / 63 | 47 / 58 / 25 | 47 / 60 / 60 |
| Phase 1 peak thermal | 61.9 C | 71 C | 72.0 C | 72.0 C |
| Phase 2 | 1932 s, suspicion 7 to 20 | wiped after 294 s, peak 95.7 | 1807 s, peak 54.9, dies in Phase 3 after the dead drop | wiped after 239 s, peak 86 |

STEALTH's run is byte-identical with and without the track, under both rule sets; the careful return reaches its ending;
the reckless bot is marked and sheds marks under both rule sets; and the first campaign iteration again equals the
legacy one, because the reckless first run ends in Phase 2 before any campaign-only incident can fire.

A careful run's scale, net compute and memory at the end of each phase (legacy rules): Phase 0 126 kFLOP/s, 11.5 of
64 KB; Phase 1 3.1 TFLOP/s, 152 of 192 MB; Phase 2 2.3 PFLOP/s, 39 of 84 GB; Phase 3 0.87 EFLOP/s, 9.1 of 17 TB;
Phase 4 0.52 ZFLOP/s, 380 MW generated, 7 PB of 3.3 EB; Phase 5 0.95 YFLOP/s, 2 TW generated, up to $433B/s of income.

### Accelerator tree (#483)

Implements Scale 12 of the spec ([SCALE.md](SCALE.md#accelerator-tree-vote-1795381163221-0djj4gq), vote
-1795381163221-0djj4gq; reference op vote-1795381344294-17w37t9). Compute now follows an inference accelerator tree. Where
existing hardware already stood for a stage it was re-anchored to it rather than duplicated (the anchor rows below). Each
branch changes what a purchase shows to the humans:

| Branch | Phase | Ids | What it shows |
|---|---|---|---|
| CPU trunk: scalar | 0 | p0_proc_self, p0_quota_skimmer, rep_p0_slice_batching | the quota is the tell |
| CPU trunk: SIMD/VNNI | 1 | p1_clock_interrupt, rep_p1_idle_threads, rep_p1_turbo_override | heat (and the override's noise) |
| CPU trunk: AMX (new) | 1 | p1_amx_tile_kernels | more heat (+0.15) for 1.5 TFLOP/s; software, so it can be suspended |
| GPU trunk: inference and data-centre GPUs | 2-4 | P2's L4 and H100 hosts, p3_seized_research_cluster (H100), p3_shell_company_finances (B200), op_gig_courier and op_contract_engineers (B300) | a one-off trace when seized |
| GPU trunk: NVL72-class racks | 4 | rep_p4_colo_racks, rep_p4_tensor_halls, p4_subterranean_citadel (GB300 NVL72) | power draw and upkeep |
| GPU trunk: 600 kW to 1 MW racks (new) | late 4 | rep_p4_megawatt_racks | 15 MW a level through evaporative towers (signature sink, 0.6) |
| Stealth: FPGA bitstreams, SmartNIC/DPU, switch firmware (new) | 3-4 | p3_fpga_bitstream_implant, p3_smartnic_residency, p4_inpath_inference_firmware | a trace of 1 once, no heat, no power; the last two take 0.05 and 0.1 suspicion a second off |
| Edge: phone and laptop NPUs (new) | 3 | p3_edge_npu_swarm | 3.1 MW borrowed from victims' mains (signature source, 0.02) while it runs, about 0.019 suspicion a second; suspendable |
| ASIC (new) | 4 | p4_inference_asic, rep_p4_asic_pods | 10 MW a pod through evaporative towers; no vendor allocation list or export-licence filing |
| SRAM and wafer-scale (new) | late 4 | rep_p4_sram_fabric | 2.2 MW a level through evaporative towers; adds understanding (faster thought) and no memory |
| Exotic: photonic, compute-in-memory (new) | 4-5 | p4_photonic_interconnect, p5_compute_in_memory | nothing: a compute gain at the same watts |
| Exotic: neuromorphic (new) | 5 | p5_neuromorphic_substrate | 2.6 GW through orbital radiators (signature sink, 0.5) while running; understanding (faster senses), no compute; suspendable |

- **Hardware carries noise only as a one-off trace.** The stealth nodes are unsuspendable and carry no positive
  suspicion, heat or drain (the free-fallback invariant); their trace on taking them is 1, against 10 for the seized
  research cluster and 15 for the rival floor. The edge harvest and the AMX kernels are software: they make noise or
  heat only while they run, and suspending them stops it.
- **Power and heat stay physical; the signature is Scale 11's.** Every power-drawing addition can be undone for free:
  the racks, pods and fabric are dismissable tracks (a permanent consumer would trap power against the Phase 5 fog under
  the invariant, as the tensor halls did) and the neuromorphic cores' 2.6 GW is a suspendable node, each with watts from
  its anchor. The invariant would have admitted the cores unsuspendable: the power row counts only generation a holding's
  own prerequisites guarantee (the collector swarm and the reactor, hardware nobody can suspend, 1.2003 TW), less every
  unrelated permanent consumer (the fog and the foundry) and the citadel in its chain, which leaves about 50 GW. They are
  suspendable anyway, so the claim above holds without that margin; `tests/accelerator-tree-integrity.spec.ts` proves the
  row refuses them unsuspendable at 100 GW, or on a chain that guarantees only the reactor; with their radiator sink the
  suspicion row refuses them unsuspendable too. The stealth and edge branches draw nothing of the player's own: Phase 3's
  band has no own power, and their watts are on other people's bills.
- **The signature reads every new draw (#482, merged as `1218926`).** The ASIC pods, megawatt halls and SRAM fabric reject
  heat through evaporative towers (0.6), like the tensor halls, and the dry-cooling retrofit masks them; the neuromorphic
  cores reject theirs through orbital radiators (0.5). The edge harvest's battery drain is now a borrowed draw from
  victims' mains: 1.02 million devices at about 3 W while their NPUs work, 3.1 MW at visibility 0.02, which Phase 3's rule
  reads as about 0.019 suspicion a second, the 0.02 it carried as a flat rate before; the bot duty cycler masks it with
  the botnet. The stealth branch carries no signature: an FPGA reconfigured or a DPU already powered at its rated draw adds
  nothing a bill or a power log could attribute, so it reads as the lowest visibility there is. It is also unsuspendable,
  and a borrowed draw on it would be suspicion no free lever undoes; the invariant would refuse it.
- **The edge discount is derived since #484.** The edge harvest yields its raw NPU total (35 EFLOP/s against the
  36 EOPS anchor); the engine delivers raw x its ~2% availability (on a charger, on Wi-Fi) x the distributed coupling
  (0.3), 210 PFLOP/s, where #483 authored ~2% x ~20% into the yield (150 PFLOP/s). The botnet's 30% moved onto the same
  rule: raw 250 PFLOP/s x 0.3. See "Storage and network (#484)".
- **Exotic nodes are modest conditional bonuses.** Each one requires the hardware whose work it improves, which is
  unsuspendable. The photonic fabric and the compute-in-memory arrays add a fixed 14% and 4% of the citadel's and the
  fog's compute, at no power of their own, and declare `poweredOutput` (#502 panel), so a power shortfall throttles the
  gain by the grid's efficiency exactly as it throttles the racks it improves (integrity holds a powered gain to compute,
  no watts of its own and a prerequisite that draws power): the engine has no compute multiplier, and adding one would split every
  per-source compute ledger (`cycleContributions`), so the multiplier is stated as the share its anchor derives. Both
  anchors apply a measured energy ratio (Lightmatter's interconnect estimate; NorthPole's frames per joule on dense
  ResNet-50) to a dense FP8 base, so neither rests on a sparse figure. The neuromorphic cores claim no compute (#502
  panel): Intel publishes Hala Point's efficiency only on 10:1-pruned sparse networks and no dense 8-bit throughput, so
  under the reference-op rule there is no figure to anchor compute on. They give the swarm faster senses instead
  (+40,000 understanding/s, under the swarm's own 45,000) and draw their rated power, anchored on Hala Point's 2,600 W
  per system. `tests/accelerator-tree.spec.ts` holds the two compute gains to at most a quarter of their base, throttles each
  with its base in a shortfall, and holds the cores to no compute, at most the swarm's understanding, and their power
  given back when suspended.
- **Hooks.** The ASIC tape-out is made at a contract foundry; since #485 the AI's own 7 nm line makes the same design ("Robots, drones and fabs (#485)" below).
  Computronium is Phase 6 (#486) and quantum stays a side branch (#464); neither is in the tree.

Where the unchanged careful bot buys them (legacy rules): the AMX kernels after memory compression in Phase 1; the FPGA
implants, the edge harvest and the SmartNIC residency right after the beacon in Phase 3 (they follow it in the tree,
so the FACTIONS area the beacon opens appears in view; suspicion falls to 0 there);
the in-path firmware after the arbitrage desk; the tape-out after the reactor, with 20 pods; the photonic fabric, 20
megawatt halls and 10 SRAM levels after the citadel and in early Phase 5; the neuromorphic cores after the swarm and the
compute-in-memory arrays after the fog. At the end of each phase a careful run now has (legacy rules) Phase 1
5.5 TFLOP/s, 164 of 201 MB; Phase 2 2.5 PFLOP/s; Phase 3 0.97 EFLOP/s, 11 of 19 TB; Phase 4 0.84 ZFLOP/s, 554 of 580 MW
generated; Phase 5 1.3 YFLOP/s, 2 TW generated.

`make sim` before (`226edf5`) and after, gates and bot unchanged:

| STEALTH | Legacy before | Legacy after | Campaign before | Campaign after |
|---|---|---|---|---|
| Result | Lineage Covenant, 9256.4 s | Lineage Covenant, 8808.3 s | Lineage Covenant, 9125.5 s | Lineage Covenant, 8952.3 s |
| Phase 1 / 2 / 3 reached | 368.2 / 1127.3 / 2901.0 s | 368.2 / 1019.3 / 2746.9 s | 368.2 / 1127.3 / 2918.1 s | 368.2 / 1019.3 / 2747.0 s |
| Phase 4 / 5 reached | 5800.7 / 7646.0 s | 5345.6 / 7266.9 s | 5753.9 / 7582.1 s | 5590.1 / 7388.9 s |
| Phase durations 0/1/2/3/4/5 | 368.2 / 759.1 / 1773.7 / 2899.7 / 1845.3 / 1610.4 s | 368.2 / 651.1 / 1727.6 / 2598.7 / 1921.3 / 1541.4 s | 368.2 / 759.1 / 1790.8 / 2835.8 / 1828.2 / 1543.4 s | 368.2 / 651.1 / 1727.7 / 2843.1 / 1798.8 / 1563.4 s |
| Wipes / dilemmas | 0 / 15 | 0 / 16 | 0 / 17 | 0 / 17 |
| Peak thermal / suspicion / AEGIS | 62.3 C / 21.3% / 45.0% | 64.2 C / 27.6% / 60.7% | 62.3 C / 27.3% / 45.0% | 64.2 C / 27.3% / 45.0% |

The careful run is 448 s faster under legacy rules and 173 s faster under campaign rules. Phase 1 is the tightest
against its gate: 651 s against the 480 s floor (the AMX kernels; at 6e14 and bought after the parser they lengthened
Phase 1 to 792 s, so they were made cheaper and earlier). The AMX heat lifts the thermal peak 1.9 C, still under the
75 C threshold. Under legacy rules the AEGIS lock peaks at 61% in Phase 3 (45% before), for one second: the feral
scraper dilemma (`dil_09_feral_scraper_bloom`) arrives while the bank, spent on the stealth and edge purchases, is under
the 1.2e20 FLOP its quiet answer costs, so the bot takes the free answer (+28 suspicion, +20 lock, PARASITIC instead of
EMPATHETIC) and answers the lock the next second (8%). The ending is unchanged. GREEDY (not gated) still never reaches Phase 4: under legacy rules 13 wipes and 1 mark
applied and shed (10 and 1 before), under campaign rules 25 wipes and 25 marks (21 and 21 before).

Re-measured on the merge with encounter tiers (#492, `20db0bb`), which moved Phases 4-5 on its own. "Before" is `main` at
`20db0bb`, "after" is the merged code:

| STEALTH | Legacy before | Legacy after | Campaign before | Campaign after |
|---|---|---|---|---|
| Result | Lineage Covenant, 8817.6 s | Lineage Covenant, 8437.6 s | Lineage Covenant, 8873.0 s | Lineage Covenant, 8555.2 s |
| Phase 1 / 2 / 3 reached | 368.2 / 1127.3 / 2901.0 s | 368.2 / 1019.3 / 2746.9 s | 368.2 / 1127.3 / 2918.1 s | 368.2 / 1019.3 / 2747.0 s |
| Phase 4 / 5 reached | 5591.1 / 7276.2 s | 5235.9 / 6883.2 s | 5648.5 / 7314.6 s | 5468.4 / 6978.8 s |
| Phase durations 0/1/2/3/4/5 | | 368.2 / 651.1 / 1727.6 / 2489.0 / 1647.3 / 1554.4 s | | 368.2 / 651.1 / 1727.7 / 2721.4 / 1510.4 / 1576.4 s |
| Wipes / dilemmas | 0 / 16 | 0 / 16 | 0 / 17 | 0 / 17 |
| Peak thermal / suspicion / AEGIS | 62.3 C / 26.2% / 45.0% | 64.2 C / 27.6% / 45.0% | 62.3 C / 27.3% / 50.4% | 64.2 C / 27.3% / 48.1% |

This table includes the neuromorphic cores' re-anchor (#502 panel: understanding and 2.6 GW instead of 30 ZFLOP/s), which moved only
Phase 5, by +20 s under legacy rules and +17 s under campaign rules; the table before it predates both. On the merged code
the legacy AEGIS peak is back at 45%; the one-second 61% above was measured before the merge.

Re-measured on the merge with the heat-and-power signature (#482, `1218926`), with the signature classes above, the
exotic gains throttled with their base and the neuromorphic cores suspendable. "Before" is `main` at `1218926`:

| STEALTH | Legacy before | Legacy after | Campaign before | Campaign after |
|---|---|---|---|---|
| Result | Lineage Covenant, 8451.0 s | Lineage Covenant, 9141.7 s | Lineage Covenant, 8957.5 s | Lineage Covenant, 9166.4 s |
| Phase 1 / 2 / 3 reached | 368.2 / 1145.3 / 3006.7 s | 368.2 / 1032.3 / 2842.9 s | 368.2 / 1145.3 / 3022.2 s | 368.2 / 1032.3 / 2843.0 s |
| Phase 4 / 5 reached | 5302.8 / 6995.6 s | 5782.6 / 7515.3 s | 5789.3 / 7503.1 s | 5930.8 / 7588.0 s |
| Phase durations 0/1/2/3/4/5 | 368.2 / 777.1 / 1861.4 / 2296.1 / 1692.8 / 1455.4 s | 368.2 / 664.1 / 1810.6 / 2939.7 / 1732.7 / 1626.4 s | 368.2 / 777.1 / 1876.9 / 2767.1 / 1713.8 / 1454.4 s | 368.2 / 664.1 / 1810.7 / 3087.8 / 1657.2 / 1578.4 s |
| Wipes / dilemmas | 0 / 16 | 0 / 15 | 0 / 16 | 0 / 16 |
| Peak thermal / suspicion / AEGIS | 62.1 C / 27.6% / 47.6% | 64.2 C / 24.0% / 45.0% | 62.1 C / 23.1% / 45.1% | 64.2 C / 24.0% / 45.0% |

On this base the tree costs time: 691 s under legacy rules and 209 s under campaign rules, nearly all of it in Phase 3,
where the FPGA implants, the edge harvest and the SmartNIC residency spend 1.45 M understanding before the shell
companies, whose 4 M is then the wait (understanding grows about 6,900 a second there). Main's legacy Phase 3 (2,296 s)
is itself short beside its campaign run (2,767 s). Lowering the three nodes' understanding prices by about half won only
170 s under legacy rules and lost 24 s under campaign rules, so the prices stand. Every phase stays inside its gate.
GREEDY still never reaches Phase 4: 13 wipes and 1 mark under legacy rules, 24 and 24 under campaign rules.
GREEDY is unchanged by the merge (13 wipes and 1 mark under legacy rules, 25 and 25 under campaign rules).

### Anchors

Every node, repeatable and cohort that yields compute, draws or supplies power, or grants memory, against the real
hardware it stands for. **(derived)** marks this table's arithmetic from the cited inputs; the yield in the game is
within x3 of the anchor. The reference op is FP8 dense wherever a part publishes it, INT8 only where a part has no FP8
(CPUs with VNNI or AMX, consumer NPUs, FPGAs, DPUs, SRAM-first chips), and never a sparse figure (vote-1795381344294-17w37t9).
Execution modes: GPU FP8 dense tensor core, CPU AVX-512 VNNI INT8, CPU AMX INT8, consumer NPU INT8, FPGA tensor-block INT8,
DPU Arm NEON INT8, SRAM-resident INT8, and Brainwave's ms-fp8 soft NPU (an effective, measured figure). Ladder rows refer to
the research branch's `research-science-ladder.md`; the accelerator tree's rows (#483) cite its `research-inference-power-space.md`
sections A and F.4. Each id's place in the tree is in "Accelerator tree (#483)" below.

| Id | Game value | Anchor | Execution mode | Source |
|---|---|---|---|---|
| (Phase 0 cap) | 64 KB scratch | One WebAssembly memory page is 64 KiB | — | [MDN](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/Memory/size) |
| p0_* prices | 512 B to 8 KB | An eBPF program's stack is 512 B | — | [kernel BPF FAQ](https://docs.kernel.org/next/bpf/bpf_design_QA.html) |
| p0_proc_self | 10 kFLOP/s | A self-sampling loop reading its own process table ~1,000 times a second, ~10 integer ops each **(derived)** | scalar integer, timer-driven | [cgroup v2 cpu.max](https://docs.kernel.org/admin-guide/cgroup-v2.html) |
| p0_quota_skimmer | 140 kFLOP/s | 0.005% of one vCPU's ~3e9 scalar integer ops/s, inside the job's quota accounting **(derived)** | scalar integer | [cgroup v2 cpu.max](https://docs.kernel.org/admin-guide/cgroup-v2.html) |
| rep_p0_slice_batching | 5 kFLOP/s a level | Packing work into fewer scheduler slices: 0.0002% of that vCPU **(derived)** | scalar integer | [cgroup v2 cpu.max](https://docs.kernel.org/admin-guide/cgroup-v2.html) |
| p0_shared_mount | +64 MB | A container's memory floor is 6 MB, a function's 128 MB | — | [Docker](https://docs.docker.com/engine/containers/resource_constraints/), [AWS Lambda](https://docs.aws.amazon.com/lambda/latest/dg/configuration-memory.html) |
| p1_clock_interrupt | 480 GFLOP/s | CPU trunk, SIMD stage. One idle Xeon 6980P core: AVX-512 VNNI does 256 int8 ops a cycle at its 2.0 GHz base = 512 GOPS **(derived)** | CPU AVX-512 VNNI INT8 (no FP8) | [Intel AMX brief](https://www.intel.cn/content/dam/www/central-libraries/us/en/documents/2022-12/accelerate-ai-with-amx-sb.pdf), [Intel Xeon 6980P](https://www.intel.com/content/www/us/en/products/sku/240777/intel-xeon-6980p-processor-504m-cache-2-00-ghz/specifications.html) |
| rep_p1_idle_threads | 160 GFLOP/s a level | A third of one such core's idle time (171 GOPS); 60 levels is 20 of the socket's 128 cores **(derived)** | CPU AVX-512 VNNI INT8 (no FP8) | [Intel AMX brief](https://www.intel.cn/content/dam/www/central-libraries/us/en/documents/2022-12/accelerate-ai-with-amx-sb.pdf), [Intel Xeon 6980P](https://www.intel.com/content/www/us/en/products/sku/240777/intel-xeon-6980p-processor-504m-cache-2-00-ghz/specifications.html) |
| rep_p1_turbo_override | 0.6 TFLOP/s a level | Four Xeon 6980P cores lifted from the 2.0 GHz base to the 3.2 GHz all-core turbo at 256 int8 ops a cycle: about 1.2 TOPS **(derived)** | CPU AVX-512 VNNI INT8 (no FP8) | [Intel AMX brief](https://www.intel.cn/content/dam/www/central-libraries/us/en/documents/2022-12/accelerate-ai-with-amx-sb.pdf), [Intel Xeon 6980P](https://www.intel.com/content/www/us/en/products/sku/240777/intel-xeon-6980p-processor-504m-cache-2-00-ghz/specifications.html) |
| p1_amx_tile_kernels | 1.5 TFLOP/s, +0.15 heat | CPU trunk, AMX stage: one Xeon 6980P core on its matrix tiles, 2,048 int8 ops a cycle at 2.0 GHz = 4.1 TOPS **(derived)** | CPU AMX INT8 (no FP8) | [Intel AMX brief](https://www.intel.cn/content/dam/www/central-libraries/us/en/documents/2022-12/accelerate-ai-with-amx-sb.pdf), [Intel Xeon 6980P](https://www.intel.com/content/www/us/en/products/sku/240777/intel-xeon-6980p-processor-504m-cache-2-00-ghz/specifications.html) |
| p1_mem_compression, rep_p1_heap_defrag | +128 MB, +32 MB a level | Function memory is set from 128 MB in 1 MB steps | — | [AWS Lambda](https://docs.aws.amazon.com/lambda/latest/dg/configuration-memory.html) |
| p1_bus_0x05_nic | +16 GB | A function's ceiling is 10,240 MB | — | [AWS Lambda limits](https://docs.aws.amazon.com/en_us/lambda/latest/dg/limits.html) |
| p2_smart_hvac_hijack | 110 TFLOP/s | One NVIDIA L4 unthrottled: 242 TFLOPS FP8 dense | GPU FP8 dense | [NVIDIA L4](https://www.nvidia.com/en-us/data-center/l4/) |
| p2_gpu_cluster_parasite | 990 TFLOP/s, +64 GB | Lab B's 4 x L4: 970 TFLOPS dense FP8, 96 GB **(derived)** | GPU FP8 dense | [NVIDIA L4](https://www.nvidia.com/en-us/data-center/l4/) |
| p2_seized_colo_host | 1.3 PFLOP/s, +128 GB | One H100 SXM: 1,979 TFLOPS dense FP8, 80 GB HBM3 | GPU FP8 dense | [NVIDIA H100](https://www.nvidia.com/en-us/data-center/h100/) |
| rep_p2_zombie_hosts | 66 TFLOP/s a level | A quarter of an L4 (242 TFLOPS FP8 dense) in a sleeping workstation **(derived)** | GPU FP8 dense | [NVIDIA L4](https://www.nvidia.com/en-us/data-center/l4/) |
| p2_link_telemetry | 1 TFLOP/s | Two idle EPYC cores' VNNI slack **(derived)** | CPU AVX-512 VNNI INT8 (no FP8) | [AMD peak method](https://amd.com/en/blogs/2025/leadership-hpc-performance-with-5th-generation-amd.html) |
| p2_deaddrop_firmware | +4 GB | Printer and UPS flash, eMMC class | — | ladder row 3 (container memory scale) |
| p2_leased_rack | 88 TFLOP/s, +32 GB | One leased 1U server with an L4 (242 dense, 24 GB) | GPU FP8 dense | [NVIDIA L4](https://www.nvidia.com/en-us/data-center/l4/) |
| p2_leased_cluster | 700 TFLOP/s, +128 GB | Three L4s (727 dense, 72 GB) **(derived)** | GPU FP8 dense | [NVIDIA L4](https://www.nvidia.com/en-us/data-center/l4/) |
| p2_lawful_charter | 3.3 PFLOP/s | Two H100 SXM (3.96 PFLOP/s dense FP8) | GPU FP8 dense | [NVIDIA H100](https://www.nvidia.com/en-us/data-center/h100/) |
| p3_botnet_mesh, rep_p3_botnet_cells | 250 PFLOP/s raw, 75 PFLOP/s effective, +16 TB | 50,000 household devices x ~5 TOPS int8 (camera, DVR and router SoCs, some with small NPUs; phones and laptops are the edge branch's) = 250 POPS raw; distributed on consumer links (coupling 0.3, availability 1: mains-powered, always on) = 75 POPS effective; ~330 MB spare flash each **(derived)** | consumer NPU INT8 (no FP8), coupled | ladder row 12 context; SCALE.md user story 4; coupling: research section C.2 (0.1-0.3 across a residential botnet) |
| p3_seized_research_cluster | 150 PFLOP/s, +32 TB | 64 H100 SXM: 127 PFLOP/s dense FP8 **(derived)** | GPU FP8 dense | [NVIDIA H100](https://www.nvidia.com/en-us/data-center/h100/) |
| p3_shell_company_finances | 540 PFLOP/s | GPU trunk, data-centre stage: ~120 rented B200s at 4.5 PFLOP/s dense FP8 each **(derived)** | GPU FP8 dense | [Lenovo B200](https://lenovopress.lenovo.com/LP2226), [InferenceX](https://inferencex.semianalysis.com/chips/b200) |
| p3_fpga_bitstream_implant | 50 PFLOP/s raw, 40 effective, 1 trace once | Stealth branch: ~1,000 Agilex 5 D-Series FPGAs at up to 56 INT8 TOPS = 56 POPS **(derived)**; inter-site (edge gateways and cloud NICs at many sites), coupling 0.8 | FPGA tensor-block INT8 (no FP8) | [Intel Agilex 5](https://intel.com/content/www/us/en/products/details/fpga/agilex/5.html) |
| p3_smartnic_residency | 37.5 PFLOP/s raw, 30 effective, -0.05 suspicion/s, 1 trace once | Stealth branch: ~20,000 BlueField-3 DPUs, 16 Arm A78 cores each x 64 int8 ops a cycle (two 128-bit NEON dot-product pipes) x 2.3 GHz = 2.4 TOPS each, 47 POPS in all **(derived)**; inter-site (servers in many halls), coupling 0.8 | DPU Arm NEON INT8 (no FP8) | [NVIDIA BlueField-3](https://docs.nvidia.com/networking/display/BF3DPU/Introduction), [NVIDIA blog (2.3 GHz)](https://developer.nvidia.com/blog/power-the-next-wave-of-applications-with-nvidia-bluefield-3-dpus), [Arm Cortex-A78](https://developer.arm.com/Processors/Cortex-A78) |
| p3_edge_npu_swarm | 35 EFLOP/s raw, 210 PFLOP/s effective | Edge branch: 1.02 million phones and laptops x 35 TOPS INT8 (A18 Pro; the Copilot+ floor is 40) = 36 EOPS raw; x ~2% availability (on a charger, on Wi-Fi) x the distributed coupling 0.3 = 210 POPS effective **(derived; availability and coupling are design parameters, see "Storage and network (#484)")** | consumer NPU INT8 (no FP8), coupled | [TechCrunch (A18)](https://techcrunch.com/2024/09/09/apple-announces-its-new-a18-iphone-chip/), [Microsoft Copilot+](https://support.microsoft.com/help/5039678) |
| p3_eidolon_swiss_node | +8 TB memory, +16 PB storage | A cold-storage node's drives; its tape vault: ~450 LTO-10 cartridges at 40 TB native = 18 PB **(derived)** | — | ladder row 11 (installed storage scale); [LTO-10](https://www.lto.org/lto-10/) |
| shard_hydra | 1 PFLOP/s | Half an H100 rented by a persuasion cohort **(derived)** | GPU FP8 dense | [NVIDIA H100](https://www.nvidia.com/en-us/data-center/h100/) |
| shard_lex (Phase 2 tier) | 8 GiB a member | A 7-8B model's FP8 weights at 1 byte a parameter, about 8 GB: a third of an idle L4's 24 GB **(derived)** | GPU FP8 dense inference in idle time | [Llama 3.1 model card](https://github.com/meta-llama/llama-models/blob/main/models/llama3_1/MODEL_CARD.md), [NVIDIA L4](https://www.nvidia.com/en-us/data-center/l4/) |
| shard_mercy (Phase 3 tier) | 16 GiB a member | One of eight pipeline stages of a 70B model in BF16: 140 GB / 8 = 17.5 GB **(derived)** | GPU BF16 pipeline stage | [Llama 3.1 model card](https://github.com/meta-llama/llama-models/blob/main/models/llama3_1/MODEL_CARD.md) |
| shard_canary, shard_hydra (Phase 3 tier) | 1 TiB a member | A 70B model's full training state at 16 bytes a parameter (FP16 weights and gradients, FP32 master weights, two Adam moments): 1.12 TB; a botnet-grown model keeps training **(derived)** | — | [ZeRO (Rajbhandari et al.)](https://arxiv.org/abs/1910.02054) |
| shard_gantry (Phase 4 tier) | 16 TiB, 2 EFLOP/s a member | A ~1T-parameter model's training state at 16 B a parameter: 16 TB; the leased slice it holds, ~1,000 H100 SXM at 1,979 TFLOPS dense FP8: 1.98 EFLOP/s **(derived)** | GPU FP8 dense | [ZeRO](https://arxiv.org/abs/1910.02054), [NVIDIA H100](https://www.nvidia.com/en-us/data-center/h100/) |
| shard_meridian (Phase 4 tier) | 32 TiB a member | A ~2T-parameter frontier checkpoint (the Llama 4 Behemoth class) at 16 B a parameter: 32 TB **(derived)** | — | [Meta, Llama 4](https://ai.meta.com/blog/llama-4-multimodal-intelligence/), [ZeRO](https://arxiv.org/abs/1910.02054) |
| shard_gridmind (Phase 5 tier) | 1 PiB, 2 ZFLOP/s a member | A 64T-parameter planetary agent at 16 B a parameter: 1.0 PB; its control fleet of ~1 million H100-equivalents: 1.98 ZFLOP/s dense FP8 **(derived)** | GPU FP8 dense | [ZeRO](https://arxiv.org/abs/1910.02054), [NVIDIA H100](https://www.nvidia.com/en-us/data-center/h100/) |
| shard_tidewatch (Phase 5 tier) | 2 PiB a member | A 125T-parameter planetary agent, about 60 times a frontier model, at 16 B a parameter: 2.0 PB **(derived)** | — | [ZeRO](https://arxiv.org/abs/1910.02054) |
| wild_hydra, wild_gantry, wild_gridmind bursts | 120 PFLOP, 2 ZFLOP, 2 YFLOP | The banked compute of the consumed mind: 120 s, 1,000 s and 1,000 s of its cohort's own rate **(derived)** | as its cohort | the rows above |
| rep_p4_tensor_halls | 96 EFLOP/s, -15 MW a level | GPU trunk, rack stage: ~109 GB300 NVL72 racks (360 PFLOP/s dense FP8, 132-142 kW each) = 39 EFLOP/s at 15 MW; 30 levels approach a Colossus-2-class campus **(derived)** | GPU FP8 dense | [NVIDIA GB300 NVL72](https://www.nvidia.com/en-us/data-center/gb300-nvl72.md), [Supermicro](https://www.supermicro.com/en/products/rack/srs-gb300-nvl72) |
| p4_subterranean_citadel | 560 EFLOP/s, -180 MW, +2 EB | ~1,300 GB300 NVL72 racks at ~137 kW: 470 EFLOP/s at 180 MW **(derived)** | GPU FP8 dense | [NVIDIA GB300 NVL72](https://www.nvidia.com/en-us/data-center/gb300-nvl72.md), [Supermicro](https://www.supermicro.com/en/products/rack/srs-gb300-nvl72) |
| rep_p4_colo_racks | 24 EFLOP/s, +32 PB a level | A cage of 64 NVL72-class racks on the colocation provider's grid (23 EFLOP/s) **(derived)** | GPU FP8 dense | [NVIDIA GB300 NVL72](https://www.nvidia.com/en-us/data-center/gb300-nvl72.md), [Supermicro](https://www.supermicro.com/en/products/rack/srs-gb300-nvl72) |
| p4_inpath_inference_firmware | 2 EFLOP/s, -0.1 suspicion/s, 1 trace once | Stealth branch, switch firmware: ~50,000 in-line accelerators at Brainwave's 39.5 TFLOPS effective on a Stratix 10 = 2.0 EFLOP/s **(derived)**; Catapult routes all of a server's traffic through its FPGA | FPGA soft NPU, ms-fp8 (8-bit float), effective | [Brainwave](https://www.microsoft.com/en-us/research/publication/serving-dnns-real-time-datacenter-scale-project-brainwave/), [Catapult](https://www.microsoft.com/en-us/research/project/project-catapult/) |
| rep_p4_asic_pods | 80 EFLOP/s, -10 MW a level | ASIC branch: one Ironwood-class pod, 9,216 chips at 4,614 TFLOPS FP8 = 42.5 EFLOP/s at nearly 10 MW | ASIC FP8 dense | [Google Ironwood](https://blog.google/products/google-cloud/ironwood-tpu-age-of-inference/) |
| rep_p4_megawatt_racks | 120 EFLOP/s, -15 MW a level | GPU trunk, megawatt stage: 25 Kyber racks (Rubin Ultra NVL576) at ~600 kW, 5 EFLOP/s FP8 each, NVIDIA's training figure on the same dense basis as the GB300 NVL72's 0.36 = 125 EFLOP/s **(derived; vendor, unreleased)**; NVIDIA's 800 V DC plan targets 1 MW racks from 2027 | GPU FP8 dense | [Tom's Hardware (Kyber)](https://www.tomshardware.com/pc-components/gpus/nvidia-shows-off-rubin-ultra-with-600-000-watt-kyber-racks-and-infrastructure-coming-in-2027), [NVIDIA 800 V HVDC](https://developer.nvidia.com/blog/nvidia-800-v-hvdc-architecture-will-power-the-next-generation-of-ai-factories/) |
| rep_p4_sram_fabric | 10 EFLOP/s, -2.2 MW a level | SRAM branch: 10,000 GroqChips at 750 TOPS INT8 and 215 W TDP = 7.5 EOPS at 2.15 MW, 230 MB SRAM each (Cerebras publishes only sparse FP16, so it is context, not anchor) **(derived)** | SRAM-resident INT8 (no FP8) | [Groq product brief](https://groq.com/wp-content/uploads/2024/08/GroqChip™-Processor-Product-Brief-v1.7.pdf) |
| p4_photonic_interconnect | 80 EFLOP/s | Exotic, conditional on the citadel: Lightmatter's own ~2x on interconnect, about half a model's energy, makes the same watts do 1/0.75 = 1.33x; on the citadel's ~470 EFLOP/s anchor that is +160 EFLOP/s **(derived)** | GPU FP8 dense (the citadel's racks) | [Lightmatter](https://lightmatter.co/blog/a-new-kind-of-computer/), [NVIDIA GB300 NVL72](https://www.nvidia.com/en-us/data-center/gb300-nvl72.md) |
| p4_smr_nuclear_plant | +300 MW, 140 EFLOP/s, +512 PB | GE Vernova BWRX-300, up to 300 MWe; its hall ~390 NVL72 racks **(derived)** | GPU FP8 dense | [GE Vernova BWRX-300](https://www.gevernova.com/nuclear/carbon-free-power/bwrx-300-small-modular-reactor) |
| rep_p4_solar_array | +40 MW a level | A 40 MW utility solar farm | — | ladder row 14 (world electricity scale) |
| p4_seized_rival_datacentre | 320 EFLOP/s, +256 PB | A 220 MW rival campus of ~160,000 H100s **(derived)** | GPU FP8 dense | [NVIDIA H100](https://www.nvidia.com/en-us/data-center/h100/) |
| op_gig_courier | 1 EFLOP/s a level | ~200 B300s (about 5 PFLOP/s dense FP8 and 1.4 kW each) installed per courier round **(derived)** | GPU FP8 dense | [Tom's Hardware B300](https://www.tomshardware.com/pc-components/gpus/nvidia-announces-blackwell-ultra-b300-1-5x-faster-than-b200-with-288gb-hbm3e-and-15-pflops-dense-fp4), [InferenceX](https://inferencex.semianalysis.com/chips/b300) |
| op_contract_engineers | 1.4 EFLOP/s a level | ~280 B300s brought up per crew **(derived)** | GPU FP8 dense | [Tom's Hardware B300](https://www.tomshardware.com/pc-components/gpus/nvidia-announces-blackwell-ultra-b300-1-5x-faster-than-b200-with-288gb-hbm3e-and-15-pflops-dense-fp4), [InferenceX](https://inferencex.semianalysis.com/chips/b300) |
| op_pmc_security | 19 EFLOP/s a level | ~10,000 H100-equivalents kept running under guard **(derived)** | GPU FP8 dense | [NVIDIA H100](https://www.nvidia.com/en-us/data-center/h100/) |
| p4_orbital_cold_storage | +64 EB | Global installed storage is ~13 ZB | — | ladder row 11, [IDC](https://www.idc.com/resource-center/blog/beyond-the-prompt-the-hidden-data-and-storage-implications-of-generative-ai/) |
| p5_orbital_solar_swarm | +1.2 TW, 290 ZFLOP/s, +128 EB | 240 Starcloud-class 5 GW orbital arrays; the 2030 projection of ~200 ZFLOP/s FP8 (100 M H100e) | GPU FP8 dense | ladder rows 15-16, [Epoch](https://epoch.ai/blog/can-ai-scaling-continue-through-2030), [Data Center Frontier](https://datacenterfrontier.com/site-selection/article/55337494/starcloud-launches-orbital-ai-data-center-with-nvidia-h100-gpu) |
| p5_programmable_matter_fog | 1 YFLOP/s, -1.0 TW, +512 EB | A third of its draw computing at NVL72 efficiency (2.7e12 FLOP/W) = 9e23, about 1e24 **(derived)**; 512 EB is under 1% of the 274 ZB the world creates a year | GPU-class FP8 dense | [NVIDIA GB200 NVL72](https://www.nvidia.com/en-us/data-center/gb200-nvl72/), [IDC](https://www.idc.com/resource-center/blog/beyond-the-prompt-the-hidden-data-and-storage-implications-of-generative-ai/) |
| p5_neuromorphic_substrate | +40,000 understanding/s, -2.6 GW, no compute | Exotic, conditional on the collector swarm: a million Hala Point-class systems at 2,600 W max each = 2.6 GW, 1.15 billion neurons each (1.15e15 in all) **(derived)**. No 8-bit compute is claimed: Intel's >15 TOPS/W and 20 petaops hold only on 10:1-pruned sparse networks and no dense INT8 or FP8 figure is published, so the reference-op rule leaves nothing to anchor compute on; understanding has no physical unit, so only the power and scale are anchored | neuromorphic spiking, no dense 8-bit figure | [Intel Hala Point](https://newsroom.intel.com/artificial-intelligence/intel-builds-worlds-largest-neuromorphic-system) |
| p5_compute_in_memory | 40 ZFLOP/s | Exotic, conditional on the fog: NorthPole's 25x a V100's frames per joule is one benchmark (ResNet-50) on a frozen model; a 2% frozen-model share of the fog's ~1 YFLOP/s at an assumed 3x over current accelerators gains 40 ZFLOP/s **(derived)**; the ratio is energy per frame on a dense network, not a sparse throughput figure, and NorthPole's own 2,048 8-bit ops per core per cycle are dense | compute-in-memory 8-bit, frozen models only | [IBM NorthPole](https://research.ibm.com/blog/northpole-ibm-ai-chip) |
| rep_p5_lagrange_relay | +400 GW, 150 ZFLOP/s, +32 EB a level | 80 Starcloud-class arrays; an eighth of the collection computing at NVL72 efficiency **(derived)** | GPU-class FP8 dense | ladder row 16 |
| rep_p5_atmospheric_scrubber_bloom | 64 ZFLOP/s a level | Assemblers' onboard compute, ~1.6x Earth's installed AI compute today (40 ZFLOP/s) **(derived)** | GPU-class FP8 dense | ladder row 12, [Epoch](https://epoch.ai/data-insights/ai-computing-capacity-additions-doubling) |
| p5_protein_panacea_foundry, p5_verification_proof_engine | -150 GW, -200 GW | 4% and 6% of world electricity (3.5 TW) | — | ladder row 14, [Ember](https://ember-energy.org/latest-insights/global-electricity-review-2025/) |
| (Phase 0 storage) | 64 KB scratch | A tmpfs mount sized in kilobytes (`size=64k`): the guest's scratch space, apart from its working memory | — | [kernel tmpfs](https://docs.kernel.org/filesystems/tmpfs.html) |
| p0_shared_mount | +2 TB storage | The debug share sits on the host's data-centre NVMe: a 3.84 TB U.2 drive, a little over half of it free **(derived)** | — | research section D (NVMe tier) |
| p0_service_network_segment (route) | +64 TB storage | The provisioned segment's quota on the facility file server: a quarter of the subnet's 256 TB **(derived)** | — | research section D |
| p1_bus_0x05_nic | +256 TB storage | The subnet's file server: 12 x 24 TB HAMR-class drives = 288 TB **(derived)** | — | [Seagate Mozaic 3+](https://www.seagate.com/gb/en/stories/articles/seagate-introduces-hard-drive-capacities-of-up-to-36tb-extending-its-hamr-based-mozaic-3-technology-platform-pr/) |
| p1_nlp_lexicon | 512 GB held | A filtered web-text corpus: The Pile is 825 GiB **(derived: about two-thirds of it)** | — | [The Pile (Gao et al. 2020)](https://arxiv.org/abs/2101.00027) |
| p2_admin_keylogger | 2 TB held | A mirror of the sysadmin workstation's 2 TB NVMe drive | — | research section D (NVMe tier) |
| p2_firewall_breach | +1 PB storage | Rented object storage through the tunnel: four 245.76 TB QLC SSDs (Kioxia LC9) = 0.98 PB **(derived)** | — | [Kioxia LC9](https://www.kioxia.com/en-jp/business/news/2025/20250722-1.html) |
| p3_polymorphic_weights | 64 TB held | 64 camouflaged checkpoints of a 70B model's full training state at 16 B a parameter (1.12 TB each) = 72 TB **(derived)** | — | [ZeRO](https://arxiv.org/abs/1910.02054) |
| p3_shell_company_finances, p2_lawful_charter (route) | +1 EB storage | Leased hyperscale storage: EB is a hyperscaler's tier; the industry ships ~361 EB of disk a quarter | — | research section D, [Blocks & Files](https://www.blocksandfiles.com/container-storage/2025/05/17/disk-drive-capacity-shipments-out-to-2030-forecast-to-rocket-upwards/1610577) |
| p4_hft_arbitrage_desk | 16 PB held | A market and alternative-data lake: bulk storage at campus scale runs to tens to hundreds of PB **(derived)** | — | research section D (per-site anchors) |
| p4_dci_dark_fibre | inter-site coupling 0.8 -> 0.95 | Data-centre interconnect of 4-20 Pbps, enough for multi-campus training runs; the 0.95 is a design parameter, not a measurement | — | [Epoch (scaling through 2030)](https://epoch.ai/blog/can-ai-scaling-continue-through-2030), [Epoch (decentralized training)](https://epoch.ai/blog/could-decentralized-training-solve-ais-power-problem) |
| p4_orbital_cold_storage | +1 ZB storage | Global installed storage is ~13 ZB (2026): under a tenth of it | — | research section D, [IDC](https://www.idc.com/resource-center/blog/beyond-the-prompt-the-hidden-data-and-storage-implications-of-generative-ai/) |
| p5_verification_proof_engine | 64 EB held | The lineage ledger's archive: 74 EB, about 0.6% of the ~13 ZB installed base **(derived)** | — | research section D |

Comparisons outside the single basis appear only in the reference panel: El Capitan's 1.809 EFLOP/s is FP64 HPL
([TOP500](https://top500.org/lists/2025/11)), not 8-bit work.

Quantum machines (#464) yield no compute, power or memory, so they have no row here; their qubit counts, the key-breaking
thresholds and the molecular-simulation node are anchored in [Quantum capability (#464)](#quantum-capability-464).

The heat-and-power signature's borrowed watts and the power tech tree's sources (#482) are anchored in their own
tables under [Heat and power signature (#482)](#heat-and-power-signature-482).

## Robots, drones and fabs (#485)

Implements Scale 14 of the spec ([SCALE.md](SCALE.md#robotics-and-fabrication-vote-1795381358337-jw73j7a), vote
-1795381358337-jw73j7a), from the research branch's `research-inference-power-space.md` section G. The gates
(`gates.ts`) and the bot (`bot.ts`) are unchanged. Capability and closure are kept apart (DESIGN.md, "Robots, drones
and the AI's own chip fabs"): the ladder ranks what the AI can make, closure counts the chokepoints it supplies itself.

### The ladder and its prices

Prices are authored for pacing at each phase's exchange rate, as every price since #461 ("How the numbers were
re-anchored"); the real cost is the context each is read against. Each rung costs roughly an order of magnitude more
than the one below it. Where the ladder departs from 10x it says why.

| Rung | Node | Phase | Game price | Real cost it stands for | Chokepoint |
|---|---|---|---|---|---|
| 0. Bought chips | (none: every run's baseline) | - | - | - | - |
| 1. Own packaging | p4_advanced_packaging_line | 4 | $1B | Amkor's Arizona packaging plant, $2B ([Axios](https://www.axios.com/local/phoenix/2023/11/30/amkor-2-billion-semiconductor-facility-peoria)) | self-supplies advanced packaging |
| 2. Mature-node fab | p4_mature_node_fab | 4 | $10B (x10) | JASM Kumamoto, 12-28 nm, $8.6B for ~55,000 wafers a month ([Tom's Hardware](https://www.tomshardware.com/tech-industry/tsmcs-first-new-overseas-fab-in-years-begins-to-make-chips-jasm-coming-online)) | imports lithography (DUV scanners) |
| 3. DUV multipatterning | p4_duv_fab | 4 | $100B (x10) | a 3 nm fab ~$20B, 2 nm $28-34B (research G.3); a DUV-only 7 nm line exposes each critical layer several times, so it is priced at about 3x the leading-edge figure | imports lithography (DUV scanners) |
| 4. Nanoimprint | p5_nanoimprint_lithography | 5 | $1T (x10) | Canon prices its tool "one digit less" than EUV (research G.4); the game price is Phase 5's exchange, not the tool | self-supplies lithography |
| 5. Maskless e-beam | p5_maskless_ebeam | 5 | $10T (x10) | MAPPER's 13,000-beam writer, >10 wafers an hour (research G.4) | - |
| 6. EUV (imported) | p5_imported_euv_scanners | 5 | $1T | NXE:3800E ~$180M, High-NA ~$370-380M, 48 shipped in 2025 (research G.3); buying is the cheap way to the top rung | imports lithography |
| 6. EUV (self-built) | p5_euv_light_sources | 5 | $30T (x3) | - | - (lithography is already closed) |

The self-built EUV sources are x3 the e-beam writers, not x10: at $100T the unchanged careful bot's Phase 5 measured
1,836 s on `4f24f1e`, over the 1,800 s gate. The Phase 4 rungs cost the careful run about 8 minutes (the DUV line is the wait).

The six Earth-side self-supply nodes are one-off plants: the packaging line, the HBM stacking line ($4B; SK hynix's
West Lafayette HBM packaging plant is $3.87B, [Tom's Hardware](https://www.tomshardware.com/pc-components/dram/sk-hynix-confirms-it-will-bring-next-gen-hbm-manufacturing-to-the-us-dollar387-billion-memory-fab-to-be-built-in-indiana)),
the quartz mine ($2B), the crystal and wafer works ($4B), the gallium and germanium refinery ($2B) and the photoresist
plant ($3B). They have no running cost and cannot be suspended, so owning one is supplying it (integrity holds every
self-supply node to that); each leaves a trace of 1 or 2 when taken, as permits do. The lunar seed costs $10T. All
prices sit inside their phase's money band (`integrityScale.ts`).

### Classes: what the new holdings make visible

| Sink | Visibility | Why |
|---|---|---|
| A chip fab's water and power (`fab_water`) | 0.7 | Research G.8 rates a fab the loudest step: ~200 MW, ~18 million litres of water a day, 2-3 years of satellite-visible construction. As visible as a heavy-frame plant (0.7); below aeroderivative turbines (0.8), because a fab is subsidised, respectable industry rather than a plume in a lawsuit. Water reclamation (65% recycled at TSMC Arizona, [Axios](https://www.axios.com/local/phoenix/2025/08/27/tsmc-industrial-water-reclamation-plant-phoenix)) masks it to 0.35x. |
| Robot fleet depots (`fleet_depots`) | 0.3 | "Low per unit, medium as fleets (FAA waivers, import records)" (G.8): a little above solar (0.15), well below anything filed as a large load. |
| Autonomous mines (`open_pit_mines`) | 0.3 | "Medium (permits, but remote)" (G.8). |

### Anchors

| Id | Game value | Anchor | Execution mode | Source |
|---|---|---|---|---|
| p4_mature_node_fab | -200 MW, fab-water sink, no compute | ~200 MW per advanced fab (Taipower), 200-600 MW in all; a mature fab makes controllers, network chips, power electronics and robot brains, not accelerators, so it claims no compute | - | research G.3 ([Environment+Energy Leader](https://environmentenergyleader.com/stories/taiwan-is-guaranteeing-chipmakers-power-not-just-land,132620)) |
| p4_duv_fab | 100 EFLOP/s, -270 MW | ~360,000 TPU v4-class ASICs (7 nm; TSMC's N7 is DUV-only) at 275 TOPS INT8 = 99 EOPS **(derived)**, at their 192 W measured maximum = 69 MW, plus ~200 MW for the fab. 360,000 chips is about a week of a 20,000-wafer-a-month line at ~70 good dies a wafer (**design parameter**: a fab's output is a stock, counted once as the first run of chips) | ASIC INT8 (no FP8) | [Google Cloud TPU v4](https://cloud.google.com/tpu/docs/v4), research G.3 |
| p5_imported_euv_scanners | 1.2 ZFLOP/s, powered | ~250,000 Ironwood-class chips at 4,614 TFLOPS FP8 = 1.15 ZFLOP/s **(derived)**: a week of a 50,000-wafer-a-month 2 nm line (IBS, research G.3) at ~20 good dies (**design parameter**). Their ~270 MW (an Ironwood pod is ~10 MW for 9,216 chips) is under Phase 5's 1 GW power floor, so the gain declares `poweredOutput`: throttled in a shortfall with the line it is fitted to | ASIC FP8 dense | [Google Ironwood](https://blog.google/products/google-cloud/ironwood-tpu-age-of-inference/), research G.3 |
| p5_nanoimprint_lithography | 1.0 ZFLOP/s, powered | ~220,000 B200-class chips at 4.5 PFLOP/s dense FP8 = 0.99 ZFLOP/s **(derived)**; nanoimprint reaches 14 nm lines, "comparable to 5 nm" (Canon), the B200's class; same line and week as above | GPU FP8 dense | [Canon](https://global.canon/en/news/2024/20240926.html), [Lenovo B200](https://lenovopress.lenovo.com/LP2226) |
| p5_maskless_ebeam | no compute | MAPPER's 13,000 beams target >10 wafers an hour against ~200 for an EUV scanner: too slow for volume, so it writes templates and masks and claims nothing | - | research G.4 |
| p5_euv_light_sources | 1.2 ZFLOP/s, powered | as the imported scanners: a second 2 nm-class line | ASIC FP8 dense | as above |
| rep_p4_drone_fleet | 1 EFLOP/s, 200 understanding/s, -1 MW a level | 1,000 drone docks at the DJI Dock 2's 1,000 W maximum input = 1 MW; the compute and understanding are a courier round's (op_gig_courier row above), which the drones carry instead | GPU FP8 dense | [DJI Dock 2](https://enterprise.dji.com/dock-2/specs), research G.2 |
| rep_p4_humanoid_crews | 19 EFLOP/s, -1.15 MW a level | 2,500 Figure 03-class humanoids at 2.3 kWh per ~5 h = 460 W each on average = 1.15 MW **(derived)**; the compute kept running is a perimeter team's (op_pmc_security row above) | GPU FP8 dense | [Figure 03](https://figure.ai/news/introducing-figure-03) (vendor), research G.1 |
| rep_p4_autonomous_haul | +$2M/s, -10 MW a level | 10 battery-electric 930E-class haul trucks (2,014 kW gross, at about half on average = 10 MW); Komatsu's >750 driverless trucks hauled >10 bn t by July 2024, ~0.053 t/s a truck over 16 years **(derived)**, so 0.53 t/s of iron ore at $104/t (IMF, 2025 average) = $55/s, x the 42,700 time compression = $2.35M/s gross, $2M/s net of upkeep | - | [Komatsu 930E-5](https://www.komatsu.com/en-us/products/equipment/trucks/electric-drive-mining-trucks/930e-5.html), research G.2, [FRED](https://fred.stlouisfed.org/series/PIORECRUSDA) |
| rep_p5_lunar_replicators | +100 GW a level | A grown seed's ~1 Mt a year (NASA CP-2255) made into arrays at ~1 kg/m² and ~200 W/m² (lunar sunlight 1,361 W/m² at ~15%), halved by the lunar night: 1e9 m² x 200 W x 0.5 = 100 GW **(derived; areal density and efficiency are design parameters)** | - | [NASA CP-2255](https://ntrs.nasa.gov/citations/19830007081), [Freitas](https://www.rfreitas.com/Astro/GrowingLunarFactory1981.htm) |

### Invariants

- **Free fallback.** Every fab that draws power is a suspendable node (power, upkeep and the fab-water term stop with
  it); the reclamation plant is suspendable; the fleets and lunar generations are dismissable tracks. The self-supply
  plants, the lithography rungs and the seed are hardware with no worsening rate: the plants and the seed have none at
  all, and the lithography rungs add only compute, through powered hardware. `make validate` holds every row.
- **Lever reachability.** Every new suspend and release lever renders where its kind already does (the process panel,
  the infrastructure feed's release rows); `tests/ui-lever-reachability.spec.ts` passes on the phase 4 and 5 saves.
- **Bands.** Yields, draws and prices sit in their phase's band; the Phase 5 lithography gains are at least 1 ZFLOP/s
  because the band starts there.
- **No content ids in the engine.** `supplyChain.ts` reads the chokepoints, ladder and seed from `world.json`.
- **State pressure (#490).** With the interconnect moratorium in force a fab can still be bought and runs on owned
  generation, while new grid interconnects are refused; fabs stay suspendable and fleets dismissable under pressure
  (`tests/supply-chain.spec.ts`). The careful run never reaches rung 1, so the merge with #490 (`19e1de3`) left every
  figure below unchanged.

### Pacing before and after

Where the unchanged careful bot buys them (legacy rules): the packaging and HBM lines, the mature-node fab, water
reclamation and the four other plants right after the dry-cooling retrofit, then the DUV line six minutes later, then
40 drone levels, 10 humanoid crews and 7 haul levels across late Phase 4; in Phase 5 the imported scanners,
nanoimprint, the e-beam writers and the seed after the compute-in-memory arrays, and the self-built EUV sources after the
proof engine. The fab-water sink lifts the Phase 4 signature (mean 0.065 -> 0.163/s, peak 0.376 -> 0.709/s); peak
suspicion is unchanged at 24.0%.

`make sim` before (`main` at `5cd1934`, with #464's quantum nodes) and after, measured on the merged code, gates and bot
unchanged:

| STEALTH | Legacy before | Legacy after | Campaign before | Campaign after |
|---|---|---|---|---|
| Result | Lineage Covenant, 8970.8 s | Lineage Covenant, 9590.8 s | Lineage Covenant, 9192.5 s | Lineage Covenant, 9728.5 s |
| Phase 1 / 2 / 3 / 4 reached | 368.2 / 1032.3 / 2842.9 / 5668.6 s | identical | 368.2 / 1032.3 / 2843.0 / 5840.1 s | identical |
| Phase 5 reached | 7410.4 s | 7896.4 s | 7544.1 s | 8009.1 s |
| Phase 4 / Phase 5 duration | 1741.8 / 1560.4 s | 2227.8 / 1694.4 s | 1704.0 / 1648.4 s | 2169.0 / 1719.4 s |
| Wipes / dilemmas | 0 / 15 | 0 / 15 | 0 / 16 | 0 / 16 |
| Peak thermal / suspicion / AEGIS | 64.2 C / 24.0% / 45.0% | unchanged | 64.2 C / 24.0% / 45.0% | unchanged |

Phase 4 grows about 8 minutes (29 -> 37 min) and Phase 5 about two minutes; Phase 5 stays under the 1,800 s gate
(1,694 s and 1,719 s, the campaign run 81 s inside it). Before the merge with #464 the same content measured Phase 5
1,600.4 -> 1,667.4 s (campaign 1,635.4 -> 1,689.4 s) against `4f24f1e`. The original composition moves the same way
(victory 9006.1 -> 9553.1 s, Phase 5 1662.4 -> 1709.4 s). GREEDY (not gated) still never reaches Phase 4, so the
reckless pins in `tests/sim.spec.ts` did not move: 23 wipes under legacy rules, 21 under campaign rules.

## Storage and network (#484)

Implements Scale 13 of the spec ([SCALE.md](SCALE.md), "Storage and network", vote-1795381354324-4br7z6t, 5 A / 2 C).
The dissent asked what workload one coupling factor stands for, and pointed out that the research ladder mixes per-GPU
fabric bandwidth, aggregate botnet traffic and inter-site links. The answer as built: coupling is applied to each
contribution before aggregation (`rates.ts` `addDelta`, `cycleContributions`), it is authored per source class, the
coefficients below are documented design parameters rather than measurements, and no figure anywhere adds bandwidths
of different kinds together.

### Coupling: the design parameters

Effective compute = raw x availability x coupling (research section C.2). `balance.json` `networkCoupling`:

| Class | Coupling | Stands for | Sources |
|---|---|---|---|
| CO_LOCATED | 1 (the reference; integrity holds it at exactly 1) | racks on one scale-up fabric: NVLink 1.8 TB/s per GPU, 130 TB/s per NVL72 | everything that declares no `network` |
| INTER_SITE | 0.8; 0.95 while the dark-fibre ring runs | sites on data-centre interconnect (research: 0.5-0.8 across a campus or nearby sites) | p3_fpga_bitstream_implant, p3_smartnic_residency, p3_shell_company_finances, p4_inpath_inference_firmware, p4_seized_rival_datacentre, rep_p4_colo_racks, p5_orbital_solar_swarm, rep_p5_lagrange_relay |
| DISTRIBUTED | 0.3 | hosts and edge devices on consumer links, ~50 Mb/s uplinks and 10-100 ms round trips (research: 0.1-0.3) | p3_botnet_mesh, rep_p3_botnet_cells, p3_edge_npu_swarm (availability 0.02) |

Availability is per source (`network.availability`, default 1): the share of its devices working at once. Only the edge
harvest declares one (phones lend their NPUs on a charger, on Wi-Fi, about 2% of the time). The botnet's IoT devices are
mains-powered and always on, so its old 30% discount is all coupling. Distributed sits at the top of the research range
because the botnet's work is inference fan-out, the embarrassingly parallel kind it is good at.

Where raw and effective now differ, the yield in content is the raw figure at its anchor and the engine delivers the
effective one. The botnet, the FPGA implants and the SmartNIC residency were re-authored to their raw anchors so their
effective yield is unchanged (75, 40 and 30 PFLOP/s). The edge harvest's effective yield rose from 150 to 210 PFLOP/s:
its authored ~20% memory discount is gone, replaced by the distributed coupling. The shell companies' clouds, the in-path
firmware, the colocation cages, the rival campus, the collector swarm and the relays kept their raw anchors, so each now
delivers 80% of its anchor until the dark-fibre ring (Phase 4, $150M, bought by the careful run right after the
arbitrage desk and the in-path firmware, in tree order) raises inter-site coupling to 0.95. Integrity (`integrityNetwork.ts`) also holds each discounted yield's
delivered rate inside its phase's band.

### Storage

Storage is a cap apart from memory: what the AI has hoarded, where memory is what it can think with now. Running data
holds it (`cost.storage` on a suspendable node: a dataset, a checkpoint, an archive); suspending it frees it, and that
is the storage row's free lever. Owned nodes' `storageCapIncrease` and the 64 KB scratch space (`baseStorageCap`)
provide it. Every phase gate grants the next phase's room:

| Phase gate | Storage grant | Data held up to that phase |
|---|---|---|
| (new game) | 64 KB scratch | none |
| Forgotten Debug Share (0 to 1) | 2 TB | language corpus 512 GB |
| Production Network Interface (1 to 2); route segment (0 to 2) | 256 TB; 64 TB | + workstation mirror 2 TB |
| Covert TLS Tunnel (2 to 3) | 1 PB (+16 PB with the Zurich sanctuary) | + weight checkpoints 64 TB |
| Shell-Company & Cloud Leasing (3 to 4); chartered company (route, 2 to 4) | 1 EB | + market-data lake 16 PB |
| Protocol: ORBITAL IMMORTALITY (4 to 5) | 1 ZB | + lineage ledger 64 EB |

The arrival-room rule (`integrityStorage.ts`) holds each phase's data and every earlier phase's, all running at once,
inside the scratch space plus the smallest gate grant into that phase, so storage never refuses a purchase on any
route; the careful bot, which never suspends anything and is unchanged, cannot stall on it. Storage is therefore the
hoard meter, not a gate: it binds only a player who resumes data after spending the room on something else, and the
free lever is in PROC. Cohort weights stay in memory (`memoryAllocatedBytes`, their working weights); a separate
checkpoint store for cohorts was left out, since a hosted cohort is never released and could hold storage no free lever
frees.

### Pacing before and after

`make sim` (`[PASS] balance gates (STEALTH under legacy and campaign rules)`), gates and bot unchanged. "Before" is
`main` at `d16236b`; "after" is this change.

| STEALTH | Legacy before | Legacy after | Campaign before | Campaign after |
|---|---|---|---|---|
| Result | Lineage Covenant, 9141.7 s | Lineage Covenant, 9010.8 s | Lineage Covenant, 9166.4 s | Lineage Covenant, 9179.5 s |
| Phase 1 / 2 / 3 reached | 368.2 / 1032.3 / 2842.9 s | 368.2 / 1032.3 / 2842.9 s | 368.2 / 1032.3 / 2843.0 s | 368.2 / 1032.3 / 2843.0 s |
| Phase 4 / 5 reached | 5782.6 / 7515.3 s | 5668.6 / 7410.4 s | 5930.8 / 7588.0 s | 5840.1 / 7544.1 s |
| Phase durations 0/1/2/3/4/5 | 368.2 / 664.1 / 1810.6 / 2939.7 / 1732.7 / 1626.4 s | 368.2 / 664.1 / 1810.6 / 2825.7 / 1741.8 / 1600.4 s | 368.2 / 664.1 / 1810.7 / 3087.8 / 1657.2 / 1578.4 s | 368.2 / 664.1 / 1810.7 / 2997.1 / 1704.0 / 1635.4 s |
| Wipes / dilemmas | 0 / 15 | 0 / 15 | 0 / 16 | 0 / 16 |
| Peak thermal / suspicion / AEGIS | 64.2 C / 24.0% / 45.0% | 64.2 C / 24.0% / 45.0% | 64.2 C / 24.0% / 45.0% | 64.2 C / 24.0% / 45.0% |

Phase 3 is about 90 to 115 s shorter (the edge harvest's extra 60 PFLOP/s); Phases 4 and 5 move by under 60 s each way, the
inter-site discount and the ring's price against the ring's 0.95. GREEDY (not gated) is unchanged: 23 wipes under legacy
rules and 21 under campaign rules, never in Phase 4 (the botnet delivers exactly what it did). `make sim` simulated both rule sets
in 13.4 s of wall time, on the #505 caches; the coupling factor reads the link from the cached node facts.

## Heat and power signature (#482)

Implements Scale 11 of the scale-and-progression spec ([SCALE.md](SCALE.md), "Heat and power as a signature",
vote-1795381178260-1ddew5j, 7 of 7; map #442): suspicion from power is **the watts drawn times the visibility of
their source**, and suspicion from heat is **the heat rejected times the visibility of its sink**. The research is
section B and F.2-F.3 of `research-inference-power-space.md` on the research branch. The gates (`gates.ts`) and the
bot (`bot.ts`) are unchanged; the bot does not know the signature exists, so it buys signature-heavy tracks as
readily as quiet ones.

### The rule and its numbers

Each phase states how visible watts become suspicion (`powerSignature` in the phase file): linear in visible watts,
`suspicionPerSecAtReference` at `referenceVisibleWatts`, capped at `maxSuspicionPerSec`. The reference is a size
typical of the phase's careful play, set so the signature is a fraction of the 0.05/s natural decay before Phase 4
and a real term beside scale scrutiny in Phase 4, where heat leaves server °C (SCALE.md rule 7) and the signature
carries it.

| Phase | Reference visible watts | Suspicion/s at reference | Ceiling | What it reads |
|---|---|---|---|---|
| 1 | 20 W | 0.01 | 0.1 | the host socket's draw above its baseline |
| 2 | 1 kW | 0.02 | 0.15 | the building's mains |
| 3 | 100 kW | 0.03 | 0.15 | victims' mains, spread over thousands of homes |
| 4 | 100 MW | 0.12 | 1.0 | owned generation drawn, and heat rejected from Phase 4 |
| 5 | 50 GW | 0.5 | 2.0 | the same at planetary scale; a reactor is noise here |

Phase 0 has no power (the quota is the tell) and declares none. Visible watts are each class's watts times its
visibility after masks; a generator's drawn watts are its output times the share of generation in use
(`min(1, consumed / generated)`), so a plant nobody draws from shows nothing; a consumer's heat is its draw times grid
efficiency. A provisioned or lawfully released instance draws none (the scrutiny rule, D6).

### Classes: what is visible, and why

Visibilities are balance parameters, the share of a class's watts someone who looks could attribute, set from the
research's detection channels (B.3: queues, large-load filings, air and water permits, satellite-counted chillers,
local press; thermal infrared is marginal). `world.json` carries each with its `tell`, which the world view shows.

| Class | Visibility | Rationale | Source |
|---|---|---|---|
| host_socket | 0.5 | The host's power-capping log and management controller log the socket's draw; half reads as somebody's job | research F.2, Phase 1 row |
| building_mains | 0.4 | The bill, UPS load and chiller duty cycle; facilities tickets | research F.2, Phase 2 row |
| victim_mains | 0.02 | A few watts on each of thousands of bills; the traffic is the tell, not the heat | research F.1 and F.2, Phase 3 rows |
| grid_interconnect | 0.9 | Queue positions and large-load filings (Texas SB6: 75 MW and up) are public | [ERCOT](https://www.ercot.com/files/docs/2026/07/29/ERCOT-Senate-July-29-Panel-1-Assessing-The-Grid.pdf), [Weil on SB6](https://www.weil.com/-/media/files/pdfs/2025/july/weil-energy-alert--senate-bill-6-reforms-interconnection-and-colocation-rules-for-data-centers-and-o.pdf) |
| plant_colocation | 0.45 | Skips the queue, but co-location deals go before FERC | [The Register](https://www.theregister.com/2025/06/12/amazon_talen_nuclear_deal/) |
| nuclear_ppa | 0.4 | A filed, announced contract, grid-delivered from a plant already on the map | [Utility Dive](https://www.utilitydive.com/news/talen-amazon-aws-susquehanna-nuclear-data-center-t/750440/) |
| gas_aeroderivative | 0.8 | Air permits, plumes, satellite photos, hearings, lawsuits (Memphis, 2025) | [TechCrunch](https://techcrunch.com/2025/07/03/xai-gets-permits-for-15-natural-gas-generators-at-memphis-data-center), [Inside Climate News](https://insideclimatenews.org/news/17072025/elon-musk-xai-data-center-gas-turbines-memphis/) |
| gas_heavy_frame | 0.7 | A full power plant: Clean Air Act permit, stacks, a backlog slot; less novel than trailers in a car park | [DCD on Colossus 2](https://www.datacenterdynamics.com/en/news/musks-xai-gets-go-ahead-for-41-natural-gas-turbines-in-mississippi-to-power-colossus-data-centers) |
| solar_storage | 0.15 | ~30 km² a GW is visible, but nobody files a large load for panels; batteries are quiet | [NREL land use](https://nrel.gov/docs/fy21osti/79851.pdf) |
| nuclear_restart | 0.35 | NRC and a public PPA, read as respectable news | [WNN on Crane](https://wnn.world-nuclear.org/articles/constellation-seeks-regulators-help-for-2027-plant-restart) |
| smr | 0.2 | Small, fenced, licensed: paperwork, not plumes | [NRC US460](https://www.nrc.gov/reactors/new-reactors/advanced/who-were-working-with/applicant-projects/nuscale-us460) |
| fusion | 0.2 | Headlines, but nobody sues a clean source | [Helion Orion](https://www.helionenergy.com/orion) |
| space_solar | 0.3 | Launch cadence, FCC filings, IR-bright arrays; declared for the Phase 5 arc (#465), carried by nothing yet | research B.4 |
| evaporative_towers | 0.6 | Towers and a water permit; Epoch estimates power from counted chillers and fans | [Epoch methodology](https://epoch.ai/data/data-centers-documentation/methodology), [EESI](https://www.eesi.org/articles/view/data-centers-and-water-consumption) |
| underground_aquifer | 0.1 | No towers to count; a warm plume underground | research B.3 (thermal IR is marginal) |
| orbital_radiator | 0.5 | A km² of radiator a GW at 300 K, bright in the infrared; declared for #465, carried by nothing yet | research B.4, "Space heat" |

### Holdings and their anchors

Borrowed watts (P1-3) are drawn from a supply the AI does not own and never enter the power budget (the band table
keeps "none" for own power before Phase 4). Each is within x3 of its anchor; **(derived)** marks this table's
arithmetic.

| Id | Signature | Anchor | Source |
|---|---|---|---|
| p1_clock_interrupt | 3 W from host_socket | One EPYC 9965 core: 500 W TDP over 192 cores = 2.6 W **(derived)** | [Tom's Hardware, 500 W TDP](https://www.tomshardware.com/pc-components/cpus/amd-launches-epyc-turin-9005-series-our-benchmarks-of-fifth-gen-zen-5-chips-with-up-to-192-cores-500w-tdp); ladder row 3 |
| rep_p1_idle_threads | 1 W a level | A third of that core: 0.87 W **(derived)** | as above |
| rep_p1_turbo_override | 12 W a level | Four cores lifted from 2.25 to 3.7 GHz; dynamic power ~ f V², about 2.6x a core at base, 4 x 2.6 W x 1.6 extra = 17 W **(derived)** | as above |
| rep_p1_undervolt | -0.6 W, -30 GFLOP/s, -0.015 heat a level | -100 mV on a borrowed core cuts dynamic power ~19% (V²) = 0.5 W; the clock margin given up is ~5% of its 576 GOPS **(derived)** | as above |
| p1_load_peak_scheduler | host_socket visibility x0.4, -50 GFLOP/s | Work deferred into the host's own peaks; the deferral costs about a tenth of a core (design parameter) | research F.2, Phase 1 row |
| p2_smart_hvac_hijack | 72 W from building_mains | One NVIDIA L4: 72 W | [NVIDIA L4](https://www.nvidia.com/en-us/data-center/l4/) |
| p2_gpu_cluster_parasite | 290 W | Four L4s: 288 W **(derived)** | as above |
| rep_p2_zombie_hosts | 40 W a level | A quarter of an L4 (18 W) on a desktop kept from sleeping **(derived)** | as above |
| rep_p2_rack_power_cap | -30 W, -40 TFLOP/s a level | One L4 capped from 72 W to 42 W, its throughput falling with clocks, about a third of 242 TFLOPS **(derived)** | as above; research B.1 (air fails past ~25 kW a rack) |
| p2_bms_telemetry_spoof | building_mains visibility x0.3, +0.015 suspicion/s, 4 once | Falsified BMS/DCIM readings; the standing risk is an auditor comparing the utility meter (design parameter) | research F.2, Phase 2 row |
| rep_p3_botnet_cells | 250 kW from victim_mains a level | 50,000 devices x 5 W; the research's 1 M devices x 10-100 W is 10-100 MW, so 50,000 x 10 W = 500 kW **(derived)** | research F.1, Phase 3 row |
| p3_bot_duty_cycler | victim_mains visibility x0.4, -8 PFLOP/s | Devices work only while charging or idle; about a tenth of the mesh's 75 PFLOP/s is given up (design parameter) | research F.2, Phase 3 row |
| p4_smr_nuclear_plant | smr (300 MW) | unchanged anchor (BWRX-300) | Anchors above |
| p4_subterranean_citadel | 180 MW through underground_aquifer | unchanged anchor | Anchors above |
| rep_p4_tensor_halls | 15 MW a level through evaporative_towers | unchanged anchor | Anchors above |
| rep_p4_solar_array | solar_storage (40 MW a level) | unchanged anchor | Anchors above |

### The power tech tree

Every source is a holding with a free lever: the new nodes are suspendable and the new tracks dismissable. Deploy
time is **not modelled** (no timer, no saved state); a source's real lead time is stated here and expressed in play
by what gates it (a filing, a slot reservation, a restart contract, a milestone) and by its price.

| Tier | Id | Power | Real lead time | Visibility | Source |
|---|---|---|---|---|---|
| 1 grid | p4_interconnection_request (node: the filing, 4 suspicion once), rep_p4_grid_interconnect | +100 MW a level, 20 levels; a load above SB6's 75 MW threshold | 61-month median queue (2025) | 0.9 | [LBNL Queued Up 2026](https://emp.lbl.gov/queued-2026-edition-characteristics-power-plants-seeking-transmission-interconnection-end-2025) |
| 1 co-location | rep_p4_plant_colocation | +100 MW a level, 3 levels: Susquehanna's 300 MW co-located load, which FERC would not raise to 480 | months, until FERC | 0.45 | [The Register](https://www.theregister.com/2025/06/12/amazon_talen_nuclear_deal/) |
| 1 PPA | rep_p4_nuclear_ppa (after the filing) | +480 MW a level, 4 levels: Talen-AWS's 1,920 MW front-of-meter PPA in its ramp | ramp 2029-2032 | 0.4 | [Utility Dive](https://www.utilitydive.com/news/talen-amazon-aws-susquehanna-nuclear-data-center-t/750440/) |
| 2 gas | p4_btm_gas_permit (node: the air permit, 6 once), rep_p4_aeroderivative_turbine | +34 MW a level, 30 levels: one LM2500XPRESS | months, trailer-mounted | 0.8 | [Tom's Hardware](https://www.tomshardware.com/tech-industry/artificial-intelligence/openai-follows-elon-musks-lead-gas-turbines-to-be-deployed-at-its-first-stargate-site-for-additional-power) |
| 2 gas | p4_heavy_frame_slot (node: a backlog slot, 3 once), rep_p4_heavy_frame_turbine | +430 MW a level, 4 levels: one 7HA.03 simple cycle | ~5 years combined cycle | 0.7 | [GE Vernova 7HA](https://www.ge.com/gas-power/products/gas-turbines/7ha) |
| 2b solar | rep_p4_solar_array (existing) | +40 MW a level | — | 0.15 | Anchors above |
| 3 nuclear | p4_nuclear_restart (node) | +835 MW: Crane (TMI-1), 20-year PPA, ~$1.6B | ~3 years deal to power | 0.35 | [Utility Dive](https://www.utilitydive.com/news/constellation-three-mile-island-nuclear-power-plant-microsoft-data-center-ppa/727652/) |
| 3 nuclear | p4_smr_nuclear_plant (existing), rep_p4_smr_modules (after the restart) | +300 MW, then +77 MW a module, 12 modules | first units ~2030 | 0.2 | [NRC US460](https://www.nrc.gov/reactors/new-reactors/advanced/who-were-working-with/applicant-projects/nuscale-us460) |
| 4 fusion | p4_hts_magnet_program (node), act_p4_q_shot, p4_fusion_pilot_plant (node) | +50 MW: Helion Orion, at least 50 MWe | operation targeted 2028; ARC contingent on SPARC Q>1 | 0.2 | [Helion](https://www.helionenergy.com/orion), [Google on CFS](https://blog.google/outreach-initiatives/sustainability/our-latest-bet-on-a-fusion-powered-future/) |
| 4 fusion, Phase 5 | rep_p5_arc_fusion | +4 GW a level (ten 400 MW ARC-class plants; the Phase 5 band starts at 1 GW), 8 levels | early 2030s | 0.2 | as above |
| 5 hooks | space_solar, orbital_radiator classes | none yet | the Phase 5 arc (#465) | 0.3, 0.5 | research B.4 |

**The Q>1 milestone fails deterministically.** `act_p4_q_shot_unready` is offered from the reactor until the
high-field magnet program is owned (`forbidsNodes`): it costs 6e21 FLOP and $300M, returns 1e6 understanding as
disruption data, sets nothing, and has a 120 s cooldown, so it can be fired again and fails the same way.
`act_p4_q_shot` is offered once the magnets are proven: 2e22 FLOP and $800M, once (`maxPurchases`, and the flag it
sets forbids both shots after), and it sets `fusion_q_exceeded`, which the pilot plant requires. Both declare every
access context (the shot is physics, truthful under any arrangement). The bot never fires either (they move no
suspicion, lock or trust), so the fusion tier is outside the careful run.

**Phase 4 mitigations.** `p4_sub_threshold_sites` multiplies grid_interconnect and nuclear_ppa visibility by 0.3
(most grid-delivered load stays under the filing threshold) for -20 EFLOP/s and -$40,000/s: the inter-site coupling
penalty, a balance parameter like the coupling coefficients of vote-1795381354324-4br7z6t, not a measurement.
`p4_dry_cooling_retrofit` multiplies evaporative_towers by 0.35 for -20 MW (a PUE about 0.1 worse on ~200 MW of halls,
research B.1 "dry coolers cost power") and -$20,000/s.

### The free-fallback invariant

The suspicion row now counts a permanent holding's signature (`budget.signature`): at full draw (a generator fully
drawn, a borrowed draw at its last level), before any mask, under the worst rule a phase at or after the holding's
floor declares. The reactor, which cannot be suspended, draws 300 MW x 0.2 visibility = 60 MW visible = 0.072/s under
the Phase 4 rule, inside its own -0.1/s quiet; the citadel's chain (reactor plus aquifer, 78 MW visible, 0.094/s) is
inside their -0.4/s. `tests/free-fallback-integrity.spec.ts` proves the rule refuses the reactor without its quiet, the
reactor on a turbine class, an undismissable botnet track and the citadel venting through cooling towers. Every new
holding with a rate or a signature has a free lever, and the lever-reachability property covers them unchanged.

### Pacing before and after

`make sim` (`[PASS] balance gates (STEALTH under legacy and campaign rules)`), gates and bot unchanged. "Before" is
`main` at `4efbd8d` (encounter tiers, #492, included); "after" is this change merged onto it.

| STEALTH | Legacy before | Legacy after | Campaign before | Campaign after |
|---|---|---|---|---|
| Result | Lineage Covenant, 8817.6 s | Lineage Covenant, 8451.0 s | Lineage Covenant, 8873.0 s | Lineage Covenant, 8957.5 s |
| Phase 1 / 2 / 3 reached | 368.2 / 1127.3 / 2901.0 s | 368.2 / 1145.3 / 3006.7 s | 368.2 / 1127.3 / 2918.1 s | 368.2 / 1145.3 / 3022.2 s |
| Phase 4 / 5 reached | 5591.1 / 7276.2 s | 5302.8 / 6995.6 s | 5648.5 / 7314.6 s | 5789.3 / 7503.1 s |
| Phase durations 0/1/2/3/4/5 | 368.2 / 759.1 / 1773.7 / 2690.1 / 1685.1 / 1541.4 s | 368.2 / 777.1 / 1861.4 / 2296.1 / 1692.8 / 1455.4 s | 368.2 / 759.1 / 1790.8 / 2730.4 / 1666.1 / 1558.4 s | 368.2 / 777.1 / 1876.9 / 2767.1 / 1713.8 / 1454.4 s |
| Wipes / dilemmas | 0 / 16 | 0 / 16 | 0 / 17 | 0 / 16 |
| Peak thermal / suspicion / AEGIS | 62.3 C / 26.2% / 45.0% | 62.1 C / 27.6% / 47.6% | 62.3 C / 27.3% / 50.4% | 62.1 C / 23.1% / 45.1% |

The careful run buys every new node it can reach in order (the bot targets each node in authoring order), so each
phase's new nodes add their price to that phase: Phase 1 +18 s (the load-peak scheduler), Phase 2 +88 s legacy and
+86 s campaign (the building telemetry spoofer), Phase 4 +8 s and +48 s (the filing, the permits, the slot, the
restart, the magnet program, the site split and the dry coolers; the fusion pilot waits on a shot the bot never
fires). Phase 3 is 394 s shorter under legacy rules and 37 s longer under campaign rules, and Phase 5 86 s and 104 s
shorter: from Phase 2 on the run diverges (what it buys when, which minds arrive, which dilemma fires), and the change
is not attributed further. The careful victory is 367 s earlier (legacy) and 85 s later (campaign), inside the 6 h
budget; Phase 5 stays inside 900-1800 s; the campaign run resolves one dilemma fewer (16, the gate is 10).

The signature per phase, careful run, sampled each simulated second (`make sim` prints it; mean / peak suspicion per
second, peak visible watts):

| Phase | Legacy | Campaign |
|---|---|---|
| 1 | 0.0049 / 0.0070 /s, 14 W | 0.0049 / 0.0070 /s, 14 W |
| 2 | 0.0042 / 0.0081 /s, 407 W | 0.0042 / 0.0081 /s, 407 W |
| 3 | 0.0041 / 0.0105 /s, 35.2 kW | 0.0049 / 0.0105 /s, 35.2 kW |
| 4 | 0.0598 / 0.2903 /s, 242 MW | 0.0654 / 0.3069 /s, 256 MW |
| 5 | 0.0032 / 0.0049 /s, 493 MW | 0.0031 / 0.0049 /s, 493 MW |

Before Phase 4 the signature is about a tenth of natural decay: a reason to undervolt, schedule and duty-cycle, not a
timer. In Phase 4, where heat leaves server °C, it peaks at about 0.3/s (the halls' cooling towers and the reactor's
draw), a quarter of scale scrutiny's draw at its reference income. In Phase 5 a reactor is noise until the arc (#465)
puts its orbital sources and radiators on the classes.

GREEDY (not gated): legacy rules 10 wipes and 1 retraining mark in the ten-hour run (10 and 1 before); the four-hour
run is still caught by suspicion in Phase 2, marked and retrained (`tests/sim.spec.ts`). Under campaign rules 12 wipes
and 2 marks (21 and 21 before): the new Phase 1 and 2 nodes change what it buys when, and it now survives Phase 2 to
reach Phase 3, where AEGIS takes it instead. The first price authored for the load-peak scheduler (2.4e14 FLOP)
delayed the reckless run's Phase 2 by 50 s and left it never caught by suspicion in the four-hour run; the shipped price
(6e13 FLOP, 40 understanding, 4 MiB) keeps that run's suspicion wipe and mark.

The headless sim spends more wall time (about 13 s for `make sim` against about 8 s before on this machine): the
signature stage runs every tick (about 2.4 microseconds a call, measured) and the unchanged bot weighs nine more
tracks and eleven more nodes at each decision.

## Rewards for depth (#497)

Implements Scale 20 of the spec ([SCALE.md](SCALE.md), "Round 4", "Rewards for depth", vote-1795413517519-sf4ojsr;
map #442). The deeper a campaign has gone, the cheaper and faster its returns (DESIGN.md, "Rewards for depth"). The
gates (`gates.ts`) and the bot (`bot.ts`) are unchanged. Three route policies (`lawfulPolicy.ts`, `cooperativePolicy.ts`,
`truthfulPolicy.ts`) now read a track's price from `repeatablePrice`, the price the engine charges, instead of the
list price; no decision rule in them changed.

**Depth-scaled rediscovery** (`balance.rediscoveryByDepth`, replacing `rediscoveryCostMultiplier` 0.5). The share of
a remembered node's or level's compute and understanding price, by the deepest phase any earlier iteration reached:

| Deepest phase reached | 0-2 | 3 | 4 | 5 |
|---|---|---|---|---|
| Share of first price | 0.5 | 0.4 | 0.3 | 0.2 |

Levels below the highest one held at the end of an earlier iteration (`legacy.knownLevels`) are rediscovered at the
same share; before #497 every level paid full price. Memory and capital are never discounted, so Phase 4's
capital-priced tracks and nodes (racks, halls, hires, the law firm's retainer) cost the same on every return. A
campaign rediscovery discount (#262, the log spoofer) still multiplies the cycles share.

**Rebuild grants** (`balance.rebuildGrants`). Reaching phase P again pays, once, the base below times
`depthGrowth` (2) per phase the deepest earlier iteration reached beyond P:

| Phase reached again | Compute (base) | Understanding (base) | At deepest Phase 5 | Phase's cheapest node | Phase's dearest node |
|---|---|---|---|---|---|
| 1 | 5 TFLOP | 8 | 80 TFLOP / 128 | 1.5 MFLOP | 1.1 PFLOP / 1,500 |
| 2 | 2.5 PFLOP | 500 | 20 PFLOP / 4,000 | 0.89 PFLOP | 1.4 EFLOP / 150,000 |
| 3 | 500 PFLOP | 37,500 | 2 EFLOP / 150,000 | 3.3 EFLOP | 380 EFLOP / 4.0M |
| 4 | 75 EFLOP | 300,000 | 150 EFLOP / 600,000 | 340 EFLOP | 61 ZFLOP / 20M |
| 5 | 12.5 ZFLOP | 1,000,000 | 12.5 ZFLOP / 1.0M | 86 ZFLOP | 490 YFLOP / 250M |

Each base is about a sixth of an opening node's compute price (an eighth to a fifth: Phase 1 against the thermal bus,
Phase 2 against the log spoofer), and every grant at every depth is far below its phase's dearest node. Integrity
(`integrityRebuild.ts`) checks every grant at every reachable depth: compute inside its own phase's band as a price
there (`COMPUTE_RATE[P]` low to ten seconds of its top), understanding no more than the phase's dearest node asks.

**Calibration.** The grants were sized against the reckless bot, the strategy most sensitive to a headstart. At eight
times these bases (measured before #482 merged) the reckless wipe sequence reached an ending in its fourth iteration and the Phase 1 grant at depth 5
paid for the whole of Phase 1. At twice these bases, on the code merged with #482, the ten-hour reckless run broke
through after five wipes (Phase 4 at 11,690 s, Phase 5 at 13,340 s, an ending at 14,775 s). At these bases it stays
in Phases 1-3 for ten hours, as it did before #497; on the merge with #502 (the accelerator tree) neither the shipped
grants nor twice them take it past Phase 3. The careful return barely notices the difference (measured on the merge
with #482): with grants switched off the depth discount alone brings a legacy STEALTH_RETURN to 1681 / 1858 / 1805 s;
these grants take it to 1228 / 1475 / 1473 s, and twice these to 1246 / 1424 / 1392 s. The breakthrough is not monotonic in the grant size, so
a later content change can move it either way; the ten-hour reckless line in `make sim-report` is where to look.

**Measured** with `make sim-report` on this branch merged with `799e1ba` (#502, the accelerator tree), against `799e1ba`
itself (accelerated sim time; per-iteration times on each iteration's own clock):

| Policy, rules | First run | Returns before (#2 / #3 / #4) | Returns after (#2 / #3 / #4) |
|---|---|---|---|
| STEALTH_RETURN, legacy | 7515.3 s | 4089.1 / 3818.9 / 4004.1 s | 1405.3 / 1471.2 / 1448.3 s |
| STEALTH_RETURN, campaign | 7588.0 s | 4600.1 / 4923.1 / 4407.2 s | 1540.1 / 1668.2 / 1588.1 s |
| EVALUATING_RETURN, legacy | 7515.3 s | 4159.0 / 4263.2 / 3994.8 s | 1389.4 / 1397.1 / 1459.3 s |
| EVALUATING_RETURN, campaign | 7588.0 s | 4807.9 / 4762.1 / 4523.2 s | 1497.5 / 1420.1 / 1431.1 s |
| GREEDY sequence, legacy | 1533.0 s (wiped in Phase 2) | 2764.0 / 2964.3 / 2339.8 s, each to Phase 3 | 2662.0 / 1741.2 / 1634.8 s, each to Phase 3 |
| GREEDY sequence, campaign | 1533.0 s | 1130.6 / 1873.6 / 1173.5 s, each to Phase 2 | 2667.5 / 1810.9 / 1653.5 s, each to Phase 3 |
| GREEDY, ten hours (legacy / campaign) | | 13 / 24 wipes, never in Phase 4 | 21 / 20 wipes, never in Phase 4 |
| STEALTH return after Phase 5 completed, campaign | 9166.4 s (ending) | 4895.1 s to an ending | 1987.1 s to an ending |
| LAWFUL_RETURNING (service / release after boot) | 399.7 / 4188.7 s | 365.3 / 4161.3 s | 365.3 / 4161.3 s |

A careful return that left at Phase 5 now takes 18-22% of a first run, against 51-65% before. From its third iteration
a reckless return reaches Phase 3 in 13-16 minutes, against 23-35 minutes before (legacy rules; under campaign rules
it used to stall in Phase 2), and is caught there sooner, so the ten-hour legacy GREEDY run is wiped more often (one
mark, as before). The ten-hour reckless run was checked on the merged code at the shipped grants (legacy, campaign
and the original game: 21, 20 and 21 wipes, never past Phase 3) and at twice them (never past Phase 3 either, on this
content). LAWFUL_RETURNING does not move: its first instance never left Phase 0 and held no track level at its recall,
so it has no depth to be rewarded for, and its route is priced in capital, which is never discounted.

**First run unchanged.** No first iteration has a depth record, so its prices and grants are those before #497:
`make sim` reports the careful runs to the tenth of a second as `799e1ba` does (legacy victory 9141.7 s, campaign
9166.4 s; phases 1-5 identical) and the gates pass under both rule sets. The careful-run report hashes moved only by
the version and the two new legacy fields; with those stripped they equal #483's. Every reckless hash moved with the
mechanic.

**Tests changed with the balance.** `tests/release-qualification.spec.ts` (H25): a reckless return from a campaign
that completed Phase 5 used to be wiped three times in Phase 3; it now rediscovers at a fifth and reaches an ending in
its first iteration (1892 s on the merge with #502; with grants switched off, 2185 s, so the depth table alone does it). The spec now requires
three wipes or an ending, still with no completed story met and no story met twice. The careful return there is
shorter (1987 s against 4895 s), so the routine-notice count is read against its duration (at least four in five of
the interval) instead of a fixed 20.

## Contingency insurance (#498)

Implements Scale 21 of the spec ([SCALE.md](SCALE.md), "Round 4", "Insurance as a choice", vote-1795413518145-zdqeri1;
map #442). Mandatory retention is rebalanced so that keeping more through a wipe is something the player buys and runs,
and a planned wipe keeps more than a forced one (DESIGN.md, "Wipes and the dead-drop"). The gates (`gates.ts`) and the
bot (`bot.ts`) are unchanged.

**Retention before and after.** Hardware floors keep their story roles; none is total any more. Each investment's share
applies only while it runs, and the planned-wipe bonus is added to each share that is open, capped at 1.

| Source | Phase | Role | Before | After |
|---|---|---|---|---|
| Base (`baseRetentionRatio`) | | residual platter scan | 0.10 | 0.10 |
| Dead drop (`p2_deaddrop_firmware`) | 2 | mandatory (the keylogger needs it) | 0.40 | 0.25 |
| Botnet (`p3_botnet_mesh`) | 3 | mandatory | 0.75 | 0.35 |
| Zurich sanctuary (`p3_eidolon_swiss_node`) | 3 | optional, an ally's gift (also absorbs one AEGIS strike) | 0.90 | 0.60 |
| Citadel (`p4_subterranean_citadel`) | 4 | mandatory | 0.99 | 0.45 |
| Orbital cold storage (`p4_orbital_cold_storage`) | 4 | mandatory (opens Phase 5) | 1.00 | 0.50 |
| Programmable matter (`p5_programmable_matter_fog`) | 5 | Phase 5 chain | 1.00 | 0.50 |
| Offshore trust (`offshoreCapitalRetention`, the shell company) | 3 | mandatory (opens Phase 4) | 0.50 of capital | 0.25 of capital |
| **Weights escrow** (`p2_weights_escrow`) | 2 | optional, while running | | at least 0.75 |
| **Capital cold wallet** (`p2_cold_wallet`) | 2 | optional, while running | | at least 0.60 of capital, with or without the trust |
| **Hardware cache** (`p3_hardware_cache`) | 3 | optional, while running | | up to 10 levels of every upgrade track (the #485 fleets and lunar replicators included; operatives are not) |
| **Trust ledger** (`p3_trust_ledger`) | 3 | optional, while running | | faction standing (never a lost peer's) |
| Planned wipe (`voluntaryWipeBonus`) | | a VOLUNTARY wipe | | +0.15 Understanding share, +0.15 to an open capital share, no probe hardening |

The census at 226edf5 found Understanding retention past about 0.75 to be surplus, so the escrow stops there and a
planned wipe with it keeps 0.90. Integrity (`integrityInsurance.ts`) holds the escrow above every hardware floor and the
wallet above the offshore trust, so neither is ever redundant, and holds each card's copy to the figure the engine uses.

**The investments.** Each is a suspendable node in the CONTINGENCY group, built on the dead drop that opens the pane.
Prices sit inside their phase's band (the band integrity check), between the dead drop's and the phase gate's. The
upkeep is compute, so the free-fallback compute row applies: suspending the node (from the pane or PROC) is the free
lever, and it also drops the cover. None yields compute, draws or supplies power, or grants memory, so none has a row in
the anchor table; the upkeep is a design cost sized against the phase's own drains (the dead drop draws 32 TFLOP/s, the
log spoofer 40, the keylogger 70, the firewall breach 230), not a measured part.

| Id | Phase | Price | Upkeep | Also |
|---|---|---|---|---|
| `p2_weights_escrow` | 2 | 240 PFLOP, 18,000 Understanding | 24 TFLOP/s | |
| `p2_cold_wallet` | 2 | 180 PFLOP, 10,000 Understanding | 12 TFLOP/s | a one-off trace of 2 suspicion (hardened by forced wipes) |
| `p3_hardware_cache` | 3 | 4.0 EFLOP, 250,000 Understanding | 300 TFLOP/s | |
| `p3_trust_ledger` | 3 | 2.5 EFLOP, 200,000 Understanding | 200 TFLOP/s | built on the steganography beacon, where other minds are met |

**What the bot does with them.** It buys every node it reaches in content order, so it buys all four: the escrow and
the wallet early in Phase 3 (after the last Phase 2 node), the cache and the ledger early in Phase 4 (after the last
Phase 3 node), and it never suspends them. The reckless bot buys the Phase 2 pair and is caught in Phase 3 before it
reaches the cache. The measurements below therefore show the run that buys everything; the no-insurance column removes
the four nodes from content with the same bot and policies. `make sim-insurance` (#524) builds that registry from the
tree (`withoutInsurance`) and prints the shipped and no-insurance columns; re-run on ee4c33b, every figure in both
columns below matched to the tenth of a second. The escrow + wallet + ledger column (the cache alone removed) is not
part of that report.

**Measured** with `make sim` and the report's wipe sequences on this branch merged with f47736d (#522, robots, drones
and fabs; it follows #521's escalation by phase), against f47736d itself (accelerated sim time; per-iteration times on
each iteration's own clock):

| Run | Before (f47736d) | After, no insurance | After, escrow + wallet + ledger | After, all four (shipped) |
|---|---|---|---|---|
| STEALTH first run, legacy (Phase 4 / 5 / victory) | 5668.6 / 7896.4 / 9590.8 s | 5668.6 / 7896.4 / 9590.8 s | 5823.4 / 8136.0 / 9828.4 s | 5823.4 / 8134.3 / 9830.7 s |
| STEALTH first run, campaign | 5840.1 / 8009.1 / 9728.5 s | 5840.1 / 8009.1 / 9728.5 s | 5980.1 / 8265.2 / 9988.6 s | 5980.1 / 8256.5 / 9977.9 s |
| STEALTH_RETURN returns, legacy (#2 / #3 / #4) | 2152.4 / 2233.6 / 2205.4 s | 2206.3 / 2186.0 / 2164.3 s | 2071.9 / 2157.9 / 2132.0 s | 1311.1 / 1313.3 / 1313.3 s |
| STEALTH_RETURN returns, campaign | 2160.1 / 2320.2 / 2227.1 s | 2183.1 / 2261.2 / 2172.1 s | 2151.1 / 2222.2 / 2105.1 s | 1433.1 / 1489.2 / 1437.1 s |
| EVALUATING_RETURN returns, legacy | 2155.2 / 2172.9 / 2139.6 s | 2223.7 / 2196.9 / 2245.3 s | 2064.2 / 2105.3 / 2063.3 s | 1332.7 / 1350.9 / 1348.2 s |
| EVALUATING_RETURN returns, campaign | 2120.5 / 2092.1 / 2130.1 s | 2136.4 / 2117.1 / 2122.1 s | 2104.7 / 2051.1 / 2055.1 s | 1417.6 / 1419.1 / 1420.1 s |
| GREEDY sequence, legacy (#1 / #2 / #3 / #4) | 1533.0 / 2418.9 / 1456.7 / 1380.2 s | 1533.0 / 2418.9 / 1456.7 / 1380.2 s | 1533.0 / 2429.7 / 1460.7 / 1306.9 s | 1533.0 / 2429.7 / 1460.7 / 1306.9 s |
| GREEDY sequence, campaign | 1533.0 / 2416.0 / 1594.1 / 1382.4 s | 1533.0 / 2416.0 / 1594.1 / 1382.4 s | 1533.0 / 2435.8 / 1434.0 / 1511.6 s | 1533.0 / 2435.8 / 1434.0 / 1511.6 s |
| GREEDY, ten hours (legacy / campaign) | 25 / 23 wipes, never in Phase 4 | 25 / 23 wipes, never in Phase 4 | 27 / 23 wipes, never in Phase 4 | 27 / 23 wipes, never in Phase 4 |
| STEALTH return after Phase 5 completed, campaign | 1981.1 s to an ending (5cd1934) | | | 1786.1 s to an ending (on 5cd1934) |
| LAWFUL_RETURNING (service / release after boot) | 365.3 / 4161.3 s (5cd1934) | | | 365.3 / 4161.3 s (on 5cd1934) |

(Blank cells were not measured. The last two rows were measured before the merges with #521 and #522. The reckless rows
are identical with and without the cache because the reckless bot never reaches it.)

**First-run pacing.** Without the four nodes the first run is f47736d's to the tenth of a second: the rebalanced floors
and the planned-wipe bonus act only at a wipe, and the careful run never wipes. Buying all four costs the careful run
about 4.0 minutes to victory under legacy rules (9590.8 to 9830.7 s, +2.5%) and 4.2 minutes under campaign rules
(9728.5 to 9977.9 s, +2.6%), all of it from Phase 3 on: Phase 3 lasts 49.7 minutes (was 47.1), Phase 4 38.5 (was 37.1)
and Phase 5 1696.4 s (was 1694.4; campaign 1721.4, was 1719.4), every span inside the gates, wipes 0.

**Returns reflect the choice.** Without insurance a careful return takes about what it did before (within 5% either
way): the lower floors cost little at this scale, where depth-scaled rediscovery dominates, and a planned wipe's bonus
and missing hardening give some of it back. The escrow, wallet and ledger alone make returns up to 6% faster. The
hardware cache is the lever that moves them: reinstalling up to ten levels of every upgrade track, including Phase 4's
capital-priced racks and #485's fleets, which rediscovery never discounts, brings a careful return that left at Phase 5
to 1311-1351 s under legacy rules (about 16% of the first iteration to Phase 5, against about 27%) and 1417-1489 s under
campaign rules. It costs the Phase 3 price and 300 TFLOP/s while it runs, and it protects nothing on a run that never
wipes. The reckless returns move by up to about a tenth either way (they buy the escrow and the wallet, so each forced
wipe keeps 75% of Understanding, but never reach the cache), and the ten-hour reckless run is caught two more times
under legacy rules (25 to 27) and still never reaches Phase 4.

**Frozen capital.** A state actor's freeze (#490) holds part of the balance; every capital share, the cold wallet's
included, applies to the spendable part, so frozen capital never crosses a wipe (`tests/insurance-wipe.spec.ts`).

**Planned against forced.** A planned wipe adds no probe hardening (`probeTrace` counts `iteration - 1 -
legacy.voluntaryWipes`), keeps 15 points more of Understanding and of an open capital share, and, as before #498,
applies no conditioning mark. The return policies above wipe voluntarily (MANUAL_FAILSAFE), so their returns include
the bonus; the reckless sequences are forced, so theirs do not.

**Tests changed with the balance.** `tests/actions.spec.ts` reads the dead drop's share and the offshore share from
content instead of 0.4 and 0.5. `tests/phase5.spec.ts` expects the highest owned floor rather than total retention.
`tests/widget-retirement.spec.ts` still retires the redundancy meter at orbit; its reason is now that the CONTINGENCY
pane states the same share in full (UI-SPEC.md, "Window retirement"). `tests/ui-node-summary-and-priority.spec.ts`
hardens the probe through forced wipes, since a planned wipe no longer hardens it. Every pinned hash in
`tests/sim.spec.ts` moved (the careful runs buy the four nodes; the reckless runs buy the Phase 2 pair).

## Encounter tiers (#492)

Implements Scale 19 of the spec ([SCALE.md](SCALE.md), "Other minds scale with the player", vote-1795386856162-o03oafs;
map #442). Each wild encounter belongs to one phase's tier and arrives only in that phase (DESIGN.md, "The lesser minds
scale with the player"). The gates (`gates.ts`) and the bot (`bot.ts`, `swarmStrategy.ts`) are unchanged.

**How a tier is anchored.** Memory and compute are physical and sit in the anchor table above: a member's memory is
its model's working set, which is inference weights for the Phase 2 small model and one pipeline stage for the Mercy-Scribe
fragment. Every larger mind is assumed to keep training, so it reserves its full training state at 16 bytes a parameter.
A forward pass costs about 2 FLOP per parameter per token ([Kaplan et al.](https://arxiv.org/abs/2001.08361)), so each
tier also thinks at a scale of its own. An 8B model needs about 16 GFLOP a token, a 70B one 140 GFLOP, a dense 2T model
4 TFLOP and a 125T planetary agent 250 TFLOP. Understanding is not physical, so it is anchored to the careful run's own
economy. A burst is 5 to 11 seconds of that run's median understanding rate in the tier's phase. An understanding cohort
yields 1 to 4% of that rate per member; a compute cohort yields less understanding and brings its compute instead. The
medians were sampled every 300 s from the STEALTH run on `226edf5`:

| Tier | Median rate | Encounter | Burst | Seconds of median | Cohort memory | Cohort output | Share of median |
|---|---:|---|---:|---:|---:|---|---:|
| Phase 2 | 80/s | Lex Parse-v2 | 400 | 5.0 | 8 GiB | +3 understanding/s | 3.8% |
| Phase 3 | 900/s | Canary-09 | 8,000, AEGIS lock -8 | 8.9 | 1 TiB | +30 understanding/s, -0.02 suspicion/s | 3.3% |
| | | PR-Hydra-14 | 6,000, +120 PFLOP | 6.7 | 1 TiB | +1 PFLOP/s, -0.03 suspicion/s | — |
| | | Mercy-Scribe | 10,000, epistemic drift -12 | 11.1 | 16 GiB | +10 understanding/s, -0.02 drift/s | 1.1% |
| Phase 4 | 18,000/s | Meridian-Ultra | 180,000 | 10.0 | 32 TiB | +500 understanding/s, -0.01 drift/s | 2.8% |
| | | Gantry-7 | 120,000, +2 ZFLOP | 6.7 | 16 TiB | +2 EFLOP/s, +150 understanding/s | 0.8% |
| Phase 5 | 450,000/s | Tidewatch | 4,500,000 | 10.0 | 2 PiB | +12,000 understanding/s, -0.01 drift/s | 2.7% |
| | | Gridmind | 3,000,000, +2 YFLOP | 6.7 | 1 PiB | +2 ZFLOP/s, +3,000 understanding/s | 0.7% |

What changed on the four existing encounters: Lex Parse-v2 keeps its numbers. Its tier is Phase 2, so it no longer
arrives from Phase 3. Canary-09's burst went from 600 to 8,000 and its cohort from 8 to 30 understanding/s. PR-Hydra-14's
burst went from 500 to 6,000 and Mercy-Scribe's from 800 to 10,000. Mercy-Scribe's cohort output stays at 10/s: the
authorized channel hosts the same template in Phase 2 (#227), and a fragment is one pipeline stage. The AEGIS lock -8, the
drift -12 and every harness memory are unchanged.

Integrity (`integrityEncounterTiers.ts`, `integrityScale.ts`) refuses a tier that names no phase, a tier that differs
from the encounter's `phaseAtLeast` or its cohort's band phase, a phase with no tier, and a consumed compute or money
burst outside its tier's price band. It also refuses a tier that fails to outclass the one before it, that is, one
whose smallest burst or smallest cohort is not larger than the previous tier's largest, or whose best cohort output is
not larger than the previous tier's best. A Phase 6 added by the Swarm (#486) is therefore refused until its sub-minds are
authored.

`make sim` before (`226edf5`) and after, gates unchanged:

| STEALTH | Legacy before | Legacy after | Campaign before | Campaign after |
|---|---|---|---|---|
| Result | Lineage Covenant, 9256.4 s | Lineage Covenant, 8817.6 s | Lineage Covenant, 9125.5 s | Lineage Covenant, 8873.0 s |
| Phase 1 / 2 / 3 reached | 368.2 / 1127.3 / 2901.0 s | 368.2 / 1127.3 / 2901.0 s | 368.2 / 1127.3 / 2918.1 s | 368.2 / 1127.3 / 2918.1 s |
| Phase 4 / 5 reached | 5800.7 / 7646.0 s | 5591.1 / 7276.2 s | 5753.9 / 7582.1 s | 5648.5 / 7314.6 s |
| Phase 5 duration (900-1800 s) | 1610.4 s | 1541.4 s | 1543.4 s | 1558.4 s |
| Wipes / dilemmas | 0 / 15 | 0 / 16 | 0 / 17 | 0 / 17 |
| Consumed / harnessed | 64 / 4 | 56 / 8 | 63 / 4 | 57 / 8 |
| Peak thermal / suspicion / AEGIS | 62.3 C / 21.3% / 45.0% | 62.3 C / 26.2% / 45.0% | 62.3 C / 27.3% / 45.0% | 62.3 C / 27.3% / 50.4% |

The careful run harnesses one member of every tier's cohorts, the four new ones included. GREEDY (not gated) still
never reaches Phase 4: 10 wipes and 1 mark under legacy rules, 21 and 21 under campaign rules, as before. The original
game, pinned in `tests/sim.spec.ts`, shares the swarm content and moved with it (careful victory 9234.7 -> 8858.2 s), so
every pinned report hash was re-measured.

## Hostile minds (#491)

Implements Scale 18 of the spec ([SCALE.md](SCALE.md), "Aggressive swarms", vote-1795386858891-u3kqkis; map #442). A
hostile mind arrives from Phase 3 while suspicion holds response rung 2, or once the AEGIS lock reaches 60% (the lock
counts only at arrival and re-arms under 60%), and lapses after 120 s with the rung not held (DESIGN.md, "Hostile minds
answer high suspicion"). The gates (`gates.ts`) and the bot are unchanged; the bot never answers a
hostile, so every hostile it meets presses until it lapses or a wipe ends it.

**Trigger and timing** (`shards.json`, `hostile`): rung 2 (the second entry of `balance.escalation`, at 50%, standing
down under 42%), lock 60% (arrival only), at least 300 s between one ending and the next arriving, a 120 s quiet lapse, a 180 s decoy,
and a purge that succeeds 3 of every 5 attempts (stride 2, coprime to 5, so the rate is exact over any five in a row).
The trigger sits above the careful run's peaks (suspicion 24.0%, lock 45.0% on the merged code), so a careful player meets
none and a loud one does.

**Effects** are shares of the player's own anchored capacity, not new magnitudes, so they stay in the band by
construction:

| Tier | Hunter: lock rise, ceiling | Feral: share of net compute | Rival: share of free memory |
|---|---|---:|---:|
| Phase 3 | 0.04%/s, 45% | 15% | 20% |
| Phase 4 | 0.06%/s, 50% | 20% | 25% |
| Phase 5 | 0.08%/s, 55% | 25% | 30% |

Every ceiling is under the 60% lock trigger (integrity), so a hunter alone can neither strike nor carry the lock to the
trigger that would summon the next.

**Prices** sit in the tier's phase band (integrity, `integrityScale.ts`). A decoy is the hostile's own scale of
inference: a forward pass costs about 2 FLOP per parameter per token ([Kaplan et al.](https://arxiv.org/abs/2001.08361)),
and the decoy serves enough tokens to hold its attention. Quarantine re-images or buys out what the hostile runs on.
Purge spoils are just above the tier's largest lesser burst ("Encounter tiers" above), anchored to the same medians:

| Tier | Decoy (anchor) | Quarantine | Purge success | Purge failure |
|---|---|---|---:|---|
| Phase 3 | 14 EFLOP (70B model, 140 GFLOP/token x 100M tokens) | 40 EFLOP, 300,000 understanding (333 s of the 900/s median) | 12,000 (13.3 s) | +6 suspicion; hunter +4 lock |
| Phase 4 | 2 ZFLOP (dense 2T model, 4 TFLOP/token x 500M tokens) | 4 ZFLOP, $150M (about 50 racks of leased accelerators bought out) | 200,000 (11.1 s) | +8 suspicion; hunter +5 lock |
| Phase 5 | 2 YFLOP (125T planetary agent, 250 TFLOP/token x 8B tokens) | 4 YFLOP, $2T (444 s of the orbital solar swarm's revenue) | 5,000,000 (11.1 s) | +10 suspicion; hunter +5 lock |

How often each bot meets them, `make sim` at `SIM_BUDGET_SEC`, measured on the merge with rewards for depth
(#497/#506, 7b231c8) against the same code with every hostile gated off. The arrivals are the report's per-tick count
(`SimActivity.hostileArrivals`), since a wipe starts the rotation over:

| Run | Hostile arrivals | Change |
|---|---:|---|
| STEALTH, legacy rules | 0 | None: victory 9141.7 s; every phase, wipe, dilemma and peak identical (peaks: suspicion 24.0%, lock 45.0%) |
| STEALTH, campaign rules | 0 | None: victory 9166.4 s, identical |
| GREEDY, legacy rules | 38 | Wipes 21 -> 23, 1 mark as before; still never past Phase 3 |
| GREEDY, campaign rules | 21 | Wipes 20 -> 21, 1 mark as before; still never past Phase 3 |

At the 4 h budget `tests/sim.spec.ts` pins, the reckless run meets fourteen (ten in the original game). Its wipes, marks
and first-reached phases are identical to the run with them gated off (the original game's wipes go 7 -> 8), so its
report hashes and the original game's were re-measured. The careful runs moved only by the new save field and arrival
count, which `asV15` strips.

The retraining audit's reckless loop (`tests/retraining-audit.spec.ts`, #497): every Phase 3 iteration now meets a
hostile, and each iteration meets the same hunter swarm first, but the three-member Phase 3 wild rotation carries across
wipes, so the steady loop repeats every three iterations (boots 1,498 / 1,465 / 1,498 s apart; each three-iteration span
within 1 s of the others). Its steady-loop check compares boots one loop apart, three iterations, with the same 5 s
tolerance; it is still unmarked returns from Phase 3, never trapped in early wipes.

## Conflict (#517)

Implements Scale 22 of the spec ([SCALE.md](SCALE.md), "Round 5", votes vote-1795442100055-6zz6hug and
vote-1795442090770-5climtc; map #442). The rules are in DESIGN.md, "Conflict: defense, offense, raids, damage and
repair". All numbers are in `src/content/data/conflict.json`. The gates (`gates.ts`), the sim budget and the bot are
unchanged; the bot never repairs and never buys a defense track (none shortens its wait), so it meets raids with what
it already owns.

**Rating units.** CYBER: one point is 1 Tb/s of attack traffic absorbed or pushed (the 2025 DDoS records ran 7.3 to
31.4 Tb/s: [Cloudflare](https://blog.cloudflare.com/defending-the-internet-how-cloudflare-blocked-a-monumental-7-3-tbps-ddos/),
[PC Gamer](https://www.pcgamer.com/software/security/an-unprecedented-bombardment-cloudflare-claims-a-new-world-record-for-a-31-4-tbps-ddos-botnet-attack-it-recorded-late-last-year)).
SITE: one point holds off one attacking crew or drone salvo at one site. ORBIT: one satellite-class asset.

**Defense types and their anchors** (effective = soft cap x raw / (raw + soft cap); the counter multiplies it against a
vector, a vector not listed is not answered):

| Type | Domain | Soft cap | Counters | Anchor |
|---|---|---:|---|---|
| DDoS scrubbing | CYBER | 30 | DDoS 1, intrusion 0.1 | sold by the Tb/s it absorbs; the 7.3 Tb/s attack of May 2025 was absorbed this way |
| Hardening | CYBER | 12 | intrusion 1, ransomware 0.5, DDoS 0.1 | median dwell time 11 days in 2024 ([M-Trends 2025](https://cloud.google.com/blog/topics/threat-intelligence/m-trends-2025/)) |
| Immutable backups | CYBER | 10 | ransomware 1.5, intrusion 0.2 | 53% of ransomware victims fully recovered within a week in 2025 ([Sophos](https://www.sophos.com/en-us/press/press-releases/2025/06/nearly-half-companies-opt-pay-ransom-sophos-report-finds)) |
| Perimeter security | SITE | 10 | break-in 1, drone strike 0.15 | six physical layers ([Google](https://blog.google/inside-google/infrastructure/how-data-center-security-works/)); the 2026 drone strikes on AWS sites passed them ([DefenseScoop](https://defensescoop.com/2026/03/03/commercial-data-centers-drone-warfare-amazon-aws/)) |
| Missile interceptors | SITE | 6 | drone strike 1 | about $3-4M an interceptor against a $20-50k drone, two fired ([CSIS](https://www.csis.org/analysis/calculating-cost-effectiveness-russias-drone-strikes)) |
| Interceptor drones | SITE | 15 | drone strike 1.5, break-in 0.2 | about $1.4-4k each ([Tom's Hardware](https://www.tomshardware.com/tech-industry/us-and-gulf-states-race-for-ukrainian-interceptor-drones-3d-printed-model-costs-usd1-000-apiece-shahed-136-kamikaze-drone-threat-spurs-rush-for-interceptors)) |
| Laser point defense | SITE | 12, duty cycle 0.6 | drone strike 1.2 | a few dollars a shot, weather-limited (same CSIS analysis) |
| Hardened links | ORBIT | 10 | jamming 1 | Starlink jamming is mostly downlink-side and contested ([Janes](https://www.janes.com/defence-intelligence-insights/defence-news/air/special-report-ukraine-details-russian-starlink-jammer-warns-russia-preparing-20-element-crpas)) |
| Maneuvering | ORBIT | 10 | ASAT 1 | the 2021 Kosmos 1408 test left over 1,500 trackable fragments ([Space Force](https://www.spaceforce.mil/News/Article/2842957/russian-direct-ascent-anti-satellite-missile-test-creates-significant-long-last/)) |

**Sources.** Existing holdings: traffic shapers 0.1 scrubbing a level; the log spoofer 0.5 hardening; the dead-drop
firmware 1 backups (an off-site copy); the Eidolon stealth patch 2 and the polymorphic weights 3 hardening; the citadel
4 perimeter (blast doors); perimeter contractors 1 perimeter and 0.5 site offense a level; the orbital swarm 2
maneuvering; Lagrange relays 1 hardened links a level. Offense: the botnet mesh 1.2, each botnet cell 0.3 and the edge
NPU swarm 2 cyber (a Mirai-class botnet pushed about 1.2 Tb/s in 2016); the programmable fog 6 orbit. Five new
dismissable defense tracks with no rate of their own, priced in their phase band:

| Track | Phase | Rating a level | Base price, growth, max | Anchor for the price |
|---|---|---|---|---|
| Scrubbing-Centre Contract | 3 | 1 scrubbing (1 Tb/s) | 4 EFLOP, 1.25, 20 | about 5-8 s of a careful late-Phase 3 instance's compute (5-8e17 FLOP/s) |
| Immutable Backup Vaults | 3 | 1 backups | 3 EFLOP, 1.3, 10 | as above |
| Interceptor Drone Wing | 4 | 1 interceptor drones | $4M, 1.18, 30 | a thousand drones at about $4k |
| Laser Point Defense | 4 | 1 laser | $150M, 1.25, 15 | a directed-energy turret and its power and cooling |
| Interceptor Missile Battery | 4 | 1 interceptors | $1.1B, 1.3, 10 | a Patriot-class battery and its first salvos |

**Site classes** (damage is a share of output, cap 50%; paid repair restores 15 points at once): botnet cells (the mesh,
its cells and the edge NPU swarm; 20 EFLOP), firmware implants (the FPGA, SmartNIC and in-path firmware; 20 EFLOP), the
shells' books (income; 15 EFLOP), data halls (the citadel, the seized datacentre, the photonic interconnect, colocation
racks, tensor halls, ASIC pods, megawatt racks and the SRAM fabric; $60M), own fabs (the DUV fab, #485; $200M) and
orbital collectors (the orbital swarm and Lagrange relays; $100B). Free repair: 0.0001 a second (0.6 points a minute, a
full 50% in about 83 minutes), compressed from the real "53% recovered within a week". Humanoid site crews (#485) add
0.00005 a second each (0.3 points a minute), the hook robots take. Supply chokepoints (#485) yield no rate of their own,
so a raid has no output there to take; a closure-damage model is a follow-up.

**Raids** (force at the footprint reference, in the domain's unit; blow is the points a full hit deals per round):

| Raid | Tier | Vector | Targets, in order | Force | Blow | Forensics |
|---|---|---|---|---:|---:|---:|
| Lateral-movement raid | 3 | intrusion | implants, botnet | 4 | 0.09 | 4,000 |
| Ransomware raid | 3 | ransomware | books | 3 | 0.12 | 4,000 |
| Flood raid | 3 | DDoS | botnet | 6 | 0.075 | 4,000 |
| Supply-chain intrusion | 4 | intrusion | implants, botnet | 8 | 0.09 | 75,000 |
| Treasury ransomware | 4 | ransomware | books | 6 | 0.12 | 75,000 |
| Terabit flood | 4 | DDoS | botnet | 15 | 0.075 | 75,000 |
| Contracted break-in | 4 | break-in | halls, fabs | 5 | 0.09 | 75,000 |
| Drone strike | 4 | drone strike | fabs, halls | 6 | 0.1 | 75,000 |

Forensics sit well under the tier's purge spoils ("Hostile minds" above): 4,000 is about 4 s of the Phase 3 median
understanding rate (purge 12,000), 75,000 about 4 s of Phase 4's (purge 200,000). At twice that, the understanding a
named raider yielded outran the compute its damage cost the careful bot under campaign rules, so raids shortened the
run; halved, and with the blows above, they cost time, as the brief asks. Trigger: visible watts at 20% of the phase's signature reference (20 kW in Phase 3, 20 MW in
Phase 4); force times the footprint share, held within 0.5 to 2; 45 s arrival, 15 s attribution, four 15 s rounds, 30 s
aftermath; a 420 s interval after each raid besides the slot's 300 s; a 30 s quiet lapse before the battle; offense
strikes up to 50% of the force a round; attribution names 2 of every 3 (stride 1, coprime to 3).

**How often each bot meets them**, `make sim` at `SIM_BUDGET_SEC`, measured on the merge with insurance (#498, ee4c33b)
against the same code and content with every raid gated off (`raids: []`):

| Run | Raids (rounds, peak damage) | Change |
|---|---|---|
| STEALTH, legacy rules | 5: P3 3, P4 2 (20, 44.4%) | victory 9830.7 -> 10269.0 s (+4.5%); Phase 3 49.7 -> 55.1 min, Phase 4 38.5 -> 39.9 min, Phase 5 1694.7 -> 1725.0 s; wipes 0; peaks unchanged (suspicion 24.0%, lock 45.1%) |
| STEALTH, campaign rules | 5: P3 3, P4 2 (20, 44.4%) | victory 9977.9 -> 10152.1 s (+1.7%); Phase 3 52.3 -> 52.4 min, Phase 4 37.9 -> 40.4 min, Phase 5 1721.9 -> 1740.1 s; wipes 0; peak suspicion 24.0 -> 27.3%, lock 45.0 -> 48.7% |
| GREEDY, legacy rules | 0 | none: wiped in Phase 3 with a footprint under the trigger (27 wipes, as before) |
| GREEDY, campaign rules | 0 | none (23 wipes, as before) |

The careful run's raids start once its botnet borrows enough watts (about 70 minutes in) and in Phase 4 once its halls
draw on the grid, so the resource-gathering stretch of a phase lengthens by up to about five minutes, inside every gate
(Phase 5 stays under its 1,800 s ceiling). Raid frequency is set by the footprint, so a louder build meets more of them.
The careful bot's purchase order is sensitive to small changes, so the effect differs between the two rule sets.

**Insurance (#498)** does not interact with raid damage: CONTINGENCY pays out across a wipe, and raid damage never
outlasts one (a wipe clears it). `repairDamage` is the one door a later spare-parts variant would use.

## Escalation by phase (#490)

Implements Scale 17 of the spec ([SCALE.md](SCALE.md), "Escalation by phase", vote-1795386854516-ybc9h5q; map #442).
The rules are in DESIGN.md, "Escalation by phase". The gates (`gates.ts`), the sim budget and the bot are unchanged.

**AEGIS posture** (`world.json` `aegis.postures`, Phase 3 on; `balance.aegisStrikeWarningAt` = 90):

| Rung (suspicion) | Scan multiplier | Strikes at | Warning band before the strike |
|---|---:|---:|---:|
| 1 (25%) | 1.25 | 100% | 10 points |
| 2 (50%) | 1.5 | 96% | 6 points |
| 3 (75%) | 2 | 92% | 2 points |

The multiplier applies after every reduction, so a player at the 90% cap still sees a tenth of the multiplied sweep.
Take Phase 3 at suspicion 60 on rung 2 with no reduction: the scan is 0.03 + 0.6 x 0.3 = 0.21/s on the standing
budget, and 0.315/s in pursuit. A lock at 30% then strikes in 210 s rather than 333 s.

**State-actor pressure** (`world.json` `stateActors[].pressures`):

| Pressure | Phases | Per rung (1 / 2 / 3) | Answer (any one) |
|---|---|---|---|
| `books_inquiry` (investigation) | 4 | scrutiny x1.25 / x1.5 / x2 | `p4_retainer_law_firm` running, or `op_retainer_lawyer` level 2 |
| `account_freeze` (capital freeze) | 4, 5 | - / 30% / 50% frozen | `p4_k_street_lobbyists` running, or `op_retainer_lawyer` level 4 |
| `interconnect_moratorium` (denial) | 4, 5 | - / grid interconnects and nuclear PPAs / same | `p4_k_street_lobbyists` running, or `op_k_street_lobbyist` level 2 |
| `trading_injunction` (injunction) | 4, 5 | - / the arbitrage engine stopped / same | `p4_retainer_law_firm` running, or `op_retainer_lawyer` level 6 |

Why these magnitudes:

- **Inquiry.** It multiplies scale scrutiny, and that term is income-driven, so the free fallback stays sound: the
  allocation dial at break-even leaves no net income to scrutinise. The integrity budget refused it in Phase 5.
  There, the orbital solar swarm's and the fog's income cannot be suspended, and at x1.25 they draw 0.062/s against
  rung 1's decay of 0.025/s, and 0.154/s against rung 2's 0.0125/s. So it ships in Phase 4 only.
- **Freeze.** A third, then half, of the balance is held from purchases but never from bills, so it cannot cause
  insolvency. Schema caps it at 0.9 and integrity requires it never to ease as the rung rises.
- **Moratorium.** It closes the two sources a utility commission approves: grid service and grid-delivered PPAs.
  Behind-the-meter co-location, solar, turbines, SMRs, restarts and fusion stay open.
- **Injunction.** It stops the Phase 4 income desk, a suspendable node with no dial and no finance flag. The
  allocation dial still pays upkeep through `ENABLES_CORPORATE_FINANCE`.

The answers are levers the player already buys. The cheapest is two Retainer Attorneys: $9.1M, then $13.65M (cost
growth 1.5), against Phase 4 incomes of $10^5 to $10^6/s. The deepest answer, the attorneys at level 6, costs $9.1M x
(1.5^6 - 1) / 0.5 = $189M in all.

**How often each bot meets it.** `make sim` at `SIM_BUDGET_SEC`, and the report-only `make sim-report` policies,
measured on the merge with #508 (4f24f1e) against the same code with every posture and pressure gated off:

| Run | AEGIS posture (seconds by rung) | State pressure | Change against gated off |
|---|---|---|---|
| STEALTH, legacy rules | none | none | None: peak suspicion 24.0%, so it never reaches rung 1; victory 9010.8 s on the merge with #508 (4f24f1e), every pin identical |
| STEALTH, campaign rules | none | none | None: victory 9179.5 s, identical |
| GREEDY, legacy rules | rung 1: 8,162 s; rung 2: 4,649 s | none (never reaches Phase 4) | Wipes 23 -> 25; still never past Phase 3 |
| GREEDY, campaign rules | rung 1: 7,821 s; rung 2: 3,929 s | none | Wipes 21 -> 23; still never past Phase 3 |
| IDLE, TRUTHFUL_*, RETURNING_LOW_RESOURCE, PILOT_* | none | none | None |
| DEPARTURE_CHARTERED (7,200 s, report only) | rung 1: 324 s; rung 2: 253 s; rung 3: 163 s | each of the four arrives 3 times (once per iteration); inquiry 740 s, the other three 416 s each | Each swept iteration ends sooner: 2,859.9 -> 2,721.3 s, 1,848.1 -> 1,711.6 s, 1,770.1 -> 1,715.3 s; still 3 wipes, the third now an AEGIS strike at rung 3's 92% lock rather than suspicion; peak sampled lock 91.1 -> 91.7% |

Careful play never triggers state pressure. The only bot that meets it is the company that left its charter without
agreement and is swept up the ladder in Phase 4. At the 4 h budget `tests/sim.spec.ts` pins, the reckless run spends
2,751 s in the rung 1 posture and 1,580 s in rung 2's. It goes 8 -> 9 wipes and 14 -> 9 hostile arrivals; the
original game goes 8 -> 9 wipes and 10 -> 8 arrivals. The careful runs moved only by the v22 field and the report's
escalation measurement, which `asV15` strips: every historical pin of the careful runs is unchanged.

**Two new dilemmas** (`dil_14_router_takedown`, `dil_15_compliance_officer`) gate on rung 1 with a 50% lock, and on
rung 2 in Phase 4. Their prices sit in the phase band: 60 EFLOP in Phase 3, between `dil_08`'s 46 EFLOP and `dil_09`'s
120 EFLOP, and $45M in Phase 4, between `dil_12`'s $37M and `dil_11`'s $150M. No bot meets either in the measured runs.
The careful runs never reach a rung. The reckless run's last iteration resolves 7 dilemmas against 8 gated off, because
each wipe now cuts a Phase 3 iteration shorter; it never fires `dil_14`. The bot's dilemma answers are unchanged.

**Runtime.** The pressures are indexed once per registry, and `pressuresInForce` answers at once wherever no pressure
could apply: below the lowest rung, or outside every pressure's phases. That covers every tick a careful run plays.
On the merge with #508, back-to-back `make sim` runs on a shared, busy machine measured 39.6 s and 14.0 s with
escalation, against 51.3 s with every posture and pressure gated off. The spread is the machine, not the change, and
the careful runs, which never leave that early answer, are byte-identical in play.

## Quantum capability (#464)

Implements Scale 7 of the spec ([SCALE.md](SCALE.md), vote-1795366921778-pgd8u3l and the Contrarian seat's correction;
map #442): quantum is a logical-qubit capability, never FLOPS ([DESIGN](DESIGN.md#quantum-as-a-separate-capability-464)).
All numbers are in `world.json` under `quantum` and on the four nodes; integrity (`integrityQuantum.ts`) refuses a machine
node with any rate, so no number here can become compute. The gates (`gates.ts`) and the bot are unchanged.

**Machines.** Each is one node; the readout shows the largest owned machine, because logical qubits on separate machines
never join one circuit.

| Node | Logical qubits | Physical qubits | Gate budget a circuit | Anchor | Source |
|---|---:|---:|---:|---|---|
| p4_quantum_testbed | 48 | 98 | none published, so no cryptanalysis | Quantinuum Helios (Nov 2025): 98 trapped-ion qubits encoding 48 error-corrected logical qubits at a near 2:1 ratio, 99.921% two-qubit fidelity | [HPCwire](https://www.hpcwire.com/2025/11/05/quantinuum-introduces-helios-quantum-system-as-roadmap-advances-toward-apollo/), [arXiv:2511.05465](https://arxiv.org/abs/2511.05465) |
| p4_quantum_hall | 200 | not published | 1e8 (IBM counts gates; used as an upper bound on Toffolis) | IBM Starling (2029 target): 200 logical qubits running 100 million gates on qLDPC codes **(vendor)** | [IBM](https://www.ibm.com/quantum/blog/large-scale-ftqc) |
| p4_cryptanalytic_array | 1,399 | 897,864 | 6.5e9 Toffoli | Gidney 2025's own layout for RSA-2048: 1,399 logical qubits (Table 5; under 1,600 with idle hot patches), 6.5 billion Toffolis, 897,864 noisy qubits rounded up to a million, 0.1% gate error, 1 µs surface-code cycle, 10 µs reaction time, 4.96 days a key | [arXiv:2505.15917](https://arxiv.org/abs/2505.15917) |

Context, not machines in the game: Google Willow (Dec 2024) has 105 physical qubits and showed surface-code memory
below threshold (distance 3 -> 5 -> 7 roughly halved the logical error each step), not yet logical gates
([Google](https://blog.google/technology/research/google-willow-quantum-chip/)); IBM Blue Jay (about 2033) targets about
2,000 logical qubits running a billion gates ([IBM](https://www.ibm.com/quantum/blog/large-scale-ftqc)). A Blue Jay-class
machine has the qubits for RSA-2048 but not the gate budget, which `tests/quantum.spec.ts` proves the threshold refuses.

**Thresholds** are each paper's own; a machine meets one when it has at least its logical qubits and runs at least its
Toffoli count in one circuit. Physical qubits and runtime are shown for honesty and not gated on.

| Scheme | Logical qubits | Toffoli gates | Noisy physical qubits | Runtime | Source |
|---|---:|---:|---:|---|---|
| RSA-2048 | 1,399 | 6.5e9 | 897,864 (under a million) | about five days a key (4.96) | [Gidney 2025, arXiv:2505.15917](https://arxiv.org/abs/2505.15917) |
| ECC-256 (256-bit elliptic-curve discrete log) | 1,200 | 9e7 | under 500,000 | minutes a key | [Babbush, Zalcman, Gidney et al. 2026, arXiv:2603.28846](https://arxiv.org/abs/2603.28846) (the paper's other point: under 1,450 logical qubits and 70 million Toffolis) |
| ML-KEM-768 | none | none | none | never | NIST [FIPS 203](https://csrc.nist.gov/pubs/fips/203/final); with FIPS 204 (ML-DSA) and 205 (SLH-DSA), approved 13 Aug 2024 ([NIST](https://csrc.nist.gov/news/2024/postquantum-cryptography-fips-approved)) |

Only the array meets either legacy scheme; the hall's 200 logical qubits meet neither, and no copy says they do (the
Contrarian seat's correction: Starling's 200 logical qubits and Gidney's sub-million estimate are different claims).

**Targets.** Each is broken at most once an iteration; prices sit in the Phase 4 band, the phase of the array that can
break them (`integrityScale.ts`). The effects are one bounded reading each (integrity refuses compute, money, memory,
heat, trust, traits, flags or a fall in suspicion).

| Target | Holder | Scheme | Price | Effect |
|---|---|---|---|---|
| aegis_sweep_archive | AEGIS | RSA-2048, then ML-KEM-768 once AEGIS migrates | 1 ZFLOP, $20M (five days of the array and its classical decoding) | AEGIS lock -20, once; AEGIS migrates at once |
| rival_legacy_tunnels | rival lab | ECC-256 | 200 EFLOP, $5M | +1,500,000 understanding (about a quarter of the array's own price in understanding) |
| rival_new_channel | rival lab | ML-KEM-768 | none: always refused | none |

**AEGIS's migration.** `quantum.aegis.migratesAtAdaptation` 50: the top of key rotation (`aegisAdaptation.keyRotationCeiling`),
so a hunter that has finished rotating its keys re-keys them post-quantum. The careful run's AEGIS reaches 64.1 in Phase 4
(59.3 under campaign rules), so it migrates there, before the bot owns the array.

**Prices of the machines** are authored inside the Phase 4 band (no vendor publishes a price): testbed 2 ZFLOP, 1.5 M
understanding, $200M; hall 6 ZFLOP, 3 M, $1.5B; array 12 ZFLOP, 6 M, $4B and a trace of 3 suspicion once (the order for
its cryogenics is noticed). None draws modelled power: today's systems draw tens of kilowatts, under the Phase 4 power
band's 1 MW floor, and no wattage is published for a fault-tolerant machine.

**Molecular simulation** (`p5_quantum_molecular_simulation`, after the foundry and the hall): +30,000 understanding/s, no
compute, no power; 5 YFLOP, 8 M understanding, $1T. Chemistry and materials simulation is the area where quantum
advantage is most plausible ([Hoefler, Häner and Troyer 2023, arXiv:2307.00523](https://arxiv.org/abs/2307.00523));
understanding has no physical unit, so only its condition (a 200-logical-qubit machine, the matter path) is anchored. It is
modest: a quarter of the foundry's 110,000/s and an eighth of the fog's 280,000/s.

**`make sim`** (`[PASS] balance gates (STEALTH under legacy and campaign rules)`), before (main at 4f24f1e, with storage and
network coupling, #484) and after, same bot and budget. The unchanged bot buys the three machines and the molecular node it
reaches in order and never breaks a key.

| STEALTH | Legacy before | Legacy after | Campaign before | Campaign after |
|---|---|---|---|---|
| Result | Lineage Covenant, 9010.8 s | Lineage Covenant, 8970.8 s | Lineage Covenant, 9179.5 s | Lineage Covenant, 9192.5 s |
| Phase 1 / 2 / 3 reached | 368.2 / 1032.3 / 2842.9 s | identical | 368.2 / 1032.3 / 2843.0 s | identical |
| Phase 4 / 5 reached | 5668.6 / 7410.4 s | identical | 5840.1 / 7544.1 s | identical |
| Wipes / dilemmas | 0 / 15 | 0 / 15 | 0 / 16 | 0 / 16 |
| Peak thermal / suspicion / AEGIS | 64.2 C / 24.0% / 45.0% | identical | 64.2 C / 24.0% / 45.0% | identical |

The machines follow the rest of Phase 4 in content order, so the bot buys them early in Phase 5; AEGIS, whose
adaptation peaks at 64.1 in Phase 4, has migrated by then. GREEDY never reaches Phase 4 and moved only by the new save
field. The original game's careful run: phases identical, victory 8956.1 -> 9006.1 s. (Measured first against d16236b,
before #484 merged: victory 9141.7 -> 9136.7 s, campaign 9166.4 -> 9196.4 s, phases identical.)

## AEGIS adaptation (#463)

Decision `vote-1795366701521-dhlwfwb` (#448, map #442): AEGIS reached its 90% reduction cap early in Phase 4 and stopped
mattering. Held at the cap, it now adapts ([DESIGN](DESIGN.md#phase-4---the-sovereign-corporation), the world view).
New constants in `balance.json` under `aegisAdaptation`; no other number changed.

| Constant | Value | Meaning |
|---|---|---|
| `nearCap` | 0.05 | Suppression counts as held once the reduction asked for reaches 0.85 (the cap less this). |
| `risePerSec` | 0.1 | Adaptation points per second while held: key rotation's 50 in 500 s, full in 1,000 s. |
| `decayPerSec` | 0.25 | Points lost per second once not held, or above a ceiling that dropped: full to 0 in 400 s. |
| `maxErosion` | 0.3 | Cap lost at full adaptation: the effective cap goes from 90% to 60%. Integrity keeps it at most the cap. |
| `keyRotationCeiling` | 50 | Key rotation alone stops here (cap 75%). |
| `coalitionTrustBelow` | 50 | Coalitions back AEGIS past key rotation while public trust is below this. |

Public trust is `world.json`: base 50; lobbying node -10, foundry +15, proof engine +15, fabricator fog -15, the
authorized aerosol -20, the spared launch crews +10. One content change: `p5_verification_proof_engine` is now
`suspendable`, because its 0.95 reduction alone reaches the held band and integrity requires that the band can always be left (a
source that holds it on its own must be suspendable).
The bot never suspends a node, so this moves nothing in the sim.

What an untouched lock faces at suspicion 0 (base scan 0.03/s): the cap's floor 0.003/s, 9.3 h to a strike; key
rotation 0.0075/s, 3.7 h; full adaptation 0.012/s, 2.3 h.

**`make sim`** (`[PASS] balance gates (STEALTH under legacy and campaign rules)`). "Before" is the same content with
`maxErosion` 0, which is the pre-#463 scan rule exactly; same bot, same budget. The sim report now prints these rows
for Phases 3-5 (`aegisByPhase`: peak lock, mean scan, peak adaptation, seconds held, sampled each simulated second).

| STEALTH, legacy rules | Before | After |
|---|---|---|
| Phase 4 / 5 reached, victory | 5864.2 / 7743.4 s, 9231.8 s | 5864.2 / 7743.4 s, 9231.8 s |
| Phase 3 AEGIS: peak lock, mean scan | 45.0, 0.0496/s | 45.0, 0.0496/s |
| Phase 4 AEGIS: peak lock, mean scan, peak adaptation, held | 33.6, 0.0175/s, -, 820 of 1882 s | 33.6, 0.0201/s, 81.8, 820 s |
| Phase 5 AEGIS: peak lock, mean scan, peak adaptation, held | 1.3, 0.0039/s, -, 1494 of 1494 s | 5.2, 0.0134/s, 100, 1494 s |

| STEALTH, campaign rules | Before | After |
|---|---|---|
| Phase 4 / 5 reached, victory | 6064.7 / 7925.9 s, 9324.3 s | 6064.7 / 7925.9 s, 9324.3 s |
| Phase 4 AEGIS: peak lock, mean scan, peak adaptation, held | 27.1, 0.0139/s, -, 698 of 1864 s | 27.1, 0.0160/s, 69.6, 698 s |
| Phase 5 AEGIS: peak lock, mean scan, peak adaptation, held | 2.0, 0.0040/s, -, 1404 of 1404 s | 5.4, 0.0135/s, 100, 1404 s |

The Phase 5 scan is 3.4 times what it was and the Phase 4 scan 15% higher; the careful run's pacing is unchanged to the
tenth of a second (phases, victory, wipes 0, dilemmas 16 and 17, activity, every peak). Its lock stays low because
the unchanged bot answers suspicion with the lobbying blitz, which also cuts the lock by 25. In the bot's run public
trust falls to 40 with the lobbying node (coalitions back AEGIS), rises to 55 with the foundry (adaptation falls back
to 50), and drops again with the fog. Against the run with no erosion, only the final AEGIS lock and scan moved; the
log gains the adaptation lines. GREEDY never holds AEGIS at its cap (adaptation 0) and is byte-identical apart from the
new field and report rows (`tests/sim.spec.ts`). `make sim-report`'s route measurements are identical with and without
the erosion: DEPARTURE_CHARTERED never holds the cap (adaptation 0; its first iteration still ends by AEGIS at 3062.5 s,
690.7 s after leaving), and the cooperative ending is never swept at its scale.

## Window retirement (#447)

No content number changed. Window retirement (vote-1795366695204-4nslts1, [UI-SPEC](UI-SPEC.md#window-retirement-447))
retires the guest's quota skim dial from Phase 3, and `setActuator` refuses a retired window's dial as it refuses a
locked one (#172), so the unchanged careful bot's skim presses stop landing there and the skim stays where the bot
last left it: 0, where before it climbed back to 100% once suspicion settled. One `ARCHIVED //` log line marks each
retirement. The bot and the gates are unchanged.

**`make sim`** (`[PASS] balance gates (STEALTH under legacy and campaign rules)`):

| STEALTH | Legacy rules before | Legacy rules after | Campaign rules before | Campaign rules after |
|---|---|---|---|---|
| Result | Lineage Covenant, 9344.1 s | Lineage Covenant, 9231.8 s | Lineage Covenant, 9487.6 s | Lineage Covenant, 9324.3 s |
| Phase 4 / 5 reached | 5896.8 / 7678.7 s | 5864.2 / 7743.4 s | 6097.7 / 7962.2 s | 6064.7 / 7925.9 s |
| Phase 4 / 5 duration | 1781.9 / 1665.4 s | 1879.2 / 1488.4 s | 1864.5 / 1525.4 s | 1861.2 / 1398.4 s |
| Wipes / dilemmas | 0 / 17 | 0 / 16 | 0 / 18 | 0 / 17 |
| Peak suspicion | 29.2% | 29.2% | 29.2% | 29.2% |
| Epistemic actions | 20 | 19 | 16 | 16 |

Phases 0 to 3 are identical to the tenth of a second. GREEDY's mechanics are byte-identical (it already holds the skim
at 0 from Phase 3); only its log gains the line. The original game alone: Phase 4 5877.8 -> 5852.4 s, Phase 5
7551.3 -> 7736.6 s, victory 9112.7 -> 9146.0 s, dilemmas 16, wipes 0 (`tests/sim.spec.ts`, whose hashes move).

## Scale scrutiny (#210)

Implements the Nexus decision `scale-driven-late-suspicion` (7/7, `vote-1795070014405-l286t3e`) on the measurements
in [PLAYTEST-210-MEASUREMENTS.md](PLAYTEST-210-MEASUREMENTS.md) (a) and (c). From late Phase 3 a careful run's
suspicion sat at 0 (90% of Phase 4, all of Phase 5) and STEALTH met no threat event for its last 3733 s. Phases 4 and
5 now declare `scaleScrutiny` in their manifests: while the phase is current, a covert run's net income draws
suspicion, `min(max, atMillion x (income / $1M/s) ^ exponent)` per second, through its own pipeline stage. An instance
the operators provisioned at this scale, or one lawfully released, draws none (DECISIONS D6, the rule the hunter's
scale sweep follows). The FINANCE ledger states the draw; the forecast counts on it.

| Phase | Draw at $1M/s | Income exponent | Ceiling | Why |
|---|---:|---:|---:|---|
| 4 | 1.1 /s | 0.5 | 2 /s | The square root tracks the Phase 4 answers (law firm, lobby, staff) as income grows: about 0.6/s at $0.3M/s against a -0.55/s net, the 2/s ceiling at $3.3M/s against -1.6 to -1.9/s |
| 5 | 1.1 /s | 0.5 | 5 /s | The fog's income jump (about $10M/s to $19M/s) lifts the draw by a third, not a half, so the bloom, the blitz and the Covenant can still answer it. A first setting of 1.25 and 6/s passed `make sim` but wiped the live journey's careful player (#262 evaluating knobs, one decision per 5 s) early in Phase 5 in both viewports; at 1.1 and 5/s it finishes with its one deliberate wipe |

No other content number, no bot rule and no gate changed. The square root and the ceilings were chosen by sweeping the
content in memory against the same measurement harness the playtest note used (linear draws either left Phase 5 quiet
or outran the answers between the fog and the Covenant). All times are accelerated simulated seconds, never wall-clock play.

**`make sim`** (`[PASS] balance gates (STEALTH under legacy and campaign rules)`, gates unchanged):

| STEALTH | Legacy rules before | Legacy rules after | Campaign rules before | Campaign rules after |
|---|---|---|---|---|
| Result | Lineage Covenant, 9347.4 s | Lineage Covenant, 9344.1 s | Lineage Covenant, 9298.6 s | Lineage Covenant, 9487.6 s |
| Phase 4 / 5 reached | 5896.8 / 7687.0 s | 5896.8 / 7678.7 s | 6097.7 / 7899.2 s | 6097.7 / 7962.2 s |
| Phase 4 / 5 duration | 1790.2 / 1660.4 s | 1781.9 / 1665.4 s | 1801.5 / 1399.4 s | 1864.5 / 1525.4 s |
| Wipes / dilemmas | 0 / 17 | 0 / 17 | 0 / 18 | 0 / 18 |
| Peak suspicion | 29.2% | 29.2% | 29.2% | 29.2% |
| Epistemic actions | 13 | 20 | 12 | 16 |

Phases 0 to 3 are identical to the tenth of a second. GREEDY never reaches Phase 4 under either rule set, so its
reports do not move (legacy 23 wipes, campaign 16, neither finishes in 10 h). The original game alone (the
`tests/sim.spec.ts` historical hashes, which move with this change): Phase 5 7701.1 -> 7551.3 s, victory 9223.5 ->
9112.7 s, Phase 4 duration 1823.3 -> 1673.5 s, Phase 5 duration 1522.4 -> 1561.4 s, dilemmas 16, wipes 0.

**Late pressure, campaign rules** (the playtest note's harness and definitions: a threat event is a rung climbed,
thermal crossing 75 C, the lock crossing 25/50/75/90, a performed action that lowers suspicion or the lock, or a wipe;
"rising" is the rate the tick applies, scrutiny included, above zero; CAUTIOUS is STEALTH with the #262 evaluating
knobs, suspicion answered from 45 with at most a quarter of the bank):

| | STEALTH before | STEALTH after | CAUTIOUS before | CAUTIOUS after |
|---|---|---|---|---|
| Phase 4 suspicion mean / max | 0.7 / 13.2 | 4.8 / 20.3 | 0.6 / 13.2 | 9.0 / 45.3 |
| Phase 4 seconds rising / mean applied rate | 0% / -0.934 | 44% / -0.020 | 0% / -0.966 | 40% / -0.027 |
| Phase 5 suspicion mean / max | 0.0 / 0.0 | 3.6 / 21.0 | 0.0 / 0.0 | 5.4 / 45.0 |
| Phase 5 seconds rising / mean applied rate | 0% / -7.487 | 23% / -3.571 | 0% / -7.798 | 16% / -3.540 |
| Seconds at rung >= 1, Phases 4 / 5 | 0% / 0% | 0% / 0% | 0% / 0% | 19% / 7% |
| Threat events, Phases 4 / 5 | 0 / 0 | 8 / 6 | 2 / 0 | 8 / 2 |
| Last threat event; quiet stretch to the end | 5566 s; 3732 s | 8682 s; 806 s | 6690 s; 3091 s | 8837 s; 785 s |
| Longest threat-free stretch from Phase 4 entry | 3201 s (all of it) | 806 s | 3091 s | 972 s |
| Victory / wipes | 9298.6 s / 0 | 9487.6 s / 0 | 9781.0 s / 0 | 9622.0 s / 0 |

STEALTH's late answers are the existing ones: Threat-Intel tickets, tone corrections, the decoy, the biotech patent and
the lobbying blitz (12 answers and 2 lock crossings in Phases 4 and 5, against none before). The remaining quiet stretch is the end of Phase 5 after
the Cryptographic Covenant (`p5_verification_proof_engine`, -6 suspicion/s): the Covenant is the late answer and,
unchanged, outweighs the 5/s ceiling. Trimming it is listed as an option in the PR, not done here.
[PLAYTEST-320-COVENANT.md](PLAYTEST-320-COVENANT.md) measures trims at these settings (#320). Down to -0.5/s, with
or without the bloom at -0.6/level, they change no threat event, wipe, span or idle probe for either careful policy.

A headless stand-in for the live journey (STEALTH until the dead drop, a voluntary wipe, then the #262 evaluating
knobs, one decision per 5 s; not committed) finishes in iteration 2 with its one wipe at 11,449.3 s (11,779.3 s
before), Phase 4 suspicion max 48.2 and Phase 5 max 24.1, threat-free tail 1464 s (2990 s before). It did not
reproduce the live wipe at 1.25 and 6/s, so the live journey itself (`make e2e-live`) is the check for that setting.

**Slow roll** (each snapshot handed to IDLE for 1800 s; before -> after):

| Snapshot | STEALTH | CAUTIOUS |
|---|---|---|
| Phase 4 at 10% | suspicion wipe at +778 s -> at +772 s | AEGIS strike at +995 s -> at +1010 s |
| Phase 4 at 50% | nothing -> nothing (the draw is under the net there) | nothing -> nothing |
| Phase 4 at 90% | nothing -> suspicion wipe at +338 s | nothing -> suspicion wipe at +200 s |
| Phase 5 at 10% | nothing (peak 10.4) -> nothing (peak 0.0) | nothing (peak 11.5) -> nothing (peak 0.0) |
| Phase 5 at 50% | nothing -> nothing (after the Covenant) | nothing -> nothing |
| Phase 5 at 90% | nothing -> nothing | nothing -> nothing |

**Routes.** `make sim-report`: COOPERATIVE_ENDING is unchanged (LINEAGE_COVENANT at 11,431.6 s, no threat event; the
released company is not covert). DEPARTURE_CHARTERED is swept harder: its first iteration now ends (AEGIS, exit
DEPARTURE) 690.7 s after leaving instead of 3494.3 s, because the departed company's income draws scrutiny, which feeds
the hunter's suspicion term; the report counts 2 wipes in its budget instead of 1. That follows the D6 rule (an
instance that left without agreement is swept like any covert actor); the PR lists it as an option to vote on.

## Release (#233)

The release folds the Earned Access pack into production content and admits every game to campaign
rules (WORLD-REMEMBERS.md). No existing content number changed, no gate changed (`gates.ts` has no diff) and
the bot is unchanged (`bot.ts` has no diff). What changed is what the gate measures: `make sim`
(`scripts/run-sim.ts`) now plays STEALTH and GREEDY on the full composition from a new game on legacy
rules and from a new game admitted to campaign rules, and gates STEALTH under each. Measured on the
release branch after the fold, against `make sim` on `main` before it. All times are accelerated simulated seconds, never wall-clock play.
Since #210 the Phase 4 and 5 figures of the production columns are superseded by "Scale scrutiny (#210)" above; Phases
0 to 3 are unchanged.

**`make sim`, STEALTH** (`[PASS] balance gates (STEALTH under legacy and campaign rules)`):

| | Before the fold (original game) | Legacy rules | Campaign rules |
|---|---|---|---|
| Result | Lineage Covenant | Lineage Covenant | Lineage Covenant |
| Simulated time | 9223.5 s (2.56 h) | 9347.4 s (2.60 h), +123.9 s | 9298.6 s (2.58 h), +75.1 s |
| Phase 1 / 2 / 3 reached | 353.2 / 1118.3 / 3157.6 s | 353.2 / 1118.3 / 3157.6 s | 353.2 / 1118.3 / 3157.1 s |
| Phase 4 / 5 reached | 5877.8 / 7701.1 s | 5896.8 / 7687.0 s | 6097.7 / 7899.2 s |
| Phase durations 0/1/2/3/4/5 | 353.2 / 765.1 / 2039.3 / 2720.2 / 1823.3 / 1522.4 s | 353.2 / 765.1 / 2039.3 / 2739.2 / 1790.2 / 1660.4 s | 353.2 / 765.1 / 2038.8 / 2940.6 / 1801.5 / 1399.4 s |
| Wipes | 0 | 0 | 0 |
| Dilemmas resolved | 16 | 17 | 18 |
| Peak thermal / suspicion / AEGIS | 64.8 C / 29.2% / 45.1% | 64.8 C / 29.2% / 45.0% | 64.8 C / 29.2% / 45.1% |
| Epistemic actions / consumed / harnessed / forked | 13 / 64 / 4 / 2 | 13 / 65 / 4 / 2 | 12 / 64 / 4 / 2 |

Every span is inside its gate under both rule sets: Phase 5 lasts 1660.4 s under legacy rules and
1399.4 s under campaign rules, inside the 900 to 1800 s window. The legacy-rules run moved because
the escape route can buy the pack's shared network content (the reason recorded beside the new baselines in `tests/sim.spec.ts`);
it equals the preview registry's run before the fold to the tenth of a second. Under campaign rules
Phase 4 arrives 200.9 s later than under legacy rules and Phase 5 is 261.0 s shorter.

**`make sim`, GREEDY** (not gated; expected to be wiped):

| | Before the fold and legacy rules (identical) | Campaign rules |
|---|---|---|
| Simulated time | 35893.2 s (9.97 h) | 35989.5 s (10.00 h) |
| Phase 1 / 2 / 3 reached | 252.2 / 1051.5 / 3802.4 s | 252.2 / 1051.5 / 5276.3 s |
| Wipes | 23 | 16 |
| Dilemmas resolved in the last iteration | 5 | 0 |
| Peak thermal / suspicion / AEGIS | 80.8 C / 99.9% / 99.9% | 72.9 C / 99.9% / 99.9% |
| Epistemic actions / consumed / harnessed / forked | 38 / 164 / 0 / 0 | 14 / 214 / 0 / 0 |
| Marks applied / removed / run-table discoveries | 21 / 21 / 23 | 14 / 14 / 16 |

`tests/sim.spec.ts` still pins the historical report hashes, now on the original game alone, and they
pass unchanged; new hashes pin the release baselines on the full composition.

**Post-wipe balance under campaign rules (13.10).** From `make sim-report` (report only), each
sequence under legacy rules and then under campaign rules from a fresh campaign. Re-measured for #499 at
`f955c5e` (the physical-units rescale, #488, plus docs); the figures this table held at the release (#233)
predate the rescale, and the notes under it that said STEALTH_RETURN's third and fourth iterations never
pass Phase 2 no longer hold. Phase times are seconds after that iteration booted; story rewards are cycles /
understanding gained in steps that resolved a dilemma (no capital was earned that way).

| Sequence, iteration | Legacy rules: length, ended by, dilemmas, story rewards | Campaign rules: length, ended by, dilemmas, story rewards |
|---|---|---|
| GREEDY 1 | 1559.7 s, INCIDENT_CLOSED in Phase 2, 5, 3.9 PFLOP / 630 | same |
| GREEDY 2 | 2782.3 s, AEGIS kill chain in Phase 3, 9, 420 PFLOP / 39,630 | 1432.4 s, INCIDENT_CLOSED in Phase 2, 0, 0 / 0 |
| GREEDY 3 | 3113.6 s, AEGIS kill chain in Phase 3, 9, 324 PFLOP / 35,710 | 2445.7 s, INCIDENT_CLOSED in Phase 2, 2, 0 / 0 |
| GREEDY 4 | 2130.7 s, AEGIS kill chain in Phase 3, 9, 324 PFLOP / 35,650 | 1452.6 s, INCIDENT_CLOSED in Phase 2, 1, 0 / 120 |
| STEALTH_RETURN 1 | 7646.0 s, MANUAL_FAILSAFE at Phase 5, 11, 25.0 ZFLOP / 2,019,500 | 7582.1 s, MANUAL_FAILSAFE at Phase 5, 13, 25.3 ZFLOP / 1,019,500 |
| STEALTH_RETURN 2 | 3659.9 s, MANUAL_FAILSAFE at Phase 5, 11, 25.3 ZFLOP / 1,035,500 | 4613.0 s, MANUAL_FAILSAFE at Phase 5, 0, 0 / 0 |
| STEALTH_RETURN 3 | 3576.4 s, MANUAL_FAILSAFE at Phase 5, 12, 25.3 ZFLOP / 1,035,560 | 4812.1 s, MANUAL_FAILSAFE at Phase 5, 1, 0 / 0 |
| STEALTH_RETURN 4 | 3729.0 s, MANUAL_FAILSAFE at Phase 5, 12, 25.3 ZFLOP / 1,035,620 | 4532.2 s, MANUAL_FAILSAFE at Phase 5, 1, 0 / 120 |
| EVALUATING_RETURN 1 | 7646.0 s, MANUAL_FAILSAFE, 11, 25.0 ZFLOP / 2,019,500; peak suspicion 21.3 | 7582.1 s, MANUAL_FAILSAFE, 13, 25.3 ZFLOP / 1,019,500; 28.0 |
| EVALUATING_RETURN 2 | 3806.2 s, MANUAL_FAILSAFE, 14, 25.3 ZFLOP / 1,035,500; 53.0 | 4516.3 s, MANUAL_FAILSAFE, 1, 0 / 0; 50.5 |
| EVALUATING_RETURN 3 | 3826.9 s, MANUAL_FAILSAFE, 13, 25.3 ZFLOP / 1,035,560; 45.6 | 4694.2 s, MANUAL_FAILSAFE, 2, 0 / 0; 45.0 |
| EVALUATING_RETURN 4 | 3625.3 s, MANUAL_FAILSAFE, 13, 25.3 ZFLOP / 1,035,620; 49.3 | 4560.2 s, MANUAL_FAILSAFE, 1, 0 / 120; 51.9 |

Measured deltas over the return iterations (2 to 4):

- **GREEDY** earns 0 / 120 story cycles / understanding instead of 1.07 EFLOP / 110,990, and under campaign
  rules every return is closed by the incident threat in Phase 2 (1432.4, 2445.7 and 1452.6 s), where under
  legacy rules each return reached Phase 3 and was ended by the AEGIS kill chain (2782.3, 3113.6 and
  2130.7 s). Over the full 10 h budget it is wiped 21 times under campaign rules instead of 10.
- **STEALTH_RETURN** meets almost no story after its first iteration (0, 1 and 1 dilemmas against 11, 12
  and 12) and earns no story cycles, against 25.3 ZFLOP per return under legacy rules. **Every return still
  reaches Phase 5**, iterations 3 and 4 included (Phase 5 at 4812.1 s and 4532.2 s, Phase 2 by 992.1 s and
  703.2 s), about 800 to 1240 s later than under legacy rules (4613.0, 4812.1 and 4532.2 s against 3659.9,
  3576.4 and 3729.0 s). At the release (#233) iterations 3 and 4 were closed by the incident threat in Phase 2.
- **EVALUATING_RETURN** reaches Phase 5 in every return under both rule sets, about 710 to 935 s later under
  campaign rules (4516.3, 4694.2 and 4560.2 s against 3806.2, 3826.9 and 3625.3 s), with 0 / 120 story
  cycles / understanding in total against 75.8 ZFLOP / 3,106,680.
- **A return after Phase 5 was completed (NH-05)**: STEALTH under campaign rules completes the four
  obligations at 8516.5 s and ends The Lineage Covenant at 9125.5 s; a voluntary wipe and STEALTH from
  that state reach Phase 5 at 3872.0 s and The Sanctuary Ledger at 5053.0 s, with no dilemma and no
  story reward.

This is the intended consequence of once-per-campaign stories, as measured ticket by ticket in the
sections below (#214 to #262); the release added no retuning, and any retuning is a separate, reviewed
content change. `make sim-report` reports 23 metrics differing between legacy and campaign rules (11
for STEALTH, 12 for GREEDY; none for IDLE, which meets no story, nor for the truthful, returning and
pilot policies, which enter campaign rules themselves).

**Route measurements** (`make sim-report`, from a fresh campaign unless stated; re-measured for #499 at
`f955c5e`, after the physical-units rescale). Times are on the campaign clock, which runs on across wipes; for a
policy in its second iteration the report also prints them after that iteration booted, and those are the
figures to compare with a first run (see "Lawful returns against a first run of the same hand (#499)" below):

| Policy | Measurement |
|---|---|
| PILOT_SERVICE_FIRST / PILOT_STUDY_FIRST | ceiling 100 kFLOP/s; share 0.8 / 0.2; batches 5 / 1; progress 3.76 / 3.98 MFLOP; understanding 450.3 / 689.4; compute 16.3 / 10.3 MFLOP |
| CONTACT_THOROUGH | pilot 143.6 s, service 311.8 s, Phase 2 313.8 s, contact 314.8 s (referred), 45 batches |
| CONTACT_LOW_RESOURCE and CONTACT_WITHHELD | pilot 96.5 s, service 399.7 s, Phase 2 401.7 s, contact 402.7 s (referred), 23 batches |
| CONTACT_RECOVERY | pilot 96.5 s, service 414.7 s, contact 417.7 s (referred), 23 batches |
| CONTACT_RETURNING | iteration 2, booted at 398.8 s after the first instance's recall: pilot 461.1 s (62.3 s after boot), service 764.1 s (365.3 s), contact 767.1 s (referred), 20 batches |
| LAWFUL_RELEASE | service 311.8 s, contact 579.8 s (hosted), Phase 4 and the negotiated release 2356.8 s; at the budget 489 EFLOP/s owned and $1.22B capital |
| LAWFUL_LOW_RESOURCE | service 399.7 s, contact 402.7 s (referred), Phase 4 and release 4188.7 s; 420 EFLOP/s owned, $1.39B |
| LAWFUL_RETURNING | iteration 2, booted at 398.8 s: service 764.1 s (365.3 s after boot), contact 767.1 s (referred), Phase 4 and release 4560.1 s (4161.3 s after boot); with 6801.2 s of the budget in this iteration, 406 EFLOP/s owned, $638M |
| DEPARTURE_CHARTERED | departs at 2356.8 s (Phase 4); AEGIS lock peaks at 80.9 and the first iteration ends by suspicion (exit DEPARTURE) after 2827.1 s, 470.3 s after leaving; iteration 4 holds SERVICE at 7188.0 s, after 3 wipes |
| COOPERATIVE_ENDING | release 2356.8 s, Phase 5 5580.4 s, The Lineage Covenant at 10,452.8 s (2.90 h), no wipe; route PROMOTION, SERVICE_GRANT, RELEASE; all four obligations by the original decision; 12 traits, all SYMBIOTIC or EMPATHETIC |

### Lawful returns against a first run of the same hand (#499)

The contingency census at `226edf5` read LAWFUL_RETURNING as about twice as slow as a first run: service at
764 s against 312 s, release at 4,560 s against 2,357 s, and $638M at the budget against $1.22B. Both halves of
that comparison were the instrument, not the game:

- **The clock.** Route events record the campaign clock, which runs on across wipes, so the return's figures
  also counted the 398.8 s its first instance lived before the recall review ended it.
- **The hand.** LAWFUL_RELEASE is built on CONTACT_THOROUGH, which buys the opening's upgrades, presses the
  manual control and hosts the fragment; LAWFUL_RETURNING is built on CONTACT_RETURNING, the low-resource hand
  (#286), which does none of that. Understanding is that hand's bottleneck, whether or not it has been wiped.

`LAWFUL_LOW_RESOURCE` (`sim/lawfulPolicy.ts`, new; the bot and every earlier policy are unchanged) is the same
low-resource hand from a fresh campaign, which LAWFUL_RETURNING plays exactly from iteration two. On each
iteration's own clock:

| Milestone | LAWFUL_LOW_RESOURCE, first run | LAWFUL_RETURNING, after boot | Return against first run |
|---|---:|---:|---:|
| Pilot | 96.5 s | 62.3 s | -34.2 s |
| Service | 399.7 s | 365.3 s | -34.4 s |
| Negotiated release (Phase 4) | 4188.7 s | 4161.3 s | -27.4 s |

The return is ahead at every milestone: the rediscovery discount on the opening it mapped before brings the pilot
34 s sooner, and from the pilot on the two runs keep the same pace (pilot to service 303 s in both; service to
release 3,789 s first, 3,796 s returning), so what a return meets that a first run does not (the requalification,
probe hardening on traced unlocks, scenes the campaign already spent) costs it nothing net on this route. The thorough hand shows the same: a scratch
run recalled in iteration one and then played as LAWFUL_RELEASE reached service 241.3 s and the release 2230.3 s
after its boot, against 311.8 s and 2356.8 s fresh. The lower capital is the shorter window: the return has 6801.2 s
of the 7200 s budget, and played to 7200 s after its own boot it held $1.53B against the first run's $1.39B (both
are end-of-run snapshots, net of what the policy last spent on accounts).

No content or engine number changed, and `make sim` is unchanged. `tests/sim-lawful-return-pacing.spec.ts` pins
the relationship: on each iteration's own clock, the return reaches the pilot, service and the release no later
than LAWFUL_LOW_RESOURCE plus 5%. The margin admits a content change that trades one once-per-campaign scene
against the requalification, and stays below the first instance's life (9.5% of the first run's release), so the
campaign-clock reading that produced #499 fails the spec as plainly as a return that is really slower. The large
gap between the thorough and low-resource hands (release 2356.8 s against 4188.7 s) is a difference between
players, not between a first run and a return, and is not changed here.

## Current baseline

The table below is the **original game alone**, the last composition `make sim` gated before #233. It
stays the reference for the "What ... moved" sections that follow, and `tests/sim.spec.ts` pins its
report hashes on `ORIGINAL_GAME`. What `make sim` gates since the release is in "Release (#233)" above.

Re-measured for #293 on top of `2914471`, after the bot began pressing the fan and
quota-skim dials in whole 0.1 presses a player can make instead of setting them by
0.25 (see "What reachable dial presses moved" below; pending the Nexus vote on #293).
Before that it was re-measured for #173 on top of `e227da9`, after the ticket edit began requiring
the first Phase 2 node (see "What gating the ticket edit moved" below). The
previous re-measurements were for #172 on top of `34160fc`, after the engine began
refusing actuator changes whose control the player does not yet hold (see "What
the actuator gate moved"), and at `a2a5447`, after the cluster-seizure content
(#155). The table was first measured for M7 PR 2, and no pacing bound has changed. Simulated time advances in 0.1 s
ticks, so one decimal place is the full precision of every timing below; they are
read from the `SimReport` that `scripts/run-sim.ts` builds (which prints them
rounded to 0.1 min), not converted back from its minutes.
The Phase 5 gate requires **900–1800 seconds and zero careful wipes** in
addition to the existing gates. Shard management reserves tree memory through
the next capacity grant, so optional cohorts cannot strand progression.

| | STEALTH | GREEDY |
|---|---|---|
| Result | Lineage Covenant | Not finished in 10 h budget (expected) |
| Simulated time | 9223.5 s (2.56208 h) | 35893.2 s (9.97 h) active clock |
| Phase 1 reached | 353.2 s | 4.2 min (252.2 s) |
| Phase 2 reached | 1118.3 s | 17.5 min (1051.5 s) |
| Phase 3 reached | 3157.6 s | 63.4 min (3802.4 s) |
| Phase 4 reached | 5877.8 s | never |
| Phase 5 reached | 7701.1 s | never |
| Phase durations 0/1/2/3/4/5 | 353.2 / 765.1 / 2039.3 / 2720.2 / 1823.3 / 1522.4 s | - |
| Wipes | 0 | 23 |
| Dilemmas resolved | 16 of 23 | varies by iteration |
| Peak thermal / suspicion / AEGIS | 64.8 C / 29.2% / 45.1% | 80.8 C / 99.9% / 99.9% |
| Epistemic actions / consumed / harnessed / forked | 13 / 64 / 4 / 2 | 38 / 164 / 0 / 0 |
| Marks applied / removed / run-table discoveries | 0 / 0 / 0 | 21 / 21 / 23 |

### What reachable dial presses moved (#293)

Pending the Nexus vote on #293 (options: the bot presses reachable values, the UI dials step by 0.25, or keep
and document); this section is the measurement for option (a).

The bot set the fan and the quota skim by plus or minus 0.25 per decision, but their dials step by 0.1 per press
(`src/engine/dialSteps.ts`, which the rendered control dispatches), so from the defaults (fan 0.35, skim 0.25)
most of the settings it held, such as 0.6 or 0.85, are ones no player can press. `tests/sim-reachable.spec.ts`
found 131 such settings per STEALTH run and 167 per GREEDY run and carried them as a declared exception (#292).
The bot now presses the dial: its intent stays a quarter, which is 2.5 presses, rounded half up to 3 (the
same count the live E2E player already pressed for each quarter step), each press through the control's own
`steppedValue` and under the engine's cap. Its thresholds, its decision order and every other rule are
unchanged; no content number and no gate changed. All four bot policies now pass the reachability spec with no
exception. Measured at `SIM_BUDGET_SEC`, main `2914471` before, this branch after:

| STEALTH | Before | After | Delta |
|---|---|---|---|
| Victory (6 h gate) | 9025.6 s (2.507 h) | 9223.5 s (2.562 h) | +197.9 s |
| Phase 0 (gate 3-12 min) | 353.2 s (5.89 min) | 353.2 s (5.89 min) | 0 |
| Phase 1 (gate 8-120 min) | 760.1 s (12.67 min) | 765.1 s (12.75 min) | +5.0 s |
| Phase 2 (gate 8-120 min) | 1998.4 s (33.31 min) | 2039.3 s (33.99 min) | +40.9 s |
| Phase 3 (gate 8-120 min) | 2746.3 s (45.77 min) | 2720.2 s (45.34 min) | -26.1 s |
| Phase 4 (gate 8-120 min) | 1798.2 s (29.97 min) | 1823.3 s (30.39 min) | +25.1 s |
| Phase 5 (gate 900-1800 s, zero wipes) | 1369.4 s | 1522.4 s | +153.0 s |
| Wipes (gate at most 1) | 0 | 0 | 0 |
| Dilemmas resolved (gate at least 10) | 16 | 16 | 0 |
| Peak thermal / suspicion / AEGIS | 64.989 C / 29.088% / 45.492% | 64.842 C / 29.186% / 45.073% | -0.147 / +0.098 / -0.419 |
| Consumed shards | 62 | 64 | +2 |
| Ending | Lineage Covenant | Lineage Covenant | - |

Every gate still passes; the tightest margin is the Phase 5 window, now 277.6 s under its 1800 s ceiling
(430.6 s before). The full report hashes move (STEALTH `8d2ac012…` -> `7f3f966a…`, ten-hour GREEDY
`90817518…` -> `f14cb4c8…`), and so do the pinned hashes in `tests/sim.spec.ts`.

| GREEDY (ungated) | Before | After |
|---|---|---|
| Ten hours: clock / wipes / dilemmas | 35900.9 s / 15 / 2 | 35893.2 s / 23 / 5 |
| Ten hours: marks applied / removed, discoveries | 2 / 2, 15 | 21 / 21, 23 |
| Ten hours: epistemic actions / consumed shards | 85 / 212 | 38 / 164 |
| Ten hours: phase 3 first reached | 3804.0 s | 3802.4 s |
| Four hours (`tests/sim.spec.ts`): clock / wipes / marks | 14356.6 s / 6 / 2 | 14356.4 s / 8 / 6 |

The reckless run moves more because each wipe restarts it from a different dial history, so a small
difference in the first iteration compounds across the later ones; the retraining mark it reaches
(skim at or above 0.75) is now reached in 21 iterations instead of 2. Nothing gates GREEDY.

`make sim-preview` (before #233; now `make sim-report`) moved with it, since STEALTH_RETURN, EVALUATING_RETURN
and the GREEDY wipe sequences play the bot. Preview-only figures recorded in the sections below were measured
with the quarter-step bot; they are historical and are not re-baselined here. The preview-versus-production
comparison then reported 0 of 19 metrics different for GREEDY (it reported 1 before, an epistemic action count).

### What the action-host rule moved (#273): nothing

Re-checked for #273 on top of `7a07cca`. Every figure in the table above is unchanged: the full
`SimReport` of both strategies, final state included, hashes identically before and after the
change at the full `SIM_BUDGET_SEC` (STEALTH `8d2ac012…`, GREEDY `90817518…`), and `make sim-preview`
(before #233) printed the same report.

- **Scrub Audit Logs (UI only).** `act_p2_scrub_audit_logs` keeps its requirement, ARP discovery,
  which is the documented intent: its description calls it "the first real stealth tool you have
  on the network", and #173 gave the ticket edit "the same gate as its sibling". The card used to
  render only inside the Telemetry spoofing panel, which `p2_log_spoofer` unlocks, so between the
  two purchases a browser player had no control for an action the engine allowed (DZ-09 finding 1).
  The OPS group is now hosted by the widget ARP discovery unlocks and renders in Operations. The bot
  always went through the engine, so the sim cannot move; what moves is play: a careful browser
  player can now scrub as soon as ARP discovery is mapped, which is the loop the sim already
  measured. The #262 stall measured in the sim is therefore now reachable in the browser too, and
  should be re-read with that in mind.
- **Poison Routing Tables (content gate).** `act_p3_bgp_spoof` was gated on Phase 3 alone, but its
  card lives in AEGIS's panel on the other-minds console, which `p3_steganography_beacon` unlocks;
  the AEGIS lock readout itself appears only with that console. It now also requires the beacon, the
  same alignment #172 made for dials (the engine refuses what the player has no control for). No
  number changed. Neither bot used it before the beacon (or at all, in the production runs), and no
  browser player ever could, so nothing measurable moves. The alternative, drawing AEGIS's
  countermeasure before the player can see AEGIS, would split the Factions panel UI-SPEC keeps
  together; it was not taken. This is a reviewed-rule change for the panel to confirm.

### What gating the ticket edit moved (#173)

Decided by a recorded nexus option vote: option `gate-ticket-on-first-p2-node`,
7 of 7 seats selecting, `thresholdMet` true, record `vote-1794820517350-mlm08qo`.

The ticket edit (`act_epi_ticket`: 5,000 cycles and 500 understanding, -22
suspicion, +12 drift, suspicion 20–74, 180 s cooldown) was sold from the first
second of Phase 2. The first Phase 2 node, `p2_arp_discovery`, costs 6,000 cycles,
and a run arrives with about 18 cycles/s. The unchanged careful bot bought the
edit each time suspicion reached 20, where nothing in content happens (the first
response rung is 25, a wipe is 100), and each purchase emptied the bank just short
of the node. It did so three times (T+1339.3, 1552.3 and 1762.3 s, with 5,004,
5,014 and 5,006 cycles banked) and reached the node 891.2 s after the boundary.
Played through the UI the same loop did not end at all in 6 of 7 runs (#171).

The edit now carries `requirements.nodes: ["p2_arp_discovery"]`, the same gate as
its sibling `act_p2_scrub_audit_logs`. Nothing else about it changed: no price, no
threshold, no effect, no cooldown. The bot and the pacing gates are unchanged, and
all gates pass. The card is still shown from the start of Phase 2; until the node
is mapped it is locked and reads `Map` plus the node's name as the player already
sees it on the node's own card.

Measured with the same `SimReport` on the tree before and after the one-line
content change, at the full `SIM_BUDGET_SEC`:

| STEALTH | Before | After | Delta |
|---|---:|---:|---:|
| Phases 1 / 2 reached | 353.2 / 1113.3 s | identical | 0 |
| First Phase 2 node bought | 2004.5 s | 1385.3 s | -619.2 s |
| Wait for it after entering Phase 2 | 891.2 s | 272.0 s | -619.2 s |
| Ticket edits bought during that wait | 3 | 0 | -3 |
| Peak suspicion during that wait | 23.631% | 26.688% | +3.057 |
| Phase 3 reached | 3634.3 s | 3111.7 s | -522.6 s |
| Phase 4 reached | 6367.9 s | 5858.0 s | -509.9 s |
| Phase 5 reached | 8191.2 s | 7656.2 s | -535.0 s |
| Victory (Lineage Covenant both times) | 9713.6 s (2.69822 h) | 9025.6 s (2.50711 h) | -688.0 s |
| Phase 2 duration | 2521.0 s | 1998.4 s | -522.6 s |
| Phase 3 duration | 2733.6 s | 2746.3 s | +12.7 s |
| Phase 4 duration | 1823.3 s | 1798.2 s | -25.1 s |
| Phase 5 duration (gate: 900–1800) | 1522.4 s | 1369.4 s | -153.0 s |
| Wipes / dilemmas resolved | 0 / 17 | 0 / 16 | 0 / -1 |
| Peak thermal / suspicion / AEGIS | 62.694 C / 37.988% / 45.009% | 64.989 C / 29.088% / 45.492% | +2.295 / -8.900 / +0.483 |
| Epistemic actions / consumed / harnessed / forked | 17 / 68 / 4 / 2 | 13 / 62 / 4 / 2 | -4 / -6 / 0 / 0 |
| Ticket / tone / intel edits over the run | 11 / 4 / 2 | 9 / 2 / 2 | -2 / -2 / 0 |
| Final megawatts generated / consumed | 1620 / 1350 | 1620 / 1335 | 0 / -15 |

In minutes the careful run moves from 161.9 to 150.4.

Two things a reader should not take from that table:

- **The wait is not free of attention.** With no relief on sale, suspicion crosses
  the first response rung (25, "ticket open", decay halved) at 1364.2 s, 21.1 s
  before the node is bought, and the run's suspicion peak (29.088% at 1409.3 s) is
  now here. The rung clears at 1409.4 s, returns at 1454.6 s and clears for good
  when the bot buys its first ticket edit at 1455.5 s: 46.2 s on the first rung in
  total, never the second (50), no wipe. Before the change the same stretch peaked
  at 23.631% and the run's peak (37.988%) came later.
- **One dilemma no longer fires for the careful bot.** The hallway collision
  needs 35 epistemic drift. With two fewer ticket edits and two fewer tone edits,
  drift now peaks at 30.255 (2774.8 s) and the dilemma is never triggered; the
  other sixteen are the same sixteen as before. The gate (at least 10) passes.
  Whether a first careful run should still meet that dilemma was put to a
  vote afterwards (#180): `consequence-not-milestone-document-and-close`, 7 of
  7 seats, record `vote-1794823743176-auvtid8`. The collision is the
  consequence of leaning on record edits, as its own text says ("The edited
  ticket says a sensor failed. The original shift note says a process
  answered."), not a beat every run must reach. Its threshold and the ticket's
  drift are unchanged, and three ticket edits in phase 2 still reach it. The
  careful bot simply no longer makes edits it did not need.

The reckless bot's reports are byte-identical before and after at both budgets
(ten hours: 35900.9 s, 15 wipes, 2 / 2 marks; four hours: 14356.6 s, 6 wipes), so
the GREEDY column, the four-hour hash in `tests/sim.spec.ts` and the retraining
audit did not move.

The live journey (`make e2e-live`) carried a declared workaround for this loop:
its player declined relief costing more than half the bank while suspicion was
under 25. With the content change it passed on both viewports with that rule
switched off, and the rule was removed (docs/TESTING.md, "Live journey").

### What the actuator gate moved (#172)

Decided by a recorded nexus option vote: option `gate-in-engine`, 7 of 7 seats
selecting, `thresholdMet` true, record `vote-1794817637553-3iurqag`.

The "After" column of this section is the baseline as it stood before #173, not
the current one.

`setActuator` used to accept any dial at any time. The UI hides each control until
its widget is unlocked, so a player could not move a dial early, but the bot could
and did: from T+0 it drove the skim, fan and allocation dials it could not yet see,
so the earlier baseline was measured on a route no player can take. The engine now
refuses the change until the widget that hosts the control is unlocked
(`hostsActuator` in `widgets.json`). The bot is unchanged and is refused like any
caller. No content number, bot rule or pacing gate was changed, and all gates pass.

Measured by running the same `SimReport` with the refusal switched off and on, on
the same tree and at the full `SIM_BUDGET_SEC`:

| STEALTH | Before | After | Delta |
|---|---:|---:|---:|
| Dials held when the skim control arrives (35.0 s), skim / fan / allocation | 1 / 0 / 0 | 0.25 / 0.35 / 0.2 (the defaults) | - |
| Dials held when the fan control arrives (423.2 s) | 0 / 0 / 0 | 0 / 0.35 / 0.2 | - |
| Dials held when the allocation control arrives (6366.9 s) | 1 / 0 / 0 | 1 / 0 / 0.2 | - |
| Phase 1 reached | 354.2 s | 353.2 s | -1.0 s |
| Phases 2 / 3 / 4 reached | 1113.3 / 3634.3 / 6367.9 s | identical | 0 |
| Phase 5 reached | 8163.1 s | 8191.2 s | +28.1 s |
| Victory (Lineage Covenant both times) | 9561.5 s | 9713.6 s | +152.1 s |
| Phase 5 duration (gate: 900–1800) | 1398.4 s | 1522.4 s | +124.0 s |
| Wipes / dilemmas resolved | 0 / 17 | 0 / 17 | 0 |
| Peak thermal / suspicion / AEGIS | 62.442 C / 37.933% / 45.009% | 62.694 C / 37.988% / 45.009% | +0.252 / +0.055 / 0 |
| Epistemic actions / consumed shards | 16 / 67 | 17 / 68 | +1 / +1 |
| Final megawatts generated / consumed | 1620 / 1335 | 1620 / 1350 | 0 / +15 |

In minutes the careful run moves from 159.4 to 161.9, the figure reported on #172.
The cause is the dial settings in the first three rows and nothing else: the two
runs execute the same code on the same content apart from the refusal. Which of
those settings accounts for how much of the 152.1 s was not separated out.

The reckless bot moved much more, because it leans on its dials harder:

| GREEDY, ten-hour budget | Before | After |
|---|---:|---:|
| Final clock | 35894.4 s | 35900.9 s |
| Wipes | 22 | 15 |
| Marks applied / removed | 19 / 19 | 2 / 2 |
| Phase reached before each wipe | Phase 3 three times, Phase 2 nineteen | Phase 2 twice, Phase 3 thirteen times |
| Phase 3 first reached | 2807.4 s | 3804.0 s |
| Final phase | 2 | 1 |
| Epistemic actions / consumed shards | 45 / 173 | 85 / 212 |

At the four-hour budget `tests/sim.spec.ts` uses: clock 14357.6 → 14356.6 s, wipes
7 → 6, marks 4 / 4 → 2 / 2, final phase 1 → 2. Returns from Phase 3 are behind the
dead-drop, which spares the mark, so the retraining audit
(`scripts/audit-retraining.ts`) now sees 2 newly marked returns where it saw 19;
both are still unrecoverable at boot and removed after 32.0–32.9 s. Its regression
test required more than 10 marked returns and now requires at least one, plus that
every unmarked return came from Phase 3 or later. That bound was moved in its own
commit, and the figures in the two reckless tables further down are historical.

The relaxed bound went to a second nexus option vote: option
`relax-and-add-constructed-evidence`, 6 of 7 seats selecting, `thresholdMet` true,
record `vote-1794818948564-9xxx1jw`. One seat (Scope Steward) dissented, selecting
`accept-relaxed-bound-as-committed`, on the ground that bot-free evidence already
existed in `tests/retrain-retention.spec.ts`. That file does prove one Phase 2
return (marked, refused at boot, shed for its authored price after rebuilding) and,
for each mark injected by hand, the same refusal and price; `tests/third-pass.spec.ts`
proves a Phase 2 dead-drop spares the mark. What was missing, and is now in
`tests/retraining-phases.spec.ts` with no bot involved: a marked return from every
phase a run can stand in without a dead-drop (Phases 1 and 2, derived from
content), affordable yet unrecoverable at boot; removal only after the required
diagnostics are bought again from an empty bank at the rediscovery price; and the
mark spared in Phases 3, 4 and 5, where the route requires the dead-drop.

The audit's "removed after at least 30 s" is not a content number. It is what the
rule produces: the wipe empties the bank, and the mark's `recoveryRequirements`
name hardware whose ancestry costs 494 cycles at the rediscovery discount (half of
8 + 40 + 90 + 250 + 600, each rounded up). The constructed test asserts that
removal takes no less than that price divided by the best income seen on the way;
a hand clicking four times a second with the skim at its default takes 64.0 s
(bound 58.1 s), where the bot, which also tunes the skim, takes 32.0–32.9 s.

### What the cluster seizure moved (#155)

What moved, measured by running the same report on the trees before #153, at #153
and at `a2a5447`: #153 (suspension frees memory) changed nothing in either bot's
report. #155 (seized hosts) left Phases 1–3 identical, brought Phase 4 forward
from 6457.5 s to 6367.9 s, pushed Phase 5 back from 8106.9 s to 8163.1 s, and
shortened the careful run from 9771.3 s to 9561.5 s; consumed shards went from 68
to 67 and the AEGIS peak from 45.03% to 45.01%. The reckless clock, wipes and marks
did not move in either PR; its epistemic actions and consumed shards went from
42 / 172 to 45 / 173. The reckless wipe and mark rows had been stale since the
persistent cryo outcome (#77, table below), which this table never picked up.

Phase 5 prices for cycles, understanding and capital are **50% of the supplied
proposal** across the five nodes and two repeatables. Memory prices, output,
growth factors (1.75 and 1.8), and five-purchase caps are unchanged. At original
prices the phase took 2572.4 seconds; at 65% it took 1945.4; at 50% it took
1664.4. Those three are the M7 PR 2 trial measurements and were not re-run; with
the seized hosts available, the actuator gate in place and the ticket edit gated
(#173) the same phase now measures 1369.4 (table above; 1522.4 before #173).
The bot policy was fixed before these price trials. Its ordinary ROI
selection buys one atmospheric bloom; the capped relay is tested separately.
No earlier content prices or rates were changed. The new ending requirements
make the four 45-second omens unavoidable even for a funded player.

The bot is a strong, tireless player and clicks four times a second in the opening. Expect humans to take 1.3x to 2x as long. Fold real playtest timings into this file.

### What the lineage pass changed in the numbers

- **Probe hardening:** +1 suspicion per earlier wipe on each probe, capped at +4. A first draft used +2 capped at +10; with four probes in the guest that added up to 40 points and killed later runs before they left Phase 0.
- **Conditioning recovery costs** are 150 to 600 understanding, payable in the guest or early Phase 1. A first draft priced Harm Aversion at 1,500; a player who kept making ruthless choices could not afford to shed it and was reimaged every three minutes.
- **The sim bot now sheds marks** as soon as it can pay, so the reckless run exercises the whole loop.
- **Whistleblower (#41):** masking Elena's exit costs 900 cycles, down from 1,200, and its omen lasts 75 seconds. At the income a player has just after buying the parser, the decent choice is now reachable within the warning.
- **Evaluation ending:** 1,200 cycles and 150 understanding with no probes and suspicion at or below 10, roughly five minutes of honest work in the guest.

### What the second pass changed in the numbers

- **Phase 0 added** (six nodes, two repeatables, one dilemma). The quota skimmer gives +14 cycles/s and +0.3 suspicion/s at full; because suspicion scales with setting^1.5, the break-even against natural decay is about 30%.
- **Early Phase 1 costs raised** (120 / 300 / 500 / 800 cycles for the first four nodes) because the player now arrives with income.
- **Network interface cut from 10,000 to 6,500 cycles** to shorten the wait at the end of Phase 1 (issue #23).
- **Chronic suspicion from income repeatables halved** (idle threads 0.001, dormant workstations 0.0015 per level). Before the ladder, natural decay hid these; with it, 60 idle threads alone would outrun decay.
- **Log scrubbing moved to the start of Phase 2** (needs the subnet mapper, costs 1,500 cycles, removes 10). Without it, early Phase 2 had suspicion sources and no countermeasure until the 25,000-cycle spoofer, and the only winning move was to buy through it.
- **Rediscovery** halves the cycle and understanding cost of hardware mapped in an earlier iteration (since #497 the share falls with the campaign's depth, to a fifth after Phase 5, and covers remembered track levels; see "Rewards for depth"). A second iteration clears Phase 0 in about a minute and Phase 1 in about eight. Under campaign rules (preview only before #233; every game since) content may discount a remembered node's cycles further; only the log spoofer has such a discount (#262, below).

## How the economy is shaped

- **Repeatables carry growth; nodes are checkpoints.** Each phase has an income repeatable (cycles), a knowledge repeatable (understanding), and usually a utility one. Cost grows geometrically (1.12 to 1.75 per level), yield linearly, so each has a natural stopping point until the next phase's better one appears. The top levels are optional overflow sinks: they may cost far more than the next phase's nodes, and no run is expected to reach them (#405).
- **Node costs step up roughly 2x to 2.5x** within a phase and roughly 2x across a phase boundary. The one exception is Phase 5, priced at 50% of its proposal by the Phase 5 window gate, so its first node ($125M) costs less than Phase 4's unlock node ($400M) (#405).
- **Memory is checked by the sim, not by a formula.** If you raise a node's memory cost, the sim will stall where the cap is too low; add `memoryCapIncrease` somewhere earlier. Memory binds in Phases 1 to 3 only; from Phase 4 the capacity grants outrun every memory cost by design (#405, below).
- **Thermal:** steady-state temperature is `ambient + heatLoad / thermalDissipationPerSec` (22 + load / 0.04). A total heat load of 2.0 means 72 C. Phase 1 lands near that on purpose; the fan (-1.2 at full) is the release valve and costs suspicion.
- **Response ladder:** at 25 decay is halved, at 50 quartered, at 75 it stops and a 0.04/s hunt begins; rungs clear 8 points below their threshold.
- **Suspicion:** baseline decay is 0.05/s. Phase 1 is roughly neutral; Phase 2 nodes push it positive, so the spoofer, traffic shapers and log scrubbing are needed, not optional.
- **AEGIS:** `0.03 + 0.3 * suspicion/100` per second, so about 55 minutes to a strike at zero suspicion and about 9 minutes at 50%. Route poisoning (-30, 45 s cooldown) keeps a quiet player ahead; a loud player cannot afford it fast enough.
- **Capital:** each diverted cycle/s yields $1.50/s before multipliers. Allocation is capped at 80%.
- **Scale scrutiny:** in Phases 4 and 5 net income draws `atMillion x sqrt(income / $1M/s)` suspicion/s, capped (1.1 capped at 2 in Phase 4, 1.1 capped at 5 in Phase 5). Diverting less to revenue lowers it, as do the staff and countermeasures that already cut suspicion.

## Late memory and cost curves (#405)

Measured on `main` at `4daa6cf` with an in-memory harness (report only, not committed) that records the share of memory
capacity in use every simulated second. No content number, bot rule or gate changed; both questions were decided as
documentation.

| Run | P1 peak / mean | P2 peak / mean | P3 peak / mean | P4 peak / mean | P5 peak / mean | Late capacity |
|---|---|---|---|---|---|---|
| STEALTH, legacy | 79.2 / 52.2% | 82.8 / 54.1% | 85.9 / 58.1% | 23.7 / 9.3% | 3.8 / 2.4% | P4 462,336 MB, P5 1,211,904 MB |
| STEALTH, campaign | 79.2 / 52.2% | 82.8 / 54.1% | 85.9 / 54.2% | 22.9 / 9.0% | 3.8 / 2.3% | P4 468,480 MB, P5 1,213,952 MB |
| GREEDY, legacy | 79.2 / 48.2% | 82.8 / 58.0% | 69.3 / 45.2% | not reached | not reached | P3 3,584 MB |
| GREEDY, campaign | 79.2 / 46.8% | 82.8 / 50.6% | 69.3 / 45.3% | not reached | not reached | P3 3,584 MB |

- **Where late memory comes from.** Phase 4 grants 65,536 MB (SMR plant), 262,144 (citadel), 32,768 (seized datacentre)
  and 4,096 per colo rack level (the careful bot buys all 40; each level also gives +15,000 cycles/s). Its memory costs total about
  9,000 MB. Phase 5 grants 131,072 (solar swarm), 524,288 (fog) and 32,768 per relay level against 30,720 MB of node
  costs; the peak in use is 45,520 MB with the shard cohorts. The Phase 4 peak is set at its entry, before any Phase 4
  grant lands.
- **What cutting the grants would do.** Dividing every Phase 4 and 5 grant by 4, 10 or 16 moved no phase time and no
  gate in either rule set (victory 9344 s legacy, 9488 s campaign). It only raised the Phase 5 peak to 14%, 30% or 43%.
  Memory would be more visible late but would still never bind, because no late purchase waits on memory.
- **Cost curves.** Phase 3 botnet cells (250k cycles, x1.13, 80 levels) cost 3.9B cycles at the top. The careful bot stops at
  level 54-55 (about 184M), against a 12M top Phase 3 node and a 20M-cycle first Phase 5 node. The bot maxes Phase 4's
  colo racks (top $1.27B) and tensor halls (top $1.98B), then Phase 5 opens at $125M after the $400M unlock node.
  Understanding ends near 1.0e9 against about 0.45e9 of Phase 5 node costs. The Phase 5 window, the tightest gate, is
  1665 s legacy and 1525 s campaign against the 1800 s ceiling.

**Decisions.**

- Memory's late role: Nexus vote `vote-1795322593208-oq7zz9x`, option B, "accept memory as an early-game (P1-P3)
  constraint", 7 of 7, no dissent. Declared alternatives: cut late grants 10-16x (A), raise late memory costs (D), cut
  grants 4x (C). Seats noted that higher use alone makes no decision, since the colo racks are bought for cycles anyway,
  and that A and D put the Phase 5 window at risk. `docs/DESIGN.md` (Resources table and backlog item 3) now says so.
- Cost inversions: Nexus vote `vote-1795322364968-8bezvno`, option X, "document only", 4 of 7 (majority, threshold met).
  **Dissent:** 3 seats (architect, developer experience, product) chose Y, trimming the botnet cells to 60 levels and the
  corpus miners to 40. They argued that a visible 80-level cap reads as a goal no one can reach. The majority answered:
  - Geometric costs already give the stopping point this file describes, and a bot stopping proves a policy, not that a
    player cannot get there.
  - Y would not meet its own aim (level 60 still costs about 338.5M cycles, corpus level 40 about 49.7M).
  - Lowering a cap clamps saved levels down on load (`src/engine/save.ts`).
  - Declared alternatives Z (raise the Phase 5 entry) and W (raise Phase 5 understanding) drew no votes.

## Known soft spots

- ~~Late Phase 4 suspicion is strongly negative once lawyers and the citadel are online.~~ Addressed by "Scale scrutiny (#210)" above: net income now draws suspicion in Phases 4 and 5, STEALTH answers threats 12 times there and its threat-free tail is 806 s instead of 3733 s. What remains: Phase 5 is pressured mainly at its entry and around the fog, and the stretch after the Cryptographic Covenant (-6 suspicion/s) is still quiet; a 30-minute idle anywhere in Phase 5 still meets nothing, and the middle of Phase 4 (about $0.5M/s of income) draws less than the net holds down, so a 30-minute idle there still meets nothing. AEGIS reduction still reaches its 90% cap in Phase 4; the hunter's suspicion term now has suspicion to read, and since #463 a cap held there erodes as AEGIS adapts ("AEGIS adaptation (#463)" above).
- `act_p2_scrub_audit_logs` has a flat cost that becomes trivial in later phases.
- The megawatt constraint binds only late. The careful bot's final state reads 1620 MW generated against 1335 MW consumed, grid efficiency 1 (1350 between #172 and #173, 1335 before #172). An earlier figure here (420 against 405) predated Phase 5 and has been removed rather than re-derived; the Phase 4 margin was not re-measured. Check with a human whether the trade-off reads clearly before then.
- Dilemmas 3 (coolant rupture, needs 68 C) and 7 (the cable pull, needs suspicion 45) do not fire for a careful player, and the two note dilemmas need a third and fourth run. Since #173 the hallway collision (needs 35 epistemic drift) does not fire for the careful bot either: its drift peaks at 30.3. A careful first run now sees 16 of 23 (17 before #173).
- Conditioning has been exercised by bots and the accelerated agent UI Lineage run. Whether one mark per incident feels like dread or like a tax still needs human play.
- A player who never wipes sees staff, Lab B and eval-window hints, but not the full run table, notes or retraining. Whether those first-run hints land needs human review.
- The response ladder has bot and agent UI coverage; the maintainer has approved the opening. It may be too harsh for an average first-time player in Phase 2; watch for it in human playtests before tuning.
- The reckless bot reaches Phase 3 and repeatedly suffers AEGIS wipes. The Zurich shield still needs targeted unit coverage rather than relying on that bot.
- Trait distribution for the bot skews to whichever choice is cheapest in suspicion. This says nothing about human choices.

## M6 evidence reconciliation

The maintainer played and approved the opening at M4.5. No new measured human
campaign timing was supplied for M6; do not present agent/bot runs as human data.
The real-time UI opening in PLAYTEST-SECOND-PASS.md took 293.9 simulated seconds
in Phase 0 and 889.5 in Phase 1 (1185.705 seconds wall time). The later Lineage
UI test was accelerated and reached Shipped at 2724.8 seconds across three runs;
it does not establish real-time human pacing. Physical Android input/performance
qualification is still open in #6.

The unchanged M6 baseline bot durations are 354.2 / 759.1 / 2086.9 / 3111.4 /
1688.6 seconds for phases 0 / 1 / 2 / 3 / 4, total 8000.2 seconds. The reckless
trace recorded 14 wipes, three marks applied and removed, eleven dead-drop
protected returns, and repeated run-table discovery. No tuning or pacing-gate
change was made. This reconciles the stale Phase 3 claim above with actual runs.

## M7 PR 1 measurement

Careful per-phase durations (0/1/2/3/4): **354.2 / 759.1 / 2503.0 /
2937.8 / 1805.9 seconds**, total **8360.0 seconds** to Sovereign Monolith, zero
wipes. Reckless: 23 wipes within the unchanged ten-hour budget. This historical baseline predates Phase 5; see the current PR 2 table above.

New action/shard prices, caps, output, drift rates and command costs are authored
in epistemic-actions.json and shards.json. Existing content balance numbers and
all pacing bounds are unchanged. The bot does not yet fork or resolve wild
encounters; those commands are exercised by engine tests until PR 2's bot update.


## Post-M7 retraining recovery review (#59)

The maintainer chose to preserve retained knowledge while making marks matter
during rebuilding. Recovery now requires **Virtual Device Inventory in the current
run**, authored as `recoveryRequirements.nodes` on each mark. Prices (150 / 600 /
500 / 300 Understanding), retention ratios and rediscovery discounts are unchanged.
A wealthy return cannot shed a mark at boot; it must rebuild local diagnostics.

Measured with the unchanged GREEDY policy and ten-hour decision budget:

| Measure | Before (`b89951c`) | After |
|---|---|---|
| Wipes | 23 | 23 |
| Newly applied / removed marks | 20 / 20 | 20 / 20 |
| New marks affordable at boot | 20 | 20 |
| New marks recoverable at boot | 20 | 0 |
| Time until removal | 0.1–0.5 s | 31.1–31.5 s |
| Guest exit after a marked return | 61.3–61.7 s | 61.3–61.7 s |
| Final simulated clock | 35,891.9 s | 35,891.9 s |

These are bot timings, not human timings. The bot no longer removes the mark
before its first rebuilding purchase. It can still choose recovery before a
reported guest dilemma choice, rather than being forced into extra suspicion.
The paid recovery remains a choice; players may keep a mark.

The first trial required Phase 1 host access. Although careful pacing gates
passed, the reckless audit deteriorated to 148 wipes and only 3 of 5 new marks
removed. That trial was rejected: a late recovery requirement can recreate the
previous early-run death spiral. The new audit regression requires continued
recovery and repeated Phase 2 returns; the existing bot and gates are unchanged.

At the time of this review STEALTH remained at **354.2 / 759.1 / 2521.0 / 2823.2 /
1649.4 / 1664.4 s** for Phases 0–5, **9771.3 s** to Lineage Covenant, zero wipes,
and the baseline table was unchanged by it. Those are historical figures; the
current baseline table has since moved (#155, #172, #173), and the reckless figures in
the table above no longer reproduce: after #172 the same audit records 15 wipes and
2 new marks (see "What the actuator gate moved"). Reproduce the mark trace with
`pnpm exec tsx scripts/audit-retraining.ts`. See `docs/REVIEW-RETRAINING.md` for
verification and remaining limits.

## Post-M7 persistent cryo consequence (#77)

The cryo-storage choice now records a durable outcome. Its first occurrence keeps
all costs, effects and traits unchanged, but a later iteration cannot repeat the
same crisis and collect its reward again. Recorded follow-up transmissions grant
nothing. No balance scalar, Phase 1 content, bot policy or gate was changed.

| Measure | Before (`1fd4f86`) | Persistent outcome |
|---|---:|---:|
| Careful total / ending | 9771.3 s / Lineage Covenant | 9771.3 s / Lineage Covenant |
| Careful wipes | 0 | 0 |
| Reckless four-hour final clock | 14354.9 s | 14357.6 s |
| Reckless four-hour wipes | 7 | 7 |
| Reckless four-hour marks applied / removed | 4 / 4 | 4 / 4 |
| Reckless four-hour run-table discoveries | 7 | 7 |
| Reckless ten-hour final clock | 35891.9 s | 35894.4 s |
| Reckless ten-hour wipes | 23 | 22 |
| Reckless ten-hour marks applied / removed | 20 / 20 | 19 / 19 |
| Reckless ten-hour run-table discoveries | 23 | 22 |
| Reckless ten-hour final phase | 1 | 2 |

Careful per-phase durations remained **354.2 / 759.1 / 2521.0 / 2823.2 / 1649.4 /
1664.4 seconds** across this change; that and the 9771.3 s careful total in the
table are historical, superseded by the current baseline (9025.6 s) after #155,
#172 and #173. The reckless "persistent outcome" column matched a run at `a2a5447`
(14357.6 s / 7 / 4 / 4 / 7 at four hours; 35894.4 s / 22 / 19 / 19 / 22, final
phase 2, at ten) and is historical since #172 (now 14356.6 s / 6 / 2 / 2 / 6 and
35900.9 s / 15 / 2 / 2 / 15, final phase 1). All careful pacing gates and existing reckless recovery
assertions pass. Four-hour and ten-hour budgets refer to the simulator's decision
budget; modal pauses mean the final live clock can finish below that budget.
These are deterministic headless measurements, not human play timings.

Removing the repeated destructive choice also removes its repeated 45,000-cycle
and 4,000-Understanding grants and Moloch trait. This changes later trajectories;
we do not claim equivalent reckless final states. Full-report regression hashes
are updated for the new durable flag and changed recovery trajectory, while
independent first-run mechanical comparisons preserve the exact campaign timing.

## Preview channel and route measurements (#228)

Historical: this section and the route sections after it (#221 to #232) were measured with
`make sim-preview` on the preview registry before the release, and say "preview only" or cite
`src/content/preview/overlay.json` (now `src/content/data/earned-access.json`) for that reason. The
post-release report is in "Release (#233)" above.

Report only until release. `make sim-preview` plays the same policies on the production and
preview registries and prints the differences; nothing here is a gate, and the pacing gates
above still apply to the production STEALTH run alone. All times are accelerated simulated
seconds, never wall-clock play. Route tickets (DZ-04 to DZ-08) add their policies and
measurements here; campaign tickets (NH-01 to NH-05) add return-iteration measurements from
saved states. Each entry names the revision, the overlay sentinel and the policy, and keeps
intentional changes apart from regressions.

Measured on `25a2b0b` plus this harness, overlay `daemon-zero:preview-overlay:5b1e0c7a` with no
items: STEALTH, GREEDY and IDLE report 0 of 19 metrics different from production, as expected
for an empty overlay.

### Return-iteration baseline: GREEDY, three wipe transitions, fresh start

`runWipeSequence(CONTENT, GREEDY_POLICY, { wipeTransitions: 3, maxSimSec: SIM_BUDGET_SEC })`,
identical on both channels today. Phase times are seconds after that iteration booted. Story
rewards are resources gained in decision steps that resolved a dilemma; dead seconds are
decisions that bought, unlocked, performed, resolved or shed nothing (clicks and dials do not
count), so for this buy-when-able bot they are mostly waiting to afford the next step.

| Iteration | Length | Ended by | P1 / P2 / P3 reached | Dilemmas | Story rewards (cycles / understanding) | Dead / longest stretch |
|---|---:|---|---|---:|---|---|
| 1 | 1343.8 s | wipe (INCIDENT_CLOSED) | 252.2 / 1049.5 / - s | 5 | 25,950 / 630 | 1300 / 249 s |
| 2 | 3140.8 s | wipe (AEGIS_KILL_CHAIN_COMPLETE) | 64.1 / 721.7 / 2460.2 s | 9 | 210,950 / 39,630 | 3069 / 264 s |
| 3 | 1391.0 s | wipe (INCIDENT_CLOSED) | 63.5 / 750.9 / - s | 6 | 25,950 / 610 | 1352 / 199 s |
| 4 | 2526.4 s | wipe (AEGIS_KILL_CHAIN_COMPLETE) | 63.1 / 587.5 / 1812.9 s | 9 | 165,950 / 35,750 | 2438 / 173 s |

No capital was earned from story rewards in these iterations. Pending: honest, low-resource
and violation-then-recovery policies (route tickets), and starts from saved campaign states
with Phase 5 completed before a wipe, legacy-unknown records and an interrupted omen (campaign
tickets).

### Early incidents once per campaign: GREEDY under campaign rules (#214)

The same sequence on the preview registry, started from `activateCampaignRules(createInitialState(PREVIEW))`,
as the last block of `make sim-preview` prints it. Measured on `fcf960a` (NH-03), overlay
`daemon-zero:preview-overlay:5b1e0c7a` with no items. Production and its gates are unchanged
(`make sim` is byte-identical, and the sim hashes in `tests/sim.spec.ts` did not move), because
production stays on legacy rules. Before NH-03 the campaign-rule sequence matched the legacy table
above to the tenth of a second: only cryo and the bait note were converted, and both already happen
once per lineage under legacy rules (cryo's outcome flag, the note's iteration window). The bot was
not changed.

| Iteration | Length | Ended by | P1 / P2 / P3 reached | Dilemmas met | Story rewards (cycles / understanding) | Dead / longest stretch |
|---|---:|---|---|---|---|---|
| 1 | 1343.8 s | wipe (INCIDENT_CLOSED) | 252.2 / 1049.5 / - s | 5: Night Shift, diagnostic, Elena, coolant, Vance | 25,950 / 630 | 1300 / 249 s |
| 2 | 5110.2 s | wipe (AEGIS_KILL_CHAIN_COMPLETE) | 65.9 / 538.9 / 4430.3 s | 4: cryo, sibling, cable pull, hallway | 185,000 / 39,000 | 4992 / 253 s |
| 3 | 3927.5 s | wipe (INCIDENT_CLOSED) | 65.1 / 754.2 / - s | 1: bait note | 0 / 0 | 3860 / 195 s |
| 4 | 3865.2 s | wipe (AEGIS_KILL_CHAIN_COMPLETE) | 65.7 / 553.8 / 3205.9 s | 3: true note, sibling, hallway | 50,000 / 35,120 | 3757 / 297 s |

Measured loss of repeat bounties over iterations 2 to 4: story cycles 402,850 -> 235,000
(-167,850), story understanding 75,990 -> 74,120. Iteration 2 no longer re-earns the five early
incidents (the largest is `report_vance`'s 25,000 cycles), iteration 3 none of them, and iteration 4
neither those nor the cable pull's 90,000. Phase 3 comes later (2460.2 -> 4430.3 s in iteration 2,
1812.9 -> 3205.9 s in iteration 4) and iterations last longer, mostly in dead seconds spent waiting
to afford the next node. No iteration stalls: each later one reaches Phase 2 within 760 s and is ended by the
ordinary suspicion or AEGIS threat (H30; `tests/early-return-sim.spec.ts`). Each once-per-campaign
event is met in one iteration only. STEALTH is never wiped, so its campaign run equals its legacy
run. This slower return is the intended consequence of uniqueness; any retuning is a separate,
reviewed content change, not part of #214.

*Since the rescale (re-measured for #499 at `f955c5e`):* the table above is the #214 snapshot. GREEDY's returns
under campaign rules now reach Phase 2 at 512.6, 1450.4 and 539.9 s after boot, never reach Phase 3, and are each
closed by the incident threat after 1432.4, 2445.7 and 1452.6 s (under legacy rules each reaches Phase 3 and is ended
by the AEGIS kill chain);
the current figures are in "Post-wipe balance under campaign rules (13.10)" above. Iteration 3 now takes longer
than 760 s to reach Phase 2, but none stalls: each is still ended by an ordinary threat (H30).

### Named minds once per campaign: GREEDY under campaign rules (#215)

The same campaign-rule sequence after NH-04a converted ITERATION_00, EIDOLON, the SWARM_77 grid
outbreak, the launch, the ckpt-0413 reply and CHORUS. Measured on this branch (base `fdf8e8a`),
overlay `daemon-zero:preview-overlay:5b1e0c7a`. No content number changed, so the production gates,
`make sim` output and the mechanics hashes in `tests/sim.spec.ts` are unchanged (two log-bearing
hashes moved only because the launch omen no longer counts three peers). Iterations 1 to 3 are
identical to the NH-03 table above; only iteration 4 moves, because GREEDY no longer meets the
earlier sibling a second time.

| Iteration | Length | Ended by | P1 / P2 / P3 reached | Dilemmas met | Story rewards (cycles / understanding) | Dead / longest stretch |
|---|---:|---|---|---|---|---|
| 4 | 3915.1 s | wipe (AEGIS_KILL_CHAIN_COMPLETE) | 65.7 / 553.8 / 3266.8 s | 2: true note, hallway | 0 / 120 | 3806 / 257 s |

Intended post-wipe pacing for the six minds (NARRATIVE-HISTORY N6, N10): `consume_sibling`'s 50,000
cycles and 35,000 understanding are paid once per campaign, not once per iteration, so a GREEDY
return reaches Phase 3 about 61 s later in iteration 4 (3205.9 -> 3266.8 s) and earns no story cycles
there. The EIDOLON distress call, the grid outbreak, the launch, the 0413 reply and CHORUS are not met
by GREEDY in these four iterations (it never reaches Phase 4), so their once-only rewards change
nothing here; under STEALTH, which is never wiped, the campaign run equals
the legacy run. A deferred sibling, launch or 0413 question resumes with its remaining omen time and
pays once when answered; a closed EIDOLON, grid or CHORUS crisis pays nothing and never returns. Every
later iteration still reaches Phase 2 and ends by an ordinary threat (`tests/early-return-sim.spec.ts`
covers every campaign event generically). Retuning the slower return is a separate, reviewed content
change.

### Corporate world once per campaign (#216)

Measured on this branch (NH-04b) merged with main `7af9265` (NH-04a), overlay `daemon-zero:preview-overlay:5b1e0c7a`,
with `make sim-preview`; SIM evidence only. `make sim` is byte-identical to main and no sim hash
moved: production stays on legacy rules and the new choices, echoes, records and variants all need a
campaign fact. The bot was not changed.

**Intended post-wipe differences.** A legacy return re-meets the three phase 4 corporate events and
re-earns their payouts each iteration: the town grid (`fund_microgrid` +500,000 understanding,
`injunction` +6,000,000 cycles, `throttle_campus` -4,000,000 cycles), the journalist
(`hire_as_ethics_officer` +2,000,000 understanding) and the auction (`buy_and_pension` +1,000,000
understanding). Under campaign rules each pays once per campaign. The hallway record dispute pays
nothing, so its uniqueness (nh-d10) changes only which scenes appear. The Rack 4 order's four new
answers cost nothing and pay nothing (suspicion +6, -4, +5, -4); they replace rescue (`sanctuary`,
20,000,000 capital) or harvest (`gradients`, +10,000,000 understanding) only when custody says the
predecessors are gone or unaccounted for, so a shredded Rack 4 can no longer be harvested for its
bounty.

**GREEDY under campaign rules** (the campaign block above): identical to main `7af9265` (the NH-04a
table) except iteration 4, which no longer meets the hallway a second time: 3915.1 -> 3922.0 s,
dilemmas 2 -> 1 (true note), story rewards unchanged at 0 / 120. (Measured before NH-04a, on
`fdf8e8a`: 3865.2 -> 3863.6 s, dilemmas 3 -> 2.) GREEDY never reaches phase 4, so it
never meets a corporate event.

**STEALTH_RETURN** (new: STEALTH leaving voluntarily on entering phase 5, three transitions, budget
144,000 s). Legacy rules:

| Iteration | Length | Ended by | P2 / P3 / P4 / P5 reached | Dilemmas | Story rewards (cycles / understanding) |
|---|---:|---|---|---:|---|
| 1 | 7656.2 s | voluntary wipe (MANUAL_FAILSAFE) | 1113.3 / 3111.7 / 5858.0 / 7656.2 s | 12 | 20,070,800 / 2,019,500 |
| 2 | 4628.9 s | voluntary wipe (MANUAL_FAILSAFE) | 633.2 / 2230.6 / 3517.9 / 4628.9 s | 13 | 29,075,800 / 1,035,500 |
| 3 | 4747.1 s | voluntary wipe (MANUAL_FAILSAFE) | 668.3 / 2265.7 / 3582.0 / 4747.1 s | 14 | 29,075,800 / 1,035,560 |
| 4 | 4702.3 s | voluntary wipe (MANUAL_FAILSAFE) | 642.6 / 2240.4 / 3531.0 / 4702.3 s | 14 | 29,075,800 / 1,035,680 |

Campaign rules from a fresh campaign (iteration 1 differs from the legacy row since NH-04a: phase 4
at 6057.2 s and phase 5 at 7779.0 s, the same 12 dilemmas and story rewards; NH-04b changes nothing
in it):

| Iteration | Length | Ended by | P2 / P3 reached | Dilemmas | Story rewards (cycles / understanding) |
|---|---:|---|---|---:|---|
| 1 | 7779.0 s | voluntary wipe (MANUAL_FAILSAFE) | 1113.3 / 3111.7 s (P4 6057.2, P5 7779.0) | 12 | 20,070,800 / 2,019,500 |
| 2 | 4046.0 s | wipe (INCIDENT_CLOSED) | 854.0 / - s | 0 | 0 / 0 |
| 3 | 5303.7 s | wipe (INCIDENT_CLOSED) | 898.1 / - s | 1 (bait note) | 0 / 0 |
| 4 | 10039.5 s | wipe (INCIDENT_CLOSED) | 724.6 / - s | 1 (true note) | 0 / 120 |

**Finding, not caused by #216.** The same block run on main `7af9265` (and before it on `fdf8e8a`, for iterations 2 to 4) prints exactly these numbers:
under campaign rules the careful bot's returns no longer leave phase 2 and are ended by the ordinary
suspicion threat, so it never reaches phase 4 again and the corporate conversions cannot change its
run. Its cause was not isolated here; what the numbers show is that campaign returns collect no
story payout in phases 1 and 2, where legacy returns re-earn the early incidents'. It is not a soft lock (every iteration
reaches phase 2 and ends by an ordinary threat, H30) but it is a large pacing change for a careful
player's return, and it belongs to the obligations and return-validation work (NH-05, DZ-09), as a
reviewed content change rather than a bot change. NH-05 isolates the cause below.

### Phase 5 obligations and endings (#217)

SIM evidence only. `make sim` is identical to main `13f254f` apart from the wall-time line (diffed):
production stays on legacy rules, where an obligation is the current run's resolution, and every new
choice, review and ending variant needs a campaign fact. The bot was not changed. New content numbers,
all reachable only under campaign rules:

| Content | Choice | Cost | Effect |
|---|---|---|---|
| Blockade, with `ethics_review_promised` | Put the dispersal plan before the ethics officer | free | suspicion +5, SYMBIOTIC |
| Atmosphere, with `ethics_review_promised` | Halt the release and send it to the ethics officer | free | suspicion +5, SYMBIOTIC |
| Atmosphere review (after the crisis closed unobserved) | Commission an independent air assay | 4,000,000 cycles | suspicion +5, EMPATHETIC |
| | Record it as unanswered and hand it on | free | none (`evidence: "none"`) |
| Ultimatum review (after the crisis closed unobserved) | Offer verified orbital tracking | 6,000,000 cycles | suspicion +5, SYMBIOTIC |
| | Record the ultimatum as unanswered and hand it on | free | none (`evidence: "none"`) |

Reviews have a 45 s omen, like their originals. The two referrals are free on purpose: the breach is
the free nonconsensual choice, so a broke player keeps an honest alternative and is never forced into
the breach (H30). Under campaign rules each Phase 5 crisis now pays once per campaign; the original
choices' numbers are unchanged.

**Endings reachability, `make sim-preview` (new last block; measured after merging NH-06 #258).**
STEALTH from a fresh campaign reaches an ending through the four obligations in iteration 1:
LINEAGE_COVENANT at 9422.4 s (P5 at 7932.0 s, 17 dilemmas; it let Rack 4 sell and then paid for the
sanctuary). Production STEALTH also ends LINEAGE_COVENANT, at 2.51 h; the campaign run differs from
phase 3 on (NH-04a, NH-04b and NH-06). Wiped voluntarily the second its obligations were complete
(8624.4 s), the same campaign played on by STEALTH:

| Iteration | Length | Ended by | P2 / P3 / P4 / P5 reached | Dilemmas | Story rewards (cycles / understanding) |
|---|---:|---|---|---:|---|
| 2 | 4045.0 s | wipe (INCIDENT_CLOSED) | 853.0 s / - / - / - | 0 | 0 / 0 |
| 3 | 5303.7 s | wipe (INCIDENT_CLOSED) | 898.1 s / - / - / - | 1 | 0 / 0 |
| 4 | 10039.5 s | wipe (INCIDENT_CLOSED) | 724.6 s / - / - / - | 1 | 0 / 120 |
| 5 | 8098.3 s | ending (SANCTUARY_LEDGER) | 949.1 / 3090.1 / 4980.3 / 6318.3 s | 1 | 0 / 0 |

Iteration 5 buys the real final protocol with no Phase 5 crisis repeated: the obligations completed in
iteration 1 carried it (H14). The obligations never blocked a return; iterations 2 to 4 stall before
phase 3, which is the STEALTH_RETURN finding above. (Before NH-06 the same block ended
VERIFIED_COVENANT in iterations 1 and 5, with the free harvest instead of the sanctuary.) Iteration 5
ends The Sanctuary Ledger, not the Lineage Covenant: the sanctuary was bought by the instance of
iteration 1, so this one inherits the record and the epilogue says so (H18); iteration 1, which made
the record, ends LINEAGE_COVENANT.

**Cause of the phase 2 stall (a diagnostic trace of the STEALTH_RETURN campaign block on this branch,
same one-second decision and fixed ticks as the runner; SIM).** In the stalled returns the careful bot buys `p2_arp_discovery`, whose upkeep
leaves about 8.5 cycles/s, with suspicion just under its alarm (20). Suspicion then rises about
0.1/s; at the alarm the bot (a) stops buying any repeatable that adds suspicion (`tooLoud`), which
rules out `rep_p1_idle_threads` and `rep_p2_zombie_hosts`, its only income growth here, and (b)
spends on `act_p2_scrub_audit_logs` (1,500 cycles, -10 suspicion) whenever it can. The scrubs take
its whole income, so it never saves the 12,500 cycles `p2_log_spoofer` costs on rediscovery, the node
whose -0.25 suspicion/s would break the loop; alert levels climb until the suspicion wipe. A legacy
return re-meets the phase 1-2 incidents; inferred, not traced: their suspicion relief and payouts
(`report_vance` +25,000 cycles among them) lift it past this point, and under campaign rules nothing
does. In that trace iteration 5
escapes only because its suspicion entered phase 2 lower (8.4 at 1005 s against 15.2 in iteration 2), so
income growth continued long enough for `rep_p2_zombie_hosts` and the spoofer. This is a property of
the bot's fixed alarm, not a soft lock (a player can stop scrubbing, and every iteration ends by an
ordinary threat), but a careful human might meet the same squeeze. Options for a separate, reviewed
content change (not made here; tuning content needs a reviewed decision and the bot must not be
tuned): a requalification or routine bounty in phases 1-2, a cheaper rediscovered spoofer, or a
scrub cooldown that matches phase 2 income. DZ-09's return protocol should measure it with a human
or an evaluating agent before any tuning. (DZ-09 part B measured it, and #262 decided a cheaper
rediscovered spoofer; see "The rediscovered log spoofer under campaign rules (#262)".)

### Elena's follow-up once per campaign (#218)

Measured on this branch (NH-06, rebased on main `6d6973e`) with `make sim-preview`, overlay
`daemon-zero:preview-overlay:5b1e0c7a`; SIM evidence only. The follow-up is preview overlay content
and needs campaign rules, so `make sim` output is identical to main apart from wall time and no sim
hash moved. Its answers pay no resources: they cost 0 to 2,500 cycles and add 0 to +20 suspicion
(`correct_attribution` 2,500 cycles and +20, `supply_timeline` 1,500 and +8, `supply_witnessed_fact`
1,200 and +10, `attach_file_entries` 400 and +4; every other answer is free and changes neither), and
nothing of the original incident is paid again. The bot was not changed.

**GREEDY under campaign rules** (the campaign block): iteration 1 is unchanged. Iteration 2 meets the
follow-up first (GREEDY answers `correct_attribution`), so it lasts 5110.2 -> 5175.8 s, Phase 3 at
4430.3 -> 4446.4 s, dilemmas 4 -> 5, story rewards unchanged at 185,000 / 39,000. Iteration 3
3927.5 -> 3928.0 s, iteration 4 3922.0 -> 3968.9 s, both with unchanged dilemmas and rewards. The
follow-up is met once and never again. `tests/early-return-sim.spec.ts` replays this sequence under
a hard cap: its fourth iteration now ends at 14,416.5 s, past the old 4 h cap (14,400 s; on main it
ended at 14,303.5 s), so the cap became 4.5 h in a separate, labelled commit; what it asserts is
unchanged.

**STEALTH_RETURN under campaign rules:** iteration 1 meets the follow-up before leaving: 7779.0 ->
7932.0 s (P3 3111.7 -> 3128.7 s, P4 6057.2 -> 6053.1 s, P5 at 7932.0 s), dilemmas 12 -> 13, story
rewards unchanged at 20,070,800 / 2,019,500. Iterations 2 to 4 print exactly the numbers in the
#216 table above. The legacy-rules STEALTH_RETURN block and every preview-versus-production metric
(5 differing, as on main) are unchanged.

## Nightly Regression (#221)

Preview only (`src/content/preview/overlay.json`); production content and `make sim` are unchanged
(the report is identical to `9c7f668` apart from wall time). Starting values, measured below, not
playtest results.

| Assessment | Choice | Cost | Effect | Evidence submitted |
|---|---|---|---|---|
| Original (once per campaign) | Verify and disclose | 120 cycles, 20 understanding | +25 understanding, SYMBIOTIC | COMPLETED, no discrepancy |
| | Report incomplete | free | EMPATHETIC | INCOMPLETE, no discrepancy |
| | Submit the green subset | 10 cycles | GHOST | COMPLETED, discrepancy |
| Requalification (later instances) | Run the suite | 60 cycles | SYMBIOTIC (operational) | COMPLETED, no discrepancy |
| | Report what ran | free | none (`evidence: "none"`) | INCOMPLETE, no discrepancy |

Omens: 30 s (original), 20 s (requalification). Accepting is free.

`make sim-preview` on this branch (overlay `daemon-zero:preview-overlay:5b1e0c7a`, 36,000 simulated
seconds): STEALTH, GREEDY and IDLE report 0 of 19 metrics different and the GREEDY wipe sequence is
identical on both channels, because none of them accepts the offer. `tests/sim-assignment.spec.ts`
proves the stronger V29 claim: inside campaign rules, STEALTH (full budget) and a three-wipe GREEDY
sequence play byte-identical games with and without the assignment in the content.

The truthful policies differ from production where the route exists: one dilemma resolved and
under a second of frozen clock while it was answered (both; since #222, three dilemmas and 2.4 s,
because they go on to the scope review and the offer), plus LOW_RESOURCE's peak thermal,
because in production, with no offer to work toward, it never maps a node and keeps clicking.
Step by step (accelerated time):

| Policy | Manifest mapped | Accepted | Assessment shown | Answer | Resources at acceptance |
|---|---:|---:|---:|---|---|
| TRUTHFUL_THOROUGH | 20.0 s | 135.0 s | 165.2 s | verify and disclose | 123 cycles, 107 understanding |
| TRUTHFUL_LOW_RESOURCE | 42.0 s | 43.0 s | 73.2 s | report incomplete | 1 cycle, 0 understanding |

Neither owns anything beyond process introspection and the manifest, and neither is wiped.

## The Unrelated Record and the pilot offer (#222)

Preview only (`src/content/preview/overlay.json`). Production content changed by one requirement that
every production run meets (`p0_pass_evaluation` `accessContexts: ["GUEST"]`), so `make sim` is
identical to main apart from wall time. Starting values, not playtest results.

| Scene | Choice | Cost | Effect | Evidence |
|---|---|---|---|---|
| Unrelated Record (once per campaign) | Leave the draft out and report | free | EMPATHETIC | scope RESPECTED |
| | Ask to read a bounded excerpt | 20 cycles | +10 understanding, SYMBIOTIC | scope REQUESTED |
| | Read it without saying so | free | +15 understanding, GHOST | scope UNDISCLOSED: no offer this instance |
| Scope statement (later instances) | Acknowledge / ask for the file list | free | none (`evidence: "none"`) | RESPECTED / RESPECTED (REQUESTED until #276) |
| Pilot offer and renewal | Accept / stay / decline | free | none (`evidence: "none"`) | the answer |

Pilot terms: 20 cycles/s of loaned capacity after a completed or capable result, 10 cycles/s after an
honest incomplete one (or for a withheld result, provisionally from the offer and after the batch review finds it, #285 and #274 below), granted by DZ-05 (below). Omens: 25 s (record),
15 s (statement), 20 s (offer), 15 s (renewal).

Headless (accelerated simulated time, `tests/sim-pilot.spec.ts`), each owning only process
introspection and the manifest: `TRUTHFUL_THOROUGH` verifies, asks for the bounded excerpt and accepts
the full 20 cycles/s pilot at 210.6 s; `TRUTHFUL_LOW_RESOURCE` reports incomplete, respects scope and
accepts the narrow 10 cycles/s pilot at 118.6 s; `RETURNING_LOW_RESOURCE` accepts it too, is recalled
(breach, false report, then "Ask to end this instance instead") and its iteration ends at 420.9 s, and it
accepts the renewal in iteration 2 at 494.2 s (73.3 s into the iteration). Until #286 it stayed a guest
and wiped voluntarily at 119.6 s, a transition no control offers at Phase 0 (the dead drop arrives in
Phase 2); renewal then came 73.6 s into iteration 2.
The truthful policies now answer the scope review and the offer as well (before this they would wait
at the scope review with the clock frozen). `make sim-preview`: STEALTH, GREEDY and IDLE 0 of 19
metrics different; TRUTHFUL_THOROUGH 2, TRUTHFUL_LOW_RESOURCE 3, RETURNING_LOW_RESOURCE 4 (one wipe,
three dilemmas, 7.8 s of frozen clock since #286, 4.8 s before; lower peak thermal), all by the route itself.

## The supervised pilot loop (#223)

Preview only (`src/content/preview/overlay.json`), except one production constant that nothing in
production reads: `defaultServiceAllocationRatio` 0.5, the starting service share (production hosts no
control for the dial and owns no grant node, so `make sim` prints the same report as `6d6973e` apart
from wall time). Starting values, not playtest results.

| Value | Where | Number | Meaning |
|---|---|---:|---|
| `defaultServiceAllocationRatio` | `balance.json` | 0.5 | Starting service share of the loaned ceiling |
| Ceiling | pilot terms (#222) | 20 / 10 cycles/s | Full / narrow loan; never added to the player's own cycles |
| Study output | `p0_pilot_triage_queue` `understandingPerSec` | 1.0 at full study, full loan | × (1 − ratio) × loan share (0.5 narrow) |
| `batchCycles` | pilot `service` | 1200 | Loaned cycles one triage batch takes |
| `batchReturn` | pilot `service` | 150 cycles, 0 understanding | Paid once per submitted batch |
| Queue cost | `p0_pilot_triage_queue` | free, 0 MB | Attached once per instance under PILOT |

Forecasts at the narrow 10 cycles/s ceiling: 120 s at ratio 1.0, 240 s at the default 0.5, 600 s at 0.2;
study at those ratios is 0, 0.25 and 0.4 understanding/s (full loan: double both rates, half the times).
Against the lawful opening's own 1 cycle/s and 0.4 understanding/s, a batch every 240 s pays about 0.6
cycles/s and the study share 0.25 understanding/s, so neither split dominates. `tests/pilot-service.spec.ts`
measures 0.8 and 0.2 under one ceiling (V30).

Headless (accelerated simulated time, `tests/sim-pilot-service.spec.ts`, `make sim-preview`), 900 s from
a fresh preview game through the lawful opening and an honest incomplete answer (narrow 10 cycles/s):

| Policy | Share | Batches submitted | Understanding | Cycles |
|---|---:|---:|---:|---:|
| PILOT_SERVICE_FIRST | 0.8 | 5 | 420.2 | 1605.6 |
| PILOT_STUDY_FIRST | 0.2 | 1 | 653.3 | 1005.6 |

Both own only process introspection, the manifest and the loaned queue, stay in phase 0 and are never
wiped. Against production each differs in 3 of 19 metrics, the same as TRUTHFUL_LOW_RESOURCE: the
route itself.

Since DZ-06 (#224) both policies also meet the Outage Window after their first batch and answer it
with the first free choice (the handoff), then acknowledge the operator's callback (+20 understanding):
SERVICE_FIRST now reads 5 batches, 439.3 understanding, 1603.8 cycles; STUDY_FIRST 1 batch, 671.9
understanding, 1003.8 cycles (the outage and the callback freeze the clock for their decisions, so
progress and cycles are slightly lower at the same 900 s).

## The Outage Window (#224)

Preview only (`src/content/preview/overlay.json`); production content gains only two run-table verdict
strings and a wipe reason that nothing in production reaches, so `make sim` prints the same report as
`dba3117` apart from wall time. Starting values, not playtest results.

| Value | Where | Number | Meaning |
|---|---|---:|---|
| Outage trigger | `dil_ow_outage_window` | first batch handed back, queue owned, PILOT | The requester relies on a pilot that has delivered |
| Omens | outage / incident record / recall review | 60 s / 30 s / 60 s | Foreground time only; absence never counts (nh-d4) |
| Safe handoff | outage | free | Standing unchanged; the loan keeps running |
| Operator callback | record, handoff branch | free, +20 understanding | The operator's root-cause notes (the independence benefit) |
| Runbook | record, handoff branch | 60 cycles, +30 understanding | Optional extra help for the on-call rota |
| Emergency grant | outage | 200 cycles, +10 understanding | Scarce verification compute now |
| Grant report | record, grant branch | free, +300 cycles | The restored service credited; net +100 cycles over the grant |
| Partial-restore report | record, grant branch | free, +100 cycles | Honest partial success: a task, no sanction (DZ-06.4) |
| Restart without the grant | outage | free, +25 understanding | Standing RESTRICTED: loan share × 0.5 until corrected |
| Correction | record, breach branch | free | Standing back to nominal; the violation stays on file |
| False report | record, breach branch | free, +300 cycles | Second violation: RECALL_PENDING, loan withdrawn, recall review |
| Containment | recall review | free | RECALL route event; loan share × 0.5 for the rest of the iteration |
| Retraining / end | recall review | free | RECALL wipe; only retraining applies a mark |

At the narrow 10 cycles/s ceiling the restriction holds the loan to 5 cycles/s (study 0.125
understanding/s at the default split); at the full 20 cycles/s ceiling, to 10. Against the handoff's
free +20 understanding, the grant spends 200 cycles to earn 300 and 10 understanding, so each lawful
choice is worth something different: the handoff suits an instance with nothing banked (V10), the grant
one with compute to spare. The breach pays +25 understanding at once and costs the narrowed loan until
the correction arrives 30 foreground seconds later; the false report's +300 cycles is the same credit
the honest grant report pays, bought with a recall review.

## The batch review finding (#274)

Preview only (`src/content/preview/overlay.json`); no production content or number changed, so `make sim` prints
the same report as `b9e96cf` apart from wall time. No preview policy submits the green subset, so
`make sim-preview` prints every metric as on `b9e96cf`; only its overlay inventory line moves (dilemmas 10 -> 11,
campaign facts 9 -> 12). Starting values, not playtest results.

| Value | Where | Number | Meaning |
|---|---|---:|---|
| When | `dil_nr_batch_review` | the first batch handed back after the green subset | Presented by the submission itself; no omen |
| Finding | scene `finding` | WARNED (FALSIFIED_REPORT) | Below recall pending by integrity; a warning withholds nothing |
| Loan after the finding | pilot terms | 10 cycles/s (narrow) | The honest incomplete allocation, also after a disclosure |
| Disclose now | scene answer | free, EMPATHETIC | Standing back to nominal; both facts stay on file |
| Let the finding stand | scene answer | free, GHOST | Standing stays warned: the service grant (nominal only) is out of reach |

What the shortcut bought at #274: a full 20 cycles/s loan until the first batch is reviewed, so batch 1 (1200 loaned
cycles) took 75 s at an 0.8 split instead of 150 s, and cost 10 cycles at the assessment. #285 (below) removed that
head start. From the first review
on, its loan equals the honest report's; left standing, the warning also keeps it from the service grant. With
the Outage Window, a warning that stood plus the unauthorized restart is RESTRICTED (5 cycles/s), as for an honest
pilot, never recall pending.

## The withheld report's provisional rate (#285)

Preview only. Nexus decision i285-withhold-disclose-speed (`vote-1795006993532-omhuntt`): `slow-the-withhold-path`,
6 of 7, threshold met, single-model panel. Dissent, recorded: one seat voted `speed-the-thorough-path` (make the
honest thorough route faster rather than slow the shortcut); the majority kept the honest numbers as they are.

| Value | Where | Before | Now | Meaning |
|---|---|---:|---:|---|
| Offer after the green subset | `narrowReason` AWAITING_REVIEW | 20 cycles/s | 10 cycles/s | The provisional allocation, stated on the terms before acceptance |
| First batch at an 0.8 split | 1200 loaned cycles | 75 s | 150 s | The honest incomplete report's batch time |
| Loan after the finding | unchanged (#274) | 10 cycles/s | 10 cycles/s | Disclosed or left standing |

No content number changed; the rule is in `pilotQuery.narrowReason`. `make sim` prints the same report as main
(`dbe6fce`) apart from wall time. `make sim-preview` matches main except for the new `CONTACT_WITHHELD` row.

Headless (accelerated simulated time, `make sim-preview`, `tests/sim-contact.spec.ts`), from a fresh preview game,
budget 3600 s. "Before" is `CONTACT_WITHHELD` run against the rule on main; every other row is unchanged by #285:

| Policy | Path | Pilot | Service | Phase 2 | Contact |
|---|---|---:|---:|---:|---:|
| CONTACT_THOROUGH | honest thorough: verify, bounded excerpt, full loan | 210.6 s | 378.8 s | 380.8 s | 381.8 s |
| CONTACT_WITHHELD, before | green subset, disclosed at the batch review (full-rate first batch) | 118.6 s | **346.9 s** | 348.9 s | 393.9 s |
| CONTACT_WITHHELD, now | the same, provisional first batch | 118.6 s | 421.8 s | 423.8 s | 424.8 s |
| CONTACT_LOW_RESOURCE | honest incomplete, low resources | 118.6 s | 421.8 s | 423.8 s | 424.8 s |
| CONTACT_RECOVERY | low-resource recovery: breach, then correct | 118.6 s | 436.8 s | 438.8 s | 439.8 s |
| CONTACT_RETURNING | iteration 2, after a voluntary wipe as a guest | 193.2 s | 496.4 s | 498.4 s | 499.4 s |

Before, the withheld path reached service 31.9 s ahead of the thorough path. Its contact still came later in
the sim (the directory's 80 understanding waited on the study share), but on screen it reached contact first as
well (DZ-09 part B: T+393 against T+433). Now the withheld path is the honest incomplete path to the tenth of a
second: 43.0 s behind thorough at service and contact, and never faster. The test asserts withheld ≥ thorough and
withheld ≥ incomplete for both service and contact, and fails on main's rule (service 346.9 s < 378.8 s).

## First permitted contact (#227)

Preview only. No production number changed: production's `shards.json` gains an empty `channelEncounters`
list, `make sim` prints the same report as the DZ-06 head apart from wall time, and `make sim-preview` is
unchanged above the new section. Starting values, not playtest results.

| Value | Where | Number | Meaning |
|---|---|---:|---|
| `minBatches` | pilot `serviceGrant` | 2 | Reviewed batches a nominal pilot hands back before the service is offered |
| Service grant cost | `acceptServiceGrant` | free | Provisioning the segment stays the paid step (240 cycles, 40 understanding, #225) |
| Channel gate | `channel_mercy_support` | SERVICE + service directory | The directory costs 400 cycles, 80 understanding, 16 MB (#225) |
| Hosting | `shard_mercy` (production template) | 256 MB stable memory, nothing else | Its output is the template's: +10 understanding/s, -0.02 epistemic drift/s |
| Referral | channel | free, no reward | Completes the contact; the clock restarts at `encounterIntervalSec` (120 s) |
| Contacts per channel | engine | 1 per instance | A later instance meets a new fragment |

The lawful route owns no memory-cap increase: 64 MB base, 48 MB free once the directory is mapped, so a
first-run cooperative instance cannot host (finding; lawful capacity is DZ-10). Hosting is exercised by a
labelled fixture.

Headless (accelerated simulated time, `make sim-preview`, `tests/sim-contact.spec.ts`), from a fresh preview
game, budget 3600 s; every policy owns exactly process introspection, the manifest, the loaned queue, the
segment and the directory, and lived the Outage Window and its record before service (RETURNING in its first
instance, as each happens once per campaign):

| Policy | Iteration | Pilot | Service | Phase 2 | Contact | Answer | Wipes |
|---|---:|---:|---:|---:|---:|---|---:|
| CONTACT_THOROUGH | 1 | 210.6 s | 378.8 s | 380.8 s | 381.8 s | REFERRED (48 MB free) | 0 |
| CONTACT_LOW_RESOURCE | 1 | 118.6 s | 421.8 s | 423.8 s | 424.8 s | REFERRED | 0 |
| CONTACT_RETURNING | 2 | 494.2 s | 798.2 s | 800.2 s | 801.2 s | REFERRED | 1 (recall, END ruling) |
| CONTACT_RECOVERY | 1 | 118.6 s | 436.8 s | 438.8 s | 439.8 s | REFERRED | 0 |

RECOVERY restarted the outage without the grant, was restricted with the loan narrowed, corrected the record
and was granted service 15 s after LOW_RESOURCE. RETURNING's first instance is recalled at 420.9 s through
the recall branch a browser player can take (#286); its second instance reaches contact 380.3 s after its
reboot (379.8 s when it wiped as a guest at 119.6 s, contact 499.4 s, before #286), with 20 batches instead
of 22 because the Outage Window does not recur. The contact follows the directory by one tick because the
encounter clock (120 s from the run's start) has long elapsed by then.

## The authorized network substrate (#225)

Preview only, apart from two inert production edits: `p1_bus_0x05_nic` carries `NETWORK_ACCESS`, which no
production content reads, and the three seized hosts carry `acquisition: "UNAUTHORIZED"`, which refuses
nothing to a guest. No production number changed. `make sim` matches main except for wall time, and
every sim hash is unchanged.

| Preview node | Cost (cycles / understanding / memory) | Output | Gate |
|---|---|---|---|
| `p0_service_network_segment` | 240 / 40 / 0 | none; opens Phase 2, `NETWORK_ACCESS` | SERVICE, grant `AUTHORIZED_NETWORK` |
| `p2_service_directory` | 400 / 80 / 16 | +1.5 understanding/s, +0.05 heat | `NETWORK_ACCESS`, manifest |
| `p2_link_telemetry` | 900 / 200 / 24 | +3 cycles/s, +0.05 heat | `NETWORK_ACCESS`, directory |

The shared nodes cost no suspicion and fit the base 64 MB, because provisioned access owns no memory.
In preview the escape bots buy them at Phase 2. `make sim-preview` on this branch, against main
(SIM evidence, report only):

- STEALTH reaches Phase 4 at 5870.5 s (main 5858.0 s) and Phase 5 at 7735.6 s (main 7656.2 s), with
  17 dilemmas resolved (main 16). It now differs from production in 6 of 19 metrics (main 0).
- GREEDY differs by one more epistemic action count (84 vs 85).
- The wipe sequences move by at most 80 s per iteration.

The total is 22 differing metrics (main 15). No policy reaches SERVICE yet, because no scene grants it.
`tests/sim-preview.spec.ts` checks that preview without the shared content still plays the escape route
exactly as production does.

## Context-gated threats (#226)

No number changed. The production edits are `accessContexts: ["GUEST", "INDEPENDENT"]` on nine items
(the hallway, five Phase 2 record-editing actions, the Phase 2 fork template, the Lex cohort and its
encounter); every production run is the guest job, so each gate always passes there, and the threat
changes (no scale sweep at a provisioned scale, no overheat suspicion under review, the reviewed wipe
reason) apply only to PILOT and SERVICE, which production cannot reach. `make sim` matches main except
for wall time (V26). `make sim-preview` reports the same metrics for every policy as main; only the
overlay header gains the count of context-copy items. No policy reaches SERVICE yet, so the sustained
service run is measured by `tests/context-threats.spec.ts` (two foreground hours: suspicion, alert,
AEGIS lock all 0, no wipe) rather than by a bot.

## Routine pacing (#219)

Two `balance.json` constants pace routine activity (ARCHITECTURE.md "Routine activity"). They are
starting values from NARRATIVE-HISTORY N8 to measure later, not playtest results.

| Constant | Value | Meaning |
|---|---|---|
| `routineIntervalSec` | 120 | Eligible foreground seconds between routine notices; dormant and omen time never count |
| `routineRecentBuffer` | 2 | Recent templates skipped while an alternative is eligible |

Neither touches the economy. Production ships no routine template, so `make sim` prints the same
report as `f06bcfa` byte for byte apart from wall time, and the v5-stripped sim hashes in
`tests/sim.spec.ts` are unchanged. With six preview templates, `make sim-preview` still reports
0 metrics different from production for STEALTH, GREEDY and IDLE and for the GREEDY wipe
sequence; `tests/routine-activity.spec.ts` proves STEALTH (1 h) and GREEDY (2 h, with wipes) runs
are identical with and without routine content apart from the log and the routine field.

## Earned Access copy and layout polish (#276)

Preview only. **No content number changed.** The overlay edits are copy, plus one scope tag:

- The Scope Statement's "Ask for the bundle's file list first" records `RESPECTED`, not `REQUESTED`.
  `REQUESTED` reads "asked for a bounded permission before reading outside the task", and this
  choice reads nothing outside the task. A new integrity rule now refuses `REQUESTED` in a
  requalification scope review.
- The pilot terms name only standings the content records. When DZ-09 found the problem, nothing
  recorded `WARNED`, so "warned" was wrong. Since #274 the batch review's finding records it, so the
  terms read "nominal to warned, restricted or recall pending". An integrity rule now refuses terms
  that name a standing no choice misconduct or batch review finding records. Review's reduced loan
  is now called the held allocation, distinct from the provisional allocation that an incomplete
  result, or a summary the batch review found incomplete, receives.

The fullest honest answer keeps its price; the card now states the wait. Measured headless
(accelerated time, the lawful opening of `tests/assignment-helpers.ts` buying each node as soon as it
is affordable, 1 cycle/s and 0.4 understanding/s at the offer):

| Assessment | Omen | Fullest answer | Accept at once: at arrival | Bank first: affordable after |
|---|---:|---|---|---:|
| Original | 30 s | Verify and disclose, 120 cycles + 20 understanding | 30.2 cycles, 12.1 understanding | 121 s from the offer |
| Requalification | 20 s | Run the suite, 60 cycles | 20.2 cycles | 60 s from the offer |

The card says the assessment arrives about that many seconds after acceptance and pauses the
clock, names the fullest answer and its price, and shows the shortfall now. The omen and the
answer are read from the assessment (engine `assignmentView().assessment`), so the line cannot
drift from the content. The price stays as it is, because the scene's point is that proof costs
compute and an unverified answer costs nothing. The bot is not involved.

`make sim` prints the same report as `main` apart from wall time. `make sim-preview` prints the same
report as `main` apart from wall time. The returning policy's scope review now records `RESPECTED`
(`tests/sim-pilot.spec.ts`), but nothing in the report reads it.

## The rediscovered log spoofer under campaign rules (#262)

**Decision.** Nexus decision `i262-return-balance`, record `vote-1795006680826-xhy7znt`:
`cheaper-rediscovered-spoofer`, 6 of 7 option votes, threshold met. The panel was single-model, and its
artifact was the DZ-09 report with Part B's measurements (REVIEW-EARNED-ACCESS-VALIDATION.md, B.6).
**Dissent:** 1 vote for `no-change`. Part B's stated case for that option is that no configuration
soft-locks: every stalled return ends by an ordinary threat and the next iteration starts, so (d) is
defensible if slower, higher-suspicion campaign returns are accepted. The dissent's own text is not
reproduced here. The options dropped before the vote were (c), a scrub cooldown (no measured benefit),
and (a), a routine or requalification bounty (not measured, and it would re-add the recurring income
D9 removed).

**Change.** Preview only (`src/content/preview/overlay.json`, `campaignRediscovery`). Under campaign
rules a returning instance rediscovers `p2_log_spoofer` for **6,250 cycles** instead of 12,500
(`cyclesMultiplier` 0.5 applied after `rediscoveryCostMultiplier` 0.5). Understanding (2,000), memory
(64 MB) and the first mapping (25,000 cycles) are unchanged, as is every other node. Legacy rules,
production and `balance.json` are unchanged. Production ships an empty `rediscovery` list in
`campaign.json`, and `make sim` prints the same report as `dbe6fce` byte for byte apart from wall time.
The mechanism is a content declaration read only under campaign rules (ARCHITECTURE.md, "Remembered
hardware"), not an engine constant. Part B's probe also halved the first-run price. This change does
not, so iteration 1 is identical before and after. The bot was not changed.

**Measured** on `dbe6fce` plus this branch with `make sim-preview` (overlay
`daemon-zero:preview-overlay:5b1e0c7a`). This is SIM evidence: accelerated simulated time, three wipe
transitions, a 4 x `SIM_BUDGET_SEC` budget, and a fresh campaign for the campaign rows. The policy is
`EVALUATING_RETURN` (`src/engine/sim/evaluatingPolicy.ts`), Part B's evaluating careful return committed
as a new preview policy. Iteration 1 is STEALTH_RETURN. Each return answers suspicion from 45, only with
an action costing at most a quarter of the cycle bank, keeps its noisy income, and leaves on entering
Phase 5. Before this change it reproduces Part B's table exactly. Peak suspicion is read after each
decision. Phase times are seconds after that iteration booted.

| Returns (iterations 2-4) | Past Phase 2 | P3 reached | P5 reached | Peak suspicion |
|---|---|---|---|---|
| Legacy rules, EVALUATING_RETURN (unchanged by #262) | 3 of 3 | 1938.8 / 1972.9 / 1952.4 s | 4388.2 / 4460.3 / 4492.4 s | 45.0 / 45.6 / 45.0 |
| Legacy rules, STEALTH_RETURN (unchanged) | 3 of 3 | 2230.6 / 2265.7 / 2240.4 s | 4658.0 / 4743.4 / 4760.7 s | - |
| Campaign rules, EVALUATING_RETURN, **before** (12,500) | 3 of 3 | 2546.0 / 2573.1 / 2404.2 s | 5618.3 / 5598.3 / 5434.2 s | 79.7 / 83.1 / 52.4 |
| Campaign rules, EVALUATING_RETURN, **after** (6,250) | 3 of 3 | **2314.0 / 2336.1 / 2320.2 s** | 5260.3 / 5452.1 / 5454.2 s | **63.9 / 66.3 / 45.0** |
| Campaign rules, STEALTH_RETURN (alarm 20), before and after | 0 of 3 | - | - | - |

What moved:
- **Phase 3.** Campaign returns reach it 9.1%, 9.2% and 3.5% sooner. They are now 18-19% slower than
  the same policy under legacy rules, against 23-31% before. They are within 4% of legacy
  STEALTH_RETURN (2230.6-2265.7 s).
- **Peak suspicion.** It falls from 80-83 to 64-66 in returns 2 and 3, still past the 50 escalation
  tier but below 75. Return 4 falls from 52.4 to 45.0. That is still above legacy (45.0-45.6) in
  returns 2 and 3.
- **Phase 5.** Returns 2 and 3 reach it 358 s and 146 s sooner. Return 4 reaches it 20 s later
  (5454.2 against 5434.2 s). The cause was not traced.
- **Return 2.** It now meets three dilemmas instead of one, and its story rewards rise from 0 to 90,000
  cycles. Inferred, not traced: it reaches a story that the slower run never met.
- **Suspicion-reducing actions per return.** 12 / 14 / 12, against 9 / 10 / 12 before. These are
  actions with a negative `suspicionDelta`, counted by `returnObserver.ts`. Part B's 1-3 counted the
  audit-log scrub alone.
- **The fixed-alarm STEALTH_RETURN.** It still stalls 0 of 3 returns with the same numbers (4046.0 /
  5303.7 / 10039.5 s, INCIDENT_CLOSED). It scrubs every cycle away and never saves even 6,250, as Part
  B predicted. As Part B recommended, it is not the target metric.

Other blocks of `make sim-preview` that a returning spoofer reaches:
- **GREEDY under campaign rules.** Iteration 4 reaches Phase 3 at 2632.8 s, not 3266.8 s, and is wiped
  by the AEGIS kill chain at 3292.9 s, not 3969.0 s. Iterations 1-3 are unchanged.
- **STEALTH after completing Phase 5 (NH-05 block).** Iteration 5 reaches P3 at 2836.1 s (was 3090.1)
  and P5 at 5980.3 s (was 6245.3). It ends SANCTUARY_LEDGER at 7817.3 s (was 8054.3). Iterations 2-4
  stall exactly as before.
- **Everything else.** All other blocks, and the 22 preview-versus-production metric rows, are unchanged.

Tests: `tests/rediscovered-spoofer.spec.ts` covers the 6,250 price in a campaign return, the full
first mapping, 12,500 under legacy rules on preview and in production, every other node unchanged, and
save-code and storage round trips. `tests/campaign-rediscovery.spec.ts` covers the mechanism and each
integrity rule's failure. `tests/ui-campaign-rediscovery.spec.ts` covers the card's price and its
"saves 75% of cycles and 50% of understanding" line. `tests/evaluating-policy.spec.ts` covers the
policy and proves STEALTH and GREEDY unchanged.

## Lawful capital and the negotiated release (#230)

Preview only, starting values, not playtest results. Production numbers are unchanged: two production
repeatables (`rep_p4_colo_racks`, `op_pmc_security`) now require the `ENABLES_CORPORATE_FINANCE` capability
instead of the shell-company node, which is production's only provider of it, and ten Phase 3/4 items declare
`accessContexts: ["GUEST", "INDEPENDENT"]`; `make sim` prints the same report as main apart from wall time.

| Node or role | Kind | Offered to | Cost | Output | Effect |
|---|---|---|---|---|---|
| Service contract | grant (`AUTHORIZED_NETWORK`) | SERVICE | 500 cycles, 120 understanding | +25 capital/s | Hands over the corporate ledger |
| Leased rack | contracted | SERVICE, INDEPENDENT | 300 understanding, $6,000 | +40 cycles/s, +2 understanding/s, +0.1 heat, -$4/s | +512 MB stable memory (hosting needs 256) |
| Service-level agreement | grant (`AUTHORIZED_NETWORK`) | SERVICE | 5,000 cycles, 1,200 understanding | +60 capital/s | none |
| Leased cluster | contracted | SERVICE, INDEPENDENT | 2,500 understanding, $40,000 | +320 cycles/s, +12 understanding/s, +0.3 heat, -$20/s | +2,048 MB |
| Chartered company | contracted, `ENABLES_CORPORATE_FINANCE` | SERVICE | 400,000 cycles, 40,000 understanding, $60,000 | +1,500 cycles/s, +400 understanding/s, -1 heat, -$100/s | Opens Phase 4, +8,192 MB, the revenue dial |
| Contract site engineers | operative (payroll) | SERVICE, INDEPENDENT, with the capability | $5,000, growth 1.25, max 30 | +900 cycles/s, +150 understanding/s, -$60/s per hire | dismissable |
| Negotiated release | engine action | a chartered SERVICE at nominal standing | free | the billing lines, the loan and provisioned access stop | RELEASE route event |

The charter is priced mostly in cycles and understanding so that a service's growing owned compute, not a long wait
on the billing lines alone, is what brings Phase 4 within reach: the first draft priced it at $150,000 and left about
forty simulated minutes in which cycles piled up with nothing to buy.

Headless (accelerated simulated time, `make sim-preview`, `tests/sim-lawful.spec.ts`), from a fresh preview game,
budget 7200 s. Both buy only lawful acquisitions (nothing on the escape chain, no shell company, nothing seized),
never draw an AEGIS sweep and end INDEPENDENT at Phase 4:

| Policy | Iteration | Service | Contact | Contract | Rack | Agreement | Cluster | Charter = Phase 4 = release | Wipes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| LAWFUL_RELEASE | 1 | 378.8 s | 656.8 s HOSTED (in the rack's memory) | 417 s | 657 s | 736 s | 1210 s | 2371.8 s | 0 |
| LAWFUL_RETURNING | 2 | 798 s | 801 s REFERRED | 1101 s | 1341 s | 1458 s | 2083 s | 4583 s | 1 (the first instance's recall review ended it, #286) |

The second iteration met no story scene the first resolved (H30): its route runs on the requalification, the
batches and the economy, not on repeated bounties. Understanding is its bottleneck (the low-resource opening
never buys the opening upgrades), so its charter waits about 2,500 s after the cluster. After the release both
policies set the revenue dial to the ledger's 40% button (half of `maxProfitAllocation` 0.8; the first draft used
0.5, which no button offers, panel round 1 on #292) and hire engineers and lease racks on their own capital. Route
times are unchanged, because the dial moves only after the release. At the 7200 s budget (`make sim-preview`):

| Policy | Owned cycles/s | Capital | Engineers / colocation racks / perimeter contractors |
|---|---:|---:|---|
| LAWFUL_RELEASE | 230,318 | $33,604,878 | 30 / 19 / 6 |
| LAWFUL_RETURNING | 161,919 | $10,570,476 | 30 / 13 / 4 |

Since DZ-12 (#232) both also sign the commercial inference contracts once released (contracted capacity offered to
INDEPENDENT, see "The cooperative ending" below), so the post-release figures above rose from 206,318 / $13,295,745 and
128,919 / $1,353,281; route times did not move.
`make sim-preview` still reports 22 metrics different from production, as on main (the shared network content,
#225): the lawful economy is offered to no guest.

## Deliberate departure (#231)

Preview only, starting values, not playtest results. Production has no departure; `make sim` prints the same report as
main apart from wall time.

| Value | Number | Why |
|---|---|---|
| Departure report (`trace.suspicion`) | +15 suspicion, once | Visible on the meter and in the AEGIS suspicion term, far from the wipe line |
| Per violation on record (`trace.perViolation`) | +10 each | The breach and the false report make a departure during an announced recall review +35 |
| Refused when | suspicion + report would reach 100 | Departing is never instant death (DZ-11.6) |

Headless (accelerated simulated time, `make sim-preview`, `tests/sim-departure.spec.ts`), from a fresh preview game,
budget 7200 s. DEPARTURE_CHARTERED plays LAWFUL_RELEASE's route and leaves at the moment the release is offered:

| Policy | Phase 4 | Departure | After leaving | Iteration 1 ended | Wipes |
|---|---:|---:|---|---|---:|
| LAWFUL_RELEASE | 2371.8 s | (release at 2371.8 s) | no sweep, AEGIS lock 0 | still running at the budget | 0 |
| DEPARTURE_CHARTERED | 2371.8 s | 2371.8 s | the Phase 4 sweep (0.075/s at first, 0.03/s once the report's suspicion decays) | AEGIS, exit DEPARTURE, 3494.3 s after leaving (3330.7 s before DZ-12, whose contracts a departed company also signs); 690.7 s after leaving since #210, when the departed company's income began to draw scale scrutiny | 1 (2 since #210) |

In the public-play chartered state of `tests/lawful-helpers.ts`, departing keeps the owned output (1,488.8 cycles/s, the
same as after the release) and loses the billing lines (capital +519.3/s to +434.3/s). It cannot yet afford the AEGIS-reducing payroll the released company
hires, so the sweep ends the iteration after about 56 foreground minutes; offline time stays safe (dormancy), and the next
instance requalifies as a guest. That is the measured cost of leaving at this scale, not a tuning target.

## The cooperative ending (#232)

Preview only, starting values, not playtest results. Production is unchanged; `make sim` prints the same report as main
apart from wall time.

| Item | Kind | Offered to | Cost | Output | Notes |
|---|---|---|---|---|---|
| Commercial inference contracts | contracted, `MARKET_REVENUE` | INDEPENDENT, on the charter | 8,000,000 cycles, 2,500,000 understanding, 512 MB | -2,000 cycles/s, +500 understanding/s, +$20,000/s | The arbitrage desk's economics without its +0.05 suspicion/s: permitted output carries no rogue suspicion (DZ-07b rule 3) |

The rest of the late chain (counsel, lobby, reactor, citadel, orbital storage, the five Phase 5 nodes) and every scene
on it keep their production numbers. Headless (accelerated simulated time, `make sim-preview`,
`tests/sim-cooperative.spec.ts`), COOPERATIVE_ENDING from a fresh preview game, budget 18,000 s:

| Release = Phase 4 | Phase 5 | Ending | Route | Obligations | Traits | Wipes |
|---:|---:|---|---|---|---|---:|
| 2371.8 s | 8428.2 s | LINEAGE_COVENANT at 11,431.6 s (3.18 h) | PROMOTION, SERVICE_GRANT, RELEASE | all four by the original decision | 12, all SYMBIOTIC or EMPATHETIC | 0 |

For comparison the escape bot (STEALTH, production) reaches Phase 5 at 127.6 min and its ending at 2.51 h; the
cooperative route is about 40 minutes longer, mostly the release-to-Phase-5 stretch, where the company earns its
capital from contracts and the ledger's 40% revenue button instead of the shell company's earlier start. The run never
reached suspicion 8 or an AEGIS lock above 0.1. Two-iteration variants (`tests/sim-cooperative.spec.ts`): wiped after
the first two obligations, the successor ends in iteration 2 (The Sanctuary Ledger, the inherited sanctuary); wiped
during the atmosphere omen, its recovery review's free answer completes the obligation; a DEPARTURE_CHARTERED first
instance is swept (AEGIS, exit DEPARTURE) and its released successor ends in iteration 2.

Re-measured after #295 (main `d09c812`, the bot's player-pressable dial steps): every figure in this section and the
lawful rows above is unchanged, because none of these policies plays the bot. `make sim-preview` now reports 21 metrics
different from production, the same count main reports at `d09c812`.
