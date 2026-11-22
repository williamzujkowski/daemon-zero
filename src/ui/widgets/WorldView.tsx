import { Text, View } from '../PhaseTheme';
/**
 * The world view (#463, vote-1795366701521-dhlwfwb): the Other Minds console from its disclosure phase. It extends
 * the canonical console rather than duplicating it (the Scope Steward's dissent): AEGIS posture, public trust and the
 * state actors join the faction panels, which stay the one place a faction is shown. Every line is read from the
 * engine's world-view queries; a subscription returns strings so a tick redraws only the sentences that changed.
 */
import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { gameStore } from '../../app/session';
import { CONTENT } from '../../content';
import { aegisPosture, publicTrust, worldView } from '../../engine';
import { HeadingLevel, SECTION_LEVEL, useHeadingLevel } from '../headingLevel';
import { theme } from '../theme';
import { adaptationWhyText, capText, coalitionText, strikeText, trustFactorText } from '../worldText';
import AegisStatus from './AegisStatus';
import Meter from './Meter';

const tenth = (value: number): number => Math.round(value * 10) / 10;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const level = useHeadingLevel() ?? SECTION_LEVEL + 1;
  return <View testID={id} style={{ gap: 8 }}>
    <Text accessibilityRole="header" aria-level={level} style={theme.heading}>{title}</Text>
    <HeadingLevel level={level + 1}>{children}</HeadingLevel>
  </View>;
}

function AegisPostureSection() {
  const lines = useStore(gameStore.store, useShallow(({ game }) => {
    const posture = aegisPosture(game, CONTENT);
    return { adaptation: tenth(posture.adaptation), stage: posture.stageText, why: adaptationWhyText(posture), cap: capText(posture), strike: strikeText(posture) };
  }));
  return <Section id="world-aegis" title="AEGIS posture">
    <AegisStatus />
    <Meter id="aegis-adaptation" label="AEGIS adaptation" value={lines.adaptation} />
    <Text testID="aegis-stage" style={theme.text}>{lines.stage}</Text>
    <Text testID="aegis-why" style={theme.muted}>{lines.why}</Text>
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

function StateActorsSection() {
  const postures = useStore(gameStore.store, useShallow(({ game }) => worldView(game, CONTENT)?.stateActors.map((actor) => actor.posture) ?? []));
  return <Section id="world-actors" title="State actors">
    {CONTENT.world.stateActors.map((actor, index) => <View key={actor.id} testID={'actor-' + actor.id} style={{ gap: 2 }}>
      <Text accessibilityRole="header" style={theme.heading}>{actor.name}</Text>
      <Text style={theme.muted}>{actor.kind.replaceAll('_', ' ')}: {actor.description}</Text>
      <Text testID={'actor-' + actor.id + '-posture'} style={theme.text}>{postures[index] ?? ''}</Text>
    </View>)}
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
    <Section id="world-minds" title="Other minds">{factions}<KnownMinds /></Section>
  </View>;
}
