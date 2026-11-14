/** Mobile price compression preserves precise decision information and desktop formatting. */
import { CONTENT } from '../../src/content';
import { costText } from '../../src/ui/format';
import { boot, dismissBoot, expect, test } from './helpers';

test('node costs keep their exact accessible values at both widths', async ({ page }) => {
  await boot(page, 'phase5-midgame'); await dismissBoot(page);
  const price = page.locator('[data-testid^="node-"][data-testid$="-cost"]').last();
  const id = (await price.getAttribute('data-testid'))?.slice(5, -5);
  const node = id ? CONTENT.nodes.get(id) : undefined;
  if (!node) throw new Error('Missing visible phase node');
  const full = 'Cost: ' + costText(node.cost);
  await expect(price).toHaveAttribute('aria-label', full);
  const compact = (page.viewportSize()?.width ?? 0) < 900;
  await expect(price).toHaveText('Cost: ' + costText(node.cost, compact));
  await price.scrollIntoViewIfNeeded(); await expect(price).toBeInViewport();
});
