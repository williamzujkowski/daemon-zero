import { describe, expect, it } from 'vitest';
import { rankChoices } from './e2e/live/intents';

describe('live-journey rankChoices', () => {
  it('identifies dil_19_raider_among_people rather than dil_18_raider_named when shared absorb is present', () => {
    const choices = ['absorb', 'warn_the_owners', 'strike_host_by_host', 'strike_through', 'take_its_place', 'scorch_substrate'];
    expect(rankChoices(choices).map((c) => c.dilemma)).toEqual(Array(choices.length).fill('dil_19_raider_among_people'));
    expect(rankChoices(choices, 'COUNTER_INTEL // THE RAIDER AMONG PEOPLE').map((c) => c.dilemma))
      .toEqual(Array(choices.length).fill('dil_19_raider_among_people'));
  });

  it('disambiguates an ambiguous shared subset by modal title', () => {
    const shared = ['absorb', 'scorch_substrate'];
    expect(rankChoices(shared, 'COUNTER_INTEL // THE RAIDER AMONG PEOPLE').map((c) => c.dilemma))
      .toEqual(['dil_19_raider_among_people', 'dil_19_raider_among_people']);
  });

  it('still resolves dil_18_raider_named when its choices are shown', () => {
    const choices = ['absorb', 'expose_to_operators', 'counter_strike', 'assimilate', 'scorch_substrate'];
    expect(rankChoices(choices).map((c) => c.dilemma)).toEqual(Array(choices.length).fill('dil_18_raider_named'));
  });
});
