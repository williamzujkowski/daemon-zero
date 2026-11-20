/**
 * The announcement observer of the transitions spec (#339, C1): installed BEFORE a trigger, it records every text a
 * live region (`[aria-live]`, `role=status|alert|log`) gains, every kernel log change and every dialog that opens,
 * then reads them back with where focus landed and what each tab is called. Reads only; never clicks or scrolls.
 */
import type { Page } from '@playwright/test';
import type { Window } from 'happy-dom';

/** One thing the page said after the trigger: live text (with its role and politeness), a log entry, or a dialog. */
export interface Announcement {
  kind: 'live' | 'log' | 'dialog';
  /** `role=alert`, `role=status`, ... or none; and the region's `aria-live`, or none. */
  role: string | null; live: string | null;
  testId: string | null; text: string;
  /** Consecutive changes of the same region are folded into one entry; this is how many it holds. */
  count: number;
}

export interface Observed {
  announcements: Announcement[];
  /** The focused element after the trigger: test id, else role and name; null when focus is on the body. */
  focus: string | null;
  /** Whether that element is inside an open dialog. */
  focusInDialog: boolean;
  /** Every tab's name after the trigger, keyed by test id. */
  tabs: Record<string, string>;
}

const STORE = '__atlasAnnouncements';
/** A long trigger (a play loop) must not flood the record: past this many entries new regions are dropped. */
export const ANNOUNCEMENT_CAP = 40;

/** Starts recording; call it after the before-state is measured and immediately before the trigger. */
export async function installObserver(page: Page): Promise<void> {
  await page.evaluate(([store, cap]) => {
    const browser = globalThis as unknown as Window & Record<string, unknown>;
    const { document } = browser;
    type Node = NonNullable<ReturnType<Window['document']['querySelector']>>;
    const LIVE = '[aria-live],[role="status"],[role="alert"],[role="log"]';
    const LOG = '[data-testid="kernel-preview"],[data-testid="kernel-log"]';
    const DIALOG = '[role="dialog"],[role="alertdialog"],[aria-modal="true"]';
    const seen = new WeakMap<Node, string>();
    const found: Announcement[] = [];
    const push = (entry: Omit<Announcement, 'count'>) => {
      const last = found[found.length - 1];
      if (last && last.kind === entry.kind && last.testId === entry.testId && last.role === entry.role && last.live === entry.live) {
        last.text = entry.text; last.count += 1; return;
      }
      if (found.length < cap) found.push({ ...entry, count: 1 });
    };
    const text = (node: Node) => node.textContent.replace(/\s+/g, ' ').trim();
    for (const region of document.querySelectorAll(LIVE + ',' + LOG)) seen.set(region, text(region));
    const dialogs = new WeakSet<Node>(document.querySelectorAll(DIALOG));
    const regionsUnder = (node: Node): Node[] => [...(node.matches(LIVE + ',' + LOG) ? [node] : []), ...node.querySelectorAll(LIVE + ',' + LOG)];
    const record = (region: Node) => {
      const now = text(region);
      if (now === '' || seen.get(region) === now) return;
      seen.set(region, now);
      const isLog = region.matches(LOG) && !region.matches(LIVE);
      push({ kind: isLog ? 'log' : 'live', role: region.getAttribute('role'), live: region.getAttribute('aria-live'),
        testId: region.getAttribute('data-testid'), text: now.slice(0, 160) });
    };
    const observer = new browser.MutationObserver((mutations) => {
      const touched = new Set<Node>();
      for (const mutation of mutations) {
        const target = (mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement) as Node | null;
        const near = target?.closest(LIVE + ',' + LOG);
        if (near) touched.add(near);
        for (const added of mutation.addedNodes) {
          if (added.nodeType !== 1) continue;
          const element = added as unknown as Node;
          for (const region of regionsUnder(element)) touched.add(region);
          for (const dialog of [...(element.matches(DIALOG) ? [element] : []), ...element.querySelectorAll(DIALOG)]) {
            if (dialogs.has(dialog)) continue;
            dialogs.add(dialog);
            push({ kind: 'dialog', role: dialog.getAttribute('role'), live: null, testId: dialog.getAttribute('data-testid'),
              text: (dialog.getAttribute('aria-label') ?? text(dialog)).slice(0, 160) });
          }
        }
      }
      for (const region of touched) record(region);
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    browser[store] = { found, stop: () => { observer.disconnect(); } };
  }, [STORE, ANNOUNCEMENT_CAP] as const);
}

/** Stops recording and returns what the page said, where focus is, and every tab's name. */
export async function readObserver(page: Page): Promise<Observed> {
  const said = await page.evaluate((store) => {
    const browser = globalThis as unknown as Window & Record<string, { found: Announcement[]; stop: () => void } | undefined>;
    const held = browser[store];
    held?.stop();
    // happy-dom types it as always set; a real page reports null while nothing (not even the body) holds focus.
    const active = browser.document.activeElement as typeof browser.document.activeElement | null;
    const focused = active !== null && active.tagName !== 'BODY';
    const describe = (element: NonNullable<typeof active>) => element.getAttribute('data-testid')
      ?? `${element.getAttribute('role') ?? element.tagName.toLowerCase()} ${element.getAttribute('aria-label') ?? element.textContent.trim().slice(0, 40)}`;
    return { announcements: held?.found ?? [], focus: focused ? describe(active) : null,
      focusInDialog: focused && active.closest('[role="dialog"],[role="alertdialog"],[aria-modal="true"]') !== null };
  }, STORE);
  return { ...said, tabs: await tabNames(page) };
}

/** Every tab's name now, keyed by test id: the before half of a badge check. */
export async function tabNames(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const tabs: Record<string, string> = {};
    for (const tab of (globalThis as unknown as Window).document.querySelectorAll('[role="tab"]')) {
      tabs[tab.getAttribute('data-testid') ?? String(Object.keys(tabs).length)] = tab.getAttribute('aria-label') ?? tab.textContent.trim();
    }
    return tabs;
  });
}
