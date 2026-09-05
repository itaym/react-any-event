import { AnyEventEngine } from '../engine';

function makeContainer() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    return container;
}

async function flush() {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('AnyEventEngine', () => {
    test('regression: triggerByAttributes fires on a direct child even with subtree=false (README Example 1)', async () => {
        // Per the MutationObserver spec, `attributes: true` with
        // `subtree: false` only reports mutations on the observed node
        // itself, never its children - so without correcting for that, this
        // never fires for the primary documented use case (wrapping a
        // single direct-child <input>, no `subtree` prop set).
        const container = makeContainer();
        const input = document.createElement('input');
        container.appendChild(input);
        const trigger = jest.fn(() => true);

        const engine = new AnyEventEngine();
        engine.observe(
            container,
            [{ name: 'banana', triggerByAttributes: ['value'], elementsType: [HTMLInputElement], triggerEventFn: trigger }],
            false
        );

        input.value = 'banana';
        await flush();

        expect(trigger).toHaveBeenCalled();
        engine.disconnect();
        container.remove();
    });

    test('subtree=false: an attribute mutation on a grandchild does not fire', async () => {
        const container = makeContainer();
        const wrapper = document.createElement('div');
        const input = document.createElement('input');
        container.appendChild(wrapper);
        wrapper.appendChild(input);
        const trigger = jest.fn(() => true);

        const engine = new AnyEventEngine();
        engine.observe(
            container,
            [{ name: 'banana', triggerByAttributes: ['value'], elementsType: [HTMLInputElement], triggerEventFn: trigger }],
            false
        );

        input.value = 'banana';
        await flush();

        expect(trigger).not.toHaveBeenCalled();
        engine.disconnect();
        container.remove();
    });

    test('subtree=false: a node inserted deep in the tree (not a direct child) is not walked', async () => {
        const container = makeContainer();
        const wrapper = document.createElement('div');
        container.appendChild(wrapper);
        const trigger = jest.fn(() => true);

        const engine = new AnyEventEngine();
        engine.observe(
            container,
            [{ name: 'banana', triggerByAttributes: ['value'], elementsType: [HTMLInputElement], triggerEventFn: trigger }],
            false
        );

        const input = document.createElement('input');
        wrapper.appendChild(input);
        await flush();
        input.value = 'banana';
        await flush();

        expect(trigger).not.toHaveBeenCalled();
        engine.disconnect();
        container.remove();
    });

    test('subtree=true: a node inserted deep in the tree is walked and instrumented', async () => {
        const container = makeContainer();
        const wrapper = document.createElement('div');
        container.appendChild(wrapper);
        const trigger = jest.fn(() => true);

        const engine = new AnyEventEngine();
        engine.observe(
            container,
            [{ name: 'banana', triggerByAttributes: ['value'], elementsType: [HTMLInputElement], triggerEventFn: trigger }],
            true
        );

        const input = document.createElement('input');
        wrapper.appendChild(input);
        await flush();
        input.value = 'banana';
        await flush();

        expect(trigger).toHaveBeenCalled();
        engine.disconnect();
        container.remove();
    });

    test('a mutation delivered after disconnect() (already queued) does not throw', async () => {
        const container = makeContainer();
        const input = document.createElement('input');
        container.appendChild(input);
        const trigger = jest.fn(() => true);

        const engine = new AnyEventEngine();
        engine.observe(
            container,
            [{ name: 'banana', triggerByAttributes: ['value'], elementsType: [HTMLInputElement], triggerEventFn: trigger }],
            false
        );

        input.value = 'banana';
        engine.disconnect();
        await expect(flush()).resolves.not.toThrow();

        container.remove();
    });

    test('defaults elementsType to HTMLElement when omitted, and ignores falsy entries in events', () => {
        const container = makeContainer();
        const input = document.createElement('input');
        container.appendChild(input);
        const trigger = jest.fn(() => true);

        const engine = new AnyEventEngine();
        expect(() =>
            engine.observe(
                container,
                [undefined as any, { name: 'banana', triggerByEvents: ['keyup'], triggerEventFn: trigger }],
                true
            )
        ).not.toThrow();
        input.dispatchEvent(new Event('keyup'));

        expect(trigger).toHaveBeenCalledTimes(1);
        engine.disconnect();
        container.remove();
    });

    test('regression: property access delegates to the real native accessor, not just the mirrored attribute', () => {
        const container = makeContainer();
        const input = document.createElement('input');
        container.appendChild(input);
        const setSpy = jest.spyOn(HTMLInputElement.prototype, 'value', 'set');
        const getSpy = jest.spyOn(HTMLInputElement.prototype, 'value', 'get');

        const engine = new AnyEventEngine();
        engine.observe(
            container,
            [{ name: 'banana', triggerByAttributes: ['value'], elementsType: [HTMLInputElement], triggerEventFn: () => true }],
            true
        );

        input.value = 'hello';
        expect(setSpy).toHaveBeenCalledWith('hello');
        expect(input.value).toBe('hello');
        expect(getSpy).toHaveBeenCalled();

        setSpy.mockRestore();
        getSpy.mockRestore();
        engine.disconnect();
        container.remove();
    });

    test('setting an instrumented property fires the configured event through the mirrored attribute mutation', async () => {
        const container = makeContainer();
        const input = document.createElement('input');
        container.appendChild(input);
        const trigger = jest.fn(() => true);

        const engine = new AnyEventEngine();
        engine.observe(
            container,
            [{ name: 'banana', triggerByAttributes: ['value'], elementsType: [HTMLInputElement], triggerEventFn: trigger }],
            true
        );

        input.value = 'banana';
        await flush();

        expect(trigger).toHaveBeenCalled();
        engine.disconnect();
        container.remove();
    });

    test('a non-standard property (no native accessor) round-trips through the attribute', () => {
        const container = makeContainer();
        const input = document.createElement('input');
        container.appendChild(input);

        const engine = new AnyEventEngine();
        engine.observe(
            container,
            [{ name: 'banana', triggerByAttributes: ['secondValue'], elementsType: [HTMLInputElement], triggerEventFn: () => true }],
            true
        );

        (input as any).secondValue = 'banana';
        expect((input as any).secondValue).toBe('banana');
        expect(input.getAttribute('secondValue')).toBe('banana');

        engine.disconnect();
        container.remove();
    });

    test('walking the same node twice (e.g. via update()) does not register duplicate event listeners or redefine properties', async () => {
        const container = makeContainer();
        const input = document.createElement('input');
        container.appendChild(input);
        const trigger = jest.fn(() => true);
        const events = [
            {
                name: 'banana',
                triggerByAttributes: ['value'],
                triggerByEvents: ['keyup'],
                elementsType: [HTMLInputElement],
                triggerEventFn: trigger,
            },
        ];

        const engine = new AnyEventEngine();
        engine.observe(container, events, true);
        engine.update(events, true);
        input.dispatchEvent(new Event('keyup'));
        expect(trigger).toHaveBeenCalledTimes(1);

        trigger.mockClear();
        (input as any).value = 'banana';
        await flush();
        expect(trigger).toHaveBeenCalledTimes(1);

        engine.disconnect();
        container.remove();
    });

    test('a listener left registered for an event name that update() removed from the config becomes a no-op', () => {
        const container = makeContainer();
        const input = document.createElement('input');
        container.appendChild(input);
        const trigger = jest.fn(() => true);

        const engine = new AnyEventEngine();
        engine.observe(
            container,
            [{ name: 'banana', triggerByEvents: ['keyup'], elementsType: [HTMLInputElement], triggerEventFn: trigger }],
            true
        );
        engine.update(
            [{ name: 'banana', triggerByAttributes: ['value'], elementsType: [HTMLInputElement], triggerEventFn: trigger }],
            true
        );

        expect(() => input.dispatchEvent(new Event('keyup'))).not.toThrow();
        expect(trigger).not.toHaveBeenCalled();

        engine.disconnect();
        container.remove();
    });

    test('update() before observe() is a no-op; disconnect() before observe() does not throw', () => {
        const engine = new AnyEventEngine();
        expect(() => engine.update([], false)).not.toThrow();
        expect(() => engine.disconnect()).not.toThrow();
    });

    test('a plain childList mutation with no attribute change does not misfire attribute-triggered events', async () => {
        const container = makeContainer();
        const trigger = jest.fn(() => true);

        const engine = new AnyEventEngine();
        engine.observe(
            container,
            [{ name: 'banana', triggerByAttributes: ['value'], elementsType: [HTMLInputElement], triggerEventFn: trigger }],
            true
        );

        const laterInput = document.createElement('input');
        container.appendChild(laterInput);
        await flush();

        expect(trigger).not.toHaveBeenCalled();
        engine.disconnect();
        container.remove();
    });

    test('nodes added to the tree after observe() has started are instrumented too', async () => {
        const container = makeContainer();
        const trigger = jest.fn(() => true);

        const engine = new AnyEventEngine();
        engine.observe(
            container,
            [{ name: 'banana', triggerByAttributes: ['value'], elementsType: [HTMLInputElement], triggerEventFn: trigger }],
            true
        );

        const laterInput = document.createElement('input');
        container.appendChild(laterInput);
        await flush();
        laterInput.value = 'banana';
        await flush();

        expect(trigger).toHaveBeenCalled();
        engine.disconnect();
        container.remove();
    });

    test('a repeated mutation to the same value is only reported once (environment dedup)', async () => {
        const container = makeContainer();
        const input = document.createElement('input');
        container.appendChild(input);
        const trigger = jest.fn(() => true);

        const engine = new AnyEventEngine();
        engine.observe(
            container,
            [{ name: 'banana', triggerByAttributes: ['value'], elementsType: [HTMLInputElement], triggerEventFn: trigger }],
            true
        );

        input.setAttribute('value', 'banana');
        input.setAttribute('value', 'banana');
        await flush();

        expect(trigger).toHaveBeenCalledTimes(1);
        engine.disconnect();
        container.remove();
    });

    test('an attribute mutation on a node only fires events whose elementsType actually matches it', async () => {
        const container = makeContainer();
        const input = document.createElement('input');
        container.appendChild(input);
        const inputTrigger = jest.fn(() => true);
        const textareaTrigger = jest.fn(() => true);

        const engine = new AnyEventEngine();
        engine.observe(
            container,
            [
                { name: 'a', triggerByAttributes: ['value'], elementsType: [HTMLInputElement], triggerEventFn: inputTrigger },
                { name: 'b', triggerByAttributes: ['value'], elementsType: [HTMLTextAreaElement], triggerEventFn: textareaTrigger },
            ],
            true
        );

        (input as any).value = 'banana';
        await flush();

        expect(inputTrigger).toHaveBeenCalled();
        expect(textareaTrigger).not.toHaveBeenCalled();
        engine.disconnect();
        container.remove();
    });

    test('a native DOM event on a node only fires events whose elementsType actually matches it', () => {
        const container = makeContainer();
        const input = document.createElement('input');
        container.appendChild(input);
        const inputTrigger = jest.fn(() => true);
        const textareaTrigger = jest.fn(() => true);

        const engine = new AnyEventEngine();
        engine.observe(
            container,
            [
                { name: 'a', triggerByEvents: ['keyup'], elementsType: [HTMLInputElement], triggerEventFn: inputTrigger },
                { name: 'b', triggerByEvents: ['keyup'], elementsType: [HTMLTextAreaElement], triggerEventFn: textareaTrigger },
            ],
            true
        );

        input.dispatchEvent(new Event('keyup'));

        expect(inputTrigger).toHaveBeenCalled();
        expect(textareaTrigger).not.toHaveBeenCalled();
        engine.disconnect();
        container.remove();
    });

    test('update() picks up newly added events on already-mounted nodes', () => {
        const container = makeContainer();
        const input = document.createElement('input');
        container.appendChild(input);
        const trigger = jest.fn(() => true);

        const engine = new AnyEventEngine();
        engine.observe(container, [], true);
        engine.update(
            [{ name: 'banana', triggerByEvents: ['keyup'], elementsType: [HTMLInputElement], triggerEventFn: trigger }],
            true
        );
        input.dispatchEvent(new Event('keyup'));

        expect(trigger).toHaveBeenCalledTimes(1);
        engine.disconnect();
        container.remove();
    });

    test('two separate events targeting the same attribute + element type both fire', async () => {
        const container = makeContainer();
        const input = document.createElement('input');
        container.appendChild(input);
        const first = jest.fn(() => true);
        const second = jest.fn(() => true);

        const engine = new AnyEventEngine();
        engine.observe(
            container,
            [
                { name: 'a', triggerByAttributes: ['value'], elementsType: [HTMLInputElement], triggerEventFn: first },
                { name: 'b', triggerByAttributes: ['value'], elementsType: [HTMLInputElement], triggerEventFn: second },
            ],
            true
        );

        (input as any).value = 'banana';
        await flush();
        expect(first).toHaveBeenCalled();
        expect(second).toHaveBeenCalled();

        engine.disconnect();
        container.remove();
    });

    test('ignores non-element nodes (e.g. text nodes) and non-matching element types', () => {
        const container = makeContainer();
        container.appendChild(document.createTextNode('not an element'));
        const div = document.createElement('div');
        container.appendChild(div);
        const trigger = jest.fn(() => true);

        const engine = new AnyEventEngine();
        expect(() =>
            engine.observe(
                container,
                [{ name: 'banana', triggerByEvents: ['keyup'], elementsType: [HTMLInputElement], triggerEventFn: trigger }],
                true
            )
        ).not.toThrow();
        div.dispatchEvent(new Event('keyup'));
        expect(trigger).not.toHaveBeenCalled();

        engine.disconnect();
        container.remove();
    });

    test('calls the target\'s on<Name> handler, and falls back to a camelCase name', () => {
        const container = makeContainer();
        const input = document.createElement('input');
        container.appendChild(input);

        const plainHandler = jest.fn();
        (input as any).onbanana = plainHandler;
        const engine = new AnyEventEngine();
        engine.observe(
            container,
            [{ name: 'banana', triggerByEvents: ['keyup'], elementsType: [HTMLInputElement], triggerEventFn: () => true }],
            true
        );
        input.dispatchEvent(new Event('keyup'));
        expect(plainHandler).toHaveBeenCalledTimes(1);

        const camelInput = document.createElement('input');
        container.appendChild(camelInput);
        const camelHandler = jest.fn();
        (camelInput as any).onMyEvent = camelHandler;
        const engine2 = new AnyEventEngine();
        engine2.observe(
            container,
            [{ name: 'my-event', triggerByEvents: ['keyup'], elementsType: [HTMLInputElement], triggerEventFn: () => true }],
            true
        );
        camelInput.dispatchEvent(new Event('keyup'));
        expect(camelHandler).toHaveBeenCalledTimes(1);

        engine.disconnect();
        engine2.disconnect();
        container.remove();
    });

    test('leaves a non-configurable property alone instead of crashing', () => {
        const container = makeContainer();
        const input = document.createElement('input');
        Object.defineProperty(input, 'locked', { value: 'frozen', configurable: false });
        container.appendChild(input);

        const engine = new AnyEventEngine();
        expect(() =>
            engine.observe(
                container,
                [{ name: 'banana', triggerByAttributes: ['locked'], elementsType: [HTMLInputElement], triggerEventFn: () => true }],
                true
            )
        ).not.toThrow();
        expect((input as any).locked).toBe('frozen');

        engine.disconnect();
        container.remove();
    });

    test('disconnect() stops the underlying MutationObserver', () => {
        const container = makeContainer();
        const disconnectSpy = jest.spyOn(MutationObserver.prototype, 'disconnect');

        const engine = new AnyEventEngine();
        engine.observe(container, [], false);
        engine.disconnect();

        expect(disconnectSpy).toHaveBeenCalled();
        disconnectSpy.mockRestore();
        container.remove();
    });
});
