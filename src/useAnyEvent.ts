import { useLayoutEffect, useRef, useState } from 'react';
import { AnyEventEngine } from './engine';
import { IAnyEvent } from './module';

// Alternative to wrapping <AnyEvent>: attach directly as a ref on a single
// element, e.g. <input ref={useAnyEvent(events)} />, without the extra
// wrapping <span> (which isn't valid inside e.g. <tr>/<select>, and is
// unwanted noise in flex/grid layouts).
//
// `events` is rebuilt into a fresh MutationObserver whenever the array
// reference or `subtree` changes, so pass a memoized array (useMemo/useState)
// rather than a new literal every render.
export function useAnyEvent<T extends Element = Element>(
    events: IAnyEvent[] = [],
    subtree = false
): (node: T | null) => void {
    const [node, setNode] = useState<T | null>(null);
    const engineRef = useRef<AnyEventEngine | null>(null);

    useLayoutEffect(() => {
        if (!node) return;
        const engine = new AnyEventEngine();
        engineRef.current = engine;
        engine.observeElement(node, events, subtree);
        return () => {
            engine.disconnect();
            engineRef.current = null;
        };
    }, [node, events, subtree]);

    return setNode;
}
