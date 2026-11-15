/**
 * A visible keyboard focus ring (#111).
 *
 * The browser default outline is about 1.1:1 against this palette's backgrounds,
 * so a keyboard user cannot see which control has focus (WCAG 2.4.7 asks for a
 * visible indicator). One injected rule covers every interactive element instead
 * of a per-component style, and `:focus-visible` keeps the ring off mouse clicks.
 *
 * Web only: native platforms draw their own focus treatment. The project's
 * tsconfig has no DOM lib, so the few document calls are typed locally.
 */
import { Platform } from 'react-native';
import { palette } from './theme';

const STYLE_ID = 'daemon-focus-ring';
const RULE = ':focus-visible{outline:2px solid ' + palette.accent + ';outline-offset:2px;}';

interface FocusRingDocument {
  getElementById(id: string): unknown;
  createElement(tag: string): { id: string; textContent: string };
  head: { appendChild(node: unknown): void };
}

export function installFocusRing(): void {
  if (Platform.OS !== 'web') return;
  const doc = (globalThis as unknown as { document?: FocusRingDocument }).document;
  if (doc === undefined || doc.getElementById(STYLE_ID) !== null) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = RULE;
  doc.head.appendChild(style);
}