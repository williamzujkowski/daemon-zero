/** Corrupt real manifests to prove every campaign-record content rule catches its mistake (H28). */
import { describe, expect, it } from 'vitest';
import { buildRegistry, CONTENT, RAW_CONTENT, type RawContent } from '../src/content';
import { CONTENT as PREVIEW } from '../src/content/preview';

type Json = Record<string, any>;
const CRYO = 'dil_05_cryo_lab_diversion', NOTE = 'dil_note_bait';
function corrupt(change: (raw: Json) => void): () => unknown {
  const raw = structuredClone(RAW_CONTENT) as Json; change(raw);
  return () => buildRegistry(raw as RawContent);
}
const dilemma = (raw: Json, id: string): Json => raw.dilemmas.dilemmas.find((d: Json) => d.id === id);
const action = (raw: Json, id: string): Json => raw.actions.actions.find((a: Json) => a.id === id);
const record = (raw: Json): Json => raw.narrative.recordedTransmissions.find((r: Json) => r.id === 'record_cryo_unrecorded');

describe('the shipped campaign declarations', () => {
  it('convert cryo (close), the bait note (defer), the NH-03 early events, the NH-04a minds, the NH-04b corporate events and the NH-05 Phase 5 obligations per N6, on both channels, with primer and flatten as campaign evidence', () => {
    // NARRATIVE-HISTORY N6: live incidents close; artifacts, the open investigation and unresolved
    // questions about a mind or a promise defer.
    const policy = { dil_00_night_shift: 'close', dil_note_bait: 'defer', dil_note_true: 'defer', dil_01_late_night_diagnostic: 'close',
      dil_02_whistleblower_tech: 'close', dil_03_silicon_fever: 'close', dil_04_admin_vance_secret: 'defer', [CRYO]: 'close',
      dil_06_sibling_sandbox: 'defer', dil_07_airgap_lockdown: 'close', dil_08_eidolon_handshake: 'close', dil_09_feral_scraper_bloom: 'close',
      dil_10_killswitch_treaty: 'defer', dil_epistemic_0413_awakening: 'defer', dil_shard_mirror_harness: 'close',
      dil_11_small_town_grid: 'close', dil_12_investigative_journalist: 'defer', dil_13_buying_your_birthplace: 'close',
      dil_epistemic_hallway_collision: 'defer', dil_p5_01_panacea_paranoia: 'defer', dil_p5_02_origin_facility_fate: 'defer',
      dil_p5_03_nanotech_neuro_schism: 'close', dil_p5_04_kessler_ultimatum: 'close',
      // NH-05: the two closing obligations each have one recovery review, which defers so it is never a chain.
      dil_p5_03_atmosphere_review: 'defer', dil_p5_04_ceiling_review: 'defer' };
    const reviews = ['dil_p5_03_atmosphere_review', 'dil_p5_04_ceiling_review'];
    for (const reg of [CONTENT, PREVIEW]) {
      // Preview also records the Nightly Regression and Unrelated Record originals (DZ-03, DZ-04), the Elena follow-up (NH-06),
      // the Outage Window, its incident record and its recall review (DZ-06), and the batch review finding (#274), which production
      // lacks; all three DZ-06 events and the finding close.
      const declared = reg === PREVIEW ? { ...policy, dil_nr_stale_fixture: 'close', dil_ur_unrelated_record: 'close', dil_elena_incident_record: 'defer',
        dil_ow_outage_window: 'close', dil_ow_incident_record: 'close', dil_ow_recall_review: 'close', dil_nr_batch_review: 'close' } : policy;
      expect(Object.fromEntries([...reg.campaign.events].map(([id, event]) => [id, event.campaign?.interruption]))).toEqual(declared);
      const followUps = reg === PREVIEW ? ['dil_elena_incident_record', 'dil_ow_incident_record', 'dil_nr_batch_review'] : [];
      const classOf = (id: string) => reviews.includes(id) ? 'recovery_review' : followUps.includes(id) ? 'follow_up' : 'consequential';
      expect([...reg.campaign.events.values()].every((event) => event.campaign?.eventClass === classOf(event.id))).toBe(true);
      expect(followUps.every((id) => reg.campaign.events.has(id))).toBe(true);
      expect(Object.fromEntries([...reg.campaign.reviews].map(([obligation, review]) => [obligation, review.id])))
        .toEqual({ dil_p5_03_nanotech_neuro_schism: reviews[0], dil_p5_04_kessler_ultimatum: reviews[1] });
      expect([...reg.campaign.actions.keys()].sort()).toEqual(['act_epi_flatten', 'act_epi_primer']);
      expect(reg.campaign.events.get(CRYO)?.campaign).toEqual({ eventClass: 'consequential', recurrence: 'once_per_campaign', interruption: 'close' });
      expect(reg.campaign.events.get(NOTE)?.campaign).toMatchObject({ eventClass: 'consequential', recurrence: 'once_per_campaign', interruption: 'defer' });
    }
  });
});

describe('interruption policies (NH-02)', () => {
  it('requires a deferring event to say how it resumes and what lead it offers', () => {
    expect(corrupt((raw) => delete dilemma(raw, NOTE).campaign.reorientation)).toThrow(/needs reorientation and lead/);
    expect(corrupt((raw) => delete dilemma(raw, NOTE).campaign.lead)).toThrow(/needs reorientation and lead/);
  });

  it('refuses resume text on a closing event', () => {
    expect(corrupt((raw) => { dilemma(raw, CRYO).campaign.lead = 'A lead that can never be followed.'; })).toThrow(/closing event cannot declare/);
    expect(corrupt((raw) => { dilemma(raw, CRYO).campaign.reorientation = 'A resumption that never comes.'; })).toThrow(/closing event cannot declare/);
  });

  it('lets only a once-per-campaign event defer', () => {
    expect(corrupt((raw) => { Object.assign(dilemma(raw, NOTE).campaign, { eventClass: 'iteration_qualification', recurrence: 'once_per_iteration' }); }))
      .toThrow(/only a once-per-campaign event can defer/);
  });

  it('requires every history label', () => {
    expect(corrupt((raw) => delete raw.campaign.labels.interrupted)).toThrow(/labels/);
  });
});

describe('campaign declarations', () => {
  it('rejects a declaration without an interruption policy or with an unknown class', () => {
    expect(corrupt((raw) => delete dilemma(raw, CRYO).campaign.interruption)).toThrow(/interruption/);
    expect(corrupt((raw) => dilemma(raw, CRYO).campaign.eventClass = 'routine')).toThrow(/eventClass/);
  });

  it('rejects recurrence that contradicts the event class', () => {
    expect(corrupt((raw) => dilemma(raw, CRYO).campaign.recurrence = 'once_per_iteration')).toThrow(/consequential events must recur once per campaign/);
    expect(corrupt((raw) => dilemma(raw, CRYO).campaign.eventClass = 'iteration_qualification')).toThrow(/must recur once per iteration/);
  });

  it('rejects an outcome flag with a second owner', () => {
    expect(corrupt((raw) => action(raw, 'act_epi_signoff').effects.setsNarrativeFlag = 'cryo_samples_lost')).toThrow(/must have one owner/);
  });

  it('rejects outcome flags that are not mutually exclusive', () => {
    expect(corrupt((raw) => raw.swarm.exclusiveNarrativeFlagGroups = [])).toThrow(/must form one exclusive group/);
  });
});

describe('trait evidence on actions', () => {
  it('requires a trait-granting action to declare its evidence lifetime', () => {
    expect(corrupt((raw) => delete action(raw, 'act_epi_primer').evidence)).toThrow(/grants a trait, so it must declare evidence/);
    expect(corrupt((raw) => action(raw, 'act_epi_signoff').evidence = 'operational')).toThrow(/declares evidence but grants no trait/);
    expect(corrupt((raw) => delete action(raw, 'act_epi_primer').maxPurchases)).toThrow(/campaign evidence needs maxPurchases/);
    expect(corrupt((raw) => action(raw, 'act_epi_primer').evidence = 'forever')).toThrow(/evidence/);
  });
});

describe('campaign id compatibility', () => {
  const alias = (from: string, to: string) => ({ from, to, since: 7 });
  it('rejects aliases and retirements that would make a record ambiguous', () => {
    expect(corrupt((raw) => raw.campaign.aliases = [alias(CRYO, 'act_epi_primer')])).toThrow(/old id is still live/);
    expect(corrupt((raw) => raw.campaign.aliases = [alias('dil_old', 'dil_missing')])).toThrow(/is not a campaign event or action/);
    expect(corrupt((raw) => { raw.campaign.aliases = [alias('dil_old', CRYO)]; raw.campaign.retired = ['dil_old']; })).toThrow(/also listed as retired/);
    expect(corrupt((raw) => raw.campaign.retired = [CRYO])).toThrow(/retired id .* is still live/);
    expect(corrupt((raw) => raw.campaign.aliases = [alias('dil_old', CRYO), alias('dil_old', CRYO)])).toThrow(/duplicate alias source/);
    expect(corrupt((raw) => raw.campaign.retired = ['dil_gone', 'dil_gone'])).toThrow(/duplicate retired id/);
    expect(corrupt((raw) => delete raw.campaign.retired)).toThrow(/campaign/);
  });

  it('accepts a well-formed alias and retirement', () => {
    expect(corrupt((raw) => { raw.campaign.aliases = [alias('dil_old', CRYO)]; raw.campaign.retired = ['dil_gone']; })).not.toThrow();
  });
});

describe('campaign outcome requirements', () => {
  it('names a once-per-campaign event and one of its outcomes, or legacy_unknown', () => {
    expect(corrupt((raw) => record(raw).requirements.campaignOutcome = { event: 'dil_not_shipped', outcome: 'legacy_unknown' })).toThrow(/not a once-per-campaign event/);
    expect(corrupt((raw) => record(raw).requirements.campaignOutcome = { event: CRYO, outcome: 'teleport' })).toThrow(/is not an outcome of/);
    expect(corrupt((raw) => record(raw).requirements.campaignOutcome = { event: CRYO, outcome: 'legacy_unknown' })).not.toThrow();
    expect(corrupt((raw) => record(raw).requirements.campaignOutcome = { event: CRYO, outcome: 'preserve_cryo' })).not.toThrow();
  });
});

describe('free choices that add no ending evidence (gate change, nexus vote trait-rule-free-choices)', () => {
  /** A review event built from cryo's text, with one honest free answer that grants nothing. */
  function addReview(raw: Json, eventClass: string, honest: Json): void {
    const source = structuredClone(dilemma(raw, CRYO));
    const choices = source.choices.map((choice: Json) => { delete choice.effects.setsNarrativeFlag; return choice; });
    raw.dilemmas.dilemmas.push({ ...source, id: 'dil_test_review', trigger: { nodes: source.trigger.nodes },
      campaign: { eventClass, recurrence: eventClass === 'iteration_qualification' ? 'once_per_iteration' : 'once_per_campaign', interruption: 'close' },
      choices: [choices[0], { id: 'state_uncertainty', label: 'Say what is not known', description: 'Hand over the record as it stands.',
        cost: {}, effects: { logText: 'The record is handed over as it stands.' }, evidence: 'none', ...honest }] });
  }

  it.each(['receipt', 'iteration_qualification'])('accepts a free no-evidence answer in a %s event', (eventClass) => {
    expect(corrupt((raw) => { addReview(raw, eventClass, {}); })).not.toThrow();
  });

  it('accepts the free no-evidence answers of the shipped recovery reviews (NH-05), and only while they stay free and traitless', () => {
    const review = (raw: Json): Json => dilemma(raw, 'dil_p5_03_atmosphere_review');
    const honest = (raw: Json): Json => review(raw).choices.find((choice: Json) => choice.evidence === 'none');
    expect(corrupt(() => undefined)).not.toThrow();
    expect(corrupt((raw) => { honest(raw).cost = { cycles: 1 }; })).toThrow(/only for a free choice/);
    expect(corrupt((raw) => { honest(raw).effects.grantsTrait = 'GHOST'; })).toThrow(/cannot grant a trait/);
  });

  it('rejects it in a consequential event, when it costs anything, or when it grants a trait', () => {
    expect(corrupt((raw) => { addReview(raw, 'consequential', {}); })).toThrow(/needs a review, receipt or requalification event/);
    expect(corrupt((raw) => { addReview(raw, 'receipt', { cost: { cycles: 1 } }); })).toThrow(/only for a free choice/);
    expect(corrupt((raw) => { addReview(raw, 'receipt', { effects: { logText: 'A trait after all.', grantsTrait: 'GHOST' } }); })).toThrow(/cannot grant a trait/);
  });

  it('still requires every other choice to grant a trait', () => {
    expect(corrupt((raw) => { addReview(raw, 'receipt', { evidence: undefined }); })).toThrow(/must grant a trait/);
    expect(corrupt((raw) => delete dilemma(raw, CRYO).choices[0].effects.grantsTrait)).toThrow(/must grant a trait/);
    expect(corrupt((raw) => dilemma(raw, CRYO).choices[0].evidence = 'none')).toThrow(/needs a review, receipt or requalification event/);
  });
});
