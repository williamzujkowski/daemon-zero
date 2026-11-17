/** Security-scan exceptions stay scoped, paired across scanners, and expire on their reviewed date. */
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

/** `[[IgnoredVulns]]` blocks from osv-scanner.toml as id -> ignoreUntil (ms). */
function osvExceptions(): Map<string, number> {
  const text = readFileSync('osv-scanner.toml', 'utf8');
  const found = new Map<string, number>();
  for (const block of text.split('[[IgnoredVulns]]').slice(1)) {
    const id = /^id\s*=\s*"([^"]+)"/m.exec(block)?.[1];
    const until = /^ignoreUntil\s*=\s*(\S+)/m.exec(block)?.[1];
    expect(id, 'every osv exception names an id').toBeDefined();
    expect(until, `osv exception ${String(id)} has an ignoreUntil date`).toBeDefined();
    found.set(String(id), Date.parse(String(until)));
  }
  return found;
}

/** GHSA ids listed under auditConfig.ignoreGhsas in pnpm-workspace.yaml. */
function pnpmIgnoredGhsas(): string[] {
  const text = readFileSync('pnpm-workspace.yaml', 'utf8');
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line === 'auditConfig:');
  if (start < 0) return [];
  const ids: string[] = [];
  for (const line of lines.slice(start + 2)) {
    const item = line.trim();
    if (!item.startsWith('- ')) break;
    ids.push(item.slice(2));
  }
  return ids;
}

it('lists every pnpm audit exception in osv-scanner.toml with an expiry', () => {
  const osv = osvExceptions();
  for (const id of pnpmIgnoredGhsas()) {
    expect(osv.has(id), `${id} is ignored by pnpm audit but has no dated osv-scanner entry`).toBe(true);
  }
});

it('fails once a security exception passes its reviewed expiry date', () => {
  for (const [id, until] of osvExceptions()) {
    expect(Number.isFinite(until), `${id} has a parseable ignoreUntil`).toBe(true);
    // Wall-clock read is deliberate: this test exists to make a stale exception fail.
    expect(Date.now() < until, `${id} expired; re-review it or remove it (docs/REVIEW-CURRENCY-2026-11-16.md)`).toBe(true);
  }
});

it('keeps exceptions few and specific', () => {
  const osv = osvExceptions();
  expect(osv.size).toBeLessThanOrEqual(3);
  for (const id of osv.keys()) expect(id).toMatch(/^(GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}|CVE-\d{4}-\d+)$/);
});
