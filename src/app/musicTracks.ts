/** Public phase identities select the score without inspecting hidden narrative flags. */
export const musicPhases = [0, 1, 2, 3, 4, 5] as const;
export type MusicPhase = typeof musicPhases[number];

export function musicPhase(phase: number): MusicPhase | null {
  return musicPhases.find((candidate) => candidate === phase) ?? null;
}
