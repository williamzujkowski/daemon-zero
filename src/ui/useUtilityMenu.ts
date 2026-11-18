/** Utility routes stay local to the view and are discarded when gameplay takes priority. */
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { checkPlayerSave, exportPlayerSave, importPlayerSave } from '../app/saveTransfer';
import { startFresh } from '../app/newRun';
import { captureReplacementScope } from '../app/replacePlayerGame';
import { useGameValue } from '../app/selectors';
import { useCheckpointKnown } from './CheckpointLabel';
import type { Pressable } from './PhaseTheme';
import { useGame, useSurveillanceKnown } from './state';
import { useUtilityFocus } from './UtilityFocus';

export type UtilityRoute = 'root' | 'save' | 'help' | 'audio' | 'log' | 'import' | 'reset';
/**
 * `pending` is the exact code that passed the check; confirm imports it, never the live field.
 * `notice` counts refusals so a repeated, identical reason remounts its alert and is announced again.
 */
interface MenuState {
  route: UtilityRoute | null; code: string; status: string; scope: string; confirmationScope: string; pending: string; notice: number;
}
const EMPTY = { route: null, code: '', status: '', confirmationScope: '', pending: '', notice: 0 } as const;

export function useUtilityScope() {
  const ready = useGameValue((state) => state.ready);
  const restore = useGameValue((state) => state.restoreRevision);
  const iteration = useGame((game) => game.iteration);
  const phase = useGame((game) => game.currentPhase);
  const blocked = useGame((game) => game.activeDilemmaId !== null);
  const ending = useGame((game) => game.ending);
  const known = useSurveillanceKnown(), table = useCheckpointKnown();
  return { disabled: !ready || blocked, canRestore: ready && !blocked && iteration === 1 && ending === null,
    scope: [ready, restore, iteration, phase, blocked, ending, known, table].join(':') };
}

export function useUtilityMenu() {
  const { disabled, scope, canRestore } = useUtilityScope();
  const replacementFocus = useUtilityFocus();
  const trigger = useRef<ComponentRef<typeof Pressable>>(null);
  const setTrigger = useCallback((node: ComponentRef<typeof Pressable> | null) => { trigger.current = node; }, []);
  const restoreFocus = useRef(false);
  const [state, setState] = useState<MenuState>({ ...EMPTY, scope });
  useEffect(() => {
    if (state.route === null && restoreFocus.current) { restoreFocus.current = false; trigger.current?.focus(); }
    if (!canRestore) replacementFocus.cancel();
    else if (state.route === null && trigger.current !== null) replacementFocus.restore(() => { trigger.current?.focus(); });
  }, [state.route, canRestore, replacementFocus]);
  if (state.scope !== scope) setState({ ...EMPTY, scope });
  const close = () => { restoreFocus.current = true; setState({ ...EMPTY, scope }); };
  // The import confirmation is reached only through review, so it never describes an unchecked code.
  const navigate = (route: Exclude<UtilityRoute, 'import'>) => {
    const confirmationScope = route === 'reset' ? captureReplacementScope() : '';
    setState((previous) => ({ ...previous, route, confirmationScope, pending: '' }));
  };
  const review = () => {
    const code = state.code, check = checkPlayerSave(code);
    if (!check.ok) { setState((previous) => ({ ...previous, status: check.reason, notice: previous.notice + 1 })); return; }
    setState((previous) => ({ ...previous, route: 'import', status: '', pending: code, confirmationScope: captureReplacementScope() }));
  };
  const back = () => {
    if (state.route === 'root') close();
    else navigate(state.route === 'import' || state.route === 'reset' ? 'save' : 'root');
  };
  const confirm = () => {
    const result = state.route === 'import' ? importPlayerSave(state.pending, state.confirmationScope) : startFresh(state.confirmationScope);
    if (result.ok) { replacementFocus.request(); close(); }
    else setState((previous) => ({ ...previous, route: 'save', status: result.reason, notice: previous.notice + 1 }));
  };
  return { ...state, route: state.scope === scope && !disabled ? state.route : null, disabled, setTrigger,
    close, back, navigate, review, confirm,
    open: () => { setState({ ...EMPTY, route: 'root', scope }); },
    edit: (code: string) => { setState((previous) => ({ ...previous, code })); },
    export: () => { setState((previous) => ({ ...previous, code: exportPlayerSave(), status: 'Backup code ready.' })); } };
}

export type UtilityMenu = ReturnType<typeof useUtilityMenu>;
