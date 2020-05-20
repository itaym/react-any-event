import React, { Component, PropsWithChildren } from 'react';
import camelcase from 'camelcase';

export interface Element {
    setAttribute(qualifiedName: string, value: string, anyEvent?:AnyEvent): void;
}
export interface IAnyEventProps extends PropsWithChildren<any> {
    events: IAnyEvent[]
}
export type IAnyElement =
    new () => HTMLAnchorElement |
    HTMLAreaElement |
    HTMLAudioElement |
    HTMLBRElement |
    HTMLBaseElement |
    HTMLBaseFontElement |
    HTMLBodyElement |
    HTMLButtonElement |
    HTMLCanvasElement |
    HTMLCollection |
    HTMLDListElement |
    HTMLDataElement |
    HTMLDataListElement |
    HTMLDetailsElement |
    HTMLDialogElement |
    HTMLDivElement |
    HTMLElement |
    HTMLEmbedElement |
    HTMLFieldSetElement |
    HTMLFontElement |
    HTMLFormControlsCollection |
    HTMLFormElement |
    HTMLFrameSetElement |
    HTMLHRElement |
    HTMLHeadElement |
    HTMLHeadingElement |
    HTMLHtmlElement |
    HTMLIFrameElement |
    HTMLImageElement |
    HTMLInputElement |
    HTMLLIElement |
    HTMLLabelElement |
    HTMLLegendElement |
    HTMLLinkElement |
    HTMLMapElement |
    HTMLMarqueeElement |
    HTMLMediaElement |
    HTMLMenuElement |
    HTMLMetaElement |
    HTMLMeterElement |
    HTMLModElement |
    HTMLOListElement |
    HTMLObjectElement |
    HTMLOptGroupElement |
    HTMLOptionElement |
    HTMLOptionsCollection |
    HTMLOutputElement |
    HTMLParagraphElement |
    HTMLParamElement |
    HTMLPictureElement |
    HTMLPreElement |
    HTMLProgressElement |
    HTMLQuoteElement |
    HTMLScriptElement |
    HTMLSelectElement |
    HTMLSlotElement |
    HTMLSourceElement |
    HTMLSpanElement |
    HTMLStyleElement |
    HTMLTableCaptionElement |
    HTMLTableCellElement |
    HTMLTableColElement |
    HTMLTableElement |
    HTMLTableRowElement |
    HTMLTableSectionElement |
    HTMLTemplateElement |
    HTMLTextAreaElement |
    HTMLTimeElement |
    HTMLTitleElement |
    HTMLTrackElement |
    HTMLUListElement |
    HTMLUnknownElement |
    HTMLVideoElement;

export type IAnyTriggerEventFn =
    (this:EventTarget, event: Event, propName: string) => boolean;
export type IAnyWrapEventFn =
    (target: EventTarget, event:Event, propName: string) => boolean;
export interface IAnyEvent {
    name: string;
    triggerByAttributes?: string[];
    triggerByEvents?: string[];
    subtree?: boolean;
    triggerEventFn: IAnyTriggerEventFn;
    elementsType?: IAnyElement | IAnyElement[];
}
interface IConfigObject {
    [key: string]: Map<IAnyElement, IAnyWrapEventFn[] | undefined>
}

interface IConfig {
    attrMapping?: IConfigObject;
    eventMapping?: IConfigObject;
}

export default class AnyEvent extends Component<IAnyEventProps> {
    root: Node | null = null;

    state =  { didMount: false };
    config:IConfig = {};

    constructor (props: IAnyEventProps) {
        super(props);
        this.buildConfig();
    }
    componentDidMount () {
        this.setObserver();
        this.setState(() => ({ didMount: true }));
    }
    modifyNodeProp (htmlElement: Node, propName: string) {
        const superPropSet: (newValue: any) => void = Object.getOwnPropertyDescriptor(htmlElement, propName)?.set;
        const superPropGet: () => any | undefined = Object.getOwnPropertyDescriptor(htmlElement, propName)?.get;
        const _self = this;

        try {
            Object.defineProperty(htmlElement, propName, {
                get() {
                    if (superPropGet) {
                        return superPropGet.call(this);
                    }
                    return this.getAttribute(propName);
                },
                set(newValue: any) {
                    if (superPropSet) {
                        superPropSet.call(this, newValue);
                    }
                    // noinspection ES6ShorthandObjectProperty
                    this.setAttribute(propName, newValue, _self);
                },
                configurable: false
            });
        }
        catch {}
    }
    buildConfig () {
        const { props: { events }} = this;
        const attrMapping = {};
        const eventMapping = {};

        const configEntities = (event: IAnyEvent, configObj:IConfigObject, propArray: string[]) => {
            // function must have the name of the event
            // eslint-disable-next-line no-new-func
            const func:IAnyWrapEventFn = Function('triggerEventFn', `
                return function ${event.name} (target, event, propName) {
                    return triggerEventFn.call(target, event, propName);
                }`
            )(event.triggerEventFn);
            ([].concat(propArray)).forEach(name => {
                if (!configObj[name]) configObj[name] = new Map();
                ([].concat(event.elementsType)).forEach((elementType) => {
                    if (!elementType) elementType = HTMLElement;
                    let fnArray = [] as IAnyWrapEventFn[] | undefined;
                    if (!configObj[name].has(elementType)) {
                        configObj[name].set(elementType, fnArray);
                    }
                    fnArray = configObj[name].get(elementType);
                    fnArray.push(func);
                });
            });
        }
        ([].concat(events) as IAnyEvent[]).forEach(event => {
            if (!event) return;
            configEntities(event, attrMapping, event.triggerByAttributes || []);
            configEntities(event, eventMapping, event.triggerByEvents || []);
        });
        this.config = { attrMapping, eventMapping };
    }
    buildObserverConfig () {
        const { props: { events }} = this;
        const co:MutationObserverInit = {
            attributeFilter: [],
            childList: true,
            subtree: false,
            attributes: true,
            attributeOldValue: true,
        };
        (events || []).forEach((event) => {
            co.attributeFilter = co.attributeFilter.concat((event.triggerByAttributes || []));
            co.subtree = co.subtree || event.subtree;
        });
        return co;
    }
    observerOnEvent (triggerEventFn:IAnyWrapEventFn, target: EventTarget, event: Event | null, propName: string) {
        const newEvent = event  || new Event(triggerEventFn.name);
        const lowerCaseName = `on${triggerEventFn.name}`;
        const camelCaseName = camelcase(`on ${triggerEventFn.name}`);
        const targetOnEvent = target[lowerCaseName] || target[camelCaseName];

        if (triggerEventFn.call(null, target, newEvent, propName)) {
            //if the event is 'native' event don't dispatch because it already been dispatched.
            if (event !== newEvent) target.dispatchEvent(newEvent);
            if (targetOnEvent) {
                targetOnEvent(newEvent);
            }
        }
    }
    modifyAllNodes (node: Node) {
        const { config: { attrMapping, eventMapping } } = this;

        if (node.nodeType === 1) {
            for (const [attrName, elementTypesMap] of Object.entries(attrMapping)) {
                for (const elementType of elementTypesMap.keys()) {
                    if (node instanceof elementType as any) {
                        this.modifyNodeProp(node, attrName);
                    }
                }
            }
            for (const [eventName, elementTypesMap] of Object.entries(eventMapping)) {
                for (const elementType of elementTypesMap.keys()) {
                    if (node instanceof (elementType as any)) {
                        elementTypesMap.get(elementType).forEach(triggerEventFn => {
                            node.addEventListener(eventName, (event: Event) => {
                                this.observerOnEvent(triggerEventFn, event.target, event, eventName);
                            });
                        });
                    }
                }
            }
            node.childNodes.forEach((childNode: ChildNode) => this.modifyAllNodes(childNode));
        }
    }
    observerCallback = (mutationRecords: MutationRecord[], /* observer: MutationObserver */) => {
        const { config: { attrMapping } } = this;

        for (const mutation of mutationRecords) {
            if (mutation.type === 'attributes') {
                const elementTypesMap = attrMapping[mutation.attributeName];
                if (!elementTypesMap) continue;
                // In some environments this mutation happens twice!
                const camelcaseName = camelcase(`old ${mutation.attributeName}`);
                if (mutation.target[camelcaseName] !== mutation.target[mutation.attributeName]) {
                    for (const elementType of Array.from(elementTypesMap.keys())) {
                        if (mutation.target instanceof elementType) {
                            elementTypesMap.get(elementType).forEach(triggerEventFn => {
                                this.observerOnEvent(triggerEventFn, mutation.target, null, mutation.attributeName);
                            });
                        }
                    }
                }
                mutation.target[camelcaseName] = mutation.target[mutation.attributeName];
            }
            mutation.addedNodes.forEach( (node: Node) => {
                this.modifyAllNodes(node);
            });
        }
    }
    setObserver () {
        if (this.root) {
            const observer: MutationObserver = new MutationObserver(this.observerCallback);
            observer.observe(this.root, this.buildObserverConfig());
        }
    }
    render () {
        const { props, state : { didMount }} = this;
        const { events, children, ...rest} = props;
        return (
            <span
                {...rest}
                ref={ (root: HTMLDivElement) => this.root = root as Node }>{ didMount ? children : null }</span>
        )
    }
}