import React from 'react';
import { act, render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAnyEvent } from '../index';
import { IAnyTriggerEventFn } from '../module';

const bananaEventFn: IAnyTriggerEventFn = function (): boolean {
    return (this as HTMLInputElement).value.indexOf('banana') > -1;
};

function Demo({ eventName = 'banana' }: { eventName?: string }) {
    const ref = useAnyEvent<HTMLInputElement>([
        {
            name: eventName,
            triggerByEvents: ['keyup'],
            elementsType: [HTMLInputElement],
            triggerEventFn: bananaEventFn,
        },
    ]);
    return <input data-testid="hooked" ref={ref} />;
}

describe('useAnyEvent', () => {
    test('attaches events to a single element via ref, without a wrapper element', () => {
        const handler = jest.fn();
        const { container, getByTestId } = render(<Demo />);

        expect(container.querySelector('span')).not.toBeInTheDocument();
        const input = getByTestId('hooked') as HTMLInputElement;
        input.addEventListener('banana', handler);

        act(() => {
            input.value = 'banana bread';
            input.dispatchEvent(new Event('keyup'));
        });
        expect(handler).toHaveBeenCalledTimes(1);
    });

    test('disconnects and re-observes when the events array changes', () => {
        const disconnectSpy = jest.spyOn(MutationObserver.prototype, 'disconnect');
        const { rerender, getByTestId } = render(<Demo eventName="a" />);
        rerender(<Demo eventName="b" />);

        expect(disconnectSpy).toHaveBeenCalled();
        expect(getByTestId('hooked')).toBeInTheDocument();
        disconnectSpy.mockRestore();
    });

    test('defaults events to [] and subtree to false when omitted', () => {
        function Bare() {
            const ref = useAnyEvent<HTMLInputElement>();
            return <input data-testid="bare" ref={ref} />;
        }
        expect(() => render(<Bare />)).not.toThrow();
    });

    test('disconnects on unmount', () => {
        const disconnectSpy = jest.spyOn(MutationObserver.prototype, 'disconnect');
        const { unmount } = render(<Demo />);
        unmount();
        expect(disconnectSpy).toHaveBeenCalled();
        disconnectSpy.mockRestore();
    });
});
