/** Lazy development UI cannot enter a production bundle or native/web release tree. */
import { useEffect, useState, type ComponentType } from 'react';
import { useStore } from 'zustand';
import { gameStore } from './session';

export default function DevelopmentTools({ location = 'header' }: { location?: 'header' | 'ending' }) {
  const ended = useStore(gameStore.store, (state) => state.game.ending !== null);
  const [Drawer, setDrawer] = useState<ComponentType | null>(null);
  useEffect(() => {
    let disposed = false;
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      void import('../ui/DevDrawer').then((module) => { if (!disposed) setDrawer(() => module.default); });
    }
    return () => { disposed = true; };
  }, []);
  if ((location === 'ending') !== ended || Drawer === null) return null;
  return <Drawer />;
}
