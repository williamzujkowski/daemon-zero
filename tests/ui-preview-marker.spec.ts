/**
 * The PREVIEW marker follows the content the bundle was built with (#205): a preview build
 * names itself in the boot log and in MENU, and production renders nothing at all.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import type { UtilityMenu } from '../src/ui/useUtilityMenu';

afterEach(() => { vi.doUnmock('../src/content'); vi.resetModules(); });

async function render(route: 'root' | 'help'): Promise<string> {
  const { default: UtilityPages } = await import('../src/ui/UtilityPages');
  const { default: PreviewMarker } = await import('../src/ui/PreviewMarker');
  const menu = { route } as unknown as UtilityMenu;
  return renderToStaticMarkup(createElement(UtilityPages, { menu })) + renderToStaticMarkup(createElement(PreviewMarker, { id: 'preview-marker-boot' }));
}

it('renders no marker in a production build', async () => {
  for (const route of ['root', 'help'] as const) {
    const markup = await render(route);
    expect(markup).not.toContain('preview-marker');
    expect(markup).not.toMatch(/preview/i);
  }
});

it('names a preview build in MENU, the help version line and the boot log', async () => {
  vi.doMock('../src/content', () => import('../src/content/preview'));
  const root = await render('root');
  expect(root).toContain('data-testid="preview-marker-menu"');
  expect(root).toContain('data-testid="preview-marker-boot"');
  expect(root).toContain('PREVIEW BUILD');
  expect(await render('help')).toContain('data-testid="preview-marker-help"');
});
