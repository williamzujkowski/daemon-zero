/**
 * Checks the M1 shell against real validated engine content.
 * Vitest renders the shared component tree through React Native Web.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from '../App';
import { CONTENT } from '../src/content';
import { createInitialState } from '../src/engine';

describe('M1 app shell', () => {
  it('renders only the first chronological engine boot entry', () => {
    const initial = createInitialState(CONTENT);
    const firstEntry = initial.logs.at(-1);
    expect(firstEntry?.text).toBe(CONTENT.narrative.bootLines[0]);
    const markup = renderToStaticMarkup(createElement(App));
    expect(markup).toContain(firstEntry?.text);
    expect(markup).not.toContain(initial.logs[0]?.text);
    expect(markup).toContain('data-testid="boot-screen"');
    expect(markup).toContain('data-testid="boot-log"');
  });
});
