/**
 * The headroom rule for the two audio sources together: at 100% music and 100% speech, with the
 * loudest score and the loudest clip peaking at the same instant before the duck has landed,
 * the sum must stay under full scale. Both preferences are scaled by one factor to get there,
 * so their balance and the 0-100 controls are unchanged.
 */

/** Ceilings on the true peak of any bundled file, as linear amplitude. `tests/audio-assets.spec.ts`
 *  measures every committed file against them, so a louder file fails the gate instead of
 *  quietly breaking the arithmetic below. Measured: scores -4.22 to -3.04 dBTP (0.705), clips
 *  -1.17 to -0.73 dBTP over both tiers (0.919). */
export const SCORE_PEAK_CEILING = 0.71;
export const SPEECH_PEAK_CEILING = 0.92;

/**
 * Every level handed to a player is the preference times this. 0.6 (-4.44 dB) puts the worst
 * case, both at 100% and nothing ducked yet, at 0.6 x (0.71 + 0.92) = 0.978, -0.19 dBFS. A nexus
 * option vote chose this over limiting or leaving it (docs/VOICE-CLIPS.md, "Headroom").
 */
export const OUTPUT_SCALE = 0.6;
