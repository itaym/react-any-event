# react-any-event
![Coverage Status](https://img.shields.io/badge/coverage-100%25-green) ![License](https://img.shields.io/badge/license-MIT-blue)

------------
The purpose of the package is to assist you adding any custom event to any HTML element in React environment. The package provides a component called AnyEvent that wraps any HTML elements you wish to add any event to, and to it&apos;s children according to the elements type.

## Installation
`$ npm install react-any-event`
## Usage
``import AnyEvent from 'react-any-event';``

The component receives one property called **events**. This property is array defining each event to add to any HTML element it wraps <u>directly</u> or in the tree.
One of the main features is that attrbutes changed **programmatically** are also can trigger the event. For an example, the &apos;change&apos; event of an input element is not fired when you change the value of the input programmatically. With **AnyEvent** you can achieve this with ease.
**You can define any event you wish on any kind of element as your needs or imagination require.**

The component wraps its childern with a **span** element. You can provide any attribute to apply to this span to match your requirements such as className etc.

**events:**
An array of:

|  property  |  type  |    |
| :------------ | :------------ | :------------ |
|  name  |  string  |  The name of the event.   |
|  triggerByAttributes | string[]  |  Optional. Array of attributes such as [&apos;value&apos;, &apos;title&apos;, &apos;class&apos;, ...]   |
|  triggerByEvents   | string[]  |  Optional. Array of events such as [&apos;change&apos;, &apos;keyup&apos;, ...] |
|  subtree  |  boolean  |  Optional (default false)  Apply to all subtree.  |
|  elementsType  |  HTML Elements constructor []  |  Optional (default HTMLElement) On which elements type to apply the event. Such as [HTMLElement, HTMLInputElement, HTMLDivElement, ...] |
|  triggerEventFn  |  function(event, propName): boolean  |  The funciton that triggers the event. The this variable is the element the event fired on. If the function returns true the event will be fired. |

|  Events can be tricky, so please  |
| :------------: |
|  **Do not use names of existing events. This can cause unexpected result.** |
|  **Do not nest events with the same or inherited HTML constructors with subtree: true. This can also cause unexpected result.**  |

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
this.bananaInput.addEventListener('banan', this.bananaHandler);
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
                  const currentEllipsis = !!isEllipsis(this, true);
                  const previousEllipsis = !!this.ellipsisState;
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
import React, { Component } from 'react';
import AnyAttribute, { asObject } from 'react-any-attr';
import './Main.css';

class Main extends Component {
    state = {
        ellipsisState: false
    }
    onEllipsisHandler = (event) => {
        this.setState((state) => ({...state, ellipsisState: !state.ellipsisState}))
    }
    render  () {
        const { state: { ellipsisState }} = this;

        return (
            <div>
                <AnyAttribute
                    attributes={{
                        onEllipsis : asObject(this.onEllipsisHandler),
                    }}>
                    <input
                        id={"input"}
                        className={`set-ellipsis ${ellipsisState ? 'ellipsis-on' :''}`}
                    />
                </AnyAttribute>
            </div>
        );
    }
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

------------

##Have a good productive day :)

If you like this package please consider donation <a href="https://paypal.me/ItayMerchav?locale.x=en_US" target="_blank">Click Here</a>

---
- **[MIT license](http://opensource.org/licenses/mit-license.php)**
- Copyright 2015 © <a href="http://fvcproductions.com" target="_blank">FVCproductions</a>.