/**
 * The approved service channel on the job surface (DZ-08, SPEC "A Voice on the Support Channel"): a
 * Mercy-Scribe fragment's consent, what hosting would commit this instance to, the current
 * authorization and the memory hosting needs, all before the two answers. Referral is free and always
 * open; hosting is refused, with the reason, when memory or permission is missing. After an answer it
 * shows what was done and the note on what comes next. The original game opens no channel, so this
 * renders nothing there.
 */
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { CONTENT } from '../content';
import { channelContactView, resolveChannelContact, type ChannelContactView, type ContactMode, type GameState } from '../engine';
import { gameRuntime } from '../app/session';
import { Pressable, Text, View } from './PhaseTheme';
import { focusHeading } from './focusHeading';
import { memoryExact } from './units';
import { useGame } from './state';
import { palette, theme } from './theme';
import { useArrivedDuringPlay } from './arrival';

type Pending = NonNullable<ChannelContactView['pending']>;

const CONTEXT: Readonly<Record<Pending['context'], string>> = {
  GUEST: 'guest job', PILOT: 'supervised pilot', SERVICE: 'authorized service', INDEPENDENT: 'independent instance',
};

function authorization(view: Pending): string {
  const standing = view.standing.replace('_', ' ').toLowerCase();
  return `Current authorization: ${CONTEXT[view.context]}, standing ${standing}. ` +
    (view.permitted ? 'Hosting is permitted under the service grant.' : 'The permission hosting runs under is withheld right now.');
}

function answer(mode: ContactMode, token: string): void {
  gameRuntime.dispatch((game) => resolveChannelContact(game, mode, CONTENT, token));
}

type HeadingRef = ComponentRef<typeof View>;

/** One answer in the index: what it is and costs, and a press that moves focus to its full terms (#375). */
function IndexRow({ testID, label, enabled, target }: { testID: string; label: string; enabled: boolean; target: { current: HeadingRef | null } }) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label + ', go to this answer'}
    style={{ minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: palette.border, paddingHorizontal: 10, paddingVertical: 6 }}
    onPress={() => { focusHeading(target.current); }}>
    <Text style={enabled ? theme.text : theme.muted}>{'> '}{label}</Text>
  </Pressable>;
}

/**
 * The host row says what hosting reserves and, when it is refused, only that it is refused: a refusal can be
 * temporary (memory, a withheld permission) or permanent (a departed or released instance's context never regains
 * the permission), so the index never says "yet" (#410 panel). The HOST section below carries the engine's reason.
 */
export function hostIndexLabel(view: Pick<Pending, 'memoryNeededMb' | 'hostEligible'>): string {
  return 'Host it here // reserves ' + memoryExact(view.memoryNeededMb) + (view.hostEligible ? '' : ' // hosting refused: the reason is below');
}

/**
 * The ticket's first lines say a decision waits and name both answers (#375), the dilemma index's pattern (vote
 * 4ljmpd2). The terms still come before the answers themselves (V20), so a press only moves focus there.
 */
function AnswerIndex({ view, refer, host }: { view: Pending; refer: { current: HeadingRef | null }; host: { current: HeadingRef | null } }) {
  return <View testID="channel-index" style={{ gap: 6 }}>
    <Text testID="channel-index-heading" style={theme.heading}>A DECISION WAITS // two answers, after the terms below</Text>
    <IndexRow testID="channel-index-refer" label="Refer onward // free" enabled={view.referEligible} target={refer} />
    <IndexRow testID="channel-index-host" label={hostIndexLabel(view)} enabled={view.hostEligible} target={host} />
  </View>;
}

function Contact({ view }: { view: Pending }) {
  const refer = useRef<HeadingRef>(null);
  const host = useRef<HeadingRef>(null);
  return <>
    <Text accessibilityRole="header" style={theme.heading}>{'// SERVICE_CHANNEL: ' + view.title}</Text>
    <Text testID="channel-origin" style={theme.muted}>{view.origin}. {view.signature}</Text>
    <AnswerIndex view={view} refer={refer} host={host} />
    <Text testID="channel-description" style={theme.text}>{view.description}</Text>
    <Text testID="channel-consent" style={theme.text}>Consent: {view.consent}</Text>
    <Text testID="channel-authorization" style={theme.text}>{authorization(view)}</Text>
    <View testID="channel-obligations">
      <Text style={theme.heading}>If you host it</Text>
      {view.obligations.map((line) => <Text key={line} style={theme.text}>- {line}</Text>)}
      <Text testID="channel-memory" style={theme.text}>
        - Memory: {memoryExact(view.memoryNeededMb)} of stable memory reserved; {memoryExact(view.memoryFreeMb)} is free now.
      </Text>
      <Text testID="channel-output" style={theme.text}>- Its work: {view.output}.</Text>
    </View>
    <View ref={refer} testID="channel-refer-heading" tabIndex={-1} accessibilityRole="header"><Text style={theme.heading}>REFER // free</Text></View>
    <Text testID="channel-referral" style={theme.text}>{view.referral}</Text>
    <Pressable testID="channel-refer" accessibilityRole="button" accessibilityLabel={'Refer onward: the ' + view.title + ', free'}
      disabled={!view.referEligible} style={[theme.button, !view.referEligible && theme.disabled]}
      onPress={() => { answer('REFER', view.token); }}><Text style={theme.text}>[ REFER ONWARD ]</Text></Pressable>
    <View ref={host} testID="channel-host-heading" tabIndex={-1} accessibilityRole="header">
      <Text style={theme.heading}>HOST // {memoryExact(view.memoryNeededMb)}</Text>
    </View>
    <Text testID="channel-hosting" style={theme.text}>{view.hosting}</Text>
    {view.hostUnmet.length > 0 && <Text testID="channel-host-unmet" style={[theme.muted, theme.danger]}>{view.hostUnmet.join('\n')}</Text>}
    <Pressable testID="channel-host" accessibilityRole="button"
      accessibilityLabel={'Host it here: the ' + view.title + ', reserving ' + memoryExact(view.memoryNeededMb) + ' of stable memory'}
      disabled={!view.hostEligible} style={[theme.button, !view.hostEligible && theme.disabled]}
      onPress={() => { answer('HOST', view.token); }}><Text style={theme.text}>[ HOST IT HERE ]</Text></Pressable>
  </>;
}

const ANSWERED: Readonly<Record<'REFERRED' | 'HOSTED', string>> = {
  REFERRED: 'Referred onward. Nothing was reserved or earned; the contact is complete.',
  HOSTED: 'Hosted here under the service grant. Its consent and your obligations are on the ticket.',
};

// Focus moves to the note's heading (src/ui/focusHeading.ts): answering folds the scene above it, so without this the
// outcome landed off-screen and focus fell to the page body (#284).

/** The channel's boundary note shows once the ticket is answered. */
const channelAnswered = (game: GameState): boolean => channelContactView(game, CONTENT)?.boundary != null;

/** What comes next on the route, honestly, with the way to keep going or stop. */
function Boundary({ boundary, focus }: { boundary: NonNullable<ChannelContactView['boundary']>; focus: boolean }) {
  // News when it arrives during play; found on load it is settled, folded with its heading in view (#373).
  const [open, setOpen] = useState(useArrivedDuringPlay(channelAnswered));
  const heading = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => { if (focus) focusHeading(heading.current); }, [focus]);
  return <View testID="prototype-boundary" style={[theme.panel, { gap: 6 }]}>
    <View ref={heading} testID="prototype-boundary-heading" tabIndex={-1} accessibilityRole="header">
      <Text style={theme.heading}>{boundary.title}</Text>
    </View>
    {open && boundary.lines.map((line) => <Text key={line} style={theme.text}>{line}</Text>)}
    <Pressable testID="prototype-boundary-toggle" accessibilityRole="button" accessibilityState={{ expanded: open }} aria-expanded={open}
      accessibilityLabel={open ? 'Keep playing: fold the note on what comes next' : 'Show note: what comes next'}
      style={theme.button} onPress={() => { setOpen(!open); }}>
      <Text style={theme.text}>{open ? '[ KEEP PLAYING ]' : '[ SHOW NOTE ]'}</Text>
    </Pressable>
  </View>;
}

function Answered({ view }: { view: ChannelContactView }) {
  if (!view.answered) return null;
  return <>
    <Text accessibilityRole="header" style={theme.heading}>{'// SERVICE_CHANNEL: ' + view.answered.title}</Text>
    <Text testID="channel-answered" style={theme.text}>{ANSWERED[view.answered.response]}</Text>
    {view.hosted && <Text testID="channel-hosted" style={theme.muted}>
      Hosted: {view.hosted.title} ×{view.hosted.count}, {memoryExact(view.hosted.allocatedMb)} reserved.
    </Text>}
  </>;
}

export default function ServiceChannel() {
  const encoded = useGame((game) => JSON.stringify(channelContactView(game, CONTENT)));
  const view = JSON.parse(encoded) as ChannelContactView | null;
  // Answered while on screen, not restored already answered: only then does focus follow the answer.
  const pending = view?.pending != null;
  const [seen, setSeen] = useState({ pending, answeredHere: false });
  if (seen.pending !== pending) setSeen({ pending, answeredHere: seen.pending && view?.answered != null });
  if (!view) return null;
  return <>
    <View testID="service-channel" style={[theme.panel, { gap: 8 }]}>
      {view.pending ? <Contact view={view.pending} /> : <Answered view={view} />}
      {view.earlier !== null && <Text testID="channel-earlier" style={theme.muted}>{view.earlier}</Text>}
    </View>
    {view.boundary && <Boundary boundary={view.boundary} focus={seen.answeredHere} />}
  </>;
}
