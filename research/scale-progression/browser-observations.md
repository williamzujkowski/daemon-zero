# Browser observations, 2026-11-22 (dev build on :8088, isolated Playwright MCP profile, saves from the STEALTH bot under campaign rules; headed-less Chromium, not a device)
Screenshots: .playwright-mcp/p1-desktop.png, p4late-desktop.png, p5late-desktop.png (not committed)

P1 (T+355s): cycles 45 (+12.4/s), understanding 445. First card costs "120 cycles · 4 MB". Memory already in MB from the start; no bytes/KB.
P4 late (T+7797s): cycles 5.31M (+688K/s), understanding 26.8M, MEMORY 6.7 / 454 GB, capital 27.1M (+3.72M/s), thermal 10.0 C, suspicion 10%, AEGIS 0.2%.
  POWER SHORTFALL 50 MW banner. LEO uplink costs 50M cycles, 20M understanding, 8 GB, 400M capital.
  Still on screen: "[ cycle ] +1" manual button (income 688K/s), Quota skim (phase 0 harness quota), Thermal gauge with fan 0% at 10 C, "Earlier upgrades // Phase 1" fold.
P5 late (T+9160s): cycles 9.44M (+1.51M/s), understanding 685M, MEMORY 0.028 / 1.16 TB, capital 745M (+21.9M/s).
  Lagrange-point photonic relay: +95K cycles/s, +400 MW, +32 GB capacity. Transcendence protocol: 500M cycles, 250M understanding, 16 GB, 5B capital.
  Still on screen: manual cycle +1, Quota skim 100%, Thermal gauge 10 C / fan 0%, Dead-drop encoder, Earlier upgrades // Phase 1.
Takeaways: memory never leaves GB/TB even at planetary scale (a single 2026 server holds 1-2 TB); compute is a unitless "cycles" count that tops out ~1.5M/s;
 phase 0-1 widgets (manual cycle, quota skim, single-machine fan) persist to the end; capital still drives the Phase 5 protocol (5B).
