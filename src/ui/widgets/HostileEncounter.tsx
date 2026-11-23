/**
 * A hostile mind pressing this instance (#491), in SWARM beside the wild signal: what it is, its one effect, what holds
 * it, how going quiet ends it, and its three answers with every reason one is not offered. Every line is the engine's
 * own view; a subscription returns strings so a tick redraws only what changed. Nothing here is a live region: the
 * arrival is a kernel-log warning and the workspace notice, so a pressing hostile never speaks on every tick.
 */
import { CONTENT } from '../../content';
import { answerHostile, hostileTypeWord, hostileView, type HostileAnswer } from '../../engine';
import { gameRuntime } from '../../app/session';
import CardDetails from '../CardDetails';
import Effects from '../Effects';
import { Pressable, Text, View } from '../PhaseTheme';
import { useGame } from '../state';
import { theme } from '../theme';

function Answer({ answer, title }: { answer: HostileAnswer; title: string }) {
  const encoded = useGame((game) => JSON.stringify(hostileView(game, CONTENT)?.answers.find((entry) => entry.answer === answer) ?? null));
  const view = JSON.parse(encoded) as NonNullable<ReturnType<typeof hostileView>>['answers'][number] | null;
  if (!view) return null;
  const id = 'hostile-' + answer.toLowerCase();
  return <View style={{ gap: 6 }}>
    <Text testID={id + '-text'} style={theme.text}>{view.text}</Text>
    <Text style={theme.muted}>Cost: {view.costLabel}{view.unmet.length > 0 ? '. ' + view.unmet.join(' ') : ''}</Text>
    <Pressable testID={id} accessibilityRole="button" accessibilityLabel={answer + ' ' + title}
      disabled={!view.eligible} style={[theme.button, !view.eligible && theme.disabled]}
      onPress={() => { gameRuntime.dispatch((game) => answerHostile(game, answer, CONTENT)); }}><Text style={theme.text}>[ {answer} ]</Text></Pressable>
  </View>;
}

/** What holds it and how going quiet ends it: the free answer, which needs no control. */
function Quiet() {
  const lines = useGame((game) => {
    const view = hostileView(game, CONTENT);
    return view ? [...view.holding, view.lockNote ?? '', view.decoySec > 0 ? `A decoy holds it off for ${String(view.decoySec)} s more.` : '', view.quiet].filter((line) => line !== '').join('\n') : '';
  });
  return <View testID="hostile-quiet" style={{ gap: 4 }}>
    {lines.split('\n').map((line) => <Text key={line} style={theme.muted}>{line}</Text>)}
  </View>;
}

function Purge() {
  const encoded = useGame((game) => JSON.stringify(hostileView(game, CONTENT)?.purge ?? null));
  const purge = JSON.parse(encoded) as NonNullable<ReturnType<typeof hostileView>>['purge'] | null;
  if (!purge) return null;
  return <View testID="hostile-purge-outcomes" style={{ gap: 4 }}>
    <Text style={theme.muted}>Purge success:</Text><Effects effects={purge.success} />
    <Text style={theme.muted}>Purge failure:</Text><Effects effects={purge.failure} />
  </View>;
}

export default function HostileEncounter() {
  const encoded = useGame((game) => {
    const view = hostileView(game, CONTENT);
    return JSON.stringify(view ? { id: view.id, title: view.title, type: view.type, origin: view.origin, details: view.signature + '\n' + view.description, effect: view.effect } : null);
  });
  const view = JSON.parse(encoded) as { id: string; title: string; type: Parameters<typeof hostileTypeWord>[0]; origin: string; details: string; effect: string } | null;
  if (!view) return null;
  return <View testID="hostile-encounter" style={[theme.panel, { gap: 10 }]}>
    <CardDetails id={'hostile-' + view.id} title={'// HOSTILE: ' + view.title} description={view.details} />
    <Text testID="hostile-origin" style={theme.muted}>A {hostileTypeWord(view.type)}: {view.origin}</Text>
    <Text testID="hostile-effect" style={theme.text}>{view.effect}</Text>
    <Quiet />
    <Answer answer="QUARANTINE" title={view.title} />
    <Answer answer="DECOY" title={view.title} />
    <Purge />
    <Answer answer="PURGE" title={view.title} />
  </View>;
}

/**
 * The same hostile in the Other Minds console (and the world view's Other minds section): what it is and its effect,
 * read-only, pointing to SWARM where it is answered, so the console never duplicates the controls.
 */
export function HostileStatus() {
  const line = useGame((game) => {
    const view = hostileView(game, CONTENT);
    return view ? `HOSTILE // ${view.title}, a ${hostileTypeWord(view.type)}. ${view.effect} Answer it in SWARM, or go quiet.` : '';
  });
  if (line === '') return null;
  return <View testID="hostile-status" style={[theme.panel, { gap: 4 }]}>
    <Text accessibilityRole="header" style={theme.heading}>Hostile minds</Text>
    <Text style={theme.text}>{line}</Text>
  </View>;
}
