/** Viewport matrix: invariants that must hold at every size, plus above-the-fold checks
 * that already hold at the two baseline sizes. Layout defects at other sizes are recorded
 * in docs/UI-SIZES.md as budgets; this file must not be relaxed to hide one.
 */
import type { Browser, Page } from '@playwright/test';
import type { Window } from 'happy-dom';
import { boot, dismissBoot, expect, test } from './helpers';
import { layoutFor, SIDE_COLUMN_MIN_WIDTH } from '../../src/ui/layout';

const sizes = [
  { name: 'small-phone', width: 320, height: 568 },
  { name: 'phone-360', width: 360, height: 640 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'phone-large', width: 414, height: 896 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'phone-landscape', width: 844, height: 390 },
  { name: 'breakpoint-edge', width: 900, height: 640 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'breakpoint-three', width: 1080, height: 800 },
  { name: 'laptop', width: 1440, height: 900 },
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'widescreen', width: 2560, height: 1440 },
] as const;

/** Early, mid and warning-active states: an early terminal, the densest purchase pane, a red alert. */
const states = ['phase-1-widgets', 'epistemic-ready-p2', 'corporate-insolvent'] as const;

/** The supported floor, chosen by a nexus consensus_vote (5 of 5 selecting seats):
 *  360x640 and up get budget and above-the-fold claims; 320x568 is tolerated - it must
 *  render without overflow, clipping or sub-44px targets, but no fold promise is made
 *  there. Measured first purchase against the usable fold: 320 misses by 67px in all
 *  three sampled states, 360 clears it by 1px, 375 by 47px, 390 comfortably. */
function isSupported(size: { width: number | string; height: number | string }): boolean {
  return Number(size.width) >= 360 && Number(size.height) >= 640;
}

type Geometry = {
  overflow: boolean;
  undersized: string[];
  paneHeights: number[];
  columns: boolean;
  mobileTabs: boolean;
  widestCard: number;
  columnWidths: { core: number; sensors: number; side: number };
  headerHeight: number;
  stripHeight: number;
  tallReadouts: number;
  firstUnlockTop: number | null;
  firstUnlockVisible: boolean;
  forecastVisible: boolean;
  warningVisible: boolean;
};

/** The page context supplies the DOM; happy-dom's types are the project's typed stand-in. */
type DomElement = NonNullable<ReturnType<Window['document']['querySelector']>>;

function readGeometry(): Geometry {
  const browser = globalThis as unknown as Window;
  const box = (element: DomElement | null) => (element ? element.getBoundingClientRect() : null);
  const interactive = [...browser.document.querySelectorAll('[role="button"],[role="tab"]')]
    .filter((element) => { const r = element.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  const unlocks = [...browser.document.querySelectorAll('[data-testid$="-unlock"]')]
    .sort((left, right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top);
  const first = box(unlocks[0] ?? null);
  const forecast = box(browser.document.querySelector('[data-testid="forecast-notice"]'));
  const warning = box(browser.document.querySelector('[data-testid="insolvency-warning"]'));
  const fullyVisible = (r: DOMRect | null) => r !== null && r.width > 0 && r.height > 0
    && r.top >= 0 && r.bottom <= browser.innerHeight && r.left >= 0 && r.right <= browser.innerWidth;
  return {
    overflow: browser.document.documentElement.scrollWidth > browser.innerWidth + 1,
    undersized: interactive.filter((element) => {
      const r = element.getBoundingClientRect();
      return r.width < 43.9 || r.height < 43.9;
    }).map((element) => element.getAttribute('data-testid') ?? element.tagName),
    paneHeights: [...browser.document.querySelectorAll('[data-testid^="pane-scroll-"]')]
      .map((element) => Math.round(element.getBoundingClientRect().height)),
    columns: browser.document.querySelector('[data-testid="terminal-columns"]') !== null,
    mobileTabs: browser.document.querySelector('[data-testid="terminal-tabs-scroll"]') !== null,
    widestCard: Math.round(Math.max(0, ...[...browser.document.querySelectorAll('[data-testid]')]
      .filter((element) => /^node-[A-Za-z0-9_]+$/.test(element.getAttribute('data-testid') ?? ''))
      .map((element) => element.getBoundingClientRect().width))),
    columnWidths: {
      core: Math.round(box(browser.document.querySelector('[data-testid="panel-core"]'))?.width ?? 0),
      sensors: Math.round(box(browser.document.querySelector('[data-testid="panel-sensors"]'))?.width ?? 0),
      side: Math.round((box(browser.document.querySelector('[data-testid="panel-third"]'))
        ?? box(browser.document.querySelector('[data-testid="panel-side"]')))?.width ?? 0),
    },
    headerHeight: Math.round(box(browser.document.querySelector('[data-testid="terminal-header"]'))?.height ?? 0),
    stripHeight: Math.round(box(browser.document.querySelector('[data-testid="resource-strip"]'))?.height ?? 0),
    // #137: a readout is 28px on one line and 47 on two; anything past 50 means its pair
    // wrapped again and the strip is spending a row per meter.
    tallReadouts: [...(browser.document.querySelectorAll('[data-testid="resource-strip"] > *'))]
      .filter((child) => child.querySelector('[data-testid^="res-"], [role="meter"]') !== null)
      .filter((child) => child.getBoundingClientRect().height > 50).length,
    firstUnlockTop: first === null ? null : Math.round(first.top),
    firstUnlockVisible: fullyVisible(first),
    forecastVisible: fullyVisible(forecast),
    warningVisible: fullyVisible(warning),
  };
}

async function openState(browser: Browser, width: number, height: number, fixture: string): Promise<{ page: Page; errors: string[] }> {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (['warning', 'error'].includes(message.type())) errors.push(message.text()); });
  await boot(page, fixture);
  await dismissBoot(page);
  return { page, errors };
}

test.describe('size matrix invariants', () => {
  for (const size of sizes) {
    test(`${size.name} ${String(size.width)}x${String(size.height)} keeps every control usable`, async ({ browser }) => {
      for (const fixture of states) {
        const { page, errors } = await openState(browser, size.width, size.height, fixture);
        try {
          const geometry = await page.evaluate(readGeometry);
          test.info().annotations.push({ type: 'geometry', description: JSON.stringify({ fixture, ...geometry }) });
          expect(geometry.overflow, `${fixture} horizontal overflow at ${size.name}`).toBe(false);
          expect(geometry.undersized, `${fixture} controls under 44px at ${size.name}`).toEqual([]);
          expect(geometry.paneHeights.length, `${fixture} rendered no pane at ${size.name}`).toBeGreaterThan(0);
          for (const height of geometry.paneHeights) expect(height, `${fixture} collapsed pane at ${size.name}`).toBeGreaterThan(44);
          const expected = layoutFor(size.width, size.height);
          expect(geometry.columns, `${fixture} column mode at ${size.name}`).toBe(expected.mode !== 'mobile');
          expect(geometry.mobileTabs, `${fixture} mobile tabs at ${size.name}`).toBe(expected.mode === 'mobile');
          expect(geometry.widestCard, `${fixture} widest card at ${size.name}`).toBeLessThanOrEqual(expected.contentMaxWidth);
          // The header holds one row (64px) from 400 up. Between 360 and 399 it can
          // reach 80px when the run status takes a second line. Below 360 the header
          // is two rows on purpose (isVeryNarrowChrome): the title, PROC and MENU share
          // one row and the iteration/phase line spans the width beneath it, measured
          // at 70px against the 102px the stacked status column used to cost. A nexus
          // vote chose that band over leaving the wrap in place, 4 of 5 selecting seats.
          // #137: a readout that wraps past two lines means the strip is spending a row
          // per meter. The state decides how many meters exist - corporate-insolvent shows
          // the AEGIS lock and both notices - so this pins the readout shape, not a total.
          // Pins the phone tiers, where two readouts share a row: above 500 they are
          // content-sized or stacked on purpose, and a short viewport packs differently
          // again. The measured win this protects is 360x640 and 390x844.
          if (isSupported(size) && size.width <= 500) {
            expect(geometry.tallReadouts, `${fixture} readouts wrapping past two lines at ${size.name}`).toBe(0);
          }
          const headerBudget = size.width >= 400 ? 64 : 80;
          if (isSupported(size)) {
            expect(geometry.headerHeight, `${fixture} header rows at ${size.name}`)
              .toBeLessThanOrEqual(headerBudget);
          } else {
            // Tolerated tier: the control must exist and be reachable by scrolling, and
            // nothing here promises where it sits.
            expect(geometry.firstUnlockTop, `${fixture} purchase control missing at ${size.name}`)
              .not.toBeNull();
          }
          for (const [name, value] of Object.entries(geometry.columnWidths)) {
            if (value === 0) continue;
            expect(value, `${fixture} ${name} column below the floor at ${size.name}`)
              .toBeGreaterThanOrEqual(expected.mode === 'mobile' ? 0 : SIDE_COLUMN_MIN_WIDTH);
          }
          expect(errors, `${fixture} console output at ${size.name}`).toEqual([]);
        } finally { await page.context().close(); }
      }
    });
  }
});

/** The tolerated tier is asserted for what it does promise: a rendered, reachable,
 *  non-overflowing screen. Its fold position is deliberately not claimed (#136). */
test.describe('tolerated tier below the supported floor', () => {
  for (const size of sizes.filter((entry) => !isSupported(entry))) {
    test(`${size.name} renders every control without claiming a fold`, async ({ browser }) => {
      for (const fixture of states) {
        const { page, errors } = await openState(browser, size.width, size.height, fixture);
        try {
          const geometry = await page.evaluate(readGeometry);
          expect(geometry.overflow, `${fixture} horizontal overflow at ${size.name}`).toBe(false);
          expect(geometry.undersized, `${fixture} controls under 44px at ${size.name}`).toEqual([]);
          expect(geometry.firstUnlockTop, `${fixture} no purchase control at ${size.name}`).not.toBeNull();
          expect(errors, `${fixture} console output at ${size.name}`).toEqual([]);
        } finally { await page.context().close(); }
      }
    });
  }
});

/** Above-the-fold properties that hold today. Sizes and states that do not yet hold them are
 * listed as budgets in docs/UI-SIZES.md and must be asserted here once fixed. */
test.describe('above-the-fold at baseline sizes', () => {
  test('small phone 320x568 shows the insolvency warning', async ({ browser }) => {
    // #125: the warning used to render only while CORP was the slot in view, and at
    // 568px it started life behind the tab bar. It is the only place the player is
    // told why the run is ending, so both properties are held here.
    const warning = await openState(browser, 320, 568, 'corporate-insolvent');
    try {
      const geometry = await warning.page.evaluate(readGeometry);
      expect(geometry.warningVisible, 'insolvency warning on screen at 320x568').toBe(true);
    } finally { await warning.page.context().close(); }
  });

  test('phone 390x844 shows the forecast, the first purchase and an active warning', async ({ browser }) => {
    const early = await openState(browser, 390, 844, 'phase-1-widgets');
    try {
      const geometry = await early.page.evaluate(readGeometry);
      expect(geometry.forecastVisible, 'forecast above the fold').toBe(true);
      expect(geometry.firstUnlockVisible, 'first purchase above the fold').toBe(true);
    } finally { await early.page.context().close(); }
    const warning = await openState(browser, 390, 844, 'corporate-insolvent');
    try {
      const geometry = await warning.page.evaluate(readGeometry);
      expect(geometry.warningVisible, 'insolvency warning above the fold').toBe(true);
      expect(geometry.forecastVisible, 'forecast above the fold with a warning active').toBe(true);
    } finally { await warning.page.context().close(); }
  });

  test('phone-360 640 shows the forecast and the opening purchase, and records where mid-game does not fit', async ({ browser }) => {
    // #138: this loop used to reuse one page, and boot() only seeds a fixture when
    // localStorage is empty - so all three assertions re-measured the FIRST fixture and
    // two of them were vacuous. Each state now gets a fresh context, and the claim is
    // what the measurements actually support: the opening state clears the fold at 360,
    // mid-game and the insolvency state do not (609-653 and 732 against 640).
    for (const fixture of states) {
      const { page } = await openState(browser, 360, 640, fixture);
      try {
        const geometry = await page.evaluate(readGeometry);
        expect(geometry.forecastVisible, `${fixture} forecast above the fold`).toBe(true);
        if (fixture === 'phase-1-widgets') {
          expect(geometry.firstUnlockVisible, 'opening first purchase above the fold').toBe(true);
        } else {
          // Recorded, not claimed: the control must exist and be reachable by scrolling.
          expect(geometry.firstUnlockTop, `${fixture} purchase control missing`).not.toBeNull();
        }
      } finally { await page.context().close(); }
    }
  });

  test('desktop 1440x900 shows the forecast and the first purchase in every sampled state', async ({ browser }) => {
    for (const fixture of states) {
      const { page } = await openState(browser, 1440, 900, fixture);
      try {
        const geometry = await page.evaluate(readGeometry);
        expect(geometry.forecastVisible, `${fixture} forecast above the fold`).toBe(true);
        expect(geometry.firstUnlockVisible, `${fixture} first purchase above the fold`).toBe(true);
      } finally { await page.context().close(); }
    }
  });
});