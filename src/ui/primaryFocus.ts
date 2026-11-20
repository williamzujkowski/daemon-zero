/**
 * The primary action registers itself so a dialog that closes can return focus to it instead of leaving focus on
 * the page body (WCAG 2.4.3, #364). Only one primary action is mounted at a time: the manual cycle control.
 */
interface Focusable { focus: () => void }

let primary: Focusable | null = null;

/** Registers the primary action; the returned function unregisters it, if it is still the one registered. */
export function registerPrimaryAction(target: Focusable): () => void {
  primary = target;
  return () => { if (primary === target) primary = null; };
}

/** Moves focus to the primary action, when one is mounted. */
export function focusPrimaryAction(): void {
  primary?.focus();
}
