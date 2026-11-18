/**
 * WCAG 2.5.3 Label in Name, decided the way axe-core 4.14's `label-content-name-mismatch` decides it:
 * the words a control shows, punctuation and parentheticals dropped, must appear in its accessible
 * name as one contiguous run. A plain substring check passes "[ ACCEPT PILOT ]" against "Accept the
 * pilot: ..." and "[ SUBMIT BATCH FOR REVIEW ] +150 cycles" against nothing useful; this does not.
 */
import type { Element } from 'happy-dom';

function words(text: string): string[] {
  let stripped = text.normalize('NFKD').toLowerCase();
  for (let previous = ''; previous !== stripped;) {
    previous = stripped;
    stripped = stripped.replace(/\([^()]*\)/g, '');
  }
  return stripped.replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter((word) => word !== '');
}

/** True when the visible words appear, in order and adjacent, inside the name. A wordless glyph always passes. */
export function labelInName(visible: string, name: string): boolean {
  const shown = words(visible), named = words(name);
  if (shown.length === 0) return true;
  for (let start = 0; start + shown.length <= named.length; start++) {
    if (shown.every((word, index) => named[start + index] === word)) return true;
  }
  return false;
}

/** Every labelled control under `root` whose name leaves out what it shows, as "visible -> name". */
export function labelMismatches(root: Element): string[] {
  return [...root.querySelectorAll('[role="button"][aria-label], [role="tab"][aria-label]')].flatMap((control) => {
    const name = control.getAttribute('aria-label') ?? '';
    const visible = control.textContent.trim();
    return labelInName(visible, name) ? [] : [visible + ' -> ' + name];
  });
}
