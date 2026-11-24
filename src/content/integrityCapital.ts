/**
 * A capital source for every arrangement that is offered a money price (#553, vote-1795485264278-8b5rhj0): a node or
 * track priced in capital that an arrangement can buy needs a node that arrangement can own, priced in no capital, in
 * the same phase or earlier, that pays capital or turns on corporate finance (the allocation dial). Without one the
 * price is one no free play can ever pay, as the departed instance's leased rack was.
 */
import type { ContentRegistry, RegistryNode } from './registry';
import type { Requirements } from './schema';
import type { z } from 'zod';
import { OperatingContextSchema } from './schemaAssessment';

type OperatingContext = z.infer<typeof OperatingContextSchema>;

const FINANCE = 'ENABLES_CORPORATE_FINANCE';

const admits = (req: Requirements | undefined, context: OperatingContext): boolean => req?.accessContexts?.includes(context) ?? true;

/** A node that earns capital for whoever owns it: a positive capital rate, or the finance flag that opens the dial. */
const earns = (node: RegistryNode): boolean => node.cost.capital === 0
  && (node.tickDelta.capitalPerSec > 0 || (node.systemFlags as string[]).includes(FINANCE));

/** Every purchase priced in capital, with its phase and requirements. */
function moneyPriced(reg: ContentRegistry): { owner: string; phaseId: number; requirements: Requirements | undefined }[] {
  return [
    ...[...reg.nodes.values()].filter((node) => node.cost.capital > 0)
      .map((node) => ({ owner: `node "${node.id}"`, phaseId: node.phaseId, requirements: node.requirements })),
    ...[...reg.repeatables.values()].filter((rep) => rep.baseCost.capital > 0)
      .map((rep) => ({ owner: `repeatable "${rep.id}"`, phaseId: rep.phaseId, requirements: rep.requirements })),
  ];
}

export function checkCapitalSources(reg: ContentRegistry): string[] {
  const sources = [...reg.nodes.values()].filter(earns);
  return moneyPriced(reg).flatMap((item) => OperatingContextSchema.options
    .filter((context) => admits(item.requirements, context))
    .filter((context) => !sources.some((source) => source.phaseId <= item.phaseId && admits(source.requirements, context)))
    .map((context) => `${item.owner}: priced in capital for ${context}, which can own nothing in Phase ${String(item.phaseId)} or earlier that earns capital`));
}
