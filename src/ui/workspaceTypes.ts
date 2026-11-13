/** Presentation-only destinations; available sections still follow unlocked widgets. */
export type WorkspaceArea = 'work' | 'operations' | 'swarm' | 'minds' | 'finance' | 'payroll' | 'reference';
export const areaTitles: Record<WorkspaceArea, string> = {
  work: 'WORK', operations: 'OPERATIONS', swarm: 'SWARM', minds: 'FACTIONS',
  finance: 'FINANCE', payroll: 'PAYROLL', reference: 'REFERENCE',
};
