/**
 * Types of the per-stage information contract (#339): what a stage must expose, by kind, and how each item is
 * found. Role and accessible name is the rule; a test id or visible text is an allowed fallback for a readout
 * that has no role or no computed name, and every fallback carries its reason so the count is a visible ratchet.
 */
import type { GameState } from '../../../src/engine';
import type { WorkspaceArea } from '../../../src/ui/workspaceTypes';
import type { OverlayId, Pane, RouteSurface } from './types';

/** Timely readouts must sit fully in the first viewport (the hard fold gate); the other kinds must be present. */
export type ItemKind = 'timely' | 'primary' | 'destructive' | 'region';

export type AriaRole = 'alert' | 'button' | 'dialog' | 'heading' | 'meter' | 'region' | 'tab' | 'switch';

export type Locate =
  | { by: 'role'; role: AriaRole; name: string | RegExp }
  /** Fallback: a role whose accessible name is not computed from content (alert), matched by its visible text. */
  | { by: 'role-text'; role: AriaRole; text: string | RegExp; why: string }
  /** Fallback: a readout with no role at all, found by its test id. */
  | { by: 'test-id'; testId: string; why: string }
  /** Fallback: plain text with neither a role nor a test id of its own. */
  | { by: 'text'; text: RegExp; why: string };

export interface ContractItem {
  /** Unique within a stage: `<surface>.<item>`. */
  key: string;
  kind: ItemKind;
  locate: Locate;
  /** The pane the item lives in; the item is expected only where that pane is on screen. None: chrome or overlay. */
  pane?: Pane;
  /** The workspace area inside its pane; the item is expected only where the stage opened that area (#463). */
  area?: WorkspaceArea;
  /** Lower is more urgent; the stage's single top-priority item is its lowest rank. */
  rank: number;
  /** Found inside the open dialog rather than anywhere on the page. */
  inDialog?: true;
}


/** Everything composition reads: the save, and the context the save cannot tell. */
export interface ComposeContext {
  state: GameState;
  /** Panes rendered on this tier right now (a phone shows one; wider tiers show columns). */
  panes: readonly Pane[];
  /** The workspace area the stage opened, when it opened one. */
  area?: WorkspaceArea;
  overlay: OverlayId | null;
  route: readonly RouteSurface[];
}

export type SurfaceItems = readonly ContractItem[] | ((context: ComposeContext) => readonly ContractItem[]);

export function isFallback(locate: Locate): boolean {
  return locate.by !== 'role';
}

export function describeLocate(locate: Locate): string {
  switch (locate.by) {
    case 'role': return `${locate.role} ${String(locate.name)}`;
    case 'role-text': return `${locate.role} with text ${String(locate.text)} (fallback: ${locate.why})`;
    case 'test-id': return `test id ${locate.testId} (fallback: ${locate.why})`;
    case 'text': return `text ${String(locate.text)} (fallback: ${locate.why})`;
  }
}
