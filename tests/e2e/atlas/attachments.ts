/**
 * Names the atlas cells and the gallery reporter share, in a module with no imports, so the reporter (which runs in
 * the Playwright main process) never loads the engine, the fixtures or a browser helper to learn them.
 */
export const ATLAS_ATTACHMENT = 'ui-atlas-cell';
export const ARIA_ATTACHMENT = 'ui-atlas-aria-lines';
/** `make e2e-atlas-aria` sets this: cells attach their ARIA lines and the reporter rewrites the baseline. */
export const ARIA_UPDATE = process.env.DAEMON_ATLAS_ARIA === 'update';
/** One transition cell's record (transitionRun.ts), which the gallery card of its after-frame shows. */
export const TRANSITION_ATTACHMENT = 'ui-atlas-transition';
