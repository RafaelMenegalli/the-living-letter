import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMediaQuery } from './hooks';
import { readStored, writeStored } from './storage';

const STORAGE_KEY = 'living-letter.motion';
export type Choice = 'on' | 'off' | null;

interface Motion {
  /** True when scenes should be painted as stills and transitions kept minimal. */
  still: boolean;
  /** True when stillness comes from the device setting rather than a choice made here. */
  fromDevice: boolean;
  toggle: () => void;
}

const MotionContext = createContext<Motion>({ still: false, fromDevice: false, toggle: () => undefined });

/**
 * The rule itself, kept pure: a choice made here always wins; with no choice,
 * the device setting decides — and only then is stillness "from the device".
 */
export function resolveMotion(choice: Choice, deviceReduced: boolean): { still: boolean; fromDevice: boolean } {
  return {
    still: choice ? choice === 'off' : deviceReduced,
    fromDevice: choice === null && deviceReduced,
  };
}

function storedChoice(): Choice {
  const value = readStored(STORAGE_KEY);
  return value === 'on' || value === 'off' ? value : null;
}

/**
 * Motion policy for the whole app. The device's reduced-motion setting is the
 * default; a person can override it either way, and that choice is remembered.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  const deviceReduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [choice, setChoice] = useState<Choice>(storedChoice);
  const { still, fromDevice } = resolveMotion(choice, deviceReduced);

  const toggle = useCallback(() => {
    const next: Choice = still ? 'on' : 'off';
    setChoice(next);
    writeStored(STORAGE_KEY, next);
  }, [still]);

  // Lets the stylesheet quiet its own transitions when motion is off.
  useEffect(() => {
    document.documentElement.dataset.motion = still ? 'still' : 'live';
  }, [still]);

  const value = useMemo<Motion>(() => ({ still, fromDevice, toggle }), [still, fromDevice, toggle]);
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export function useMotion(): Motion {
  return useContext(MotionContext);
}
