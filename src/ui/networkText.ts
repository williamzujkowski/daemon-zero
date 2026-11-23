/**
 * The words for network coupling and storage (#484): what a source class means, the share of a raw rate that arrives,
 * and storage held against capacity. Numbers come from the engine (coupling.ts, storage.ts) and content's balance.
 */
import type { NetworkLink, SourceClass } from '../content/schemaNetwork';
import { quantityReadout, type GameState } from '../engine';
import { memoryPair } from './units';

/** What each class runs on, in the reference panel's words (SCALE.md "Storage and network"). */
export const SOURCE_CLASS_LABEL: Readonly<Record<SourceClass, string>> = {
  CO_LOCATED: 'co-located racks on one scale-up fabric',
  INTER_SITE: 'sites joined by data-centre interconnect',
  DISTRIBUTED: 'distributed hosts and edge devices on consumer links',
};

const SHORT_LABEL: Readonly<Record<SourceClass, string>> = {
  CO_LOCATED: 'co-located', INTER_SITE: 'inter-site', DISTRIBUTED: 'consumer links',
};

const pct = (share: number): string => String(Math.round(share * 1000) / 10) + '%';

/**
 * How much of a raw rate arrives, for a card: "raw; 210 PFLOP/s arrives (2% available x 30% coupling, consumer links)".
 * Empty for a source that delivers all of it.
 */
export function deliveredText(rawPerSec: number, link: NetworkLink | undefined, coupling: number): string {
  if (link === undefined || rawPerSec <= 0) return '';
  const share = link.availability * coupling;
  if (share >= 1) return '';
  const parts = [...(link.availability < 1 ? [pct(link.availability) + ' available'] : []), pct(coupling) + ' coupling'];
  return `raw; ${quantityReadout('computeRate', rawPerSec * share)} arrives (${parts.join(' × ')}, ${SHORT_LABEL[link.sourceClass]})`;
}

/** Storage held against capacity in the capacity's unit: "Storage: 0.5 / 2 TB held". */
export function storageLine(game: Pick<GameState, 'storageUsed' | 'storageCap'>): { shown: string; spoken: string } {
  const pair = memoryPair(game.storageUsed, game.storageCap, 'storage');
  return { shown: 'Storage: ' + pair.shown + ' held', spoken: 'Storage: ' + pair.spoken + ' held' };
}
