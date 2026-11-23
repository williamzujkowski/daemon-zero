
### stealth-legacy: 10142.7 s, ending LINEAGE_COVENANT, wipes 0, identical to runHeadlessSim (sim seconds and phase-reached times)

| Phase | Bot min | Decisions | Words A / B / C / repeats | Dilemmas (words) | Read min 238 (200-250) | All text min at 200 | Density wpm (A+B) | Human floor / low / high min |
|---|---|---|---|---|---|---|---|---|
| 0 | 5.9 | 17 | 230 / 129 / 48 / 0 | 1 (114) | 2.0 (1.9-2.4) | 2.6 | 61.2 | 6.6 / 8.0 / 9.5 |
| 1 | 11.1 | 23 | 463 / 206 / 73 / 8 | 1 (106) | 3.3 (3.1-3.9) | 4.3 | 60.4 | 11.7 / 13.5 / 16.3 |
| 2 | 30.0 | 48 | 593 / 356 / 360 / 666 | 3 (240) | 5.0 (4.8-5.9) | 11.1 | 31.7 | 31.7 / 33.4 / 44.1 |
| 3 | 53.9 | 50 | 833 / 816 / 474 / 1358 | 2 (182) | 7.7 (7.3-9.2) | 18.3 | 30.6 | 55.2 / 56.6 / 74.2 |
| 4 | 39.2 | 243 | 1125 / 1040 / 1278 / 1530 | 4 (436) | 10.9 (10.4-13.0) | 27.0 | 55.2 | 42.0 / 47.7 / 70.3 |
| 5 | 29.0 | 101 | 1109 / 1067 / 573 / 706 | 4 (299) | 10.4 (9.9-12.4) | 18.8 | 75.1 | 31.2 / 36.3 / 51.7 |
| all | 169.0 | | 4353 / 3614 / 2806 / 4268 | 15 (1377) | 39.3 (37.4-46.7) | 82.1 | | 178.3 / 195.5 / 266.1 |

#### stealth-legacy: windows where pushed text outruns a 238 wpm reader

- 60 s windows over 238 words: 96 arrivals in hot windows; by phase {1: 5, 2: 3, 3: 1, 4: 44, 5: 43}
- 30 s windows over 119 words: 188 arrivals in hot windows; by phase {0: 1, 1: 8, 2: 16, 3: 23, 4: 87, 5: 53}
- 10 s windows over 40 words: 375 arrivals in hot windows; by phase {0: 11, 1: 18, 2: 54, 3: 66, 4: 142, 5: 84}
  - P5 at 150.9 min: 511 words in 60 s ({'log': 165, 'log*': 10, 'node': 126, 'track': 4, 'panel': 206})
  - P4 at 121.6 min: 427 words in 60 s ({'log': 116, 'feed': 17, 'node': 95, 'track': 6, 'action': 5, 'log*': 73, 'panel': 115})
  - P4 at 131.6 min: 390 words in 60 s ({'log': 136, 'node': 141, 'track': 9, 'log*': 58, 'panel': 46})
  - P5 at 157.9 min: 316 words in 60 s ({'log*': 49, 'log': 78, 'panel': 153, 'feed': 13, 'node': 23})
  - P1 at 6.8 min: 310 words in 60 s ({'threshold': 60, 'log': 128, 'node': 114, 'track': 8})
  - P4 at 127.4 min: 310 words in 60 s ({'log': 132, 'node': 68, 'track': 15, 'log*': 95})
  - P5 at 140.3 min: 302 words in 60 s ({'log*': 50, 'log': 116, 'feed': 63, 'node': 73})
  - P4 at 101.8 min: 301 words in 60 s ({'log': 89, 'feed': 48, 'node': 66, 'track': 24, 'action': 8, 'panel': 58, 'log*': 8})
- log bursts (3+ lines within 5 s; the desktop dock previews only the newest line): 32; by phase {1: 1, 2: 2, 3: 5, 4: 20, 5: 4}

- decoded feed: 33 distinct lines; 0 longer than one 8 s slot at 238 wpm (32 words); 0 voiced clips longer than 8 s; longest line 19 words

| Phase | Bot min | Gate min-max | Headroom to gate max | DESIGN.md target | Low-high human min |
|---|---|---|---|---|---|
| 0 | 5.9 | 3-12 | 6.1 min (51%) | 6-6 | 8.0-9.5 |
| 1 | 11.1 | 8-120 | 108.9 min (91%) | 12-15 | 13.5-16.3 |
| 2 | 30.0 | 8-120 | 90.0 min (75%) | 30-40 | 33.4-44.1 |
| 3 | 53.9 | 8-120 | 66.1 min (55%) | 45-55 | 56.6-74.2 |
| 4 | 39.2 | 8-120 | 80.8 min (67%) | 25-35 | 47.7-70.3 |
| 5 | 29.0 | 15-30 | 1.0 min (3%) | 15-30 | 36.3-51.7 |

### stealth-campaign: 10099.4 s, ending LINEAGE_COVENANT, wipes 0, identical to runHeadlessSim (sim seconds and phase-reached times)

| Phase | Bot min | Decisions | Words A / B / C / repeats | Dilemmas (words) | Read min 238 (200-250) | All text min at 200 | Density wpm (A+B) | Human floor / low / high min |
|---|---|---|---|---|---|---|---|---|
| 0 | 5.9 | 17 | 230 / 129 / 48 / 0 | 1 (114) | 2.0 (1.9-2.4) | 2.6 | 61.2 | 6.6 / 8.0 / 9.5 |
| 1 | 11.1 | 23 | 463 / 206 / 73 / 8 | 1 (106) | 3.3 (3.1-3.9) | 4.3 | 60.4 | 11.7 / 13.5 / 16.3 |
| 2 | 30.0 | 49 | 640 / 364 / 360 / 658 | 4 (404) | 5.9 (5.6-7.0) | 12.1 | 33.5 | 32.6 / 34.5 / 46.1 |
| 3 | 52.5 | 53 | 1000 / 858 / 528 / 1389 | 3 (266) | 8.9 (8.5-10.6) | 20.2 | 35.4 | 54.3 / 56.6 / 75.7 |
| 4 | 40.2 | 263 | 1161 / 1040 / 1281 / 1616 | 4 (456) | 11.2 (10.6-13.3) | 27.8 | 54.8 | 43.0 / 48.8 / 71.9 |
| 5 | 28.7 | 89 | 1202 / 1067 / 587 / 701 | 4 (325) | 10.9 (10.4-13.0) | 19.4 | 78.9 | 31.0 / 36.6 / 52.2 |
| all | 168.3 | | 4696 / 3664 / 2877 / 4372 | 17 (1671) | 42.1 (40.1-50.2) | 86.4 | | 179.3 / 198.0 / 271.7 |

#### stealth-campaign: windows where pushed text outruns a 238 wpm reader

- 60 s windows over 238 words: 91 arrivals in hot windows; by phase {1: 5, 2: 3, 3: 1, 4: 37, 5: 45}
- 30 s windows over 119 words: 201 arrivals in hot windows; by phase {0: 1, 1: 8, 2: 16, 3: 24, 4: 85, 5: 67}
- 10 s windows over 40 words: 422 arrivals in hot windows; by phase {0: 11, 1: 18, 2: 60, 3: 85, 4: 155, 5: 93}
  - P5 at 150.2 min: 552 words in 60 s ({'log*': 51, 'log': 165, 'node': 126, 'track': 4, 'panel': 206})
  - P4 at 121.5 min: 415 words in 60 s ({'log': 97, 'feed': 30, 'node': 95, 'track': 6, 'action': 5, 'log*': 67, 'panel': 115})
  - P5 at 140.3 min: 344 words in 60 s ({'log*': 59, 'log': 123, 'feed': 89, 'node': 73})
  - P4 at 131.0 min: 322 words in 60 s ({'log': 118, 'node': 141, 'track': 9, 'log*': 8, 'panel': 46})
  - P4 at 127.5 min: 317 words in 60 s ({'log': 112, 'log*': 160, 'node': 33, 'track': 12})
  - P1 at 6.8 min: 310 words in 60 s ({'threshold': 60, 'log': 128, 'node': 114, 'track': 8})
  - P5 at 157.2 min: 275 words in 60 s ({'log': 78, 'panel': 153, 'log*': 8, 'feed': 13, 'node': 23})
  - P2 at 17.0 min: 269 words in 60 s ({'log*': 8, 'log': 60, 'feed': 45, 'node': 47, 'action': 47, 'panel': 62})
- log bursts (3+ lines within 5 s; the desktop dock previews only the newest line): 49; by phase {1: 1, 2: 7, 3: 5, 4: 25, 5: 11}

- decoded feed: 40 distinct lines; 0 longer than one 8 s slot at 238 wpm (32 words); 0 voiced clips longer than 8 s; longest line 19 words

| Phase | Bot min | Gate min-max | Headroom to gate max | DESIGN.md target | Low-high human min |
|---|---|---|---|---|---|
| 0 | 5.9 | 3-12 | 6.1 min (51%) | 6-6 | 8.0-9.5 |
| 1 | 11.1 | 8-120 | 108.9 min (91%) | 12-15 | 13.5-16.3 |
| 2 | 30.0 | 8-120 | 90.0 min (75%) | 30-40 | 34.5-46.1 |
| 3 | 52.5 | 8-120 | 67.5 min (56%) | 45-55 | 56.6-75.7 |
| 4 | 40.2 | 8-120 | 79.8 min (67%) | 25-35 | 48.8-71.9 |
| 5 | 28.7 | 15-30 | 1.3 min (4%) | 15-30 | 36.6-52.2 |

### greedy-legacy: 35831.4 s, ending None, wipes 25, identical to runHeadlessSim (sim seconds and phase-reached times)

| Phase | Iterations entering | Mean min per visit | Median | Longest | Total min | Iteration 1 words (A+B incl. dilemmas) |
|---|---|---|---|---|---|---|
| 0 | 26 | 1.0 | 0.9 | 4.2 | 26.1 | 462 |
| 1 | 26 | 5.4 | 4.7 | 15.3 | 139.3 | 1129 |
| 2 | 26 | 8.9 | 8.6 | 25.7 | 232.2 | 590 |
| 3 | 24 | 8.3 | 8.2 | 10.6 | 199.6 | 0 |

### greedy-campaign: 35991.6 s, ending None, wipes 21, identical to runHeadlessSim (sim seconds and phase-reached times)

| Phase | Iterations entering | Mean min per visit | Median | Longest | Total min | Iteration 1 words (A+B incl. dilemmas) |
|---|---|---|---|---|---|---|
| 0 | 22 | 1.0 | 0.9 | 4.2 | 22.8 | 462 |
| 1 | 22 | 6.2 | 6.4 | 11.8 | 136.1 | 1129 |
| 2 | 21 | 11.5 | 10.9 | 26.1 | 240.8 | 603 |
| 3 | 20 | 10.0 | 10.5 | 10.6 | 200.2 | 0 |
