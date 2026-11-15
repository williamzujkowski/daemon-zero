/**
 * Checks the server-rendered shell against real validated engine content.
 * Vitest renders the shared component tree through React Native Web.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from '../App';
import { CONTENT } from '../src/content';
import { createInitialState } from '../src/engine';

describe('app shell server render', () => {
  it('renders engine logs and prevents input until save hydration', () => {
    const initial = createInitialState(CONTENT);
    const firstEntry = initial.logs.at(-1);
    expect(firstEntry?.text).toBe(CONTENT.narrative.bootLines[0]);
    const markup = renderToStaticMarkup(createElement(App));
    expect(markup).not.toContain(firstEntry?.text);
    // Nothing log-shaped renders before hydration on the phone tier: the opening boot log
    // is gated on selectReady (#130) and the kernel band only exists above the mobile
    // layout (vote: menu-route-drops-the-band). The leak guard is the point of the test.
    expect(markup).not.toContain('data-testid="boot-log"');
    expect(markup).not.toContain('data-testid="kernel-dock"');
    expect(markup).toContain('data-testid="terminal-screen"');
    // The kernel band renders only above the mobile layout; a phone opens the history
    // from the utility menu instead (vote: menu-route-drops-the-band).
    expect(markup).not.toContain('data-testid="kernel-dock"');
    expect(markup).toContain('data-testid="menu-open"');
    expect(markup).not.toContain('data-testid="resource-strip"');
    expect(markup).toContain('aria-disabled="true"');
  });
});
