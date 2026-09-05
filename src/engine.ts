import { toCamelCase } from './camelCase';
import { AnyElementConstructor, IAnyEvent, IAnyWrapEventFn, IConfig, IConfigObject } from './module';

// Looks up a property descriptor along the prototype chain instead of only
// on the instance. Almost every interesting DOM property (value, checked,
// selected, ...) is an accessor defined on the *prototype*
// (e.g. HTMLInputElement.prototype), never as an own property of the
// element instance. Looking only at the instance (the previous behavior)
// always came back empty, so the "real" native getter/setter was never
// found - and never called - which silently broke the very feature this
// package leads with: detecting *programmatic* changes to a property such
// as `.value` without breaking the property itself.
function findPropertyDescriptor(instance: unknown, propName: string): PropertyDescriptor | undefined {
    let target = instance;
    while (target) {
        const descriptor = Object.getOwnPropertyDescriptor(target, propName);
        if (descriptor) return descriptor;
        target = Object.getPrototypeOf(target);
    }
    return undefined;
}

// Wraps triggerEventFn so the resulting function's `.name` is the event
// name (observerOnEvent uses it to build "onBanana"/dispatch "banana").
// A previous version used `new Function(...)` to achieve this, which
// throws under any CSP that disallows `unsafe-eval`. Defining `name`
// directly does the same thing without eval.
function wrapTriggerEventFn(event: IAnyEvent): IAnyWrapEventFn {
    const wrapped: IAnyWrapEventFn = function (target, evt, propName) {
        return event.triggerEventFn.call(target, evt, propName);
    };
    Object.defineProperty(wrapped, 'name', { value: event.name, configurable: true });
    return wrapped;
}

export function buildConfig(events: IAnyEvent[] | undefined): IConfig {
    const attrMapping: IConfigObject = {};
    const eventMapping: IConfigObject = {};

    const configEntities = (event: IAnyEvent, configObj: IConfigObject, propNames: string[]) => {
        const wrapped = wrapTriggerEventFn(event);
        const elementTypes = ([] as AnyElementConstructor[]).concat(event.elementsType || HTMLElement);
        propNames.forEach((name) => {
            if (!configObj[name]) configObj[name] = new Map();
            elementTypes.forEach((elementType) => {
                if (!configObj[name].has(elementType)) configObj[name].set(elementType, []);
                configObj[name].get(elementType)!.push(wrapped);
            });
        });
    };
    (events || []).forEach((event) => {
        if (!event) return;
        configEntities(event, attrMapping, event.triggerByAttributes || []);
        configEntities(event, eventMapping, event.triggerByEvents || []);
    });
    return { attrMapping, eventMapping };
}

export function buildObserverConfig(events: IAnyEvent[] | undefined): MutationObserverInit {
    return {
        attributeFilter: (events || []).flatMap((event) => event?.triggerByAttributes || []),
        childList: true,
        // Always observed at the full-document level, independent of the
        // `subtree` prop: per the MutationObserver spec, `attributes: true`
        // with `subtree: false` only reports attribute mutations on the
        // observed node *itself* - never on any of its children. Without
        // this, triggerByAttributes would never fire for a direct child (the
        // primary documented use case - wrapping a single <input>) unless
        // `subtree` was also set, which nothing in the README asks for.
        // `isInScope` below re-applies what the `subtree` prop actually
        // means (direct children only vs. the whole tree).
        subtree: true,
        attributes: true,
        attributeOldValue: true,
    };
}

/**
 * Framework-agnostic engine behind both <AnyEvent> and useAnyEvent(): builds
 * the attribute/event config, instruments matching DOM nodes, and observes
 * a root node for further mutations. Kept independent of React so it can be
 * unit-tested directly and shared by both entry points.
 */
export class AnyEventEngine {
    config: IConfig = { attrMapping: {}, eventMapping: {} };
    private root: Node | null = null;
    private subtree = false;
    private observer: MutationObserver | null = null;
    // Whether `root` itself gets instrumented, or only its children.
    // <AnyEvent> wraps a <span> around its targets, so only the span's
    // *children* should ever be instrumented (matches what the observer
    // sees for later childList mutations too). useAnyEvent() refs the
    // target element directly, so that element itself is the one to
    // instrument.
    private includeRoot = false;
    // Tracks what's already been instrumented per node, so re-walking a
    // subtree (on every mutation batch, and again whenever `events`/
    // `subtree` change) never re-defines a property or double-registers an
    // event listener.
    private instrumented = new WeakMap<Node, Set<string>>();

    // For <AnyEvent>: root is the wrapper element, only its children (and,
    // if subtree, their descendants) are instrumented.
    observe(root: Node, events: IAnyEvent[] | undefined, subtree: boolean | undefined) {
        this.start(root, events, subtree, false);
    }

    // For useAnyEvent(): target is the element itself, refed directly with
    // no wrapper - so it (and, if subtree, its descendants) is instrumented.
    observeElement(target: Node, events: IAnyEvent[] | undefined, subtree: boolean | undefined) {
        this.start(target, events, subtree, true);
    }

    // Rebuilds config/observer in place, e.g. when the `events` or
    // `subtree` prop changes on an already-mounted <AnyEvent>. Previously
    // config was only ever built once (in the constructor), so prop
    // changes were silently ignored.
    update(events: IAnyEvent[] | undefined, subtree: boolean | undefined) {
        if (!this.root) return;
        this.start(this.root, events, subtree, this.includeRoot);
    }

    private start(root: Node, events: IAnyEvent[] | undefined, subtree: boolean | undefined, includeRoot: boolean) {
        this.root = root;
        this.subtree = !!subtree;
        this.includeRoot = includeRoot;
        this.config = buildConfig(events);
        this.observer?.disconnect();
        if (includeRoot) {
            this.walk(root);
        }
        else {
            root.childNodes.forEach((child) => this.walk(child));
        }
        this.observer = new MutationObserver(this.observerCallback);
        this.observer.observe(root, buildObserverConfig(events));
    }

    disconnect() {
        this.observer?.disconnect();
        this.observer = null;
        this.root = null;
    }

    // Reimplements what the `subtree` prop actually means, now that the
    // underlying MutationObserver is always observed with its own
    // subtree:true (see buildObserverConfig): with `allowDirectChild`, a
    // direct child of `root` (as well as `root` itself) counts even when
    // `subtree` is off - used for attribute mutations, since a direct
    // child's *own* attributes are always in scope. Without it, only
    // `root` itself (or, with `subtree` on, anything under it) counts -
    // used for childList mutations, so a grandchild's child list changing
    // doesn't get walked when `subtree` is off.
    // Only ever called from observerCallback, itself only reachable while
    // `root` is set (disconnect() stops the observer and clears it in the
    // same synchronous step, so no more-queued callback can run after).
    private isInScope(node: Node, allowDirectChild: boolean): boolean {
        const root = this.root as Node;
        if (this.subtree) return node === root || root.contains(node);
        return node === root || (allowDirectChild && node.parentNode === root);
    }

    private mark(node: Node, key: string): boolean {
        let keys = this.instrumented.get(node);
        if (!keys) {
            keys = new Set();
            this.instrumented.set(node, keys);
        }
        if (keys.has(key)) return false;
        keys.add(key);
        return true;
    }

    private modifyNodeProp(htmlElement: Node, propName: string) {
        if (!this.mark(htmlElement, `attr:${propName}`)) return;

        const descriptor = findPropertyDescriptor(htmlElement, propName);
        const superSet = descriptor?.set;
        const superGet = descriptor?.get;

        try {
            Object.defineProperty(htmlElement, propName, {
                configurable: true,
                get() {
                    return superGet ? superGet.call(this) : (this as Element).getAttribute(propName);
                },
                set(newValue: any) {
                    if (superSet) superSet.call(this, newValue);
                    // Always mirrored onto the attribute too (even when a
                    // native setter exists): this is the signal channel the
                    // MutationObserver below actually watches.
                    (this as Element).setAttribute(propName, newValue);
                },
            });
        }
        catch {
            // A handful of platform properties are genuinely
            // non-configurable; leave them uninstrumented rather than crash.
        }
    }

    private addDelegatedListener(node: Element, eventName: string) {
        if (!this.mark(node, `event:${eventName}`)) return;
        node.addEventListener(eventName, (event: Event) => {
            const elementTypesMap = this.config.eventMapping[eventName];
            if (!elementTypesMap) return;
            for (const [elementType, fns] of elementTypesMap) {
                if (node instanceof elementType) {
                    // `node` is where this listener was added and dispatched
                    // on directly (no delegation), so it's always the event's
                    // target too.
                    fns.forEach((fn) => this.observerOnEvent(fn, node, event, eventName));
                }
            }
        });
    }

    private observerOnEvent(triggerEventFn: IAnyWrapEventFn, target: EventTarget, sourceEvent: Event | null, propName: string) {
        // The triggering condition function is given the real source event
        // when there is one (e.g. the native 'keyup' that triggered this),
        // so it can inspect it if useful.
        const eventForCondition = sourceEvent || new Event(triggerEventFn.name);
        if (!triggerEventFn.call(null, target, eventForCondition, propName)) return;

        // The event actually dispatched/handed to on<Name> is always a
        // fresh event named after the custom event itself - regardless of
        // whether this fired from an attribute mutation or a real DOM
        // event - so `target.addEventListener(customName, ...)` reliably
        // works either way, matching what the README promises.
        const dispatchedEvent = new Event(triggerEventFn.name);
        target.dispatchEvent(dispatchedEvent);

        const onEventName = `on${triggerEventFn.name}`;
        const camelOnEventName = toCamelCase(`on ${triggerEventFn.name}`);
        const anyTarget = target as any;
        const targetOnEvent = anyTarget[onEventName] || anyTarget[camelOnEventName];
        targetOnEvent?.(dispatchedEvent);
    }

    private walk = (node: Node) => {
        if (node.nodeType !== 1) return;
        const { attrMapping, eventMapping } = this.config;

        for (const [attrName, elementTypesMap] of Object.entries(attrMapping)) {
            for (const elementType of elementTypesMap.keys()) {
                if (node instanceof elementType) this.modifyNodeProp(node, attrName);
            }
        }
        for (const [eventName, elementTypesMap] of Object.entries(eventMapping)) {
            for (const elementType of elementTypesMap.keys()) {
                if (node instanceof elementType) {
                    this.addDelegatedListener(node as Element, eventName);
                    break;
                }
            }
        }
        if (this.subtree) {
            node.childNodes.forEach((child) => this.walk(child));
        }
    };

    private observerCallback = (mutationRecords: MutationRecord[]) => {
        const { attrMapping } = this.config;

        for (const mutation of mutationRecords) {
            if (mutation.type === 'attributes' && this.isInScope(mutation.target, true)) {
                // attributeName is always set for 'attributes' mutations, and
                // the observer's attributeFilter (buildObserverConfig) is
                // built from the very same events as attrMapping, so a
                // reported attribute always has a matching entry here.
                const attributeName = mutation.attributeName as string;
                const elementTypesMap = attrMapping[attributeName]!;

                // Some environments report the same attribute mutation
                // twice; a shadow "old value" is tracked per node to
                // dedupe those before re-firing.
                const oldValueKey = toCamelCase(`old ${attributeName}`);
                const target = mutation.target as any;
                if (target[oldValueKey] !== target[attributeName]) {
                    for (const [elementType, fns] of elementTypesMap) {
                        if (mutation.target instanceof elementType) {
                            fns.forEach((fn) => this.observerOnEvent(fn, mutation.target, null, attributeName));
                        }
                    }
                }
                target[oldValueKey] = target[attributeName];
            }
            if (this.isInScope(mutation.target, false)) {
                mutation.addedNodes.forEach((node) => this.walk(node));
            }
        }
    };
}
