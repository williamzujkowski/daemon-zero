import { Text, View } from '../PhaseTheme';
/**
 * The world view (#463, vote-1795366701521-dhlwfwb): the Other Minds console from its disclosure phase. It extends
 * the canonical console rather than duplicating it (the Scope Steward's dissent): AEGIS posture, public trust, the
 * state actors, the heat-and-power signature (#482), fabrication capability and closure (#485), the relevance threshold and
 * standing stance (#536) and the quantum capability (#464)
 * join the faction panels, which stay the one place a faction is
 * shown. Every line is read from the engine's world-view queries; a subscription returns strings so a tick redraws only
 * the sentences that changed.
 */
import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { gameStore } from '../../app/session';
import { CONTENT } from '../../content';
import type { StatePressure } from '../../content/schemaPressure';
import { aegisPosture, isNodeKnown, powerSignature, pressureViews, publicTrust, signatureClass, worldView, worldViewOpen, type GameState, type PressureView } from '../../engine';
import { pressureAnswerText, pressureEffectText, pressureWhyText, type Names } from '../pressureText';
import { theme } from '../theme';
import { adaptationWhyText, capText, coalitionText, easeText, signatureSummaryText, signatureTermText, strikeText, trustFactorText } from '../worldText';
import AegisStatus from './AegisStatus';
import Meter from './Meter';
import { HostileStatus } from './HostileEncounter';
import QuantumSection from './QuantumSection';
import ConflictSection from './ConflictSection';
import SupplyChainSection from './SupplyChainSection';
import RelevanceSection from './RelevanceSection';
import Section from './WorldSection';

const tenth = (value: number): number => Math.round(value * 10) / 10;


function AegisPostureSection() {
  const lines = useStore(gameStore.store, useShallow(({ game }) => {
    const posture = aegisPosture(game, CONTENT);
    return { adaptation: tenth(posture.adaptation), stage: posture.stageText, why: adaptationWhyText(posture), ease: easeText(posture), cap: capText(posture),
      strike: strikeText(posture) };
  }));
  return <Section id="world-aegis" title="AEGIS posture">
    <AegisStatus />
    <Meter id="aegis-adaptation" label="AEGIS adaptation" value={lines.adaptation} />
    <Text testID="aegis-stage" style={theme.text}>{lines.stage}</Text>
    <Text testID="aegis-why" style={theme.muted}>{lines.why}</Text>
    {lines.ease !== null && <Text testID="aegis-ease" style={theme.muted}>{lines.ease}</Text>}
    <Text testID="aegis-cap" style={theme.muted}>{lines.cap}</Text>
    <Text testID="aegis-strike" style={theme.muted}>{lines.strike}</Text>
  </Section>;
}

function PublicTrustSection() {
  const lines = useStore(gameStore.store, useShallow(({ game }) => {
    const trust = publicTrust(game, CONTENT);
    return { value: trust.value, coalition: coalitionText(aegisPosture(game, CONTENT), trust), factors: trust.factors.map(trustFactorText).join('\n') };
  }));
  return <Section id="world-trust" title="Public trust">
    <Meter id="public-trust" label="Public trust" value={lines.value} unit="%" />
    <Text testID="public-trust-coalition" style={theme.muted}>{lines.coalition}</Text>
    {lines.factors === '' ? <Text testID="public-trust-factors" style={theme.muted}>Nothing on the public record moves it yet.</Text>
      : <View testID="public-trust-factors" style={{ gap: 4 }}>
        {lines.factors.split('\n').map((line) => <Text key={line} style={theme.muted}>{line}</Text>)}
      </View>}
  </Section>;
}

/** Names as the player knows them: a node by its revealed name once owned or remembered, its blind name before. */
function namesFor(game: GameState): Names {
  return {
    node: (id) => {
      const node = CONTENT.nodes.get(id);
      if (!node) return id;
      return game.unlockedNodes.includes(id) || isNodeKnown(game, id) ? node.revealedName : node.blindName;
    },
    track: (id) => CONTENT.repeatables.get(id)?.name ?? id,
    source: (id) => signatureClass(CONTENT, id)?.name ?? id,
  };
}

/** One line per field, tab-separated, so a subscription compares strings and a tick redraws only what changed. */
const FIELDS = ['label', 'text', 'effect', 'why', 'answer', 'stance'] as const;

/**
 * How a pressure the record calls stands: in force; honoured past the relevance threshold, where only the stance makes
 * it bind (#536); not binding there; or held off by an answer. The text is the order's own while it stands.
 */
function pressureLabel(view: PressureView): string {
  if (view.inForce) return view.relevance === null ? 'IN FORCE: ' : 'HONOURED: ';
  return answered(view) ? 'ANSWERED: ' : 'NOT BINDING: ';
}

/** Held off by an answer the instance holds (the record's answered status), as against standing unanswered. */
const answered = (view: PressureView): boolean => view.answers.some((answer) => answer.held);

/** An actor's pressures the record calls now (#490): in force or answered, with effect, why, and the answers the engine accepts. */
function ActorPressures({ pressures }: { pressures: readonly StatePressure[] }) {
  const rows = useStore(gameStore.store, useShallow(({ game }) => {
    const names = namesFor(game);
    // Only this actor's pressures, and only while the view is open: the rest of the world view is not read per tick here.
    return (worldViewOpen(game, CONTENT) ? pressureViews(game, pressures, CONTENT) : []).map((view) => [
      view.pressure.id, pressureLabel(view), answered(view) ? view.pressure.answeredText : view.pressure.text,
      pressureEffectText(view, names), pressureWhyText(view, game.alertLevel), pressureAnswerText(view, names) ?? '', view.relevance?.line ?? '',
    ].join('\t'));
  }));
  return <>{rows.map((row) => {
    const [pressureId = '', ...values] = row.split('\t');
    const field = Object.fromEntries(FIELDS.map((key, index) => [key, values[index] ?? '']));
    const testID = 'pressure-' + pressureId;
    return <View key={pressureId} testID={testID} style={{ gap: 2 }}>
      <Text testID={testID + '-text'} style={[theme.text, (field.label === 'IN FORCE: ' || field.label === 'HONOURED: ') && theme.danger]}>
        {String(field.label) + String(field.text)}</Text>
      {field.stance !== '' && <Text testID={testID + '-stance'} style={theme.text}>{field.stance}</Text>}
      <Text testID={testID + '-effect'} style={theme.muted}>{field.effect}</Text>
      <Text testID={testID + '-why'} style={theme.muted}>{field.why}</Text>
      {field.answer !== '' && <Text testID={testID + '-answer'} style={theme.muted}>{field.answer}</Text>}
    </View>;
  })}</>;
}

function StateActorsSection() {
  const postures = useStore(gameStore.store, useShallow(({ game }) => worldView(game, CONTENT)?.stateActors.map((actor) => actor.posture) ?? []));
  return <Section id="world-actors" title="State actors">
    {CONTENT.world.stateActors.map((actor, index) => <View key={actor.id} testID={'actor-' + actor.id} style={{ gap: 2 }}>
      <Text accessibilityRole="header" style={theme.heading}>{actor.name}</Text>
      <Text style={theme.muted}>{actor.kind.replaceAll('_', ' ')}: {actor.description}</Text>
      <Text testID={'actor-' + actor.id + '-posture'} style={theme.text}>{postures[index] ?? ''}</Text>
      {actor.pressures !== undefined && <ActorPressures pressures={actor.pressures} />}
    </View>)}
  </Section>;
}

/** What the run's power and heat make visible (#482): one line for the draw, one per source or sink with watts through it. */
function SignatureSection() {
  const lines = useStore(gameStore.store, useShallow(({ game }) => {
    const reading = powerSignature(game, game.rates, CONTENT);
    const terms = (reading?.terms ?? []).flatMap((term) => {
      const cls = signatureClass(CONTENT, term.classId);
      return cls === undefined ? [] : [term.classId + '\t' + signatureTermText(term, cls)];
    });
    return [signatureSummaryText(reading), ...terms];
  }));
  const [summary, ...terms] = lines;
  return <Section id="world-signature" title="Power and heat signature">
    <Text testID="signature-summary" style={theme.text}>{summary}</Text>
    {terms.map((entry) => {
      const [id, text] = entry.split('\t');
      return <Text key={id} testID={'signature-term-' + String(id)} style={theme.muted}>{text}</Text>;
    })}
  </Section>;
}

function KnownMinds() {
  const standings = useStore(gameStore.store, useShallow(({ game }) => {
    const listed = worldView(game, CONTENT)?.minds ?? [];
    return CONTENT.world.minds.map((mind) => listed.find((entry) => entry.id === mind.id)?.standing ?? null);
  }));
  return <>{CONTENT.world.minds.map((mind, index) => {
    const standing = standings[index];
    return standing === null || standing === undefined ? null : <View key={mind.id} testID={'mind-' + mind.id} style={[theme.panel, { gap: 2 }]}>
      <Text accessibilityRole="header" style={theme.heading}>{mind.name}</Text>
      <Text style={theme.text}>{standing}</Text>
    </View>;
  })}</>;
}

/** `factions` are the console's own faction panels, shown once, under Other minds. */
export default function WorldView({ factions }: { factions: ReactNode }) {
  return <View testID="world-view" style={{ gap: 16 }}>
    <Text testID="world-view-lead" style={theme.muted}>World view: who hunts, governs and answers you at the scale you now operate.</Text>
    <AegisPostureSection />
    <PublicTrustSection />
    <StateActorsSection />
    <SignatureSection />
    <ConflictSection />
    <SupplyChainSection />
    <RelevanceSection />
    <QuantumSection />
    <Section id="world-minds" title="Other minds"><HostileStatus />{factions}<KnownMinds /></Section>
  </View>;
}
