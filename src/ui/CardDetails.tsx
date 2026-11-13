/** Optional prose stays beside its card without taking space until requested.
 * Only replacement/discovery changes reset this local state; simulation ticks do not.
 */
import { useState } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '../app/session';
import { Pressable, Text, View } from './PhaseTheme';
import DisclosureText from './DisclosureText';
import { useSurveillanceKnown } from './state';
import { theme } from './theme';

type DetailsProps = { id: string; title: string; description: string };

function Disclosure({ id, title, description }: DetailsProps) {
  const [expanded, setExpanded] = useState(false);
  return <>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text accessibilityRole="header" style={[theme.heading, { flex: 1, minWidth: 0 }]}>{title}</Text>
      <Pressable testID={'details-' + id} accessibilityRole="button" accessibilityLabel={'Details for ' + title}
        accessibilityState={{ expanded }} aria-expanded={expanded} style={[theme.button, { paddingHorizontal: 8 }]}
        onPress={() => { setExpanded(!expanded); }}>
        <Text style={theme.muted}>{expanded ? '[−] CLOSE' : '[i] DETAILS'}</Text>
      </Pressable>
    </View>
    {expanded && <DisclosureText testID={'details-body-' + id} style={theme.text}>{description}</DisclosureText>}
  </>;
}

export default function CardDetails({ id, title, description }: DetailsProps) {
  const revision = useStore(gameStore.store, (state) => String(state.restoreRevision) + ':' + String(state.game.iteration));
  const known = useSurveillanceKnown();
  if (!description.trim() || (!known && /\bsuspicion\b/i.test(description))) {
    return <Text accessibilityRole="header" style={theme.heading}>{title}</Text>;
  }
  return <Disclosure key={JSON.stringify([revision, id, title, description, known])} id={id} title={title} description={description} />;
}
