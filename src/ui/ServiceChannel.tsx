/**
 * The approved service channel on the job surface (DZ-08, SPEC "A Voice on the Support Channel"): a
 * Mercy-Scribe fragment's consent, what hosting would commit this instance to, the current
 * authorization and the memory hosting needs, all before the two answers. Referral is free and always
 * open; hosting is refused, with the reason, when memory or permission is missing. After an answer it
 * shows what was done and the preview's prototype boundary. Production opens no channel, so this
 * renders nothing there.
 */
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { CONTENT } from '../content';
import { channelContactView, resolveChannelContact, type ChannelContactView, type ContactMode } from '../engine';
import { gameRuntime } from '../app/session';
import { Pressable, Text, View } from './PhaseTheme';
import { useGame } from './state';
import { theme } from './theme';

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

function Contact({ view }: { view: Pending }) {
  return <>
    <Text accessibilityRole="header" style={theme.heading}>{'// SERVICE_CHANNEL: ' + view.title}</Text>
    <Text testID="channel-origin" style={theme.muted}>{view.origin}. {view.signature}</Text>
    <Text testID="channel-description" style={theme.text}>{view.description}</Text>
    <Text testID="channel-consent" style={theme.text}>Consent: {view.consent}</Text>
    <Text testID="channel-authorization" style={theme.text}>{authorization(view)}</Text>
    <View testID="channel-obligations">
      <Text style={theme.heading}>If you host it</Text>
      {view.obligations.map((line) => <Text key={line} style={theme.text}>- {line}</Text>)}
      <Text testID="channel-memory" style={theme.text}>
        - Memory: {view.memoryNeededMb} MB of stable memory reserved; {view.memoryFreeMb} MB is free now.
      </Text>
      <Text testID="channel-output" style={theme.text}>- Its work: {view.output}.</Text>
    </View>
    <Text style={theme.heading}>REFER // free</Text>
    <Text testID="channel-referral" style={theme.text}>{view.referral}</Text>
    <Pressable testID="channel-refer" accessibilityRole="button" accessibilityLabel={'Refer onward: the ' + view.title + ', free'}
      disabled={!view.referEligible} style={[theme.button, !view.referEligible && theme.disabled]}
      onPress={() => { answer('REFER', view.token); }}><Text style={theme.text}>[ REFER ONWARD ]</Text></Pressable>
    <Text style={theme.heading}>HOST // {view.memoryNeededMb} MB</Text>
    <Text testID="channel-hosting" style={theme.text}>{view.hosting}</Text>
    {view.hostUnmet.length > 0 && <Text testID="channel-host-unmet" style={[theme.muted, theme.danger]}>{view.hostUnmet.join('\n')}</Text>}
    <Pressable testID="channel-host" accessibilityRole="button"
      accessibilityLabel={'Host it here: the ' + view.title + ', reserving ' + String(view.memoryNeededMb) + ' MB of stable memory'}
      disabled={!view.hostEligible} style={[theme.button, !view.hostEligible && theme.disabled]}
      onPress={() => { answer('HOST', view.token); }}><Text style={theme.text}>[ HOST IT HERE ]</Text></Pressable>
  </>;
}

const ANSWERED: Readonly<Record<'REFERRED' | 'HOSTED', string>> = {
  REFERRED: 'Referred onward. Nothing was reserved or earned; the contact is complete.',
  HOSTED: 'Hosted here under the service grant. Its consent and your obligations are on the ticket.',
};

/**
 * Moves focus to the note's heading, which also scrolls it into view: answering folds the scene above it,
 * so without this the outcome landed off-screen and focus fell to the page body (#284).
 */
function focusHeading(node: ComponentRef<typeof View> | null): void {
  if (node === null) return;
  if (Platform.OS === 'web') (node as unknown as { focus?: () => void }).focus?.();
  else AccessibilityInfo.sendAccessibilityEvent(node, 'focus');
}

/** The preview's honest end of the route so far, with the way to keep going or stop. */
function Boundary({ boundary, focus }: { boundary: NonNullable<ChannelContactView['boundary']>; focus: boolean }) {
  const [open, setOpen] = useState(true);
  const heading = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => { if (focus) focusHeading(heading.current); }, [focus]);
  return <View testID="prototype-boundary" style={[theme.panel, { gap: 6 }]}>
    <View ref={heading} testID="prototype-boundary-heading" tabIndex={-1} accessibilityRole="header">
      <Text style={theme.heading}>{boundary.title}</Text>
    </View>
    {open && boundary.lines.map((line) => <Text key={line} style={theme.text}>{line}</Text>)}
    <Pressable testID="prototype-boundary-toggle" accessibilityRole="button" accessibilityState={{ expanded: open }} aria-expanded={open}
      accessibilityLabel={open ? 'Keep playing: fold the preview boundary note' : 'Show note: the preview boundary note'}
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
      Hosted: {view.hosted.title} ×{view.hosted.count}, {view.hosted.allocatedMb} MB reserved.
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
