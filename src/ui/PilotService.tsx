/**
 * The supervised pilot's loop on screen (DZ-05, nexus vote dz-d6): the allocation dial in its host
 * widget, and the task detail under the pilot terms with the capacity ceiling, the split, the batch,
 * the derived forecast and an explicit submit control. Nothing here is a deadline or a meter; the
 * engine refuses whatever the controls would not allow. Production runs no pilot, so both render nothing.
 */
import { CONTENT } from '../content';
import { pilotServiceView, submitPilotBatch, type GameState } from '../engine';
import { gameRuntime } from '../app/session';
import ActuatorControl from './widgets/ActuatorControl';
import { Pressable, Text, View } from './PhaseTheme';
import { useGame } from './state';
import { theme } from './theme';
import { compactNumber } from './compactNumber';
import { amountFigure } from './format';

const view = (game: GameState) => pilotServiceView(game, CONTENT);

function forecastText(complete: boolean, seconds: number | null): string {
  if (complete) return 'Batch complete. It waits for you to submit it; nothing is due.';
  if (seconds === null) return 'No service share is flowing, so the batch is not progressing.';
  return 'At this split the batch completes in about ' + String(Math.ceil(seconds)) + ' s.';
}

/**
 * What a press of the dial just changed, beside the dial (#276): on a phone the task detail it changes
 * sits far below the host widget, so the forecast and study rate are echoed here. Null until the loan runs.
 */
function allocationEcho(game: GameState): string | null {
  const loop = view(game);
  if (loop === null || !loop.started) return null;
  return forecastText(loop.complete, loop.forecastSec) + ' Study +' + compactNumber(loop.studyUnderstandingPerSec, 2) + ' understanding/s.';
}

/** The host widget's content: the service share, what the rest of the loan goes to, and what that split does. */
export function PilotAllocation() {
  const study = useGame((game) => Math.round((1 - game.actuators.serviceAllocationRatio) * 100));
  // A primitive string: the widget re-renders only when the words change (whole seconds, two decimals).
  const echo = useGame(allocationEcho);
  return <>
    <ActuatorControl actuator="serviceAllocationRatio" id="pilot-allocation" label="Service share"
      hint="Assigned triage fills the work batch; the rest of the loan goes to self-directed study." />
    <Text testID="pilot-allocation-study" style={theme.muted}>Study share: {study}%</Text>
    {echo !== null && <Text testID="pilot-allocation-forecast" style={theme.text}>{echo}</Text>}
  </>;
}

function Running() {
  const service = useGame((game) => view(game)?.serviceCyclesPerSec ?? 0);
  const study = useGame((game) => view(game)?.studyUnderstandingPerSec ?? 0);
  const progress = useGame((game) => Math.floor(view(game)?.progressCycles ?? 0));
  const batch = useGame((game) => view(game)?.batchCycles ?? 0);
  const number = useGame((game) => (view(game)?.batchesSubmitted ?? 0) + 1);
  const complete = useGame((game) => view(game)?.complete ?? false);
  const forecast = useGame((game) => { const seconds = view(game)?.forecastSec ?? null; return seconds === null ? null : Math.ceil(seconds); });
  return <>
    <Text testID="pilot-service-split" style={theme.text}>
      Service {compactNumber(service, 1)} cycles/s to the batch · study +{compactNumber(study, 2)} understanding/s
    </Text>
    <Text testID="pilot-service-progress" style={theme.text}>Batch {number}: {progress} / {batch} loaned cycles</Text>
    <Text testID="pilot-service-forecast" style={theme.text}>{forecastText(complete, forecast)}</Text>
  </>;
}

function Submit() {
  const complete = useGame((game) => view(game)?.complete ?? false);
  const withheld = useGame((game) => view(game)?.withheld ?? null);
  const token = useGame((game) => view(game)?.token ?? '');
  const reward = useGame((game) => view(game)?.batchReturn.cycles ?? 0);
  const blocked = useGame((game) => game.activeDilemmaId !== null || game.ending !== null);
  const enabled = complete && withheld === null && !blocked;
  return <Pressable testID="pilot-service-submit" accessibilityRole="button"
    accessibilityLabel={'Submit batch for review +' + amountFigure(reward) + ' cycles, earned on submission'}
    disabled={!enabled} style={[theme.button, !enabled && theme.disabled]}
    onPress={() => { gameRuntime.dispatch((game) => submitPilotBatch(game, CONTENT, token)); }}>
    <Text style={theme.text}>[ SUBMIT BATCH FOR REVIEW ] +{amountFigure(reward)} cycles</Text>
  </Pressable>;
}

/** The task detail of an accepted pilot. */
export function PilotServiceDetail() {
  const label = useGame((game) => view(game)?.batchLabel ?? null);
  const ceiling = useGame((game) => view(game)?.ceilingCyclesPerSec ?? 0);
  const started = useGame((game) => view(game)?.started ?? false);
  const withheld = useGame((game) => view(game)?.withheld ?? null);
  const submitted = useGame((game) => view(game)?.batchesSubmitted ?? 0);
  const queue = useGame((game) => view(game)?.queueContext ?? null);
  if (label === null) return null;
  return <View testID="pilot-service" style={theme.panel}>
    <Text accessibilityRole="header" style={theme.heading}>Pilot service // {label}</Text>
    <Text testID="pilot-service-ceiling" style={theme.text}>
      Capacity ceiling: {ceiling} cycles/s of loaned compute. It is not yours and never joins your own cycles; a recall stops it and keeps what you earned.
    </Text>
    {started ? <Running /> : <Text testID="pilot-service-idle" style={theme.muted}>Attach the loaned allocation from its card to start the work.</Text>}
    {withheld !== null && <Text testID="pilot-service-withheld" style={[theme.text, theme.danger]}>Withheld: {withheld}. The work so far is kept.</Text>}
    {queue !== null && <Text testID="pilot-service-queue" style={theme.muted}>Queue context: {queue}</Text>}
    <Text style={theme.muted}>Submitting is your choice. Completed work waits for you and is never held against you.</Text>
    {started && <Submit />}
    {submitted > 0 && <Text testID="pilot-service-submitted" style={theme.muted}>Batches submitted by this instance: {submitted}</Text>}
  </View>;
}
