/**
 * Overlap between text runs and controls, on what is painted (route-text, #371). Each box may be clipped by
 * scrolling ancestors, but only by those that do not also contain the other box: two runs in the same scroll body
 * are compared wherever they are scrolled (an overlap off-screen is still an overlap), while a body line scrolled
 * under a dialog's pinned footer is clipped by the body it lives in and is not drawn over the footer.
 */
export interface Rect { left: number; top: number; right: number; bottom: number }
export interface Clip { id: number; rect: Rect }
export interface MeasuredBox { name: string; rect: Rect; clips: readonly Clip[] }

function clipped(box: MeasuredBox, shared: ReadonlySet<number>): Rect {
  let { left, top, right, bottom } = box.rect;
  for (const clip of box.clips) {
    if (shared.has(clip.id)) continue;
    left = Math.max(left, clip.rect.left); top = Math.max(top, clip.rect.top);
    right = Math.min(right, clip.rect.right); bottom = Math.min(bottom, clip.rect.bottom);
  }
  return { left, top, right, bottom };
}

/** Pairs whose painted boxes overlap by more than a pixel each way; `nested(i, j)` skips a box inside another. */
export function overlaps(boxes: readonly MeasuredBox[], nested: (i: number, j: number) => boolean): string[] {
  const found: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (!a || !b || nested(i, j)) continue;
      const shared = new Set(a.clips.map((clip) => clip.id).filter((id) => b.clips.some((clip) => clip.id === id)));
      const p = clipped(a, shared), q = clipped(b, shared);
      const width = Math.min(p.right, q.right) - Math.max(p.left, q.left), height = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
      if (width > 1 && height > 1) found.push('overlap: ' + a.name + ' / ' + b.name);
    }
  }
  return found;
}
