import React from 'react';
import { act, render } from '@testing-library/react';
import '@testing-library/jest-dom';
import AnyEvent, { IAnyTriggerEventFn } from '../index';

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

const bananaEventFn: IAnyTriggerEventFn = function (): boolean {
    return (this as HTMLInputElement).value.indexOf('banana') > -1;
};

describe('AnyEvent', () => {
    test('fires a custom event when a matching property is set programmatically', async () => {
        const handler = jest.fn();
        let inputRef: HTMLInputElement | null = null;

        render(
            <AnyEvent
                subtree
                events={[
                    {
                        name: 'banana',
                        triggerByAttributes: ['value'],
                        elementsType: [HTMLInputElement],
                        triggerEventFn: bananaEventFn,
                    },
                ]}
            >
                Not an element node
                <div>
                    <input ref={(node) => { inputRef = node; }} />
                </div>
            </AnyEvent>
        );

        expect(inputRef).toBeInTheDocument();
        inputRef!.addEventListener('banana', handler);
        act(() => {
            inputRef!.value = 'this has banana in it';
        });
        await flush();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(inputRef!.value).toBe('this has banana in it');
    });

    test('fires via a native DOM event (triggerByEvents) and not otherwise', () => {
        const handler = jest.fn();
        let inputRef: HTMLInputElement | null = null;

        render(
            <AnyEvent
                subtree={false}
                events={[
                    {
                        name: 'banana',
                        triggerByEvents: ['keyup'],
                        elementsType: [HTMLInputElement],
                        triggerEventFn: bananaEventFn,
                    },
                ]}
            >
                <input ref={(node) => { inputRef = node; }} />
            </AnyEvent>
        );
        inputRef!.addEventListener('banana', handler);

        act(() => {
            inputRef!.value = 'apple';
            inputRef!.dispatchEvent(new Event('keyup'));
        });
        expect(handler).not.toHaveBeenCalled();

        act(() => {
            inputRef!.value = 'banana bread';
            inputRef!.dispatchEvent(new Event('keyup'));
        });
        expect(handler).toHaveBeenCalledTimes(1);
    });

    test('subtree=false only instruments direct children, not nested ones', async () => {
        const handler = jest.fn();
        let inputRef: HTMLInputElement | null = null;

        render(
            <AnyEvent
                subtree={false}
                events={[
                    {
                        name: 'banana',
                        triggerByAttributes: ['value'],
                        elementsType: [HTMLInputElement],
                        triggerEventFn: bananaEventFn,
                    },
                ]}
            >
                <div>
                    <input ref={(node) => { inputRef = node; }} />
                </div>
            </AnyEvent>
        );
        inputRef!.addEventListener('banana', handler);
        act(() => {
            inputRef!.value = 'banana';
        });
        await flush();

        expect(handler).not.toHaveBeenCalled();
    });

    test('renders children immediately, with no mount-gated flash', () => {
        const { container } = render(
            <AnyEvent>
                <input data-testid="x" />
            </AnyEvent>
        );
        expect(container.querySelector('input')).toBeInTheDocument();
    });

    test('renders without an events prop', () => {
        expect(() =>
            render(
                <AnyEvent>
                    <input />
                </AnyEvent>
            )
        ).not.toThrow();
    });

    test('the "as" prop renders a different wrapper element than the default span', () => {
        const { container } = render(
            <AnyEvent as="div">
                <input />
            </AnyEvent>
        );
        expect(container.firstElementChild?.nodeName).toBe('DIV');
    });

    test('defaults to wrapping children in a span', () => {
        const { container } = render(
            <AnyEvent>
                <input />
            </AnyEvent>
        );
        expect(container.firstElementChild?.nodeName).toBe('SPAN');
    });

    test('re-observes when "as" changes at runtime and swaps the underlying wrapper node', async () => {
        const handler = jest.fn(() => true);
        const events = [
            { name: 'banana', triggerByAttributes: ['value'], elementsType: [HTMLInputElement], triggerEventFn: handler },
        ];
        let inputRef: HTMLInputElement | null = null;

        const { rerender } = render(
            <AnyEvent as="span" subtree events={events}>
                <input ref={(node) => { inputRef = node; }} />
            </AnyEvent>
        );
        rerender(
            <AnyEvent as="div" subtree events={events}>
                <input ref={(node) => { inputRef = node; }} />
            </AnyEvent>
        );

        act(() => {
            inputRef!.value = 'banana';
        });
        await flush();
        expect(handler).toHaveBeenCalled();
    });

    test('reactively rebuilds when the events prop changes on an already-mounted instance', () => {
        const handlerA = jest.fn(() => true);
        const handlerB = jest.fn(() => true);
        let inputRef: HTMLInputElement | null = null;

        const { rerender } = render(
            <AnyEvent
                subtree
                events={[{ name: 'a', triggerByEvents: ['keyup'], elementsType: [HTMLInputElement], triggerEventFn: handlerA }]}
            >
                <input ref={(node) => { inputRef = node; }} />
            </AnyEvent>
        );
        rerender(
            <AnyEvent
                subtree
                events={[{ name: 'b', triggerByEvents: ['keyup'], elementsType: [HTMLInputElement], triggerEventFn: handlerB }]}
            >
                <input ref={(node) => { inputRef = node; }} />
            </AnyEvent>
        );

        act(() => {
            inputRef!.dispatchEvent(new Event('keyup'));
        });
        expect(handlerA).not.toHaveBeenCalled();
        expect(handlerB).toHaveBeenCalled();
    });

    test('reactively rebuilds when only the subtree prop changes', async () => {
        const handler = jest.fn(() => true);
        let inputRef: HTMLInputElement | null = null;
        const events = [
            { name: 'banana', triggerByAttributes: ['value'], elementsType: [HTMLInputElement], triggerEventFn: handler },
        ];

        const { rerender } = render(
            <AnyEvent subtree={false} events={events}>
                <div>
                    <input ref={(node) => { inputRef = node; }} />
                </div>
            </AnyEvent>
        );
        rerender(
            <AnyEvent subtree events={events}>
                <div>
                    <input ref={(node) => { inputRef = node; }} />
                </div>
            </AnyEvent>
        );

        act(() => {
            inputRef!.value = 'banana';
        });
        await flush();
        expect(handler).toHaveBeenCalled();
    });

    test('re-rendering with the same events/subtree does not rebuild the observer', () => {
        const disconnectSpy = jest.spyOn(MutationObserver.prototype, 'disconnect');
        const events = [
            { name: 'banana', triggerByAttributes: ['value'], elementsType: [HTMLInputElement], triggerEventFn: () => true },
        ];

        const { rerender } = render(
            <AnyEvent subtree events={events} className="a">
                <input />
            </AnyEvent>
        );
        disconnectSpy.mockClear();
        rerender(
            <AnyEvent subtree events={events} className="b">
                <input />
            </AnyEvent>
        );

        expect(disconnectSpy).not.toHaveBeenCalled();
        disconnectSpy.mockRestore();
    });

    test('does not crash when "as" is a plain function component that cannot receive the wrapper ref', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        function PlainWrapper(props: React.PropsWithChildren<unknown>) {
            return <div>{props.children}</div>;
        }
        expect(() =>
            render(
                <AnyEvent as={PlainWrapper as any}>
                    <input />
                </AnyEvent>
            )
        ).not.toThrow();
        errorSpy.mockRestore();
    });

    test('disconnects the MutationObserver on unmount', () => {
        const disconnectSpy = jest.spyOn(MutationObserver.prototype, 'disconnect');
        const { unmount } = render(
            <AnyEvent>
                <input />
            </AnyEvent>
        );
        unmount();
        expect(disconnectSpy).toHaveBeenCalled();
        disconnectSpy.mockRestore();
    });
});
