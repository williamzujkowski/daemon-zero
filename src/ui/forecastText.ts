/**
 * The forecast sentence, in its full wording and in the phone abbreviation (#89).
 * Pure so every variant is provable without a browser: both forms are built from the
 * same three inputs, so the short one can never carry less, or more, than the long one.
 */

export interface ForecastInputs {
  /** False until the mind understands what the audit trail measures. */
  readonly known: boolean;
  /** Whole seconds until suspicion 100 at the current rate; null when it is not rising. */
  readonly seconds: number | null;
  /** Whole seconds until the pending interrupt fires; null when none is pending. */
  readonly inbound: number | null;
}

/** Wording every tier had before #89, and still the accessible name on every tier. */
export function forecastSentence({ known, seconds, inbound }: ForecastInputs): string {
  const suspicion = !known ? 'Audit trail unreadable.'
    : seconds === null ? 'Suspicion stable or falling.' : 'At current rate: ' + String(seconds) + 's until suspicion 100.';
  const interrupt = inbound === null ? 'No interrupt inbound.'
    : 'Interrupt inbound in ' + String(inbound) + 's. Set resources aside.';
  return suspicion + ' // ' + interrupt;
}

/**
 * Phone wording. The longest ordinary variant is 38 characters, which measures one line
 * at 360px; the full sentence is 48-92 and wraps to two or three. The vote's constraint
 * is that words shorten and information does not: every number survives, `~` carries
 * "at current rate" (the figure is an extrapolation and must still say so), `set aside`
 * keeps the instruction, and SUS is the label the resource strip already uses there.
 * Nothing is clipped - a number long enough to overflow wraps to a second line.
 */
export function forecastCompact({ known, seconds, inbound }: ForecastInputs): string {
  const suspicion = !known ? 'Audit unreadable'
    : seconds === null ? 'SUS not rising' : 'SUS 100 in ~' + String(seconds) + 's';
  const interrupt = inbound === null ? 'No INT inbound' : 'INT ' + String(inbound) + 's: set aside';
  return suspicion + ' // ' + interrupt;
}
