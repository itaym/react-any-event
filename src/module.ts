import { ElementType, PropsWithChildren } from 'react';

// Structural constructor type: matches any DOM element constructor
// (HTMLInputElement, HTMLDivElement, Element, ...) without hand-maintaining
// a union of every element interface in lib.dom.d.ts.
export type AnyElementConstructor = new (...args: any[]) => Element;

export type IAnyTriggerEventFn = (this: EventTarget, event: Event, propName: string) => boolean;
export type IAnyWrapEventFn = (target: EventTarget, event: Event, propName: string) => boolean;

export interface IAnyEvent {
    name: string;
    triggerByAttributes?: string[];
    triggerByEvents?: string[];
    triggerEventFn: IAnyTriggerEventFn;
    elementsType?: AnyElementConstructor | AnyElementConstructor[];
}

export interface IAnyEventProps extends PropsWithChildren<any> {
    events?: IAnyEvent[];
    subtree?: boolean;
    // Wrapper element tag, defaults to 'span'. Useful in contexts where a
    // <span> isn't valid markup (e.g. inside <tr>/<select>) or is unwanted
    // in flex/grid layouts.
    as?: ElementType;
}

export type IElementTypeMap = Map<AnyElementConstructor, IAnyWrapEventFn[]>;

export interface IConfigObject {
    [key: string]: IElementTypeMap;
}

export interface IConfig {
    attrMapping: IConfigObject;
    eventMapping: IConfigObject;
}
