# Changelog

## 2.0.0

### Fixed
- `camelcase` was imported by the library but never declared as a
  dependency (`package.json` had `"dependencies": {}`); it only resolved in
  this repo by accident, via a hoisted, unrelated devDependency of Jest. A
  real install of the published package would crash with `Cannot find
  module 'camelcase'`. The dependency is now removed entirely and replaced
  with a 3-line inlined helper.
- The property-instrumentation used to detect *programmatic* changes
  (`triggerByAttributes`) looked up the native getter/setter only on the
  element instance (`Object.getOwnPropertyDescriptor(htmlElement, propName)`).
  Almost every interesting DOM property (`value`, `checked`, `selected`, ...)
  is actually an accessor on the *prototype*, so this always came back empty
  in every browser and in jsdom - the real native setter was never found or
  called, silently degrading the property to attribute-only storage. This
  broke exactly the scenario Example 1 in the README demonstrates. Fixed by
  walking the prototype chain.
- `triggerByEvents`-triggered events (a native DOM event like `keyup`
  driving the check) never actually dispatched the configured custom event -
  only an `on<Name>` property handler (if one was set) was called. Fixed:
  a fresh, properly-named event is now always dispatched, so
  `target.addEventListener('yourEventName', ...)` (the primary pattern the
  README documents) works consistently regardless of what triggered it.
- Removed the dynamic `new Function(...)` used internally to name each
  wrapped trigger function. It breaks under any CSP that disallows
  `unsafe-eval`, and was only ever needed to set `fn.name`, which
  `Object.defineProperty(fn, 'name', { value })` does without eval.
- `<AnyEvent>` hid its children behind a `didMount` gate and only rendered
  them after a second, post-mount render (so the `MutationObserver` could
  "see" them being inserted). This caused a render + visible flash on every
  mount and is fundamentally incompatible with SSR/hydration - server-
  rendered children were always empty on first paint. Children now render
  immediately; `componentDidMount` does one manual instrumentation pass over
  what's already there before starting the observer.
- The `MutationObserver` was never disconnected - it was a local variable in
  `setObserver()`, never stored anywhere reachable. `<AnyEvent>` now
  disconnects it in `componentWillUnmount`.
- Re-walking an already-instrumented node (a mutation batch touching it more
  than once, or a config rebuild) could throw when redefining a
  non-configurable-by-construction property, silently swallowed by a bare
  `try {} catch {}`. Each (node, property/event) pair is now tracked so it's
  only ever instrumented once, and the remaining `catch` only covers
  genuinely non-configurable platform properties.
- The giant, hand-maintained `IAnyElement` union of every HTML element
  constructor is replaced with a single structural type
  (`new (...args: any[]) => Element`), removing an ~80-line maintenance
  burden and any future gaps in it.
- `triggerByAttributes` never actually fired for a direct child unless
  `subtree` was also set to `true` - including in the README's own primary
  example, which doesn't set it. Per the `MutationObserver` spec,
  `attributes: true` with `subtree: false` only reports attribute mutations
  on the *observed node itself*, never its children; the `subtree` prop was
  wired straight into `MutationObserverInit.subtree`, so without it, a
  wrapped `<input>` (a direct child of the `<span>` `<AnyEvent>` renders)
  never had its attribute mutations reported at all. The observer now always
  watches the full subtree at the DOM level, and `subtree`'s documented
  meaning ("direct children only" vs. "everything in the tree") is
  reapplied on top of that when deciding which mutations to act on.

### Added
- `useAnyEvent(events, subtree?)` hook: an alternative to `<AnyEvent>` that
  returns a ref callback, for attaching events to a single already-owned
  element without the wrapping `<span>` (which isn't valid markup in
  contexts like `<tr>`/`<select>`, and is unwanted noise in flex/grid
  layouts).
- `as` prop on `<AnyEvent>`: configures the wrapper element tag (default
  `'span'`).
- `events` and `subtree` are now reactive: changing either prop on an
  already-mounted `<AnyEvent>` rebuilds its configuration and observer in
  place. Previously the config was only ever built once, in the
  constructor.
- ESM build output (`lib/esm`), exposed via the `module` field and an
  `exports` map, alongside the existing CommonJS build.
- `peerDependencies` on `react`/`react-dom`
  (`^16.3.0 || ^17.0.0 || ^18.0.0 || ^19.0.0`).
- CI workflow (build, lint, test on Node 20/22).
- `playground/` - a small Vite app for interactively trying the library
  (`npm run playground`), covering all of the above, plus two multi-package
  demos: an `onEllipsis` event built end to end with the real `isellipsis`
  and `react-any-attr` packages (README Example 3, now runnable, not just
  documented), and a new `mouseContentEnter`/`mouseContentLeave` example
  (README Example 4) showing a custom event for an element *behavior* -
  the cursor being over its content box, padding excluded - that has no
  native equivalent.

### Toolchain
- Replaced Enzyme with `@testing-library/react` for tests.
- Replaced `tslint` (deprecated) with ESLint (flat config) + `typescript-eslint`.
- Upgraded `typescript` to `^5.9.3`, `react`/`react-dom` (dev/test target) to
  `^19.2.8`, `jest` to `^30.5.1`.
- Internals split into a framework-agnostic `AnyEventEngine` (`src/engine.ts`),
  shared by both `<AnyEvent>` and `useAnyEvent`, and unit-tested directly.
