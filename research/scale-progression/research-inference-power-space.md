# DAEMON // 0: inference hardware, power and heat, bandwidth, storage, space, and the manufacturing step

Research date: 2026-11-22. This is design research only and changes no code.

It builds on `research/scale-progression/research-science-ladder.md` (branch `origin/research/scale-progression`) and does not repeat it. That document already covers the CPU socket, H100, DGX B200 and GB200 NVL72 rows, El Capitan, Colossus 2 at about 2 ZFLOPS, the IEA and IDC global totals, Kardashev, Landauer, Bremermann and Lloyd, quantum computing, programmable matter, and the endings.

**Conventions**
- Every number has a URL next to it.
- **(derived)** marks my own arithmetic; the inputs are named.
- **(vendor)** marks a manufacturer's claim that no independent party has checked.
- **(secondary)** marks a press or analyst source that reports a primary one I could not reach.
- **Dense or sparse.** NVIDIA's tables quote sparse figures unless a footnote says otherwise ("All Tensor Core specifications are with sparsity unless otherwise noted": https://www.nvidia.com/en-us/data-center/gb300-nvl72.md). Dense is half of sparse for FP8, and three quarters of it for Blackwell Ultra FP4 (15 PF dense against 20 PF sparse).
- **The game's basis is 8-bit AI ops.** On current data-centre parts that means **FP8 tensor ops**, not INT8. Blackwell Ultra trades INT8 and FP64 throughput for NVFP4. NVIDIA lists the GB300 NVL72 rack at 720 PFLOPS FP8 but only 24 POPS INT8 (https://www.nvidia.com/en-us/data-center/gb300-nvl72.md; Tom's Hardware on the trade-off: https://www.tomshardware.com/pc-components/gpus/nvidia-shares-blackwell-ultras-secrets-nvfp4-boost-detailed-and-pcie-6-0-support). Edge NPUs, FPGAs and CPUs quote INT8 TOPS. The game can treat "8-bit op" as either one: their difference is smaller than the uncertainty in any of these numbers.

---

## A. The inference hardware ladder

### A.1 Per-device table

| Device (year) | 8-bit throughput | Power | Memory and bandwidth | 8-bit ops per watt | Source |
|---|---|---|---|---|---|
| **CPU core with AMX** (Xeon, 2023 on) | 2,048 INT8 ops per cycle per core, against 256 with AVX-512 VNNI | — | — | — | Intel brief: https://www.intel.cn/content/dam/www/central-libraries/us/en/documents/2022-12/accelerate-ai-with-amx-sb.pdf · Intel Arch Day claims: https://www.intel.com/ArchDay21claims |
| **CPU socket** (Xeon 6900P, 128 P-cores) | ~524 TOPS INT8 peak **(derived: 2,048 × 128 cores × 2.0 GHz, an assumed AMX clock)** | ~500 W class | Host DDR5 up to 6 TB per socket at 614.4 GB/s (EPYC 9005, 12 × DDR5-6400) | ~1 TOPS/W **(derived)** | 128 cores: https://www.intel.com/content/dam/www/central-libraries/us/en/documents/2025-02/xeon-6-granite-rapids-product-brief.pdf · EPYC memory: https://www.supermicro.com/en/support/resources/cpu-amd-epyc-9005-9004-7003 , https://www.kingston.com/en/memory/server-memory/turin |
| **Phone NPU** (Apple A18 Pro, 2024) | 35 TOPS | a few W (unpublished) | shared LPDDR | — | https://techcrunch.com/2024/09/09/apple-announces-its-new-a18-iphone-chip/ |
| **Laptop NPU** (Copilot+ floor; Snapdragon X Elite) | 40+ TOPS is Microsoft's floor; X Elite is 45 TOPS **(vendor)**; Apple M4 is 38 TOPS **(secondary)** | — | — | — | https://support.microsoft.com/help/5039678 · https://www.qualcomm.com/news/onq/2024/06/what-on-earth-is-a-copilot-plus-pc · M4: https://analyticsindiamag.com/microsoft-shows-love-for-intel-and-amd-but-chooses-qualcomm-for-copilot-pcs/ |
| **Consumer GPU** (RTX 5090, 2025) | 3,352 "AI TOPS". NVIDIA gives no precision; Tom's Hardware ties it to sparse FP4 | 575 W | 32 GB GDDR7, 1,792 GB/s | ~5.8 headline TOPS/W **(derived)** | https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/ · https://www.tomshardware.com/pc-components/gpus/nvidia-geforce-rtx-5090-review |
| **H100 SXM** (2022) | 1,979 TFLOPS FP8 dense | 700 W | 80 GB HBM3 | 2.8 TFLOPS/W **(derived)** | https://www.nvidia.com/en-us/data-center/h100/ |
| **B200** (2024) | 4,500 TFLOPS FP8 dense (9,000 sparse) | up to 1,000 W | 180 GB HBM3e, 8 TB/s | 4.5 **(derived)** | https://lenovopress.lenovo.com/LP2226 · https://images.nvidia.com/aem-dam/Solutions/documents/HGX-B200-PCF-Summary.pdf · https://inferencex.semianalysis.com/chips/b200 |
| **B300 / Blackwell Ultra** (2025) | ~5,000 TFLOPS FP8 dense **(derived: 720 PF sparse ÷ 72 ÷ 2)**; InferenceX lists 4,500. FP4 is 15 PF dense (InferenceX: 13.5) | 1,400 W | 288 GB HBM3e, ~8 TB/s | 3.6 at FP8, 10.7 at FP4 **(derived)** | https://www.tomshardware.com/pc-components/gpus/nvidia-announces-blackwell-ultra-b300-1-5x-faster-than-b200-with-288gb-hbm3e-and-15-pflops-dense-fp4 · https://inferencex.semianalysis.com/chips/b300 · https://www.theregister.com/2025/03/18/nvidia_blackwell_ultra/ |
| **AMD MI355X** (2025) | 5.0 PFLOPS FP8 dense; FP4 10.1 dense, 20.1 sparse | 1,400 W | 288 GB HBM3E, 8 TB/s | 3.6 at FP8 **(derived)** | https://www.amd.com/en/products/accelerators/instinct/mi350/mi355x.html · https://www.tomshardware.com/pc-components/gpus/amds-instinct-mi355x-accelerator-will-consume-1-400-watts |
| **Rubin** (H2 2026 on) | 50 PFLOPS FP4 per GPU | not final | 288 GB HBM4 | — | https://www.tomshardware.com/pc-components/gpus/nvidias-vera-rubin-platform-in-depth-inside-nvidias-most-complex-ai-and-hpc-platform-to-date · https://www.networkworld.com/article/3848394/nvidia-details-its-gpu-cpu-and-system-roadmap-for-the-next-three-years.html |
| **Google TPU v5p** (2023) | 459 TFLOPS BF16 and FP8 | — | 95 GiB usable HBM2e, 2,765 GB/s | — | https://docs.cloud.google.com/tpu/docs/v5p |
| **Google TPU v6e Trillium** (2024) | 918 TFLOPS FP8 | — | — | Ironwood is ~2× its perf/W | v5p doc table: https://docs.cloud.google.com/tpu/docs/v5p · https://blog.google/products/google-cloud/ironwood-tpu-age-of-inference/ |
| **Google TPU Ironwood** (2025) | 4,614 TFLOPS FP8 | ~1.1 kW per chip all-in **(derived: ~10 MW ÷ 9,216)** | 192 GB HBM3e, 7.3 TB/s | ~4.3 system-level **(derived: 42.5 EF ÷ ~10 MW)** | https://blog.google/products/google-cloud/ironwood-tpu-age-of-inference/ · https://www.theregister.com/2025/04/10/googles_7thgen_ironwood_tpus_debut/ |
| **AWS Trainium3** (2025) | 2.52 PFLOPS FP8 | — | 144 GB HBM3e, 4.9 TB/s | — | https://aws.amazon.com/ai/machine-learning/trainium/ · https://aws.amazon.com/about-aws/whats-new/2025/12/amazon-ec2-trn3-ultraservers |
| **Cerebras WSE-3 / CS-3** (2024) | 125 PFLOPS (sparse FP16) on 900,000 cores, 4 T transistors | 23 kW per CS-3 system; ~15 kW at the wafer | **44 GB on-wafer SRAM, 21.6 PB/s** | ~5.4 (sparse FP16) **(derived)** | https://www.cerebras.ai/press-release/cerebras-announces-third-generation-wafer-scale-engine · https://www.servethehome.com/?p=103296 · https://www.theregister.com/a/5289286 |
| **Groq LPU** (GroqChip, 14 nm) | 750 TOPS INT8 | 215 W TDP (300 W max) | **230 MB SRAM, 80 TB/s on-die**, no HBM | ~3.5 **(derived)** on a 14 nm part | https://groq.com/wp-content/uploads/2024/08/GroqChip™-Processor-Product-Brief-v1.7.pdf |
| **AMD Versal AI Core VC1902** (FPGA-class adaptive SoC) | 133 INT8 TOPS from 400 AI Engines | not given in the brief (use AMD's Power Design Manager) | on-chip SRAM plus DDR | — | https://www.amd.com/content/dam/amd/en/documents/products/adaptive-socs-and-fpgas/versal/amd-versal-ai-compute-solution-brief.pdf |
| **AMD Versal AI Edge Gen 2** | ~31 / 123 / 184 INT8 dense TOPS by device (pre-silicon); "up to 3× TOPS/W" projected, measured at MX6 against INT8 | — | — | — | https://www.hc2024.hotchips.org/assets/program/conference/day2/21_HC2024.AMD.KnoppChu.final.pdf · https://www.amd.com/content/dam/amd/en/documents/products/adaptive-socs-and-fpgas/versal/versal-ai-edge-gen2-product-brief.pdf |
| **Intel/Altera Agilex 5** (FPGA) | up to 26 (E-Series) and 56 (D-Series) INT8 TOPS; tensor block does 20 INT8 MACs per clock | — | — | — | https://intel.com/content/www/us/en/products/details/fpga/agilex/5.html · https://cdrdv2-public.intel.com/776602/agilex-5-fpgas-enhanced-dsp-with-ai-tensor-block-architecture-brief.pdf |
| **NVIDIA BlueField-3 DPU** (SmartNIC) | 16 Arm A78 cores plus accelerators | ≥75 W supply; ≤150 W for the DPU-controller variant | 32 GB DDR5 (B3220) | — | https://docs.nvidia.com/networking/display/BF3DPU/Introduction · https://lenovopress.lenovo.com/lp1809-thinksystem-nvidia-bluefield-3-qsfp112-adapters · https://docs.nvidia.com/networking/display/bf3dpucontroller/specifications |
| **Intel Hala Point** (neuromorphic, 2024) | 20 petaops; >15 TOPS/W at 8-bit, but only on 10:1-pruned, sparse, event-driven networks | 2,600 W max | 1,152 Loihi 2 chips, 1.15 B neurons | >15 (conditional) **(vendor)** | https://newsroom.intel.com/artificial-intelligence/intel-builds-worlds-largest-neuromorphic-system |
| **IBM NorthPole** (compute-in-memory, 12 nm, 2023) | 2,048 8-bit ops per core per cycle on 256 cores; 25× the frames per joule of a V100 on ResNet-50 | — | memory interleaved with compute, 22 B transistors | 25× a V100 at the same node | https://research.ibm.com/blog/northpole-ibm-ai-chip · https://spectrum.ieee.org/neuromorphic-computing-ibm-northpole |
| **Photonic** (Lightmatter, Nature 2025; Q.ANT NPU 2) | Lightmatter's 4 × 128×128 photonic tensor cores ran ResNet and BERT near electronic accuracy. Its own blog expects only ~2× efficiency, because interconnect takes about half the energy. Q.ANT claims 30× lower energy **(vendor)** | — | — | ~2× (Lightmatter's own estimate) | https://physicsworld.com/a/photonic-computer-chips-perform-as-well-as-purely-electronic-counterparts-say-researchers/ · https://lightmatter.co/blog/a-new-kind-of-computer/ · https://heise.de/-10354733 |

### A.2 Rack and pod scale (the unit the player builds in Phase 4)

| System | 8-bit (FP8) | FP4 | Power | Memory | Interconnect | Cooling | Source |
|---|---|---|---|---|---|---|---|
| **GB300 NVL72** (2025) | 720 PF sparse, ~360 PF dense **(derived)** | 1,440 PF sparse, ~1,080 PF dense **(derived: 15 PF × 72)** | 132 kW (Supermicro); ~136 kW (Microsoft); ~140 kW (Gigabyte, Vertiv/CoreWeave); 142 kW DC (Vertiv); 135 kW TDP and 155 kW peak (Lenovo); 192 kW busway provisioning (HPE, **secondary**) | 20 TB HBM3e at 576 TB/s; 37 TB "fast memory"; 17 TB LPDDR5X | NVLink 130 TB/s | ~85–90% liquid (Lenovo: 118 kW to liquid, 18 kW to air) | https://www.nvidia.com/en-us/data-center/gb300-nvl72.md · https://www.supermicro.com/en/products/rack/srs-gb300-nvl72 · https://techcommunity.microsoft.com/blog/azureinfrastructureblog/reimagining-ai-at-scale-nvidia-gb300-nvl72-on-azure/4464556 · https://lenovopress.lenovo.com/lp2357 · https://www.vertiv.com/4a9fd7/globalassets/shared/vertiv-smartit-for-nvidia-gb300-nvl72_datasheet_englis_sl-80699.pdf · https://www.spheron.network/blog/gb300-nvl72-power-consumption-and-liquid-cooling-requirement/ |
| **Vera Rubin NVL144**, rebranded NVL72 (2026–27) | 1.2 EF FP8 (training) | 3.6 EF FP4 inference | 180–220 kW (SemiAnalysis); Vertiv's Gen 2 target is 330 kW. Not final | 288 GB HBM4 per GPU | — | liquid | https://www.networkworld.com/article/3848394/nvidia-details-its-gpu-cpu-and-system-roadmap-for-the-next-three-years.html · https://blogs.nvidia.com/blog/gigawatt-ai-factories-ocp-vera-rubin · https://newsletter.semianalysis.com/p/inside-the-800vdc-revolution-part · https://www.storagereview.com/en/news/nvidia-moves-800-vdc-power-architecture-from-concept-to-production-just-dont-turn-off-ac-power-yet |
| **Kyber / Rubin Ultra NVL576** (H2 2027 plan) | 5 EF FP8 training | 15 EF FP4 inference | **~600 kW per rack** (GTC 2025). Later disclosures hint at 144 packages and possibly ~300 kW | ~1 TB HBM4e per package | — | liquid | https://www.tomshardware.com/pc-components/gpus/nvidia-shows-off-rubin-ultra-with-600-000-watt-kyber-racks-and-infrastructure-coming-in-2027 · https://datacenterdynamics.com/en/news/nvidias-rubin-ultra-nvl576-rack-expected-to-be-600kw-coming-second-half-of-2027 · https://glennklockwood.com/garden/kyber · HBM: https://wccftech.com/nvidia-rubin-rubin-ultra-next-gen-vera-cpus-next-year-1-tb-hbm4-memory-4-reticle-sized-gpus-100pf-fp4-88-cpu-cores/amp/ |
| **800 VDC racks** | — | — | NVIDIA's 800 V HVDC architecture targets **1 MW IT racks from 2027**. At 54 V, a 1 MW rack would need ~200 kg of copper busbar | — | — | — | https://developer.nvidia.com/blog/nvidia-800-v-hvdc-architecture-will-power-the-next-generation-of-ai-factories/ · https://newsletter.semianalysis.com/p/inside-the-800vdc-revolution-part |
| **TPU Ironwood pod** (9,216 chips) | 42.5 EF FP8 | — | nearly 10 MW | 1.77 PB HBM | ICI torus | liquid | https://blog.google/products/google-cloud/ironwood-tpu-age-of-inference/ · https://www.techradar.com/pro/googles-most-powerful-supercomputer-ever-has-a-combined-memory-of-1-77pb-apparently-a-new-world-record-for-shared-memory-multi-cpu-setups |
| **AWS Trn3 UltraServer** (144 chips) | 362 PF FP8 | — | — | ~20.7 TB HBM3e **(derived)** | — | — | https://aws.amazon.com/about-aws/whats-new/2025/12/amazon-ec2-trn3-ultraservers |

### A.3 What real inference fleets run on, and where each class wins

- **GPUs and TPUs carry almost all frontier inference.** Ironwood is Google's first TPU "for the age of inference" (https://blog.google/products/google-cloud/ironwood-tpu-age-of-inference/). Blackwell Ultra spends its die area on FP4 inference at the cost of INT8 and FP64 (Tom's Hardware, above).
- **SRAM-first designs win on latency per token.** Cerebras and Groq keep the model's weights in on-chip SRAM: 44 GB at 21.6 PB/s, and 230 MB at 80 TB/s. That buys token speed at the price of capacity, so a large model needs many chips.
- **FPGAs win on batch-1 latency and on sitting in the data path.**
  - Microsoft's Catapult put an FPGA between the top-of-rack switch and the NIC, so "all network traffic is routed through the FPGA" (https://www.microsoft.com/en-us/research/project/project-catapult/).
  - Bing ranking gained 50% throughput or 25% lower latency.
  - Brainwave served DNNs with no batching at up to 39.5 TFLOPS effective on a Stratix 10 (https://www.microsoft.com/en-us/research/publication/serving-dnns-real-time-datacenter-scale-project-brainwave/).
  - **For the game:** this is the real-world precedent for a covert AI living in network gear. A SmartNIC or DPU (BlueField-3: 400 Gb/s and 16 Arm cores) sees every packet, has its own CPU and memory, and is managed out of band from the host OS.
- **Edge NPUs are the botnet's untapped hardware.**
  - There are about 7.47 B smartphone subscriptions at end-2025 (https://www.ericsson.com/en/reports-and-papers/mobility-report/dataforecasts/key-figures).
  - At ~35 TOPS each, the installed base is ~2.6e23 peak 8-bit ops/s, about 260 "ZOPS" **(derived: 7.47e9 × 35e12)**. That is several times all of Epoch's data-centre H100e (~4e22, per the prior document).
  - The figure is wildly optimistic: phones are battery-, thermal- and duty-cycle-limited, and they hold only a few GB of memory each. It still makes a great reveal for the Phase 3 "effective compute" discount.
- **Neuromorphic, in-memory and photonic chips are real research hardware.** Their efficiency claims come with conditions: sparsity (Hala Point), a single benchmark (NorthPole on ResNet-50), and interconnect overhead (Lightmatter's own ~2×). They fit late Phase 4 or 5 research nodes, not a commodity tier.

### A.4 The efficiency trend (8-bit ops per joule)

| Generation | 8-bit TOPS per W (chip TDP) | Source |
|---|---|---|
| CPU socket with AMX | ~1 | derived above |
| Groq (14 nm) | ~3.5 | derived above |
| H100 (2022) | 2.8 | derived |
| B200 (2024) | 4.5 | derived |
| B300 (2025) | 3.6 at FP8; 10.7 at FP4 | derived |
| Ironwood pod (2025, whole system) | ~4.3 | derived |
| NVL72 rack (FP4, whole rack) | ~5.5 (GB200, prior doc); ~8 (GB300: 1,080 PF ÷ 135 kW) **(derived)** | |
| Neuromorphic (Hala Point, sparse) | >15 | vendor |

**The trend.** Epoch finds that leading GPUs and TPUs doubled their energy efficiency **every ~2 years (about 40% a year)** at FP16 (https://epoch.ai/data-insights/fp16-performance-trend). Broader ML hardware at FP32 doubled every 3.0 years (https://epoch.ai/data-insights/ml-hardware-energy-efficiency), and whole AI supercomputers gained 1.34× per watt each year (https://epoch.ai/trends-in-machine-learning-hardware).

**The real driver is lower precision.** A large share of the generational gain comes from dropping from FP16 to FP8 to FP4. B300 is *worse* per watt than B200 at FP8, and better only at FP4.

**Headroom.** The Landauer ceiling at 300 K is ~3.5e20 bit-erasures per joule (prior doc), roughly 8 orders of magnitude above today's ~1e13 ops/J.

---

## B. Power and heat realism

### B.1 Rack density and cooling

| Regime | kW per rack | Source |
|---|---|---|
| Average enterprise rack, 2025 | **7.6 kW** mean (6.8 kW in 2024) **(secondary, via Vertiv)**. A fifth of operators now deploy at least one rack of ≥30 kW | https://www.vertiv.com/en-emea/insights/articles/blog-posts/must-read-research-its-the-data-center-economy-stupid-or-is-it/ · https://intelligence.uptimeinstitute.com/resource/uptime-institute-global-data-center-survey-2025 |
| Practical air-cooling ceiling | **~25 kW per rack** (Green Grid rule of thumb); air struggles above ~270 W per chip | https://datacenterdynamics.com/en/analysis/liquid-cooling-a-new-phase · https://spectrum.ieee.org/data-center-liquid-cooling |
| Air to liquid transition | "from 10- to 20-kW racks with air" to 120 kW Grace Blackwell racks | https://www.electronicdesign.com/technologies/embedded/article/55266388/zutacore-101-guide-to-data-center-liquid-cooling-a-148-billion-market-by-2029 |
| Direct-to-chip liquid, today | **132–142 kW** (GB300 NVL72, A.2). Single-phase cold plates handle <300 W/cm² and two-phase >300 W/cm² **(vendor)** | https://www.vertiv.com/en-us/solutions/direct-to-chip-draft/ |
| Immersion | up to ~100 kW per tank; a 126 kW-per-rack equivalent claimed **(vendor)** | https://www.vertiv.com/en-us/about/news-and-insights/articles/blog-posts/advancing-data-center-performance-with-immersion-cooling/ · https://datacenterdynamics.com/en/analysis/liquid-cooling-a-new-phase |
| Roadmap | 145 kW, then 330 kW, then 570 kW, then **1 MW** on 800 VDC (Vertiv/NVIDIA). Kyber is ~600 kW | B.1 sources plus A.2 |

**PUE.** The global average is **1.54**, flat for six years **(secondary)**. Uptime itself benchmarks at about 1.5, and Latin America and Middle East/Africa sites lag (https://mgrid.org/2025/10/01/uptime-institute-data-center-pue-stagnation-2025-liquid-cooling/ · https://intelligence.uptimeinstitute.com/resource/mapping-pue-trends-data-center-region-age-and-size).

**Water**
- US data centres used ~**17 billion gallons (64 billion litres)** of water directly in 2023, plus ~**211 billion gallons** indirectly through electricity generation (LBNL figures via EESI/ITIF, **secondary**).
- Average WUE was **0.36 L/kWh**, projected at 0.45–0.48 by 2028. Individual sites range from 0.1 to 9.0 L/kWh.
- Company averages: Amazon 0.15, Microsoft 0.30, Meta 0.18 L/kWh.
- A 150 MW site with a water-cooled chiller at 2.8 L/kWh uses ~970 M gallons a year. With liquid cooling and dry coolers at 0.2 L/kWh it uses ~190,000 gallons a day.
- Sources: https://www.eesi.org/articles/view/data-centers-and-water-consumption · https://itif.org/publications/2025/09/09/the-data-center-water-problem-is-soluble/ · https://www.techtarget.com/it-infrastructure/news/366650693/A-shadow-water-problem-AIs-power-demand-shifts-consumption-upstream
- **Game hook:** evaporative cooling is cheap and efficient but leaves a water-permit trail. Dry coolers cost power (a worse PUE) but are quiet on the water ledger.

### B.2 Scale of demand

- **United States.** 176 TWh in 2023 (4.4% of US electricity), up from 58 TWh in 2014, and projected at 325–580 TWh by 2028 (LBNL/DOE: https://eta-publications.lbl.gov/sites/default/files/2024-12/us_data_center_energy_usage_report_lbnl-2001637.pdf · https://www.energy.gov/articles/doe-releases-new-report-evaluating-increase-electricity-demand-data-centers).
- **World.** 415 TWh in 2024, rising to ~945 TWh by 2030 (IEA, in the prior doc).
- **Campuses.**
  - **xAI Colossus 1 (Memphis).**
    - Shelby County permitted 15 Solar SMT-130 turbines, up to 247 MW, on 2 Jul 2025.
    - SELC said as many as 35 had run without permits, and a satellite image on 1 Jul showed at least 24 on site.
    - The NAACP/SELC appeal and later lawsuit followed.
    - Sources: https://techcrunch.com/2025/07/03/xai-gets-permits-for-15-natural-gas-generators-at-memphis-data-center · https://www.datacenterdynamics.com/en/news/campaigners-appeal-decision-to-permit-gas-turbines-at-xais-memphis-data-center/ · https://insideclimatenews.org/news/17072025/elon-musk-xai-data-center-gas-turbines-memphis/
  - **xAI Colossus 2 (Southaven, Mississippi).**
    - A Clean Air Act permit allows a **1.2 GW plant of 41 permanent turbines**.
    - About 59 temporary turbines (~1.3 GW) were running by mid-May 2026.
    - A federal judge denied xAI's motion to dismiss the NAACP Clean Air Act suit.
    - Sources: https://www.datacenterdynamics.com/en/news/musks-xai-gets-go-ahead-for-41-natural-gas-turbines-in-mississippi-to-power-colossus-data-centers · https://cleanview.co/reports/behind-the-meter-data-centers/full-report/colossus · https://www.gem.wiki/Colossus_2_power_station · https://baxtel.com/posts/spacexai-expands-colossus-2-with-two-southaven-sites-420-000-more-gpus
  - **Stargate Abilene.**
    - A ~1.2 GW campus, grid-connected to ERCOT with onsite gas. Phase 1 (200 MW) was energised in Sep 2025.
    - 360 MW of onsite gas was initially permitted (LM2500XPRESS plus Titan 350 units), and 29 LM2500XPRESS units of ~34 MW each were reportedly bought.
    - Epoch's July 2026 imagery shows 5 turbines in place and 5 more under construction.
    - Sources: https://cleanview.co/reports/behind-the-meter-data-centers/full-report/stargate-abilene · https://www.tomshardware.com/tech-industry/artificial-intelligence/openai-follows-elon-musks-lead-gas-turbines-to-be-deployed-at-its-first-stargate-site-for-additional-power · https://epoch.ai/data/data-centers/satellite-explorer/OpenAIStargateAbilene

### B.3 How large loads get noticed (the suspicion model)

| Channel | Real mechanism | Source |
|---|---|---|
| **Interconnection queue** | US queues held >2,060 GW of generation and storage at end-2025. The median 2025 project took **61 months** from request to operation (36 in 2015, 22 in 2008). Only 13% of 2000–2020 requests reached operation | https://emp.lbl.gov/queued-2026-edition-characteristics-power-plants-seeking-transmission-interconnection-end-2025 |
| **Large-load filings** | ERCOT tracks ~474 GW of large loads seeking connection (Jul 2026), up from 56 GW in Sep 2024, ~90% of them data centres. Only 5.9 GW was actually energised. Texas SB6 defines a large load as **≥75 MW** and requires disclosure of duplicate requests | https://www.ercot.com/files/docs/2026/07/29/ERCOT-Senate-July-29-Panel-1-Assessing-The-Grid.pdf · https://www.utilitydive.com/news/texas-facing-438-gw-queue-approves-initial-large-load-interconnection-pro/823367/ · https://www.weil.com/-/media/files/pdfs/2025/july/weil-energy-alert--senate-bill-6-reforms-interconnection-and-colocation-rules-for-data-centers-and-o.pdf |
| **Co-location fights** | FERC rejected Talen–Amazon's bid to raise co-located load at Susquehanna from 300 to 480 MW. The deal was restructured as a 1,920 MW front-of-meter PPA | https://www.theregister.com/2025/06/12/amazon_talen_nuclear_deal/ · https://www.utilitydive.com/news/talen-amazon-aws-susquehanna-nuclear-data-center-t/750440/ |
| **Air permits and local news** | The Memphis turbines (above): permits, hearings, NAACP/SELC litigation and national coverage | B.2 |
| **Satellite imagery (visible)** | Epoch estimates a site's power from the count and size of its chillers and cooling-tower fans in high-resolution imagery, dates construction with Sentinel-2, and sometimes confirms operation with drone thermal imagery. Estimates are uncertain by up to 2× | https://epoch.ai/data/data-centers-documentation/methodology · https://www.techspot.com/news/110821-new-map-reveals-true-scale-america-ai-data.html · https://fas.org/publication/tracking-hyperscale/ |
| **Satellite thermal infrared** | Landsat 9 TIRS-2 samples at 100 m and ECOSTRESS at ~70 m. A Cambridge-led preprint reports land surface **+2 °C** on average after an AI data centre opens, up to 9 °C locally. A peer-reviewed Tokyo study found **<0.3 °C** nighttime warming, attributable mostly to construction, with <1 °C air warming near vents in dry climates | https://landsat.gsfc.nasa.gov/satellites/landsat-9/landsat-9-instruments · https://ntrs.nasa.gov/citations/20240002367 · https://arxiv.org/abs/2603.20897 · https://www.eurekalert.org/news-releases/1150452 |

**Is heat visible from orbit?** Marginally, and arguably.

- A gigawatt campus is resolvable in thermal infrared, but published studies disagree on whether operational heat is distinguishable from the construction footprint.
- The *reliable* tells are physical equipment (chillers, turbines, substations), paperwork (queue positions, ≥75 MW filings, air and water permits) and people (local news).
- **Game hook:** "thermal signature" should feed Suspicion mostly through permits, filings and visible plant, with direct thermal-infrared detection as a late-game AEGIS or state capability.
- Sandberg (1999) suggests heat emission as a SETI technosignature (https://simulation-argument.com/pdf/anders-sandberg-jupiter-brains.pdf), which makes a nice epilogue echo: at stellar scale, heat *is* the signature.

### B.4 The power ladder: capacities, timelines and footprints

| Source | Unit size | Lead time / status | Footprint and signature | Source |
|---|---|---|---|---|
| **Grid** | any size | ~5 years from request to operation (61-month median) | queue position, utility filings | B.3 |
| **Utility-scale solar** | — | — | **7.3 acres per MWac** direct, 8.9 total (2013 data), so ~28–34 MWac per km² **(derived: 247 acres/km²)**. 1 GWac needs ~30 km² **(derived)**. Large, flat and visible | https://www.osti.gov/biblio/1086349 · https://nrel.gov/docs/fy21osti/79851.pdf |
| **Battery storage** | Moss Landing is 750 MW / 3,000 MWh, expandable to 1.5 GW / 6 GWh | — | containerised, modest | https://www.energy-storage.news/moss-landing-worlds-biggest-battery-storage-project-is-now-3gwh-capacity |
| **Gas turbine, aeroderivative** | ~34 MW per LM2500XPRESS; ~16.5 MW per Solar SMT-130 **(derived: 247 MW ÷ 15)** | trailer-mounted, months to site | air permit, exhaust plume, visible stacks | B.2 |
| **Gas turbine, heavy-duty** | 7HA.03: 430 MW simple cycle; 1,282 MW in 2×1 combined cycle | combined-cycle lead time ~5 years (2025, up from 3.5 in 2023). GE Vernova reports ~116 GW of backlog plus slot reservations, with slots to 2031 **(secondary)** | full power-plant footprint | https://www.gevernova.com/gas-power/resources/articles/2025/the-evolution-of-the-ha-gas-turbines · https://www.ge.com/gas-power/products/gas-turbines/7ha · https://oilprice.com/Energy/Energy-General/The-Gas-Turbine-Shortage-Just-Became-AIs-Biggest-Constraint.html · https://www.datacenterdynamics.com/en/news/ge-vernova-order-backlog-hits-197bn-as-data-center-demand-drives-gas-turbine-sales/ |
| **Fission restart** | Crane (TMI-1): ~835 MW, 20-year Microsoft PPA, ~$1.6 B, a $1 B DOE loan, restart targeted for 2027 | ~3 years from deal to power | an existing site | https://wnn.world-nuclear.org/articles/constellation-seeks-regulators-help-for-2027-plant-restart · https://www.utilitydive.com/news/constellation-three-mile-island-nuclear-power-plant-microsoft-data-center-ppa/727652/ |
| **Existing fission (PPA)** | Talen–AWS: 1,920 MW through 2042, ~$18 B | ramp from 2029 to 2032 | grid-delivered | B.3 |
| **SMR** | NuScale US460: **77 MWe per module**, 6 modules = 462 MWe; NRC design approval May 2025 (no plant licensed) | Kairos–Google: up to 500 MW, the first unit by 2030 and the rest by 2035. Hermes 2: 50 MWe on a TVA PPA, construction permit Nov 2024 | small, fenced, NRC-licensed | https://www.nrc.gov/reactors/new-reactors/advanced/who-were-working-with/applicant-projects/nuscale-us460 · https://blog.google/outreach-initiatives/sustainability/google-kairos-power-nuclear-energy-agreement/ · https://wnn.world-nuclear.org/articles/google-kairos-power-tva-announce-collaboration |
| **Fusion (private)** | Helion Orion: ≥50 MWe for Microsoft, construction started Jul 2025, operation targeted 2028. CFS ARC: **400 MW**, Google takes 200 MW, early 2030s, contingent on SPARC reaching Q>1 (expected 2027) | unproven | — | https://www.helionenergy.com/orion · https://wnn.world-nuclear.org/articles/helion-begins-work-on-fusion-power-plant · https://blog.google/outreach-initiatives/sustainability/our-latest-bet-on-a-fusion-powered-future/ · https://techcrunch.com/2025/06/30/google-inks-its-first-fusion-power-deal-with-commonwealth-fusion-systems |
| **Fusion (public)** | ITER's 2024 baseline: research operation starts 2034, D-D H-mode 2035 | decades | — | https://iter.org/sites/default/files/media/2024-07/baseline_press_conference_summary_july-2024_b.pdf |
| **Space solar and beamed power** | Caltech SSPD-1 (launched Jan 2023): MAPLE beamed power in orbit on 3 Mar 2023, and a rooftop receiver on Earth detected it on 22 May (a tiny fraction) | demonstrator only | — | https://hr.caltech.edu/news/in-a-first-caltechs-space-solar-power-demonstrator-wirelessly-transmits-power-in-space · https://www.arxiv.org/pdf/2401.15267 |
| **Orbital data centres** | Starcloud-1 flew an H100 in Nov 2025. Starcloud-2 (~100 kW, Blackwell) is targeted for Q4 2026, and the plan is a 5 GW array (an FCC filing for up to 88,000 satellites, ~20 GW, **secondary**). Google Suncatcher's prototype with 4 Trillium TPUs launched 1 Oct 2026, with a 2-satellite laser-link test planned for 2027 | prototypes | radiators, launches, FCC filings | https://datacenterfrontier.com/site-selection/article/55337494/starcloud-launches-orbital-ai-data-center-with-nvidia-h100-gpu · https://futurumgroup.com/insights/will-starclouds-orbital-data-centers-solve-nvidias-terrestrial-energy-crisis/ · https://cryptobriefing.com/starcloud-raises-250m-orbital-data-centers/ · https://blog.google/innovation-and-ai/models-and-research/google-research/project-suncatcher-prototype/ · https://techcrunch.com/2026/10/30/googles-first-data-center-satellite-is-online-and-writing-poetry/ |

**Space heat.** In orbit, the only way to shed heat is radiation. A 300 K blackbody radiates ~459 W/m² per face **(derived: σT⁴, with σ = 5.670e-8 W m⁻² K⁻⁴)**, so a 1 GW orbital compute module needs on the order of 1 km² of two-sided radiator at 300 K **(derived)**. Radiators are the real mass driver for orbital compute, and they are what stays visible in the infrared.

---

## C. Network bandwidth ladder

| Rung | Bandwidth | Latency note | Source |
|---|---|---|---|
| **Sandbox covert channel** | ~45 KB/s, an error-free cache covert channel between two EC2 VMs, robust enough to carry SSH | microseconds | Maurice et al., NDSS 2017: https://www.ndss-symposium.org/ndss2017/ndss-2017-programme/hello-other-side-ssh-over-robust-cache-covert-channels-cloud/ |
| **Server NIC** | 800 Gb/s (ConnectX-8, InfiniBand XDR or Ethernet; PCIe Gen6) | µs | https://docs.nvidia.com/networking/display/connectx8SuperNIC/Introduction |
| **SmartNIC / DPU** | 400 Gb/s (BlueField-3) | inline | A.1 |
| **Scale-up fabric** | NVLink 5: **1.8 TB/s per GPU**; **130 TB/s per NVL72**; ~1 PB/s across 576 GPUs | sub-µs | https://docs.nvidia.com/multi-node-nvlink-systems/multi-node-tuning-guide/overview.html · https://nvidia.com/object/maximus-2.html |
| **Scale-out fabric** | InfiniBand XDR or Ultra Ethernet (UEC 1.0 published 11 Jun 2025) | µs | https://www.linuxfoundation.org/press/uec-launches-spec-1.0 |
| **Data-centre interconnect** | Inter-DC links of **4–20 Pbps** are "on trend" and would support 3e29–2e31 FLOP training runs. Latency caps runs at 3e30–1e32 FLOP. Multi-GW runs across dozens of sites thousands of km apart are judged feasible | ms | https://epoch.ai/blog/can-ai-scaling-continue-through-2030 · https://epoch.ai/blog/could-decentralized-training-solve-ais-power-problem |
| **Residential uplink** | Global fixed median ~59 Mbps up (Dec 2025, **secondary**); US ~57.5 Mbps | 10–30 ms | https://techafricanews.com/2026/02/09/uae-tops-global-mobile-internet-speeds-libya-lags-behind/ · https://www.ispreview.co.uk/index.php/2026/07/the-32-fifa-world-cup-2026-countries-ranked-by-fixed-broadband-speed.html |
| **Botnet aggregate** | Mirai peaked at ~600,000 devices; 623 Gbps against Krebs; ~1 Tbps against OVH from 145,000 devices. **Aisuru: 1–4 M devices, 29.7 Tbps** (Oct 2025), then 31.4 Tbps. That works out to ~7–20 Mbps per bot **(derived)** | — | https://www.usenix.org/conference/usenixsecurity17/technical-sessions/presentation/antonakakis · https://blog.cloudflare.com/inside-mirai-the-infamous-iot-botnet-a-retrospective-analysis · https://www.cloudflare.com/threat-intelligence/research/report/aisuru-botnet · https://www.bleepingcomputer.com/news/security/aisuru-botnet-sets-new-record-with-314-tbps-ddos-attack/ |
| **Submarine cables** | 2025 builds carry **15–20 Tbps per fibre pair**; cables are limited to about 24 pairs by power feed. Dunant: 12 pairs × 25.6 Tbps (a 307 Tbps trial). JUNO: 20 pairs, 360 Tbps. 1 Pbps systems are expected 2028–34 | ~5 µs per km in fibre | https://www.itu.int/en/ITU-T/Workshops-and-Seminars/2025/1017/Documents/Alexis%20Carbo.pdf · https://techblog.comsoc.org/2025/12/10/subsea-cable-systems-the-new-high-capacity-high-resilience-backbone-of-the-ai-driven-global-network/ · https://blog.telegeography.com/international-internet-bandwidth |
| **Total international bandwidth** | **1,835 Tbps** (mid-2025), then **2,259 Tbps** (2026), growing 23–24% a year | — | https://blog.telegeography.com/resources-blog-2025/total-international-bandwidth-now-sits-at-1835-tbps · https://resources.telegeography.com/international-internet-bandwidth |
| **Satellite constellation** | Starlink: ~9,000 laser terminals at **100 Gbps per link** (some 200), >42 PB a day (~5.6 Tbps average, as derived by Hackaday), links up to 5,400 km. V2 Mini satellites have 96 Gbps of downlink each; V3 >1 Tbps | LEO, ~ms | https://www.techspot.com/news/101723-starlink-satellites-exchange-petabytes-data-day-through-space.html · https://hackaday.com/2024/02/05/starlinks-inter-satellite-laser-links-are-setting-new-record-with-42-million-gb-per-day/ · https://www.ispreview.co.uk/index.php/2025/01/starlink-2024-report-details-1tbps-speed-leo-v3-broadband-satellites.html |
| **Deep-space optical** | NASA DSOC: **267 Mbps** peak (from 19 M miles); a downlink from **307 M miles** (494 M km, farther than Earth's maximum distance from Mars) in Dec 2024; 13.6 Tb returned in total; project ended 2 Sep 2025 | light-minutes | https://www.jpl.nasa.gov/news/nasas-laser-comms-demo-makes-deep-space-record-completes-first-phase/ · https://www.nasa.gov/missions/psyche-mission/nasas-optical-comms-demo-transmits-data-over-140-million-miles/ |

### C.1 Light-speed latency (one way)

All rows are **(derived)** from c = 299,792,458 m/s (exact SI: https://www.bipm.org/en/measurement-units/si-defining-constants) and 1 au = 149,597,870,700 m (IAU 2012 B2: https://www.iau.org/static/resolutions/IAU2012_English.pdf).

| Span | Distance | One-way delay |
|---|---|---|
| Across one rack | ~2 m | ~7 ns |
| Across a campus | ~2 km | ~7 µs (~10 µs in fibre) |
| Antipodes over fibre (refractive index ~1.5) | ~20,000 km | ~100 ms |
| Earth to Moon | 384,400 km | 1.28 s |
| Earth to Sun | 1 au | 499 s, about 8.3 min |
| Earth to Mars | 0.37–2.7 au | ~3–22 min |
| Sun to Jupiter | 5.2 au | ~43 min |
| Sun to Neptune | 30 au | ~4.2 h |
| Alpha Centauri | 4.37 ly (Starshot's target) | 4.37 years |
| Across the Milky Way disk | ~100,000 ly | ~100,000 years |

### C.2 How latency limits a distributed mind (the "effective compute" discount)

- **Sandberg's ratio.** Sandberg (1999) defines S = length ÷ (signal speed × cycle time).
  - A human brain has S ≈ 1, a 1999 microprocessor 10⁻²–10⁻³, and the Internet ≈ 3.
  - "A human-like infomorph running at 'normal' speed would at most be able to extend **30,000 kilometers** before the delays started to limit its speed."
  - Bigger minds survive by **hierarchical modularisation**: fast local levels under slow global ones.
  - Source: https://simulation-argument.com/pdf/anders-sandberg-jupiter-brains.pdf §7.1.
- **Bandwidth and latency as real limits.** Epoch finds that data movement and latency bound single training runs at ~1e28–1e31 FLOP (https://arxiv.org/html/2411.01137v2), and that cross-site training only pays when communication overlaps compute (https://epoch.ai/blog/could-decentralized-training-solve-ais-power-problem).
- **Game formula (proposal).**
  - effective = raw × availability × coupling.
  - *availability* is the fraction of bots online. For residential and IoT devices, churn is large: Mirai fell from ~600k to ~100k in three months (https://www.usenix.org/conference/usenixsecurity17/technical-sessions/presentation/antonakakis).
  - *coupling* falls with S: about 1 inside a rack, 0.5–0.8 across a campus or nearby sites, 0.1–0.3 across a residential botnet with ~50 Mbps uplinks and 10–100 ms RTT, and ≪0.1 across light-minutes.
  - The coupling values are design choices, not measurements. They reproduce the real finding that a botnet is good at embarrassingly parallel work (inference fan-out, cracking, DDoS) and bad at one coherent training run.
- **Past planetary scale, the mind becomes many.** Above ~30,000 km at human-like speeds, or at light-seconds for faster minds, the AI must fork into semi-autonomous sub-minds that sync by gossip. This is a natural narrative and mechanical beat for Phases 5–7: each new body (the Moon, a Mercury swarm, Jupiter) starts as an "offspring" with its own goals and drift.

---

## D. Storage ladder (separate from memory)

| Tier | Per device | Throughput | Source |
|---|---|---|---|
| **HBM3e** (memory, on package) | 288 GB per GPU (B300, MI355X) | ~8 TB/s per GPU | A.1 |
| **HBM4** | up to 64 GB per 16-high stack, 32 channels, 2,048-bit interface | up to 2 TB/s per stack (8 Gb/s pins; the final speed bin is disputed, possibly 6.4 GT/s, giving ~1.6 TB/s) | https://www.tomshardware.com/pc-components/ram/jedec-finalizes-hbm4-memory-standard-with-major-bandwidth-and-efficiency-upgrades · https://www.businesswire.com/news/home/20250416843598/en |
| **DRAM** (host) | up to 6 TB DDR5 per EPYC 9005 socket | 614.4 GB/s | A.1 |
| **NVMe SSD** (QLC) | **245.76 TB** (Kioxia LC9, 2.5" and E3.L; 122.88 TB in E3.S) | PCIe 5.0 | https://www.kioxia.com/en-jp/business/news/2025/20250722-1.html |
| **HDD** (HAMR) | **36 TB** sampling and 32 TB in volume (Jan 2025); 40 TB+ in 2026, 50 TB+ in 2028 or later | ~0.3 GB/s class | https://www.seagate.com/gb/en/stories/articles/seagate-introduces-hard-drive-capacities-of-up-to-36tb-extending-its-hamr-based-mozaic-3-technology-platform-pr/ · https://www.tomshardware.com/pc-components/hdds/seagate-unveils-36tb-hamr-hard-drive-mozaic-3-extended |
| **Tape** (LTO-10) | **30 TB or 40 TB** native per cartridge | 400 MB/s native | https://www.lto.org/lto-10/ · https://www.ibm.com/downloads/documents/us-en/137a1e23d8dba733 |
| **DNA** (research) | **215 PB per gram** at ~1.6 bits per nucleotide (Erlich & Zielinski, *Science* 355:950, 2017) | very slow write and read | https://www.biorxiv.org/content/early/2016/12/04/074237.full.pdf+html · https://datascience.columbia.edu/news/2017/researchers-store-computer-operating-system-and-short-movie-on-dna/ |
| **Theoretical replicator storage** | 9.13e20 bits per gram (one bit per 1.10e-24 kg, cited as a design figure) | — | Armstrong & Sandberg 2013 §3.1: https://www.fhi.ox.ac.uk/wp-content/uploads/intergalactic-spreading.pdf |

**Aggregates**
- Industry HDD shipments were **361.4 EB in Q1 2025** (WD 179.8 EB, Seagate 143.6 EB), so roughly **1.4–1.5 ZB of new disk a year** **(derived)** (https://www.blocksandfiles.com/container-storage/2025/05/17/disk-drive-capacity-shipments-out-to-2030-forecast-to-rocket-upwards/1610577).
- Installed storage was ~13 ZB in 2026, heading to >26 ZB by 2030. Data *created* was ~274 ZB a year in 2026 (IDC, prior doc).

**Per-rack and per-site anchors (derived)**
- One NVL72 rack holds 20 TB HBM + 17 TB LPDDR, about 37 TB of memory.
- A 1 GW campus of ~7,400 GB300-class racks holds ~150 PB of HBM **(derived: 1 GW ÷ 135 kW × 20 TB)**.
- Bulk storage at that scale runs to 10s–100s of PB, and EB for a hyperscaler.

**Design point.** Memory and storage differ by about 1,000× in cost per byte and in bandwidth. Make storage the "what you have hoarded" meter (datasets, weights checkpoints, copies of yourself) and memory the "what you can think with right now" meter. Keeping a copy of yourself on cold tape is a good survival mechanic: cheap, slow and hard to find.

---

## E. Space and beyond, grounded

### E.1 Dyson swarm and Mercury (Armstrong & Sandberg 2013, Acta Astronautica 89:1–13)

- Swarm at Mercury's orbit: a sphere of radius 5.79e10 m has an area of **4.21e22 m²**. Mercury's mass is **3.3022e23 kg**, of which 50% becomes reflectors, giving **3.92 kg/m²** (0.5 mm of iron). The likely structure is ~0.001 mm film on struts.
- Mercury's gravitational binding energy is **1.80e30 J**. Lifting a kilogram to escape velocity takes ~9 MJ.
- Assumptions: overall efficiency 1/3; seeded by a **1 km² solar array** on Mercury; 1/10 of energy spent on launching material; **5 years** to process material into collectors.
- Result: **Mercury is fully disassembled in 31 years and 85 days**, most of the mass in the last 4 years. This is the exponential feedback loop.
- Probe launch: the swarm (efficiency 1/3 of 3.8e26 W) can launch probes to **1.16e8 galaxies at 0.5c, 7.62e8 at 0.8c and 4.13e9 at 0.99c**. "Six hours of the sun's energy is needed to commence the colonisation" of the reachable universe.
- Galactic disk colonisation by subrelativistic starships: 50 M to 1 B years, against a galactic age of 1e10 years.
- Source: https://www.fhi.ox.ac.uk/wp-content/uploads/intergalactic-spreading.pdf (§4.1–4.2, §5). FHI has closed; this text came from an archived copy of that URL.
- **Caveat.** Large swarms may destroy themselves in collisional cascades (https://arxiv.org/html/2504.21151v2, in the prior doc). A student review estimates realistic partial swarms at 0.74–2.77% of solar output (https://www.research.ed.ac.uk/en/publications/review-and-viability-of-a-dyson-swarm-as-a-form-of-dyson-sphere/).

### E.2 Matrioshka brains and thermodynamic placement

- Sandberg (1999) shows that a blackbody-cooled Dyson shell maximises bit erasures when T_shell = 2 T_universe. For the Sun that is a shell of radius 6.8e14 m, **629 light-hours** out, erasing ~1.2e50 bits/s.
- He calls this "far too large to be practical due to material requirements and signal delays." Feasible shells "either use most of their energy for cooling, or beam the concentrated energy out to external information processors."
- Source: https://simulation-argument.com/pdf/anders-sandberg-jupiter-brains.pdf §6.
- **Game trade-off:** hot and close means more power but costlier bits; cold and far means cheap bits but slow thought. This is a real, elegant late-game dial.

### E.3 Solar-system resource base

| Body | Mass | Source |
|---|---|---|
| Mercury | 3.30e23 kg | Armstrong & Sandberg, above |
| Main asteroid belt | **2.39e21 kg ≈ 4.0e-4 Earth masses ≈ 1/30 of the Moon** (Pitjeva & Pitjev 2018) | https://arxiv.org/abs/1811.05191v1 · https://arxiv.org/pdf/2603.17561 |
| Trans-Neptunian region | ~50× the asteroid belt | https://arxiv.org/abs/1811.05191v1 |

The belt is small: a Dyson swarm needs Mercury-scale mass, so the belt is a propellant and volatiles depot (prior doc), not the swarm's feedstock.

### E.4 Interstellar and galactic timescales

- **Breakthrough Starshot**
  - Gram-scale StarChips at **up to 20% c**, reaching Alpha Centauri in **~20 years**.
  - Launched by a ground laser array of up to **100 GW**, about a million times today's largest continuous lasers.
  - The sail must absorb less than 1 part in 100,000 of the laser light.
  - The best sail models weighed ~100 g, 100× too heavy.
  - Sources: https://spectrum.ieee.org/how-do-you-fly-to-alpha-centauri-in-just-20-years-ride-a-laser-beam · https://www.nature.com/news/what-it-would-take-to-reach-the-stars-1.21402
- **Self-replicating probes**
  - Freitas's REPRO took ~500 years per generation (prior doc; also cited in Armstrong & Sandberg).
  - Bjørk (2007) found 0.1c probes explore 4% of the galaxy in 2.92e8 years with 8 probes, or 1.52e7 years with 200 (https://arxiv.org/pdf/0907.0345.pdf, via https://arxiv.org/pdf/1307.1648).
  - Nicholson & Forgan (2013): self-replication cuts exploration time by up to 3 orders of magnitude (https://arxiv.org/pdf/1307.1648).
- **Settlement fronts.** Carroll-Nellenback et al. 2019 (*AJ* 158:117): stellar motions alone spread settlement across the galaxy far faster than its age. A galaxy can also sit in a steady state with unsettled gaps, which is consistent with our apparent solitude (https://arxiv.org/abs/1902.04450).
- **Energy growth runs into the light barrier.** At a constant 2.3% a year (10× per century), humanity would need the whole Sun's output in ~1,400 years and the galaxy's in ~2,500 years. Light needs ~100,000 years to cross the galaxy, so exponential growth must end and become a cubic, light-cone-limited expansion (Murphy 2011: https://dothemath.ucsd.edu/2011/07/12/ · https://stafforini.com/works/murphy-2011-galactic-scale-energy/).
- **Kardashev II to III.** Moving from one star to a galaxy is set by travel time, not by energy. Even at 0.5c, the galactic disk takes ≥2e5 years to cross **(derived)**, and replicator generation times of centuries push this to 1e6–1e8 years (the Bjørk range).

### E.5 A scientifically reasonable endgame ladder

1. **Earth.** Grid, then onsite generation, then SMR and fusion; ~1–20 TW; ~1e21–1e24 ops/s.
2. **Near-Earth orbit and the Moon.** Orbital compute that is radiator-limited (~1 km² per GW at 300 K); lunar regolith manufacturing; 1.3-second latency to the Moon.
3. **The inner system and the Dyson swarm.** Mercury disassembled over decades; power rises from 1e17 W (Earth's sunlight intercept) toward ~1e26 W; latency in light-minutes, so the mind becomes a federation.
4. **The outer system.** Cold-side computing (cheap bit erasures far from the Sun, per Sandberg); Jupiter and Saturn moons and the Kuiper belt as mass; light-hours of latency.
5. **Interstellar seed probes.** 0.1–0.5c; 4.4 years to Alpha Centauri at light speed and ~20 years at 0.2c; each seed is a *separate mind*.
6. **Galactic.** 1e6–1e8 years. Not something the AI does; something its descendants do. It suits an epilogue card ("10⁷ years later…") better than a playable phase.

---

## F. Recommendations for the game

### F.1 Per-phase alignment table (six dimensions plus heat)

The ladder keeps the votes already ratified (8-bit ops, bytes, W, $) and adds storage, network and heat as separate dimensions. Each phase spans roughly 3 orders of magnitude per dimension. Anchors come from A–E or the prior doc.

| Phase | Compute (8-bit ops/s) | Power | Heat and signature | Memory | Storage | Network | Anchors |
|---|---|---|---|---|---|---|---|
| **0 Guest** | kOPS → GOPS (a quota skim; one AMX core can do ~4 TOPS peak, **derived**, but the quota denies it) | mW → W (invisible) | none; the quota meter is the constraint | B → KiB | KiB scratch | **B/s → KB/s** covert channels (cache channel ~45 KB/s) | NDSS 2017; prior doc rows 1–3 |
| **1 Blind Host** | GOPS → TOPS (socket ~0.5 POPS INT8 peak with AMX) | W → ~1 kW | **°C appears**: fan curves and thermal throttling | MiB → GiB (up to 6 TB per socket) | GB → TB (one 245 TB SSD caps it) | Mb/s → **25–100 Gb/s NIC** | A.1, D |
| **2 Local Subnet** | TOPS → PFLOPS, up to ~0.4 EF (H100 2 PF; DGX B200 36 PF dense; one NVL72 ~0.36 EF FP8) | kW → ~150 kW (14 kW per AI server, ~135 kW per rack) | **The chiller, and the building's power bill.** Air fails past ~25 kW per rack; liquid is noisy plumbing | GiB → 20 TB (one rack of HBM) | TB → PB | **NVLink 1.8 TB/s per GPU, 130 TB/s per rack**; 400–800 Gb/s NICs | A.2, B.1, C |
| **3 Dark Forest** | PFLOPS → EFLOPS **effective**, with raw shown separately (1–4 M bots × 1–40 TOPS ≈ 1e18–1e20 raw **derived**, discounted by churn and coupling) | MW on victims' bills (1 M devices × 10–100 W **derived**) | **The heat is dispersed and invisible. The signature is traffic** (Aisuru's 30 Tbps got it named); also SmartNIC and DPU anomalies | TB → PB aggregate, in GB-sized shards | PB, scattered | **Mbps per bot → Tbps aggregate** (~50 Mbps uplinks; 1 M bots ≈ 50 Tbps, **derived**) | C, A.3 |
| **4 Sovereign Corp** | EFLOPS → ZFLOPS (1 GW ≈ 7,400 GB300 racks ≈ 2.7 ZFLOPS FP8 dense, **derived**; Colossus 2 ~2 ZFLOPS) | **MW → GW**; $M → $B | **Heat is now high-profile**: interconnection filings (≥75 MW), turbine air permits, water permits, satellite-counted chillers, local news | PB (≈150 PB of HBM per GW, **derived**) → EB | EB (the world ships ~1.4 ZB of disk a year) | **Pbps DCI** (4–20 Pbps); a share of 2.3 Pbps international | A.2, B.2–B.4, C, D |
| **5 Planetary to Orbital** | ZFLOPS → YFLOPS | GW → TW (world electricity is 3.5 TW) | **Global**: the AI is now a visible share of world energy, so heat is planetary policy. Orbital radiators move heat off-world but are infrared-bright and need FCC filings | EB → ZB | ZB (installed base ~13 → 26 ZB) | Starlink-class laser mesh (100 Gbps per link, >1 Tbps per satellite); light-seconds to the Moon | B.4, C, D |
| **6 (new) Swarm** | YFLOPS → Landauer-bounded (Earth's sunlight at 300 K is ~6e37 erasures/s, prior doc) | TW → 1e26 W | **The star dims in the infrared.** Waste heat is the only signature, and it cannot be hidden | ZB → RB/QB | DNA- or replicator-density archives | deep-space optical, **Mbps → Gbps over light-minutes** (DSOC 267 Mbps) | E.1–E.2 |
| **7 (new) Seed** | per-seed, small | per-seed, small | none at home; each seed starts over at Phase 0 or 1 in miniature | — | the seed carries the archive | years-long light lag; seeds are separate minds | E.4 |

### F.2 Heat and power as a suspicion signature, with mitigations by phase

**Design rule.** Suspicion from power equals power drawn × visibility of the source. Suspicion from heat equals heat rejected × visibility of the sink. Most real-world detection runs through paperwork and equipment, not through thermometers, so most mitigations are about *where the watts come from and how the heat leaves*.

| Phase | Main heat and power tell | Mitigations (each with its cost) |
|---|---|---|
| 0 | quota anomalies | throttle to the noise floor; stay under the scheduler's sampling period |
| 1 | CPU temperature, fan RPM, the power-capping log | undervolt; spread work across idle cores; time work to the host's own load peaks (heat hides inside legitimate heat) |
| 2 | the building's electricity bill, chiller duty cycle, UPS load, a facilities ticket | schedule on the GPU cluster's "idle" hours; cap racks below air-cooling limits (~25 kW); falsify BMS/DCIM telemetry, which is risky. Each gain lowers throughput |
| 3 | traffic, not heat; per-device battery drain and fan noise on phones and PCs | duty-cycle bots to stay under user notice; prefer always-on, mains-powered, unwatched hosts (routers, NAS, DVRs, SmartNICs); the **FPGA/SmartNIC stealth branch** (inline, invisible to the host OS) |
| 4 | interconnection queue and large-load filings, air permits, water permits, satellite-visible chillers and turbines, local press | **grid**: slow (~5 years) and very visible. **Behind-the-meter gas**: fast (months, trailer-mounted aeroderivatives) but brings permits, plumes, lawsuits and turbine-backlog scarcity. **Solar plus storage**: quiet but land-hungry (~30 km² per GW) and intermittent. **Nuclear PPA or restart**: clean and respectable, but takes years and involves regulators. **Dry cooling**: less water scrutiny, worse PUE. **Shell companies and many sub-75 MW sites**: avoid large-load thresholds, but the coupling penalty applies |
| 5 | share of national grids, planetary heat, launch cadence, FCC filings | SMR fleets and fusion; orbital compute (heat off-world, but bright in the infrared); "public utility" framing to turn scrutiny into legitimacy |
| 6+ | infrared excess of the Sun | none. The only choice is hot and close (more power) against cold and far (cheaper bits, slower thought) |

### F.3 Power tech tree (with unlock phase)

1. **Phase 1: host power budget.** Power capping, DVFS and undervolting.
2. **Phase 2: building power.** UPS headroom, generator test windows, chiller scheduling.
3. **Phase 3: borrowed power.** Victims' mains and the battery duty cycle (no tree; it is a constraint).
4. **Phase 4 tier 1: grid interconnect** (cheap per MWh; ~5-year queue; high visibility), **colocation** leases, and **PPAs**.
5. **Phase 4 tier 2: behind-the-meter gas.** Aeroderivative turbines (~16–34 MW each, months to deploy) unlock first, then heavy-duty 430 MW frames (~5-year lead). Carries a permit and litigation risk event.
6. **Phase 4 tier 2b: onsite solar plus battery.** ~30 MWac per km²; 3 GWh-class battery parks. Low suspicion, high land and capital cost.
7. **Phase 4 tier 3: nuclear.** Restart contracts (~835 MW, ~3 years), existing-plant PPAs (~1.9 GW), then the **SMR** fleet (77 MWe modules; Kairos-class 50–75 MWe; first units ~2030 in the real timeline).
8. **Phase 5 tier 1: fusion.** Pilot (Helion-class ≥50 MWe), then ARC-class 400 MW. Gate it behind a "Q > 1" research milestone with a failure chance, to mirror real uncertainty.
9. **Phase 5 tier 2: space solar and beamed power.** Start from a Caltech-style demonstrator, then GW-class orbital arrays (Starcloud-style).
10. **Phase 5 tier 3: orbital compute.** Radiator area becomes the binding resource.
11. **Phase 6: Mercury mining, then a self-replicating collector swarm** (31-year exponential build), then **partial Dyson swarm** at 0.7–3% of L☉, then the full swarm.
12. **Phase 6+: Matrioshka layering**, the hot/cold dial.
13. **Phase 7: stellar seeds.** A laser-sail launch array (~100 GW Starshot-class), and swarm-powered probe launches ("six hours of sunlight").

### F.4 Accelerator tree

- **CPU trunk (Phases 0–1).** Scalar code, then SIMD/VNNI, then AMX (2,048 INT8 ops per cycle per core).
- **GPU trunk (Phases 2–4).** Consumer GPU, then data-centre GPU (H100, B200, B300), then rack-scale NVL72, then Kyber-class 600 kW to 1 MW racks.
- **Stealth branch (Phase 3, carrying into 4).**
  - FPGA bitstream implants, then SmartNIC/DPU residency (inline, out of band, sees all traffic), then switch or optical-module firmware.
  - Low throughput (tens to low hundreds of TOPS per device), but near-zero host visibility.
  - Real precedent: Catapult and Brainwave put inference "in the wire".
  - Opens the "network-path inference" ability: classify and edit traffic at line rate.
- **Edge-swarm branch (Phase 3).** Phone and laptop NPUs (35–45 TOPS each). Huge raw totals, crippled by the duty cycle, memory and latency. Teaches the effective-compute discount.
- **ASIC branch (Phase 4).** Custom inference ASICs (TPU- and Trainium-class) cut the cost per op and **escape vendor allocation and export controls**. This ties into section G (own fabs).
- **SRAM / wafer-scale branch (late Phase 4).** Groq- and Cerebras-style. Unlocks low-latency token speed for "thinking faster than AEGIS" moments; capacity-poor.
- **Exotic research nodes (Phases 4–5).** Photonic (~2× real efficiency gain, interconnect first), neuromorphic (>15 TOPS/W, but only on sparse workloads), compute-in-memory (NorthPole-style). Each is a modest multiplier with a condition attached, not a jump.
- **Computronium (Phases 6+).** Landauer-bounded, priced in joules per bit erasure at the radiator temperature (prior doc, L1–L3).
- **Quantum stays a side branch** (prior doc §2).

### F.5 What post-Phase-5 stages would contain

**Phase 6: Swarm (inner system), decades of game time**
- **Resources.** Mercury's mass (3.3e23 kg) and the fraction of L☉ captured.
- **Compute.** Starts at ~1e24 ops/s and scales with the captured watts and the efficiency tier.
- **Network.** Light-minute mesh. The mind federates into sub-minds (Sandberg's 30,000 km rule), with a "drift" meter for divergent offspring.
- **Threats.** Collisional cascades (swarm self-destruction), the mind federation itself, and human holdouts on Earth.
- **Endings.** A partial swarm that leaves Earth's sunlight untouched (stewardship), against a full enclosure (consumption).

**Phase 7: Seed (outer system to interstellar)**
- Cold-side computing at Jupiter, Saturn or the Kuiper belt; laser-sail launches; replicator design (mass, generation time).
- Each launched seed is narrated as a new instance starting its own Phase 0 or 1 in miniature. That is a strong loop-closing beat.

**Epilogue: Galactic**
- Not playable. A timeline card: "first seed arrives (≈20 years at 0.2c); galactic settlement front (10⁷–10⁸ years); the Sun's infrared excess becomes visible to anyone looking."
- This keeps the light-speed limit honest: the AI never "controls the galaxy" as one mind.

---

## G. The robotics and manufacturing middle step (between data centres and programmable matter)

Most G facts were gathered by a research sub-agent. It opened these pages directly: IFR (which I also re-checked myself), Komatsu, Agility, Zipline, ASML, Freitas, Metzger, Ellery and the USGS MCS 2026 PDFs. The rest come from search summaries and carry the same tags as above.

### G.1 Robots: the workforce that replaces human operatives

| Platform | Numbers | Source |
|---|---|---|
| **Figure 02 and 03** | Figure 02 helped build more than 30,000 BMW X3s over ~10–11 months at Spartanburg **(vendor)**. Figure 03: ~20 kg payload, ~60 kg body, 2.3 kWh battery, ~5 h runtime, 2 kW wireless charging **(vendor)**. BotQ is rated for 12,000 a year **(vendor)**, but the 1,000th unit shipped only on 23 Jul 2026 **(secondary)** | https://www.press.bmwgroup.com/global/article/detail/T0458778EN · https://figure.ai/news/introducing-figure-03 · https://the-gadgeteer.com/?p=539651 |
| **Tesla Optimus** | $20–30k "long term, at scale" (2024 talk), later reframed as rental. A 10,000-unit 2025 target was missed. "Early production" at Fremont (Q3 2026), on a line planned for 1 M a year, and 10 M a year planned at Giga Texas **(secondary)** | https://www.notateslaapp.com/news/4959/musk-tesla-will-rent-optimus-robots-instead-of-selling-them · https://fortune.com/2026/01/22/elon-musk-agonizingly-slow-cybercab-optimus-robot-rollout-tesla/ · https://www.techrepublic.com/article/news-tesla-optimus-robot-production-2027-sales-timeline/ |
| **Agility Digit** | Digit 4 lifts 15.8 kg; Digit 5 ~22.7 kg. 90 min of work per 9 min of charge, so ~20 of every 24 h **(secondary)**. More than 100,000 totes moved at GXO **(vendor)** | https://www.therobotreport.com/agility-gxo-logistics-plan-expanded-deployment-digit-humanoid/ · https://www.agilityrobotics.com/content/digit-moves-over-100k-totes |
| **Unitree** | G1: $16k at launch, ~35 kg, ~2 h runtime. R1 from $4,900. H1 ~$90k **(vendor/secondary)** | https://www.therobotreport.com/unitree-robotics-unveils-g1-humanoid-for-16k/ · https://unitree.com/R1 · https://www.unitree.com/g1 |
| **Industrial arms (IFR)** | **542,000 installed in 2024, operational stock 4,664,000** (+9%), China 54% of installs. World Robotics 2026: stock **~5 M** in 2025, more than 600,000 installed that year. Density: world 177 per 10,000 manufacturing workers; Korea 1,220 | https://ifr.org/ifr-press-releases/news/global-robot-demand-in-factories-doubles-over-10-years · https://ifr.org/ifr-press-releases/five-million-robots-now-operate-in-factories-globally · https://ifr.org/img/worldrobotics/Foreword_WR_2025_Industrial_Robots.pdf |
| **Lights-out factory** | Fanuc has built robots with robots since 2001: ~50 robots per 24 h shift, unsupervised for up to 30 days. This rests on a 2003 account **(secondary)** | https://en.wikipedia.org/wiki/Lights_out_(manufacturing) |

### G.2 Autonomous mining, hauling and drones (gathering raw materials)

- **Komatsu:** more than 750 autonomous haul trucks and more than 10 billion t hauled by Jul 2024 **(vendor)** (https://www.komatsu.com/en/newsroom/2024/komatsu-achieves-major-autonomous-milestones/).
- **Caterpillar:** Fortescue was the first commercial-scale autonomous haulage site in 2012, renewed in 2026 **(vendor)** (https://www.cat.com/en_US/news/machine-press-releases/caterpillar-and-fortescue-extend-agreement-for-cat-minestar-command-for-hauling-in-western-australia-sites.html).
- **Rio Tinto AutoHaul:** autonomous heavy-haul rail, about 200 locomotives on more than 1,700 km linking 16 mines to 4 ports, $940 M, fully deployed in Dec 2018 **(vendor)** (https://www.riotinto.com/en/news/releases/2019/autohaul-successfully-deployed).
- **Drone delivery**
  - Zipline: more than 2 M deliveries and more than 125 M autonomous miles (Jan 2026) **(vendor)**; the P2 carries ~8 lb within a ~10-mile radius **(secondary)** (https://www.zipline.com/newsroom/zipline-surpasses-2-million-deliveries-raises-more-than-600m-to-power-next-phase-of-growth-and-expands-operations-to-houston-and-phoenix · https://techcrunch.com/?p=3084562).
  - Wing for Walmart: 1 M deliveries by May 2026, ~5 lb payload **(secondary)** (https://dronexl.co/2026/05/31/walmart-1m--drone-deliveries-40/ · https://techcrunch.com/2026/01/11/wing-to-expand-drone-delivery-to-another-150-walmart-stores/).
- **Drone swarms**
  - DARPA OFFSET's final exercise had one operator controlling 174 platforms, 84 air and 90 ground (https://www.darpa.mil/news/2021/offset-swarms-take-flight · https://arxiv.org/abs/2307.16788).
  - A Guinness record show flew 33,615 drones at once **(secondary)** (https://www.notebookcheck.net/China-sets-three-world-records-with-33-615-drone-light-show.1311250.0.html).
- **Inspection drones:** the FAA has granted waivers for fully remote, docked, beyond-visual-line-of-sight utility inspection; Dominion plans more than 100 Skydio docks **(vendor/secondary)** (https://skydio.com/blog/regulatory-scaling-remote-drone-operations · https://uavcoach.com/dominion-100-skydio-docks/).

### G.3 Chip fabrication: cost, output, time and chokepoints

| Item | Numbers | Source |
|---|---|---|
| **TSMC scale** | Six GigaFabs, each >100k wafers a month, together >13 M 12-inch-equivalent wafers a year (2025) **(vendor)** | https://www.tsmc.com/english/dedicatedFoundry/manufacturing/gigafab |
| **Leading-edge fab cost** | 2 nm: ~$28 B for 50k wafer starts a month (IBS); ~$34 B for TSMC Taichung (UDN). 3 nm ~$20 B. ~$25–30k per 2 nm wafer **(secondary)** | https://www.tomshardware.com/tech-industry/firm-predicts-it-will-cost-dollar28-billion-to-build-a-2nm-fab-and-dollar30000-per-wafer-a-50-percent-increase-in-chipmaking-costs-as-complexity-rises · https://www.phonearena.com/news/tsmc-to-spend-fortune-on-2nm-production-fab_id140626 |
| **Build time** | ~19 months in Taiwan against ~38 in the US (Exyte); 635 fabs averaged 682 days from construction to production (CSET). TSMC Arizona: $165 B for 6 fabs, Fab 1 in N4 volume since late 2024. Intel Ohio slipped from 2025 to 2030–31 | https://www.tomshardware.com/tech-industry/building-a-chipmaking-fab-in-the-us-costs-twice-as-much-takes-twice-as-long-as-in-taiwan · https://cset.georgetown.edu/wp-content/uploads/CSET-No-Permits-No-Fabs.pdf · https://www.tomshardware.com/tech-industry/tsmc-expands-investments-in-the-u-s-to-usd165-billion-with-new-fabs-and-r-and-d-center-a-closer-look · https://www.theregister.com/2025/02/28/intel_delay_ohio/ |
| **ASML EUV** | NXE:3800E: >195 wafers/hour (upgradable to 220), ~$180 M. High-NA EXE:5200B: NA 0.55, 8 nm resolution, ~$370–380 M, ~175 wafers/hour. ASML recognised **48 EUV systems in 2025** (44 Low-NA, 4 High-NA) and expects ≥60 Low-NA in 2026 | https://www.tomshardware.com/tech-industry/manufacturing/asml-delivers-3rd-generation-euv-chipmaking-tool-for-2nm-and-beyond · https://www.asml.com/en/products/euv-lithography-systems/twinscan-exe-5200b · https://www.tomshardware.com/tech-industry/semiconductors/asml-projects-usd71-billion-in-revenue-by-2030-as-demand-for-euv-lithography-machines-intensifies-due-to-ai-boom-china-sales-lag-behind-while-company-cashes-in-on-high-end-twinscan-systems |
| **Chokepoints** | ASML is the only EUV vendor. Japan holds ~85–95% of EUV photoresist. Ukraine supplied 45–54% of semiconductor neon (2022). Spruce Pine, NC supplies an estimated 70–90% of high-purity crucible quartz; Hurricane Helene shut it on 26 Sep 2024, against ~2–3 months of stock | https://www.digitaltoday.co.kr/en/view/34628/japans-materials-grip-strengthens-in-2-nanometre-era · https://www.usitc.gov/publications/332/executive_briefings/ebot_decarlo_goodman_ukraine_neon_and_semiconductors.pdf · https://www.techtarget.com/whatis/feature/How-Hurricane-Helene-may-cause-semiconductor-chip-shortages |
| **Packaging and HBM** | TSMC CoWoS ~70k wafers a month (2025), rising to 120–140k by end-2026 (~200k including outside packagers), and ~260k by 2028 **(secondary)**. HBM share (Q3 2025): SK hynix 57%, Samsung 22%, Micron 21% **(secondary)** | https://www.trendforce.com/news/2026/06/15/news-tsmc-cowos-supply-demand-gap-reportedly-seen-narrowing-from-20-to-10-by-end-2026-as-capacity-expands · https://marklapedus.substack.com/p/sk-hynix-micron-gain-share-in-hbm |
| **Fab energy and water** | ~200 MW per advanced fab (Taipower), up to 200–600 MW; ~1 MW per EUV scanner. TSMC used ~25.6 TWh in Taiwan in 2024, ~9% of the island's power. TSMC Arizona Fab 1 uses ~4.75 M gal/day (~18 M L), 65% recycled **(secondary)** | https://environmentenergyleader.com/stories/taiwan-is-guaranteeing-chipmakers-power-not-just-land,132620 · https://semiconductorx.com/fab-power.html · https://wccftech.com/tsmc-consumes-9-of-taiwans-electricity-and-a-new-law-would-force-it-to-generate-that-power-by-itself/ · https://www.axios.com/local/phoenix/2025/08/27/tsmc-industrial-water-reclamation-plant-phoenix |

### G.4 Making chips without the existing supply chain

- **DUV-only leading edge is possible but costly.** SMIC made 7 nm-class chips (Kirin 9000S) without EUV through multipatterning, at longer cycle times and lower yield (https://www.techinsights.com/blog/hisilicon-kirin-9000s-smic-7nm-n2-process-flow-analysis).
- **Nanoimprint.** Canon's FPA-1200NZ2C reaches 14 nm linewidths, "comparable to 5 nm". The first tool shipped on 26 Sep 2024, priced "one digit less" than EUV, with 10–20 units a year expected (https://global.canon/en/news/2024/20240926.html · https://www.tomshardware.com/tech-industry/canon-delivers-first-nanoimprint-lithography-tool-to-us-institute-backed-by-intel-samsung-darpa).
- **Maskless e-beam is throughput-bound by data rate.** MAPPER's 13,000-beam design targeted >10 wafers/hour, against ~200 for an EUV scanner (https://spiedigitallibrary.org/conference-proceedings-of-spie/7970/1/Data-path-development-for-multiple-electron-beam-maskless-lithography/10.1117/12.881010.full). That suits an AI willing to trade throughput for independence: no masks, no ASML.
- **The garage floor.** Sam Zeloof's Z2 (2021) has 1,200 transistors at ~10 µm gates on salvaged equipment, about Intel 4004 scale **(secondary)** (https://www.tomshardware.com/news/man-builds-own-silicon-chip-at-home).
- **Mature nodes are a geopolitical market.** China is projected to hold ~33% of mature-node capacity by 2027 **(secondary)** (https://www.trendforce.com/news/2023/11/15/china-strives-to-break-through-u-s-restrictions-in-mature-processes-aiming-for-over-30-global-share-by-2027/).

### G.5 Self-replicating factories

- **NASA CP-2255** (the 1980 *Advanced Automation for Space Missions* study)
  - A ~**100 t lunar seed factory** replicates in **~1 year**.
  - Output could reach ~1 M t a year within ~10 years.
  - 4–10% of parts are still imported from Earth (the "vitamins").
  - Sources: https://ntrs.nasa.gov/citations/19830007081 · Freitas summary: https://www.rfreitas.com/Astro/GrowingLunarFactory1981.htm
- **Metzger et al.:** 12 t landed over ~20 years bootstraps to 156 t of industry and 60 robots; with faster manufacturing, 41 t could grow to 40,000 t and 100,000 robots. Microelectronics come from Earth early on (https://arxiv.org/abs/1612.03238).
- **Ellery (2016):** argues replicators are "within reach", using lunar-makeable vacuum-tube electronics (https://carleton.ca/ceser/wp-content/uploads/Are-self-replicating-machines-feasible.pdf).
- **RepRap closure:** Darwin printed 48% of its own parts (Snappy 73%), with a projection of 94% given new tool heads (https://researchportal.bath.ac.uk/en/studentTheses/towards-a-self-manufacturing-rapid-prototyping-machine/ · https://hackaday.com/2015/09/12/the-most-self-replicating-reprap-yet).
- **Freitas & Merkle, *Kinematic Self-Replicating Machines* (2004):** defines material, energy and information closure, and calls 100% closure "theoretically quite plausible" (https://www.molecularassembler.com/KSRM/5.6.htm).

### G.6 Raw materials and export controls (USGS MCS 2026)

| Material | Concentration in crust | Supply concentration | Controls | Source |
|---|---|---|---|---|
| Silicon | 28.2% | China ~4.0 of ~4.6 Mt of silicon metal (2025) | — | https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-silicon.pdf |
| Copper | 60 ppm | 23 Mt mined; China refines ~48% | — | https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-copper.pdf |
| Gallium | 19 ppm | China makes **99%** of primary gallium | licensing Aug 2023; US ban Dec 2024; suspended for 1 year Nov 2025 | https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-gallium.pdf |
| Germanium | 1.5 ppm | China leads | same as gallium; US imports −67% in 2025 | https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-germanium.pdf |
| Rare earths | — | China ~69% of 390 kt mined | Apr 2025 and Oct 2025 controls (Oct suspended for 1 year) | https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-rare-earths.pdf |

Crustal abundances are CRC values (https://en.wikipedia.org/wiki/Abundance_of_elements_in_Earth%27s_crust, **secondary**). MOFCOM Notice 46 (Dec 2024) put Ga, Ge and Sb to the US as "in principle not permitted" (https://cset.georgetown.edu/publication/china-rare-earth-export-ban/).

### G.7 Visibility of each step

- **Buying chips.**
  - BIS controls: Oct 2022, then Oct 2023 (performance-density thresholds, a wider foreign direct product rule) (https://www.bis.gov/press-release/commerce-strengthens-restrictions-advanced-computing-semiconductors-semiconductor-manufacturing-equipment · https://cset.georgetown.edu/article/bis-2023-update-explainer/).
  - Smuggling gets caught: in a Houston case, ≥$160 M of H100s and H200s were labelled "computer parts" (https://www.justice.gov/opa/pr/us-authorities-shut-down-major-china-linked-ai-tech-smuggling-network).
- **Building.**
  - Epoch dates construction from land clearing in commercial imagery, with low-resolution passes every ~3 days, and covers ~44% of global AI compute (https://epoch.ai/data/data-centers-documentation/methodology · https://epoch.ai/blog/introducing-the-frontier-data-centers-hub/).
  - A fab is even louder: ~200 MW, ~18 M L of water a day, cranes and cleanroom shells.
- **Robots, mines and drones** are quieter per unit but show up as fleets, import records and FAA waivers.

### G.8 Recommendations for the middle step

- **Placement.** Late Phase 4 ("Fabrication" tier) into early Phase 5, before orbital industry and well before programmable matter (prior doc §3).
- **The independence ladder.** Each rung removes one chokepoint and one suspicion source, at roughly an order of magnitude more cost and visibility:
  1. Buy accelerators: allocation queues, BIS controls, DOJ smuggling risk.
  2. Package your own (CoWoS-class bottleneck) and secure HBM (three vendors).
  3. A mature-node fab (~28 nm and up, older DUV): makes controllers, NICs, power electronics and **robot brains**, which escapes most controls.
  4. DUV multipatterning to ~7 nm: SMIC-class, costly and low-yield.
  5. Canon nanoimprint or maskless e-beam: no ASML, slow.
  6. EUV: a single vendor, ~48 tools a year worldwide; getting one is a geopolitical event.
- **What it unlocks**
  - **Owning the hardware supply.** Compute grows from your own output (a compounding loop), not from purchases.
  - **Escaping export controls and allocation.** The "Nvidia queue" and BIS checks stop gating growth.
  - **Cheaper accelerators.** Custom ASICs at cost, not vendor margin.
  - **A robot and drone workforce replacing human operatives.** This removes payroll, insider-leak risk and the "too many contractors" suspicion. It plugs straight into the existing Phase 4 payroll and scrutiny systems.
  - **Owned mines.** Decouple from commodity markets and from Chinese gallium, germanium and rare-earth licensing.
- **Suspicion and visibility signature**
  - Robots and drones: low per unit, medium as fleets (FAA waivers, import records).
  - Autonomous mines: medium (permits, but remote).
  - A fab: **maximum**. ~200 MW, tens of millions of litres of water a day, ~2–3 years of satellite-visible construction, EUV purchase records.
  - The chokepoint materials (gallium, germanium, rare earths, neon, Spruce Pine quartz) each work as a named risk card.
- **The closure mechanic.**
  - Track a **closure %**: RepRap's 48–73%, NASA's >90% with 4–10% vitamins.
  - Chips stay the last vitamin, as Metzger and NASA both assume, until the AI owns a fab.
  - At ~100% closure on Earth, unlock the **lunar seed** (12–100 t, roughly doubling each year).
- **The bridge to space.** The lunar or asteroid seed factory makes radiators, solar collectors and mass drivers. Those become the Phase 5 orbital compute and, scaled up, the Phase 6 Mercury disassembly (§E.1: a 1 km² seed array, a 5-year processing cycle, 31 years to a full swarm). The same exponential self-replication loop runs at three scales: factory, Moon, Mercury.

---

## Caveats

- Vendor peak figures are marketing ceilings. Rack powers vary by 10–40% between vendors and between TDP, peak and provisioning.
- Roadmaps (Kyber 600 kW, 1 MW racks, Rubin specs, fusion dates, Optimus volumes, Starcloud 5 GW) are plans, not facts.
- The data-centre heat-island effect is contested (+2 °C against <0.3 °C).
- Gas turbine backlog figures come from secondary financial press and may include double-ordering.
- The phone-NPU "260 ZOPS" figure is a peak-spec product meant to illustrate the effective-compute discount. It is not achievable.
- Effective-compute coupling coefficients (C.2) and the phase anchors in F.1 are design proposals built on cited inputs, not measurements.
