/**
 * Central widget identifiers and resource gates shared by the terminal shell.
 * Build PR 3 registers the widget components against this manifest boundary.
 */
export const resourceWidgets = {
  cycles: 'CYCLE_COUNTER_AND_RATE', understanding: 'THERMAL_AND_SUSPICION_BARS',
  memory: 'MEMORY_ALLOCATION_MANAGER', capital: 'CORPORATE_EMPIRE_TAB',
} as const;
