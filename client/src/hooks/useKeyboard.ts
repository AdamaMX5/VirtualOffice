import { useEffect, useRef } from 'react';

/**
 * Gibt eine stabile Ref zurück, die eine Set<string> mit allen aktuell
 * gedrückten KeyCodes enthält. Kann sicher in rAF-Closures gelesen werden.
 */
export function useKeyboard(): React.RefObject<Set<string>> {
  const keys = useRef<Set<string>>(new Set());

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      keys.current.add(e.code);
    };
    const onUp = (e: KeyboardEvent) => keys.current.delete(e.code);

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup',   onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup',   onUp);
    };
  }, []);

  return keys;
}
