import {useEffect, useMemo, useRef, useState} from 'react';

export interface GuarderStatus<TGuard> {
  ready: boolean;
  guard: TGuard | null;
}

/**
 * Placeholder hook for future interface guarder logic.
 * Replace the body with the real implementation when you plug in your code.
 */
export function useInterfaceGuarder<TGuard>(
  factory: () => Promise<TGuard> | TGuard,
): GuarderStatus<TGuard> {
  const [state, setState] = useState<GuarderStatus<TGuard>>({
    ready: false,
    guard: null,
  });
  const factoryRef = useRef(factory);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const next = await factoryRef.current();
        if (!cancelled) {
          setState({ready: true, guard: next});
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[react-interface-guarder-hooks] load failed', err);
          setState({ready: false, guard: null});
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const guard = useMemo(() => state.guard, [state.guard]);

  return {ready: state.ready, guard};
}

export default useInterfaceGuarder;
