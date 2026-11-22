/**
 * How many modals are open. Every full-window modal draws its backdrop through `SafeOverlay`, which
 * registers here while mounted, so a new modal is counted without anyone remembering to count it. The
 * voice autoplay queue holds while any is open: a dilemma, the menu, a confirmation, a reveal.
 */
import { useEffect } from 'react';
import { createStore } from 'zustand/vanilla';

export const overlayPresence = createStore<{ open: number }>(() => ({ open: 0 }));

export function useOverlayPresence(): void {
  useEffect(() => {
    overlayPresence.setState(({ open }) => ({ open: open + 1 }));
    return () => { overlayPresence.setState(({ open }) => ({ open: Math.max(0, open - 1) })); };
  }, []);
}
