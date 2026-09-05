# react-any-event
![Coverage Status](https://img.shields.io/badge/coverage-100%25-green) ![License](https://img.shields.io/badge/license-MIT-blue)

------------
The purpose of the package is to assist you adding any custom event to any HTML element in React environment. The package provides a component called AnyEvent that wraps any HTML elements you wish to add any event to, and to it&apos;s children according to the elements type.

## Installation
`$ npm install react-any-event`
## Usage
``import AnyEvent from 'react-any-event';``

The component receives two properties, **events** & **subtree**. The **events** property is array defining each event to add to any HTML element it wraps <u>directly</u> or in the tree.
One of the main features is that attrbutes changed **programmatically** are also can trigger the event. For an example, the &apos;change&apos; event of an input element is not fired when you change the value of the input programmatically. With **AnyEvent** you can achieve this with ease.
**You can define any event you wish on any kind of element as your needs or imagination require.**

The component wraps its childern with a **span** element. You can provide any attribute to apply to this span to match your requirements such as className etc.

## Properties
**subtree**

An optional boolean (default is false). Determine if to apply the event on direct children nodes or for all in the tree.

**as**

An optional element type (default is `'span'`) for the wrapper element, e.g. `as="div"`. Useful where a `<span>` isn't valid markup (inside `<tr>`/`<select>`/`<table>`, for instance) or is unwanted noise in a flex/grid layout.

**events:**

An array of objects:

|  property  |  type  |    |
| :------------ | :------------ | :------------ |
|  name  |  string  |  The name of the event.   |
|  triggerByAttributes | string[]  |  Optional. Array of attributes such as [&apos;value&apos;, &apos;title&apos;, &apos;class&apos;, ...]   |
|  triggerByEvents   | string[]  |  Optional. Array of events such as [&apos;change&apos;, &apos;keyup&apos;, ...] |
|  elementsType  |  HTML Elements constructor []  |  Optional (default HTMLElement) On which elements type to apply the event. Such as [HTMLElement, HTMLInputElement, HTMLDivElement, ...] |
|  triggerEventFn  |  function(event, propName): boolean  |  The funciton that triggers the event. The this variable is the element the event fired on. If the function returns true the event will be fired. |



|  Events can be tricky, so please  |
| :------------: |
|  **Do not use names of existing events. This can cause unexpected result.** |
|  **Do not nest events with the same or inherited HTML constructors with subtree: true.**  |
|  **This can also cause unexpected result.**  |

### Example 1
This will fire on any change even if it&apos;s programmatically:
```
<AnyEvent
    events={{
        name: "value",
        triggerByAttributes: ["value"],
        triggerByEvents : "change",
        elementsType : [HTMLInputElement],
        triggerEventFn: () => true,
    }}>
    <input ref={(input => this.input = input)} />
</AnyEvent>
```
```javascript
	this.input.addEventListener('value', () => { /* event handler */ });
```
\*\*Remark, in this example you can omit the HTMLInputElemnent because **AnyEvent** holds just one element.
### Example 2
Let&apos;s say, you want to do something when the user types &apos;banana&apos; in the text box. The &apos;change&apos; event will be used for something else. It really dosn&apos;nt matter. You don&apos;t want to mix unrealted things. So you can create an event called &apos;banana&apos;. You also want it to be on every Input element:
```
<AnyEvent
    events={{
        name: "banana",
        triggerByAttributes: ["value"],
        triggerByEvents : "change",
        elementsType : [HTMLInputElement],
        subtree: true,
        triggerEventFn: () => this.value.indexOf('banana') > -1,
    }}>
    <div className="container">
        <!-- HTML of your page having many elements and somewhere the next line -->
        <input ref={(input => this.bananaInput = input)} />
    </div>
</AnyEvent>
```
```javascript
...
bananaHandler (event) {
    // do something ...
}
...
this.bananaInput.addEventListener('banana', this.bananaHandler);
...
```
### Example 3
Maybe this should be the first one.
**For complete solution** enabling using the **onEvent** good old way. You can use the **react-any-attr** package. 
Here we create an event for ANY element that may display ellipsis using the **isellipsis** package.

**App.js**
```javascript
import React from 'react';
import Main from "./Main";
import { isEllipsis } from 'isellipsis';
import AnyEvent  from 'react-any-event';
import './App.css';

function App() {
  return (
      <AnyEvent
          className={'react-any-event'}
          events={[{
              name: 'ellipsis',
              triggerByAttributes: ['value'],
              triggerByEvents: ['blur'],
              subtree: true,
              elementsType: [HTMLInputElement, HTMLDivElement],
              triggerEventFn: function (event, property) {
                  // The "this" in this function is the element.
                  const currentEllipsis = isEllipsis(this, true, Boolean);
                  const previousEllipsis = this.ellipsisState === true;
                  this.ellipsisState = currentEllipsis;
                  // If the return value is true the event will be dispached.
                  return currentEllipsis !== previousEllipsis;
              },
          }]}>
            <div className="App">
                <header className="App-header">
                    The app header
                </header>
                <Main />
            </div>
      </AnyEvent>
  );
}

export default App;
```
**Main.js**
```javascript
import React, { useState } from 'react';
import AnyAttribute, { asObject } from 'react-any-attr';
import './Main.css';

function Main() {
    const [ellipsisState, setEllipsisState] = useState(false);
    const onEllipsisHandler = () => setEllipsisState((state) => !state);

    return (
        <div>
            <AnyAttribute
                attributes={{
                    onEllipsis: asObject(onEllipsisHandler),
                }}>
                <input
                    id={'input'}
                    className={`set-ellipsis ${ellipsisState ? 'ellipsis-on' : ''}`}
                />
            </AnyAttribute>
        </div>
    );
}

export default Main;
```

**Main.css**
```css
.set-ellipsis {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.ellipsis-on {
    border-color: red;
}
```
Try this one live: `npm run playground` (demo 6) wires up the actual `isellipsis` and `react-any-attr` packages end to end.

#### Or, with hooks instead of wrapper components
`App.js`/`Main.js` wrap once at the root and catch a matching element *anywhere* in the tree - handy when you don't control every component that might render one. If you just want to opt a single element in, `useAnyEvent` + `useAnyAttributes` skip the wrapper components (and the app-level split) entirely:
```javascript
import { useState } from 'react';
import { isEllipsis } from 'isellipsis';
import { useAnyEvent } from 'react-any-event';
import { useAnyAttributes, asObject } from 'react-any-attr';
import './Main.css';

const ellipsisEvents = [{
    name: 'ellipsis',
    triggerByAttributes: ['value'],
    triggerByEvents: ['blur'],
    elementsType: [HTMLInputElement],
    triggerEventFn: function (event, property) {
        const currentEllipsis = isEllipsis(this, true, Boolean);
        const previousEllipsis = this.ellipsisState === true;
        this.ellipsisState = currentEllipsis;
        return currentEllipsis !== previousEllipsis;
    },
}];

function EllipsisInput() {
    const [ellipsisState, setEllipsisState] = useState(false);
    const eventRef = useAnyEvent(ellipsisEvents);
    const attrRef = useAnyAttributes({
        onEllipsis: asObject(() => setEllipsisState((state) => !state)),
    });

    return (
        <input
            className={`set-ellipsis ${ellipsisState ? 'ellipsis-on' : ''}`}
            ref={(node) => {
                eventRef(node);
                attrRef(node);
            }}
        />
    );
}

export default EllipsisInput;
```

### Example 4
The point of Example 3 generalizes: *"is this element's text truncated"* is a **behavior** of an element that arguably deserves its own event — no native one exists for it. The same idea applies to plenty of other behaviors. Here's another: native `mouseenter`/`mouseleave` fire the instant the cursor crosses an element's *outer* edge, padding included. `mouseContentEnter`/`mouseContentLeave` only fire when the cursor is over where the content itself actually is — the padding box excluded.
```javascript
import AnyEvent from 'react-any-event';

// Subtracts border + padding from the element's rect to get its content box.
function isInsideContentBox(el, event) {
    if (event.type === 'mouseleave') return false;
    const { clientX, clientY } = event;
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
        triggerEventFn: function (event) {
            const inside = isInsideContentBox(this, event);
            const was = this.__insideContent === true;
            if (inside && !was) {
                this.__insideContent = true;
                return true;
            }
            return false;
        },
    },
    {
        name: 'mouseContentLeave',
        triggerByEvents: ['mousemove', 'mouseleave'],
        triggerEventFn: function (event) {
            const inside = isInsideContentBox(this, event);
            const was = this.__insideContent === true;
            if (!inside && was) {
                this.__insideContent = false;
                return true;
            }
            return false;
        },
    },
];

function Box() {
    return (
        <AnyEvent events={mouseContentEvents}>
            <div
                style={{ padding: 40, border: '1px solid' }}
                ref={(node) => node?.addEventListener('mouseContentEnter', () => console.log('inside the content now'))}
            >
                hover the padding vs. the text
            </div>
        </AnyEvent>
    );
}
```
`elementsType` is omitted here on purpose — it defaults to `HTMLElement`, so this works on any element, not just inputs/divs. Try it live: `npm run playground` (demo 7).

### useAnyEvent (no wrapper element)
`<AnyEvent>` wraps its children in a `<span>` (or whatever `as` is set to). If you just want to attach events to a single element you already have a ref for - and skip the wrapper entirely - use the `useAnyEvent` hook instead:
```javascript
import { useAnyEvent } from 'react-any-event';

function BananaInput() {
    const ref = useAnyEvent([{
        name: 'banana',
        triggerByAttributes: ['value'],
        elementsType: [HTMLInputElement],
        triggerEventFn: function () {
            return this.value.indexOf('banana') > -1;
        },
    }]);

    return <input ref={ref} />;
}
```
The second argument is `subtree` (default `false`), matching `<AnyEvent>`'s prop of the same name. Pass a memoized `events` array (e.g. via `useMemo`/module scope) rather than a new array literal every render, since a changed reference tears down and re-attaches the underlying observer.

`events` and `subtree` are also reactive on `<AnyEvent>` itself now: changing either prop on an already-mounted `<AnyEvent>` rebuilds its configuration in place.

------------


##Have a good productive day :)

If you like this package please consider donation <a href="https://paypal.me/ItayMerchav?locale.x=en_US" target="_blank">Click Here</a>

---
- **[MIT license](http://opensource.org/licenses/mit-license.php)**
- Copyright 2015 © <a href="http://fvcproductions.com" target="_blank">FVCproductions</a>.
