import React from 'react';
import renderer from 'react-test-renderer';
import AnyEvent, { IAnyTriggerEventFn } from '../index';
import Enzyme, { mount } from 'enzyme'
import Adapter from 'enzyme-adapter-react-16';

const container = document.createElement('div');

Enzyme.configure({ adapter: new Adapter() })

async function wait(milliseconds:number) {
    return new Promise((resolve) => {
       setTimeout(resolve, milliseconds);
    });
}
(() => {
    // Override setAttribute because in Jest it doesn't fire the
    // callback.
    const superSetAttribute = Element.prototype.setAttribute;
    function setAttribute(this: Element, qualifiedName: string, value: string, anyEvent:AnyEvent): void {
        superSetAttribute.call(this, qualifiedName, value);

        const MutationRecord:MutationRecord = {
            addedNodes: [] as any,
            attributeName: qualifiedName,
            attributeNamespace: null,
            nextSibling: null,
            oldValue: null,
            previousSibling: null,
            removedNodes: [] as any,
            target: this,
            type: 'attributes'
        }
        anyEvent?.observerCallback([MutationRecord]);
    }
    // @ts-ignore
    Element.prototype.setAttribute = setAttribute;
})()

const bananaEventFn:IAnyTriggerEventFn = function (/* event: Event, propName: string*/): boolean {
    return ((this as HTMLInputElement).value.indexOf('banana') > -1);
}

beforeAll((done) => {
    document.body.appendChild(container);
    done();
});
afterAll((done) => {
    document.body.removeChild(container);
    done();
})

describe('AnyEvent Component ', () => {
    test('Testing all the ways event can be triggered. valid values', async() => {
        const bananaEventHandler = jest.fn(() => {});
        const bananaEventCallback = jest.fn(bananaEventFn);
        const self = {};
        const anyEvent = (<AnyEvent
            id={'any-event'}
            ref={(anyEvent:AnyEvent) => self['anyEvent'] = anyEvent}
            subtree={true}
            events={[
                {
                    name: 'banana',
                    triggerByAttributes: ['value', 'secondValue'],
                    triggerByEvents: ['keyup'],
                    elementsType: [HTMLInputElement, HTMLAreaElement],
                    triggerEventFn: bananaEventCallback,
                },
            ]}>
            Not type 1 node
            <div>
                <input
                    id={'testInput'}
                    ref={(testInput: Node) => self['testInput'] = testInput} />
            </div>
        </AnyEvent>);
        const wrapper = mount(
            anyEvent, { attachTo: container });
        await wait(10);
        expect(self['testInput']).toBeDefined();
        if (self['testInput']) {
            self['testInput']['onBanana'] = bananaEventHandler;
            self['testInput'].addEventListener('banana', bananaEventHandler);
            self['testInput']['value'] = 'banana';
            self['testInput']['secondValue'] = 'banana';
            self['testInput'].setAttribute('value', 'banana', self['anyEvent']);
            self['testInput'].setAttribute('secondValue', 'banana', self['anyEvent']);
            self['testInput'].dispatchEvent(new Event('keyup'));
            expect(bananaEventCallback).toHaveBeenCalled();
            expect(bananaEventHandler).toBeCalledTimes(5);
            expect(self['testInput']['value']).toBe('banana');
            expect(self['testInput']['secondValue']).toBe('banana');
        }
        wrapper.unmount();
    });
    test('Testing all the ways event can be triggered. invalid values', async() => {
        const bananaEventHandler = jest.fn(() => {});
        const bananaEventCallback = jest.fn(bananaEventFn);
        const self = {};
        const anyEvent = (<AnyEvent
            id={'any-event'}
            ref={(anyEvent:AnyEvent) => self['anyEvent'] = anyEvent}
            subtree={false}
            events={[
                {
                    name: 'willGiveArrayFromSeveralEvents',
                    triggerByAttributes: ['value', 'secondValue'],
                    triggerByEvents: ['keyup'],
                    triggerEventFn: ():boolean => { return false; },
                },
                {
                    name: 'willGiveArrayFromSeveralEvents',
                    triggerByAttributes: ['value', 'secondValue'],
                    triggerByEvents: ['keyup'],
                    triggerEventFn: ():boolean => { return false; },
                },
                {
                    name: 'banana',
                    triggerByAttributes: ['value', 'secondValue'],
                    triggerByEvents: ['keyup'],
                    elementsType: [HTMLInputElement],
                    triggerEventFn: bananaEventCallback,
                },
            ]}>
            <input
                id={'testInput'}
                ref={(testInput: Node) => self['testInput'] = testInput} />
            Not type 1 node
        </AnyEvent>);
        const wrapper = mount(
            anyEvent, { attachTo: container });
        await wait(10);
        expect(self['testInput']).toBeDefined();
        if (self['testInput']) {
            self['testInput']['onBanana'] = bananaEventHandler;
            self['testInput'].addEventListener('banana', bananaEventHandler);
            self['testInput']['value'] = 'apple';
            self['testInput']['secondValue'] = 'apple';
            self['testInput'].setAttribute('value', 'apple', self['anyEvent']);
            self['testInput'].setAttribute('secondValue', 'apple', self['anyEvent']);
            self['testInput'].dispatchEvent(new Event('blur'));
            expect(bananaEventCallback).toBeCalledTimes(2);
            expect(bananaEventHandler).toBeCalledTimes(0);
            expect(self['testInput']['value']).not.toBe('banana');
            expect(self['testInput']['secondValue']).not.toBe('banana')
        }
        wrapper.unmount();
    });
    test('Testing all the ways event can be triggered. without triggerByAttributes valid values', async() => {

        const bananaEventHandler = jest.fn(() => {});
        const bananaEventCallback = jest.fn(bananaEventFn);
        const self = {};
        const anyEvent = (<AnyEvent
            id={'any-event'}
            ref={(anyEvent:AnyEvent) => self['anyEvent'] = anyEvent}
            subtree={false}
            events={[
                {
                    name: 'banana',
                    triggerByEvents: ['keyup'],
                    elementsType: [HTMLInputElement],
                    triggerEventFn: bananaEventCallback,
                },
            ]}>
            Not type 1 node
            <input
                id={'testInput'}
                ref={(testInput: Node) => self['testInput'] = testInput} />
        </AnyEvent>);
        const wrapper = mount(
            anyEvent, { attachTo: container });
        await wait(10);
        expect(self['testInput']).toBeDefined();
        if (self['testInput']) {
            self['testInput']['onBanana'] = bananaEventHandler;
            self['testInput'].addEventListener('banana', bananaEventHandler);
            self['testInput']['value'] = 'banana';
            self['testInput']['secondValue'] = 'banana';
            self['testInput'].setAttribute('value', 'banana', self['anyEvent']);
            self['testInput'].setAttribute('secondValue', 'banana', self['anyEvent']);
            self['testInput'].dispatchEvent(new Event('blur'));
            expect(bananaEventCallback).not.toHaveBeenCalled();
            expect(bananaEventHandler).toBeCalledTimes(0);
            expect(self['testInput']['value']).toBe('banana');
            expect(self['testInput']['secondValue']).toBe('banana');
        }
        wrapper.unmount();
    });
    test('Testing all the ways event can be triggered. without triggerByAttributes invalid values', async() => {
        const bananaEventHandler = jest.fn(() => {});
        const bananaEventCallback = jest.fn(bananaEventFn);
        const self = {};
        const anyEvent = (<AnyEvent
            id={'any-event'}
            ref={(anyEvent:AnyEvent) => self['anyEvent'] = anyEvent}
            subtree={false}
            events={[
                {
                    name: 'banana',
                    triggerByEvents: ['keyup'],
                    elementsType: [HTMLInputElement],
                    triggerEventFn: bananaEventCallback,
                },
            ]}>
            <input
                id={'testInput'}
                ref={(testInput: Node) => self['testInput'] = testInput} />
            Not type 1 node
        </AnyEvent>);
        const wrapper = mount(
            anyEvent, { attachTo: container });
        await wait(10);
        expect(self['testInput']).toBeDefined();
        if (self['testInput']) {
            self['testInput']['onBanana'] = bananaEventHandler;
            self['testInput'].addEventListener('banana', bananaEventHandler);
            self['testInput']['value'] = 'apple';
            self['testInput']['secondValue'] = 'apple';
            self['testInput'].setAttribute('value', 'apple', self['anyEvent']);
            self['testInput'].setAttribute('secondValue', 'apple', self['anyEvent']);
            self['testInput'].dispatchEvent(new Event('blur'));
            expect(bananaEventCallback).not.toHaveBeenCalled();
            expect(bananaEventHandler).toBeCalledTimes(0);
            expect(self['testInput']['value']).not.toBe('banana');
            expect(self['testInput']['secondValue']).not.toBe('banana');
        }
        wrapper.unmount();
    });
    test('Testing all the ways event can be triggered. without triggerByEvents valid values', async() => {

        const bananaEventHandler = jest.fn(() => {});
        const bananaEventCallback = jest.fn(bananaEventFn);
        const self = {};
        const anyEvent = (<AnyEvent
            id={'any-event'}
            ref={(anyEvent:AnyEvent) => self['anyEvent'] = anyEvent}
            subtree={false}
            events={[
                {
                    name: 'banana',
                    triggerByAttributes: ['value', 'secondValue'],
                    elementsType: [HTMLInputElement],
                    triggerEventFn: bananaEventCallback,
                },
            ]}>
            <input
                id={'testInput'}
                ref={(testInput: Node) => self['testInput'] = testInput} />
        </AnyEvent>);
        const wrapper = mount(
            anyEvent, { attachTo: container });
        await wait(10);
        expect(self['testInput']).toBeDefined();
        if (self['testInput']) {
            self['testInput'].addEventListener('banana', bananaEventHandler);
            self['testInput'].setAttribute('value', 'banana', self['anyEvent']);
            self['testInput']['secondValue'] = 'banana';
            expect(bananaEventCallback).toBeCalledTimes(2);
            expect(bananaEventHandler).toBeCalledTimes(2);
            expect(self['testInput']['value']).toBe('banana');
            expect(self['testInput']['secondValue']).toBe('banana');
        }
        wrapper.unmount();
    });
    test('Testing all the ways event can be triggered. without triggerByEvents invalid values', async() => {

        const bananaEventHandler = jest.fn(() => {});
        const bananaEventCallback = jest.fn(bananaEventFn);
        const self = {};
        const anyEvent = (<AnyEvent
            id={'any-event'}
            ref={(anyEvent:AnyEvent) => self['anyEvent'] = anyEvent}
            subtree={false}
            events={[
                {
                    name: 'banana',
                    triggerByAttributes: ['value', 'secondValue'],
                    elementsType: [HTMLInputElement],
                    triggerEventFn: bananaEventCallback,
                },
            ]}>
            <input
                id={'testInput'}
                ref={(testInput: Node) => self['testInput'] = testInput} />
        </AnyEvent>);
        const wrapper = mount(
            anyEvent, { attachTo: container });
        await wait(10);
        expect(self['testInput']).toBeDefined();
        if (self['testInput']) {
            self['testInput']['onBanana'] = bananaEventHandler;
            self['testInput'].addEventListener('banana', bananaEventHandler);
            self['testInput'].setAttribute('value', 'apple1', self['anyEvent']);
            self['testInput']['value'] = 'apple2';
            self['testInput'].setAttribute('secondValue', 'apple3', self['anyEvent']);
            self['testInput']['secondValue'] = 'apple4';
            expect(bananaEventCallback).toBeCalledTimes(4);
            expect(bananaEventHandler).not.toBeCalled();
            wrapper.unmount();
        }
    });
    test('Testing without any events', async() => {
        const self = {};
        const anyEvent = (<AnyEvent
            id={'any-event'}
            ref={(anyEvent:AnyEvent) => self['anyEvent'] = anyEvent}
            events={undefined}>
            <input
                id={'testInput'}
                ref={(testInput: Node) => self['testInput'] = testInput} />
        </AnyEvent>);
        const wrapper = mount(
            anyEvent, { attachTo: container });
        await wait(10);
        expect(self['testInput']).toBeDefined();
        wrapper.unmount();
    });
});
describe('AnyEvent Component ', () => {
    test('Testing snapshot', async() => {
        const componentDidMount = jest.fn(AnyEvent.prototype.componentDidMount);
        AnyEvent.prototype.componentDidMount = componentDidMount;
        const render = jest.fn(AnyEvent.prototype.render);
        AnyEvent.prototype.render = render;
        const tree = renderer
            .create(<div><AnyEvent
                id={'any-event'}
                ref={(anyEvent:AnyEvent) => self['anyEvent'] = anyEvent}
                subtree={false}
                events={[
                    {
                        name: 'banana',
                        triggerByAttributes: ['value', 'secondValue'],
                        triggerByEvents: ['keyup'],
                        elementsType: [HTMLInputElement, HTMLAreaElement],
                        triggerEventFn: bananaEventFn,
                    },
                ]}>
                Not type 1 node
                <input
                    id={'testInput'}
                    ref={(testInput: Node) => self['testInput'] = testInput} />
            </AnyEvent></div>)
            .toJSON();
        expect(componentDidMount).toBeCalled();
        expect(render).toBeCalled();
        expect(tree).toMatchSnapshot();
    });
});