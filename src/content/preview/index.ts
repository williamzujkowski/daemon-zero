/**
 * Preview content: the production composition plus ./overlay.json, built through the same
 * buildRegistry. Only a preview build resolves this module in place of src/content/index.ts;
 * tests import it directly. It exports the production module's names and types, so every
 * import site works unchanged, plus the overlay and its sentinel.
 */
import type * as Production from '../production';
import { RAW_CONTENT as PRODUCTION_RAW_CONTENT } from '../production';
import { applyOverlay, parseOverlay } from '../overlay';
import { buildRegistry, ContentError, type RawContent } from '../registry';
import type * as Schema from '../schema';
import overlay from './overlay.json';

/** What preview adds to production. */
export const PREVIEW_OVERLAY = parseOverlay(overlay);

/** Appears in a bundle only when the overlay does: the known positive for a bundle scan. */
export const PREVIEW_SENTINEL = PREVIEW_OVERLAY.sentinel;

/** Production's value exports; the schema names are re-exported type-only by both modules. */
type ProductionValues = Omit<typeof Production, keyof typeof Schema>;

const raw: RawContent = { ...applyOverlay(PRODUCTION_RAW_CONTENT, PREVIEW_OVERLAY), channel: 'preview' };

// The exports below come from an object checked against production's value exports, so adding,
// removing or retyping a production export fails to compile until preview matches. Building the
// registry validates the composed content: importing this module throws if it is invalid.
const preview = { RAW_CONTENT: raw, CONTENT: buildRegistry(raw), buildRegistry, ContentError } satisfies ProductionValues;

export const { RAW_CONTENT, CONTENT } = preview;
export { buildRegistry, ContentError };
export type { ContentRegistry, RawContent, RegistryNode } from '../registry';
export type { ContentChannel } from '../schemaChannel';
export type * from '../schema';
