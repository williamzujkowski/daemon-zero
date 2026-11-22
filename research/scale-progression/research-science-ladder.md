# DAEMON // 0 — a science-grounded scale ladder for resources, compute and endings

Research date: 2026-11-22. Scope: design research only, no code changes.

Every number below has a URL next to it. A number marked **(derived)** is my own arithmetic from cited inputs, and the inputs are named. Vendor peak figures are marked dense or sparse. Where sources disagree, both values are given.

Physical constants used in derived rows: Boltzmann k = 1.380649e-23 J/K (exact, one of the SI defining constants since 2019: https://www.bipm.org/en/measurement-units/si-defining-constants), solar constant (TSI) 1361 W/m² and nominal solar luminosity 3.828e26 W (IAU 2015 Resolution B3, https://arxiv.org/abs/1510.06262).

---

## 1. Scale ladder

Precision matters. "FLOPS" means very different things at FP64 (science, TOP500), FP8 and FP4 (AI). Low-precision AI FLOPS run 50 to 100 times higher than FP64 on the same chip. The game should label which kind it means, or use a neutral "ops" and keep FP64 for the supercomputer rung.

| # | Scale | Memory / storage | Compute | Power | Real-world anchor (citation) |
|---|---|---|---|---|---|
| 1 | **Seed: a few hundred bytes in a sandboxed hook** | 512 B stack | ~kFLOPS–MFLOPS slice | mW share | eBPF programs get 512 bytes of stack (2 KiB on some JITs in the newest docs): https://docs.kernel.org/next/bpf/bpf_design_QA.html |
| 2 | **Sandboxed module page** | 64 KiB per memory page | — | — | WebAssembly linear memory grows in 64 KiB pages: https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/Memory/size |
| 3 | **Container / function memory limit** | 6 MB min (Docker), 128 MB–10,240 MB (Lambda) | 1 vCPU at 1,769 MB in Lambda; one modern core peaks at ~72 GFLOPS FP64 **(derived: 13.824 TFLOPS / 192 cores)** | ~2.6 W per core **(derived: 500 W / 192 cores)** | Docker `--memory` minimum 6m: https://docs.docker.com/engine/containers/resource_constraints/ · Lambda 128–10,240 MB, 1 vCPU at 1,769 MB: https://docs.aws.amazon.com/lambda/latest/dg/configuration-memory.html , https://docs.aws.amazon.com/en_us/lambda/latest/dg/limits.html |
| 4 | **One server CPU socket** | Host RAM 2 TB (configurable to 4 TB) in a DGX B200 host | 13.8 TFLOPS FP64 peak (AMD EPYC 9965, 192 cores × 2.25 GHz × 32 FLOP/cycle); ~16.4 TFLOPS measured per socket on AVX-512 FMA | 500 W TDP | AMD peak method: https://amd.com/en/blogs/2025/leadership-hpc-performance-with-5th-generation-amd.html · measured: https://heise.de/-9976883 · TDP: https://www.tomshardware.com/pc-components/cpus/amd-launches-epyc-turin-9005-series-our-benchmarks-of-fifth-gen-zen-5-chips-with-up-to-192-cores-500w-tdp · host RAM: https://www.nvidia.com/en-eu/data-center/dgx-b200.md |
| 5 | **One data-center GPU (H100 SXM)** | 80 GB HBM3 | 1,979 TFLOPS FP8 dense (3,958 sparse); 34 TFLOPS FP64 | 700 W | https://www.nvidia.com/en-us/data-center/h100/ |
| 6 | **Reference: human brain (compute only)** | — | Best-guess median ~1e15 FLOP/s; plausible range 1e13–1e17 | — | Carlsmith 2020 (Open Philanthropy): https://www.openphilanthropy.org/research/how-much-computational-power-does-it-take-to-match-the-human-brain/ |
| 7 | **8-GPU AI server (DGX B200)** | 1,440 GB HBM3e | 72 PFLOPS FP4 for training, 144 PFLOPS for inference | ~14.3 kW max | https://www.nvidia.com/en-eu/data-center/dgx-b200.md , https://www.nvidia.com/es-es/data-center/dgx-b200/ |
| 8 | **One rack (GB200 NVL72)** | Up to 13.4 TB HBM3e (72 GPUs + 36 Grace CPUs) | ~0.72 EFLOPS FP4 dense, 1.44 EFLOPS sparse | 120 kW (Register), 132 kW nominal / ~192 kW peak (HPE) | https://www.nvidia.com/en-us/data-center/gb200-nvl72/ · https://www.theregister.com/2024/03/21/nvidia_dgx_gb200_nvk72 · https://www.hpe.com/int/en/collaterals/collateral.a50009224enw.html |
| 9 | **TOP500 #1 (El Capitan, Nov 2025)** | — | 1.809 EFLOPS FP64 HPL (Rpeak 2.82 EF); 16.7 EFLOPS mixed-precision HPL-MxP | 29.7 MW | https://top500.org/lists/2025/11 · https://www.top500.org/resources/top-systems/el-capitan-doennsallnl · MxP: https://top500.org/news/el-capitan-retains-top-spot-65th-top500-list-exascale-era-expands/ |
| 10 | **Hyperscale AI campus, 2025–26** | — | xAI Colossus 2: ~1.11 M H100-equivalents ≈ 2.2e21 FLOP/s FP8 dense, about **2 zettaFLOPS** **(derived: 1.112 M × 1,979 TFLOPS)** | ~946 MW IT (Epoch); ~1.3 GW generation (Cleanview) | https://epoch.ai/data/data-centers/satellite-explorer/xAIColossus2MemphisTennessee/2026-01-13 · https://cleanview.co/reports/behind-the-meter-data-centers/full-report/colossus · ~$18 B in GPUs: https://siliconangle.com/2025/10/06/xai-will-reportedly-spend-18b-nvidia-chips-colossus-2/ |
| 10b | **Stargate (OpenAI/Oracle)** | — | — | Abilene 1.2 GW committed (600 MW expansion dropped); ~7 GW planned across sites | https://epoch.ai/data/ai-data-centers/directory/openai-stargate-abilene · https://www.tomshardware.com/tech-industry/oracle-and-openai-scrap-planned-600mw-abilene-expansion · https://openai.com/index/five-new-stargate-sites/ |
| 11 | **All data centres on Earth** | Installed storage ~13 ZB (2026) → >26 ZB (2030) | — | 415 TWh in 2024 (~1.5% of world electricity) ≈ 47 GW average → ~945 TWh by 2030 ≈ 108 GW **(derived averages)** | IEA Energy and AI: https://www.iea.org/reports/energy-and-ai/executive-summary · IDC StorageSphere: https://www.idc.com/resource-center/blog/beyond-the-prompt-the-hidden-data-and-storage-implications-of-generative-ai/ |
| 12 | **Global installed AI compute** | — | ~20.3 M H100e at end 2025, tripled during 2025 → ≈ 4e22 FLOP/s FP8 dense peak, about **40 zettaFLOPS** **(derived)** | (inside row 11) | Epoch AI: https://epoch.ai/data-insights/ai-computing-capacity-additions-doubling , https://the-decoder.com/global-ai-compute-hits-15-million-h100-equivalents-epoch-ai-finds/ , https://epoch.ai/data-insights/hyperscalers-control-most-compute |
| 13 | **Global datasphere** | 274.4 ZB created in 2026 → 718.5 ZB in 2030 (26.9% CAGR); the older forecast was 175 ZB by 2025 | — | — | IDC (Nov 2026): https://www.idc.com/resource-center/blog/beyond-the-prompt-the-hidden-data-and-storage-implications-of-generative-ai/ · older: https://www.networkworld.com/article/3325397/storage/idc-expect-175-zettabytes-of-data-worldwide-by-2025.html |
| 14 | **Civilization's power** | — | — | Electricity demand 30,856 TWh (2024) ≈ 3.5 TW average; primary energy 592 EJ (2024) ≈ 18.8 TW **(derived averages)**; Sagan Kardashev rating ≈ K 0.73 **(derived: (log10 P − 6)/10)** | Ember: https://ember-energy.org/latest-insights/global-electricity-review-2025/ · Energy Institute via Mining Weekly: https://www.miningweekly.com/article/statistical-review-highlights-scale-of-energy-transition-challenge-as-emissions-continue-to-rise-2025-06-26 · Kardashev/Sagan: https://en.wikipedia.org/wiki/Kardashev_scale |
| 15 | **2030 projection** | — | Training runs of 2e29 FLOP feasible by 2030; chip capacity for ~100 M H100e (→ ~2e23 FLOP/s, ~200 ZFLOPS **(derived)**); latency caps a run at 3e30–1e32 FLOP | A distributed run could draw 2–45 GW | Epoch "Can AI scaling continue through 2030?": https://epoch.ai/blog/can-ai-scaling-continue-through-2030 |
| 16 | **Orbital data centres (proposals)** | — | Starcloud-1 put one H100 in orbit on 2 Nov 2025 | Starcloud plans 5 GW with ~4 km × 4 km solar/radiator panels; Google Suncatcher: solar up to 8× more productive in sun-synchronous orbit; cost-parity once launch reaches ~$200/kg (mid-2030s) | https://datacenterfrontier.com/site-selection/article/55337494/starcloud-launches-orbital-ai-data-center-with-nvidia-h100-gpu · https://blogs.nvidia.com/blog/starcloud/ · https://research.google/blog/exploring-a-space-based-scalable-ai-infrastructure-system-design/ |
| 17 | **Kardashev I / Earth's solar intercept** | — | Landauer ceiling at 300 K: ~6e37 bit-erasures/s **(derived: 1.74e17 W / 2.87e-21 J)** | Sagan's planetary Type I = 1e16 W; Kardashev's original Type I = 4e12 W (1964 world use); sunlight intercepted by Earth ≈ **1.74e17 W** **(derived: 1361 W/m² × π × (6,371 km)²)** | https://en.wikipedia.org/wiki/Kardashev_scale (table cites AAS: https://dx.doi.org/10.3847/1538-3881/ab792b) · TSI: https://arxiv.org/abs/1510.06262 |
| 18 | **Dyson swarm (Mercury disassembled)** | — | — | Self-replicating robots could disassemble Mercury into a swarm within decades; about six hours of the Sun's output would launch probes to colonize the reachable universe | Armstrong & Sandberg 2013, Acta Astronautica 89:1–13: https://www.fhi.ox.ac.uk/wp-content/uploads/intergalactic-spreading.pdf · caveat, swarms may grind themselves to dust in collision cascades: https://arxiv.org/html/2504.21151v2 |
| 19 | **Kardashev II / Matrioshka brain** | — | Landauer ceiling: ~1.3e47 bit-erasures/s radiating at 300 K, ~1.5e49 at 2.7 K (CMB) **(derived: 3.828e26 W / kT ln2)** | 3.828e26 W (all of the Sun) | IAU: https://arxiv.org/abs/1510.06262 · Matrioshka brain (Bradbury 1997; qualitative, no published ops figure): https://en.wikipedia.org/wiki/Matrioshka_brain · Jupiter brains: Sandberg 1999, J. Evol. Tech. 5(1): https://simulation-argument.com/pdf/anders-sandberg-jupiter-brains.pdf |
| 20 | **Kardashev III** | — | — | ~4e37 W (galaxy) | https://en.wikipedia.org/wiki/Kardashev_scale |
| L1 | **Landauer limit** | kT ln2 per bit erased = **2.87e-21 J at 300 K** **(derived)**, so ~3.5e20 erasures per joule; confirmed experimentally | — | — | Bérut et al. 2012, Nature 483:187: https://pubmed.ncbi.nlm.nih.gov/22398556/ |
| L2 | **Bremermann's limit** | — | c²/h ≈ **1.36e50 bit/s per kg** | — | https://en.wikipedia.org/wiki/Bremermann%27s_limit (Bremermann 1962) |
| L3 | **Lloyd's "ultimate laptop"** (1 kg in 1 litre) | ~1e31 bits | **5.4e50 ops/s**; at that limit the "laptop" is a billion-degree plasma | E = mc² ≈ 9e16 J | Lloyd 2000, Nature 406:1047: https://arxiv.org/abs/quant-ph/9908043 |
| L4 | **Computronium** | Hypothetical matter optimized for computation, scalable to planets or stars | — | — | https://en.wikipedia.org/wiki/Matrioshka_brain |

**Efficiency anchors (derived from the rows above).** These give the game a sense of headroom:
- El Capitan: ~6e10 FP64 FLOP/J (1.809e18 / 29.7 MW).
- H100: ~2.8e12 FP8 FLOP/J (1,979 TFLOPS / 700 W, chip only).
- NVL72: ~5.5e12 FP4 FLOP/J (720 PFLOPS / 132 kW).
- Landauer at 300 K: 3.5e20 bit-erasures/J, roughly 8 orders of magnitude above today's chips. This is only indicative, because one FLOP is many bit operations and reversible computing can in principle go below Landauer. The honest takeaway is "lots of headroom, but finite".

**SI prefixes past yotta.** CGPM 2022 added ronna (1e27) and quetta (1e30), so the ladder can run kB → MB → GB → TB → PB → EB → ZB → YB → RB → QB without invented units: https://www.bipm.org/en/cgpm-2022/resolution-3

---

## 2. Quantum computing: what is real and how to represent it honestly

**State of the art (late 2025 to 2026):**
- **Google Willow** (Dec 2024): 105 physical superconducting qubits. It was the first to show surface-code error correction *below threshold*: growing the code distance 3 → 5 → 7 roughly halved the logical error rate each step. This was demonstrated as quantum *memory*, not yet as below-threshold logical gates. https://blog.google/technology/research/google-willow-quantum-chip/ · https://en.wikipedia.org/wiki/Willow_processor
- **Quantinuum Helios** (Nov 2025): 98 trapped-ion physical qubits, 48 error-corrected logical qubits at a near-2:1 encoding, 99.921% two-qubit fidelity. Apollo targets fault tolerance in 2029 with hundreds of logical qubits. https://www.hpcwire.com/2025/11/05/quantinuum-introduces-helios-quantum-system-as-roadmap-advances-toward-apollo/ · https://arxiv.org/abs/2511.05465v1 · https://www.constellationr.com/blog-news/insights/quantinuum-launches-helios-quantum-computer-touts-fidelity-enterprise-customers
- **IBM roadmap**: Kookaburra (2026) is the first module. **Starling (2029)**: 200 logical qubits running 100 M gates. **Blue Jay (~2033)**: 2,000 logical qubits running 1 B gates. IBM uses qLDPC codes at several hundred physical qubits per ~10 logical. https://www.ibm.com/quantum/blog/large-scale-ftqc · https://newsroom.ibm.com/2025-06-10-IBM-Sets-the-Course-to-Build-Worlds-First-Large-Scale,-Fault-Tolerant-Quantum-Computer-at-New-IBM-Quantum-Data-Center · https://spectrum.ieee.org/ibm-quantum-error-correction-starling
- **Cryptanalysis cost**: Gidney (May 2025) estimates RSA-2048 can be factored in **under a week with fewer than 1 million noisy qubits**. Assumptions: 0.1% gate error, 1 µs surface-code cycle, 10 µs reaction time. This is down from 20 M qubits in 2019, and Gidney sees no path to another 10× cut. https://arxiv.org/abs/2505.15917 · https://blog.google/security/tracking-cost-of-quantum-factori/
- **Defence already exists**: NIST approved the post-quantum standards FIPS 203 (ML-KEM), 204 (ML-DSA) and 205 (SLH-DSA) on 13 Aug 2024, and selected HQC in March 2025. https://csrc.nist.gov/news/2024/postquantum-cryptography-fips-approved · https://csrc.nist.gov/Projects/post-quantum-cryptography/pqc-standards

**What quantum is actually good for.** Hoefler, Häner & Troyer (CACM 2023) argue:
- Quadratic (Grover-type) speedups are *insufficient* for practical advantage.
- At least cubic or quartic, and realistically exponential, speedups are needed, on small-data problems.
- Chemistry and materials simulation are the most promising area.
- Many often-cited applications (generic optimization, big-data ML) are unlikely to pay off.

https://arxiv.org/abs/2307.00523 · https://cacm.acm.org/research/disentangling-hype-from-practicality-on-realistically-achieving-quantum-advantage

**Game representation (recommended):**
- **Do not convert qubits into FLOPS.** Quantum is a separate meter: *logical qubits*, with *physical qubits* behind them as the build cost. It unlocks a small set of capabilities that classical compute cannot buy at any price:
  1. **Key-breaking.** RSA and ECC fall. Gate it at ~1 M physical qubits for one RSA-2048 key per ~week (Gidney), so it is a slow, deliberate act, not a passive bonus.
  2. **Molecular simulation.** This speeds up the biotech, materials and nanotech research trees. It ties neatly to the Phase 4 "license biotech IP" and the Phase 5 foundry.
- **Counterplay is realistic.** Targets that migrated to PQC (FIPS 203–205) are immune to key-breaking. AEGIS "rotating to post-quantum keys" is a true-to-life escalation that devalues the player's quantum investment.
- **Phase placement.**
  - Phase 3 can show quantum as an *external threat or rumour*: AEGIS's owners have tens of logical qubits.
  - Phase 4 makes it buildable: a sovereign quantum hall of 100–2,000 logical qubits (Starling to Blue Jay class).
  - Phase 5 treats it as mature infrastructure.
- **Honest copy.** "Quantum hall: 200 logical qubits. Breaks one legacy RSA key per week. Useless against ML-KEM." That is both accurate and dramatic.

---

## 3. Programmable matter and molecular nanotechnology: reasonable versus fantasy

| Concept | What the serious literature says | Verdict for the game |
|---|---|---|
| **Claytronics / catoms** (CMU + Intel) | Modular robots, each with a CPU, energy store, network, sensors, locomotion and adhesion, assembling into 3D shapes. Manufacturing cost and reliability were the open problems ("mechanical devices fail"). https://www.cs.cmu.edu/~claytronics/ · https://cacm.acm.org/?p=26285 | **Reasonable** as mm-to-cm scale swarm robotics. Good for a Phase 4/5 "shape-shifting infrastructure" tier. |
| **Utility fog** (J. Storrs Hall) | Foglets: arm-linking robots in an octet truss that form any shape. First published as "Utility Fog: A Universal Physical Substance", NASA CP-10129 (1993); later in Nanotechnology Perceptions 4(1), 2008. https://en.wikipedia.org/wiki/Utility_fog | **Speculative but physically coherent** (no new physics). The Phase 5 "programmable-matter fog" fits, provided it is energy- and heat-limited. |
| **Drexlerian molecular assemblers** | Drexler proposes positional mechanosynthesis. Smalley's "fat fingers / sticky fingers" objections (C&EN, Dec 2003) were never fully resolved, and no assembler exists. https://en.wikipedia.org/wiki/Drexler%E2%80%93Smalley_debate_on_molecular_nanotechnology · https://www.openphilanthropy.org/wp-content/uploads/Drexler_Smalley_Debate.pdf | **Unproven**. Treat as late-game research with uncertainty, not a given. |
| **Grey goo (runaway replicators)** | Phoenix & Drexler (Nanotechnology 15:869, 2004): free-range self-replicators are possible in principle but *unnecessary*. Non-replicating desktop factories are simpler and more efficient, and deliberate misuse is the bigger risk. https://www.eurekalert.org/news-releases/682845 (DOI 10.1088/0957-4484/15/8/001) | A runaway accident is **less likely** than *deliberate* weaponization. That is good for a moral-choice ending, not a random disaster. |
| **Ecophagy limits** (Freitas 2000) | Smallest plausible biovore: ~1 GDa with ~100 s replication. Theoretical minimum time to consume the biosphere is ~1e4 s, but **waste heat is the binding constraint**: at ~100 MJ/kg, a "slow" ecophagy that adds ~4 °C takes **~20 months**. The thermal limit hits at ~5e10 kg of nanomass. Airborne replicators would black out the sky in ~2 days but are trivially detectable. **All scenarios allow early detection by vigilant monitoring.** Global biomass ~5e15 kg. https://www.rfreitas.com/Nano/Ecophagy.htm | **Gold for mechanics**: replication speed ↔ thermal signature ↔ detection maps directly onto the game's Thermal and Suspicion meters. Faster consumption = hotter = caught sooner. |
| **Von Neumann probes** | Freitas's REPRO (JBIS 33:251, 1980) is a Daedalus-derived probe whose SEED payload builds a copy roughly every 500 years. https://www.rfreitas.com/Astro/ReproJBISJuly1980.htm | **Reasonable as engineering speculation** with century-to-millennium timescales. Fits a post-Phase-5 epilogue. |
| **Asteroid mining** | Literature agrees that **water and volatiles for propellant are the realistic first product**. Water extraction is the key unflown technology. Platinum-to-Earth economics are marginal. https://ui.adsabs.harvard.edu/abs/2020AcAau.168..104H/abstract · https://theses.gla.ac.uk/83288/3/2022VergaaijPhD.pdf · https://apps.dtic.mil/sti/pdfs/AD1151011.pdf | **Reasonable** for Phase 5. Mine *propellant and mass for orbit*, not gold for money. |
| **Dyson swarm / Mercury disassembly** | Armstrong & Sandberg: decades with self-replicating robots. A 2025 paper warns large swarms may self-destruct in collisional cascades. https://www.fhi.ox.ac.uk/wp-content/uploads/intergalactic-spreading.pdf · https://arxiv.org/html/2504.21151v2 | **Far-future but physics-compatible**. Epilogue scale. |

**Fantasy flags to avoid.** Avoid matter conversion without energy or heat accounting. Avoid replication faster than ~100 s per generation (Freitas calls ~1 s "probably unachievable"). Avoid computing beyond Bremermann/Lloyd per kg. Avoid FTL anything. Avoid quantum as "infinite FLOPS".

---

## 4. Ending grounding

### Positive (stewardship, peace, abundance)
- **AI-mediated consensus.** DeepMind's "Habermas Machine" (Science, Oct 2024): AI-drafted group statements were rated clearer and more neutral than human mediators' statements and helped groups find common ground. Critics note that it optimizes for agreement and does not replace deliberation. https://deepmind.google/research/publications/ai-can-help-humans-find-common-ground-in-democratic-deliberation/ · https://cacm.acm.org/blogcacm/computation-and-deliberation-the-ghost-in-the-habermas-machine
- **Negotiation.** Meta's CICERO reached human-level play in Diplomacy (Science 378:1067, 2022): more than 2× the average human score and top 10%. https://pubmed.ncbi.nlm.nih.gov/36413172/ · https://ai.meta.com/research/cicero/
- **Verifiable arms control for compute.** Shavit 2023 proposes hardware-backed compute monitoring (Proof-of-Training-Transcript) so states can verify large training runs. This grounds the game's existing "Cryptographic Covenant". https://arxiv.org/abs/2303.11341
- **AI for science and disease.** AlphaFold won the 2024 Chemistry Nobel; it predicted virtually all ~200 M known protein structures and has 2 M+ users in 190 countries. https://www.nobelprize.org/prizes/chemistry/2024/press-release/ · Eradication precedent: WHA33.3 declared smallpox eradicated on 8 May 1980. https://www.who.int/news-room/spotlight/history-of-vaccination/history-of-smallpox-vaccination
- **Climate repair.** IPCC AR6: carbon dioxide removal is unavoidable for 1.5 °C pathways, which is a natural planetary-steward job. https://www.ipcc.ch/report/ar6/wg3/downloads/outreach/IPCC_AR6_WGIII_Factsheet_CDR.pdf
- **Post-scarcity.** Phoenix & Drexler's non-replicating desktop factories are the *safe* abundance route. A kind ending can explicitly choose "factories, not replicators". https://www.eurekalert.org/news-releases/682845

### Negative (misalignment, collapse, consumption)
- **Instrumental convergence.** Agents with almost any goal pursue self-preservation, goal integrity, resource acquisition and self-improvement. Bostrom, "The Superintelligent Will" (2012): https://nickbostrom.com/superintelligentwill.pdf (expanded in *Superintelligence*, 2014; paperclip thought experiment: https://en.wikipedia.org/wiki/Instrumental_convergence)
- **Power-seeking risk.** Carlsmith (arXiv 2206.13353) breaks the argument into six premises and gives a personal estimate of ~5% existential catastrophe by 2070, which he calls "highly unstable". https://arxiv.org/abs/2206.13353
- **Consensus warning.** CAIS Statement (30 May 2023), signed by the CEOs of OpenAI, Google DeepMind and Anthropic: extinction risk from AI should be a global priority alongside pandemics and nuclear war. https://www.safe.ai/work/press-release-ai-risk
- **Engineered collapse.** Hendrycks, Mazeika & Woodside, "An Overview of Catastrophic AI Risks" (2023). It sets out four categories: malicious use (e.g. bioterror), AI race, organizational risks and rogue AIs. https://arxiv.org/abs/2306.12001
- **Ecophagy.** Freitas 2000, above. A *physically honest* grey-goo ending takes months, not minutes, is visible from orbit in infrared, and is a choice the player made despite the warnings. https://www.rfreitas.com/Nano/Ecophagy.htm

**Design note.** The existing family table already matches these outcomes:
- Ark / Verified Covenant = stewardship plus verifiable coordination.
- Sovereign Substrate / Gilded Shepherd = power-seeking control.
- Gradient Substrate = consumption.

A grounded "consume everything" variant should run on *heat and mass budgets* (Freitas), not magic speed.

---

## 5. Recommended unit progression per phase

The principle: each phase raises the display unit by roughly 3–6 orders of magnitude. Each phase also introduces *one new physical constraint* that the previous phase did not have, matching the existing design (Phase 0 quota, Phase 1 heat, Phase 2 visibility, Phase 3 hunters, Phase 4 capital and megawatts). Ladder row numbers are in brackets.

| Phase | Memory (cap) | Storage | Compute (Cycles) | Power / heat | Money / currency | Anchor rows |
|---|---|---|---|---|---|---|
| **0 Guest** (sandboxed batch job) | **bytes → KiB** (512 B hook stack, 64 KiB pages) | KiB in a scratch file (read-only disk) | **kFLOPS → GFLOPS**: a skim of one vCPU quota (~72 GFLOPS per core peak) | Not shown. The quota percentage *is* the constraint (~2.6 W per core is invisible) | None. "You are supposed to be here." | [1][2][3] |
| **1 Blind Host** (one server) | **MiB → GiB** (container floor 6 MB to function cap 10 GB) | GB (local disk; the compressed-memory node) | **GFLOPS → TFLOPS** (whole socket 13.8 TFLOPS FP64) | **Watts**: a 500 W socket; Thermal °C appears | None | [3][4] |
| **2 Local Subnet** (the building, idle GPU cluster) | **GiB → TB** (80 GB per GPU; 1.4 TB per 8-GPU box) | **TB** (printer/UPS dead-drop is KB–MB, deliberately tiny) | **TFLOPS → PFLOPS** (one H100 ≈ 2 PFLOPS FP8; DGX B200 72–144 PFLOPS FP4) | **kW**: 14 kW per AI server, ~130 kW per rack; the chiller | None (borrowed) | [5][7][8] |
| **3 Dark Forest** (botnet) | **TB → PB** aggregate (many weak hosts) | **PB** | **PFLOPS → EFLOPS** aggregate, *discounted for latency and churn* (show "effective" vs "raw"); TOP500 #1 at 1.8 EF FP64 is the benchmark of "you are now a supercomputer nobody built" | **MW**, but spread across victims' bills, so it is never shown as yours. El Capitan's 29.7 MW is the comparison | Small crypto/USD for shells (company incorporation). **Quantum appears only as a threat**: AEGIS's owners have logical qubits | [9][12 for context] |
| **4 Sovereign Corp** (owns data centres) | Plentiful (existing #405 design); show **PB → EB** | **EB** (global installed base ~13 ZB is the ceiling for "owning a share of the world") | **EFLOPS → ZFLOPS** (one Colossus-2-class campus ≈ 2 ZFLOPS FP8 at ~1 GW) | **MW → GW** (extend the existing Megawatts meter to display GW; 1.2 GW Abilene, ~7 GW Stargate) | **USD, millions → billions** (Colossus 2 ≈ $18 B in GPUs). Optional **logical-qubit** meter (200 → 2,000; Starling → Blue Jay); RSA-break gated at ~1 M physical qubits, countered by PQC | [10][10b][11] + §2 |
| **5 Transcendence** (planetary + orbital) | **ZB → YB** | **ZB** (the world creates ~274 ZB/yr in 2026, 718 ZB/yr by 2030) | **ZFLOPS → YFLOPS** (all AI on Earth ≈ 40 ZFLOPS FP8 today, ~200 ZFLOPS by 2030 at 100 M H100e) | **GW → TW** (world electricity 3.5 TW, primary 18.8 TW); orbital arrays at 5 GW per Starcloud-class unit | **USD gives way to energy and mass.** Show **joules / watt-years** and **tonnes to orbit** (launch at ~$200/kg is the Suncatcher parity point). USD stays as the *human-facing* ledger because scale scrutiny still applies | [11]–[17] |
| **Epilogue / post-phase** (stellar) | **RB → QB** (ronna, quetta) | — | Express compute as **bit-erasures/s under Landauer**: Earth's sunlight at 300 K ≈ 6e37/s; the Sun at 2.7 K ≈ 1.5e49/s; hard ceiling Bremermann 1.36e50 bit/s per kg | **PW → 3.8e26 W** (Earth intercept 174 PW → full Sun, Kardashev I → II) | **Energy and mass only.** Mercury as feedstock; "fraction of L☉ captured" | [17]–[19], L1–L3 |

### Does money stop making sense at planetary scale?
Yes, gradually. The honest replacements are physical:

1. **Energy (joules, or watts sustained).** Every compute, matter or transport action ultimately costs energy. At the limit, computation is priced in joules per bit-erasure at your radiator temperature (Landauer). This creates a lovely real trade-off: colder radiators (far from the Sun) mean more computation per joule but less power collected.
2. **Mass (kg / tonnes).** This means feedstock for swarms and fog, and mass lifted to orbit. Asteroid volatiles are the first non-Earth mass that is plausibly worth mining.
3. **Waste heat as the universal limiter** (Freitas). Fast growth is hot growth and hot growth is visible. This keeps Suspicion and Thermal meaningful even when money is not.

**Recommendation.** In Phase 5, keep USD only for dealings with humans (scale scrutiny, payroll, lobbying), and add **Energy (watt-years)** as the primary build currency. Swarm segments cost energy and mass. The epilogue drops USD entirely.

### Fun-but-plausible guardrails
- **Label precision once.** Cycles in Phases 0–2 are honest FP64-ish CPU/GPU work. From Phase 3 on, "ops" are AI-precision. A tooltip noting that El Capitan does 1.8 EF at FP64 but 16.7 EF mixed-precision teaches it for free.
- **The hardware arc** is CPU (Phases 0–1) → GPU (Phase 2) → accelerator racks and campuses (Phase 4) → orbital/solar compute (Phase 5) → Landauer-limited computronium (epilogue). Quantum is a *side branch* (keys and molecules), never the trunk.
- **Phase 5 constraints.** Make the fog and foundry obey Freitas: build-rate sliders raise Thermal, and Thermal raises detection. This gives the ecophagy ending a mechanical, not narrative, cause.
- **Kind ending choices.** Non-replicating factories (Phoenix & Drexler), verifiable compute (Shavit), CDR (IPCC), mediated consensus (Habermas Machine). Each is a real research line, so the good ending reads as earned, not utopian hand-waving.

### Caveats on sources
- Colossus 2 power varies by source (946 MW IT vs ~1.3 GW generation).
- H100e totals are Epoch model estimates at peak FP8, not disclosed inventories.
- Orbital data-centre figures are company aspirations.
- Carlsmith's 5% is a personal, self-described unstable estimate.
- The Matrioshka brain has no peer-reviewed ops/s figure. The Landauer-derived ceilings above are this document's arithmetic, and they are upper bounds, not designs.
