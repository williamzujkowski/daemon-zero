/**
 * Owns real clocks and timer access for the app layer.
 * Foreground deltas are monotonic; persisted timestamps use wall time.
 */
export const systemClock = {
  monotonic: () => performance.now(),
  wall: () => Date.now(),
  every: (callback: () => void, ms: number) => setInterval(callback, ms),
  cancel: (timer: ReturnType<typeof setInterval>) => { clearInterval(timer); },
};

export type Clock = typeof systemClock;
