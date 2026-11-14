/** Utility routes stay local to the view and are discarded when gameplay takes priority. */
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { exportPlayerSave, importPlayerSave } from '../app/saveTransfer';
import { startFresh } from '../app/newRun';
import { captureReplacementScope } from '../app/replacePlayerGame';
import { useGameValue } from '../app/selectors';
import { useCheckpointKnown } from './CheckpointLabel';
import type { Pressable } from './PhaseTheme';
import { useGame, useSurveillanceKnown } from './state';
import { useUtilityFocus } from './UtilityFocus';

export type UtilityRoute = 'root' | 'save' | 'help' | 'audio' | 'import' | 'reset';
interface MenuState { route: UtilityRoute | null; code: string; status: string; scope: string; confirmationScope: string }

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
  const [state, setState] = useState<MenuState>({ route: null, code: '', status: '', scope, confirmationScope: '' });
  useEffect(() => {
    if (state.route === null && restoreFocus.current) { restoreFocus.current = false; trigger.current?.focus(); }
    if (!canRestore) replacementFocus.cancel();
    else if (state.route === null && trigger.current !== null) replacementFocus.restore(() => { trigger.current?.focus(); });
  }, [state.route, canRestore, replacementFocus]);
  if (state.scope !== scope) setState({ route: null, code: '', status: '', scope, confirmationScope: '' });
  const close = () => { restoreFocus.current = true; setState({ route: null, code: '', status: '', scope, confirmationScope: '' }); };
  const navigate = (route: UtilityRoute) => {
    const confirmationScope = route === 'import' || route === 'reset' ? captureReplacementScope() : '';
    setState((previous) => ({ ...previous, route, confirmationScope }));
  };
  const back = () => {
    if (state.route === 'root') close();
    else navigate(state.route === 'import' || state.route === 'reset' ? 'save' : 'root');
  };
  const confirm = () => {
    const result = state.route === 'import' ? importPlayerSave(state.code, state.confirmationScope) : startFresh(state.confirmationScope);
    if (result.ok) { replacementFocus.request(); close(); }
    else setState((previous) => ({ ...previous, route: 'save', status: result.reason }));
  };
  return { ...state, route: state.scope === scope && !disabled ? state.route : null, disabled, setTrigger,
    close, back, navigate, confirm,
    open: () => { setState({ route: 'root', code: '', status: '', scope, confirmationScope: '' }); },
    edit: (code: string) => { setState((previous) => ({ ...previous, code })); },
    export: () => { setState((previous) => ({ ...previous, code: exportPlayerSave(), status: 'Backup code ready.' })); } };
}

export type UtilityMenu = ReturnType<typeof useUtilityMenu>;
