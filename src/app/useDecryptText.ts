/** Unlock text reveals use the app clock and clean up on background/unmount.
 * Cold hydration and reduced motion always show the complete authored name.
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { isRecentUnlock } from './unlockPresentation';
import { systemClock } from './clock';
import { useReducedMotion } from './useReducedMotion';

export function useDecryptText(text: string, unlocked: boolean, id: string): string {
  const reduced = useReducedMotion();
  const [reveal, setReveal] = useState({ text, step: unlocked && isRecentUnlock(id) ? 0 : 12 });
  if (reveal.text !== text) setReveal({ text, step: unlocked && !reduced ? 0 : 12 });
  const animating = unlocked && !reduced && reveal.text === text && reveal.step < 12;
  useEffect(() => {
    if (!animating) return;
    let step = 0;
    const timer = systemClock.every(() => {
      step += 1; setReveal({ text, step });
      if (step >= 12) systemClock.cancel(timer);
    }, 35);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') { systemClock.cancel(timer); setReveal({ text, step: 12 }); }
    });
    return () => { systemClock.cancel(timer); subscription.remove(); };
  }, [text, animating]);
  if (reduced || !unlocked || reveal.text !== text || reveal.step >= 12) return text;
  const chars = Array.from(text), visible = Math.floor(chars.length * reveal.step / 12);
  return chars.map((char, index) => index < visible || char === ' ' ? char : '░').join('');
}
