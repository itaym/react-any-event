import React, { Component, ElementType } from 'react';
import { AnyEventEngine } from './engine';
import { IAnyEventProps } from './module';

export { useAnyEvent } from './useAnyEvent';
export type {
    AnyElementConstructor,
    IAnyEvent,
    IAnyEventProps,
    IAnyTriggerEventFn,
    IAnyWrapEventFn,
} from './module';

export default class AnyEvent extends Component<IAnyEventProps> {
    private root: HTMLElement | null = null;
    private engine = new AnyEventEngine();
    private didMount = false;

    componentDidMount() {
        this.didMount = true;
        if (this.root) {
            const { events, subtree } = this.props;
            this.engine.observe(this.root, events, subtree);
        }
    }
    componentDidUpdate(prevProps: IAnyEventProps) {
        const { events, subtree } = this.props;
        if (events !== prevProps.events || subtree !== prevProps.subtree) {
            this.engine.update(events, subtree);
        }
    }
    componentWillUnmount() {
        this.engine.disconnect();
    }
    // If `as` changes at runtime, React swaps the underlying DOM node (it
    // isn't the same element, just a different tag) - this ref callback
    // fires again with the new node, so the engine is re-pointed at it
    // instead of continuing to watch the old, now-detached one.
    private setRoot = (node: HTMLElement | null) => {
        const changed = node !== this.root;
        this.root = node;
        if (changed && node && this.didMount) {
            const { events, subtree } = this.props;
            this.engine.observe(node, events, subtree);
        }
    };
    render() {
        const { props } = this;
        const { events, subtree, as, children, ...rest } = props;
        const Tag = (as || 'span') as ElementType;
        return (
            <Tag {...rest} ref={this.setRoot}>{children}</Tag>
        );
    }
}
