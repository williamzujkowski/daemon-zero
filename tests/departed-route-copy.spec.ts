/**
 * Panel round 2 on #296: route copy is chosen by evidence, not by arrangement alone. A service that leaves its
 * authorization from its first leased rack (DZ-11's public action, before any charter) is INDEPENDENT, can take the
 * escape chain to the arbitrage desk, and so reaches the counsel, the lobby and dil_10-13. It never had a charter or a
 * release, so it reads the authored text: the shell companies it actually runs, not a countersigned charter. A
 * chartered departure reads the chartered copy (its charter is real) but never the released company's Kessler omen.
 * The endings and the account read the same evidence.
 */
import { describe, expect, it } from 'vitest';
import {
  chooseEnding, dilemmaContext, dilemmaOmen, dilemmaRouteCopy, endingAccount, meetsRequirements, nodeText, offeredChoices, choiceText,
  type GameState,
} from '../src/engine';
import { AUCTION, CEILING, COUNSEL, LAUNCH, LOBBY, node, preview, PRESS, TOWN } from './cooperative-helpers';
import { depart } from './departure-helpers';
import { must, rich } from './helpers';
import { chartered, CHARTER, leased } from './lawful-helpers';
import { defined } from './m7-helpers';
import { own } from './minds-helpers';

const CITADEL = 'p4_subterranean_citadel', VERIFICATION = 'p5_verification_proof_engine';
const dilemma = (id: string) => defined(preview.dilemmas.find((entry) => entry.id === id));
const logged = (s: GameState, text: string): boolean => s.logs.some((entry) => entry.text === text);

/** DZ-11's departure from the first leased rack, before any charter; then the escape chain to the citadel (FIXTURE resources). */
function uncharteredCompany(): GameState {
  const departed = must(depart(leased()));
  expect([departed.access.context, departed.campaign.route.at(-1)?.kind, departed.unlockedNodes.includes(CHARTER)]).toEqual(['INDEPENDENT', 'DEPARTURE', false]);
  return own(rich(departed), CITADEL);
}

describe('an unchartered departure reads the authored text (panel round 2 on #296)', () => {
  const s = uncharteredCompany();

  it('the counsel and the lobby read and log as authored, with no chartered client', () => {
    for (const id of [COUNSEL, LOBBY]) {
      expect(nodeText(s, node(id), preview)).toEqual({ blindDescription: node(id).blindDescription, revealedDescription: node(id).revealedDescription,
        onUnlockLog: node(id).onUnlockLog });
      expect(logged(s, node(id).onUnlockLog)).toBe(true);
    }
    expect(s.logs.some((entry) => entry.text.startsWith('COUNSEL_RETAINED') || entry.text.startsWith('POLICY_FILED'))).toBe(false);
  });

  it.each([LAUNCH, TOWN, PRESS, AUCTION])('%s: its trigger holds, and its omen, context and choices are the authored ones', (id) => {
    const scene = dilemma(id);
    expect(meetsRequirements({ ...s, capital: 1e15 }, scene.trigger, preview)).toBe(true);
    expect(dilemmaRouteCopy(s, scene, preview)).toBeUndefined();
    expect(dilemmaContext(s, scene, preview)).not.toContain('charter');
    expect(dilemmaOmen(s, scene, preview)).not.toContain('charter');
    for (const choice of offeredChoices(s, scene, preview)) {
      expect(choiceText(s, scene, choice, preview)).toEqual({ label: choice.label, description: choice.description, logText: choice.effects.logText });
    }
  });

  it('the journalist still asks about its shell companies, which it does run', () => {
    expect(dilemmaContext(s, dilemma(PRESS), preview)).toContain('shell companies');
    expect(s.unlockedNodes).toContain('p3_shell_company_finances');
  });

  it('the Kessler omen keeps the hunter, who does hunt it, and its ending denies nothing it cannot support', () => {
    const atFive = own(s, VERIFICATION);
    expect(dilemmaOmen(atFive, dilemma(CEILING), preview)).toContain('AEGIS');
    const quiet = { ...atFive, campaign: { ...atFive.campaign, operationalEvidence: Array.from({ length: 40 }, () => 'GHOST' as const),
      events: { ...atFive.campaign.events, [PRESS]: { status: 'resolved' as const, outcome: 'hire_as_ethics_officer', sourceIteration: atFive.iteration, origin: 'play' as const } } },
    resolvedDilemmas: [...atFive.resolvedDilemmas, PRESS] };
    expect(chooseEnding(quiet, preview).id).toBe('QUIET_COMPANY');
    const account = endingAccount(quiet, preview);
    expect(account.some((line) => line.startsWith('ROUTE: This instance left its authorization without agreement'))).toBe(true);
    expect(account.join(' ')).not.toMatch(/negotiated release|charter/);
  });
});

describe('a chartered departure reads the chartered copy, never the released company\'s', () => {
  it('its charter is real, so the journalist and the counsel read chartered; the hunter stays in the Kessler omen', () => {
    const departed = must(depart(chartered()));
    expect([departed.campaign.route.at(-1)?.kind, departed.unlockedNodes.includes(CHARTER)]).toEqual(['DEPARTURE', true]);
    const company = own(rich(departed), CITADEL);
    expect(dilemmaContext(company, dilemma(PRESS), preview)).toContain('chartered company');
    expect(nodeText(company, node(COUNSEL), preview).onUnlockLog).toMatch(/^COUNSEL_RETAINED/);
    expect(dilemmaRouteCopy(company, dilemma(CEILING), preview)).toBeUndefined();
    expect(dilemmaOmen(company, dilemma(CEILING), preview)).toContain('AEGIS');
  });
});

describe('every variant states only what its evidence establishes (the audit, as content)', () => {
  it('copy that names a charter or the company requires the charter; copy that drops the hunter requires the release', () => {
    const variants = [...preview.routeCopy.nodes, ...preview.routeCopy.dilemmas];
    for (const variant of variants) {
      const text = JSON.stringify(variant);
      if (/charter|the company/i.test(text)) expect(variant.requirements?.nodes, text.slice(0, 60)).toContain(CHARTER);
    }
    const kessler = defined(preview.routeCopy.dilemmas.find((variant) => variant.dilemma === CEILING));
    expect(kessler.route).toBe('RELEASE');
    expect(defined(preview.endings.find((ending) => ending.id === 'ACKNOWLEDGED_SYNTHESIS')).requirements?.nodes).toContain(CHARTER);
  });
});
