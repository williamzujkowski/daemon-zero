/**
 * What waits on a phone tab the player is not viewing (#358): the marker and the reason TerminalTabs shows after a
 * slot's name. A newly unlocked widget marks its slot until that slot is opened; an overheat marks SENSORS and a
 * pending omen marks CORE while each holds; the route's waiting ticket marks CORE (#284). Restores and reboots set a
 * new baseline, so a save's existing widgets are never "new".
 */
import { useState } from 'react';
import { CONTENT } from '../content';
import { selectReady, useGameValue } from '../app/selectors';
import { waitingContact } from './ContactNotice';
import { thermalWidget } from './registry/widgetRegistry';
import { useGame } from './state';

type Attention = Readonly<Partial<Record<string, string>>>;
interface Fresh { ready: boolean; revision: number; iteration: number; widgets: string; marks: Record<string, string[]> }

function withFresh(seen: Fresh, widgets: string, active: string): Record<string, string[]> {
  const before = new Set(seen.widgets.split(' '));
  const marks = { ...seen.marks };
  for (const id of widgets.split(' ')) {
    const widget = id !== '' && !before.has(id) ? CONTENT.widgets.get(id) : undefined;
    const reason = widget ? 'new: ' + widget.title : '';
    if (widget && widget.slot !== active && !(marks[widget.slot] ?? []).includes(reason)) marks[widget.slot] = [...(marks[widget.slot] ?? []), reason];
  }
  return marks;
}

export function useTabAttention(active: string): Attention {
  const ready = useGameValue(selectReady);
  const revision = useGameValue((state) => state.restoreRevision);
  const iteration = useGame((game) => game.iteration);
  const widgets = useGame((game) => game.unlockedWidgets.join(' '));
  const overheat = useGame((game) => game.unlockedWidgets.includes(thermalWidget) && game.thermal > CONTENT.balance.thermalThresholdForSuspicion);
  const omen = useGame((game) => game.pendingDilemma !== null && game.ending === null);
  const contact = useGame((game) => waitingContact(game) !== null);
  const [seen, setSeen] = useState<Fresh>({ ready, revision, iteration, widgets, marks: {} });
  if (seen.ready !== ready || seen.revision !== revision || seen.iteration !== iteration) {
    setSeen({ ready, revision, iteration, widgets, marks: {} });
  } else if (seen.widgets !== widgets) {
    setSeen({ ...seen, widgets, marks: withFresh(seen, widgets, active) });
  } else if (seen.marks[active] !== undefined) {
    // Opening the slot is seeing what was new there.
    setSeen({ ...seen, marks: Object.fromEntries(Object.entries(seen.marks).filter(([slot]) => slot !== active)) });
  }
  const reasons: Record<string, string[]> = { ...seen.marks };
  const add = (slot: string, reason: string) => { if (slot !== active) reasons[slot] = [...(reasons[slot] ?? []), reason]; };
  if (overheat) add('SENSORS', 'overheating');
  if (omen) add('CORE', 'an omen is pending');
  if (contact) add('CORE', 'a support ticket is waiting');
  return Object.fromEntries(Object.entries(reasons).filter(([slot]) => slot !== active).map(([slot, list]) => [slot, list.join('; ')]));
}
