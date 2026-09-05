import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AnyEvent, { useAnyEvent, IAnyTriggerEventFn } from '../../src/index';
import { isEllipsis } from 'isellipsis';
import AnyAttribute, { asObject } from 'react-any-attr';
import EventLog from './EventLog';
import OuterHtmlPreview from './OuterHtmlPreview';

function useLog(limit = 5) {
  const [entries, setEntries] = useState<string[]>([]);
  const log = (message: string) => setEntries((prev) => [...prev.slice(-(limit - 1)), `${new Date().toLocaleTimeString()} — ${message}`]);
  return { entries, log };
}

function ProgrammaticChangeDemo() {
  const { entries, log } = useLog();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const handler = () => log(`banana fired, value="${input.value}"`);
    input.addEventListener('banana', handler);
    return () => input.removeEventListener('banana', handler);
  }, []);

  return (
    <section>
      <h2>1. Detecting programmatic changes</h2>
      <p>
        <code>triggerByAttributes: ['value']</code> fires <code>banana</code> only when something sets <code>.value</code>{' '}
        <em>programmatically</em> (in JS) — the bug this library exists to fix. Typing into the box below does{' '}
        <strong>not</strong> fire it (real typing never goes through the JS setter at all); only the button does. Use{' '}
        <code>triggerByEvents</code> (demo 2) to react to real typing.
      </p>
      <AnyEvent
        events={[
          {
            name: 'banana',
            triggerByAttributes: ['value'],
            elementsType: [HTMLInputElement],
            triggerEventFn: () => true,
          },
        ]}
      >
        <input id="programmatic-input" ref={inputRef} placeholder="typing here does nothing..." />
      </AnyEvent>
      <button
        onClick={() => {
          if (inputRef.current) inputRef.current.value = `set programmatically @ ${new Date().toLocaleTimeString()}`;
        }}
      >
        Set value programmatically
      </button>
      <EventLog entries={entries} />
    </section>
  );
}

const bananaEventFn: IAnyTriggerEventFn = function (): boolean {
  return (this as HTMLInputElement).value.toLowerCase().includes('banana');
};

function NativeEventDemo() {
  const { entries, log } = useLog();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const onDispatch = () => log('caught via addEventListener("banana", ...)');
    input.addEventListener('banana', onDispatch);
    (input as any).onbanana = () => log('caught via input.onbanana = ...');
    return () => input.removeEventListener('banana', onDispatch);
  }, []);

  return (
    <section>
      <h2>2. A real DOM event driving a custom one</h2>
      <p>
        <code>triggerByEvents: ['keyup']</code> checks the condition on every keystroke; typing "banana" dispatches the custom
        event and calls <code>onbanana</code> — both fire reliably now (previously only <code>onbanana</code> did).
      </p>
      <AnyEvent
        events={[
          {
            name: 'banana',
            triggerByEvents: ['keyup'],
            elementsType: [HTMLInputElement],
            triggerEventFn: bananaEventFn,
          },
        ]}
      >
        <input ref={inputRef} placeholder='type "banana"...' />
      </AnyEvent>
      <EventLog entries={entries} />
    </section>
  );
}

function ReactiveDemo() {
  const { entries, log } = useLog();
  const [mode, setMode] = useState<'letters' | 'digits'>('letters');
  const [status, setStatus] = useState<'waiting' | 'matched'>('waiting');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const events = useMemo(
    () => [
      {
        name: 'match',
        // triggerByEvents, not triggerByAttributes: real keyboard typing
        // never invokes the JS `.value` setter at all (the browser sets the
        // underlying value directly), so triggerByAttributes - which relies
        // on that setter - can only ever react to a *programmatic*
        // `el.value = x` assignment (as in demo 1), never actual typing.
        triggerByEvents: ['keyup'],
        elementsType: [HTMLInputElement],
        triggerEventFn: function (this: EventTarget) {
          const value = (this as HTMLInputElement).value;
          return mode === 'letters' ? /[a-zA-Z]/.test(value) : /[0-9]/.test(value);
        },
      },
    ],
    [mode]
  );

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const handler = () => {
      log(`"match" fired (mode: ${mode}, value: "${input.value}")`);
      setStatus('matched');
    };
    input.addEventListener('match', handler);
    return () => input.removeEventListener('match', handler);
  }, [mode]);

  const switchMode = () => {
    // Switching alone fires nothing by itself - there's no new value to
    // check yet. Clearing + refocusing makes that obvious instead of
    // leaving the box showing stale, already-matched text.
    setMode((m) => (m === 'letters' ? 'digits' : 'letters'));
    setStatus('waiting');
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
  };

  return (
    <section>
      <h2>3. Reactive events prop</h2>
      <p>
        Changing the <code>events</code> prop on an already-mounted <code>&lt;AnyEvent&gt;</code> rebuilds it in place, so the
        same input can switch, live, between reacting to letters or digits. Switching mode by itself fires nothing — it only
        changes what the <em>next</em> keystroke is checked against.
      </p>
      <p className={`status status-${status}`}>
        Mode: <strong>{mode}</strong> — {status === 'waiting' ? `type a ${mode === 'letters' ? 'letter' : 'digit'} below` : '✓ matched!'}
      </p>
      <button onClick={switchMode}>switch to {mode === 'letters' ? 'digits' : 'letters'} mode</button>
      <AnyEvent events={events}>
        <input ref={inputRef} placeholder={mode === 'letters' ? 'type a letter (a-z)...' : 'type a digit (0-9)...'} />
      </AnyEvent>
      <EventLog entries={entries} />
    </section>
  );
}

function AsPropDemo() {
  const [tag, setTag] = useState<'span' | 'div'>('span');
  return (
    <section>
      <h2>4. The "as" prop</h2>
      <p>
        <code>&lt;AnyEvent&gt;</code> wraps its children in a <code>&lt;span&gt;</code> by default; <code>as</code> lets you
        pick a different wrapper tag for contexts where a <code>&lt;span&gt;</code> isn't valid markup.
      </p>
      <button onClick={() => setTag((t) => (t === 'span' ? 'div' : 'span'))}>switch wrapper (currently: {tag})</button>
      <AnyEvent id="as-prop-demo" as={tag}>
        <em>wrapped content</em>
      </AnyEvent>
      <OuterHtmlPreview targetId="as-prop-demo" />
    </section>
  );
}

function HookDemo() {
  const { entries, log } = useLog();
  const events = useMemo(
    () => [
      {
        name: 'banana',
        triggerByAttributes: ['value'],
        elementsType: [HTMLInputElement],
        triggerEventFn: () => true,
      },
    ],
    []
  );
  const hookRef = useAnyEvent<HTMLInputElement>(events);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      hookRef(node);
    },
    [hookRef]
  );

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const handler = () => log(`banana fired, value="${input.value}"`);
    input.addEventListener('banana', handler);
    log('mounted — inspect the DOM below, there is no wrapper element');
    return () => input.removeEventListener('banana', handler);
  }, []);

  return (
    <section>
      <h2>5. useAnyEvent hook (no wrapper element)</h2>
      <p>Attach directly as a ref on a single element you already own — no wrapping element at all.</p>
      <input id="hook-input" ref={setRefs} placeholder="type here..." />
      <OuterHtmlPreview targetId="hook-input" />
      <EventLog entries={entries} />
    </section>
  );
}

// The 'ellipsis' event fires when isEllipsis()'s truncation verdict for the
// element *changes* - not on every value change, only on the flip. State is
// tracked on the element itself, same pattern the README's own example uses.
//
// Both triggerByAttributes AND triggerByEvents are needed here, same as the
// README's own example: real keyboard typing never invokes the JS `.value`
// setter at all (the browser sets the underlying value directly), so
// triggerByAttributes alone only ever catches *programmatic* value changes
// (the buttons below). triggerByEvents: ['blur'] is what catches real
// typing - checked once you click/tab away, not on every keystroke, because
// isEllipsis() itself never reports a focused field as truncated: the
// browser scrolls to keep the caret visible instead of drawing the "…"
// while you're actively editing, so there's nothing to re-check yet.
const ellipsisEvents = [
  {
    name: 'ellipsis',
    triggerByAttributes: ['value'],
    triggerByEvents: ['blur'],
    elementsType: [HTMLInputElement],
    triggerEventFn: function (this: EventTarget) {
      const el = this as HTMLInputElement;
      const current = !!isEllipsis(el, true, Boolean);
      const previous = (el as any).__ellipsisState === true;
      (el as any).__ellipsisState = current;
      return current !== previous;
    },
  },
];

function EllipsisDemo() {
  const { entries, log } = useLog();
  const [truncated, setTruncated] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // react-any-attr, not a JSX `onEllipsis` prop: React only wires up its own
  // known synthetic event names, so a custom `onEllipsis` prop would just be
  // silently dropped. `asObject` sets it as a plain `node.onEllipsis`
  // property instead - which is exactly what AnyEvent's dispatch looks for.
  const onEllipsis = () => {
    const input = inputRef.current;
    if (!input) return;
    const isTruncated = !!isEllipsis(input, true, Boolean);
    setTruncated(isTruncated);
    log(`ellipsis fired — now ${isTruncated ? 'truncated' : 'not truncated'}`);
  };

  return (
    <section>
      <h2>6. isellipsis + react-any-attr: a real "onEllipsis" event</h2>
      <p>
        <code>isellipsis</code> reports whether an element is <em>currently displaying</em> an ellipsis — not merely
        whether its content would overflow: a focused field never is (the browser scrolls to keep the caret visible
        instead of drawing "…" while you're editing), so it correctly says "no" the whole time you're typing.{' '}
        <code>&lt;AnyEvent&gt;</code> turns that into a real <code>ellipsis</code> event that only fires when the
        verdict actually flips; and <code>react-any-attr</code>'s <code>&lt;AnyAttribute&gt;</code>/<code>asObject</code>{' '}
        is what lets you attach it as <code>onEllipsis</code> in the first place.
      </p>
      <p className="hint">
        Type past the edge, then click/tab away — that's the moment it re-checks and the "…" (and the event) actually
        appear. The buttons re-check immediately instead, since they set <code>.value</code> programmatically.
      </p>
      <AnyEvent events={ellipsisEvents}>
        <AnyAttribute attributes={{ onEllipsis: asObject(onEllipsis) }}>
          <input
            ref={inputRef}
            defaultValue="short text"
            className={`ellipsis-input ${truncated ? 'truncated' : ''}`}
          />
        </AnyAttribute>
      </AnyEvent>
      <div>
        <button
          onClick={() => {
            if (inputRef.current) inputRef.current.value = 'short text';
          }}
        >
          Set short text
        </button>
        <button
          onClick={() => {
            if (inputRef.current) inputRef.current.value = 'a fairly long sentence that will not fit in this box';
          }}
        >
          Set long text
        </button>
      </div>
      <p className={`status status-${truncated ? 'alert' : 'waiting'}`}>
        {truncated ? '✂️ truncated (ellipsis showing)' : 'not truncated'}
      </p>
      <EventLog entries={entries} />
    </section>
  );
}

// Native mouseenter/mousemove fire the instant the cursor crosses an
// element's *outer* edge - padding included. This computes the actual
// content box (border + padding subtracted from the element's rect) on
// every move, so mouseContentEnter/Leave only fire when the cursor crosses
// into/out of where the content itself actually is: exactly the kind of
// element *behavior* - like whether text is truncated - that has no native
// event of its own.
function isInsideContentBox(el: HTMLElement, event: Event): boolean {
  if (event.type === 'mouseleave') return false;
  const { clientX, clientY } = event as MouseEvent;
  const rect = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const left = rect.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
  const right = rect.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
  const top = rect.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop);
  const bottom = rect.bottom - parseFloat(cs.borderBottomWidth) - parseFloat(cs.paddingBottom);
  return clientX >= left && clientX <= right && clientY >= top && clientY <= bottom;
}

const mouseContentEvents = [
  {
    name: 'mouseContentEnter',
    triggerByEvents: ['mousemove'],
    elementsType: [HTMLElement],
    triggerEventFn: function (this: EventTarget, event: Event) {
      const el = this as HTMLElement;
      const inside = isInsideContentBox(el, event);
      const was = (el as any).__insideContent === true;
      if (inside && !was) {
        (el as any).__insideContent = true;
        return true;
      }
      return false;
    },
  },
  {
    name: 'mouseContentLeave',
    triggerByEvents: ['mousemove', 'mouseleave'],
    elementsType: [HTMLElement],
    triggerEventFn: function (this: EventTarget, event: Event) {
      const el = this as HTMLElement;
      const inside = isInsideContentBox(el, event);
      const was = (el as any).__insideContent === true;
      if (!inside && was) {
        (el as any).__insideContent = false;
        return true;
      }
      return false;
    },
  },
];

function MouseContentEnterDemo() {
  const { entries, log } = useLog();
  const [inside, setInside] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const onEnter = () => {
      log('mouseContentEnter fired');
      setInside(true);
    };
    const onLeave = () => {
      log('mouseContentLeave fired');
      setInside(false);
    };
    box.addEventListener('mouseContentEnter', onEnter);
    box.addEventListener('mouseContentLeave', onLeave);
    return () => {
      box.removeEventListener('mouseContentEnter', onEnter);
      box.removeEventListener('mouseContentLeave', onLeave);
    };
  }, []);

  return (
    <section>
      <h2>7. A custom "mouseContentEnter"/"mouseContentLeave" pair</h2>
      <p>
        The dashed line marks the content box (padding excluded). Native <code>mouseenter</code> would fire the moment you
        cross the outer (solid) edge; this only fires when you cross the dashed one.
      </p>
      <AnyEvent events={mouseContentEvents}>
        <div ref={boxRef} className={`content-box-demo ${inside ? 'inside' : ''}`}>
          hover the dashed line
        </div>
      </AnyEvent>
      <p className={`status status-${inside ? 'matched' : 'waiting'}`}>{inside ? '✓ inside content box' : 'outside content box'}</p>
      <EventLog entries={entries} />
    </section>
  );
}

export default function App() {
  return (
    <main>
      <h1>react-any-event playground</h1>
      <ProgrammaticChangeDemo />
      <NativeEventDemo />
      <ReactiveDemo />
      <AsPropDemo />
      <HookDemo />
      <EllipsisDemo />
      <MouseContentEnterDemo />
      <style>{`
        :root { color-scheme: dark; }
        body { font-family: system-ui, sans-serif; margin: 0; background: #14161a; color: #e4e6eb; }
        main { max-width: 640px; margin: 2rem auto; padding: 0 1rem; }
        h1, h2 { color: #f5f6f8; }
        code { background: #23262d; padding: .1rem .3rem; border-radius: 4px; }
        .hint { color: #8a8f99; font-size: .85rem; }
        section { margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #2c2f36; }
        .preview { display: block; background: #0a0b0d; color: #7fdc7f; padding: .75rem; border-radius: 6px; margin-top: .5rem; white-space: pre-wrap; word-break: break-all; font-size: .85rem; }
        .status { display: inline-block; padding: .3rem .6rem; border-radius: 6px; font-size: .9rem; }
        .status-waiting { background: #2c2f36; color: #b8bcc4; }
        .status-matched { background: #1e3a24; color: #7fdc7f; }
        .status-alert { background: #3a1e1e; color: #dc7f7f; }
        button { margin: .5rem 0; background: #2c2f36; color: #e4e6eb; border: 1px solid #3d4149; border-radius: 6px; padding: .4rem .8rem; cursor: pointer; }
        button:hover { background: #3d4149; }
        input { background: #23262d; color: #e4e6eb; border: 1px solid #3d4149; border-radius: 4px; padding: .3rem .5rem; }
        .ellipsis-input { width: 180px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; transition: border-color .15s; }
        .ellipsis-input.truncated { border-color: #dc7f7f; }
        .content-box-demo { width: 260px; padding: 40px; margin: .5rem 0; background: #1c1f26; border: 2px solid #3d4149; outline: 1px dashed #565b66; outline-offset: -40px; text-align: center; transition: background .15s, border-color .15s; }
        .content-box-demo.inside { border-color: #7fdc7f; background: #16241a; }
      `}</style>
    </main>
  );
}
