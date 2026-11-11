/** Counter storage stays separate from the lazy web hook to avoid import UI on pane changes. */
const renders = new Map<string, number>();

export function recordNodeRender(id: string): void {
  renders.set(id, (renders.get(id) ?? 0) + 1);
}

export function snapshotRenderCounts(): Record<string, number> {
  return Object.fromEntries(renders);
}

/** Profiler commits for static card content, excluding balance/eligibility leaves. */
const profiles = new Map<string, { commits: number; durationMs: number }>();
export function recordNodeProfile(id: string, _phase: string, actualDuration: number): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const prior = profiles.get(id) ?? { commits: 0, durationMs: 0 };
  profiles.set(id, { commits: prior.commits + 1, durationMs: prior.durationMs + actualDuration });
}
export function snapshotNodeProfiles(): Record<string, { commits: number; durationMs: number }> {
  return Object.fromEntries(profiles);
}

let attemptedInputs = 0, acceptedInputs = 0;
export function recordManualInput(accepted: boolean): void {
  attemptedInputs += 1;
  if (accepted) acceptedInputs += 1;
}
export function snapshotManualInputs(): { attempted: number; accepted: number } {
  return { attempted: attemptedInputs, accepted: acceptedInputs };
}
