/** Counter storage stays separate from the lazy web hook to avoid import UI on pane changes. */
const renders = new Map<string, number>();

export function recordNodeRender(id: string): void {
  renders.set(id, (renders.get(id) ?? 0) + 1);
}

export function snapshotRenderCounts(): Record<string, number> {
  return Object.fromEntries(renders);
}
