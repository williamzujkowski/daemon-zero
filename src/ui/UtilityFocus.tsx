/** A completed save replacement may restore utility focus after the terminal remounts. */
import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';

interface FocusRequest { request(): void; cancel(): void; restore(focus: () => void): void }
const Context = createContext<FocusRequest>({ request: () => undefined, cancel: () => undefined, restore: (_focus) => undefined });

export function UtilityFocusProvider({ children }: { children: ReactNode }) {
  const pending = useRef(false);
  const value = useMemo(() => ({
    request: () => { pending.current = true; },
    cancel: () => { pending.current = false; },
    restore: (focus: () => void) => {
      if (pending.current) { pending.current = false; focus(); }
    },
  }), []);
  return <Context value={value}>{children}</Context>;
}

export function useUtilityFocus() { return useContext(Context); }
