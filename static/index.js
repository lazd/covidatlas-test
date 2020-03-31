/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */

function __decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * True if the custom elements polyfill is in use.
 */
const isCEPolyfill = typeof window !== 'undefined' &&
    window.customElements != null &&
    window.customElements.polyfillWrapFlushCallback !==
        undefined;
/**
 * Reparents nodes, starting from `start` (inclusive) to `end` (exclusive),
 * into another container (could be the same container), before `before`. If
 * `before` is null, it appends the nodes to the container.
 */
const reparentNodes = (container, start, end = null, before = null) => {
    while (start !== end) {
        const n = start.nextSibling;
        container.insertBefore(start, before);
        start = n;
    }
};
/**
 * Removes nodes, starting from `start` (inclusive) to `end` (exclusive), from
 * `container`.
 */
const removeNodes = (container, start, end = null) => {
    while (start !== end) {
        const n = start.nextSibling;
        container.removeChild(start);
        start = n;
    }
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * An expression marker with embedded unique key to avoid collision with
 * possible text in templates.
 */
const marker = `{{lit-${String(Math.random()).slice(2)}}}`;
/**
 * An expression marker used text-positions, multi-binding attributes, and
 * attributes with markup-like text values.
 */
const nodeMarker = `<!--${marker}-->`;
const markerRegex = new RegExp(`${marker}|${nodeMarker}`);
/**
 * Suffix appended to all bound attribute names.
 */
const boundAttributeSuffix = '$lit$';
/**
 * An updatable Template that tracks the location of dynamic parts.
 */
class Template {
    constructor(result, element) {
        this.parts = [];
        this.element = element;
        const nodesToRemove = [];
        const stack = [];
        // Edge needs all 4 parameters present; IE11 needs 3rd parameter to be null
        const walker = document.createTreeWalker(element.content, 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */, null, false);
        // Keeps track of the last index associated with a part. We try to delete
        // unnecessary nodes, but we never want to associate two different parts
        // to the same index. They must have a constant node between.
        let lastPartIndex = 0;
        let index = -1;
        let partIndex = 0;
        const { strings, values: { length } } = result;
        while (partIndex < length) {
            const node = walker.nextNode();
            if (node === null) {
                // We've exhausted the content inside a nested template element.
                // Because we still have parts (the outer for-loop), we know:
                // - There is a template in the stack
                // - The walker will find a nextNode outside the template
                walker.currentNode = stack.pop();
                continue;
            }
            index++;
            if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
                if (node.hasAttributes()) {
                    const attributes = node.attributes;
                    const { length } = attributes;
                    // Per
                    // https://developer.mozilla.org/en-US/docs/Web/API/NamedNodeMap,
                    // attributes are not guaranteed to be returned in document order.
                    // In particular, Edge/IE can return them out of order, so we cannot
                    // assume a correspondence between part index and attribute index.
                    let count = 0;
                    for (let i = 0; i < length; i++) {
                        if (endsWith(attributes[i].name, boundAttributeSuffix)) {
                            count++;
                        }
                    }
                    while (count-- > 0) {
                        // Get the template literal section leading up to the first
                        // expression in this attribute
                        const stringForPart = strings[partIndex];
                        // Find the attribute name
                        const name = lastAttributeNameRegex.exec(stringForPart)[2];
                        // Find the corresponding attribute
                        // All bound attributes have had a suffix added in
                        // TemplateResult#getHTML to opt out of special attribute
                        // handling. To look up the attribute value we also need to add
                        // the suffix.
                        const attributeLookupName = name.toLowerCase() + boundAttributeSuffix;
                        const attributeValue = node.getAttribute(attributeLookupName);
                        node.removeAttribute(attributeLookupName);
                        const statics = attributeValue.split(markerRegex);
                        this.parts.push({ type: 'attribute', index, name, strings: statics });
                        partIndex += statics.length - 1;
                    }
                }
                if (node.tagName === 'TEMPLATE') {
                    stack.push(node);
                    walker.currentNode = node.content;
                }
            }
            else if (node.nodeType === 3 /* Node.TEXT_NODE */) {
                const data = node.data;
                if (data.indexOf(marker) >= 0) {
                    const parent = node.parentNode;
                    const strings = data.split(markerRegex);
                    const lastIndex = strings.length - 1;
                    // Generate a new text node for each literal section
                    // These nodes are also used as the markers for node parts
                    for (let i = 0; i < lastIndex; i++) {
                        let insert;
                        let s = strings[i];
                        if (s === '') {
                            insert = createMarker();
                        }
                        else {
                            const match = lastAttributeNameRegex.exec(s);
                            if (match !== null && endsWith(match[2], boundAttributeSuffix)) {
                                s = s.slice(0, match.index) + match[1] +
                                    match[2].slice(0, -boundAttributeSuffix.length) + match[3];
                            }
                            insert = document.createTextNode(s);
                        }
                        parent.insertBefore(insert, node);
                        this.parts.push({ type: 'node', index: ++index });
                    }
                    // If there's no text, we must insert a comment to mark our place.
                    // Else, we can trust it will stick around after cloning.
                    if (strings[lastIndex] === '') {
                        parent.insertBefore(createMarker(), node);
                        nodesToRemove.push(node);
                    }
                    else {
                        node.data = strings[lastIndex];
                    }
                    // We have a part for each match found
                    partIndex += lastIndex;
                }
            }
            else if (node.nodeType === 8 /* Node.COMMENT_NODE */) {
                if (node.data === marker) {
                    const parent = node.parentNode;
                    // Add a new marker node to be the startNode of the Part if any of
                    // the following are true:
                    //  * We don't have a previousSibling
                    //  * The previousSibling is already the start of a previous part
                    if (node.previousSibling === null || index === lastPartIndex) {
                        index++;
                        parent.insertBefore(createMarker(), node);
                    }
                    lastPartIndex = index;
                    this.parts.push({ type: 'node', index });
                    // If we don't have a nextSibling, keep this node so we have an end.
                    // Else, we can remove it to save future costs.
                    if (node.nextSibling === null) {
                        node.data = '';
                    }
                    else {
                        nodesToRemove.push(node);
                        index--;
                    }
                    partIndex++;
                }
                else {
                    let i = -1;
                    while ((i = node.data.indexOf(marker, i + 1)) !== -1) {
                        // Comment node has a binding marker inside, make an inactive part
                        // The binding won't work, but subsequent bindings will
                        // TODO (justinfagnani): consider whether it's even worth it to
                        // make bindings in comments work
                        this.parts.push({ type: 'node', index: -1 });
                        partIndex++;
                    }
                }
            }
        }
        // Remove text binding nodes after the walk to not disturb the TreeWalker
        for (const n of nodesToRemove) {
            n.parentNode.removeChild(n);
        }
    }
}
const endsWith = (str, suffix) => {
    const index = str.length - suffix.length;
    return index >= 0 && str.slice(index) === suffix;
};
const isTemplatePartActive = (part) => part.index !== -1;
// Allows `document.createComment('')` to be renamed for a
// small manual size-savings.
const createMarker = () => document.createComment('');
/**
 * This regex extracts the attribute name preceding an attribute-position
 * expression. It does this by matching the syntax allowed for attributes
 * against the string literal directly preceding the expression, assuming that
 * the expression is in an attribute-value position.
 *
 * See attributes in the HTML spec:
 * https://www.w3.org/TR/html5/syntax.html#elements-attributes
 *
 * " \x09\x0a\x0c\x0d" are HTML space characters:
 * https://www.w3.org/TR/html5/infrastructure.html#space-characters
 *
 * "\0-\x1F\x7F-\x9F" are Unicode control characters, which includes every
 * space character except " ".
 *
 * So an attribute is:
 *  * The name: any character except a control character, space character, ('),
 *    ("), ">", "=", or "/"
 *  * Followed by zero or more space characters
 *  * Followed by "="
 *  * Followed by zero or more space characters
 *  * Followed by:
 *    * Any character except space, ('), ("), "<", ">", "=", (`), or
 *    * (") then any non-("), or
 *    * (') then any non-(')
 */
const lastAttributeNameRegex = 
// eslint-disable-next-line no-control-regex
/([ \x09\x0a\x0c\x0d])([^\0-\x1F\x7F-\x9F "'>=/]+)([ \x09\x0a\x0c\x0d]*=[ \x09\x0a\x0c\x0d]*(?:[^ \x09\x0a\x0c\x0d"'`<>=]*|"[^"]*|'[^']*))$/;

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const walkerNodeFilter = 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */;
/**
 * Removes the list of nodes from a Template safely. In addition to removing
 * nodes from the Template, the Template part indices are updated to match
 * the mutated Template DOM.
 *
 * As the template is walked the removal state is tracked and
 * part indices are adjusted as needed.
 *
 * div
 *   div#1 (remove) <-- start removing (removing node is div#1)
 *     div
 *       div#2 (remove)  <-- continue removing (removing node is still div#1)
 *         div
 * div <-- stop removing since previous sibling is the removing node (div#1,
 * removed 4 nodes)
 */
function removeNodesFromTemplate(template, nodesToRemove) {
    const { element: { content }, parts } = template;
    const walker = document.createTreeWalker(content, walkerNodeFilter, null, false);
    let partIndex = nextActiveIndexInTemplateParts(parts);
    let part = parts[partIndex];
    let nodeIndex = -1;
    let removeCount = 0;
    const nodesToRemoveInTemplate = [];
    let currentRemovingNode = null;
    while (walker.nextNode()) {
        nodeIndex++;
        const node = walker.currentNode;
        // End removal if stepped past the removing node
        if (node.previousSibling === currentRemovingNode) {
            currentRemovingNode = null;
        }
        // A node to remove was found in the template
        if (nodesToRemove.has(node)) {
            nodesToRemoveInTemplate.push(node);
            // Track node we're removing
            if (currentRemovingNode === null) {
                currentRemovingNode = node;
            }
        }
        // When removing, increment count by which to adjust subsequent part indices
        if (currentRemovingNode !== null) {
            removeCount++;
        }
        while (part !== undefined && part.index === nodeIndex) {
            // If part is in a removed node deactivate it by setting index to -1 or
            // adjust the index as needed.
            part.index = currentRemovingNode !== null ? -1 : part.index - removeCount;
            // go to the next active part.
            partIndex = nextActiveIndexInTemplateParts(parts, partIndex);
            part = parts[partIndex];
        }
    }
    nodesToRemoveInTemplate.forEach((n) => n.parentNode.removeChild(n));
}
const countNodes = (node) => {
    let count = (node.nodeType === 11 /* Node.DOCUMENT_FRAGMENT_NODE */) ? 0 : 1;
    const walker = document.createTreeWalker(node, walkerNodeFilter, null, false);
    while (walker.nextNode()) {
        count++;
    }
    return count;
};
const nextActiveIndexInTemplateParts = (parts, startIndex = -1) => {
    for (let i = startIndex + 1; i < parts.length; i++) {
        const part = parts[i];
        if (isTemplatePartActive(part)) {
            return i;
        }
    }
    return -1;
};
/**
 * Inserts the given node into the Template, optionally before the given
 * refNode. In addition to inserting the node into the Template, the Template
 * part indices are updated to match the mutated Template DOM.
 */
function insertNodeIntoTemplate(template, node, refNode = null) {
    const { element: { content }, parts } = template;
    // If there's no refNode, then put node at end of template.
    // No part indices need to be shifted in this case.
    if (refNode === null || refNode === undefined) {
        content.appendChild(node);
        return;
    }
    const walker = document.createTreeWalker(content, walkerNodeFilter, null, false);
    let partIndex = nextActiveIndexInTemplateParts(parts);
    let insertCount = 0;
    let walkerIndex = -1;
    while (walker.nextNode()) {
        walkerIndex++;
        const walkerNode = walker.currentNode;
        if (walkerNode === refNode) {
            insertCount = countNodes(node);
            refNode.parentNode.insertBefore(node, refNode);
        }
        while (partIndex !== -1 && parts[partIndex].index === walkerIndex) {
            // If we've inserted the node, simply adjust all subsequent parts
            if (insertCount > 0) {
                while (partIndex !== -1) {
                    parts[partIndex].index += insertCount;
                    partIndex = nextActiveIndexInTemplateParts(parts, partIndex);
                }
                return;
            }
            partIndex = nextActiveIndexInTemplateParts(parts, partIndex);
        }
    }
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const directives = new WeakMap();
/**
 * Brands a function as a directive factory function so that lit-html will call
 * the function during template rendering, rather than passing as a value.
 *
 * A _directive_ is a function that takes a Part as an argument. It has the
 * signature: `(part: Part) => void`.
 *
 * A directive _factory_ is a function that takes arguments for data and
 * configuration and returns a directive. Users of directive usually refer to
 * the directive factory as the directive. For example, "The repeat directive".
 *
 * Usually a template author will invoke a directive factory in their template
 * with relevant arguments, which will then return a directive function.
 *
 * Here's an example of using the `repeat()` directive factory that takes an
 * array and a function to render an item:
 *
 * ```js
 * html`<ul><${repeat(items, (item) => html`<li>${item}</li>`)}</ul>`
 * ```
 *
 * When `repeat` is invoked, it returns a directive function that closes over
 * `items` and the template function. When the outer template is rendered, the
 * return directive function is called with the Part for the expression.
 * `repeat` then performs it's custom logic to render multiple items.
 *
 * @param f The directive factory function. Must be a function that returns a
 * function of the signature `(part: Part) => void`. The returned function will
 * be called with the part object.
 *
 * @example
 *
 * import {directive, html} from 'lit-html';
 *
 * const immutable = directive((v) => (part) => {
 *   if (part.value !== v) {
 *     part.setValue(v)
 *   }
 * });
 */
const directive = (f) => ((...args) => {
    const d = f(...args);
    directives.set(d, true);
    return d;
});
const isDirective = (o) => {
    return typeof o === 'function' && directives.has(o);
};

/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * A sentinel value that signals that a value was handled by a directive and
 * should not be written to the DOM.
 */
const noChange = {};
/**
 * A sentinel value that signals a NodePart to fully clear its content.
 */
const nothing = {};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * An instance of a `Template` that can be attached to the DOM and updated
 * with new values.
 */
class TemplateInstance {
    constructor(template, processor, options) {
        this.__parts = [];
        this.template = template;
        this.processor = processor;
        this.options = options;
    }
    update(values) {
        let i = 0;
        for (const part of this.__parts) {
            if (part !== undefined) {
                part.setValue(values[i]);
            }
            i++;
        }
        for (const part of this.__parts) {
            if (part !== undefined) {
                part.commit();
            }
        }
    }
    _clone() {
        // There are a number of steps in the lifecycle of a template instance's
        // DOM fragment:
        //  1. Clone - create the instance fragment
        //  2. Adopt - adopt into the main document
        //  3. Process - find part markers and create parts
        //  4. Upgrade - upgrade custom elements
        //  5. Update - set node, attribute, property, etc., values
        //  6. Connect - connect to the document. Optional and outside of this
        //     method.
        //
        // We have a few constraints on the ordering of these steps:
        //  * We need to upgrade before updating, so that property values will pass
        //    through any property setters.
        //  * We would like to process before upgrading so that we're sure that the
        //    cloned fragment is inert and not disturbed by self-modifying DOM.
        //  * We want custom elements to upgrade even in disconnected fragments.
        //
        // Given these constraints, with full custom elements support we would
        // prefer the order: Clone, Process, Adopt, Upgrade, Update, Connect
        //
        // But Safari does not implement CustomElementRegistry#upgrade, so we
        // can not implement that order and still have upgrade-before-update and
        // upgrade disconnected fragments. So we instead sacrifice the
        // process-before-upgrade constraint, since in Custom Elements v1 elements
        // must not modify their light DOM in the constructor. We still have issues
        // when co-existing with CEv0 elements like Polymer 1, and with polyfills
        // that don't strictly adhere to the no-modification rule because shadow
        // DOM, which may be created in the constructor, is emulated by being placed
        // in the light DOM.
        //
        // The resulting order is on native is: Clone, Adopt, Upgrade, Process,
        // Update, Connect. document.importNode() performs Clone, Adopt, and Upgrade
        // in one step.
        //
        // The Custom Elements v1 polyfill supports upgrade(), so the order when
        // polyfilled is the more ideal: Clone, Process, Adopt, Upgrade, Update,
        // Connect.
        const fragment = isCEPolyfill ?
            this.template.element.content.cloneNode(true) :
            document.importNode(this.template.element.content, true);
        const stack = [];
        const parts = this.template.parts;
        // Edge needs all 4 parameters present; IE11 needs 3rd parameter to be null
        const walker = document.createTreeWalker(fragment, 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */, null, false);
        let partIndex = 0;
        let nodeIndex = 0;
        let part;
        let node = walker.nextNode();
        // Loop through all the nodes and parts of a template
        while (partIndex < parts.length) {
            part = parts[partIndex];
            if (!isTemplatePartActive(part)) {
                this.__parts.push(undefined);
                partIndex++;
                continue;
            }
            // Progress the tree walker until we find our next part's node.
            // Note that multiple parts may share the same node (attribute parts
            // on a single element), so this loop may not run at all.
            while (nodeIndex < part.index) {
                nodeIndex++;
                if (node.nodeName === 'TEMPLATE') {
                    stack.push(node);
                    walker.currentNode = node.content;
                }
                if ((node = walker.nextNode()) === null) {
                    // We've exhausted the content inside a nested template element.
                    // Because we still have parts (the outer for-loop), we know:
                    // - There is a template in the stack
                    // - The walker will find a nextNode outside the template
                    walker.currentNode = stack.pop();
                    node = walker.nextNode();
                }
            }
            // We've arrived at our part's node.
            if (part.type === 'node') {
                const part = this.processor.handleTextExpression(this.options);
                part.insertAfterNode(node.previousSibling);
                this.__parts.push(part);
            }
            else {
                this.__parts.push(...this.processor.handleAttributeExpressions(node, part.name, part.strings, this.options));
            }
            partIndex++;
        }
        if (isCEPolyfill) {
            document.adoptNode(fragment);
            customElements.upgrade(fragment);
        }
        return fragment;
    }
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const commentMarker = ` ${marker} `;
/**
 * The return type of `html`, which holds a Template and the values from
 * interpolated expressions.
 */
class TemplateResult {
    constructor(strings, values, type, processor) {
        this.strings = strings;
        this.values = values;
        this.type = type;
        this.processor = processor;
    }
    /**
     * Returns a string of HTML used to create a `<template>` element.
     */
    getHTML() {
        const l = this.strings.length - 1;
        let html = '';
        let isCommentBinding = false;
        for (let i = 0; i < l; i++) {
            const s = this.strings[i];
            // For each binding we want to determine the kind of marker to insert
            // into the template source before it's parsed by the browser's HTML
            // parser. The marker type is based on whether the expression is in an
            // attribute, text, or comment position.
            //   * For node-position bindings we insert a comment with the marker
            //     sentinel as its text content, like <!--{{lit-guid}}-->.
            //   * For attribute bindings we insert just the marker sentinel for the
            //     first binding, so that we support unquoted attribute bindings.
            //     Subsequent bindings can use a comment marker because multi-binding
            //     attributes must be quoted.
            //   * For comment bindings we insert just the marker sentinel so we don't
            //     close the comment.
            //
            // The following code scans the template source, but is *not* an HTML
            // parser. We don't need to track the tree structure of the HTML, only
            // whether a binding is inside a comment, and if not, if it appears to be
            // the first binding in an attribute.
            const commentOpen = s.lastIndexOf('<!--');
            // We're in comment position if we have a comment open with no following
            // comment close. Because <-- can appear in an attribute value there can
            // be false positives.
            isCommentBinding = (commentOpen > -1 || isCommentBinding) &&
                s.indexOf('-->', commentOpen + 1) === -1;
            // Check to see if we have an attribute-like sequence preceding the
            // expression. This can match "name=value" like structures in text,
            // comments, and attribute values, so there can be false-positives.
            const attributeMatch = lastAttributeNameRegex.exec(s);
            if (attributeMatch === null) {
                // We're only in this branch if we don't have a attribute-like
                // preceding sequence. For comments, this guards against unusual
                // attribute values like <div foo="<!--${'bar'}">. Cases like
                // <!-- foo=${'bar'}--> are handled correctly in the attribute branch
                // below.
                html += s + (isCommentBinding ? commentMarker : nodeMarker);
            }
            else {
                // For attributes we use just a marker sentinel, and also append a
                // $lit$ suffix to the name to opt-out of attribute-specific parsing
                // that IE and Edge do for style and certain SVG attributes.
                html += s.substr(0, attributeMatch.index) + attributeMatch[1] +
                    attributeMatch[2] + boundAttributeSuffix + attributeMatch[3] +
                    marker;
            }
        }
        html += this.strings[l];
        return html;
    }
    getTemplateElement() {
        const template = document.createElement('template');
        template.innerHTML = this.getHTML();
        return template;
    }
}
/**
 * A TemplateResult for SVG fragments.
 *
 * This class wraps HTML in an `<svg>` tag in order to parse its contents in the
 * SVG namespace, then modifies the template to remove the `<svg>` tag so that
 * clones only container the original fragment.
 */
class SVGTemplateResult extends TemplateResult {
    getHTML() {
        return `<svg>${super.getHTML()}</svg>`;
    }
    getTemplateElement() {
        const template = super.getTemplateElement();
        const content = template.content;
        const svgElement = content.firstChild;
        content.removeChild(svgElement);
        reparentNodes(content, svgElement.firstChild);
        return template;
    }
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const isPrimitive = (value) => {
    return (value === null ||
        !(typeof value === 'object' || typeof value === 'function'));
};
const isIterable = (value) => {
    return Array.isArray(value) ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        !!(value && value[Symbol.iterator]);
};
/**
 * Writes attribute values to the DOM for a group of AttributeParts bound to a
 * single attribute. The value is only set once even if there are multiple parts
 * for an attribute.
 */
class AttributeCommitter {
    constructor(element, name, strings) {
        this.dirty = true;
        this.element = element;
        this.name = name;
        this.strings = strings;
        this.parts = [];
        for (let i = 0; i < strings.length - 1; i++) {
            this.parts[i] = this._createPart();
        }
    }
    /**
     * Creates a single part. Override this to create a differnt type of part.
     */
    _createPart() {
        return new AttributePart(this);
    }
    _getValue() {
        const strings = this.strings;
        const l = strings.length - 1;
        let text = '';
        for (let i = 0; i < l; i++) {
            text += strings[i];
            const part = this.parts[i];
            if (part !== undefined) {
                const v = part.value;
                if (isPrimitive(v) || !isIterable(v)) {
                    text += typeof v === 'string' ? v : String(v);
                }
                else {
                    for (const t of v) {
                        text += typeof t === 'string' ? t : String(t);
                    }
                }
            }
        }
        text += strings[l];
        return text;
    }
    commit() {
        if (this.dirty) {
            this.dirty = false;
            this.element.setAttribute(this.name, this._getValue());
        }
    }
}
/**
 * A Part that controls all or part of an attribute value.
 */
class AttributePart {
    constructor(committer) {
        this.value = undefined;
        this.committer = committer;
    }
    setValue(value) {
        if (value !== noChange && (!isPrimitive(value) || value !== this.value)) {
            this.value = value;
            // If the value is a not a directive, dirty the committer so that it'll
            // call setAttribute. If the value is a directive, it'll dirty the
            // committer if it calls setValue().
            if (!isDirective(value)) {
                this.committer.dirty = true;
            }
        }
    }
    commit() {
        while (isDirective(this.value)) {
            const directive = this.value;
            this.value = noChange;
            directive(this);
        }
        if (this.value === noChange) {
            return;
        }
        this.committer.commit();
    }
}
/**
 * A Part that controls a location within a Node tree. Like a Range, NodePart
 * has start and end locations and can set and update the Nodes between those
 * locations.
 *
 * NodeParts support several value types: primitives, Nodes, TemplateResults,
 * as well as arrays and iterables of those types.
 */
class NodePart {
    constructor(options) {
        this.value = undefined;
        this.__pendingValue = undefined;
        this.options = options;
    }
    /**
     * Appends this part into a container.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    appendInto(container) {
        this.startNode = container.appendChild(createMarker());
        this.endNode = container.appendChild(createMarker());
    }
    /**
     * Inserts this part after the `ref` node (between `ref` and `ref`'s next
     * sibling). Both `ref` and its next sibling must be static, unchanging nodes
     * such as those that appear in a literal section of a template.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    insertAfterNode(ref) {
        this.startNode = ref;
        this.endNode = ref.nextSibling;
    }
    /**
     * Appends this part into a parent part.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    appendIntoPart(part) {
        part.__insert(this.startNode = createMarker());
        part.__insert(this.endNode = createMarker());
    }
    /**
     * Inserts this part after the `ref` part.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    insertAfterPart(ref) {
        ref.__insert(this.startNode = createMarker());
        this.endNode = ref.endNode;
        ref.endNode = this.startNode;
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        if (this.startNode.parentNode === null) {
            return;
        }
        while (isDirective(this.__pendingValue)) {
            const directive = this.__pendingValue;
            this.__pendingValue = noChange;
            directive(this);
        }
        const value = this.__pendingValue;
        if (value === noChange) {
            return;
        }
        if (isPrimitive(value)) {
            if (value !== this.value) {
                this.__commitText(value);
            }
        }
        else if (value instanceof TemplateResult) {
            this.__commitTemplateResult(value);
        }
        else if (value instanceof Node) {
            this.__commitNode(value);
        }
        else if (isIterable(value)) {
            this.__commitIterable(value);
        }
        else if (value === nothing) {
            this.value = nothing;
            this.clear();
        }
        else {
            // Fallback, will render the string representation
            this.__commitText(value);
        }
    }
    __insert(node) {
        this.endNode.parentNode.insertBefore(node, this.endNode);
    }
    __commitNode(value) {
        if (this.value === value) {
            return;
        }
        this.clear();
        this.__insert(value);
        this.value = value;
    }
    __commitText(value) {
        const node = this.startNode.nextSibling;
        value = value == null ? '' : value;
        // If `value` isn't already a string, we explicitly convert it here in case
        // it can't be implicitly converted - i.e. it's a symbol.
        const valueAsString = typeof value === 'string' ? value : String(value);
        if (node === this.endNode.previousSibling &&
            node.nodeType === 3 /* Node.TEXT_NODE */) {
            // If we only have a single text node between the markers, we can just
            // set its value, rather than replacing it.
            // TODO(justinfagnani): Can we just check if this.value is primitive?
            node.data = valueAsString;
        }
        else {
            this.__commitNode(document.createTextNode(valueAsString));
        }
        this.value = value;
    }
    __commitTemplateResult(value) {
        const template = this.options.templateFactory(value);
        if (this.value instanceof TemplateInstance &&
            this.value.template === template) {
            this.value.update(value.values);
        }
        else {
            // Make sure we propagate the template processor from the TemplateResult
            // so that we use its syntax extension, etc. The template factory comes
            // from the render function options so that it can control template
            // caching and preprocessing.
            const instance = new TemplateInstance(template, value.processor, this.options);
            const fragment = instance._clone();
            instance.update(value.values);
            this.__commitNode(fragment);
            this.value = instance;
        }
    }
    __commitIterable(value) {
        // For an Iterable, we create a new InstancePart per item, then set its
        // value to the item. This is a little bit of overhead for every item in
        // an Iterable, but it lets us recurse easily and efficiently update Arrays
        // of TemplateResults that will be commonly returned from expressions like:
        // array.map((i) => html`${i}`), by reusing existing TemplateInstances.
        // If _value is an array, then the previous render was of an
        // iterable and _value will contain the NodeParts from the previous
        // render. If _value is not an array, clear this part and make a new
        // array for NodeParts.
        if (!Array.isArray(this.value)) {
            this.value = [];
            this.clear();
        }
        // Lets us keep track of how many items we stamped so we can clear leftover
        // items from a previous render
        const itemParts = this.value;
        let partIndex = 0;
        let itemPart;
        for (const item of value) {
            // Try to reuse an existing part
            itemPart = itemParts[partIndex];
            // If no existing part, create a new one
            if (itemPart === undefined) {
                itemPart = new NodePart(this.options);
                itemParts.push(itemPart);
                if (partIndex === 0) {
                    itemPart.appendIntoPart(this);
                }
                else {
                    itemPart.insertAfterPart(itemParts[partIndex - 1]);
                }
            }
            itemPart.setValue(item);
            itemPart.commit();
            partIndex++;
        }
        if (partIndex < itemParts.length) {
            // Truncate the parts array so _value reflects the current state
            itemParts.length = partIndex;
            this.clear(itemPart && itemPart.endNode);
        }
    }
    clear(startNode = this.startNode) {
        removeNodes(this.startNode.parentNode, startNode.nextSibling, this.endNode);
    }
}
/**
 * Implements a boolean attribute, roughly as defined in the HTML
 * specification.
 *
 * If the value is truthy, then the attribute is present with a value of
 * ''. If the value is falsey, the attribute is removed.
 */
class BooleanAttributePart {
    constructor(element, name, strings) {
        this.value = undefined;
        this.__pendingValue = undefined;
        if (strings.length !== 2 || strings[0] !== '' || strings[1] !== '') {
            throw new Error('Boolean attributes can only contain a single expression');
        }
        this.element = element;
        this.name = name;
        this.strings = strings;
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        while (isDirective(this.__pendingValue)) {
            const directive = this.__pendingValue;
            this.__pendingValue = noChange;
            directive(this);
        }
        if (this.__pendingValue === noChange) {
            return;
        }
        const value = !!this.__pendingValue;
        if (this.value !== value) {
            if (value) {
                this.element.setAttribute(this.name, '');
            }
            else {
                this.element.removeAttribute(this.name);
            }
            this.value = value;
        }
        this.__pendingValue = noChange;
    }
}
/**
 * Sets attribute values for PropertyParts, so that the value is only set once
 * even if there are multiple parts for a property.
 *
 * If an expression controls the whole property value, then the value is simply
 * assigned to the property under control. If there are string literals or
 * multiple expressions, then the strings are expressions are interpolated into
 * a string first.
 */
class PropertyCommitter extends AttributeCommitter {
    constructor(element, name, strings) {
        super(element, name, strings);
        this.single =
            (strings.length === 2 && strings[0] === '' && strings[1] === '');
    }
    _createPart() {
        return new PropertyPart(this);
    }
    _getValue() {
        if (this.single) {
            return this.parts[0].value;
        }
        return super._getValue();
    }
    commit() {
        if (this.dirty) {
            this.dirty = false;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.element[this.name] = this._getValue();
        }
    }
}
class PropertyPart extends AttributePart {
}
// Detect event listener options support. If the `capture` property is read
// from the options object, then options are supported. If not, then the third
// argument to add/removeEventListener is interpreted as the boolean capture
// value so we should only pass the `capture` property.
let eventOptionsSupported = false;
// Wrap into an IIFE because MS Edge <= v41 does not support having try/catch
// blocks right into the body of a module
(() => {
    try {
        const options = {
            get capture() {
                eventOptionsSupported = true;
                return false;
            }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window.addEventListener('test', options, options);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window.removeEventListener('test', options, options);
    }
    catch (_e) {
        // event options not supported
    }
})();
class EventPart {
    constructor(element, eventName, eventContext) {
        this.value = undefined;
        this.__pendingValue = undefined;
        this.element = element;
        this.eventName = eventName;
        this.eventContext = eventContext;
        this.__boundHandleEvent = (e) => this.handleEvent(e);
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        while (isDirective(this.__pendingValue)) {
            const directive = this.__pendingValue;
            this.__pendingValue = noChange;
            directive(this);
        }
        if (this.__pendingValue === noChange) {
            return;
        }
        const newListener = this.__pendingValue;
        const oldListener = this.value;
        const shouldRemoveListener = newListener == null ||
            oldListener != null &&
                (newListener.capture !== oldListener.capture ||
                    newListener.once !== oldListener.once ||
                    newListener.passive !== oldListener.passive);
        const shouldAddListener = newListener != null && (oldListener == null || shouldRemoveListener);
        if (shouldRemoveListener) {
            this.element.removeEventListener(this.eventName, this.__boundHandleEvent, this.__options);
        }
        if (shouldAddListener) {
            this.__options = getOptions(newListener);
            this.element.addEventListener(this.eventName, this.__boundHandleEvent, this.__options);
        }
        this.value = newListener;
        this.__pendingValue = noChange;
    }
    handleEvent(event) {
        if (typeof this.value === 'function') {
            this.value.call(this.eventContext || this.element, event);
        }
        else {
            this.value.handleEvent(event);
        }
    }
}
// We copy options because of the inconsistent behavior of browsers when reading
// the third argument of add/removeEventListener. IE11 doesn't support options
// at all. Chrome 41 only reads `capture` if the argument is an object.
const getOptions = (o) => o &&
    (eventOptionsSupported ?
        { capture: o.capture, passive: o.passive, once: o.once } :
        o.capture);

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * The default TemplateFactory which caches Templates keyed on
 * result.type and result.strings.
 */
function templateFactory(result) {
    let templateCache = templateCaches.get(result.type);
    if (templateCache === undefined) {
        templateCache = {
            stringsArray: new WeakMap(),
            keyString: new Map()
        };
        templateCaches.set(result.type, templateCache);
    }
    let template = templateCache.stringsArray.get(result.strings);
    if (template !== undefined) {
        return template;
    }
    // If the TemplateStringsArray is new, generate a key from the strings
    // This key is shared between all templates with identical content
    const key = result.strings.join(marker);
    // Check if we already have a Template for this key
    template = templateCache.keyString.get(key);
    if (template === undefined) {
        // If we have not seen this key before, create a new Template
        template = new Template(result, result.getTemplateElement());
        // Cache the Template for this key
        templateCache.keyString.set(key, template);
    }
    // Cache all future queries for this TemplateStringsArray
    templateCache.stringsArray.set(result.strings, template);
    return template;
}
const templateCaches = new Map();

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const parts = new WeakMap();
/**
 * Renders a template result or other value to a container.
 *
 * To update a container with new values, reevaluate the template literal and
 * call `render` with the new result.
 *
 * @param result Any value renderable by NodePart - typically a TemplateResult
 *     created by evaluating a template tag like `html` or `svg`.
 * @param container A DOM parent to render to. The entire contents are either
 *     replaced, or efficiently updated if the same result type was previous
 *     rendered there.
 * @param options RenderOptions for the entire render tree rendered to this
 *     container. Render options must *not* change between renders to the same
 *     container, as those changes will not effect previously rendered DOM.
 */
const render = (result, container, options) => {
    let part = parts.get(container);
    if (part === undefined) {
        removeNodes(container, container.firstChild);
        parts.set(container, part = new NodePart(Object.assign({ templateFactory }, options)));
        part.appendInto(container);
    }
    part.setValue(result);
    part.commit();
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * Creates Parts when a template is instantiated.
 */
class DefaultTemplateProcessor {
    /**
     * Create parts for an attribute-position binding, given the event, attribute
     * name, and string literals.
     *
     * @param element The element containing the binding
     * @param name  The attribute name
     * @param strings The string literals. There are always at least two strings,
     *   event for fully-controlled bindings with a single expression.
     */
    handleAttributeExpressions(element, name, strings, options) {
        const prefix = name[0];
        if (prefix === '.') {
            const committer = new PropertyCommitter(element, name.slice(1), strings);
            return committer.parts;
        }
        if (prefix === '@') {
            return [new EventPart(element, name.slice(1), options.eventContext)];
        }
        if (prefix === '?') {
            return [new BooleanAttributePart(element, name.slice(1), strings)];
        }
        const committer = new AttributeCommitter(element, name, strings);
        return committer.parts;
    }
    /**
     * Create parts for a text-position binding.
     * @param templateFactory
     */
    handleTextExpression(options) {
        return new NodePart(options);
    }
}
const defaultTemplateProcessor = new DefaultTemplateProcessor();

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
// IMPORTANT: do not change the property name or the assignment expression.
// This line will be used in regexes to search for lit-html usage.
// TODO(justinfagnani): inject version number at build time
if (typeof window !== 'undefined') {
    (window['litHtmlVersions'] || (window['litHtmlVersions'] = [])).push('1.2.1');
}
/**
 * Interprets a template literal as an HTML template that can efficiently
 * render to and update a container.
 */
const html = (strings, ...values) => new TemplateResult(strings, values, 'html', defaultTemplateProcessor);
/**
 * Interprets a template literal as an SVG template that can efficiently
 * render to and update a container.
 */
const svg = (strings, ...values) => new SVGTemplateResult(strings, values, 'svg', defaultTemplateProcessor);

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
// Get a key to lookup in `templateCaches`.
const getTemplateCacheKey = (type, scopeName) => `${type}--${scopeName}`;
let compatibleShadyCSSVersion = true;
if (typeof window.ShadyCSS === 'undefined') {
    compatibleShadyCSSVersion = false;
}
else if (typeof window.ShadyCSS.prepareTemplateDom === 'undefined') {
    console.warn(`Incompatible ShadyCSS version detected. ` +
        `Please update to at least @webcomponents/webcomponentsjs@2.0.2 and ` +
        `@webcomponents/shadycss@1.3.1.`);
    compatibleShadyCSSVersion = false;
}
/**
 * Template factory which scopes template DOM using ShadyCSS.
 * @param scopeName {string}
 */
const shadyTemplateFactory = (scopeName) => (result) => {
    const cacheKey = getTemplateCacheKey(result.type, scopeName);
    let templateCache = templateCaches.get(cacheKey);
    if (templateCache === undefined) {
        templateCache = {
            stringsArray: new WeakMap(),
            keyString: new Map()
        };
        templateCaches.set(cacheKey, templateCache);
    }
    let template = templateCache.stringsArray.get(result.strings);
    if (template !== undefined) {
        return template;
    }
    const key = result.strings.join(marker);
    template = templateCache.keyString.get(key);
    if (template === undefined) {
        const element = result.getTemplateElement();
        if (compatibleShadyCSSVersion) {
            window.ShadyCSS.prepareTemplateDom(element, scopeName);
        }
        template = new Template(result, element);
        templateCache.keyString.set(key, template);
    }
    templateCache.stringsArray.set(result.strings, template);
    return template;
};
const TEMPLATE_TYPES = ['html', 'svg'];
/**
 * Removes all style elements from Templates for the given scopeName.
 */
const removeStylesFromLitTemplates = (scopeName) => {
    TEMPLATE_TYPES.forEach((type) => {
        const templates = templateCaches.get(getTemplateCacheKey(type, scopeName));
        if (templates !== undefined) {
            templates.keyString.forEach((template) => {
                const { element: { content } } = template;
                // IE 11 doesn't support the iterable param Set constructor
                const styles = new Set();
                Array.from(content.querySelectorAll('style')).forEach((s) => {
                    styles.add(s);
                });
                removeNodesFromTemplate(template, styles);
            });
        }
    });
};
const shadyRenderSet = new Set();
/**
 * For the given scope name, ensures that ShadyCSS style scoping is performed.
 * This is done just once per scope name so the fragment and template cannot
 * be modified.
 * (1) extracts styles from the rendered fragment and hands them to ShadyCSS
 * to be scoped and appended to the document
 * (2) removes style elements from all lit-html Templates for this scope name.
 *
 * Note, <style> elements can only be placed into templates for the
 * initial rendering of the scope. If <style> elements are included in templates
 * dynamically rendered to the scope (after the first scope render), they will
 * not be scoped and the <style> will be left in the template and rendered
 * output.
 */
const prepareTemplateStyles = (scopeName, renderedDOM, template) => {
    shadyRenderSet.add(scopeName);
    // If `renderedDOM` is stamped from a Template, then we need to edit that
    // Template's underlying template element. Otherwise, we create one here
    // to give to ShadyCSS, which still requires one while scoping.
    const templateElement = !!template ? template.element : document.createElement('template');
    // Move styles out of rendered DOM and store.
    const styles = renderedDOM.querySelectorAll('style');
    const { length } = styles;
    // If there are no styles, skip unnecessary work
    if (length === 0) {
        // Ensure prepareTemplateStyles is called to support adding
        // styles via `prepareAdoptedCssText` since that requires that
        // `prepareTemplateStyles` is called.
        //
        // ShadyCSS will only update styles containing @apply in the template
        // given to `prepareTemplateStyles`. If no lit Template was given,
        // ShadyCSS will not be able to update uses of @apply in any relevant
        // template. However, this is not a problem because we only create the
        // template for the purpose of supporting `prepareAdoptedCssText`,
        // which doesn't support @apply at all.
        window.ShadyCSS.prepareTemplateStyles(templateElement, scopeName);
        return;
    }
    const condensedStyle = document.createElement('style');
    // Collect styles into a single style. This helps us make sure ShadyCSS
    // manipulations will not prevent us from being able to fix up template
    // part indices.
    // NOTE: collecting styles is inefficient for browsers but ShadyCSS
    // currently does this anyway. When it does not, this should be changed.
    for (let i = 0; i < length; i++) {
        const style = styles[i];
        style.parentNode.removeChild(style);
        condensedStyle.textContent += style.textContent;
    }
    // Remove styles from nested templates in this scope.
    removeStylesFromLitTemplates(scopeName);
    // And then put the condensed style into the "root" template passed in as
    // `template`.
    const content = templateElement.content;
    if (!!template) {
        insertNodeIntoTemplate(template, condensedStyle, content.firstChild);
    }
    else {
        content.insertBefore(condensedStyle, content.firstChild);
    }
    // Note, it's important that ShadyCSS gets the template that `lit-html`
    // will actually render so that it can update the style inside when
    // needed (e.g. @apply native Shadow DOM case).
    window.ShadyCSS.prepareTemplateStyles(templateElement, scopeName);
    const style = content.querySelector('style');
    if (window.ShadyCSS.nativeShadow && style !== null) {
        // When in native Shadow DOM, ensure the style created by ShadyCSS is
        // included in initially rendered output (`renderedDOM`).
        renderedDOM.insertBefore(style.cloneNode(true), renderedDOM.firstChild);
    }
    else if (!!template) {
        // When no style is left in the template, parts will be broken as a
        // result. To fix this, we put back the style node ShadyCSS removed
        // and then tell lit to remove that node from the template.
        // There can be no style in the template in 2 cases (1) when Shady DOM
        // is in use, ShadyCSS removes all styles, (2) when native Shadow DOM
        // is in use ShadyCSS removes the style if it contains no content.
        // NOTE, ShadyCSS creates its own style so we can safely add/remove
        // `condensedStyle` here.
        content.insertBefore(condensedStyle, content.firstChild);
        const removes = new Set();
        removes.add(condensedStyle);
        removeNodesFromTemplate(template, removes);
    }
};
/**
 * Extension to the standard `render` method which supports rendering
 * to ShadowRoots when the ShadyDOM (https://github.com/webcomponents/shadydom)
 * and ShadyCSS (https://github.com/webcomponents/shadycss) polyfills are used
 * or when the webcomponentsjs
 * (https://github.com/webcomponents/webcomponentsjs) polyfill is used.
 *
 * Adds a `scopeName` option which is used to scope element DOM and stylesheets
 * when native ShadowDOM is unavailable. The `scopeName` will be added to
 * the class attribute of all rendered DOM. In addition, any style elements will
 * be automatically re-written with this `scopeName` selector and moved out
 * of the rendered DOM and into the document `<head>`.
 *
 * It is common to use this render method in conjunction with a custom element
 * which renders a shadowRoot. When this is done, typically the element's
 * `localName` should be used as the `scopeName`.
 *
 * In addition to DOM scoping, ShadyCSS also supports a basic shim for css
 * custom properties (needed only on older browsers like IE11) and a shim for
 * a deprecated feature called `@apply` that supports applying a set of css
 * custom properties to a given location.
 *
 * Usage considerations:
 *
 * * Part values in `<style>` elements are only applied the first time a given
 * `scopeName` renders. Subsequent changes to parts in style elements will have
 * no effect. Because of this, parts in style elements should only be used for
 * values that will never change, for example parts that set scope-wide theme
 * values or parts which render shared style elements.
 *
 * * Note, due to a limitation of the ShadyDOM polyfill, rendering in a
 * custom element's `constructor` is not supported. Instead rendering should
 * either done asynchronously, for example at microtask timing (for example
 * `Promise.resolve()`), or be deferred until the first time the element's
 * `connectedCallback` runs.
 *
 * Usage considerations when using shimmed custom properties or `@apply`:
 *
 * * Whenever any dynamic changes are made which affect
 * css custom properties, `ShadyCSS.styleElement(element)` must be called
 * to update the element. There are two cases when this is needed:
 * (1) the element is connected to a new parent, (2) a class is added to the
 * element that causes it to match different custom properties.
 * To address the first case when rendering a custom element, `styleElement`
 * should be called in the element's `connectedCallback`.
 *
 * * Shimmed custom properties may only be defined either for an entire
 * shadowRoot (for example, in a `:host` rule) or via a rule that directly
 * matches an element with a shadowRoot. In other words, instead of flowing from
 * parent to child as do native css custom properties, shimmed custom properties
 * flow only from shadowRoots to nested shadowRoots.
 *
 * * When using `@apply` mixing css shorthand property names with
 * non-shorthand names (for example `border` and `border-width`) is not
 * supported.
 */
const render$1 = (result, container, options) => {
    if (!options || typeof options !== 'object' || !options.scopeName) {
        throw new Error('The `scopeName` option is required.');
    }
    const scopeName = options.scopeName;
    const hasRendered = parts.has(container);
    const needsScoping = compatibleShadyCSSVersion &&
        container.nodeType === 11 /* Node.DOCUMENT_FRAGMENT_NODE */ &&
        !!container.host;
    // Handle first render to a scope specially...
    const firstScopeRender = needsScoping && !shadyRenderSet.has(scopeName);
    // On first scope render, render into a fragment; this cannot be a single
    // fragment that is reused since nested renders can occur synchronously.
    const renderContainer = firstScopeRender ? document.createDocumentFragment() : container;
    render(result, renderContainer, Object.assign({ templateFactory: shadyTemplateFactory(scopeName) }, options));
    // When performing first scope render,
    // (1) We've rendered into a fragment so that there's a chance to
    // `prepareTemplateStyles` before sub-elements hit the DOM
    // (which might cause them to render based on a common pattern of
    // rendering in a custom element's `connectedCallback`);
    // (2) Scope the template with ShadyCSS one time only for this scope.
    // (3) Render the fragment into the container and make sure the
    // container knows its `part` is the one we just rendered. This ensures
    // DOM will be re-used on subsequent renders.
    if (firstScopeRender) {
        const part = parts.get(renderContainer);
        parts.delete(renderContainer);
        // ShadyCSS might have style sheets (e.g. from `prepareAdoptedCssText`)
        // that should apply to `renderContainer` even if the rendered value is
        // not a TemplateInstance. However, it will only insert scoped styles
        // into the document if `prepareTemplateStyles` has already been called
        // for the given scope name.
        const template = part.value instanceof TemplateInstance ?
            part.value.template :
            undefined;
        prepareTemplateStyles(scopeName, renderContainer, template);
        removeNodes(container, container.firstChild);
        container.appendChild(renderContainer);
        parts.set(container, part);
    }
    // After elements have hit the DOM, update styling if this is the
    // initial render to this container.
    // This is needed whenever dynamic changes are made so it would be
    // safest to do every render; however, this would regress performance
    // so we leave it up to the user to call `ShadyCSS.styleElement`
    // for dynamic changes.
    if (!hasRendered && needsScoping) {
        window.ShadyCSS.styleElement(container.host);
    }
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
var _a;
/**
 * When using Closure Compiler, JSCompiler_renameProperty(property, object) is
 * replaced at compile time by the munged name for object[property]. We cannot
 * alias this function, so we have to use a small shim that has the same
 * behavior when not compiling.
 */
window.JSCompiler_renameProperty =
    (prop, _obj) => prop;
const defaultConverter = {
    toAttribute(value, type) {
        switch (type) {
            case Boolean:
                return value ? '' : null;
            case Object:
            case Array:
                // if the value is `null` or `undefined` pass this through
                // to allow removing/no change behavior.
                return value == null ? value : JSON.stringify(value);
        }
        return value;
    },
    fromAttribute(value, type) {
        switch (type) {
            case Boolean:
                return value !== null;
            case Number:
                return value === null ? null : Number(value);
            case Object:
            case Array:
                return JSON.parse(value);
        }
        return value;
    }
};
/**
 * Change function that returns true if `value` is different from `oldValue`.
 * This method is used as the default for a property's `hasChanged` function.
 */
const notEqual = (value, old) => {
    // This ensures (old==NaN, value==NaN) always returns false
    return old !== value && (old === old || value === value);
};
const defaultPropertyDeclaration = {
    attribute: true,
    type: String,
    converter: defaultConverter,
    reflect: false,
    hasChanged: notEqual
};
const STATE_HAS_UPDATED = 1;
const STATE_UPDATE_REQUESTED = 1 << 2;
const STATE_IS_REFLECTING_TO_ATTRIBUTE = 1 << 3;
const STATE_IS_REFLECTING_TO_PROPERTY = 1 << 4;
/**
 * The Closure JS Compiler doesn't currently have good support for static
 * property semantics where "this" is dynamic (e.g.
 * https://github.com/google/closure-compiler/issues/3177 and others) so we use
 * this hack to bypass any rewriting by the compiler.
 */
const finalized = 'finalized';
/**
 * Base element class which manages element properties and attributes. When
 * properties change, the `update` method is asynchronously called. This method
 * should be supplied by subclassers to render updates as desired.
 */
class UpdatingElement extends HTMLElement {
    constructor() {
        super();
        this._updateState = 0;
        this._instanceProperties = undefined;
        // Initialize to an unresolved Promise so we can make sure the element has
        // connected before first update.
        this._updatePromise = new Promise((res) => this._enableUpdatingResolver = res);
        /**
         * Map with keys for any properties that have changed since the last
         * update cycle with previous values.
         */
        this._changedProperties = new Map();
        /**
         * Map with keys of properties that should be reflected when updated.
         */
        this._reflectingProperties = undefined;
        this.initialize();
    }
    /**
     * Returns a list of attributes corresponding to the registered properties.
     * @nocollapse
     */
    static get observedAttributes() {
        // note: piggy backing on this to ensure we're finalized.
        this.finalize();
        const attributes = [];
        // Use forEach so this works even if for/of loops are compiled to for loops
        // expecting arrays
        this._classProperties.forEach((v, p) => {
            const attr = this._attributeNameForProperty(p, v);
            if (attr !== undefined) {
                this._attributeToPropertyMap.set(attr, p);
                attributes.push(attr);
            }
        });
        return attributes;
    }
    /**
     * Ensures the private `_classProperties` property metadata is created.
     * In addition to `finalize` this is also called in `createProperty` to
     * ensure the `@property` decorator can add property metadata.
     */
    /** @nocollapse */
    static _ensureClassProperties() {
        // ensure private storage for property declarations.
        if (!this.hasOwnProperty(JSCompiler_renameProperty('_classProperties', this))) {
            this._classProperties = new Map();
            // NOTE: Workaround IE11 not supporting Map constructor argument.
            const superProperties = Object.getPrototypeOf(this)._classProperties;
            if (superProperties !== undefined) {
                superProperties.forEach((v, k) => this._classProperties.set(k, v));
            }
        }
    }
    /**
     * Creates a property accessor on the element prototype if one does not exist
     * and stores a PropertyDeclaration for the property with the given options.
     * The property setter calls the property's `hasChanged` property option
     * or uses a strict identity check to determine whether or not to request
     * an update.
     *
     * This method may be overridden to customize properties; however,
     * when doing so, it's important to call `super.createProperty` to ensure
     * the property is setup correctly. This method calls
     * `getPropertyDescriptor` internally to get a descriptor to install.
     * To customize what properties do when they are get or set, override
     * `getPropertyDescriptor`. To customize the options for a property,
     * implement `createProperty` like this:
     *
     * static createProperty(name, options) {
     *   options = Object.assign(options, {myOption: true});
     *   super.createProperty(name, options);
     * }
     *
     * @nocollapse
     */
    static createProperty(name, options = defaultPropertyDeclaration) {
        // Note, since this can be called by the `@property` decorator which
        // is called before `finalize`, we ensure storage exists for property
        // metadata.
        this._ensureClassProperties();
        this._classProperties.set(name, options);
        // Do not generate an accessor if the prototype already has one, since
        // it would be lost otherwise and that would never be the user's intention;
        // Instead, we expect users to call `requestUpdate` themselves from
        // user-defined accessors. Note that if the super has an accessor we will
        // still overwrite it
        if (options.noAccessor || this.prototype.hasOwnProperty(name)) {
            return;
        }
        const key = typeof name === 'symbol' ? Symbol() : `__${name}`;
        const descriptor = this.getPropertyDescriptor(name, key, options);
        if (descriptor !== undefined) {
            Object.defineProperty(this.prototype, name, descriptor);
        }
    }
    /**
     * Returns a property descriptor to be defined on the given named property.
     * If no descriptor is returned, the property will not become an accessor.
     * For example,
     *
     *   class MyElement extends LitElement {
     *     static getPropertyDescriptor(name, key, options) {
     *       const defaultDescriptor =
     *           super.getPropertyDescriptor(name, key, options);
     *       const setter = defaultDescriptor.set;
     *       return {
     *         get: defaultDescriptor.get,
     *         set(value) {
     *           setter.call(this, value);
     *           // custom action.
     *         },
     *         configurable: true,
     *         enumerable: true
     *       }
     *     }
     *   }
     *
     * @nocollapse
     */
    static getPropertyDescriptor(name, key, _options) {
        return {
            // tslint:disable-next-line:no-any no symbol in index
            get() {
                return this[key];
            },
            set(value) {
                const oldValue = this[name];
                this[key] = value;
                this._requestUpdate(name, oldValue);
            },
            configurable: true,
            enumerable: true
        };
    }
    /**
     * Returns the property options associated with the given property.
     * These options are defined with a PropertyDeclaration via the `properties`
     * object or the `@property` decorator and are registered in
     * `createProperty(...)`.
     *
     * Note, this method should be considered "final" and not overridden. To
     * customize the options for a given property, override `createProperty`.
     *
     * @nocollapse
     * @final
     */
    static getPropertyOptions(name) {
        return this._classProperties && this._classProperties.get(name) ||
            defaultPropertyDeclaration;
    }
    /**
     * Creates property accessors for registered properties and ensures
     * any superclasses are also finalized.
     * @nocollapse
     */
    static finalize() {
        // finalize any superclasses
        const superCtor = Object.getPrototypeOf(this);
        if (!superCtor.hasOwnProperty(finalized)) {
            superCtor.finalize();
        }
        this[finalized] = true;
        this._ensureClassProperties();
        // initialize Map populated in observedAttributes
        this._attributeToPropertyMap = new Map();
        // make any properties
        // Note, only process "own" properties since this element will inherit
        // any properties defined on the superClass, and finalization ensures
        // the entire prototype chain is finalized.
        if (this.hasOwnProperty(JSCompiler_renameProperty('properties', this))) {
            const props = this.properties;
            // support symbols in properties (IE11 does not support this)
            const propKeys = [
                ...Object.getOwnPropertyNames(props),
                ...(typeof Object.getOwnPropertySymbols === 'function') ?
                    Object.getOwnPropertySymbols(props) :
                    []
            ];
            // This for/of is ok because propKeys is an array
            for (const p of propKeys) {
                // note, use of `any` is due to TypeSript lack of support for symbol in
                // index types
                // tslint:disable-next-line:no-any no symbol in index
                this.createProperty(p, props[p]);
            }
        }
    }
    /**
     * Returns the property name for the given attribute `name`.
     * @nocollapse
     */
    static _attributeNameForProperty(name, options) {
        const attribute = options.attribute;
        return attribute === false ?
            undefined :
            (typeof attribute === 'string' ?
                attribute :
                (typeof name === 'string' ? name.toLowerCase() : undefined));
    }
    /**
     * Returns true if a property should request an update.
     * Called when a property value is set and uses the `hasChanged`
     * option for the property if present or a strict identity check.
     * @nocollapse
     */
    static _valueHasChanged(value, old, hasChanged = notEqual) {
        return hasChanged(value, old);
    }
    /**
     * Returns the property value for the given attribute value.
     * Called via the `attributeChangedCallback` and uses the property's
     * `converter` or `converter.fromAttribute` property option.
     * @nocollapse
     */
    static _propertyValueFromAttribute(value, options) {
        const type = options.type;
        const converter = options.converter || defaultConverter;
        const fromAttribute = (typeof converter === 'function' ? converter : converter.fromAttribute);
        return fromAttribute ? fromAttribute(value, type) : value;
    }
    /**
     * Returns the attribute value for the given property value. If this
     * returns undefined, the property will *not* be reflected to an attribute.
     * If this returns null, the attribute will be removed, otherwise the
     * attribute will be set to the value.
     * This uses the property's `reflect` and `type.toAttribute` property options.
     * @nocollapse
     */
    static _propertyValueToAttribute(value, options) {
        if (options.reflect === undefined) {
            return;
        }
        const type = options.type;
        const converter = options.converter;
        const toAttribute = converter && converter.toAttribute ||
            defaultConverter.toAttribute;
        return toAttribute(value, type);
    }
    /**
     * Performs element initialization. By default captures any pre-set values for
     * registered properties.
     */
    initialize() {
        this._saveInstanceProperties();
        // ensures first update will be caught by an early access of
        // `updateComplete`
        this._requestUpdate();
    }
    /**
     * Fixes any properties set on the instance before upgrade time.
     * Otherwise these would shadow the accessor and break these properties.
     * The properties are stored in a Map which is played back after the
     * constructor runs. Note, on very old versions of Safari (<=9) or Chrome
     * (<=41), properties created for native platform properties like (`id` or
     * `name`) may not have default values set in the element constructor. On
     * these browsers native properties appear on instances and therefore their
     * default value will overwrite any element default (e.g. if the element sets
     * this.id = 'id' in the constructor, the 'id' will become '' since this is
     * the native platform default).
     */
    _saveInstanceProperties() {
        // Use forEach so this works even if for/of loops are compiled to for loops
        // expecting arrays
        this.constructor
            ._classProperties.forEach((_v, p) => {
            if (this.hasOwnProperty(p)) {
                const value = this[p];
                delete this[p];
                if (!this._instanceProperties) {
                    this._instanceProperties = new Map();
                }
                this._instanceProperties.set(p, value);
            }
        });
    }
    /**
     * Applies previously saved instance properties.
     */
    _applyInstanceProperties() {
        // Use forEach so this works even if for/of loops are compiled to for loops
        // expecting arrays
        // tslint:disable-next-line:no-any
        this._instanceProperties.forEach((v, p) => this[p] = v);
        this._instanceProperties = undefined;
    }
    connectedCallback() {
        // Ensure first connection completes an update. Updates cannot complete
        // before connection.
        this.enableUpdating();
    }
    enableUpdating() {
        if (this._enableUpdatingResolver !== undefined) {
            this._enableUpdatingResolver();
            this._enableUpdatingResolver = undefined;
        }
    }
    /**
     * Allows for `super.disconnectedCallback()` in extensions while
     * reserving the possibility of making non-breaking feature additions
     * when disconnecting at some point in the future.
     */
    disconnectedCallback() {
    }
    /**
     * Synchronizes property values when attributes change.
     */
    attributeChangedCallback(name, old, value) {
        if (old !== value) {
            this._attributeToProperty(name, value);
        }
    }
    _propertyToAttribute(name, value, options = defaultPropertyDeclaration) {
        const ctor = this.constructor;
        const attr = ctor._attributeNameForProperty(name, options);
        if (attr !== undefined) {
            const attrValue = ctor._propertyValueToAttribute(value, options);
            // an undefined value does not change the attribute.
            if (attrValue === undefined) {
                return;
            }
            // Track if the property is being reflected to avoid
            // setting the property again via `attributeChangedCallback`. Note:
            // 1. this takes advantage of the fact that the callback is synchronous.
            // 2. will behave incorrectly if multiple attributes are in the reaction
            // stack at time of calling. However, since we process attributes
            // in `update` this should not be possible (or an extreme corner case
            // that we'd like to discover).
            // mark state reflecting
            this._updateState = this._updateState | STATE_IS_REFLECTING_TO_ATTRIBUTE;
            if (attrValue == null) {
                this.removeAttribute(attr);
            }
            else {
                this.setAttribute(attr, attrValue);
            }
            // mark state not reflecting
            this._updateState = this._updateState & ~STATE_IS_REFLECTING_TO_ATTRIBUTE;
        }
    }
    _attributeToProperty(name, value) {
        // Use tracking info to avoid deserializing attribute value if it was
        // just set from a property setter.
        if (this._updateState & STATE_IS_REFLECTING_TO_ATTRIBUTE) {
            return;
        }
        const ctor = this.constructor;
        // Note, hint this as an `AttributeMap` so closure clearly understands
        // the type; it has issues with tracking types through statics
        // tslint:disable-next-line:no-unnecessary-type-assertion
        const propName = ctor._attributeToPropertyMap.get(name);
        if (propName !== undefined) {
            const options = ctor.getPropertyOptions(propName);
            // mark state reflecting
            this._updateState = this._updateState | STATE_IS_REFLECTING_TO_PROPERTY;
            this[propName] =
                // tslint:disable-next-line:no-any
                ctor._propertyValueFromAttribute(value, options);
            // mark state not reflecting
            this._updateState = this._updateState & ~STATE_IS_REFLECTING_TO_PROPERTY;
        }
    }
    /**
     * This private version of `requestUpdate` does not access or return the
     * `updateComplete` promise. This promise can be overridden and is therefore
     * not free to access.
     */
    _requestUpdate(name, oldValue) {
        let shouldRequestUpdate = true;
        // If we have a property key, perform property update steps.
        if (name !== undefined) {
            const ctor = this.constructor;
            const options = ctor.getPropertyOptions(name);
            if (ctor._valueHasChanged(this[name], oldValue, options.hasChanged)) {
                if (!this._changedProperties.has(name)) {
                    this._changedProperties.set(name, oldValue);
                }
                // Add to reflecting properties set.
                // Note, it's important that every change has a chance to add the
                // property to `_reflectingProperties`. This ensures setting
                // attribute + property reflects correctly.
                if (options.reflect === true &&
                    !(this._updateState & STATE_IS_REFLECTING_TO_PROPERTY)) {
                    if (this._reflectingProperties === undefined) {
                        this._reflectingProperties = new Map();
                    }
                    this._reflectingProperties.set(name, options);
                }
            }
            else {
                // Abort the request if the property should not be considered changed.
                shouldRequestUpdate = false;
            }
        }
        if (!this._hasRequestedUpdate && shouldRequestUpdate) {
            this._updatePromise = this._enqueueUpdate();
        }
    }
    /**
     * Requests an update which is processed asynchronously. This should
     * be called when an element should update based on some state not triggered
     * by setting a property. In this case, pass no arguments. It should also be
     * called when manually implementing a property setter. In this case, pass the
     * property `name` and `oldValue` to ensure that any configured property
     * options are honored. Returns the `updateComplete` Promise which is resolved
     * when the update completes.
     *
     * @param name {PropertyKey} (optional) name of requesting property
     * @param oldValue {any} (optional) old value of requesting property
     * @returns {Promise} A Promise that is resolved when the update completes.
     */
    requestUpdate(name, oldValue) {
        this._requestUpdate(name, oldValue);
        return this.updateComplete;
    }
    /**
     * Sets up the element to asynchronously update.
     */
    async _enqueueUpdate() {
        this._updateState = this._updateState | STATE_UPDATE_REQUESTED;
        try {
            // Ensure any previous update has resolved before updating.
            // This `await` also ensures that property changes are batched.
            await this._updatePromise;
        }
        catch (e) {
            // Ignore any previous errors. We only care that the previous cycle is
            // done. Any error should have been handled in the previous update.
        }
        const result = this.performUpdate();
        // If `performUpdate` returns a Promise, we await it. This is done to
        // enable coordinating updates with a scheduler. Note, the result is
        // checked to avoid delaying an additional microtask unless we need to.
        if (result != null) {
            await result;
        }
        return !this._hasRequestedUpdate;
    }
    get _hasRequestedUpdate() {
        return (this._updateState & STATE_UPDATE_REQUESTED);
    }
    get hasUpdated() {
        return (this._updateState & STATE_HAS_UPDATED);
    }
    /**
     * Performs an element update. Note, if an exception is thrown during the
     * update, `firstUpdated` and `updated` will not be called.
     *
     * You can override this method to change the timing of updates. If this
     * method is overridden, `super.performUpdate()` must be called.
     *
     * For instance, to schedule updates to occur just before the next frame:
     *
     * ```
     * protected async performUpdate(): Promise<unknown> {
     *   await new Promise((resolve) => requestAnimationFrame(() => resolve()));
     *   super.performUpdate();
     * }
     * ```
     */
    performUpdate() {
        // Mixin instance properties once, if they exist.
        if (this._instanceProperties) {
            this._applyInstanceProperties();
        }
        let shouldUpdate = false;
        const changedProperties = this._changedProperties;
        try {
            shouldUpdate = this.shouldUpdate(changedProperties);
            if (shouldUpdate) {
                this.update(changedProperties);
            }
            else {
                this._markUpdated();
            }
        }
        catch (e) {
            // Prevent `firstUpdated` and `updated` from running when there's an
            // update exception.
            shouldUpdate = false;
            // Ensure element can accept additional updates after an exception.
            this._markUpdated();
            throw e;
        }
        if (shouldUpdate) {
            if (!(this._updateState & STATE_HAS_UPDATED)) {
                this._updateState = this._updateState | STATE_HAS_UPDATED;
                this.firstUpdated(changedProperties);
            }
            this.updated(changedProperties);
        }
    }
    _markUpdated() {
        this._changedProperties = new Map();
        this._updateState = this._updateState & ~STATE_UPDATE_REQUESTED;
    }
    /**
     * Returns a Promise that resolves when the element has completed updating.
     * The Promise value is a boolean that is `true` if the element completed the
     * update without triggering another update. The Promise result is `false` if
     * a property was set inside `updated()`. If the Promise is rejected, an
     * exception was thrown during the update.
     *
     * To await additional asynchronous work, override the `_getUpdateComplete`
     * method. For example, it is sometimes useful to await a rendered element
     * before fulfilling this Promise. To do this, first await
     * `super._getUpdateComplete()`, then any subsequent state.
     *
     * @returns {Promise} The Promise returns a boolean that indicates if the
     * update resolved without triggering another update.
     */
    get updateComplete() {
        return this._getUpdateComplete();
    }
    /**
     * Override point for the `updateComplete` promise.
     *
     * It is not safe to override the `updateComplete` getter directly due to a
     * limitation in TypeScript which means it is not possible to call a
     * superclass getter (e.g. `super.updateComplete.then(...)`) when the target
     * language is ES5 (https://github.com/microsoft/TypeScript/issues/338).
     * This method should be overridden instead. For example:
     *
     *   class MyElement extends LitElement {
     *     async _getUpdateComplete() {
     *       await super._getUpdateComplete();
     *       await this._myChild.updateComplete;
     *     }
     *   }
     */
    _getUpdateComplete() {
        return this._updatePromise;
    }
    /**
     * Controls whether or not `update` should be called when the element requests
     * an update. By default, this method always returns `true`, but this can be
     * customized to control when to update.
     *
     * @param _changedProperties Map of changed properties with old values
     */
    shouldUpdate(_changedProperties) {
        return true;
    }
    /**
     * Updates the element. This method reflects property values to attributes.
     * It can be overridden to render and keep updated element DOM.
     * Setting properties inside this method will *not* trigger
     * another update.
     *
     * @param _changedProperties Map of changed properties with old values
     */
    update(_changedProperties) {
        if (this._reflectingProperties !== undefined &&
            this._reflectingProperties.size > 0) {
            // Use forEach so this works even if for/of loops are compiled to for
            // loops expecting arrays
            this._reflectingProperties.forEach((v, k) => this._propertyToAttribute(k, this[k], v));
            this._reflectingProperties = undefined;
        }
        this._markUpdated();
    }
    /**
     * Invoked whenever the element is updated. Implement to perform
     * post-updating tasks via DOM APIs, for example, focusing an element.
     *
     * Setting properties inside this method will trigger the element to update
     * again after this update cycle completes.
     *
     * @param _changedProperties Map of changed properties with old values
     */
    updated(_changedProperties) {
    }
    /**
     * Invoked when the element is first updated. Implement to perform one time
     * work on the element after update.
     *
     * Setting properties inside this method will trigger the element to update
     * again after this update cycle completes.
     *
     * @param _changedProperties Map of changed properties with old values
     */
    firstUpdated(_changedProperties) {
    }
}
_a = finalized;
/**
 * Marks class as having finished creating properties.
 */
UpdatingElement[_a] = true;

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const standardProperty = (options, element) => {
    // When decorating an accessor, pass it through and add property metadata.
    // Note, the `hasOwnProperty` check in `createProperty` ensures we don't
    // stomp over the user's accessor.
    if (element.kind === 'method' && element.descriptor &&
        !('value' in element.descriptor)) {
        return Object.assign(Object.assign({}, element), { finisher(clazz) {
                clazz.createProperty(element.key, options);
            } });
    }
    else {
        // createProperty() takes care of defining the property, but we still
        // must return some kind of descriptor, so return a descriptor for an
        // unused prototype field. The finisher calls createProperty().
        return {
            kind: 'field',
            key: Symbol(),
            placement: 'own',
            descriptor: {},
            // When @babel/plugin-proposal-decorators implements initializers,
            // do this instead of the initializer below. See:
            // https://github.com/babel/babel/issues/9260 extras: [
            //   {
            //     kind: 'initializer',
            //     placement: 'own',
            //     initializer: descriptor.initializer,
            //   }
            // ],
            initializer() {
                if (typeof element.initializer === 'function') {
                    this[element.key] = element.initializer.call(this);
                }
            },
            finisher(clazz) {
                clazz.createProperty(element.key, options);
            }
        };
    }
};
const legacyProperty = (options, proto, name) => {
    proto.constructor
        .createProperty(name, options);
};
/**
 * A property decorator which creates a LitElement property which reflects a
 * corresponding attribute value. A `PropertyDeclaration` may optionally be
 * supplied to configure property features.
 *
 * This decorator should only be used for public fields. Private or protected
 * fields should use the internalProperty decorator.
 *
 * @example
 *
 *     class MyElement {
 *       @property({ type: Boolean })
 *       clicked = false;
 *     }
 *
 * @ExportDecoratedItems
 */
function property(options) {
    // tslint:disable-next-line:no-any decorator
    return (protoOrDescriptor, name) => (name !== undefined) ?
        legacyProperty(options, protoOrDescriptor, name) :
        standardProperty(options, protoOrDescriptor);
}
/**
 * A property decorator that converts a class property into a getter that
 * executes a querySelector on the element's renderRoot.
 *
 * @param selector A DOMString containing one or more selectors to match.
 *
 * See: https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector
 *
 * @example
 *
 *     class MyElement {
 *       @query('#first')
 *       first;
 *
 *       render() {
 *         return html`
 *           <div id="first"></div>
 *           <div id="second"></div>
 *         `;
 *       }
 *     }
 *
 */
function query(selector) {
    return (protoOrDescriptor, 
    // tslint:disable-next-line:no-any decorator
    name) => {
        const descriptor = {
            get() {
                return this.renderRoot.querySelector(selector);
            },
            enumerable: true,
            configurable: true,
        };
        return (name !== undefined) ?
            legacyQuery(descriptor, protoOrDescriptor, name) :
            standardQuery(descriptor, protoOrDescriptor);
    };
}
const legacyQuery = (descriptor, proto, name) => {
    Object.defineProperty(proto, name, descriptor);
};
const standardQuery = (descriptor, element) => ({
    kind: 'method',
    placement: 'prototype',
    key: element.key,
    descriptor,
});

/**
@license
Copyright (c) 2019 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at
http://polymer.github.io/LICENSE.txt The complete set of authors may be found at
http://polymer.github.io/AUTHORS.txt The complete set of contributors may be
found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by Google as
part of the polymer project is also subject to an additional IP rights grant
found at http://polymer.github.io/PATENTS.txt
*/
const supportsAdoptingStyleSheets = ('adoptedStyleSheets' in Document.prototype) &&
    ('replace' in CSSStyleSheet.prototype);
const constructionToken = Symbol();
class CSSResult {
    constructor(cssText, safeToken) {
        if (safeToken !== constructionToken) {
            throw new Error('CSSResult is not constructable. Use `unsafeCSS` or `css` instead.');
        }
        this.cssText = cssText;
    }
    // Note, this is a getter so that it's lazy. In practice, this means
    // stylesheets are not created until the first element instance is made.
    get styleSheet() {
        if (this._styleSheet === undefined) {
            // Note, if `adoptedStyleSheets` is supported then we assume CSSStyleSheet
            // is constructable.
            if (supportsAdoptingStyleSheets) {
                this._styleSheet = new CSSStyleSheet();
                this._styleSheet.replaceSync(this.cssText);
            }
            else {
                this._styleSheet = null;
            }
        }
        return this._styleSheet;
    }
    toString() {
        return this.cssText;
    }
}
const textFromCSSResult = (value) => {
    if (value instanceof CSSResult) {
        return value.cssText;
    }
    else if (typeof value === 'number') {
        return value;
    }
    else {
        throw new Error(`Value passed to 'css' function must be a 'css' function result: ${value}. Use 'unsafeCSS' to pass non-literal values, but
            take care to ensure page security.`);
    }
};
/**
 * Template tag which which can be used with LitElement's `style` property to
 * set element styles. For security reasons, only literal string values may be
 * used. To incorporate non-literal values `unsafeCSS` may be used inside a
 * template string part.
 */
const css = (strings, ...values) => {
    const cssText = values.reduce((acc, v, idx) => acc + textFromCSSResult(v) + strings[idx + 1], strings[0]);
    return new CSSResult(cssText, constructionToken);
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
// IMPORTANT: do not change the property name or the assignment expression.
// This line will be used in regexes to search for LitElement usage.
// TODO(justinfagnani): inject version number at build time
(window['litElementVersions'] || (window['litElementVersions'] = []))
    .push('2.3.1');
/**
 * Sentinal value used to avoid calling lit-html's render function when
 * subclasses do not implement `render`
 */
const renderNotImplemented = {};
class LitElement extends UpdatingElement {
    /**
     * Return the array of styles to apply to the element.
     * Override this method to integrate into a style management system.
     *
     * @nocollapse
     */
    static getStyles() {
        return this.styles;
    }
    /** @nocollapse */
    static _getUniqueStyles() {
        // Only gather styles once per class
        if (this.hasOwnProperty(JSCompiler_renameProperty('_styles', this))) {
            return;
        }
        // Take care not to call `this.getStyles()` multiple times since this
        // generates new CSSResults each time.
        // TODO(sorvell): Since we do not cache CSSResults by input, any
        // shared styles will generate new stylesheet objects, which is wasteful.
        // This should be addressed when a browser ships constructable
        // stylesheets.
        const userStyles = this.getStyles();
        if (userStyles === undefined) {
            this._styles = [];
        }
        else if (Array.isArray(userStyles)) {
            // De-duplicate styles preserving the _last_ instance in the set.
            // This is a performance optimization to avoid duplicated styles that can
            // occur especially when composing via subclassing.
            // The last item is kept to try to preserve the cascade order with the
            // assumption that it's most important that last added styles override
            // previous styles.
            const addStyles = (styles, set) => styles.reduceRight((set, s) => 
            // Note: On IE set.add() does not return the set
            Array.isArray(s) ? addStyles(s, set) : (set.add(s), set), set);
            // Array.from does not work on Set in IE, otherwise return
            // Array.from(addStyles(userStyles, new Set<CSSResult>())).reverse()
            const set = addStyles(userStyles, new Set());
            const styles = [];
            set.forEach((v) => styles.unshift(v));
            this._styles = styles;
        }
        else {
            this._styles = [userStyles];
        }
    }
    /**
     * Performs element initialization. By default this calls `createRenderRoot`
     * to create the element `renderRoot` node and captures any pre-set values for
     * registered properties.
     */
    initialize() {
        super.initialize();
        this.constructor._getUniqueStyles();
        this.renderRoot =
            this.createRenderRoot();
        // Note, if renderRoot is not a shadowRoot, styles would/could apply to the
        // element's getRootNode(). While this could be done, we're choosing not to
        // support this now since it would require different logic around de-duping.
        if (window.ShadowRoot && this.renderRoot instanceof window.ShadowRoot) {
            this.adoptStyles();
        }
    }
    /**
     * Returns the node into which the element should render and by default
     * creates and returns an open shadowRoot. Implement to customize where the
     * element's DOM is rendered. For example, to render into the element's
     * childNodes, return `this`.
     * @returns {Element|DocumentFragment} Returns a node into which to render.
     */
    createRenderRoot() {
        return this.attachShadow({ mode: 'open' });
    }
    /**
     * Applies styling to the element shadowRoot using the `static get styles`
     * property. Styling will apply using `shadowRoot.adoptedStyleSheets` where
     * available and will fallback otherwise. When Shadow DOM is polyfilled,
     * ShadyCSS scopes styles and adds them to the document. When Shadow DOM
     * is available but `adoptedStyleSheets` is not, styles are appended to the
     * end of the `shadowRoot` to [mimic spec
     * behavior](https://wicg.github.io/construct-stylesheets/#using-constructed-stylesheets).
     */
    adoptStyles() {
        const styles = this.constructor._styles;
        if (styles.length === 0) {
            return;
        }
        // There are three separate cases here based on Shadow DOM support.
        // (1) shadowRoot polyfilled: use ShadyCSS
        // (2) shadowRoot.adoptedStyleSheets available: use it.
        // (3) shadowRoot.adoptedStyleSheets polyfilled: append styles after
        // rendering
        if (window.ShadyCSS !== undefined && !window.ShadyCSS.nativeShadow) {
            window.ShadyCSS.ScopingShim.prepareAdoptedCssText(styles.map((s) => s.cssText), this.localName);
        }
        else if (supportsAdoptingStyleSheets) {
            this.renderRoot.adoptedStyleSheets =
                styles.map((s) => s.styleSheet);
        }
        else {
            // This must be done after rendering so the actual style insertion is done
            // in `update`.
            this._needsShimAdoptedStyleSheets = true;
        }
    }
    connectedCallback() {
        super.connectedCallback();
        // Note, first update/render handles styleElement so we only call this if
        // connected after first update.
        if (this.hasUpdated && window.ShadyCSS !== undefined) {
            window.ShadyCSS.styleElement(this);
        }
    }
    /**
     * Updates the element. This method reflects property values to attributes
     * and calls `render` to render DOM via lit-html. Setting properties inside
     * this method will *not* trigger another update.
     * @param _changedProperties Map of changed properties with old values
     */
    update(changedProperties) {
        // Setting properties in `render` should not trigger an update. Since
        // updates are allowed after super.update, it's important to call `render`
        // before that.
        const templateResult = this.render();
        super.update(changedProperties);
        // If render is not implemented by the component, don't call lit-html render
        if (templateResult !== renderNotImplemented) {
            this.constructor
                .render(templateResult, this.renderRoot, { scopeName: this.localName, eventContext: this });
        }
        // When native Shadow DOM is used but adoptedStyles are not supported,
        // insert styling after rendering to ensure adoptedStyles have highest
        // priority.
        if (this._needsShimAdoptedStyleSheets) {
            this._needsShimAdoptedStyleSheets = false;
            this.constructor._styles.forEach((s) => {
                const style = document.createElement('style');
                style.textContent = s.cssText;
                this.renderRoot.appendChild(style);
            });
        }
    }
    /**
     * Invoked on each update to perform rendering tasks. This method may return
     * any value renderable by lit-html's NodePart - typically a TemplateResult.
     * Setting properties inside this method will *not* trigger the element to
     * update.
     */
    render() {
        return renderNotImplemented;
    }
}
/**
 * Ensure this class is marked as `finalized` as an optimization ensuring
 * it will not needlessly try to `finalize`.
 *
 * Note this property name is a string to prevent breaking Closure JS Compiler
 * optimizations. See updating-element.ts for more information.
 */
LitElement['finalized'] = true;
/**
 * Render method used to render the value to the element's DOM.
 * @param result The value to render.
 * @param container Node into which to render.
 * @param options Element name.
 * @nocollapse
 */
LitElement.render = render$1;

/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const previousValues = new WeakMap();
/**
 * For AttributeParts, sets the attribute if the value is defined and removes
 * the attribute if the value is undefined.
 *
 * For other part types, this directive is a no-op.
 */
const ifDefined = directive((value) => (part) => {
    const previousValue = previousValues.get(part);
    if (value === undefined && part instanceof AttributePart) {
        // If the value is undefined, remove the attribute, but only if the value
        // was previously defined.
        if (previousValue !== undefined || !previousValues.has(part)) {
            const name = part.committer.name;
            part.committer.element.removeAttribute(name);
        }
    }
    else if (value !== previousValue) {
        part.setValue(value);
    }
    previousValues.set(part, value);
});

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles = css `
:host{pointer-events:none}:host(:not([disabled]))>*{pointer-events:all}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
/**
 * This mixin function is designed to be applied to a class that inherits
 * from HTMLElement. It makes it easy for a custom element to coordinate with
 * the :focus-visible polyfill.
 *
 * NOTE(cdata): The code here was adapted from an example proposed with the
 * introduction of ShadowDOM support in the :focus-visible polyfill.
 *
 * @see https://github.com/WICG/focus-visible/pull/196
 * @param {Function} SuperClass The base class implementation to decorate with
 * implementation that coordinates with the :focus-visible polyfill
 */
const FocusVisiblePolyfillMixin = (SuperClass) => {
    var _a;
    const coordinateWithPolyfill = (instance) => {
        // If there is no shadow root, there is no need to coordinate with
        // the polyfill. If we already coordinated with the polyfill, we can
        // skip subsequent invokcations:
        if (instance.shadowRoot == null ||
            instance.hasAttribute('data-js-focus-visible')) {
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            return () => { };
        }
        // The polyfill might already be loaded. If so, we can apply it to
        // the shadow root immediately:
        if (self.applyFocusVisiblePolyfill) {
            self.applyFocusVisiblePolyfill(instance.shadowRoot);
        }
        else {
            const coordinationHandler = () => {
                if (self.applyFocusVisiblePolyfill && instance.shadowRoot) {
                    self.applyFocusVisiblePolyfill(instance.shadowRoot);
                }
                if (instance.manageAutoFocus) {
                    instance.manageAutoFocus();
                }
            };
            // Otherwise, wait for the polyfill to be loaded lazily. It might
            // never be loaded, but if it is then we can apply it to the
            // shadow root at the appropriate time by waiting for the ready
            // event:
            self.addEventListener('focus-visible-polyfill-ready', coordinationHandler, { once: true });
            return () => {
                self.removeEventListener('focus-visible-polyfill-ready', coordinationHandler);
            };
        }
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        return () => { };
    };
    const $endPolyfillCoordination = Symbol('endPolyfillCoordination');
    // IE11 doesn't natively support custom elements or JavaScript class
    // syntax The mixin implementation assumes that the user will take the
    // appropriate steps to support both:
    class FocusVisibleCoordinator extends SuperClass {
        constructor() {
            super(...arguments);
            this[_a] = null;
        }
        // Attempt to coordinate with the polyfill when connected to the
        // document:
        connectedCallback() {
            super.connectedCallback && super.connectedCallback();
            import('./focus-visible-cb5548cc.js');
            if (this[$endPolyfillCoordination] == null) {
                this[$endPolyfillCoordination] = coordinateWithPolyfill(this);
            }
        }
        disconnectedCallback() {
            super.disconnectedCallback && super.disconnectedCallback();
            // It's important to remove the polyfill event listener when we
            // disconnect, otherwise we will leak the whole element via window:
            if (this[$endPolyfillCoordination] != null) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                this[$endPolyfillCoordination]();
                this[$endPolyfillCoordination] = null;
            }
        }
    }
    _a = $endPolyfillCoordination;
    return FocusVisibleCoordinator;
};

/**
 * Focusable base class handles tabindex setting into shadowed elements automatically.
 *
 * This implementation is based heavily on the aybolit delegate-focus-mixin at
 * https://github.com/web-padawan/aybolit/blob/master/packages/core/src/mixins/delegate-focus-mixin.js
 */
class Focusable extends FocusVisiblePolyfillMixin(LitElement) {
    constructor() {
        super(...arguments);
        /**
         * Disable this control. It will not receive focus or events
         */
        this.disabled = false;
        /**
         * When this control is rendered, focus it automatically
         */
        this.autofocus = false;
        /**
         * The tab index to apply to this control. See general documentation about
         * the tabindex HTML property
         */
        this.tabIndex = 0;
        this.isShiftTabbing = false;
        this.newTabindex = 0;
        this.oldTabindex = 0;
    }
    static get styles() {
        return [styles];
    }
    get focusElement() {
        throw new Error('Must implement focusElement getter!');
    }
    focus() {
        if (this.disabled) {
            return;
        }
        this.focusElement.focus();
    }
    blur() {
        this.focusElement.blur();
    }
    manageAutoFocus() {
        if (this.autofocus) {
            /* Trick :focus-visible polyfill into thinking keyboard based focus */
            this.dispatchEvent(new KeyboardEvent('keydown', {
                code: 'Tab',
            }));
            this.focus();
        }
    }
    firstUpdated(changes) {
        super.firstUpdated(changes);
        this.manageAutoFocus();
        this.manageFocusIn();
        this.manageShiftTab();
    }
    manageFocusIn() {
        this.addEventListener('focusin', (event) => {
            if (event.composedPath()[0] === this) {
                this.handleFocus();
            }
        });
    }
    manageShiftTab() {
        this.addEventListener('keydown', (event) => {
            if (!event.defaultPrevented &&
                event.shiftKey &&
                event.code === 'Tab') {
                this.isShiftTabbing = true;
                HTMLElement.prototype.focus.apply(this);
                setTimeout(() => (this.isShiftTabbing = false), 0);
            }
        });
    }
    update(changedProperties) {
        if (changedProperties.has('disabled')) {
            this.handleDisabledChanged(this.disabled, changedProperties.get('disabled'));
        }
        if (changedProperties.has('tabIndex')) {
            // save value of tabindex, as it can be overridden to
            // undefined in case if the element is disabled
            this.newTabindex = this.tabIndex;
            this.handleTabIndexChanged(this.tabIndex);
        }
        super.update(changedProperties);
    }
    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('disabled')) {
            this.focusElement.disabled = this.disabled;
            if (this.disabled) {
                this.blur();
            }
        }
        if (changedProperties.has('tabIndex') &&
            this.newTabindex !== undefined) {
            this.focusElement.tabIndex = this.newTabindex;
            this.newTabindex = undefined;
        }
    }
    handleFocus() {
        if (this.isShiftTabbing) {
            return;
        }
        this.focusElement.focus();
    }
    handleDisabledChanged(disabled, oldDisabled) {
        if (disabled) {
            this.oldTabindex = this.tabIndex;
            this.tabIndex = -1;
            this.setAttribute('aria-disabled', 'true');
        }
        else if (oldDisabled) {
            this.tabIndex = this.oldTabindex;
            this.removeAttribute('aria-disabled');
        }
    }
    handleTabIndexChanged(tabindex) {
        if (this.disabled && tabindex) {
            if (this.tabIndex !== -1) {
                this.oldTabindex = this.tabIndex;
            }
            this.tabIndex = -1;
        }
    }
}
__decorate([
    property({ type: Boolean, reflect: true })
], Focusable.prototype, "disabled", void 0);
__decorate([
    property({ type: Boolean })
], Focusable.prototype, "autofocus", void 0);
__decorate([
    property({ type: Number, reflect: true })
], Focusable.prototype, "tabIndex", void 0);

const observedSlotElement = Symbol('observedSlotElement');
const slotElementObserver = Symbol('slotElementObserver');
const startObserving = Symbol('startObserving');
function ObserveSlotText(constructor, slotSelector = '#slot') {
    return class SlotTextObservingElement extends constructor {
        constructor() {
            super(...arguments);
            this.slotHasContent = false;
        }
        manageObservedSlot() {
            this[observedSlotElement] = (this[observedSlotElement] ||
                (this.shadowRoot
                    ? this.shadowRoot.querySelector(slotSelector)
                    : undefined));
            if (!this[observedSlotElement]) {
                return;
            }
            const slot = this[observedSlotElement];
            let assignedNodes = slot.assignedNodes
                ? slot.assignedNodes()
                : [...this.childNodes].filter((node) => {
                    const el = node;
                    return !el.hasAttribute('slot');
                });
            assignedNodes = assignedNodes.filter((node) => {
                if (node.tagName) {
                    return true;
                }
                return node.textContent ? node.textContent.trim() : false;
            });
            this.slotHasContent = assignedNodes.length > 0;
            this.requestUpdate();
        }
        firstUpdated(changedProperties) {
            super.firstUpdated(changedProperties);
            this.manageObservedSlot();
        }
        [startObserving]() {
            const config = { characterData: true, subtree: true };
            if (!this[slotElementObserver]) {
                const callback = (mutationsList) => {
                    for (const mutation of mutationsList) {
                        /* istanbul ignore else */
                        if (mutation.type === 'characterData') {
                            this.manageObservedSlot();
                        }
                    }
                };
                this[slotElementObserver] = new MutationObserver(callback);
            }
            this[slotElementObserver].observe(this, config);
        }
        connectedCallback() {
            super.connectedCallback();
            this[startObserving]();
        }
        disconnectedCallback() {
            /* istanbul ignore else */
            if (this[slotElementObserver]) {
                this[slotElementObserver].disconnect();
            }
            super.disconnectedCallback();
        }
    };
}

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
class ButtonBase extends ObserveSlotText(Focusable) {
    constructor() {
        super(...arguments);
        this.iconRight = false;
    }
    static get styles() {
        return [...super.styles];
    }
    get hasIcon() {
        return !!this.querySelector('[slot="icon"]');
    }
    get hasLabel() {
        return this.slotHasContent;
    }
    get focusElement() {
        /* istanbul ignore if */
        if (!this.shadowRoot) {
            return this;
        }
        return this.shadowRoot.querySelector('#button');
    }
    get buttonContent() {
        const icon = html `
            <slot name="icon"></slot>
        `;
        const content = [
            html `
                <div id="label" ?hidden=${!this.hasLabel}>
                    <slot
                        id="slot"
                        @slotchange=${this.manageObservedSlot}
                    ></slot>
                </div>
            `,
        ];
        if (!this.hasIcon) {
            return content;
        }
        this.iconRight ? content.push(icon) : content.unshift(icon);
        return content;
    }
    render() {
        return this.href && this.href.length > 0
            ? html `
                  <a
                      href="${this.href}"
                      id="button"
                      target=${ifDefined(this.target)}
                      aria-label=${ifDefined(this.label)}
                  >
                      ${this.buttonContent}
                  </a>
              `
            : html `
                  <button id="button" aria-label=${ifDefined(this.label)}>
                      ${this.buttonContent}
                  </button>
              `;
    }
}
__decorate([
    property()
], ButtonBase.prototype, "href", void 0);
__decorate([
    property()
], ButtonBase.prototype, "label", void 0);
__decorate([
    property()
], ButtonBase.prototype, "target", void 0);
__decorate([
    property({ type: Boolean, reflect: true, attribute: 'icon-right' })
], ButtonBase.prototype, "iconRight", void 0);

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$1 = css `
#button{position:relative;display:inline-flex;box-sizing:border-box;align-items:center;justify-content:center;overflow:visible;margin:0;text-transform:none;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;-webkit-appearance:button;vertical-align:top;transition:background var(--spectrum-global-animation-duration-100,.13s) ease-out,border-color var(--spectrum-global-animation-duration-100,.13s) ease-out,color var(--spectrum-global-animation-duration-100,.13s) ease-out,box-shadow var(--spectrum-global-animation-duration-100,.13s) ease-out;text-decoration:none;font-family:var(--spectrum-alias-body-text-font-family,var(--spectrum-global-font-family-base));line-height:1.3;cursor:pointer;border-width:var(--spectrum-button-primary-border-size,var(--spectrum-alias-border-size-thick));border-style:solid;border-radius:var(--spectrum-button-primary-border-radius,var(--spectrum-alias-border-radius-large));min-height:var(--spectrum-button-primary-height,var(--spectrum-alias-single-line-height));height:auto;min-width:var(--spectrum-button-primary-min-width);padding:var(--spectrum-global-dimension-size-50) calc(var(--spectrum-button-primary-padding-x,
var(--spectrum-global-dimension-size-200)) - var(--spectrum-button-primary-border-size,
var(--spectrum-alias-border-size-thick)));padding-bottom:calc(var(--spectrum-global-dimension-size-50) + 1px);padding-top:calc(var(--spectrum-global-dimension-size-50) - 1px);font-size:var(--spectrum-button-primary-text-size,var(--spectrum-alias-pill-button-text-size));font-weight:var(--spectrum-button-primary-text-font-weight,var(--spectrum-global-font-weight-bold))}#button:focus{outline:none}#button::-moz-focus-inner{border:0;border-style:none;padding:0;margin-top:-2px;margin-bottom:-2px}:host([disabled]) #button{cursor:default}::slotted([slot=icon]){max-height:100%;flex-shrink:0}#button:after{border-radius:calc(var(--spectrum-button-primary-border-radius,
var(--spectrum-alias-border-radius-large)) + var(--spectrum-alias-focus-ring-gap,
var(--spectrum-global-dimension-static-size-25)));content:"";display:block;position:absolute;left:0;right:0;bottom:0;top:0;margin:calc(var(--spectrum-alias-focus-ring-gap,
var(--spectrum-global-dimension-static-size-25))*-1);transition:box-shadow var(--spectrum-global-animation-duration-100,.13s) ease-out,margin var(--spectrum-global-animation-duration-100,.13s) ease-out}#button.focus-visible:after{margin:calc(var(--spectrum-alias-focus-ring-gap,
var(--spectrum-global-dimension-static-size-25))*-2)}#button:active,#button:hover{box-shadow:none}slot[name=icon]+#label{margin-left:var(--spectrum-button-primary-text-gap,var(--spectrum-global-dimension-size-100))}#label+::slotted([slot=icon]){margin-left:calc(var(--spectrum-button-primary-text-gap,
var(--spectrum-global-dimension-size-100))/2)}#label{align-self:center;justify-self:center;text-align:center;width:100%}#label:empty{display:none}#button.focus-visible:after,#button.is-focused:after{box-shadow:0 0 0 var(--spectrum-button-primary-focus-ring-size-key-focus,var(--spectrum-alias-focus-ring-size)) var(--spectrum-button-primary-focus-ring-color-key-focus,var(--spectrum-alias-focus-ring-color))}:host([variant=cta]) #button{background-color:var(--spectrum-button-cta-background-color,var(--spectrum-semantic-cta-color-background-default));border-color:var(--spectrum-button-cta-border-color,var(--spectrum-semantic-cta-color-background-default));color:var(--spectrum-button-cta-text-color,var(--spectrum-global-color-static-white))}:host([variant=cta]) #button:hover{background-color:var(--spectrum-button-cta-background-color-hover,var(--spectrum-semantic-cta-color-background-hover));border-color:var(--spectrum-button-cta-border-color-hover,var(--spectrum-semantic-cta-color-background-hover));color:var(--spectrum-button-cta-text-color-hover,var(--spectrum-global-color-static-white))}:host([variant=cta]) #button.focus-visible{background-color:var(--spectrum-button-cta-background-color-key-focus,var(--spectrum-semantic-cta-color-background-hover));border-color:var(--spectrum-button-cta-border-color-key-focus,var(--spectrum-semantic-cta-color-background-hover));color:var(--spectrum-button-cta-text-color-key-focus,var(--spectrum-global-color-static-white))}:host([variant=cta]) #button:active{background-color:var(--spectrum-button-cta-background-color-down,var(--spectrum-semantic-cta-color-background-down));border-color:var(--spectrum-button-cta-border-color-down,var(--spectrum-semantic-cta-color-background-down));color:var(--spectrum-button-cta-text-color-down,var(--spectrum-global-color-static-white))}:host([variant=cta][disabled]) #button{background-color:var(--spectrum-button-cta-background-color-disabled,var(--spectrum-global-color-gray-200));border-color:var(--spectrum-button-cta-border-color-disabled,var(--spectrum-global-color-gray-200));color:var(--spectrum-button-cta-text-color-disabled,var(--spectrum-global-color-gray-500))}:host([variant=primary]) #button{background-color:var(--spectrum-button-primary-background-color,var(--spectrum-alias-background-color-transparent));border-color:var(--spectrum-button-primary-border-color,var(--spectrum-global-color-gray-800));color:var(--spectrum-button-primary-text-color,var(--spectrum-global-color-gray-800))}:host([variant=primary]) #button:hover{background-color:var(--spectrum-button-primary-background-color-hover,var(--spectrum-global-color-gray-800));border-color:var(--spectrum-button-primary-border-color-hover,var(--spectrum-global-color-gray-800));color:var(--spectrum-button-primary-text-color-hover,var(--spectrum-global-color-gray-50))}:host([variant=primary]) #button.focus-visible{background-color:var(--spectrum-button-primary-background-color-key-focus,var(--spectrum-global-color-gray-800));border-color:var(--spectrum-button-primary-border-color-key-focus,var(--spectrum-global-color-gray-800));color:var(--spectrum-button-primary-text-color-key-focus,var(--spectrum-global-color-gray-50))}:host([variant=primary]) #button:active{background-color:var(--spectrum-button-primary-background-color-down,var(--spectrum-global-color-gray-900));border-color:var(--spectrum-button-primary-border-color-down,var(--spectrum-global-color-gray-900));color:var(--spectrum-button-primary-text-color-down,var(--spectrum-global-color-gray-50))}:host([variant=primary][disabled]) #button{background-color:var(--spectrum-button-primary-background-color-disabled,var(--spectrum-global-color-gray-200));border-color:var(--spectrum-button-primary-border-color-disabled,var(--spectrum-global-color-gray-200));color:var(--spectrum-button-primary-text-color-disabled,var(--spectrum-global-color-gray-500))}:host([variant=secondary]) #button{background-color:var(--spectrum-button-secondary-background-color,var(--spectrum-alias-background-color-transparent));border-color:var(--spectrum-button-secondary-border-color,var(--spectrum-global-color-gray-700));color:var(--spectrum-button-secondary-text-color,var(--spectrum-global-color-gray-700))}:host([variant=secondary]) #button:hover{background-color:var(--spectrum-button-secondary-background-color-hover,var(--spectrum-global-color-gray-700));border-color:var(--spectrum-button-secondary-border-color-hover,var(--spectrum-global-color-gray-700));color:var(--spectrum-button-secondary-text-color-hover,var(--spectrum-global-color-gray-50))}:host([variant=secondary]) #button.focus-visible{background-color:var(--spectrum-button-secondary-background-color-key-focus,var(--spectrum-global-color-gray-700));border-color:var(--spectrum-button-secondary-border-color-key-focus,var(--spectrum-global-color-gray-700));color:var(--spectrum-button-secondary-text-color-key-focus,var(--spectrum-global-color-gray-50))}:host([variant=secondary]) #button:active{background-color:var(--spectrum-button-secondary-background-color-down,var(--spectrum-global-color-gray-800));border-color:var(--spectrum-button-secondary-border-color-down,var(--spectrum-global-color-gray-800));color:var(--spectrum-button-secondary-text-color-down,var(--spectrum-global-color-gray-50))}:host([variant=secondary][disabled]) #button{background-color:var(--spectrum-button-secondary-background-color-disabled,var(--spectrum-global-color-gray-200));border-color:var(--spectrum-button-secondary-border-color-disabled,var(--spectrum-global-color-gray-200));color:var(--spectrum-button-secondary-text-color-disabled,var(--spectrum-global-color-gray-500))}:host([variant=negative]) #button{background-color:var(--spectrum-button-warning-background-color,var(--spectrum-alias-background-color-transparent));border-color:var(--spectrum-button-warning-border-color,var(--spectrum-semantic-negative-color-text-small));color:var(--spectrum-button-warning-text-color,var(--spectrum-semantic-negative-color-text-small))}:host([variant=negative]) #button:hover{background-color:var(--spectrum-button-warning-background-color-hover,var(--spectrum-semantic-negative-color-text-small));border-color:var(--spectrum-button-warning-border-color-hover,var(--spectrum-semantic-negative-color-text-small));color:var(--spectrum-button-warning-text-color-hover,var(--spectrum-global-color-gray-50))}:host([variant=negative]) #button.focus-visible{background-color:var(--spectrum-button-warning-background-color-key-focus,var(--spectrum-semantic-negative-color-text-small));border-color:var(--spectrum-button-warning-border-color-key-focus,var(--spectrum-semantic-negative-color-text-small));color:var(--spectrum-button-warning-text-color-key-focus,var(--spectrum-global-color-gray-50))}:host([variant=negative]) #button:active{background-color:var(--spectrum-button-warning-background-color-down,var(--spectrum-global-color-red-700));border-color:var(--spectrum-button-warning-border-color-down,var(--spectrum-global-color-red-700));color:var(--spectrum-button-warning-text-color-down,var(--spectrum-global-color-gray-50))}:host([variant=negative][disabled]) #button{background-color:var(--spectrum-button-warning-background-color-disabled,var(--spectrum-global-color-gray-200));border-color:var(--spectrum-button-warning-border-color-disabled,var(--spectrum-global-color-gray-200));color:var(--spectrum-button-warning-text-color-disabled,var(--spectrum-global-color-gray-500))}:host([variant=overBackground]) #button{background-color:var(--spectrum-button-over-background-background-color,var(--spectrum-alias-background-color-transparent));border-color:var(--spectrum-button-over-background-border-color,var(--spectrum-global-color-static-white));color:var(--spectrum-button-over-background-text-color,var(--spectrum-global-color-static-white))}:host([variant=overBackground]) #button.focus-visible,:host([variant=overBackground]) #button:hover{background-color:var(--spectrum-button-over-background-background-color-hover,var(--spectrum-global-color-static-white));border-color:var(--spectrum-button-over-background-border-color-hover,var(--spectrum-global-color-static-white));color:inherit}:host([variant=overBackground]) #button.focus-visible:after{box-shadow:0 0 0 var(--spectrum-alias-focus-ring-size,var(--spectrum-global-dimension-static-size-25)) var(--spectrum-button-over-background-border-color-key-focus,var(--spectrum-global-color-static-white))}:host([variant=overBackground]) #button:active{background-color:var(--spectrum-button-over-background-background-color-down,var(--spectrum-global-color-static-white));border-color:var(--spectrum-button-over-background-border-color-down,var(--spectrum-global-color-static-white));color:inherit}:host([variant=overBackground][disabled]) #button{background-color:var(--spectrum-button-over-background-background-color-disabled,hsla(0,0%,100%,.1));border-color:var(--spectrum-button-over-background-border-color-disabled,var(--spectrum-alias-border-color-transparent));color:var(--spectrum-button-over-background-text-color-disabled,hsla(0,0%,100%,.35))}:host([variant=overBackground][quiet]) #button{background-color:var(--spectrum-button-quiet-over-background-background-color,var(--spectrum-alias-background-color-transparent));border-color:var(--spectrum-button-quiet-over-background-border-color,var(--spectrum-alias-border-color-transparent));color:var(--spectrum-button-quiet-over-background-text-color,var(--spectrum-global-color-static-white))}:host([variant=overBackground][quiet]) #button.focus-visible,:host([variant=overBackground][quiet]) #button:hover{background-color:var(--spectrum-button-quiet-over-background-background-color-hover,hsla(0,0%,100%,.1));border-color:var(--spectrum-button-quiet-over-background-border-color-hover,var(--spectrum-alias-border-color-transparent));color:var(--spectrum-button-quiet-over-background-text-color-hover,var(--spectrum-global-color-static-white))}:host([variant=overBackground][quiet]) #button.focus-visible{box-shadow:none}:host([variant=overBackground][quiet]) #button.focus-visible:after{box-shadow:0 0 0 var(--spectrum-alias-focus-ring-size,var(--spectrum-global-dimension-static-size-25)) var(--spectrum-button-over-background-border-color-key-focus,var(--spectrum-global-color-static-white))}:host([variant=overBackground][quiet]) #button:active{background-color:var(--spectrum-button-quiet-over-background-background-color-down,hsla(0,0%,100%,.15));border-color:var(--spectrum-button-quiet-over-background-border-color-down,var(--spectrum-alias-border-color-transparent));color:var(--spectrum-button-quiet-over-background-text-color-down,var(--spectrum-global-color-static-white))}:host([variant=overBackground][quiet][disabled]) #button{background-color:var(--spectrum-button-quiet-over-background-background-color-disabled,var(--spectrum-alias-background-color-transparent));border-color:var(--spectrum-button-quiet-over-background-border-color-disabled,var(--spectrum-alias-border-color-transparent));color:var(--spectrum-button-quiet-over-background-text-color-disabled,hsla(0,0%,100%,.15))}:host([variant=primary][quiet]) #button{background-color:var(--spectrum-button-quiet-primary-background-color,var(--spectrum-alias-background-color-transparent));border-color:var(--spectrum-button-quiet-primary-border-color,var(--spectrum-alias-border-color-transparent));color:var(--spectrum-button-quiet-primary-text-color,var(--spectrum-global-color-gray-800))}:host([variant=primary][quiet]) #button:hover{background-color:var(--spectrum-button-quiet-primary-background-color-hover,var(--spectrum-global-color-gray-200));border-color:var(--spectrum-button-quiet-primary-border-color-hover,var(--spectrum-global-color-gray-200));color:var(--spectrum-button-quiet-primary-text-color-hover,var(--spectrum-global-color-gray-900))}:host([variant=primary][quiet]) #button.focus-visible{background-color:var(--spectrum-button-quiet-primary-background-color-key-focus,var(--spectrum-global-color-gray-200));border-color:var(--spectrum-button-quiet-primary-border-color-key-focus,var(--spectrum-global-color-gray-200));color:var(--spectrum-button-quiet-primary-text-color-key-focus,var(--spectrum-global-color-gray-900))}:host([variant=primary][quiet]) #button:active{background-color:var(--spectrum-button-quiet-primary-background-color-down,var(--spectrum-global-color-gray-300));border-color:var(--spectrum-button-quiet-primary-border-color-down,var(--spectrum-global-color-gray-300));color:var(--spectrum-button-quiet-primary-text-color-down,var(--spectrum-global-color-gray-900))}:host([variant=primary][quiet][disabled]) #button{background-color:var(--spectrum-button-quiet-primary-background-color-disabled,var(--spectrum-alias-background-color-transparent));border-color:var(--spectrum-button-quiet-primary-border-color-disabled,var(--spectrum-alias-border-color-transparent));color:var(--spectrum-button-quiet-primary-text-color-disabled,var(--spectrum-global-color-gray-500))}:host([variant=secondary][quiet]) #button{background-color:var(--spectrum-button-quiet-secondary-background-color,var(--spectrum-alias-background-color-transparent));border-color:var(--spectrum-button-quiet-secondary-border-color,var(--spectrum-alias-border-color-transparent));color:var(--spectrum-button-quiet-secondary-text-color,var(--spectrum-global-color-gray-700))}:host([variant=secondary][quiet]) #button:hover{background-color:var(--spectrum-button-quiet-secondary-background-color-hover,var(--spectrum-global-color-gray-200));border-color:var(--spectrum-button-quiet-secondary-border-color-hover,var(--spectrum-global-color-gray-200));color:var(--spectrum-button-quiet-secondary-text-color-hover,var(--spectrum-global-color-gray-800))}:host([variant=secondary][quiet]) #button.focus-visible{background-color:var(--spectrum-button-quiet-secondary-background-color-key-focus,var(--spectrum-global-color-gray-200));border-color:var(--spectrum-button-quiet-secondary-border-color-key-focus,var(--spectrum-global-color-gray-200));color:var(--spectrum-button-quiet-secondary-text-color-key-focus,var(--spectrum-global-color-gray-800))}:host([variant=secondary][quiet]) #button:active{background-color:var(--spectrum-button-quiet-secondary-background-color-down,var(--spectrum-global-color-gray-300));border-color:var(--spectrum-button-quiet-secondary-border-color-down,var(--spectrum-global-color-gray-300));color:var(--spectrum-button-quiet-secondary-text-color-down,var(--spectrum-global-color-gray-800))}:host([variant=secondary][quiet][disabled]) #button{background-color:var(--spectrum-button-quiet-secondary-background-color-disabled,var(--spectrum-alias-background-color-transparent));border-color:var(--spectrum-button-quiet-secondary-border-color-disabled,var(--spectrum-alias-border-color-transparent));color:var(--spectrum-button-quiet-secondary-text-color-disabled,var(--spectrum-global-color-gray-500))}:host([variant=negative][quiet]) #button{background-color:var(--spectrum-button-quiet-warning-background-color,var(--spectrum-alias-background-color-transparent));border-color:var(--spectrum-button-quiet-warning-border-color,var(--spectrum-alias-border-color-transparent));color:var(--spectrum-button-quiet-warning-text-color,var(--spectrum-semantic-negative-color-text-small))}:host([variant=negative][quiet]) #button:hover{background-color:var(--spectrum-button-quiet-warning-background-color-hover,var(--spectrum-global-color-gray-200));border-color:var(--spectrum-button-quiet-warning-border-color-hover,var(--spectrum-global-color-gray-200));color:var(--spectrum-button-quiet-warning-text-color-hover,var(--spectrum-global-color-red-700))}:host([variant=negative][quiet]) #button.focus-visible{background-color:var(--spectrum-button-quiet-warning-background-color-key-focus,var(--spectrum-global-color-gray-200));border-color:var(--spectrum-button-quiet-warning-border-color-key-focus,var(--spectrum-global-color-gray-200));color:var(--spectrum-button-quiet-warning-text-color-key-focus,var(--spectrum-global-color-red-700))}:host([variant=negative][quiet]) #button:active{background-color:var(--spectrum-button-quiet-warning-background-color-down,var(--spectrum-global-color-gray-300));border-color:var(--spectrum-button-quiet-warning-border-color-down,var(--spectrum-global-color-gray-300));color:var(--spectrum-button-quiet-warning-text-color-down,var(--spectrum-global-color-red-700))}:host([variant=negative][quiet][disabled]) #button{background-color:var(--spectrum-button-quiet-warning-background-color-disabled,var(--spectrum-alias-background-color-transparent));border-color:var(--spectrum-button-quiet-warning-border-color-disabled,var(--spectrum-alias-border-color-transparent));color:var(--spectrum-button-quiet-warning-text-color-disabled,var(--spectrum-global-color-gray-500))}:host{display:inline-flex;flex-direction:row;vertical-align:top}#button{display:flex;flex:1 1 auto;-webkit-appearance:none}slot[name=icon]::slotted(svg){fill:currentColor;stroke:currentColor;width:var(--spectrum-alias-workflow-icon-size,18px);height:var(--spectrum-alias-workflow-icon-size,18px)}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
/**
 * A Spectrum button control.
 * @element sp-button
 */
class Button extends ButtonBase {
    constructor() {
        super(...arguments);
        /**
         * The visual variant to apply to this button.
         */
        this.variant = 'cta';
        /**
         * There is a warning in place for this control
         */
        this.warning = false;
        /**
         * Style this button to be less obvious
         */
        this.quiet = false;
    }
    static get styles() {
        return [...super.styles, styles$1];
    }
}
__decorate([
    property({ reflect: true })
], Button.prototype, "variant", void 0);
__decorate([
    property({ type: Boolean, reflect: true })
], Button.prototype, "warning", void 0);
__decorate([
    property({ type: Boolean, reflect: true })
], Button.prototype, "quiet", void 0);

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$2 = css `
#button{display:inline-flex;box-sizing:border-box;align-items:center;justify-content:center;overflow:visible;margin:0;text-transform:none;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;-webkit-appearance:button;vertical-align:top;transition:background var(--spectrum-global-animation-duration-100,.13s) ease-out,border-color var(--spectrum-global-animation-duration-100,.13s) ease-out,color var(--spectrum-global-animation-duration-100,.13s) ease-out,box-shadow var(--spectrum-global-animation-duration-100,.13s) ease-out;text-decoration:none;font-family:var(--spectrum-alias-body-text-font-family,var(--spectrum-global-font-family-base));line-height:1.3;cursor:pointer;position:relative;height:var(--spectrum-actionbutton-height,var(--spectrum-alias-single-line-height));min-width:var(--spectrum-actionbutton-min-width,var(--spectrum-global-dimension-size-400));padding:0 calc(var(--spectrum-actionbutton-icon-padding-x,
var(--spectrum-global-dimension-size-85)) - var(--spectrum-actionbutton-border-size,
var(--spectrum-alias-border-size-thin)));border-radius:var(--spectrum-actionbutton-border-radius,var(--spectrum-alias-border-radius-regular));font-size:var(--spectrum-actionbutton-text-size,var(--spectrum-alias-font-size-default));font-weight:var(--spectrum-actionbutton-text-font-weight,var(--spectrum-alias-body-text-font-weight));background-color:var(--spectrum-actionbutton-background-color,var(--spectrum-global-color-gray-75));border:var(--spectrum-actionbutton-border-size,var(--spectrum-alias-border-size-thin)) solid var(--spectrum-actionbutton-border-color,var(--spectrum-alias-border-color));color:var(--spectrum-actionbutton-text-color,var(--spectrum-alias-text-color))}#button:focus{outline:none}#button::-moz-focus-inner{border:0;border-style:none;padding:0;margin-top:-2px;margin-bottom:-2px}:host([disabled]) #button{cursor:default;background-color:var(--spectrum-actionbutton-background-color-disabled,var(--spectrum-global-color-gray-200));border-color:var(--spectrum-actionbutton-border-color-disabled,var(--spectrum-global-color-gray-200));color:var(--spectrum-actionbutton-text-color-disabled,var(--spectrum-alias-text-color-disabled))}::slotted([slot=icon]){max-height:100%;color:var(--spectrum-actionbutton-icon-color,var(--spectrum-alias-icon-color))}slot[name=icon]+#label{padding-left:var(--spectrum-actionbutton-icon-padding-x,var(--spectrum-global-dimension-size-85));padding-right:calc(var(--spectrum-actionbutton-text-padding-x,
var(--spectrum-global-dimension-size-150)) - var(--spectrum-actionbutton-icon-padding-x,
var(--spectrum-global-dimension-size-85)))}.spectrum-Icon--sizeS:only-child{position:absolute;top:calc(50% - var(--spectrum-actionbutton-icon-size,
var(--spectrum-alias-workflow-icon-size))/2);left:calc(50% - var(--spectrum-actionbutton-icon-size,
var(--spectrum-alias-workflow-icon-size))/2)}#label:only-child{padding:0 calc(var(--spectrum-actionbutton-text-padding-x,
var(--spectrum-global-dimension-size-150)) - var(--spectrum-actionbutton-icon-padding-x,
var(--spectrum-global-dimension-size-85)))}#hold-affordance{position:absolute;right:var(--spectrum-actionbutton-hold-icon-padding-right,var(--spectrum-global-dimension-size-40));bottom:var(--spectrum-actionbutton-hold-icon-padding-bottom,var(--spectrum-global-dimension-size-40));color:var(--spectrum-actionbutton-hold-icon-color,var(--spectrum-alias-icon-color))}#label{align-self:center;justify-self:center;text-align:center;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#label:empty{display:none}:host([quiet]) #button{border-width:var(--spectrum-actionbutton-quiet-border-size,var(--spectrum-alias-border-size-thin));border-radius:var(--spectrum-actionbutton-quiet-border-radius,var(--spectrum-alias-border-radius-regular));font-size:var(--spectrum-actionbutton-quiet-text-size,var(--spectrum-alias-font-size-default));font-weight:var(--spectrum-actionbutton-quiet-text-font-weight,var(--spectrum-alias-body-text-font-weight));background-color:var(--spectrum-actionbutton-quiet-background-color,var(--spectrum-alias-background-color-transparent));border-color:var(--spectrum-actionbutton-quiet-border-color,var(--spectrum-alias-border-color-transparent));color:var(--spectrum-actionbutton-quiet-text-color,var(--spectrum-alias-text-color))}#button:hover{background-color:var(--spectrum-actionbutton-background-color-hover,var(--spectrum-global-color-gray-50));border-color:var(--spectrum-actionbutton-border-color-hover,var(--spectrum-alias-border-color-hover));color:var(--spectrum-actionbutton-text-color-hover,var(--spectrum-alias-text-color-hover))}#button:hover ::slotted([slot=icon]){color:var(--spectrum-actionbutton-icon-color-hover,var(--spectrum-alias-icon-color-hover))}#button:hover #hold-affordance{color:var(--spectrum-actionbutton-hold-icon-color-hover,var(--spectrum-alias-icon-color-hover))}#button.focus-visible{background-color:var(--spectrum-actionbutton-background-color-key-focus,var(--spectrum-global-color-gray-50));border-color:var(--spectrum-actionbutton-border-color-key-focus,var(--spectrum-alias-border-color-focus));box-shadow:0 0 0 var(--spectrum-button-primary-border-size-increase-key-focus,1px) var(--spectrum-actionbutton-border-color-key-focus,var(--spectrum-alias-border-color-focus));color:var(--spectrum-actionbutton-text-color-key-focus,var(--spectrum-alias-text-color-hover))}#button.focus-visible ::slotted([slot=icon]){color:var(--spectrum-actionbutton-icon-color-key-focus,var(--spectrum-alias-icon-color-focus))}#button.focus-visible #hold-affordance{color:var(--spectrum-actionbutton-hold-icon-color-key-focus,var(--spectrum-alias-icon-color-hover))}#button:active{background-color:var(--spectrum-actionbutton-background-color-down,var(--spectrum-global-color-gray-200));border-color:var(--spectrum-actionbutton-border-color-down,var(--spectrum-global-color-gray-400));color:var(--spectrum-actionbutton-text-color-down,var(--spectrum-alias-text-color-down))}#button:active #hold-affordance{color:var(--spectrum-actionbutton-hold-icon-color-down,var(--spectrum-alias-icon-color-down))}:host([disabled]) #button ::slotted([slot=icon]){color:var(--spectrum-actionbutton-icon-color-disabled,var(--spectrum-alias-icon-color-disabled))}:host([disabled]) #button #hold-affordance{color:var(--spectrum-actionbutton-hold-icon-color-disabled,var(--spectrum-alias-icon-color-disabled))}:host([selected]) #button{background-color:var(--spectrum-actionbutton-background-color-selected,var(--spectrum-global-color-gray-200));border-color:var(--spectrum-actionbutton-border-color-selected,var(--spectrum-global-color-gray-300));color:var(--spectrum-actionbutton-text-color-selected,var(--spectrum-alias-text-color))}:host([selected]) #button ::slotted([slot=icon]){color:var(--spectrum-actionbutton-icon-color-selected,var(--spectrum-alias-icon-color))}:host([selected]) #button.focus-visible{background-color:var(--spectrum-actionbutton-background-color-selected-key-focus,var(--spectrum-global-color-gray-200));border-color:var(--spectrum-actionbutton-border-color-selected-key-focus,var(--spectrum-alias-border-color-focus));color:var(--spectrum-actionbutton-text-color-selected-key-focus,var(--spectrum-alias-text-color-hover))}:host([selected]) #button.focus-visible ::slotted([slot=icon]){color:var(--spectrum-actionbutton-icon-color-selected-key-focus,var(--spectrum-alias-icon-color-hover))}:host([selected]) #button:hover{background-color:var(--spectrum-actionbutton-background-color-selected-hover,var(--spectrum-global-color-gray-200));border-color:var(--spectrum-actionbutton-border-color-selected-hover,var(--spectrum-global-color-gray-400));color:var(--spectrum-actionbutton-text-color-selected-hover,var(--spectrum-alias-text-color-hover))}:host([selected]) #button:hover ::slotted([slot=icon]){color:var(--spectrum-actionbutton-icon-color-selected-hover,var(--spectrum-alias-icon-color-hover))}:host([selected]) #button:active{background-color:var(--spectrum-actionbutton-background-color-selected-down,var(--spectrum-global-color-gray-200));border-color:var(--spectrum-actionbutton-border-color-selected-down,var(--spectrum-global-color-gray-400));color:var(--spectrum-actionbutton-text-color-selected-down,var(--spectrum-alias-text-color-down))}:host([selected]) #button:active ::slotted([slot=icon]){color:var(--spectrum-actionbutton-icon-color-selected-down,var(--spectrum-alias-icon-color-down))}:host([selected][disabled]) #button{background-color:var(--spectrum-actionbutton-background-color-selected-disabled,var(--spectrum-global-color-gray-200));border-color:var(--spectrum-actionbutton-border-color-selected-disabled,var(--spectrum-global-color-gray-200));color:var(--spectrum-actionbutton-text-color-selected-disabled,var(--spectrum-alias-text-color-disabled))}:host([selected][disabled]) #button ::slotted([slot=icon]){color:var(--spectrum-actionbutton-icon-color-selected-disabled,var(--spectrum-alias-icon-color-disabled))}:host([quiet]) #button:hover{background-color:var(--spectrum-actionbutton-quiet-background-color-hover,var(--spectrum-alias-background-color-transparent));border-color:var(--spectrum-actionbutton-quiet-border-color-hover,var(--spectrum-alias-border-color-transparent));color:var(--spectrum-actionbutton-quiet-text-color-hover,var(--spectrum-alias-text-color-hover))}:host([quiet]) #button.focus-visible{background-color:var(--spectrum-actionbutton-quiet-background-color-key-focus,var(--spectrum-alias-background-color-transparent));box-shadow:0 0 0 1px var(--spectrum-actionbutton-quiet-border-color-key-focus,var(--spectrum-alias-border-color-focus));border-color:var(--spectrum-actionbutton-quiet-border-color-key-focus,var(--spectrum-alias-border-color-focus));color:var(--spectrum-actionbutton-quiet-text-color-key-focus,var(--spectrum-alias-text-color-hover))}:host([quiet]) #button:active{background-color:var(--spectrum-actionbutton-quiet-background-color-down,var(--spectrum-global-color-gray-300));border-color:var(--spectrum-actionbutton-quiet-border-color-down,var(--spectrum-global-color-gray-300));color:var(--spectrum-actionbutton-quiet-text-color-down,var(--spectrum-alias-text-color-down))}:host([quiet][disabled]) #button{background-color:var(--spectrum-actionbutton-quiet-background-color-disabled,var(--spectrum-alias-background-color-transparent));border-color:var(--spectrum-actionbutton-quiet-border-color-disabled,var(--spectrum-alias-border-color-transparent));color:var(--spectrum-actionbutton-quiet-text-color-disabled,var(--spectrum-alias-text-color-disabled))}:host([quiet][selected]) #button{background-color:var(--spectrum-actionbutton-quiet-background-color-selected,var(--spectrum-global-color-gray-300));border-color:var(--spectrum-actionbutton-quiet-border-color-selected,var(--spectrum-global-color-gray-300));color:var(--spectrum-actionbutton-quiet-text-color-selected,var(--spectrum-alias-text-color))}:host([quiet][selected]) #button.focus-visible{background-color:var(--spectrum-actionbutton-quiet-background-color-selected-key-focus,var(--spectrum-global-color-gray-300));border-color:var(--spectrum-actionbutton-quiet-border-color-selected-key-focus,var(--spectrum-alias-border-color-focus));color:var(--spectrum-actionbutton-quiet-text-color-selected-key-focus,var(--spectrum-alias-text-color-hover))}:host([quiet][selected]) #button:hover{background-color:var(--spectrum-actionbutton-quiet-background-color-selected-hover,var(--spectrum-global-color-gray-300));border-color:var(--spectrum-actionbutton-quiet-border-color-selected-hover,var(--spectrum-global-color-gray-300));color:var(--spectrum-actionbutton-quiet-text-color-selected-hover,var(--spectrum-alias-text-color-hover))}:host([quiet][selected]) #button:active{background-color:var(--spectrum-actionbutton-quiet-background-color-selected-down,var(--spectrum-global-color-gray-300));border-color:var(--spectrum-actionbutton-quiet-border-color-selected-down,var(--spectrum-global-color-gray-300));color:var(--spectrum-actionbutton-quiet-text-color-selected-down,var(--spectrum-alias-text-color-down))}:host([quiet][selected][disabled]) #button{background-color:var(--spectrum-actionbutton-quiet-background-color-selected-disabled,var(--spectrum-global-color-gray-200));border-color:var(--spectrum-actionbutton-quiet-border-color-selected-disabled,var(--spectrum-global-color-gray-200));color:var(--spectrum-actionbutton-quiet-text-color-selected-disabled,var(--spectrum-alias-text-color-disabled))}:host{display:inline-flex;flex-direction:row;vertical-align:top}#button{display:flex;flex:1 1 auto;-webkit-appearance:none}slot[name=icon]::slotted(svg){fill:currentColor;stroke:currentColor;width:var(--spectrum-alias-workflow-icon-size,18px);height:var(--spectrum-alias-workflow-icon-size,18px)}:host(.spectrum-Dropdown-trigger) #button{text-align:left}::slotted([slot=icon]){flex-shrink:0}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
class ActionButton extends ButtonBase {
    constructor() {
        super(...arguments);
        this.quiet = false;
        this.selected = false;
        this.holdAffordance = false;
    }
    static get styles() {
        return [...super.styles, styles$2];
    }
}
__decorate([
    property({ type: Boolean, reflect: true })
], ActionButton.prototype, "quiet", void 0);
__decorate([
    property({ type: Boolean, reflect: true })
], ActionButton.prototype, "selected", void 0);
__decorate([
    property({ type: Boolean, reflect: true, attribute: 'hold-affordance' })
], ActionButton.prototype, "holdAffordance", void 0);

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$3 = css `
#button{position:relative;display:inline-flex;box-sizing:border-box;align-items:center;justify-content:center;overflow:visible;text-transform:none;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;-webkit-appearance:button;vertical-align:top;transition:background var(--spectrum-global-animation-duration-100,.13s) ease-out,border-color var(--spectrum-global-animation-duration-100,.13s) ease-out,color var(--spectrum-global-animation-duration-100,.13s) ease-out,box-shadow var(--spectrum-global-animation-duration-100,.13s) ease-out;text-decoration:none;font-family:var(--spectrum-alias-body-text-font-family,var(--spectrum-global-font-family-base));line-height:1.3;cursor:pointer;width:var(--spectrum-clearbutton-medium-width,var(--spectrum-alias-single-line-height));height:var(--spectrum-clearbutton-medium-height,var(--spectrum-alias-single-line-height));border-radius:100%;padding:0;margin:0;border:none;background-color:var(--spectrum-clearbutton-medium-background-color,var(--spectrum-alias-background-color-transparent));color:var(--spectrum-clearbutton-medium-icon-color,var(--spectrum-alias-icon-color))}#button:focus{outline:none}#button::-moz-focus-inner{border:0;border-style:none;padding:0;margin-top:-2px;margin-bottom:-2px}#button:disabled{cursor:default}.spectrum-Icon{max-height:100%;flex-shrink:0}:host([variant=overBackground]) #button.focus-visible:after{margin:calc(var(--spectrum-alias-focus-ring-gap,
var(--spectrum-global-dimension-static-size-25))*-1);box-shadow:0 0 0 var(--spectrum-alias-focus-ring-size,var(--spectrum-global-dimension-static-size-25)) var(--spectrum-button-over-background-border-color-key-focus,var(--spectrum-global-color-static-white))}.spectrum-ClearButton--small{width:var(--spectrum-clearbutton-small-width,var(--spectrum-global-dimension-size-300));height:var(--spectrum-clearbutton-small-height,var(--spectrum-global-dimension-size-300))}#button:hover{background-color:var(--spectrum-clearbutton-medium-background-color-hover,var(--spectrum-alias-background-color-transparent));color:var(--spectrum-clearbutton-medium-icon-color-hover,var(--spectrum-alias-icon-color-hover))}#button:active{background-color:var(--spectrum-clearbutton-medium-background-color-down,var(--spectrum-alias-background-color-transparent));color:var(--spectrum-clearbutton-medium-icon-color-down,var(--spectrum-alias-icon-color-down))}#button.focus-visible{background-color:var(--spectrum-clearbutton-medium-background-color-key-focus,var(--spectrum-alias-background-color-transparent));color:var(--spectrum-clearbutton-medium-icon-color-key-focus,var(--spectrum-alias-icon-color-focus))}#button.is-disabled,#button:disabled{background-color:var(--spectrum-clearbutton-medium-background-color-disabled,var(--spectrum-alias-background-color-transparent));color:var(--spectrum-clearbutton-medium-icon-color-disabled,var(--spectrum-alias-icon-color-disabled))}:host([variant=overBackground]) #button{background-color:var(--spectrum-button-quiet-over-background-background-color,var(--spectrum-alias-background-color-transparent));border-color:var(--spectrum-button-quiet-over-background-border-color,var(--spectrum-alias-border-color-transparent));color:var(--spectrum-button-quiet-over-background-text-color,var(--spectrum-global-color-static-white))}:host([variant=overBackground]) #button.focus-visible,:host([variant=overBackground]) #button:hover{background-color:var(--spectrum-button-quiet-over-background-background-color-hover,hsla(0,0%,100%,.1));border-color:var(--spectrum-button-quiet-over-background-border-color-hover,var(--spectrum-alias-border-color-transparent));color:var(--spectrum-button-quiet-over-background-text-color-hover,var(--spectrum-global-color-static-white))}:host([variant=overBackground]) #button.focus-visible{box-shadow:none}:host([variant=overBackground]) #button:active{background-color:var(--spectrum-button-quiet-over-background-background-color-down,hsla(0,0%,100%,.15));border-color:var(--spectrum-button-quiet-over-background-border-color-down,var(--spectrum-alias-border-color-transparent));color:var(--spectrum-button-quiet-over-background-text-color-down,var(--spectrum-global-color-static-white))}:host([variant=overBackground]) #button.is-disabled,:host([variant=overBackground]) #button:disabled{background-color:var(--spectrum-button-quiet-over-background-background-color-disabled,var(--spectrum-alias-background-color-transparent));border-color:var(--spectrum-button-quiet-over-background-border-color-disabled,var(--spectrum-alias-border-color-transparent));color:var(--spectrum-button-quiet-over-background-text-color-disabled,hsla(0,0%,100%,.15))}:host{display:inline-flex;flex-direction:row;vertical-align:top}#button{display:flex;flex:1 1 auto;-webkit-appearance:none}slot[name=icon]::slotted(svg){fill:currentColor;stroke:currentColor;width:var(--spectrum-alias-workflow-icon-size,18px);height:var(--spectrum-alias-workflow-icon-size,18px)}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$4 = css `
.cross-medium{width:var(--spectrum-icon-cross-medium-width,var(--spectrum-global-dimension-size-100));height:var(--spectrum-icon-cross-medium-height,var(--spectrum-global-dimension-size-100))}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
class ClearButton extends ButtonBase {
    constructor() {
        super(...arguments);
        /**
         * The visual variant to apply to this button.
         */
        this.variant = '';
    }
    static get styles() {
        return [...super.styles, styles$3, styles$4];
    }
    get buttonContent() {
        return [
            html `
                <sp-icons-medium></sp-icons-medium>
                <sp-icon
                    slot="icon"
                    class="icon cross-medium"
                    size="s"
                    name="ui:CrossLarge"
                ></sp-icon>
            `,
        ];
    }
}
__decorate([
    property({ reflect: true })
], ClearButton.prototype, "variant", void 0);

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
/* istanbul ignore else */
if (!customElements.get('sp-action-button')) {
    customElements.define('sp-action-button', ActionButton);
}
/* istanbul ignore else */
if (!customElements.get('sp-clear-button')) {
    customElements.define('sp-clear-button', ClearButton);
}
/* istanbul ignore else */
if (!customElements.get('sp-button')) {
    customElements.define('sp-button', Button);
}

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$5 = css `
:host{display:block;width:240px;--spectrum-web-component-sidenav-font-weight:var(--spectrum-sidenav-item-font-weight,400)}:host([variant=multilevel]){--spectrum-web-component-sidenav-font-weight:var(--spectrum-sidenav-multilevel-main-item-font-weight,700)}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const getActiveElement = (el) => {
    return el.getRootNode().activeElement;
};

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$6 = css `
#list{margin:0;padding:0}#list,:host{list-style-type:none}:host{margin:var(--spectrum-sidenav-item-gap,var(--spectrum-global-dimension-size-50)) 0}#itemLink{position:relative;display:inline-flex;align-items:center;justify-content:left;box-sizing:border-box;width:100%;min-height:var(--spectrum-sidenav-item-height,var(--spectrum-alias-single-line-height));padding:var(--spectrum-global-dimension-size-65) var(--spectrum-sidenav-item-padding-x,var(--spectrum-global-dimension-size-150));border-radius:var(--spectrum-sidenav-item-border-radius,var(--spectrum-alias-border-radius-regular));font-size:var(--spectrum-sidenav-item-text-size,var(--spectrum-alias-font-size-default));font-weight:var(--spectrum-sidenav-item-font-weight,var(--spectrum-global-font-weight-regular));font-style:normal;text-decoration:none;word-break:break-word;-webkit-hyphens:auto;hyphens:auto;cursor:pointer;transition:background-color var(--spectrum-global-animation-duration-100,.13s) ease-out,color var(--spectrum-global-animation-duration-100,.13s) ease-out;background-color:var(--spectrum-sidenav-item-background-color,var(--spectrum-alias-background-color-transparent));color:var(--spectrum-sidenav-item-text-color,var(--spectrum-alias-text-color))}#itemLink:focus{outline:none}#itemLink.focus-visible:before{content:"";position:absolute;top:0;left:0;right:0;bottom:0;border-color:transparent;border-radius:var(--spectrum-sidenav-item-border-radius,var(--spectrum-alias-border-radius-regular));border:var(--spectrum-tabs-focus-ring-size,var(--spectrum-alias-border-size-thick)) solid var(--spectrum-sidenav-item-border-color-key-focus,var(--spectrum-alias-border-color-focus))}#itemLink .spectrum-SideNav-itemIcon{margin-right:var(--spectrum-sidenav-icon-gap,var(--spectrum-global-dimension-size-100))}:host([selected])>#itemLink{color:var(--spectrum-sidenav-item-text-color-selected,var(--spectrum-alias-text-color-hover));background-color:var(--spectrum-sidenav-item-background-color-selected,var(--spectrum-alias-highlight-hover))}.is-active>#itemLink{background-color:var(--spectrum-sidenav-item-background-color-down,var(--spectrum-alias-highlight-hover))}:host([disabled]) #itemLink{background-color:var(--spectrum-sidenav-item-background-color-disabled,var(--spectrum-alias-background-color-transparent));color:var(--spectrum-sidenav-item-text-color-disabled,var(--spectrum-alias-text-color-disabled));cursor:default;pointer-events:none}#itemLink:hover{background-color:var(--spectrum-sidenav-item-background-color-hover,var(--spectrum-alias-highlight-hover));color:var(--spectrum-sidenav-item-text-color-hover,var(--spectrum-alias-text-color-hover))}#itemLink:active{background-color:var(--spectrum-sidenav-item-background-color-down,var(--spectrum-alias-highlight-hover))}#itemLink.focus-visible{background-color:var(--spectrum-sidenav-item-background-color-key-focus,var(--spectrum-alias-highlight-hover));color:var(--spectrum-sidenav-item-text-color-key-focus,var(--spectrum-alias-text-color-hover))}:host([multiLevel]){--spectrum-web-component-sidenav-font-weight:var(--spectrum-sidenav-item-font-weight,700)}::slotted(sp-sidenav-item){--spectrum-web-component-sidenav-font-weight:var(--spectrum-sidenav-item-font-weight,400)}#itemLink{font-weight:var(--spectrum-web-component-sidenav-font-weight)}#itemLink[data-level="1"]{padding-left:calc(var(--spectrum-sidenav-multilevel-item-indentation-level1,
var(--spectrum-global-dimension-size-150)) + var(--spectrum-sidenav-item-padding-x,
var(--spectrum-global-dimension-size-150)))}#itemLink[data-level="2"]{padding-left:calc(var(--spectrum-sidenav-multilevel-item-indentation-level2,
var(--spectrum-global-dimension-size-300)) + var(--spectrum-sidenav-item-padding-x,
var(--spectrum-global-dimension-size-150)))}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
class SideNavItem extends Focusable {
    constructor() {
        super(...arguments);
        this.value = undefined;
        this.manageTabIndex = false;
        this.selected = false;
        this.disabled = false;
        this.expanded = false;
        this.href = undefined;
        this.label = '';
    }
    static get styles() {
        return [styles$6];
    }
    get parentSideNav() {
        return this.closest('sp-sidenav');
    }
    get hasChildren() {
        return !!this.querySelector('sp-sidenav-item');
    }
    get depth() {
        let depth = 0;
        let element = this.parentElement;
        while (element instanceof SideNavItem) {
            depth++;
            element = element.parentElement;
        }
        return depth;
    }
    firstUpdated(changes) {
        super.firstUpdated(changes);
        const parentSideNav = this.parentSideNav;
        if (parentSideNav) {
            parentSideNav.addEventListener('sidenav-select', (event) => this.handleSideNavSelect(event));
            this.selected =
                this.value != null && this.value === parentSideNav.value;
        }
    }
    handleSideNavSelect(event) {
        this.selected = event.target === this;
    }
    handleClick(event) {
        if (!this.href && event) {
            event.preventDefault();
        }
        if (!this.disabled) {
            if (this.hasChildren) {
                this.expanded = !this.expanded;
            }
            else if (this.value) {
                const selectDetail = {
                    value: this.value,
                };
                const selectionEvent = new CustomEvent('sidenav-select', {
                    bubbles: true,
                    composed: true,
                    detail: selectDetail,
                });
                this.dispatchEvent(selectionEvent);
            }
        }
    }
    click() {
        this.handleClick();
    }
    get focusElement() {
        /* istanbul ignore if */
        if (!this.shadowRoot) {
            return this;
        }
        return this.shadowRoot.querySelector('#itemLink');
    }
    render() {
        const tabIndexForSelectedState = this.selected ? '0' : '-1';
        return html `
            <a
                tabindex=${this.manageTabIndex ? tabIndexForSelectedState : '0'}
                href=${this.href || '#'}
                target=${ifDefined(this.target)}
                data-level="${this.depth}"
                @click="${this.handleClick}"
                id="itemLink"
            >
                ${this.label}
            </a>
            ${this.expanded
            ? html `
                      <slot></slot>
                  `
            : undefined}
        `;
    }
    updated(changes) {
        super.updated(changes);
        if (changes.has('selected') || changes.has('manageTabIndex')) {
            const tabIndexForSelectedState = this.selected ? 0 : -1;
            this.tabIndex = this.manageTabIndex ? tabIndexForSelectedState : 0;
        }
    }
    connectedCallback() {
        super.connectedCallback();
        const manageTabIndex = this.dispatchEvent(new Event('manage-tab-index', {
            cancelable: true,
        }));
        if (manageTabIndex) {
            this.manageTabIndex = true;
        }
    }
}
__decorate([
    property()
], SideNavItem.prototype, "value", void 0);
__decorate([
    property({ type: Boolean, attribute: false })
], SideNavItem.prototype, "manageTabIndex", void 0);
__decorate([
    property({ type: Boolean, reflect: true })
], SideNavItem.prototype, "selected", void 0);
__decorate([
    property({ type: Boolean, reflect: true })
], SideNavItem.prototype, "disabled", void 0);
__decorate([
    property({ type: Boolean, reflect: true })
], SideNavItem.prototype, "expanded", void 0);
__decorate([
    property()
], SideNavItem.prototype, "href", void 0);
__decorate([
    property()
], SideNavItem.prototype, "target", void 0);
__decorate([
    property()
], SideNavItem.prototype, "label", void 0);

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$7 = css `
#list{list-style-type:none;margin:0;padding:0}#heading{height:var(--spectrum-sidenav-header-height,var(--spectrum-alias-single-line-height));line-height:var(--spectrum-sidenav-header-height,var(--spectrum-alias-single-line-height));margin:var(--spectrum-sidenav-header-gap-top,var(--spectrum-global-dimension-size-200)) 0 var(--spectrum-sidenav-header-gap-bottom,var(--spectrum-global-dimension-size-50)) 0;padding:0 var(--spectrum-sidenav-header-padding-x,var(--spectrum-global-dimension-size-150));border-radius:var(--spectrum-sidenav-header-border-radius,var(--spectrum-alias-border-radius-regular));font-size:var(--spectrum-sidenav-header-text-size,var(--spectrum-global-dimension-font-size-50));font-weight:var(--spectrum-sidenav-header-font-weight,var(--spectrum-global-font-weight-medium));font-style:normal;letter-spacing:var(--spectrum-sidenav-header-letter-spacing,var(--spectrum-global-font-letter-spacing-medium));text-transform:uppercase;color:var(--spectrum-sidenav-header-text-color,var(--spectrum-global-color-gray-700))}:host{display:block}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
class SideNavHeading extends LitElement {
    constructor() {
        super(...arguments);
        this.label = '';
    }
    static get styles() {
        return [styles$6, styles$7];
    }
    render() {
        return html `
            <h2 id="heading">${this.label}</h2>
            <ul id="list" aria-labelledby="heading">
                <slot></slot>
            </ul>
        `;
    }
}
__decorate([
    property({ reflect: true })
], SideNavHeading.prototype, "label", void 0);

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
class SideNav extends Focusable {
    constructor() {
        super();
        this.manageTabIndex = false;
        this.value = undefined;
        this.startListeningToKeyboard = () => {
            this.addEventListener('keydown', this.handleKeydown);
        };
        this.stopListeningToKeyboard = () => {
            this.removeEventListener('keydown', this.handleKeydown);
        };
        this.addEventListener('focusin', this.startListeningToKeyboard);
        this.addEventListener('focusout', this.stopListeningToKeyboard);
    }
    static get styles() {
        return [styles$5];
    }
    handleSelect(event) {
        this.value = event.detail.value;
    }
    focus() {
        if (this.disabled || this.focusElement.isSameNode(this)) {
            return;
        }
        this.focusElement.focus();
    }
    get focusElement() {
        const selected = this.querySelector('[selected]');
        if (selected && !this.isDisabledChild(selected)) {
            return selected;
        }
        const items = [...this.querySelectorAll('sp-sidenav-item')];
        let index = 0;
        while (index < items.length &&
            items[index] &&
            this.isDisabledChild(items[index])) {
            index += 1;
        }
        /* istanbul ignore else */
        if (items[index]) {
            return items[index];
        }
        /* istanbul ignore next */
        return this;
    }
    handleKeydown(event) {
        const { code } = event;
        /* istanbul ignore if */
        if (code !== 'ArrowDown' && code !== 'ArrowUp') {
            return;
        }
        event.preventDefault();
        const direction = code === 'ArrowDown' ? 1 : -1;
        this.focusItemByOffset(direction);
    }
    focusItemByOffset(direction) {
        const items = [...this.querySelectorAll('sp-sidenav-item')];
        const focused = items.indexOf(getActiveElement(this));
        let next = focused;
        next = (items.length + next + direction) % items.length;
        while (this.isDisabledChild(items[next])) {
            next = (items.length + next + direction) % items.length;
        }
        items[next].focus();
    }
    isDisabledChild(child) {
        if (child.disabled) {
            return true;
        }
        let parent = child.parentElement;
        while (parent instanceof SideNavHeading ||
            (!parent.disabled &&
                (parent instanceof SideNavItem && parent.expanded))) {
            parent = parent.parentElement;
        }
        return parent !== this;
    }
    render() {
        return html `
            <nav @sidenav-select=${this.handleSelect}>
                <slot></slot>
            </nav>
        `;
    }
    firstUpdated(changes) {
        super.firstUpdated(changes);
        this.tabIndex = 0;
    }
    updated(changes) {
        super.updated(changes);
        if (changes.has('manageTabIndex')) {
            const items = [...this.querySelectorAll('sp-sidenav-item')];
            items.map((item) => (item.manageTabIndex = this.manageTabIndex));
            if (this.manageTabIndex) {
                this.removeEventListener('manage-tab-index', this.handleManageTabIndex, true);
            }
            else {
                this.addEventListener('manage-tab-index', this.handleManageTabIndex, true);
            }
        }
    }
    manageShiftTab() {
        this.addEventListener('keydown', (event) => {
            const items = [...this.querySelectorAll('sp-sidenav-item')];
            const firstFocusable = items.find((item) => !this.isDisabledChild(item));
            if (!event.defaultPrevented &&
                event.shiftKey &&
                event.code === 'Tab' &&
                (this.manageTabIndex ||
                    event.composedPath().includes(firstFocusable))) {
                this.isShiftTabbing = true;
                HTMLElement.prototype.focus.apply(this);
                setTimeout(() => (this.isShiftTabbing = false), 0);
            }
        });
    }
    handleManageTabIndex(event) {
        event.preventDefault();
    }
}
__decorate([
    property({ type: Boolean, reflect: true, attribute: 'manage-tab-index' })
], SideNav.prototype, "manageTabIndex", void 0);
__decorate([
    property({ reflect: true })
], SideNav.prototype, "value", void 0);

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
/* istanbul ignore else */
if (!customElements.get('sp-sidenav')) {
    customElements.define('sp-sidenav', SideNav);
}
/* istanbul ignore else */
if (!customElements.get('sp-sidenav-item')) {
    customElements.define('sp-sidenav-item', SideNavItem);
}
/* istanbul ignore else */
if (!customElements.get('sp-sidenav-heading')) {
    customElements.define('sp-sidenav-heading', SideNavHeading);
}

class IconsetRegistry {
    constructor() {
        this.iconsetMap = new Map();
    }
    // singleton getter
    static getInstance() {
        if (!IconsetRegistry.instance) {
            IconsetRegistry.instance = new IconsetRegistry();
        }
        return IconsetRegistry.instance;
    }
    addIconset(name, iconset) {
        this.iconsetMap.set(name, iconset);
        // dispatch a sp-iconset-added event on window to let everyone know we have a new iconset
        // note we're using window here for efficiency since we don't need to bubble through the dom since everyone
        // will know where to look for this event
        const event = new CustomEvent('sp-iconset-added', {
            bubbles: true,
            composed: true,
            detail: { name, iconset },
        });
        // we're dispatching this event in the next tick to allow the iconset to finish any slotchange or other event
        // listeners caused by connection to the dom and first render to complete, this way any icons listening for
        // this iconset will be able to access the completed iconset
        setTimeout(() => window.dispatchEvent(event), 0);
    }
    removeIconset(name) {
        this.iconsetMap.delete(name);
        // dispatch a sp-iconset-removed event on window to let everyone know we have a new iconset
        // note we're using window here for efficiency since we don't need to bubble through the dom since everyone
        // will know where to look for this event
        const event = new CustomEvent('sp-iconset-removed', {
            bubbles: true,
            composed: true,
            detail: { name },
        });
        // we're dispatching this event in the next tick To keep the event model consistent with the added event
        setTimeout(() => window.dispatchEvent(event), 0);
    }
    getIconset(name) {
        return this.iconsetMap.get(name);
    }
}

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$8 = css `
:host{display:inline-block;color:inherit;fill:currentColor;pointer-events:none}:host(:not(:root)){overflow:hidden}:host([size=xxs]),:host([size=xxs]) img,:host([size=xxs]) svg{height:calc(var(--spectrum-alias-workflow-icon-size,
var(--spectrum-global-dimension-size-225))/2);width:calc(var(--spectrum-alias-workflow-icon-size,
var(--spectrum-global-dimension-size-225))/2)}:host([size=xs]),:host([size=xs]) img,:host([size=xs]) svg{height:calc(var(--spectrum-global-dimension-size-300)/2);width:calc(var(--spectrum-global-dimension-size-300)/2)}:host([size=s]),:host([size=s]) img,:host([size=s]) svg{height:var(--spectrum-alias-workflow-icon-size,var(--spectrum-global-dimension-size-225));width:var(--spectrum-alias-workflow-icon-size,var(--spectrum-global-dimension-size-225))}:host([size=m]),:host([size=m]) img,:host([size=m]) svg{height:var(--spectrum-global-dimension-size-300);width:var(--spectrum-global-dimension-size-300)}:host([size=l]),:host([size=l]) img,:host([size=l]) svg{height:calc(var(--spectrum-alias-workflow-icon-size,
var(--spectrum-global-dimension-size-225))*2);width:calc(var(--spectrum-alias-workflow-icon-size,
var(--spectrum-global-dimension-size-225))*2)}:host([size=xl]),:host([size=xl]) img,:host([size=xl]) svg{height:calc(var(--spectrum-global-dimension-size-300)*2);width:calc(var(--spectrum-global-dimension-size-300)*2)}:host([size=xxl]),:host([size=xxl]) img,:host([size=xxl]) svg{height:calc(var(--spectrum-global-dimension-size-300)*3);width:calc(var(--spectrum-global-dimension-size-300)*3)}#container{height:100%}img{height:auto}::slotted(*),img{width:100%;vertical-align:top}::slotted(*){height:100%}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
class Icon extends LitElement {
    constructor() {
        super(...arguments);
        this.size = 'm';
        this.iconsetListener = (event) => {
            if (!this.name) {
                return;
            }
            // parse the icon name to get iconset name
            const icon = this.parseIcon(this.name);
            if (event.detail.name === icon.iconset) {
                this.updateIconPromise = this.updateIcon();
            }
        };
    }
    static get styles() {
        return [styles$8];
    }
    connectedCallback() {
        super.connectedCallback();
        window.addEventListener('sp-iconset-added', this.iconsetListener);
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('sp-iconset-added', this.iconsetListener);
    }
    firstUpdated() {
        this.updateIconPromise = this.updateIcon();
    }
    attributeChangedCallback(name, old, value) {
        super.attributeChangedCallback(name, old, value);
        this.updateIconPromise = this.updateIcon(); // any of our attributes change, update our icon
    }
    render() {
        if (this.name) {
            return html `
                <div id="container"></div>
            `;
        }
        else if (this.src) {
            return html `
                <img src="${this.src}" alt=${ifDefined(this.label)} />
            `;
        }
        return html `
            <slot></slot>
        `;
    }
    async updateIcon() {
        if (!this.name) {
            return Promise.resolve();
        }
        // parse the icon name to get iconset name
        const icon = this.parseIcon(this.name);
        // try to retrieve the iconset
        const iconset = IconsetRegistry.getInstance().getIconset(icon.iconset);
        if (!iconset) {
            // we can stop here as there's nothing to be done till we get the iconset
            return Promise.resolve();
        }
        if (!this.iconContainer) {
            return Promise.resolve();
        }
        this.iconContainer.innerHTML = '';
        return iconset.applyIconToElement(this.iconContainer, icon.icon, this.size, this.label ? this.label : '');
    }
    parseIcon(icon) {
        const iconParts = icon.split(':');
        let iconsetName = 'default';
        let iconName = icon;
        if (iconParts.length > 1) {
            iconsetName = iconParts[0];
            iconName = iconParts[1];
        }
        return { iconset: iconsetName, icon: iconName };
    }
    async _getUpdateComplete() {
        await super._getUpdateComplete();
        await this.updateIconPromise;
    }
}
Icon.is = 'sp-icon';
__decorate([
    property()
], Icon.prototype, "src", void 0);
__decorate([
    property()
], Icon.prototype, "name", void 0);
__decorate([
    property({ reflect: true })
], Icon.prototype, "size", void 0);
__decorate([
    property()
], Icon.prototype, "label", void 0);
__decorate([
    query('#container')
], Icon.prototype, "iconContainer", void 0);

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
/* istanbul ignore else */
if (!customElements.get('sp-icon')) {
    customElements.define('sp-icon', Icon);
}

class Iconset extends LitElement {
    constructor() {
        super(...arguments);
        this.registered = false;
        this.handleRemoved = ({ detail, }) => {
            if (detail.name === this.name) {
                this.registered = false;
                this.addIconset();
            }
        };
    }
    firstUpdated() {
        // force no display for all iconsets
        this.style.display = 'none';
    }
    /**
     * Name of the iconset, used by the IconsetRegistry to serve this icon set
     * to consuming icons.
     */
    set name(value) {
        // if we're already registered in the iconset registry
        // we'll need to update our registration
        if (this.registered) {
            if (this._name) {
                // remove from the iconset map using the old name
                IconsetRegistry.getInstance().removeIconset(this._name);
            }
            if (value) {
                // set in the map using the new name
                IconsetRegistry.getInstance().addIconset(value, this);
            }
        }
        this._name = value;
    }
    get name() {
        return this._name;
    }
    /**
     * On updated we register the iconset if we're not already registered
     */
    connectedCallback() {
        super.connectedCallback();
        this.addIconset();
        window.addEventListener('sp-iconset-removed', this.handleRemoved);
    }
    /**
     * On disconnected we remove the iconset
     */
    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('sp-iconset-removed', this.handleRemoved);
        this.removeIconset();
    }
    addIconset() {
        if (!this.name || this.registered) {
            return;
        }
        IconsetRegistry.getInstance().addIconset(this.name, this);
        this.registered = true;
    }
    removeIconset() {
        if (!this.name) {
            return;
        }
        IconsetRegistry.getInstance().removeIconset(this.name);
        this.registered = false;
    }
}
__decorate([
    property()
], Iconset.prototype, "name", null);

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
class IconsetSVG extends Iconset {
    constructor() {
        super(...arguments);
        this.iconMap = new Map();
    }
    /**
     * First updated handler just ensures we've processed any slotted symbols
     */
    updated(changedProperties) {
        if (!this.slotContainer) {
            return;
        }
        const currentSVGNodes = this.getSVGNodes(this.slotContainer);
        this.updateSVG(currentSVGNodes);
        super.updated(changedProperties);
    }
    /**
     * Applies the requested icon from this iconset instance to the given element.
     *
     * @param el - the element to apply the icon to
     * @param icon - the name of the icon within this set to apply.
     */
    async applyIconToElement(el, icon, size, label) {
        await this.updateComplete;
        const iconSymbol = this.iconMap.get(icon);
        if (!iconSymbol) {
            throw new Error(`Unable to find icon ${icon}`);
        }
        // we cannot share a single SVG globally across shadowroot boundaries
        // so copy the template node so we can inject it where we need it
        const clonedNode = this.prepareSvgClone(iconSymbol);
        clonedNode.setAttribute('role', 'img');
        if (label) {
            clonedNode.setAttribute('aria-label', label);
        }
        else {
            clonedNode.setAttribute('aria-hidden', 'true');
        }
        // append the svg to the node either in its shadowroot or directly into its dom
        if (el.shadowRoot) {
            el.shadowRoot.appendChild(clonedNode);
        }
        else {
            el.appendChild(clonedNode);
        }
    }
    /**
     * Returns a list of all icons in this iconset.
     */
    getIconList() {
        return [...this.iconMap.keys()];
    }
    prepareSvgClone(sourceSvg) {
        const content = sourceSvg.cloneNode(true);
        // we're going to create a new svg element that will have our symbol geometry inside
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const viewBox = content.getAttribute('viewBox') || '';
        // inline style isn't ideal but will work in all cases and means our icons don't need to know
        // if they are svg or spritesheet provided
        const cssText = 'pointer-events: none; display: block; width: 100%; height: 100%;';
        svg.style.cssText = cssText;
        // copy the viewbox and other properties into the svg
        svg.setAttribute('viewBox', viewBox);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.setAttribute('focusable', 'false');
        // move all the child nodes over to the svg
        while (content.childNodes.length > 0) {
            svg.appendChild(content.childNodes[0]);
        }
        return svg;
    }
    getSVGIconName(icon) {
        return icon;
    }
    getSanitizedIconName(icon) {
        return icon;
    }
    renderDefaultContent() {
        return html ``;
    }
    render() {
        return html `
            <slot @slotchange=${this.onSlotChange}>
                ${this.renderDefaultContent()}
            </slot>
        `;
    }
    updateSVG(nodes) {
        // iterate over the nodes that were passed in, and find all the top level symbols
        const symbols = nodes.reduce((prev, svgNode) => {
            const containedSymbols = svgNode.querySelectorAll('symbol');
            prev.push(...containedSymbols);
            return prev;
        }, []);
        symbols.forEach((symbol) => {
            this.iconMap.set(this.getSanitizedIconName(symbol.id), symbol);
        });
    }
    getSVGNodes(slotTarget) {
        const nodes = slotTarget.assignedNodes({ flatten: true });
        // find all the svg nodes
        const svgNodes = nodes.filter((node) => {
            return node.nodeName === 'svg';
        });
        return svgNodes;
    }
    onSlotChange(event) {
        const slotTarget = event.target;
        const svgNodes = this.getSVGNodes(slotTarget);
        this.updateSVG(svgNodes);
    }
}
__decorate([
    query('slot')
], IconsetSVG.prototype, "slotContainer", void 0);

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
var iconsSVG = svg `<svg xmlns="http://www.w3.org/2000/svg"><symbol id="spectrum-icon-AlertMedium" viewBox="0 0 22 22"><path d="M10.563 2.206l-9.249 16.55a.5.5 0 00.436.744h18.5a.5.5 0 00.436-.744l-9.251-16.55a.5.5 0 00-.872 0zm1.436 15.044a.25.25 0 01-.25.25h-1.5a.25.25 0 01-.25-.25v-1.5a.25.25 0 01.25-.25h1.5a.25.25 0 01.25.25zm0-3.5a.25.25 0 01-.25.25h-1.5a.25.25 0 01-.25-.25v-6a.25.25 0 01.25-.25h1.5a.25.25 0 01.25.25z"/></symbol><symbol id="spectrum-icon-AlertSmall" viewBox="0 0 18 18"><path d="M8.564 1.289L.2 16.256A.5.5 0 00.636 17h16.728a.5.5 0 00.436-.744L9.436 1.289a.5.5 0 00-.872 0zM10 14.75a.25.25 0 01-.25.25h-1.5a.25.25 0 01-.25-.25v-1.5a.25.25 0 01.25-.25h1.5a.25.25 0 01.25.25zm0-3a.25.25 0 01-.25.25h-1.5a.25.25 0 01-.25-.25v-6a.25.25 0 01.25-.25h1.5a.25.25 0 01.25.25z"/></symbol><symbol id="spectrum-icon-ArrowDownSmall" viewBox="0 0 10 12"><path d="M9.99 7.01a1 1 0 00-1.707-.707L6 8.586V1.01a1 1 0 00-2 0v7.576L1.717 6.303A1 1 0 10.303 7.717l3.99 3.98a1 1 0 001.414 0l3.99-3.98a.997.997 0 00.293-.707z"/></symbol><symbol id="spectrum-icon-ArrowLeftMedium" viewBox="0 0 18 14"><path d="M16.99 6H3.414l4.283-4.283A1 1 0 106.283.303l-5.98 5.99a1 1 0 000 1.414l5.98 5.99a1 1 0 101.414-1.414L3.414 8H16.99a1 1 0 000-2z"/></symbol><symbol id="spectrum-icon-ArrowUpSmall" viewBox="0 0 10 12"><path d="M9.99 4.99a1 1 0 01-1.707.707L6 3.414v7.576a1 1 0 01-2 0V3.414L1.717 5.697A1 1 0 11.303 4.283l3.99-3.98a1 1 0 011.414 0l3.99 3.98a.997.997 0 01.293.707z"/></symbol><symbol id="spectrum-icon-Asterisk" viewBox="0 0 10 10"><path d="M7.867 7.872c.061.062.103.145 0 .228l-1.283.827c-.104.061-.145.02-.186-.083L4.804 6.07l-2.09 2.297c-.021.042-.083.083-.145 0l-.994-1.035c-.103-.062-.082-.124 0-.186l2.36-1.966-2.691-1.014c-.042 0-.104-.083-.062-.186l.703-1.41a.11.11 0 01.187-.04L4.43 4.06l.145-3.02A.109.109 0 014.7.917l1.718.227c.104 0 .124.042.104.145l-.808 2.96 2.734-.828c.061-.042.124-.042.165.082l.27 1.532c.02.103 0 .145-.084.145l-2.856.227z"/></symbol><symbol id="spectrum-icon-CheckmarkMedium" viewBox="0 0 16 16"><path d="M6 14a1 1 0 01-.789-.385l-4-5a1 1 0 111.577-1.23L6 11.376l7.213-8.99a1 1 0 111.576 1.23l-8 10a1 1 0 01-.789.384z"/></symbol><symbol id="spectrum-icon-CheckmarkSmall" viewBox="0 0 12 12"><path d="M4.5 11a.999.999 0 01-.788-.385l-3-4a1 1 0 111.576-1.23L4.5 8.376l5.212-6.99a1 1 0 111.576 1.23l-6 8A.999.999 0 014.5 11z"/></symbol><symbol id="spectrum-icon-ChevronDownMedium" viewBox="0 0 12 8"><path d="M11.99 1.51a1 1 0 00-1.707-.707L6 5.086 1.717.803A1 1 0 10.303 2.217l4.99 4.99a1 1 0 001.414 0l4.99-4.99a.997.997 0 00.293-.707z"/></symbol><symbol id="spectrum-icon-ChevronDownSmall" viewBox="0 0 10 8"><path d="M5 7a.747.747 0 00.53-.22l4.24-4.24a.75.75 0 10-1.06-1.06L5 5.19 1.29 1.48A.75.75 0 10.23 2.54l4.24 4.24A.747.747 0 005 7z"/></symbol><symbol id="spectrum-icon-ChevronLeftLarge" viewBox="0 0 16 20"><path d="M12.109 17.853l-8.066-7.849 8.066-7.84a1.243 1.243 0 00.381-.894 1.24 1.24 0 00-2.12-.894L1.379 9.108a1.246 1.246 0 00.003 1.79l8.99 8.744a1.247 1.247 0 101.738-1.789z"/></symbol><symbol id="spectrum-icon-ChevronLeftMedium" viewBox="0 0 8 12"><path d="M7.197 10.283L2.914 6l4.283-4.283A1 1 0 105.783.303l-4.99 4.99a1 1 0 000 1.414l4.99 4.99a1 1 0 101.414-1.414z"/></symbol><symbol id="spectrum-icon-ChevronRightLarge" viewBox="0 0 16 20"><path d="M15 10.004a1.243 1.243 0 00-.38-.894L5.631.364a1.249 1.249 0 10-1.741 1.79l8.066 7.85-8.069 7.847a1.249 1.249 0 001.741 1.79l8.992-8.74a1.246 1.246 0 00.379-.897z"/></symbol><symbol id="spectrum-icon-ChevronRightMedium" viewBox="0 0 8 12"><path d="M7.5 6a.997.997 0 00-.293-.707L2.217.303A1 1 0 10.803 1.717L5.086 6 .803 10.283a1 1 0 101.414 1.414l4.99-4.99A.997.997 0 007.5 6z"/></symbol><symbol id="spectrum-icon-ChevronRightSmall" viewBox="0 0 8 10"><path d="M7 5a.747.747 0 00-.22-.53L2.54.23a.75.75 0 10-1.06 1.06L5.19 5 1.48 8.71a.75.75 0 101.06 1.06l4.24-4.24A.747.747 0 007 5z"/></symbol><symbol id="spectrum-icon-ChevronUpSmall" viewBox="0 0 10 8"><path d="M5 1a.747.747 0 00-.53.22L.23 5.46a.75.75 0 101.06 1.06L5 2.81l3.71 3.71a.75.75 0 101.06-1.06L5.53 1.22A.747.747 0 005 1z"/></symbol><symbol id="spectrum-icon-CornerTriangle" viewBox="0 0 6 6"><path d="M5.74.01a.25.25 0 00-.177.073l-5.48 5.48a.25.25 0 00.177.427h5.48a.25.25 0 00.25-.25V.26a.25.25 0 00-.25-.25z"/></symbol><symbol id="spectrum-icon-CrossLarge" viewBox="0 0 16 16"><path d="M15.697 14.283L9.414 8l6.283-6.283A1 1 0 1014.283.303L8 6.586 1.717.303A1 1 0 10.303 1.717L6.586 8 .303 14.283a1 1 0 101.414 1.414L8 9.414l6.283 6.283a1 1 0 101.414-1.414z"/></symbol><symbol id="spectrum-icon-CrossMedium" viewBox="0 0 10 10"><path d="M9.77 8.71L6.06 5l3.71-3.71A.75.75 0 108.71.23L5 3.94 1.29.23A.75.75 0 10.23 1.29L3.94 5 .23 8.71a.75.75 0 101.06 1.06L5 6.06l3.71 3.71a.75.75 0 101.06-1.06z"/></symbol><symbol id="spectrum-icon-CrossSmall" viewBox="0 0 10 10"><path d="M9.317 8.433L5.884 5l3.433-3.433a.625.625 0 10-.884-.884L5 4.116 1.567.683a.625.625 0 10-.884.884C.83 1.713 2.77 3.657 4.116 5L.683 8.433a.625.625 0 10.884.884L5 5.884l3.433 3.433a.625.625 0 00.884-.884z"/></symbol><symbol id="spectrum-icon-DashSmall" viewBox="0 0 12 12"><path d="M10.99 5H1.01a1 1 0 000 2h9.98a1 1 0 100-2z"/></symbol><symbol id="spectrum-icon-DoubleGripper" viewBox="0 0 20 5"><path d="M19.49 4H.51a.5.5 0 100 1h18.98a.5.5 0 000-1zM.51 1h18.98a.5.5 0 000-1H.51a.5.5 0 000 1z"/></symbol><symbol id="spectrum-icon-FolderBreadcrumb" viewBox="0 0 22 22"><path d="M19.5 6l-9.166.004-1.668-1.7A.998.998 0 007.946 4H3a1 1 0 00-1 1v13a.5.5 0 00.5.5h17a.5.5 0 00.5-.5V6.5a.5.5 0 00-.5-.5zm-16-.5h4.237l1.964 2H3.5zm11.544 6.044l-3.5 3.5a.77.77 0 01-1.088 0l-3.5-3.5a.77.77 0 011.088-1.088L11 13.41l2.956-2.955a.77.77 0 011.088 1.088z"/></symbol><symbol id="spectrum-icon-HelpMedium" viewBox="0 0 22 22"><path d="M11 2a9 9 0 109 9 9 9 0 00-9-9zm-.007 14.681a1.145 1.145 0 01-1.227-1.215 1.159 1.159 0 011.115-1.201q.056-.002.112.001a1.159 1.159 0 011.226 1.088q.003.056.001.112a1.127 1.127 0 01-1.227 1.215zm1.981-6.63c-.684.642-1.344 1.215-1.333 1.736a2.275 2.275 0 00.176.732.25.25 0 01-.232.343h-1.26a.3.3 0 01-.228-.069 1.886 1.886 0 01-.421-1.2c0-.816.508-1.336 1.35-2.17.578-.573.911-.937.911-1.475 0-.625-.421-1.059-1.49-1.059a5.337 5.337 0 00-2 .473.249.249 0 01-.347-.23v-1.24a.5.5 0 01.3-.459 6.413 6.413 0 012.434-.5c2.1.006 3.261 1.2 3.261 2.725a3.053 3.053 0 01-1.121 2.393z"/></symbol><symbol id="spectrum-icon-HelpSmall" viewBox="0 0 18 18"><path d="M9 1a8 8 0 108 8 8 8 0 00-8-8zm.023 13.438a1.345 1.345 0 01-.104-2.688q.052-.002.104 0a1.31 1.31 0 011.397 1.217q.004.059.003.118a1.291 1.291 0 01-1.4 1.353zm1.783-6.409l-.1.1c-.395.414-.842.884-.842 1.175a1.386 1.386 0 00.179.674l.073.139-.057.215a.308.308 0 01-.284.189H8.436a.434.434 0 01-.325-.117 2.056 2.056 0 01-.422-1.262A3.058 3.058 0 018.8 7.071c.1-.11.2-.21.288-.3.314-.325.507-.535.507-.758 0-.154 0-.622-.893-.622a2.958 2.958 0 00-1.58.459.3.3 0 01-.327-.01l-.118-.085-.028-.225V4.081a.44.44 0 01.2-.41A4.135 4.135 0 019 3.119a2.552 2.552 0 012.751 2.636 3.067 3.067 0 01-.944 2.274z"/></symbol><symbol id="spectrum-icon-InfoMedium" viewBox="0 0 22 22"><path d="M11 2a9 9 0 109 9 9 9 0 00-9-9zm-.15 2.65a1.359 1.359 0 011.431 1.283q.004.064.001.129a1.332 1.332 0 01-1.432 1.432 1.353 1.353 0 01-1.432-1.433 1.359 1.359 0 011.304-1.412q.064-.002.128.001zM13.5 16a.5.5 0 01-.5.5H9a.5.5 0 01-.5-.5v-1a.5.5 0 01.5-.5h1v-4H9a.5.5 0 01-.5-.5V9a.5.5 0 01.5-.5h2.5a.5.5 0 01.5.5v5.5h1a.5.5 0 01.5.5z"/></symbol><symbol id="spectrum-icon-InfoSmall" viewBox="0 0 18 18"><path d="M9 1a8 8 0 108 8 8 8 0 00-8-8zm-.15 2.15a1.359 1.359 0 011.431 1.283q.004.064.001.129A1.332 1.332 0 018.85 5.994a1.353 1.353 0 01-1.432-1.433 1.359 1.359 0 011.304-1.412q.064-.002.128.001zM11 13.5a.5.5 0 01-.5.5h-3a.5.5 0 01-.5-.5v-1a.5.5 0 01.5-.5H8V9h-.5a.5.5 0 01-.5-.5v-1a.5.5 0 01.5-.5h2a.5.5 0 01.5.5V12h.5a.5.5 0 01.5.5z"/></symbol><symbol id="spectrum-icon-Magnifier" viewBox="0 0 20 20"><path d="M19.77 18.71l-5.464-5.464a7.503 7.503 0 10-1.06 1.06l5.463 5.464a.75.75 0 101.061-1.06zM2.5 8.5a6 6 0 116 6 6.007 6.007 0 01-6-6z"/></symbol><symbol id="spectrum-icon-More" viewBox="0 0 22 22"><path d="M11 8.95A2.05 2.05 0 118.95 11 2.05 2.05 0 0111 8.95zm6 0A2.05 2.05 0 1114.95 11 2.05 2.05 0 0117 8.95zm-12 0A2.05 2.05 0 112.95 11 2.05 2.05 0 015 8.95z"/></symbol><symbol id="spectrum-icon-SkipLeft" viewBox="0 0 10 12"><path d="M9.697 10.283L5.414 6l4.283-4.283A1 1 0 108.283.303l-4.99 4.99a1 1 0 000 1.414l4.99 4.99a1 1 0 101.414-1.414zM1 .01a1 1 0 00-1 1v9.98a1 1 0 002 0V1.01a1 1 0 00-1-1z"/></symbol><symbol id="spectrum-icon-SkipRight" viewBox="0 0 10 12"><path d="M9 .01a1 1 0 00-1 1v9.98a1 1 0 102 0V1.01a1 1 0 00-1-1zM7 6a.997.997 0 00-.293-.707L1.717.303A1 1 0 10.303 1.717L4.586 6 .303 10.283a1 1 0 101.414 1.414l4.99-4.99A.997.997 0 007 6z"/></symbol><symbol id="spectrum-icon-Star" viewBox="0 0 22 22"><path d="M11.361 1.68l2.259 5.975a.257.257 0 00.228.166l6.381.3a.386.386 0 01.223.686L15.467 12.8a.257.257 0 00-.087.268l1.684 6.162a.386.386 0 01-.584.424l-5.34-3.506a.257.257 0 00-.282 0l-5.34 3.506a.386.386 0 01-.584-.424l1.686-6.158a.257.257 0 00-.087-.268L1.548 8.809a.386.386 0 01.223-.686l6.381-.3a.257.257 0 00.228-.166l2.259-5.977a.386.386 0 01.722 0z"/></symbol><symbol id="spectrum-icon-StarOutline" viewBox="0 0 22 22"><path d="M11 4.9l1.231 3.255A1.777 1.777 0 0013.809 9.3l3.476.165-2.715 2.18a1.777 1.777 0 00-.6 1.855l.918 3.357-2.909-1.91a1.777 1.777 0 00-1.951 0l-2.909 1.91.914-3.357a1.778 1.778 0 00-.6-1.856L4.715 9.469 8.191 9.3a1.777 1.777 0 001.578-1.142zm0-3.458a.448.448 0 00-.426.294L8.35 7.621a.26.26 0 01-.231.168l-6.282.3a.455.455 0 00-.263.81l4.907 3.933a.26.26 0 01.088.271l-1.657 6.064a.457.457 0 00.44.577.45.45 0 00.249-.076l5.257-3.452a.26.26 0 01.285 0l5.257 3.451a.45.45 0 00.249.076.457.457 0 00.44-.577L15.43 13.1a.26.26 0 01.088-.271L20.426 8.9a.455.455 0 00-.263-.81l-6.282-.3a.26.26 0 01-.231-.168l-2.224-5.883A.448.448 0 0011 1.445z"/></symbol><symbol id="spectrum-icon-SuccessMedium" viewBox="0 0 22 22"><path d="M11 2a9 9 0 109 9 9 9 0 00-9-9zm5.638 5.609L10.1 15.652a.5.5 0 01-.742.038L5.086 11.5a.5.5 0 010-.707l.707-.707a.5.5 0 01.707 0L9.6 13.1l5.486-6.751a.5.5 0 01.7-.073l.776.631a.5.5 0 01.076.702z"/></symbol><symbol id="spectrum-icon-SuccessSmall" viewBox="0 0 18 18"><path d="M9 1a8 8 0 108 8 8 8 0 00-8-8zm5.333 4.54l-6.324 8.13a.6.6 0 01-.437.23h-.037a.6.6 0 01-.425-.176l-3.893-3.9a.6.6 0 010-.849l.663-.663a.6.6 0 01.848 0L7.4 10.991l5.256-6.754a.6.6 0 01.843-.1l.728.566a.6.6 0 01.106.837z"/></symbol><symbol id="spectrum-icon-TripleGripper" viewBox="0 0 12 9"><path d="M11.49 8H.51a.5.5 0 100 1h10.98a.5.5 0 100-1zM11.49 4H.51a.5.5 0 100 1h10.98a.5.5 0 000-1zM.51 1h10.98a.5.5 0 000-1H.51a.5.5 0 000 1z"/></symbol></svg>`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
class IconsLarge extends IconsetSVG {
    constructor() {
        super();
        this.name = 'ui'; // default iconset name for these icons
    }
    renderDefaultContent() {
        return iconsSVG;
    }
    /**
     * Overrides createIconName to make icon strings compatible with spectrum-icon id format
     * @param icon
     * @param size
     */
    getSVGIconName(icon) {
        return `spectrum-icon-${icon}`;
    }
    getSanitizedIconName(icon) {
        return icon.replace('spectrum-icon-', '');
    }
}

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
var iconsSVG$1 = svg `<svg xmlns="http://www.w3.org/2000/svg"><symbol id="spectrum-icon-AlertMedium" viewBox="0 0 18 18"><path d="M8.564 1.289L.2 16.256A.5.5 0 00.636 17h16.728a.5.5 0 00.436-.744L9.436 1.289a.5.5 0 00-.872 0zM10 14.75a.25.25 0 01-.25.25h-1.5a.25.25 0 01-.25-.25v-1.5a.25.25 0 01.25-.25h1.5a.25.25 0 01.25.25zm0-3a.25.25 0 01-.25.25h-1.5a.25.25 0 01-.25-.25v-6a.25.25 0 01.25-.25h1.5a.25.25 0 01.25.25z"/></symbol><symbol id="spectrum-icon-AlertSmall" viewBox="0 0 14 14"><path d="M6.66 1.003L.157 12.643a.389.389 0 00.339.58h13.01a.389.389 0 00.34-.58L7.338 1.004a.389.389 0 00-.678 0zm1.118 10.47a.194.194 0 01-.195.194H6.417a.194.194 0 01-.195-.195v-1.166a.194.194 0 01.195-.195h1.166a.194.194 0 01.195.195zm0-2.334a.194.194 0 01-.195.194H6.417a.194.194 0 01-.195-.194V4.472a.194.194 0 01.195-.194h1.166a.194.194 0 01.195.194z"/></symbol><symbol id="spectrum-icon-ArrowDownSmall" viewBox="0 0 8 10"><path d="M7.99 6.01a1 1 0 00-1.707-.707L5 6.586V1a1 1 0 00-2 0v5.586L1.717 5.303A1 1 0 10.303 6.717l2.99 2.98a1 1 0 001.414 0l2.99-2.98a.997.997 0 00.293-.707z"/></symbol><symbol id="spectrum-icon-ArrowLeftMedium" viewBox="0 0 14 10"><path d="M12.99 4H3.414l2.283-2.283A1 1 0 104.283.303l-3.98 3.99a1 1 0 000 1.414l3.98 3.99a1 1 0 101.414-1.414L3.414 6h9.576a1 1 0 100-2z"/></symbol><symbol id="spectrum-icon-ArrowUpSmall" viewBox="0 0 8 10"><path d="M7.99 3.99a1 1 0 01-1.707.707L5 3.414V9a1 1 0 01-2 0V3.414L1.717 4.697A1 1 0 11.303 3.283l2.99-2.98a1 1 0 011.414 0l2.99 2.98a.997.997 0 01.293.707z"/></symbol><symbol id="spectrum-icon-Asterisk" viewBox="0 0 8 8"><path d="M6.573 6.558c.056.055.092.13 0 .204l-1.148.74c-.093.056-.13.02-.167-.073L3.832 4.947l-1.87 2.055c-.02.037-.075.074-.13 0l-.889-.926c-.092-.055-.074-.111 0-.167l2.111-1.76-2.408-.906c-.037 0-.092-.074-.055-.167l.63-1.259a.097.097 0 01.166-.036l2.111 1.37.13-2.704a.097.097 0 01.111-.11L5.277.54c.092 0 .11.037.092.13l-.722 2.647 2.444-.74c.056-.038.111-.038.148.073l.241 1.37c.019.093 0 .13-.074.13l-2.556.204z"/></symbol><symbol id="spectrum-icon-CheckmarkMedium" viewBox="0 0 12 12"><path d="M4.5 10a1.022 1.022 0 01-.799-.384l-2.488-3a1 1 0 011.576-1.233L4.5 7.376l4.712-5.991a1 1 0 111.576 1.23l-5.51 7A.978.978 0 014.5 10z"/></symbol><symbol id="spectrum-icon-CheckmarkSmall" viewBox="0 0 10 10"><path d="M3.788 9A.999.999 0 013 8.615l-2.288-3a1 1 0 111.576-1.23l1.5 1.991 3.924-4.991a1 1 0 111.576 1.23l-4.712 6A.999.999 0 013.788 9z"/></symbol><symbol id="spectrum-icon-ChevronDownMedium" viewBox="0 0 10 6"><path d="M9.99 1.01A1 1 0 008.283.303L5 3.586 1.717.303A1 1 0 10.303 1.717l3.99 3.98a1 1 0 001.414 0l3.99-3.98a.997.997 0 00.293-.707z"/></symbol><symbol id="spectrum-icon-ChevronDownSmall" viewBox="0 0 8 6"><path d="M4 5.5a.747.747 0 00.53-.22c.607-.577 1.97-2.038 3.24-3.24A.75.75 0 106.71.98L4 3.69 1.29.98A.75.75 0 10.23 2.04l3.24 3.24A.747.747 0 004 5.5z"/></symbol><symbol id="spectrum-icon-ChevronLeftLarge" viewBox="0 0 12 16"><path d="M9.605 13.843L3.55 8l6.056-5.84A1.248 1.248 0 107.876.363L.882 7.1a1.243 1.243 0 00.003 1.797l6.988 6.742a1.248 1.248 0 101.732-1.796z"/></symbol><symbol id="spectrum-icon-ChevronLeftMedium" viewBox="0 0 6 10"><path d="M5.697 8.283L2.414 5l3.283-3.283A1 1 0 104.283.303l-3.98 3.99a1 1 0 000 1.414l3.98 3.99a1 1 0 101.414-1.414z"/></symbol><symbol id="spectrum-icon-ChevronRightLarge" viewBox="0 0 12 16"><path d="M11.5 8a1.241 1.241 0 00-.386-.897L4.128.36a1.248 1.248 0 10-1.733 1.797L8.45 8l-6.058 5.84a1.248 1.248 0 101.733 1.797L11.117 8.9A1.245 1.245 0 0011.5 8z"/></symbol><symbol id="spectrum-icon-ChevronRightMedium" viewBox="0 0 6 10"><path d="M5.99 5a.997.997 0 00-.293-.707L1.717.303A1 1 0 10.303 1.717L3.586 5 .303 8.283a1 1 0 101.414 1.414l3.98-3.99A.997.997 0 005.99 5z"/></symbol><symbol id="spectrum-icon-ChevronRightSmall" viewBox="0 0 6 8"><path d="M5.5 4a.747.747 0 00-.22-.53C4.703 2.862 3.242 1.5 2.04.23A.75.75 0 10.98 1.29L3.69 4 .98 6.71a.75.75 0 101.06 1.06l3.24-3.24A.747.747 0 005.5 4z"/></symbol><symbol id="spectrum-icon-ChevronUpSmall" viewBox="0 0 8 6"><path d="M4 .5a.747.747 0 00-.53.22C2.862 1.297 1.5 2.758.23 3.96a.75.75 0 101.06 1.06L4 2.31l2.71 2.71a.75.75 0 101.06-1.06L4.53.72A.747.747 0 004 .5z"/></symbol><symbol id="spectrum-icon-CornerTriangle" viewBox="0 0 5 5"><path d="M4.74.01a.25.25 0 00-.177.073l-4.48 4.48a.25.25 0 00.177.427h4.48a.25.25 0 00.25-.25V.26a.25.25 0 00-.25-.25z"/></symbol><symbol id="spectrum-icon-CrossLarge" viewBox="0 0 12 12"><path d="M11.697 10.283L7.414 6l4.283-4.283A1 1 0 1010.283.303L6 4.586 1.717.303A1 1 0 10.303 1.717L4.586 6 .303 10.283a1 1 0 101.414 1.414L6 7.414l4.283 4.283a1 1 0 101.414-1.414z"/></symbol><symbol id="spectrum-icon-CrossMedium" viewBox="0 0 8 8"><path d="M7.77 6.71L5.06 4l2.71-2.71A.75.75 0 106.71.23L4 2.94 1.29.23A.75.75 0 10.23 1.29L2.94 4 .23 6.71a.75.75 0 101.06 1.06L4 5.06l2.71 2.71a.75.75 0 101.06-1.06z"/></symbol><symbol id="spectrum-icon-CrossSmall" viewBox="0 0 8 8"><path d="M7.317 6.433L4.884 4l2.433-2.433a.625.625 0 10-.884-.884L4 3.116 1.567.683a.625.625 0 10-.884.884L3.116 4 .683 6.433a.625.625 0 10.884.884L4 4.884l2.433 2.433a.625.625 0 00.884-.884z"/></symbol><symbol id="spectrum-icon-DashSmall" viewBox="0 0 10 10"><path d="M8 4H2a1 1 0 000 2h6a1 1 0 000-2z"/></symbol><symbol id="spectrum-icon-DoubleGripper" viewBox="0 0 16 4"><path d="M15.49 3H.51a.5.5 0 100 1h14.98a.5.5 0 100-1zM.51 1h14.98a.5.5 0 000-1H.51a.5.5 0 000 1z"/></symbol><symbol id="spectrum-icon-FolderBreadcrumb" viewBox="0 0 18 18"><path d="M16.5 4l-7.166.004-1.652-1.7A1 1 0 006.965 2H2a1 1 0 00-1 1v11.5a.5.5 0 00.5.5h15a.5.5 0 00.5-.5v-10a.5.5 0 00-.5-.5zM2 3h4.965l1.943 2H2zm10.354 5.854l-3 3a.5.5 0 01-.707 0l-3-3a.5.5 0 01.707-.707L9 10.793l2.646-2.646a.5.5 0 01.707.707z"/></symbol><symbol id="spectrum-icon-HelpMedium" viewBox="0 0 18 18"><path d="M9 1a8 8 0 108 8 8 8 0 00-8-8zm1.3 12.3a1.222 1.222 0 01-.3.9 1.223 1.223 0 01-.9.3 1.2 1.2 0 010-2.4c.8 0 1.3.5 1.2 1.2zm.1-4.5c-.4.4-.8.8-.8 1.2a1.135 1.135 0 00.3.8v.1a.098.098 0 01-.096.1H8.4a.229.229 0 01-.2-.1 1.666 1.666 0 01-.4-1.1 2.772 2.772 0 011-1.7 2.772 2.772 0 001-1.7c0-.5-.4-1.1-1.4-1.1a5.018 5.018 0 00-2 .4h-.2V4.3c0-.1 0-.2.1-.2a6.183 6.183 0 012.4-.5c1.9 0 3.1 1.1 3.1 2.7a3.704 3.704 0 01-1.4 2.5z"/></symbol><symbol id="spectrum-icon-HelpSmall" viewBox="0 0 14 14"><path d="M7 .778A6.222 6.222 0 1013.222 7 6.222 6.222 0 007 .778zm.018 10.452a1.046 1.046 0 11-.08-2.091q.04-.002.08 0a1.019 1.019 0 011.087.946q.003.046.002.092a1.004 1.004 0 01-1.09 1.053zm1.387-4.985l-.078.078c-.307.322-.655.687-.655.913a1.078 1.078 0 00.14.525l.056.108-.044.167a.24.24 0 01-.221.147H6.56a.338.338 0 01-.252-.091 1.6 1.6 0 01-.329-.982 2.378 2.378 0 01.864-1.61c.078-.086.156-.164.224-.234.245-.252.395-.416.395-.59 0-.119 0-.483-.695-.483a2.3 2.3 0 00-1.229.357.233.233 0 01-.254-.008l-.092-.066-.022-.175V3.174a.342.342 0 01.156-.319A3.216 3.216 0 017 2.425a1.985 1.985 0 012.14 2.051 2.385 2.385 0 01-.735 1.769z"/></symbol><symbol id="spectrum-icon-InfoMedium" viewBox="0 0 18 18"><path d="M9 1a8 8 0 108 8 8 8 0 00-8-8zm-.15 2.15a1.359 1.359 0 011.431 1.283q.004.064.001.129A1.332 1.332 0 018.85 5.994a1.353 1.353 0 01-1.432-1.433 1.359 1.359 0 011.304-1.412q.064-.002.128.001zM11 13.5a.5.5 0 01-.5.5h-3a.5.5 0 01-.5-.5v-1a.5.5 0 01.5-.5H8V9h-.5a.5.5 0 01-.5-.5v-1a.5.5 0 01.5-.5h2a.5.5 0 01.5.5V12h.5a.5.5 0 01.5.5z"/></symbol><symbol id="spectrum-icon-InfoSmall" viewBox="0 0 14 14"><path d="M7 .778A6.222 6.222 0 1013.222 7 6.222 6.222 0 007 .778zM6.883 2.45a1.057 1.057 0 011.113.998q.003.05.001.1a1.036 1.036 0 01-1.114 1.114A1.052 1.052 0 015.77 3.547 1.057 1.057 0 016.784 2.45q.05-.002.1.001zm1.673 8.05a.389.389 0 01-.39.389H5.834a.389.389 0 01-.389-.389v-.778a.389.389 0 01.39-.389h.388V7h-.389a.389.389 0 01-.389-.389v-.778a.389.389 0 01.39-.389h1.555a.389.389 0 01.389.39v3.5h.389a.389.389 0 01.389.388z"/></symbol><symbol id="spectrum-icon-Magnifier" viewBox="0 0 16 16"><path d="M15.77 14.71l-4.534-4.535a6.014 6.014 0 10-1.06 1.06l4.533 4.535a.75.75 0 101.061-1.06zM6.5 11A4.5 4.5 0 1111 6.5 4.505 4.505 0 016.5 11z"/></symbol><symbol id="spectrum-icon-More" viewBox="0 0 18 18"><path d="M9 7.1A1.9 1.9 0 117.1 9 1.9 1.9 0 019 7.1zm6 0A1.9 1.9 0 1113.1 9 1.9 1.9 0 0115 7.1zm-12 0A1.9 1.9 0 111.1 9 1.9 1.9 0 013 7.1z"/></symbol><symbol id="spectrum-icon-SkipLeft" viewBox="0 0 9 10"><path d="M8.697 8.283L5.414 5l3.283-3.283A1 1 0 107.283.303l-3.99 3.99a1 1 0 000 1.414l3.99 3.99a1 1 0 101.414-1.414zM1 .01a1 1 0 00-1 1v7.98a1 1 0 002 0V1.01a1 1 0 00-1-1z"/></symbol><symbol id="spectrum-icon-SkipRight" viewBox="0 0 9 10"><path d="M8 .01a1 1 0 00-1 1v7.98a1 1 0 102 0V1.01a1 1 0 00-1-1zM6 5a.997.997 0 00-.293-.707L1.717.303A1 1 0 10.303 1.717L3.586 5 .303 8.283a1 1 0 101.414 1.414l3.99-3.99A.997.997 0 006 5z"/></symbol><symbol id="spectrum-icon-Star" viewBox="0 0 18 18"><path d="M9.241.3l2.161 5.715 6.106.289a.255.255 0 01.147.454l-4.77 3.823 1.612 5.9a.255.255 0 01-.386.28L9.002 13.4l-5.11 3.358a.255.255 0 01-.386-.28l1.612-5.9-4.77-3.821A.255.255 0 01.495 6.3l6.107-.285L8.763.3a.255.255 0 01.478 0z"/></symbol><symbol id="spectrum-icon-StarOutline" viewBox="0 0 18 18"><path d="M9.031 2.541l1.777 4.753 5.11.241-3.987 3.2 1.336 4.913-4.266-2.782-4.282 2.808 1.352-4.937-3.987-3.2 5.1-.245zM9.042.412a.369.369 0 00-.349.239L6.486 6.326l-6.1.293a.375.375 0 00-.217.667l4.762 3.821L3.318 17a.376.376 0 00.362.475.371.371 0 00.2-.063l5.121-3.351 5.095 3.324a.371.371 0 00.2.062.376.376 0 00.363-.475l-1.595-5.866 4.767-3.826a.375.375 0 00-.217-.667l-6.1-.287L9.393.655a.369.369 0 00-.351-.243z"/></symbol><symbol id="spectrum-icon-SuccessMedium" viewBox="0 0 18 18"><path d="M9 1a8 8 0 108 8 8 8 0 00-8-8zm5.333 4.54l-6.324 8.13a.6.6 0 01-.437.23h-.037a.6.6 0 01-.425-.176l-3.893-3.9a.6.6 0 010-.849l.663-.663a.6.6 0 01.848 0L7.4 10.991l5.256-6.754a.6.6 0 01.843-.1l.728.566a.6.6 0 01.106.837z"/></symbol><symbol id="spectrum-icon-SuccessSmall" viewBox="0 0 14 14"><path d="M7 .778A6.222 6.222 0 1013.222 7 6.222 6.222 0 007 .778zm4.148 3.53l-4.919 6.324a.467.467 0 01-.34.18h-.028a.467.467 0 01-.331-.138L2.502 7.641a.467.467 0 010-.66l.516-.516a.467.467 0 01.66 0l2.078 2.084 4.088-5.254a.467.467 0 01.655-.078l.566.44a.467.467 0 01.083.652z"/></symbol><symbol id="spectrum-icon-TripleGripper" viewBox="0 0 10 7"><path d="M9.49 6H.51a.5.5 0 100 1h8.98a.5.5 0 000-1zM9.49 3H.51a.5.5 0 100 1h8.98a.5.5 0 000-1zM.51 1h8.98a.5.5 0 000-1H.51a.5.5 0 000 1z"/></symbol></svg>`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
class IconsMedium extends IconsetSVG {
    constructor() {
        super();
        this.name = 'ui'; // default iconset name for these icons
    }
    renderDefaultContent() {
        return iconsSVG$1;
    }
    /**
     * Overrides createIconName to make icon strings compatible with spectrum-icon id format
     * @param icon
     * @param size
     */
    getSVGIconName(icon) {
        return `spectrum-icon-${icon}`;
    }
    getSanitizedIconName(icon) {
        return icon.replace('spectrum-icon-', '');
    }
}

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
/* istanbul ignore else */
if (!customElements.get('sp-icons-large')) {
    customElements.define('sp-icons-large', IconsLarge);
}
/* istanbul ignore else */
if (!customElements.get('sp-icons-medium')) {
    customElements.define('sp-icons-medium', IconsMedium);
}

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$9 = css `
#input{box-sizing:border-box;border:var(--spectrum-textfield-border-size,var(--spectrum-alias-border-size-thin)) solid;border-radius:var(--spectrum-textfield-border-radius,var(--spectrum-alias-border-radius-regular));padding:calc(var(--spectrum-textfield-padding-top,
var(--spectrum-global-dimension-size-75)) - var(--spectrum-textfield-border-size,
var(--spectrum-alias-border-size-thin))) calc(var(--spectrum-textfield-padding-x,
var(--spectrum-global-dimension-size-150)) - var(--spectrum-textfield-border-size,
var(--spectrum-alias-border-size-thin))) calc(var(--spectrum-textfield-padding-bottom,
var(--spectrum-global-dimension-size-115)) - var(--spectrum-textfield-border-size,
var(--spectrum-alias-border-size-thin)) - 1px) calc(var(--spectrum-textfield-padding-x,
var(--spectrum-global-dimension-size-150)) - var(--spectrum-textfield-border-size,
var(--spectrum-alias-border-size-thin)));text-indent:0;min-width:var(--spectrum-textfield-min-width,var(--spectrum-global-dimension-size-600));height:var(--spectrum-textfield-height,var(--spectrum-alias-single-line-height));width:var(--spectrum-alias-single-line-width,var(--spectrum-global-dimension-size-2400));vertical-align:top;margin:0;overflow:visible;font-family:var(--spectrum-alias-body-text-font-family,var(--spectrum-global-font-family-base));font-size:var(--spectrum-textfield-text-size,var(--spectrum-alias-font-size-default));line-height:var(--spectrum-textfield-text-line-height,var(--spectrum-alias-body-text-line-height));text-overflow:ellipsis;transition:border-color var(--spectrum-global-animation-duration-100,.13s) ease-in-out,box-shadow var(--spectrum-global-animation-duration-100,.13s) ease-in-out;outline:none;-webkit-appearance:none;-moz-appearance:textfield;background-color:var(--spectrum-textfield-background-color,var(--spectrum-global-color-gray-50));border-color:var(--spectrum-textfield-border-color,var(--spectrum-global-color-gray-300));color:var(--spectrum-textfield-text-color,var(--spectrum-alias-text-color))}#input::placeholder{font-weight:var(--spectrum-textfield-placeholder-text-font-weight,var(--spectrum-global-font-weight-regular));font-style:var(--spectrum-textfield-placeholder-text-font-style,var(--spectrum-global-font-style-italic));transition:color var(--spectrum-global-animation-duration-100,.13s) ease-in-out;opacity:1;color:var(--spectrum-textfield-placeholder-text-color,var(--spectrum-alias-placeholder-text-color))}#input:lang(ja)::placeholder,#input:lang(ko)::placeholder,#input:lang(zh)::placeholder{font-style:normal}#input:hover::placeholder{font-weight:var(--spectrum-textfield-placeholder-text-font-weight,var(--spectrum-global-font-weight-regular));color:var(--spectrum-textfield-placeholder-text-color-hover,var(--spectrum-alias-placeholder-text-color-hover))}#input:disabled{resize:none;opacity:1}#input:disabled::placeholder{font-weight:var(--spectrum-textfield-placeholder-text-font-weight,var(--spectrum-global-font-weight-regular))}#input::-ms-clear{width:0;height:0}#input::-webkit-inner-spin-button,#input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}#input:-moz-ui-invalid{box-shadow:none}#input:invalid,:host([invalid]) #input,:host([valid]) #input{background-repeat:no-repeat}#input:invalid,:host([invalid]) #input{background-size:var(--spectrum-icon-alert-medium-width,var(--spectrum-global-dimension-size-225)) var(--spectrum-icon-alert-medium-width,var(--spectrum-global-dimension-size-225));background-position:calc(100% - var(--spectrum-textfield-padding-x,
var(--spectrum-global-dimension-size-150)) + var(--spectrum-textfield-border-size,
var(--spectrum-alias-border-size-thin))) calc(var(--spectrum-textfield-height,
var(--spectrum-alias-single-line-height))/2 - var(--spectrum-icon-alert-medium-height,
var(--spectrum-global-dimension-size-225))/2 - var(--spectrum-textfield-quiet-border-size,
var(--spectrum-alias-border-size-thin)));padding-right:calc(var(--spectrum-textfield-padding-x,
var(--spectrum-global-dimension-size-150)) - var(--spectrum-textfield-border-size,
var(--spectrum-alias-border-size-thin)) + var(--spectrum-icon-alert-medium-width,
var(--spectrum-global-dimension-size-225)) + var(--spectrum-textfield-icon-margin-left,
var(--spectrum-global-dimension-size-150)))}:host([valid]) #input{background-size:var(--spectrum-icon-checkmark-medium-width) var(--spectrum-icon-checkmark-medium-width);background-position:calc(100% - var(--spectrum-textfield-padding-x,
var(--spectrum-global-dimension-size-150)) + var(--spectrum-textfield-border-size,
var(--spectrum-alias-border-size-thin))) calc(var(--spectrum-textfield-height,
var(--spectrum-alias-single-line-height))/2 - var(--spectrum-icon-checkmark-medium-height)/2);padding-right:calc(var(--spectrum-textfield-padding-x,
var(--spectrum-global-dimension-size-150)) - var(--spectrum-textfield-border-size,
var(--spectrum-alias-border-size-thin)) + var(--spectrum-icon-checkmark-medium-width) + var(--spectrum-textfield-icon-margin-left,
var(--spectrum-global-dimension-size-150)));background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' height='12' viewBox='0 0 12 12' width='12'%3E%3Cpath style='fill:var%28--spectrum-alert-success-icon-color%29' d='M4.5 10a1.023 1.023 0 0 1-.8-.384l-2.488-3a1 1 0 0 1 1.577-1.233L4.5 7.376l4.712-5.991a1 1 0 1 1 1.576 1.23l-5.511 7A.977.977 0 0 1 4.5 10z'/%3E%3C/svg%3E")}:host([multiline]) #input{height:auto;min-height:var(--spectrum-global-dimension-size-700);padding:calc(var(--spectrum-textarea-padding-top,
var(--spectrum-global-dimension-size-75)) - var(--spectrum-textarea-border-size,
var(--spectrum-alias-border-size-thin))) calc(var(--spectrum-textarea-padding-x,
var(--spectrum-global-dimension-size-150)) - var(--spectrum-textarea-border-size,
var(--spectrum-alias-border-size-thin))) calc(var(--spectrum-textarea-padding-bottom,
var(--spectrum-global-dimension-size-115)) - var(--spectrum-textarea-border-size,
var(--spectrum-alias-border-size-thin))) calc(var(--spectrum-textarea-padding-x,
var(--spectrum-global-dimension-size-150)) - var(--spectrum-textarea-border-size,
var(--spectrum-alias-border-size-thin)));overflow:auto}:host([quiet]) #input{border-radius:var(--spectrum-textfield-quiet-border-radius,0);border-left-width:0;border-bottom-width:var(--spectrum-textfield-quiet-border-size,var(--spectrum-alias-border-size-thin));border-right-width:0;border-top-width:0;padding-left:var(--spectrum-textfield-quiet-padding-x,0);padding-right:var(--spectrum-textfield-quiet-padding-x,0);resize:none;overflow-y:hidden;background-color:var(--spectrum-textfield-quiet-background-color,var(--spectrum-alias-background-color-transparent));border-color:var(--spectrum-textfield-quiet-border-color,var(--spectrum-global-color-gray-300))}:host([quiet]) #input:invalid,:host([quiet][invalid]) #input,:host([quiet][valid]) #input{background-position:100% 50%}:host([quiet][multiline]) #input{height:var(--spectrum-textfield-height,var(--spectrum-alias-single-line-height));min-height:var(--spectrum-textfield-height,var(--spectrum-alias-single-line-height))}#input:hover{border-color:var(--spectrum-textfield-border-color-hover,var(--spectrum-global-color-gray-400));box-shadow:none}#input:focus{border-color:var(--spectrum-textfield-border-color-down,var(--spectrum-alias-border-color-down))}#input.focus-visible:not(:active){border-color:var(--spectrum-textfield-border-color-key-focus,var(--spectrum-alias-border-color-focus));box-shadow:0 0 0 1px var(--spectrum-textfield-border-color-key-focus,var(--spectrum-alias-border-color-focus))}#input[disabled]{background-color:var(--spectrum-textfield-background-color-disabled,var(--spectrum-global-color-gray-200));border-color:var(--spectrum-textfield-border-color-disabled,var(--spectrum-alias-border-color-transparent));color:var(--spectrum-textfield-text-color-disabled,var(--spectrum-alias-text-color-disabled));-webkit-text-fill-color:var(--spectrum-textfield-text-color-disabled,var(--spectrum-alias-text-color-disabled))}#input[disabled]::placeholder{color:var(--spectrum-textfield-placeholder-text-color-disabled,var(--spectrum-alias-text-color-disabled))}#input:invalid,:host([invalid]) #input{border-color:var(--spectrum-textfield-border-color-error,var(--spectrum-global-color-red-500));background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' height='18' viewBox='0 0 18 18' width='18'%3E%3Cpath style='fill:var%28--spectrum-alert-error-border-color%29' d='M8.564 1.289L.2 16.256A.5.5 0 0 0 .636 17h16.728a.5.5 0 0 0 .5-.5.494.494 0 0 0-.064-.244L9.436 1.289a.5.5 0 0 0-.872 0zM10 14.75a.25.25 0 0 1-.25.25h-1.5a.25.25 0 0 1-.25-.25v-1.5a.25.25 0 0 1 .25-.25h1.5a.25.25 0 0 1 .25.25zm0-3a.25.25 0 0 1-.25.25h-1.5a.25.25 0 0 1-.25-.25v-6a.25.25 0 0 1 .25-.25h1.5a.25.25 0 0 1 .25.25z'/%3E%3C/svg%3E")}#input:invalid.focus-visible:not(:active),:host([invalid]) #input.focus-visible:not(:active){border-color:var(--spectrum-textfield-border-color-error,var(--spectrum-global-color-red-500));box-shadow:0 0 0 1px var(--spectrum-textfield-border-color-error,var(--spectrum-global-color-red-500))}:host([quiet]) #input:hover{border-color:var(--spectrum-textfield-quiet-border-color-hover,var(--spectrum-global-color-gray-400))}:host([quiet]) #input:active{border-color:var(--spectrum-textfield-quiet-border-color-down,var(--spectrum-alias-border-color-down))}:host([quiet]) #input:focus{border-color:var(--spectrum-textfield-quiet-border-color-key-focus,var(--spectrum-alias-border-color-focus));box-shadow:0 1px 0 var(--spectrum-textfield-quiet-border-color-key-focus,var(--spectrum-alias-border-color-focus))}:host([quiet]) #input.focus-visible:not(:active){border-color:var(--spectrum-textfield-border-color-key-focus,var(--spectrum-alias-border-color-focus));box-shadow:0 1px 0 var(--spectrum-textfield-border-color-key-focus,var(--spectrum-alias-border-color-focus))}:host([quiet]) #input:disabled{background-color:var(--spectrum-textfield-quiet-background-color-disabled,var(--spectrum-alias-background-color-transparent));border-color:var(--spectrum-textfield-quiet-border-color-disabled,var(--spectrum-alias-border-color-mid))}:host([quiet]) #input:invalid,:host([quiet][invalid]) #input{border-color:var(--spectrum-textfield-border-color-error,var(--spectrum-global-color-red-500))}:host([quiet]) #input:invalid:focus,:host([quiet][invalid]) #input:focus{box-shadow:0 1px 0 var(--spectrum-textfield-border-color-error,var(--spectrum-global-color-red-500))}:host([quiet]) #input:invalid.focus-visible:not(:active),:host([quiet][invalid]) #input.focus-visible:not(:active){border-color:var(--spectrum-textfield-border-color-error,var(--spectrum-global-color-red-500));box-shadow:0 1px 0 var(--spectrum-textfield-border-color-error,var(--spectrum-global-color-red-500))}:host{position:relative;display:inline-flex;vertical-align:top}#input:invalid,:host([invalid]) #input{background-image:none}#invalid,#valid{position:absolute;top:50%;right:calc(var(--spectrum-textfield-padding-x,
var(--spectrum-global-dimension-size-150)) - 3px);transform:translateY(-50%)}#valid{color:var(--spectrum-alert-success-icon-color,var(--spectrum-global-color-green-600))}#invalid{color:var(--spectrum-alert-error-border-color,var(--spectrum-global-color-red-400))}:host([valid]) #input{background-image:none}:host([grows]) #input{position:absolute;top:0;left:0;height:100%}:host([grows]) #sizer{box-sizing:border-box;padding:4px 8px;min-width:var(--spectrum-textfield-min-width,var(--spectrum-global-dimension-size-600));width:var(--spectrum-alias-single-line-width,var(--spectrum-global-dimension-size-2400));min-height:50px;border:1px solid transparent;pointer-events:none;opacity:0;font-family:adobe-clean,Helvetica,Arial,sans-serif;font-size:var(--spectrum-textfield-text-size,var(--spectrum-global-dimension-font-size-100));line-height:var(--spectrum-alias-line-height-medium,var(--spectrum-global-dimension-size-250))}:host([grows][quiet]) #sizer{padding-left:var(--spectrum-textfield-quiet-padding-x,0);padding-right:var(--spectrum-textfield-quiet-padding-x,0);border-right-width:0;border-left-width:0}:host([quiet]) #invalid,:host([quiet]) #valid{right:-2px}:host([multiline]) #invalid,:host([multiline]) #valid{top:calc(100% - 12px)}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$a = css `
.checkmark-small{width:var(--spectrum-icon-checkmark-small-width);height:var(--spectrum-icon-checkmark-small-height)}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$b = css `
.alert-small{width:var(--spectrum-icon-alert-small-width,var(--spectrum-global-dimension-size-175));height:var(--spectrum-icon-alert-small-height,var(--spectrum-global-dimension-size-175))}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
/**
 * @slot icon - The icon that appears on the left of the label
 */
class Textfield extends Focusable {
    constructor() {
        super(...arguments);
        this.allowedKeys = '';
        this.invalid = false;
        this.label = '';
        this.placeholder = '';
        this.grows = false;
        this.multiline = false;
        this.valid = false;
        this.value = '';
        this.quiet = false;
        this.required = false;
    }
    static get styles() {
        return [
            ...super.styles,
            styles$9,
            styles$a,
            styles$b,
        ];
    }
    get focusElement() {
        return this.inputElement;
    }
    onInput() {
        if (this.allowedKeys && this.inputElement.value) {
            const regExp = new RegExp(`^[${this.allowedKeys}]*$`);
            if (!regExp.test(this.inputElement.value)) {
                const selectionStart = this.inputElement
                    .selectionStart;
                const nextSelectStart = selectionStart - 1;
                this.inputElement.value = this.value;
                this.inputElement.setSelectionRange(nextSelectStart, nextSelectStart);
                return;
            }
        }
        this.value = this.inputElement.value;
    }
    onChange() {
        this.dispatchEvent(new Event('change', {
            bubbles: true,
            composed: true,
        }));
    }
    renderStateIcons() {
        if (this.invalid) {
            return html `
                <sp-icons-large></sp-icons-large>
                <sp-icon
                    id="invalid"
                    name="ui:AlertSmall"
                    class="alert-small"
                ></sp-icon>
            `;
        }
        else if (this.valid) {
            return html `
                <sp-icons-large></sp-icons-large>
                <sp-icon
                    id="valid"
                    name="ui:CheckmarkSmall"
                    class="checkmark-small"
                ></sp-icon>
            `;
        }
        return nothing;
    }
    render() {
        if (this.multiline) {
            return html `
                ${this.grows
                ? html `
                          <div id="sizer">${this.value}</div>
                      `
                : nothing}
                <!-- @ts-ignore -->
                <textarea
                    aria-label=${this.label || this.placeholder}
                    id="input"
                    pattern=${ifDefined(this.pattern)}
                    placeholder=${this.placeholder}
                    .value=${this.value}
                    @change=${this.onChange}
                    @input=${this.onInput}
                    ?disabled=${this.disabled}
                    ?required=${this.required}
                    autocomplete=${ifDefined(this.autocomplete)}
                ></textarea>
                ${this.renderStateIcons()}
            `;
        }
        return html `
            <!-- @ts-ignore -->
            <input
                aria-label=${this.label || this.placeholder}
                id="input"
                pattern=${ifDefined(this.pattern)}
                placeholder=${this.placeholder}
                .value=${this.value}
                @change=${this.onChange}
                @input=${this.onInput}
                ?disabled=${this.disabled}
                ?required=${this.required}
                autocomplete=${ifDefined(this.autocomplete)}
            />
            ${this.renderStateIcons()}
        `;
    }
    updated(changedProperties) {
        if (changedProperties.has('value') ||
            (changedProperties.has('required') && this.required)) {
            this.checkValidity();
        }
    }
    checkValidity() {
        if (this.required || (this.value && this.pattern)) {
            let validity = this.inputElement.checkValidity();
            if ((this.disabled || this.multiline) && this.pattern) {
                const regex = new RegExp(this.pattern);
                validity = regex.test(this.value);
            }
            if (validity) {
                this.valid = true;
                this.invalid = false;
            }
            else {
                this.valid = false;
                this.invalid = true;
            }
            return this.valid;
        }
        return true;
    }
}
__decorate([
    property({ attribute: 'allowed-keys' })
], Textfield.prototype, "allowedKeys", void 0);
__decorate([
    query('#input')
], Textfield.prototype, "inputElement", void 0);
__decorate([
    property({ type: Boolean, reflect: true })
], Textfield.prototype, "invalid", void 0);
__decorate([
    property()
], Textfield.prototype, "label", void 0);
__decorate([
    property()
], Textfield.prototype, "placeholder", void 0);
__decorate([
    property()
], Textfield.prototype, "pattern", void 0);
__decorate([
    property({ type: Boolean, reflect: true })
], Textfield.prototype, "grows", void 0);
__decorate([
    property({ type: Boolean, reflect: true })
], Textfield.prototype, "multiline", void 0);
__decorate([
    property({ type: Boolean, reflect: true })
], Textfield.prototype, "valid", void 0);
__decorate([
    property({ type: String })
], Textfield.prototype, "value", void 0);
__decorate([
    property({ type: Boolean, reflect: true })
], Textfield.prototype, "quiet", void 0);
__decorate([
    property({ type: Boolean, reflect: true })
], Textfield.prototype, "required", void 0);
__decorate([
    property({ type: String, reflect: true })
], Textfield.prototype, "autocomplete", void 0);

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
/* istanbul ignore else */
if (!customElements.get('sp-textfield')) {
    customElements.define('sp-textfield', Textfield);
}

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$c = css `
:host{display:inline-block;position:relative}#button{position:absolute;right:0;top:0}#input{display:block;-webkit-appearance:none;outline-offset:-2px;padding-left:var(--spectrum-search-padding-left,36px);text-indent:0;padding-right:var(--spectrum-search-padding-right,28px)}#input::-webkit-search-cancel-button,#input::-webkit-search-decoration{-webkit-appearance:none}:host([quiet]) #input{padding-left:var(--spectrum-search-quiet-padding-left,24px);padding-right:var(--spectrum-search-quiet-padding-right,20px)}:host([quiet]) #input~#icon{left:0}:host([quiet]) #input~#button{right:-8px}:host([quiet]) #input~.spectrum-Search-rightIcon{right:0}#icon{display:block;position:absolute;left:12px;top:calc(var(--spectrum-textfield-height,
var(--spectrum-alias-single-line-height))/2 - var(--spectrum-icon-magnifier-width,
var(--spectrum-global-dimension-size-200))/2);transition:color var(--spectrum-global-animation-duration-100,.13s) ease-in-out;pointer-events:none;color:var(--spectrum-textfield-icon-color,var(--spectrum-alias-icon-color))}#input:hover~#icon{color:var(--spectrum-search-icon-color-hover,var(--spectrum-global-color-gray-900))}#input:active~#icon{color:var(--spectrum-search-icon-color-down,var(--spectrum-alias-icon-color-down))}#input.focus-visible~#icon{color:var(--spectrum-search-icon-color-key-focus,var(--spectrum-global-color-gray-900))}#input:disabled~#icon{color:var(--spectrum-textfield-text-color-disabled,var(--spectrum-alias-text-color-disabled))}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$d = css `
.magnifier{width:var(--spectrum-icon-magnifier-width,var(--spectrum-global-dimension-size-200));height:var(--spectrum-icon-magnifier-height,var(--spectrum-global-dimension-size-200))}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
/**
 * @slot icon - The icon that appears on the left of the label
 */
class Search extends Textfield {
    constructor() {
        super(...arguments);
        this.label = 'Search';
        this.placeholder = 'Search';
    }
    static get styles() {
        return [...super.styles, styles$c, styles$d];
    }
    handleSubmit(event) {
        const applyDefault = this.dispatchEvent(new Event('submit', {
            cancelable: true,
            bubbles: true,
        }));
        if (!applyDefault) {
            event.preventDefault();
        }
    }
    async reset() {
        /* istanbul ignore if */
        if (!this.form) {
            return;
        }
        this.value = '';
        this.form.reset();
        await this.updateComplete;
        this.focusElement.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            composed: true,
        }));
        // The native `change` event on an `input` element is not composed,
        // so this synthetic replication of a `change` event must not be
        // either as the `Textfield` baseclass should only need to handle
        // the native variant of this interaction.
        this.focusElement.dispatchEvent(new InputEvent('change', {
            bubbles: true,
        }));
    }
    render() {
        return html `
            <sp-icons-medium></sp-icons-medium>
            <form
                action=${ifDefined(this.action)}
                id="form"
                method=${ifDefined(this.method)}
                @submit=${this.handleSubmit}
            >
                ${super.render()}
                <sp-icon
                    id="icon"
                    class="icon magnifier"
                    size="s"
                    name="ui:Magnifier"
                ></sp-icon>
                ${this.value
            ? html `
                          <sp-clear-button
                              id="button"
                              label="Reset"
                              @click=${this.reset}
                          ></sp-clear-button>
                      `
            : html ``}
            </form>
        `;
    }
    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('multiline')) {
            this.multiline = false;
        }
    }
}
__decorate([
    property()
], Search.prototype, "action", void 0);
__decorate([
    property()
], Search.prototype, "label", void 0);
__decorate([
    property()
], Search.prototype, "method", void 0);
__decorate([
    property()
], Search.prototype, "placeholder", void 0);
__decorate([
    query('#form')
], Search.prototype, "form", void 0);

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
/* istanbul ignore else */
if (!customElements.get('sp-search')) {
    customElements.define('sp-search', Search);
}

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$e = css `
:host{box-sizing:border-box;margin:var(--spectrum-popover-padding-y,var(--spectrum-global-dimension-size-50)) 0;padding:0;list-style-type:none;overflow:auto;display:block;background-color:var(--spectrum-selectlist-background-color,var(--spectrum-alias-background-color-transparent));display:inline-block}:host sp-menu{display:block}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
/**
 * Spectrum Menu Component
 * @element sp-menu
 *
 */
class Menu extends LitElement {
    constructor() {
        super();
        this.menuItems = [];
        this.focusedItemIndex = 0;
        this.focusInItemIndex = 0;
        this.handleKeydown = this.handleKeydown.bind(this);
        this.startListeningToKeyboard = this.startListeningToKeyboard.bind(this);
        this.stopListeningToKeyboard = this.stopListeningToKeyboard.bind(this);
        this.onClick = this.onClick.bind(this);
        this.addEventListener('click', this.onClick);
        this.addEventListener('focusin', this.startListeningToKeyboard);
        this.addEventListener('focusout', this.stopListeningToKeyboard);
    }
    static get styles() {
        return [styles$e];
    }
    get childRole() {
        return this.getAttribute('role') === 'menu' ? 'menuitem' : 'option';
    }
    focus() {
        if (this.menuItems.length === 0) {
            return;
        }
        const focusInItem = this.menuItems[this.focusInItemIndex];
        this.focusedItemIndex = this.focusInItemIndex;
        focusInItem.focus();
    }
    onClick(event) {
        const path = event.composedPath();
        const target = path.find((el) => {
            if (!(el instanceof Element)) {
                return false;
            }
            return el.getAttribute('role') === this.childRole;
        });
        if (!target) {
            return;
        }
        this.prepareToCleanUp();
    }
    startListeningToKeyboard() {
        if (this.menuItems.length === 0) {
            return;
        }
        this.addEventListener('keydown', this.handleKeydown);
    }
    stopListeningToKeyboard() {
        this.removeEventListener('keydown', this.handleKeydown);
    }
    handleKeydown(event) {
        const { code } = event;
        if (code === 'Tab') {
            this.prepareToCleanUp();
            return;
        }
        if (code !== 'ArrowDown' && code !== 'ArrowUp') {
            return;
        }
        event.preventDefault();
        const direction = code === 'ArrowDown' ? 1 : -1;
        this.focusMenuItemByOffset(direction);
    }
    focusMenuItemByOffset(offset) {
        const focusedItem = this.menuItems[this.focusedItemIndex];
        this.focusedItemIndex =
            (this.menuItems.length + this.focusedItemIndex + offset) %
                this.menuItems.length;
        let itemToFocus = this.menuItems[this.focusedItemIndex];
        while (itemToFocus.disabled) {
            this.focusedItemIndex =
                (this.menuItems.length + this.focusedItemIndex + offset) %
                    this.menuItems.length;
            itemToFocus = this.menuItems[this.focusedItemIndex];
        }
        itemToFocus.focus();
        focusedItem.tabIndex = -1;
    }
    prepareToCleanUp() {
        document.addEventListener('focusout', () => {
            requestAnimationFrame(() => {
                if (this.querySelector('[selected]')) {
                    const itemToBlur = this.menuItems[this.focusInItemIndex];
                    itemToBlur.tabIndex = -1;
                }
                this.updateSelectedItemIndex();
                const itemToFocus = this.menuItems[this.focusInItemIndex];
                itemToFocus.tabIndex = 0;
            });
        }, { once: true });
    }
    updateSelectedItemIndex() {
        let index = this.menuItems.length - 1;
        let item = this.menuItems[index];
        while (index && item && !item.selected) {
            index -= 1;
            item = this.menuItems[index];
        }
        this.focusedItemIndex = index;
        this.focusInItemIndex = index;
    }
    handleSlotchange() {
        this.menuItems = [
            ...this.querySelectorAll(`[role="${this.childRole}"]`),
        ];
        if (!this.menuItems || this.menuItems.length === 0) {
            return;
        }
        this.updateSelectedItemIndex();
        const focusInItem = this.menuItems[this.focusInItemIndex];
        focusInItem.tabIndex = 0;
    }
    render() {
        return html `
            <slot @slotchange=${this.handleSlotchange}></slot>
        `;
    }
    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('role')) {
            const queryRoleEvent = new CustomEvent('sp-menu-query-role', {
                bubbles: true,
                composed: true,
                detail: {
                    role: '',
                },
            });
            this.dispatchEvent(queryRoleEvent);
            this.setAttribute('role', queryRoleEvent.detail.role || 'menu');
        }
    }
}

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
customElements.define('sp-menu', Menu);

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$f = css `
:host{position:relative;display:inline-block;max-width:100%;width:var(--spectrum-global-dimension-size-2400);min-width:var(--spectrum-dropdown-min-width,var(--spectrum-global-dimension-size-600))}select{-webkit-appearance:none;-moz-appearance:none;appearance:none;-ms-appearance:none}select::-ms-expand{display:none}select::-ms-value{background-color:initial}select+.dropdown{position:absolute;right:var(--spectrum-dropdown-padding-x,var(--spectrum-global-dimension-size-150));top:50%;margin-top:calc(var(--spectrum-icon-chevron-down-medium-height,
var(--spectrum-global-dimension-size-75))/-2)}#button{position:relative;width:100%;display:flex;justify-content:space-between;align-items:center}#label{flex:1 1 auto;white-space:nowrap;overflow:hidden;height:calc(var(--spectrum-dropdown-height,
var(--spectrum-global-dimension-size-400)) - var(--spectrum-dropdown-border-size,
var(--spectrum-alias-border-size-thin))*2);line-height:calc(var(--spectrum-dropdown-height,
var(--spectrum-global-dimension-size-400)) - var(--spectrum-dropdown-border-size,
var(--spectrum-alias-border-size-thin))*2);font-size:var(--spectrum-dropdown-text-size,var(--spectrum-alias-font-size-default));text-overflow:ellipsis;text-align:left}#label.placeholder{font-weight:var(--spectrum-dropdown-placeholder-text-font-weight,var(--spectrum-global-font-weight-regular));font-style:var(--spectrum-dropdown-placeholder-text-font-style,var(--spectrum-global-font-style-italic));transition:color var(--spectrum-global-animation-duration-100,.13s) ease-in-out;color:var(--spectrum-dropdown-placeholder-text-color,var(--spectrum-alias-placeholder-text-color))}#label+.dropdown,#label~.dropdown{margin-left:var(--spectrum-dropdown-icon-margin-left,var(--spectrum-global-dimension-size-150))}.dropdown{display:inline-block;position:relative;vertical-align:top;transition:color var(--spectrum-global-animation-duration-100,.13s) ease-out;margin-top:calc((var(--spectrum-dropdown-height,
var(--spectrum-global-dimension-size-400)) - var(--spectrum-dropdown-border-size,
var(--spectrum-alias-border-size-thin))*2 - var(--spectrum-icon-chevron-down-medium-height,
var(--spectrum-global-dimension-size-75)))/2);margin-bottom:calc((var(--spectrum-dropdown-height,
var(--spectrum-global-dimension-size-400)) - var(--spectrum-dropdown-border-size,
var(--spectrum-alias-border-size-thin))*2 - var(--spectrum-icon-chevron-down-medium-height,
var(--spectrum-global-dimension-size-75)))/2);opacity:1;color:var(--spectrum-dropdown-icon-color,var(--spectrum-alias-icon-color))}#button .icon:not(.dropdown){margin-top:calc((var(--spectrum-dropdown-height,
var(--spectrum-global-dimension-size-400)) - var(--spectrum-dropdown-border-size,
var(--spectrum-alias-border-size-thin))*2 - var(--spectrum-dropdown-icon-size,
var(--spectrum-alias-workflow-icon-size)))/2);margin-bottom:calc((var(--spectrum-dropdown-height,
var(--spectrum-global-dimension-size-400)) - var(--spectrum-dropdown-border-size,
var(--spectrum-alias-border-size-thin))*2 - var(--spectrum-dropdown-icon-size,
var(--spectrum-alias-workflow-icon-size)))/2)}#button #label+.icon:not(.dropdown){margin-left:var(--spectrum-dropdown-icon-margin-left,var(--spectrum-global-dimension-size-150))}:host([quiet]){width:auto;min-width:var(--spectrum-dropdown-quiet-min-width,var(--spectrum-global-dimension-size-600))}#popover{max-width:var(--spectrum-global-dimension-size-3000)}.spectrum-Dropdown-popover--quiet{margin-left:calc(-1*(var(--spectrum-dropdown-quiet-popover-offset-x,
var(--spectrum-global-dimension-size-150)) + var(--spectrum-popover-border-size,
var(--spectrum-alias-border-size-thin))))}#button:hover .dropdown{color:var(--spectrum-dropdown-icon-color-hover,var(--spectrum-alias-icon-color-hover))}#button.is-selected .placeholder{color:var(--spectrum-dropdown-placeholder-text-color-down,var(--spectrum-global-color-gray-900))}:host([invalid]) .icon:not(.dropdown):not(.checkmark){color:var(--spectrum-dropdown-validation-icon-color-error,var(--spectrum-semantic-negative-color-icon))}:host([disabled]) #button:hover .dropdown,:host([disabled]) .dropdown,:host([invalid][disabled]) .icon,:host([invalid][disabled]) .icon:not(.dropdown):not(.checkmark){color:var(--spectrum-dropdown-icon-color-disabled,var(--spectrum-alias-icon-color-disabled))}:host([disabled]) #label.placeholder{color:var(--spectrum-dropdown-placeholder-text-color-disabled,var(--spectrum-alias-text-color-disabled))}#label.placeholder:hover{color:var(--spectrum-dropdown-placeholder-text-color-hover,var(--spectrum-alias-placeholder-text-color-hover))}#label.placeholder:active{color:var(--spectrum-dropdown-placeholder-text-color-mouse-focus,var(--spectrum-global-color-gray-900))}#button.focus-visible #label.placeholder{color:var(--spectrum-dropdown-placeholder-text-color-key-focus,var(--spectrum-alias-placeholder-text-color-hover))}#button.focus-visible .dropdown{color:var(--spectrum-dropdown-icon-color-key-focus,var(--spectrum-alias-icon-color-focus))}sp-popover{display:none}#label~.dropdown{margin-left:var(--spectrum-dropdown-icon-gap,var(--spectrum-global-dimension-size-100))}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$g = css `
#button{position:relative;display:inline-flex;box-sizing:border-box;align-items:center;justify-content:center;overflow:visible;border-style:solid;text-transform:none;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;-webkit-appearance:button;vertical-align:top;transition:background var(--spectrum-global-animation-duration-100,.13s) ease-out,border-color var(--spectrum-global-animation-duration-100,.13s) ease-out,color var(--spectrum-global-animation-duration-100,.13s) ease-out,box-shadow var(--spectrum-global-animation-duration-100,.13s) ease-out;text-decoration:none;font-family:var(--spectrum-alias-body-text-font-family,var(--spectrum-global-font-family-base));line-height:1.3;height:var(--spectrum-dropdown-height,var(--spectrum-global-dimension-size-400));font-family:inherit;font-weight:400;font-size:var(--spectrum-dropdown-text-size,var(--spectrum-alias-font-size-default));line-height:normal;-webkit-font-smoothing:initial;cursor:pointer;margin:0;padding:0 var(--spectrum-dropdown-padding-x,var(--spectrum-global-dimension-size-150));border-radius:var(--spectrum-global-dimension-size-50);transition:background-color var(--spectrum-global-animation-duration-100,.13s),box-shadow var(--spectrum-global-animation-duration-100,.13s),border-color var(--spectrum-global-animation-duration-100,.13s);color:var(--spectrum-fieldbutton-text-color,var(--spectrum-alias-text-color));background-color:var(--spectrum-fieldbutton-background-color,var(--spectrum-global-color-gray-75));border:var(--spectrum-dropdown-border-size,var(--spectrum-alias-border-size-thin)) solid var(--spectrum-fieldbutton-border-color,var(--spectrum-global-color-gray-300))}#button,#button:focus{outline:none}#button::-moz-focus-inner{border:0;border-style:none;padding:0;margin-top:-2px;margin-bottom:-2px}#button:disabled{cursor:default}.icon{max-height:100%;flex-shrink:0}#button.is-disabled,#button:disabled{border-width:0;cursor:default}#button.is-open{border-width:var(--spectrum-dropdown-border-size,var(--spectrum-alias-border-size-thin))}:host([quiet]) #button{margin:0;padding:0;border-width:0;border-radius:var(--spectrum-fieldbutton-quiet-border-radius,0);color:var(--spectrum-fieldbutton-text-color,var(--spectrum-alias-text-color));border-color:var(--spectrum-fieldbutton-quiet-border-color,var(--spectrum-alias-border-color-transparent));background-color:var(--spectrum-fieldbutton-quiet-background-color,var(--spectrum-alias-background-color-transparent))}:host([quiet]) #button.is-disabled.focus-visible,:host([quiet]) #button:disabled.focus-visible{box-shadow:none}#button:hover{color:var(--spectrum-fieldbutton-text-color-hover,var(--spectrum-alias-text-color-hover));background-color:var(--spectrum-fieldbutton-background-color-hover,var(--spectrum-global-color-gray-50));border-color:var(--spectrum-fieldbutton-border-color-hover,var(--spectrum-global-color-gray-400))}#button.is-selected,#button:active{background-color:var(--spectrum-fieldbutton-background-color-down,var(--spectrum-global-color-gray-200));border-color:var(--spectrum-fieldbutton-border-color-down,var(--spectrum-global-color-gray-400))}#button.focus-visible,#button.is-focused{background-color:var(--spectrum-fieldbutton-background-color-key-focus,var(--spectrum-global-color-gray-50));border-color:var(--spectrum-fieldbutton-border-color-key-focus,var(--spectrum-alias-border-color-focus));box-shadow:0 0 0 var(--spectrum-button-primary-border-size-increase-key-focus,1px) var(--spectrum-fieldbutton-border-color-key-focus,var(--spectrum-alias-border-color-focus));color:var(--spectrum-fieldbutton-text-color-key-focus,var(--spectrum-alias-text-color-hover))}#button.focus-visible.is-placeholder,#button.is-focused.is-placeholder{color:var(--spectrum-fieldbutton-placeholder-text-color-key-focus,var(--spectrum-alias-placeholder-text-color-hover))}:host([invalid]) #button{border-color:var(--spectrum-fieldbutton-border-color-error,var(--spectrum-global-color-red-500))}:host([invalid]) #button:hover{border-color:var(--spectrum-fieldbutton-border-color-error-hover,var(--spectrum-global-color-red-600))}:host([invalid]) #button.is-selected,:host([invalid]) #button:active{border-color:var(--spectrum-fieldbutton-border-color-error-down,var(--spectrum-global-color-red-600))}:host([invalid]) #button.focus-visible,:host([invalid]) #button.is-focused{border-color:var(--spectrum-fieldbutton-border-color-error-key-focus,var(--spectrum-alias-border-color-focus));box-shadow:0 0 0 var(--spectrum-button-primary-border-size-increase-key-focus,1px) var(--spectrum-fieldbutton-border-color-error-key-focus,var(--spectrum-alias-border-color-focus))}#button.is-disabled,#button:disabled{background-color:var(--spectrum-fieldbutton-background-color-disabled,var(--spectrum-global-color-gray-200));color:var(--spectrum-fieldbutton-text-color-disabled,var(--spectrum-alias-text-color-disabled))}#button.is-disabled .icon,#button:disabled .icon{color:var(--spectrum-fieldbutton-icon-color-disabled,var(--spectrum-alias-icon-color-disabled))}:host([quiet]) #button:hover{background-color:var(--spectrum-fieldbutton-quiet-background-color-hover,var(--spectrum-alias-background-color-transparent));color:var(--spectrum-fieldbutton-text-color-hover,var(--spectrum-alias-text-color-hover))}:host([quiet]) #button.focus-visible,:host([quiet]) #button.is-focused{background-color:var(--spectrum-fieldbutton-quiet-background-color-key-focus,var(--spectrum-alias-background-color-transparent));box-shadow:0 2px 0 0 var(--spectrum-fieldbutton-border-color-key-focus,var(--spectrum-alias-border-color-focus))}:host([quiet]) #button.focus-visible.is-placeholder,:host([quiet]) #button.is-focused.is-placeholder{color:var(--spectrum-fieldbutton-quiet-placeholder-text-color-key-focus,var(--spectrum-alias-placeholder-text-color-hover))}:host([quiet]) #button.is-selected,:host([quiet]) #button:active{background-color:var(--spectrum-fieldbutton-quiet-background-color-down,var(--spectrum-alias-background-color-transparent));border-color:var(--spectrum-fieldbutton-quiet-border-color-down,var(--spectrum-alias-border-color-transparent))}:host([quiet]) #button.is-selected.focus-visible,:host([quiet]) #button.is-selected.is-focused,:host([quiet]) #button:active.focus-visible,:host([quiet]) #button:active.is-focused{background-color:var(--spectrum-fieldbutton-quiet-background-color-key-focus,var(--spectrum-alias-background-color-transparent));box-shadow:0 2px 0 0 var(--spectrum-fieldbutton-border-color-key-focus,var(--spectrum-alias-border-color-focus))}:host([quiet][invalid]) #button.focus-visible,:host([quiet][invalid]) #button.is-focused{box-shadow:0 2px 0 0 var(--spectrum-fieldbutton-border-color-error-key-focus,var(--spectrum-alias-border-color-focus))}:host([quiet]) #button.is-disabled,:host([quiet]) #button:disabled{background-color:var(--spectrum-fieldbutton-quiet-background-color-disabled,var(--spectrum-alias-background-color-transparent));color:var(--spectrum-fieldbutton-text-color-disabled,var(--spectrum-alias-text-color-disabled))}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$h = css `
.chevron-down-medium{width:var(--spectrum-icon-chevron-down-medium-width);height:var(--spectrum-icon-chevron-down-medium-height,var(--spectrum-global-dimension-size-75))}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$i = css `
#selected{transform:scale(1);opacity:1;display:none;align-self:flex-start;flex-grow:0;margin-left:var(--spectrum-selectlist-option-icon-padding-x,var(--spectrum-global-dimension-size-150));margin-top:var(--spectrum-global-dimension-size-50)}#button{cursor:pointer;position:relative;display:flex;align-items:center;box-sizing:border-box;padding:var(--spectrum-global-dimension-size-85) var(--spectrum-selectlist-option-padding,var(--spectrum-global-dimension-static-size-150)) var(--spectrum-global-dimension-size-85) calc(var(--spectrum-selectlist-option-padding,
var(--spectrum-global-dimension-static-size-150)) - var(--spectrum-selectlist-border-size-key-focus,
var(--spectrum-global-dimension-static-size-25)));margin:0;border-left:var(--spectrum-selectlist-border-size-key-focus,var(--spectrum-global-dimension-static-size-25)) solid transparent;min-height:var(--spectrum-selectlist-option-height);font-size:var(--spectrum-selectlist-option-text-size,var(--spectrum-alias-font-size-default));font-weight:var(--spectrum-selectlist-option-text-font-weight,var(--spectrum-global-font-weight-regular));font-style:normal;text-decoration:none;background-color:var(--spectrum-selectlist-option-background-color,var(--spectrum-alias-background-color-transparent));color:var(--spectrum-selectlist-option-text-color,var(--spectrum-alias-text-color))}#button:focus{outline:none}:host([selected]) #button{padding-right:calc(var(--spectrum-selectlist-option-padding,
var(--spectrum-global-dimension-static-size-150)) - var(--spectrum-popover-border-size,
var(--spectrum-alias-border-size-thin)));color:var(--spectrum-selectlist-option-text-color-selected,var(--spectrum-alias-text-color))}:host([selected]) #button #selected{display:block;color:var(--spectrum-selectlist-option-icon-color-selected,var(--spectrum-alias-icon-color-selected))}.spectrum-Menu-itemIcon,::slotted([slot=icon]){flex-shrink:0;align-self:flex-start}.spectrum-Menu-itemIcon+#label,slot[name=icon]+#label{margin-left:var(--spectrum-selectlist-thumbnail-image-padding-x,var(--spectrum-global-dimension-size-100));width:calc(100% - var(--spectrum-icon-checkmark-medium-width) - var(--spectrum-selectlist-option-icon-padding-x,
var(--spectrum-global-dimension-size-150)) - var(--spectrum-selectlist-thumbnail-image-padding-x,
var(--spectrum-global-dimension-size-100)) - var(--spectrum-alias-workflow-icon-size,
var(--spectrum-global-dimension-size-225)))}#label{flex:1 1 auto;line-height:1.3;-webkit-hyphens:auto;hyphens:auto;overflow-wrap:break-word;width:calc(100% - var(--spectrum-icon-checkmark-medium-width) - var(--spectrum-selectlist-option-icon-padding-x,
var(--spectrum-global-dimension-size-150)))}.spectrum-Menu-itemLabel--wrapping{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}#button.focus-visible,#button.is-focused{background-color:var(--spectrum-selectlist-option-background-color-key-focus,var(--spectrum-alias-background-color-hover-overlay));color:var(--spectrum-selectlist-option-text-color-key-focus,var(--spectrum-alias-text-color));border-left-color:var(--spectrum-selectlist-option-focus-indicator-color,var(--spectrum-alias-border-color-focus))}#button.is-highlighted,#button.is-open,#button:focus,#button:hover{background-color:var(--spectrum-selectlist-option-background-color-hover,var(--spectrum-alias-background-color-hover-overlay));color:var(--spectrum-selectlist-option-text-color-hover,var(--spectrum-alias-text-color))}#button:active,.is-active{background-color:var(--spectrum-selectlist-option-background-color-down,var(--spectrum-alias-background-color-hover-overlay))}:host([disabled]) #button{background-color:var(--spectrum-selectlist-option-background-color-disabled,var(--spectrum-alias-background-color-transparent));background-image:none;color:var(--spectrum-selectlist-option-text-color-disabled,var(--spectrum-alias-text-color-disabled));cursor:default}#button{width:100%}button{border:0;background:0;padding:0;margin:0;display:inherit;font:inherit;color:inherit;text-align:inherit}#selected{flex-shrink:0}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$j = css `
.checkmark-medium{width:var(--spectrum-icon-checkmark-medium-width);height:var(--spectrum-icon-checkmark-medium-height)}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
/**
 * Spectrum Menu Item Component
 * @element sp-menu-item
 */
class MenuItem extends ActionButton {
    constructor() {
        super(...arguments);
        this.tabIndex = -1;
        this._value = '';
    }
    static get styles() {
        return [styles, styles$i, styles$j];
    }
    get value() {
        return this._value || this.itemText;
    }
    set value(value) {
        if (value === this.value) {
            return;
        }
        this._value = value || '';
        if (this.value) {
            this.setAttribute('value', this.value);
        }
        else {
            this.removeAttribute('value');
        }
    }
    get itemText() {
        return (this.textContent || /* istanbul ignore next */ '').trim();
    }
    get buttonContent() {
        const content = super.buttonContent;
        if (this.selected) {
            content.push(html `
                <sp-icons-medium></sp-icons-medium>
                <sp-icon
                    id="selected"
                    name="ui:CheckmarkMedium"
                    size="s"
                    slot="icon"
                    class="checkmark-medium"
                ></sp-icon>
            `);
        }
        return content;
    }
    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('role')) {
            const queryRoleEvent = new CustomEvent('sp-menu-item-query-role', {
                bubbles: true,
                composed: true,
                detail: {
                    role: '',
                },
            });
            this.dispatchEvent(queryRoleEvent);
            this.setAttribute('role', queryRoleEvent.detail.role || 'menuitem');
        }
    }
}
__decorate([
    property({ type: Number, reflect: true })
], MenuItem.prototype, "tabIndex", void 0);
__decorate([
    property({ type: String })
], MenuItem.prototype, "value", null);

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$k = css `
:host{box-sizing:initial;overflow:visible;height:var(--spectrum-selectlist-divider-size,var(--spectrum-alias-border-size-thick));margin:calc(var(--spectrum-selectlist-divider-padding, 3px)/2) var(--spectrum-selectlist-option-padding,var(--spectrum-global-dimension-static-size-150));padding:0;border:none;background-color:var(--spectrum-selectlist-divider-color,var(--spectrum-alias-border-color-extralight));display:block}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
/**
 * Spectrum Menu Divider Component
 * @element sp-menu-divider
 *
 */
class MenuDivider extends LitElement {
    static get styles() {
        return [styles$k];
    }
    firstUpdated() {
        this.setAttribute('role', 'separator');
    }
}

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
customElements.define('sp-menu-item', MenuItem);
customElements.define('sp-menu-divider', MenuDivider);

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$l = css `
:host{visibility:hidden;opacity:0;transition:transform var(--spectrum-global-animation-duration-100,.13s) ease-in-out,opacity var(--spectrum-global-animation-duration-100,.13s) ease-in-out,visibility 0ms linear var(--spectrum-global-animation-duration-100,.13s);pointer-events:none;display:inline-flex;flex-direction:column;box-sizing:border-box;min-width:var(--spectrum-global-dimension-size-400);min-height:var(--spectrum-global-dimension-size-400);position:absolute;border-radius:var(--spectrum-popover-border-radius,var(--spectrum-alias-border-radius-regular));outline:none;background-color:var(--spectrum-popover-background-color,var(--spectrum-global-color-gray-50));border:var(--spectrum-popover-border-size,var(--spectrum-alias-border-size-thin)) solid var(--spectrum-popover-border-color,var(--spectrum-alias-border-color-dark));box-shadow:0 1px 4px var(--spectrum-popover-shadow-color,var(--spectrum-alias-dropshadow-color))}:host([open]){visibility:visible;opacity:1;transition-delay:0ms;pointer-events:auto}:host([placement*=bottom][open]){transform:translateY(var(--spectrum-dropdown-flyout-menu-offset-y,var(--spectrum-global-dimension-size-75)))}:host([placement*=top][open]){transform:translateY(calc(-1*var(--spectrum-dropdown-flyout-menu-offset-y, var(--spectrum-global-dimension-size-75))))}:host([placement*=right][open]){transform:translateX(var(--spectrum-dropdown-flyout-menu-offset-y,var(--spectrum-global-dimension-size-75)))}:host([placement*=left][open]){transform:translateX(calc(-1*var(--spectrum-dropdown-flyout-menu-offset-y, var(--spectrum-global-dimension-size-75))))}#tip{overflow:hidden;width:calc(var(--spectrum-popover-tip-width,
var(--spectrum-global-dimension-size-250)) + 1px);height:calc(var(--spectrum-popover-tip-width,
var(--spectrum-global-dimension-size-250))/2 + var(--spectrum-popover-border-size,
var(--spectrum-alias-border-size-thin)))}#tip,#tip:after{position:absolute}#tip:after{content:"";width:var(--spectrum-popover-tip-width,var(--spectrum-global-dimension-size-250));height:var(--spectrum-popover-tip-width,var(--spectrum-global-dimension-size-250));transform:rotate(45deg);top:-18px;left:-1px;background-color:var(--spectrum-popover-background-color,var(--spectrum-global-color-gray-50));border:var(--spectrum-popover-border-size,var(--spectrum-alias-border-size-thin)) solid var(--spectrum-popover-border-color,var(--spectrum-alias-border-color-dark));box-shadow:-1px -1px 4px var(--spectrum-popover-shadow-color,var(--spectrum-alias-dropshadow-color))}:host([dialog]){min-width:270px;padding:30px 29px}:host([placement*=left][tip]){margin-right:13px}:host([placement*=left]) #tip{right:-16px;transform:rotate(-90deg)}:host([placement*=right][tip]){margin-left:13px}:host([placement*=right]) #tip{left:-16px;transform:rotate(90deg)}:host([placement*=left]) #tip,:host([placement*=right]) #tip{top:50%;margin-top:-6px}:host([placement*=bottom][tip]){margin-top:13px}:host([placement*=bottom]) #tip{top:-11px;transform:rotate(180deg)}:host([placement*=top][tip]){margin-bottom:13px}:host([placement*=top]) #tip{bottom:-11px}:host([placement*=bottom]) #tip,:host([placement*=top]) #tip{left:50%;margin-left:-12px}:host([dialog]) .spectrum-Dialog-typeIcon{margin-left:var(--spectrum-global-dimension-size-200)}.spectrum-Dialog-footer,.spectrum-Dialog-header,.spectrum-Dialog-wrapper{background-color:initial}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
/**
 * @attr {Boolean} open - The open state of the popover
 * @attr {Boolean} dialog - Adds some padding to the popover
 */
class Popover extends LitElement {
    constructor() {
        super(...arguments);
        this.placement = 'none';
        this.tip = false;
    }
    static get styles() {
        return [styles$l];
    }
    renderTip() {
        return html `
            <div id="tip"></div>
        `;
    }
    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('sp-overlay-query', this.onOverlayQuery);
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('sp-overlay-query', this.onOverlayQuery);
    }
    onOverlayQuery(event) {
        /* istanbul ignore if */
        if (!event.target || !this.shadowRoot)
            return;
        const target = event.target;
        /* istanbul ignore if */
        if (!target.isSameNode(this))
            return;
        const tipElement = this.shadowRoot.querySelector('#tip');
        if (tipElement) {
            event.detail.overlayContentTipElement = tipElement;
        }
    }
    render() {
        return html `
            <slot></slot>
            ${this.tip ? this.renderTip() : nothing}
        `;
    }
}
__decorate([
    property({ reflect: true })
], Popover.prototype, "placement", void 0);
__decorate([
    property({ type: Boolean, reflect: true })
], Popover.prototype, "tip", void 0);

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
/* istanbul ignore else */
if (!customElements.get('sp-popover')) {
    customElements.define('sp-popover', Popover);
}

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$m = css `
:host([disabled]) #trigger{pointer-events:none}#overlay-content{display:none}
`;

function getBoundingClientRect(element) {
  var rect = element.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    x: rect.left,
    y: rect.top
  };
}

/*:: import type { Window } from '../types'; */

/*:: declare function getWindow(node: Node | Window): Window; */
function getWindow(node) {
  if (node.toString() !== '[object Window]') {
    var ownerDocument = node.ownerDocument;
    return ownerDocument ? ownerDocument.defaultView : window;
  }

  return node;
}

function getWindowScroll(node) {
  var win = getWindow(node);
  var scrollLeft = win.pageXOffset;
  var scrollTop = win.pageYOffset;
  return {
    scrollLeft: scrollLeft,
    scrollTop: scrollTop
  };
}

/*:: declare function isElement(node: mixed): boolean %checks(node instanceof
  Element); */

function isElement(node) {
  var OwnElement = getWindow(node).Element;
  return node instanceof OwnElement || node instanceof Element;
}
/*:: declare function isHTMLElement(node: mixed): boolean %checks(node instanceof
  HTMLElement); */


function isHTMLElement(node) {
  var OwnElement = getWindow(node).HTMLElement;
  return node instanceof OwnElement || node instanceof HTMLElement;
}

function getHTMLElementScroll(element) {
  return {
    scrollLeft: element.scrollLeft,
    scrollTop: element.scrollTop
  };
}

function getNodeScroll(node) {
  if (node === getWindow(node) || !isHTMLElement(node)) {
    return getWindowScroll(node);
  } else {
    return getHTMLElementScroll(node);
  }
}

function getNodeName(element) {
  return element ? (element.nodeName || '').toLowerCase() : null;
}

function getDocumentElement(element) {
  // $FlowFixMe: assume body is always available
  return (isElement(element) ? element.ownerDocument : element.document).documentElement;
}

function getWindowScrollBarX(element) {
  // If <html> has a CSS width greater than the viewport, then this will be
  // incorrect for RTL.
  // Popper 1 is broken in this case and never had a bug report so let's assume
  // it's not an issue. I don't think anyone ever specifies width on <html>
  // anyway.
  // Browsers where the left scrollbar doesn't cause an issue report `0` for
  // this (e.g. Edge 2019, IE11, Safari)
  return getBoundingClientRect(getDocumentElement(element)).left + getWindowScroll(element).scrollLeft;
}

// Composite means it takes into account transforms as well as layout.

function getCompositeRect(elementOrVirtualElement, offsetParent, isFixed) {
  if (isFixed === void 0) {
    isFixed = false;
  }

  var documentElement;
  var rect = getBoundingClientRect(elementOrVirtualElement);
  var scroll = {
    scrollLeft: 0,
    scrollTop: 0
  };
  var offsets = {
    x: 0,
    y: 0
  };

  if (!isFixed) {
    if (getNodeName(offsetParent) !== 'body') {
      scroll = getNodeScroll(offsetParent);
    }

    if (isHTMLElement(offsetParent)) {
      offsets = getBoundingClientRect(offsetParent);
      offsets.x += offsetParent.clientLeft;
      offsets.y += offsetParent.clientTop;
    } else if (documentElement = getDocumentElement(offsetParent)) {
      offsets.x = getWindowScrollBarX(documentElement);
    }
  }

  return {
    x: rect.left + scroll.scrollLeft - offsets.x,
    y: rect.top + scroll.scrollTop - offsets.y,
    width: rect.width,
    height: rect.height
  };
}

// Returns the layout rect of an element relative to its offsetParent. Layout
// means it doesn't take into account transforms.
function getLayoutRect(element) {
  return {
    x: element.offsetLeft,
    y: element.offsetTop,
    width: element.offsetWidth,
    height: element.offsetHeight
  };
}

function getParentNode(element) {
  if (getNodeName(element) === 'html') {
    return element;
  }

  return element.parentNode || // DOM Element detected
  // $FlowFixMe: need a better way to handle this...
  element.host || // ShadowRoot detected
  document.ownerDocument || // Fallback to ownerDocument if available
  document.documentElement // Or to documentElement if everything else fails
  ;
}

function getComputedStyle(element) {
  return getWindow(element).getComputedStyle(element);
}

function getScrollParent(node) {
  if (['html', 'body', '#document'].indexOf(getNodeName(node)) >= 0) {
    // $FlowFixMe: assume body is always available
    return node.ownerDocument.body;
  }

  if (isHTMLElement(node)) {
    // Firefox wants us to check `-x` and `-y` variations as well
    var _getComputedStyle = getComputedStyle(node),
        overflow = _getComputedStyle.overflow,
        overflowX = _getComputedStyle.overflowX,
        overflowY = _getComputedStyle.overflowY;

    if (/auto|scroll|overlay|hidden/.test(overflow + overflowY + overflowX)) {
      return node;
    }
  }

  return getScrollParent(getParentNode(node));
}

function listScrollParents(element, list) {
  if (list === void 0) {
    list = [];
  }

  var scrollParent = getScrollParent(element);
  var isBody = getNodeName(scrollParent) === 'body';
  var target = isBody ? getWindow(scrollParent) : scrollParent;
  var updatedList = list.concat(target);
  return isBody ? updatedList : // $FlowFixMe: isBody tells us target will be an HTMLElement here
  updatedList.concat(listScrollParents(getParentNode(target)));
}

function isTableElement(element) {
  return ['table', 'td', 'th'].indexOf(getNodeName(element)) >= 0;
}

var isFirefox = function isFirefox() {
  return typeof window.InstallTrigger !== 'undefined';
};

function getTrueOffsetParent(element) {
  var offsetParent;

  if (!isHTMLElement(element) || !(offsetParent = element.offsetParent) || // https://github.com/popperjs/popper-core/issues/837
  isFirefox() && getComputedStyle(offsetParent).position === 'fixed') {
    return null;
  }

  return offsetParent;
}

function getOffsetParent(element) {
  var window = getWindow(element);
  var offsetParent = getTrueOffsetParent(element); // Find the nearest non-table offsetParent

  while (offsetParent && isTableElement(offsetParent)) {
    offsetParent = getTrueOffsetParent(offsetParent);
  }

  if (offsetParent && getNodeName(offsetParent) === 'body' && getComputedStyle(offsetParent).position === 'static') {
    return window;
  }

  return offsetParent || window;
}

var top = 'top';
var bottom = 'bottom';
var right = 'right';
var left = 'left';
var auto = 'auto';
var basePlacements = [top, bottom, right, left];
var start = 'start';
var end = 'end';
var clippingParents = 'clippingParents';
var viewport = 'viewport';
var popper = 'popper';
var reference = 'reference';
var variationPlacements =
/*#__PURE__*/
basePlacements.reduce(function (acc, placement) {
  return acc.concat([placement + "-" + start, placement + "-" + end]);
}, []);
var placements =
/*#__PURE__*/
[].concat(basePlacements, [auto]).reduce(function (acc, placement) {
  return acc.concat([placement, placement + "-" + start, placement + "-" + end]);
}, []); // modifiers that need to read the DOM

var beforeRead = 'beforeRead';
var read = 'read';
var afterRead = 'afterRead'; // pure-logic modifiers

var beforeMain = 'beforeMain';
var main = 'main';
var afterMain = 'afterMain'; // modifier with the purpose to write to the DOM (or write into a framework state)

var beforeWrite = 'beforeWrite';
var write = 'write';
var afterWrite = 'afterWrite';
var modifierPhases = [beforeRead, read, afterRead, beforeMain, main, afterMain, beforeWrite, write, afterWrite];

function order(modifiers) {
  var map = new Map();
  var visited = new Set();
  var result = [];
  modifiers.forEach(function (modifier) {
    map.set(modifier.name, modifier);
  }); // On visiting object, check for its dependencies and visit them recursively

  function sort(modifier) {
    visited.add(modifier.name);
    var requires = [].concat(modifier.requires || [], modifier.requiresIfExists || []);
    requires.forEach(function (dep) {
      if (!visited.has(dep)) {
        var depModifier = map.get(dep);

        if (depModifier) {
          sort(depModifier);
        }
      }
    });
    result.push(modifier);
  }

  modifiers.forEach(function (modifier) {
    if (!visited.has(modifier.name)) {
      // check for visited object
      sort(modifier);
    }
  });
  return result;
}

function orderModifiers(modifiers) {
  // order based on dependencies
  var orderedModifiers = order(modifiers); // order based on phase

  return modifierPhases.reduce(function (acc, phase) {
    return acc.concat(orderedModifiers.filter(function (modifier) {
      return modifier.phase === phase;
    }));
  }, []);
}

function debounce(fn) {
  var pending;
  return function () {
    if (!pending) {
      pending = new Promise(function (resolve) {
        Promise.resolve().then(function () {
          pending = undefined;
          resolve(fn());
        });
      });
    }

    return pending;
  };
}

function getBasePlacement(placement) {
  return placement.split('-')[0];
}

function mergeByName(modifiers) {
  var merged = modifiers.reduce(function (merged, current) {
    var existing = merged[current.name];
    merged[current.name] = existing ? Object.assign({}, existing, {}, current, {
      options: Object.assign({}, existing.options, {}, current.options),
      data: Object.assign({}, existing.data, {}, current.data)
    }) : current;
    return merged;
  }, {}); // IE11 does not support Object.values

  return Object.keys(merged).map(function (key) {
    return merged[key];
  });
}

var DEFAULT_OPTIONS = {
  placement: 'bottom',
  modifiers: [],
  strategy: 'absolute'
};

function areValidElements() {
  for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  return !args.some(function (element) {
    return !(element && typeof element.getBoundingClientRect === 'function');
  });
}

function popperGenerator(generatorOptions) {
  if (generatorOptions === void 0) {
    generatorOptions = {};
  }

  var _generatorOptions = generatorOptions,
      _generatorOptions$def = _generatorOptions.defaultModifiers,
      defaultModifiers = _generatorOptions$def === void 0 ? [] : _generatorOptions$def,
      _generatorOptions$def2 = _generatorOptions.defaultOptions,
      defaultOptions = _generatorOptions$def2 === void 0 ? DEFAULT_OPTIONS : _generatorOptions$def2;
  return function createPopper(reference, popper, options) {
    if (options === void 0) {
      options = defaultOptions;
    }

    var state = {
      placement: 'bottom',
      orderedModifiers: [],
      options: Object.assign({}, DEFAULT_OPTIONS, {}, defaultOptions),
      modifiersData: {},
      elements: {
        reference: reference,
        popper: popper
      },
      attributes: {},
      styles: {}
    };
    var effectCleanupFns = [];
    var isDestroyed = false;
    var instance = {
      state: state,
      setOptions: function setOptions(options) {
        cleanupModifierEffects();
        state.options = Object.assign({}, defaultOptions, {}, state.options, {}, options);
        state.scrollParents = {
          reference: isElement(reference) ? listScrollParents(reference) : [],
          popper: listScrollParents(popper)
        }; // Orders the modifiers based on their dependencies and `phase`
        // properties

        var orderedModifiers = orderModifiers(mergeByName([].concat(defaultModifiers, state.options.modifiers))); // Strip out disabled modifiers

        state.orderedModifiers = orderedModifiers.filter(function (m) {
          return m.enabled;
        }); // Validate the provided modifiers so that the consumer will get warned

        runModifierEffects();
        return instance.update();
      },
      // Sync update – it will always be executed, even if not necessary. This
      // is useful for low frequency updates where sync behavior simplifies the
      // logic.
      // For high frequency updates (e.g. `resize` and `scroll` events), always
      // prefer the async Popper#update method
      forceUpdate: function forceUpdate() {
        if (isDestroyed) {
          return;
        }

        var _state$elements = state.elements,
            reference = _state$elements.reference,
            popper = _state$elements.popper; // Don't proceed if `reference` or `popper` are not valid elements
        // anymore

        if (!areValidElements(reference, popper)) {

          return;
        } // Store the reference and popper rects to be read by modifiers


        state.rects = {
          reference: getCompositeRect(reference, getOffsetParent(popper), state.options.strategy === 'fixed'),
          popper: getLayoutRect(popper)
        }; // Modifiers have the ability to reset the current update cycle. The
        // most common use case for this is the `flip` modifier changing the
        // placement, which then needs to re-run all the modifiers, because the
        // logic was previously ran for the previous placement and is therefore
        // stale/incorrect

        state.reset = false;
        state.placement = state.options.placement; // On each update cycle, the `modifiersData` property for each modifier
        // is filled with the initial data specified by the modifier. This means
        // it doesn't persist and is fresh on each update.
        // To ensure persistent data, use `${name}#persistent`

        state.orderedModifiers.forEach(function (modifier) {
          return state.modifiersData[modifier.name] = Object.assign({}, modifier.data);
        });

        for (var index = 0; index < state.orderedModifiers.length; index++) {

          if (state.reset === true) {
            state.reset = false;
            index = -1;
            continue;
          }

          var _state$orderedModifie = state.orderedModifiers[index],
              fn = _state$orderedModifie.fn,
              _state$orderedModifie2 = _state$orderedModifie.options,
              _options = _state$orderedModifie2 === void 0 ? {} : _state$orderedModifie2,
              name = _state$orderedModifie.name;

          if (typeof fn === 'function') {
            state = fn({
              state: state,
              options: _options,
              name: name,
              instance: instance
            }) || state;
          }
        }
      },
      // Async and optimistically optimized update – it will not be executed if
      // not necessary (debounced to run at most once-per-tick)
      update: debounce(function () {
        return new Promise(function (resolve) {
          instance.forceUpdate();
          resolve(state);
        });
      }),
      destroy: function destroy() {
        cleanupModifierEffects();
        isDestroyed = true;
      }
    };

    if (!areValidElements(reference, popper)) {

      return instance;
    }

    instance.setOptions(options).then(function (state) {
      if (!isDestroyed && options.onFirstUpdate) {
        options.onFirstUpdate(state);
      }
    }); // Modifiers have the ability to execute arbitrary code before the first
    // update cycle runs. They will be executed in the same order as the update
    // cycle. This is useful when a modifier adds some persistent data that
    // other modifiers need to use, but the modifier is run after the dependent
    // one.

    function runModifierEffects() {
      state.orderedModifiers.forEach(function (_ref3) {
        var name = _ref3.name,
            _ref3$options = _ref3.options,
            options = _ref3$options === void 0 ? {} : _ref3$options,
            effect = _ref3.effect;

        if (typeof effect === 'function') {
          var cleanupFn = effect({
            state: state,
            name: name,
            instance: instance,
            options: options
          });

          var noopFn = function noopFn() {};

          effectCleanupFns.push(cleanupFn || noopFn);
        }
      });
    }

    function cleanupModifierEffects() {
      effectCleanupFns.forEach(function (fn) {
        return fn();
      });
      effectCleanupFns = [];
    }

    return instance;
  };
}

var passive = {
  passive: true
};

function effect(_ref) {
  var state = _ref.state,
      instance = _ref.instance,
      options = _ref.options;
  var _options$scroll = options.scroll,
      scroll = _options$scroll === void 0 ? true : _options$scroll,
      _options$resize = options.resize,
      resize = _options$resize === void 0 ? true : _options$resize;
  var window = getWindow(state.elements.popper);
  var scrollParents = [].concat(state.scrollParents.reference, state.scrollParents.popper);

  if (scroll) {
    scrollParents.forEach(function (scrollParent) {
      scrollParent.addEventListener('scroll', instance.update, passive);
    });
  }

  if (resize) {
    window.addEventListener('resize', instance.update, passive);
  }

  return function () {
    if (scroll) {
      scrollParents.forEach(function (scrollParent) {
        scrollParent.removeEventListener('scroll', instance.update, passive);
      });
    }

    if (resize) {
      window.removeEventListener('resize', instance.update, passive);
    }
  };
}

var eventListeners = {
  name: 'eventListeners',
  enabled: true,
  phase: 'write',
  fn: function fn() {},
  effect: effect,
  data: {}
};

function getVariation(placement) {
  return placement.split('-')[1];
}

function getMainAxisFromPlacement(placement) {
  return ['top', 'bottom'].indexOf(placement) >= 0 ? 'x' : 'y';
}

function computeOffsets(_ref) {
  var reference = _ref.reference,
      element = _ref.element,
      placement = _ref.placement;
  var basePlacement = placement ? getBasePlacement(placement) : null;
  var variation = placement ? getVariation(placement) : null;
  var commonX = reference.x + reference.width / 2 - element.width / 2;
  var commonY = reference.y + reference.height / 2 - element.height / 2;
  var offsets;

  switch (basePlacement) {
    case top:
      offsets = {
        x: commonX,
        y: reference.y - element.height
      };
      break;

    case bottom:
      offsets = {
        x: commonX,
        y: reference.y + reference.height
      };
      break;

    case right:
      offsets = {
        x: reference.x + reference.width,
        y: commonY
      };
      break;

    case left:
      offsets = {
        x: reference.x - element.width,
        y: commonY
      };
      break;

    default:
      offsets = {
        x: reference.x,
        y: reference.y
      };
  }

  var mainAxis = basePlacement ? getMainAxisFromPlacement(basePlacement) : null;

  if (mainAxis != null) {
    var len = mainAxis === 'y' ? 'height' : 'width';

    switch (variation) {
      case start:
        offsets[mainAxis] = Math.floor(offsets[mainAxis]) - Math.floor(reference[len] / 2 - element[len] / 2);
        break;

      case end:
        offsets[mainAxis] = Math.floor(offsets[mainAxis]) + Math.ceil(reference[len] / 2 - element[len] / 2);
        break;
    }
  }

  return offsets;
}

function popperOffsets(_ref) {
  var state = _ref.state,
      name = _ref.name;
  // Offsets are the actual position the popper needs to have to be
  // properly positioned near its reference element
  // This is the most basic placement, and will be adjusted by
  // the modifiers in the next step
  state.modifiersData[name] = computeOffsets({
    reference: state.rects.reference,
    element: state.rects.popper,
    strategy: 'absolute',
    placement: state.placement
  });
}

var popperOffsets$1 = {
  name: 'popperOffsets',
  enabled: true,
  phase: 'read',
  fn: popperOffsets,
  data: {}
};

var unsetSides = {
  top: 'auto',
  right: 'auto',
  bottom: 'auto',
  left: 'auto'
}; // Round the offsets to the nearest suitable subpixel based on the DPR.
// Zooming can change the DPR, but it seems to report a value that will
// cleanly divide the values into the appropriate subpixels.

function roundOffsets(_ref) {
  var x = _ref.x,
      y = _ref.y;
  var win = window;
  var dpr = win.devicePixelRatio || 1;
  return {
    x: Math.round(x * dpr) / dpr || 0,
    y: Math.round(y * dpr) / dpr || 0
  };
}

function mapToStyles(_ref2) {
  var _Object$assign2;

  var popper = _ref2.popper,
      popperRect = _ref2.popperRect,
      placement = _ref2.placement,
      offsets = _ref2.offsets,
      position = _ref2.position,
      gpuAcceleration = _ref2.gpuAcceleration,
      adaptive = _ref2.adaptive;

  var _roundOffsets = roundOffsets(offsets),
      x = _roundOffsets.x,
      y = _roundOffsets.y;

  var hasX = offsets.hasOwnProperty('x');
  var hasY = offsets.hasOwnProperty('y');
  var sideX = left;
  var sideY = top;
  var win = window;

  if (adaptive) {
    var offsetParent = getOffsetParent(popper);

    if (offsetParent === getWindow(popper)) {
      offsetParent = getDocumentElement(popper);
    } // $FlowFixMe: force type refinement, we compare offsetParent with window above, but Flow doesn't detect it

    /*:: offsetParent = (offsetParent: Element); */


    if (placement === top) {
      sideY = bottom;
      y -= offsetParent.clientHeight - popperRect.height;
      y *= gpuAcceleration ? 1 : -1;
    }

    if (placement === left) {
      sideX = right;
      x -= offsetParent.clientWidth - popperRect.width;
      x *= gpuAcceleration ? 1 : -1;
    }
  }

  var commonStyles = Object.assign({
    position: position
  }, adaptive && unsetSides);

  if (gpuAcceleration) {
    var _Object$assign;

    return Object.assign({}, commonStyles, (_Object$assign = {}, _Object$assign[sideY] = hasY ? '0' : '', _Object$assign[sideX] = hasX ? '0' : '', _Object$assign.transform = (win.devicePixelRatio || 1) < 2 ? "translate(" + x + "px, " + y + "px)" : "translate3d(" + x + "px, " + y + "px, 0)", _Object$assign));
  }

  return Object.assign({}, commonStyles, (_Object$assign2 = {}, _Object$assign2[sideY] = hasY ? y + "px" : '', _Object$assign2[sideX] = hasX ? x + "px" : '', _Object$assign2.transform = '', _Object$assign2));
}

function computeStyles(_ref3) {
  var state = _ref3.state,
      options = _ref3.options;
  var _options$gpuAccelerat = options.gpuAcceleration,
      gpuAcceleration = _options$gpuAccelerat === void 0 ? true : _options$gpuAccelerat,
      _options$adaptive = options.adaptive,
      adaptive = _options$adaptive === void 0 ? true : _options$adaptive;

  var commonStyles = {
    placement: getBasePlacement(state.placement),
    popper: state.elements.popper,
    popperRect: state.rects.popper,
    gpuAcceleration: gpuAcceleration
  }; // popper offsets are always available

  state.styles.popper = Object.assign({}, state.styles.popper, {}, mapToStyles(Object.assign({}, commonStyles, {
    offsets: state.modifiersData.popperOffsets,
    position: state.options.strategy,
    adaptive: adaptive
  }))); // arrow offsets may not be available

  if (state.modifiersData.arrow != null) {
    state.styles.arrow = Object.assign({}, state.styles.arrow, {}, mapToStyles(Object.assign({}, commonStyles, {
      offsets: state.modifiersData.arrow,
      position: 'absolute',
      adaptive: false
    })));
  }

  state.attributes.popper = Object.assign({}, state.attributes.popper, {
    'data-popper-placement': state.placement
  });
}

var computeStyles$1 = {
  name: 'computeStyles',
  enabled: true,
  phase: 'beforeWrite',
  fn: computeStyles,
  data: {}
};

// and applies them to the HTMLElements such as popper and arrow

function applyStyles(_ref) {
  var state = _ref.state;
  Object.keys(state.elements).forEach(function (name) {
    var style = state.styles[name] || {};
    var attributes = state.attributes[name] || {};
    var element = state.elements[name]; // arrow is optional + virtual elements

    if (!isHTMLElement(element) || !getNodeName(element)) {
      return;
    } // Flow doesn't support to extend this property, but it's the most
    // effective way to apply styles to an HTMLElement
    // $FlowFixMe


    Object.assign(element.style, style);
    Object.keys(attributes).forEach(function (name) {
      var value = attributes[name];

      if (value === false) {
        element.removeAttribute(name);
      } else {
        element.setAttribute(name, value === true ? '' : value);
      }
    });
  });
}

function effect$1(_ref2) {
  var state = _ref2.state;
  var initialStyles = {
    popper: {
      position: 'absolute',
      left: '0',
      top: '0',
      margin: '0'
    },
    arrow: {
      position: 'absolute'
    },
    reference: {}
  };
  Object.assign(state.elements.popper.style, initialStyles.popper);

  if (state.elements.arrow) {
    Object.assign(state.elements.arrow.style, initialStyles.arrow);
  }

  return function () {
    Object.keys(state.elements).forEach(function (name) {
      var element = state.elements[name];
      var attributes = state.attributes[name] || {};
      var styleProperties = Object.keys(state.styles.hasOwnProperty(name) ? state.styles[name] : initialStyles[name]); // Set all values to an empty string to unset them

      var style = styleProperties.reduce(function (style, property) {
        style[property] = '';
        return style;
      }, {}); // arrow is optional + virtual elements

      if (!isHTMLElement(element) || !getNodeName(element)) {
        return;
      } // Flow doesn't support to extend this property, but it's the most
      // effective way to apply styles to an HTMLElement
      // $FlowFixMe


      Object.assign(element.style, style);
      Object.keys(attributes).forEach(function (attribute) {
        element.removeAttribute(attribute);
      });
    });
  };
}

var applyStyles$1 = {
  name: 'applyStyles',
  enabled: true,
  phase: 'write',
  fn: applyStyles,
  effect: effect$1,
  requires: ['computeStyles']
};

var defaultModifiers = [eventListeners, popperOffsets$1, computeStyles$1, applyStyles$1];

var hash = {
  left: 'right',
  right: 'left',
  bottom: 'top',
  top: 'bottom'
};
function getOppositePlacement(placement) {
  return placement.replace(/left|right|bottom|top/g, function (matched) {
    return hash[matched];
  });
}

var hash$1 = {
  start: 'end',
  end: 'start'
};
function getOppositeVariationPlacement(placement) {
  return placement.replace(/start|end/g, function (matched) {
    return hash$1[matched];
  });
}

function getViewportRect(element) {
  var win = getWindow(element);
  return {
    width: win.innerWidth,
    height: win.innerHeight,
    x: 0,
    y: 0
  };
}

function getDocumentRect(element) {
  var win = getWindow(element);
  var winScroll = getWindowScroll(element);
  var documentRect = getCompositeRect(getDocumentElement(element), win);
  documentRect.height = Math.max(documentRect.height, win.innerHeight);
  documentRect.width = Math.max(documentRect.width, win.innerWidth);
  documentRect.x = -winScroll.scrollLeft;
  documentRect.y = -winScroll.scrollTop;
  return documentRect;
}

function toNumber(cssValue) {
  return parseFloat(cssValue) || 0;
}

function getBorders(element) {
  var computedStyle = isHTMLElement(element) ? getComputedStyle(element) : {};
  return {
    top: toNumber(computedStyle.borderTopWidth),
    right: toNumber(computedStyle.borderRightWidth),
    bottom: toNumber(computedStyle.borderBottomWidth),
    left: toNumber(computedStyle.borderLeftWidth)
  };
}

function getDecorations(element) {
  var win = getWindow(element);
  var borders = getBorders(element);
  var isHTML = getNodeName(element) === 'html';
  var winScrollBarX = getWindowScrollBarX(element);
  var x = element.clientWidth + borders.right;
  var y = element.clientHeight + borders.bottom; // HACK:
  // document.documentElement.clientHeight on iOS reports the height of the
  // viewport including the bottom bar, even if the bottom bar isn't visible.
  // If the difference between window innerHeight and html clientHeight is more
  // than 50, we assume it's a mobile bottom bar and ignore scrollbars.
  // * A 50px thick scrollbar is likely non-existent (macOS is 15px and Windows
  //   is about 17px)
  // * The mobile bar is 114px tall

  if (isHTML && win.innerHeight - element.clientHeight > 50) {
    y = win.innerHeight - borders.bottom;
  }

  return {
    top: isHTML ? 0 : element.clientTop,
    right: // RTL scrollbar (scrolling containers only)
    element.clientLeft > borders.left ? borders.right : // LTR scrollbar
    isHTML ? win.innerWidth - x - winScrollBarX : element.offsetWidth - x,
    bottom: isHTML ? win.innerHeight - y : element.offsetHeight - y,
    left: isHTML ? winScrollBarX : element.clientLeft
  };
}

function contains(parent, child) {
  // $FlowFixMe: hasOwnProperty doesn't seem to work in tests
  var isShadow = Boolean(child.getRootNode && child.getRootNode().host); // First, attempt with faster native method

  if (parent.contains(child)) {
    return true;
  } // then fallback to custom implementation with Shadow DOM support
  else if (isShadow) {
      var next = child;

      do {
        if (next && parent.isSameNode(next)) {
          return true;
        } // $FlowFixMe: need a better way to handle this...


        next = next.parentNode || next.host;
      } while (next);
    } // Give up, the result is false


  return false;
}

function rectToClientRect(rect) {
  return Object.assign({}, rect, {
    left: rect.x,
    top: rect.y,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height
  });
}

function getClientRectFromMixedType(element, clippingParent) {
  return clippingParent === viewport ? rectToClientRect(getViewportRect(element)) : isHTMLElement(clippingParent) ? getBoundingClientRect(clippingParent) : rectToClientRect(getDocumentRect(getDocumentElement(element)));
} // A "clipping parent" is an overflowable container with the characteristic of
// clipping (or hiding) overflowing elements with a position different from
// `initial`


function getClippingParents(element) {
  var clippingParents = listScrollParents(element);
  var canEscapeClipping = ['absolute', 'fixed'].indexOf(getComputedStyle(element).position) >= 0;
  var clipperElement = canEscapeClipping && isHTMLElement(element) ? getOffsetParent(element) : element;

  if (!isElement(clipperElement)) {
    return [];
  } // $FlowFixMe: https://github.com/facebook/flow/issues/1414


  return clippingParents.filter(function (clippingParent) {
    return isElement(clippingParent) && contains(clippingParent, clipperElement);
  });
} // Gets the maximum area that the element is visible in due to any number of
// clipping parents


function getClippingRect(element, boundary, rootBoundary) {
  var mainClippingParents = boundary === 'clippingParents' ? getClippingParents(element) : [].concat(boundary);
  var clippingParents = [].concat(mainClippingParents, [rootBoundary]);
  var firstClippingParent = clippingParents[0];
  var clippingRect = clippingParents.reduce(function (accRect, clippingParent) {
    var rect = getClientRectFromMixedType(element, clippingParent);
    var decorations = getDecorations(isHTMLElement(clippingParent) ? clippingParent : getDocumentElement(element));
    accRect.top = Math.max(rect.top + decorations.top, accRect.top);
    accRect.right = Math.min(rect.right - decorations.right, accRect.right);
    accRect.bottom = Math.min(rect.bottom - decorations.bottom, accRect.bottom);
    accRect.left = Math.max(rect.left + decorations.left, accRect.left);
    return accRect;
  }, getClientRectFromMixedType(element, firstClippingParent));
  clippingRect.width = clippingRect.right - clippingRect.left;
  clippingRect.height = clippingRect.bottom - clippingRect.top;
  clippingRect.x = clippingRect.left;
  clippingRect.y = clippingRect.top;
  return clippingRect;
}

function getFreshSideObject() {
  return {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  };
}

function mergePaddingObject(paddingObject) {
  return Object.assign({}, getFreshSideObject(), {}, paddingObject);
}

function expandToHashMap(value, keys) {
  return keys.reduce(function (hashMap, key) {
    hashMap[key] = value;
    return hashMap;
  }, {});
}

function detectOverflow(state, options) {
  if (options === void 0) {
    options = {};
  }

  var _options = options,
      _options$placement = _options.placement,
      placement = _options$placement === void 0 ? state.placement : _options$placement,
      _options$boundary = _options.boundary,
      boundary = _options$boundary === void 0 ? clippingParents : _options$boundary,
      _options$rootBoundary = _options.rootBoundary,
      rootBoundary = _options$rootBoundary === void 0 ? viewport : _options$rootBoundary,
      _options$elementConte = _options.elementContext,
      elementContext = _options$elementConte === void 0 ? popper : _options$elementConte,
      _options$altBoundary = _options.altBoundary,
      altBoundary = _options$altBoundary === void 0 ? false : _options$altBoundary,
      _options$padding = _options.padding,
      padding = _options$padding === void 0 ? 0 : _options$padding;
  var paddingObject = mergePaddingObject(typeof padding !== 'number' ? padding : expandToHashMap(padding, basePlacements));
  var altContext = elementContext === popper ? reference : popper;
  var referenceElement = state.elements.reference;
  var popperRect = state.rects.popper;
  var element = state.elements[altBoundary ? altContext : elementContext];
  var clippingClientRect = getClippingRect(isElement(element) ? element : getDocumentElement(state.elements.popper), boundary, rootBoundary);
  var referenceClientRect = getBoundingClientRect(referenceElement);
  var popperOffsets = computeOffsets({
    reference: referenceClientRect,
    element: popperRect,
    strategy: 'absolute',
    placement: placement
  });
  var popperClientRect = rectToClientRect(Object.assign({}, popperRect, {}, popperOffsets));
  var elementClientRect = elementContext === popper ? popperClientRect : referenceClientRect; // positive = overflowing the clipping rect
  // 0 or negative = within the clipping rect

  var overflowOffsets = {
    top: clippingClientRect.top - elementClientRect.top + paddingObject.top,
    bottom: elementClientRect.bottom - clippingClientRect.bottom + paddingObject.bottom,
    left: clippingClientRect.left - elementClientRect.left + paddingObject.left,
    right: elementClientRect.right - clippingClientRect.right + paddingObject.right
  };
  var offsetData = state.modifiersData.offset; // Offsets can be applied only to the popper element

  if (elementContext === popper && offsetData) {
    var offset = offsetData[placement];
    Object.keys(overflowOffsets).forEach(function (key) {
      var multiply = [right, bottom].indexOf(key) >= 0 ? 1 : -1;
      var axis = [top, bottom].indexOf(key) >= 0 ? 'y' : 'x';
      overflowOffsets[key] += offset[axis] * multiply;
    });
  }

  return overflowOffsets;
}

function computeAutoPlacement(state, options) {
  if (options === void 0) {
    options = {};
  }

  var _options = options,
      placement = _options.placement,
      boundary = _options.boundary,
      rootBoundary = _options.rootBoundary,
      padding = _options.padding,
      flipVariations = _options.flipVariations;
  var variation = getVariation(placement);
  var placements = variation ? flipVariations ? variationPlacements : variationPlacements.filter(function (placement) {
    return getVariation(placement) === variation;
  }) : basePlacements; // $FlowFixMe: Flow seems to have problems with two array unions...

  var overflows = placements.reduce(function (acc, placement) {
    acc[placement] = detectOverflow(state, {
      placement: placement,
      boundary: boundary,
      rootBoundary: rootBoundary,
      padding: padding
    })[getBasePlacement(placement)];
    return acc;
  }, {});
  return Object.keys(overflows).sort(function (a, b) {
    return overflows[a] - overflows[b];
  });
}

function getExpandedFallbackPlacements(placement) {
  if (getBasePlacement(placement) === auto) {
    return [];
  }

  var oppositePlacement = getOppositePlacement(placement);
  return [getOppositeVariationPlacement(placement), oppositePlacement, getOppositeVariationPlacement(oppositePlacement)];
}

function flip(_ref) {
  var state = _ref.state,
      options = _ref.options,
      name = _ref.name;

  if (state.modifiersData[name]._skip) {
    return;
  }

  var specifiedFallbackPlacements = options.fallbackPlacements,
      padding = options.padding,
      boundary = options.boundary,
      rootBoundary = options.rootBoundary,
      altBoundary = options.altBoundary,
      _options$flipVariatio = options.flipVariations,
      flipVariations = _options$flipVariatio === void 0 ? true : _options$flipVariatio;
  var preferredPlacement = state.options.placement;
  var basePlacement = getBasePlacement(preferredPlacement);
  var isBasePlacement = basePlacement === preferredPlacement;
  var fallbackPlacements = specifiedFallbackPlacements || (isBasePlacement || !flipVariations ? [getOppositePlacement(preferredPlacement)] : getExpandedFallbackPlacements(preferredPlacement));
  var placements = [preferredPlacement].concat(fallbackPlacements).reduce(function (acc, placement) {
    return acc.concat(getBasePlacement(placement) === auto ? computeAutoPlacement(state, {
      placement: placement,
      boundary: boundary,
      rootBoundary: rootBoundary,
      padding: padding,
      flipVariations: flipVariations
    }) : placement);
  }, []);
  var referenceRect = state.rects.reference;
  var popperRect = state.rects.popper;
  var checksMap = new Map();
  var makeFallbackChecks = true;
  var firstFittingPlacement = placements[0];

  for (var i = 0; i < placements.length; i++) {
    var placement = placements[i];

    var _basePlacement = getBasePlacement(placement);

    var isStartVariation = getVariation(placement) === start;
    var isVertical = [top, bottom].indexOf(_basePlacement) >= 0;
    var len = isVertical ? 'width' : 'height';
    var overflow = detectOverflow(state, {
      placement: placement,
      boundary: boundary,
      rootBoundary: rootBoundary,
      altBoundary: altBoundary,
      padding: padding
    });
    var mainVariationSide = isVertical ? isStartVariation ? right : left : isStartVariation ? bottom : top;

    if (referenceRect[len] > popperRect[len]) {
      mainVariationSide = getOppositePlacement(mainVariationSide);
    }

    var altVariationSide = getOppositePlacement(mainVariationSide);
    var checks = [overflow[_basePlacement] <= 0, overflow[mainVariationSide] <= 0, overflow[altVariationSide] <= 0];

    if (checks.every(function (check) {
      return check;
    })) {
      firstFittingPlacement = placement;
      makeFallbackChecks = false;
      break;
    }

    checksMap.set(placement, checks);
  }

  if (makeFallbackChecks) {
    // `2` may be desired in some cases – research later
    var numberOfChecks = flipVariations ? 3 : 1;

    var _loop = function _loop(_i) {
      var fittingPlacement = placements.find(function (placement) {
        var checks = checksMap.get(placement);

        if (checks) {
          return checks.slice(0, _i).every(function (check) {
            return check;
          });
        }
      });

      if (fittingPlacement) {
        firstFittingPlacement = fittingPlacement;
        return "break";
      }
    };

    for (var _i = numberOfChecks; _i > 0; _i--) {
      var _ret = _loop(_i);

      if (_ret === "break") break;
    }
  }

  if (state.placement !== firstFittingPlacement) {
    state.modifiersData[name]._skip = true;
    state.placement = firstFittingPlacement;
    state.reset = true;
  }
}

var flip$1 = {
  name: 'flip',
  enabled: true,
  phase: 'main',
  fn: flip,
  requiresIfExists: ['offset'],
  data: {
    _skip: false
  }
};

function getAltAxis(axis) {
  return axis === 'x' ? 'y' : 'x';
}

function within(min, value, max) {
  return Math.max(min, Math.min(value, max));
}

function preventOverflow(_ref) {
  var state = _ref.state,
      options = _ref.options,
      name = _ref.name;
  var _options$mainAxis = options.mainAxis,
      checkMainAxis = _options$mainAxis === void 0 ? true : _options$mainAxis,
      _options$altAxis = options.altAxis,
      checkAltAxis = _options$altAxis === void 0 ? false : _options$altAxis,
      boundary = options.boundary,
      rootBoundary = options.rootBoundary,
      altBoundary = options.altBoundary,
      padding = options.padding,
      _options$tether = options.tether,
      tether = _options$tether === void 0 ? true : _options$tether,
      _options$tetherOffset = options.tetherOffset,
      tetherOffset = _options$tetherOffset === void 0 ? 0 : _options$tetherOffset;
  var overflow = detectOverflow(state, {
    boundary: boundary,
    rootBoundary: rootBoundary,
    padding: padding,
    altBoundary: altBoundary
  });
  var basePlacement = getBasePlacement(state.placement);
  var variation = getVariation(state.placement);
  var isBasePlacement = !variation;
  var mainAxis = getMainAxisFromPlacement(basePlacement);
  var altAxis = getAltAxis(mainAxis);
  var popperOffsets = state.modifiersData.popperOffsets;
  var referenceRect = state.rects.reference;
  var popperRect = state.rects.popper;
  var tetherOffsetValue = typeof tetherOffset === 'function' ? tetherOffset(Object.assign({}, state.rects, {
    placement: state.placement
  })) : tetherOffset;
  var data = {
    x: 0,
    y: 0
  };

  if (checkMainAxis) {
    var mainSide = mainAxis === 'y' ? top : left;
    var altSide = mainAxis === 'y' ? bottom : right;
    var len = mainAxis === 'y' ? 'height' : 'width';
    var offset = popperOffsets[mainAxis];
    var min = popperOffsets[mainAxis] + overflow[mainSide];
    var max = popperOffsets[mainAxis] - overflow[altSide];
    var additive = tether ? -popperRect[len] / 2 : 0;
    var minLen = variation === start ? referenceRect[len] : popperRect[len];
    var maxLen = variation === start ? -popperRect[len] : -referenceRect[len]; // We need to include the arrow in the calculation so the arrow doesn't go
    // outside the reference bounds

    var arrowElement = state.elements.arrow;
    var arrowRect = tether && arrowElement ? getLayoutRect(arrowElement) : {
      width: 0,
      height: 0
    };
    var arrowPaddingObject = state.modifiersData['arrow#persistent'] ? state.modifiersData['arrow#persistent'].padding : getFreshSideObject();
    var arrowPaddingMin = arrowPaddingObject[mainSide];
    var arrowPaddingMax = arrowPaddingObject[altSide]; // If the reference length is smaller than the arrow length, we don't want
    // to include its full size in the calculation. If the reference is small
    // and near the edge of a boundary, the popper can overflow even if the
    // reference is not overflowing as well (e.g. virtual elements with no
    // width or height)

    var arrowLen = within(0, referenceRect[len], arrowRect[len]);
    var minOffset = isBasePlacement ? referenceRect[len] / 2 - additive - arrowLen - arrowPaddingMin - tetherOffsetValue : minLen - arrowLen - arrowPaddingMin - tetherOffsetValue;
    var maxOffset = isBasePlacement ? -referenceRect[len] / 2 + additive + arrowLen + arrowPaddingMax + tetherOffsetValue : maxLen + arrowLen + arrowPaddingMax + tetherOffsetValue;
    var arrowOffsetParent = state.elements.arrow && getOffsetParent(state.elements.arrow);
    var clientOffset = arrowOffsetParent ? mainAxis === 'y' ? arrowOffsetParent.clientTop || 0 : arrowOffsetParent.clientLeft || 0 : 0;
    var offsetModifierValue = state.modifiersData.offset ? state.modifiersData.offset[state.placement][mainAxis] : 0;
    var tetherMin = popperOffsets[mainAxis] + minOffset - offsetModifierValue - clientOffset;
    var tetherMax = popperOffsets[mainAxis] + maxOffset - offsetModifierValue;
    var preventedOffset = within(tether ? Math.min(min, tetherMin) : min, offset, tether ? Math.max(max, tetherMax) : max);
    popperOffsets[mainAxis] = preventedOffset;
    data[mainAxis] = preventedOffset - offset;
  }

  if (checkAltAxis) {
    var _mainSide = mainAxis === 'x' ? top : left;

    var _altSide = mainAxis === 'x' ? bottom : right;

    var _offset = popperOffsets[altAxis];

    var _min = _offset + overflow[_mainSide];

    var _max = _offset - overflow[_altSide];

    var _preventedOffset = within(_min, _offset, _max);

    state.modifiersData.popperOffsets[altAxis] = _preventedOffset;
    data[altAxis] = _preventedOffset - _offset;
  }

  state.modifiersData[name] = data;
}

var preventOverflow$1 = {
  name: 'preventOverflow',
  enabled: true,
  phase: 'main',
  fn: preventOverflow,
  requiresIfExists: ['offset']
};

function arrow(_ref) {
  var _state$modifiersData$;

  var state = _ref.state,
      name = _ref.name;
  var arrowElement = state.elements.arrow;
  var popperOffsets = state.modifiersData.popperOffsets;
  var basePlacement = getBasePlacement(state.placement);
  var axis = getMainAxisFromPlacement(basePlacement);
  var isVertical = [left, right].indexOf(basePlacement) >= 0;
  var len = isVertical ? 'height' : 'width';

  if (!arrowElement) {
    return;
  }

  var paddingObject = state.modifiersData[name + "#persistent"].padding;
  var arrowRect = getLayoutRect(arrowElement);
  var minProp = axis === 'y' ? top : left;
  var maxProp = axis === 'y' ? bottom : right;
  var endDiff = state.rects.reference[len] + state.rects.reference[axis] - popperOffsets[axis] - state.rects.popper[len];
  var startDiff = popperOffsets[axis] - state.rects.reference[axis];
  var arrowOffsetParent = state.elements.arrow && getOffsetParent(state.elements.arrow);
  var clientOffset = arrowOffsetParent ? axis === 'y' ? arrowOffsetParent.clientLeft || 0 : arrowOffsetParent.clientTop || 0 : 0;
  var centerToReference = endDiff / 2 - startDiff / 2 - clientOffset; // Make sure the arrow doesn't overflow the popper if the center point is
  // outside of the popper bounds

  var center = within(paddingObject[minProp], state.rects.popper[len] / 2 - arrowRect[len] / 2 + centerToReference, state.rects.popper[len] - arrowRect[len] - paddingObject[maxProp]); // Prevents breaking syntax highlighting...

  var axisProp = axis;
  state.modifiersData[name] = (_state$modifiersData$ = {}, _state$modifiersData$[axisProp] = center, _state$modifiersData$);
}

function effect$2(_ref2) {
  var state = _ref2.state,
      options = _ref2.options,
      name = _ref2.name;
  var _options$element = options.element,
      arrowElement = _options$element === void 0 ? '[data-popper-arrow]' : _options$element,
      _options$padding = options.padding,
      padding = _options$padding === void 0 ? 0 : _options$padding; // CSS selector

  if (typeof arrowElement === 'string') {
    arrowElement = state.elements.popper.querySelector(arrowElement);

    if (!arrowElement) {
      return;
    }
  }

  if (!contains(state.elements.popper, arrowElement)) {

    return;
  }

  state.elements.arrow = arrowElement;
  state.modifiersData[name + "#persistent"] = {
    padding: mergePaddingObject(typeof padding !== 'number' ? padding : expandToHashMap(padding, basePlacements))
  };
}

var arrow$1 = {
  name: 'arrow',
  enabled: true,
  phase: 'main',
  fn: arrow,
  effect: effect$2,
  requires: ['popperOffsets'],
  requiresIfExists: ['preventOverflow']
};

function distanceAndSkiddingToXY(placement, rects, offset) {
  var basePlacement = getBasePlacement(placement);
  var invertDistance = [left, top].indexOf(basePlacement) >= 0 ? -1 : 1;

  var _ref = typeof offset === 'function' ? offset(Object.assign({}, rects, {
    placement: placement
  })) : offset,
      skidding = _ref[0],
      distance = _ref[1];

  skidding = skidding || 0;
  distance = (distance || 0) * invertDistance;
  return [left, right].indexOf(basePlacement) >= 0 ? {
    x: distance,
    y: skidding
  } : {
    x: skidding,
    y: distance
  };
}

function offset(_ref2) {
  var state = _ref2.state,
      options = _ref2.options,
      name = _ref2.name;
  var _options$offset = options.offset,
      offset = _options$offset === void 0 ? [0, 0] : _options$offset;
  var data = placements.reduce(function (acc, placement) {
    acc[placement] = distanceAndSkiddingToXY(placement, state.rects, offset);
    return acc;
  }, {});
  var _data$state$placement = data[state.placement],
      x = _data$state$placement.x,
      y = _data$state$placement.y;
  state.modifiersData.popperOffsets.x += x;
  state.modifiersData.popperOffsets.y += y;
  state.modifiersData[name] = data;
}

var offset$1 = {
  name: 'offset',
  enabled: true,
  phase: 'main',
  requires: ['popperOffsets'],
  fn: offset
};

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
// Spectrum elements that have arrows (tips) use a transform to rotate them.
// Popper overwrites those values, so we have to put them back
function computeArrowRotateStylesFn(ref) {
    if (!ref.state.styles || !ref.state.styles.arrow)
        return;
    let rotation;
    switch (ref.state.placement) {
        case 'bottom':
        case 'bottom-start':
        case 'bottom-end':
            rotation = 180;
            break;
        case 'top':
        case 'top-start':
        case 'top-end':
            return;
        case 'left':
        case 'left-start':
        case 'left-end':
            rotation = 270;
            break;
        case 'right':
        case 'right-start':
        case 'right-end':
            rotation = 90;
            break;
        default:
            return;
    }
    ref.state.styles.arrow.transform += ` rotate(${rotation}deg)`;
    // Manage Spectrum CSS usage of negative left margin for centering.
    ref.state.styles.arrow.marginLeft = '0';
    return;
}
const computeArrowRotateStyles = {
    name: 'computeArrowRotateStyles',
    enabled: true,
    phase: 'beforeWrite',
    requiresIfExists: ['arrow'],
    fn: computeArrowRotateStylesFn,
    data: {},
};

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const createPopper = popperGenerator({
    defaultModifiers: [
        ...defaultModifiers,
        flip$1,
        preventOverflow$1,
        arrow$1,
        offset$1,
        computeArrowRotateStyles,
    ],
});

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const styles$n = css `
@keyframes spOverlayFadeIn{0%{opacity:0;transform:var(--sp-overlay-from)}to{opacity:1;transform:translate(0)}}@keyframes spOverlayFadeOut{0%{opacity:1;transform:translate(0)}to{opacity:0;transform:var(--sp-overlay-from)}}:host{z-index:1000;position:absolute}#contents,:host{display:inline-block;pointer-events:none}#contents{animation-duration:var(--spectrum-global-animation-duration-200);animation-timing-function:var(--spectrum-global-animation-ease-out);opacity:1;visibility:visible}:host([data-popper-placement*=top]) #contents{--sp-overlay-from:translateY(var(--spectrum-global-dimension-size-75))}:host([data-popper-placement*=right]) #contents{--sp-overlay-from:translateX(calc(-1*var(--spectrum-global-dimension-size-75)))}:host([data-popper-placement*=bottom]) #contents{--sp-overlay-from:translateY(calc(-1*var(--spectrum-global-dimension-size-75)))}:host([data-popper-placement*=left]) #contents{--sp-overlay-from:translateX(var(--spectrum-global-dimension-size-75))}::slotted(*){position:relative}:host([animating]) ::slotted(*){pointer-events:none}
`;

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const stateMachine = {
    initial: 'idle',
    states: {
        idle: {
            on: {
                active: 'active',
            },
        },
        active: {
            on: {
                visible: 'visible',
                hiding: 'hiding',
                idle: 'idle',
            },
        },
        visible: {
            on: {
                hiding: 'hiding',
                idle: 'idle',
            },
        },
        hiding: {
            on: {
                dispose: 'dispose',
            },
        },
        dispose: {
            on: {
                disposed: 'disposed',
            },
        },
        disposed: {
            on: {},
        },
    },
};
const stateTransition = (state, event) => {
    if (!state)
        return stateMachine.initial;
    /* istanbul ignore if */
    if (!event)
        return state;
    return stateMachine.states[state].on[event] || state;
};
class ActiveOverlay extends LitElement {
    constructor() {
        super(...arguments);
        this.originalSlot = null;
        this._state = stateTransition();
        this.animating = false;
        this.offset = 6;
        this.interaction = 'hover';
        this.positionAnimationFrame = 0;
    }
    get state() {
        return this._state;
    }
    set state(state) {
        const nextState = stateTransition(this.state, state);
        if (nextState === this.state) {
            return;
        }
        this._state = nextState;
        if (this.state === 'active' ||
            this.state === 'visible' ||
            this.state === 'hiding') {
            this.setAttribute('state', this.state);
        }
        else {
            this.removeAttribute('state');
        }
    }
    get hasTheme() {
        return !!this.color || !!this.scale;
    }
    static get styles() {
        return [styles$n];
    }
    firstUpdated(changedProperties) {
        super.firstUpdated(changedProperties);
        /* istanbul ignore if */
        if (!this.overlayContent)
            return;
        this.stealOverlayContent(this.overlayContent);
        /* istanbul ignore if */
        if (!this.overlayContent || !this.trigger || !this.shadowRoot)
            return;
        /* istanbul ignore else */
        if (this.placement && this.placement !== 'none') {
            this.popper = createPopper(this.trigger, this, {
                placement: this.placement,
                modifiers: [
                    {
                        name: 'arrow',
                        options: {
                            element: this.overlayContentTip,
                        },
                    },
                    {
                        name: 'offset',
                        options: {
                            offset: [0, this.offset],
                        },
                    },
                ],
            });
        }
        this.state = 'active';
        document.addEventListener('sp-update-overlays', () => {
            this.updateOverlayPosition();
            this.state = 'visible';
        });
        this.updateOverlayPosition().then(() => this.applyContentAnimation('spOverlayFadeIn'));
    }
    updateOverlayPopperPlacement() {
        /* istanbul ignore if */
        if (!this.overlayContent)
            return;
        if (this.dataPopperPlacement) {
            // Copy this attribute to the actual overlay node so that it can use
            // the attribute for styling shadow DOM elements based on the side
            // that popper has chosen for it
            this.overlayContent.setAttribute('placement', this.dataPopperPlacement);
        }
        else if (this.originalPlacement) {
            this.overlayContent.setAttribute('placement', this.originalPlacement);
        }
        else {
            this.overlayContent.removeAttribute('placement');
        }
    }
    updated(changedProperties) {
        if (changedProperties.has('dataPopperPlacement')) {
            this.updateOverlayPopperPlacement();
        }
    }
    open(openDetail) {
        this.extractDetail(openDetail);
    }
    extractDetail(detail) {
        this.overlayContent = detail.content;
        this.overlayContentTip = detail.contentTip;
        this.trigger = detail.trigger;
        this.placement = detail.placement;
        this.offset = detail.offset;
        this.interaction = detail.interaction;
        this.color = detail.theme.color;
        this.scale = detail.theme.scale;
    }
    dispose() {
        /* istanbul ignore if */
        if (this.state !== 'dispose')
            return;
        /* istanbul ignore if */
        if (this.timeout) {
            clearTimeout(this.timeout);
            delete this.timeout;
        }
        /* istanbul ignore else */
        if (this.popper) {
            this.popper.destroy();
            this.popper = undefined;
        }
        this.returnOverlayContent();
        this.state = 'disposed';
    }
    stealOverlayContent(element) {
        /* istanbul ignore if */
        if (this.placeholder || !element)
            return;
        /* istanbul ignore else */
        if (!this.placeholder) {
            this.placeholder = document.createComment('placeholder for ' + element.nodeName);
        }
        const parentElement = element.parentElement || element.getRootNode();
        /* istanbul ignore else */
        if (parentElement) {
            parentElement.replaceChild(this.placeholder, element);
        }
        this.overlayContent = element;
        this.originalSlot = this.overlayContent.getAttribute('slot');
        this.overlayContent.setAttribute('slot', 'overlay');
        this.appendChild(this.overlayContent);
        this.originalPlacement = this.overlayContent.getAttribute('placement');
    }
    returnOverlayContent() {
        /* istanbul ignore if */
        if (!this.overlayContent)
            return;
        if (this.originalSlot) {
            this.overlayContent.setAttribute('slot', this.originalSlot);
            delete this.originalSlot;
        }
        else {
            this.overlayContent.removeAttribute('slot');
        }
        /* istanbul ignore else */
        if (this.placeholder) {
            const parentElement = this.placeholder.parentElement ||
                this.placeholder.getRootNode();
            /* istanbul ignore else */
            if (parentElement) {
                parentElement.replaceChild(this.overlayContent, this.placeholder);
                this.overlayContent.dispatchEvent(new Event('sp-overlay-closed'));
            }
        }
        if (this.originalPlacement) {
            this.overlayContent.setAttribute('placement', this.originalPlacement);
            delete this.originalPlacement;
        }
        delete this.placeholder;
    }
    async updateOverlayPosition() {
        if (this.popper) {
            await this.popper.update();
        }
    }
    async hide(animated = true) {
        this.state = 'hiding';
        if (animated) {
            await this.applyContentAnimation('spOverlayFadeOut');
        }
        this.state = 'dispose';
    }
    schedulePositionUpdate() {
        // Edge needs a little time to update the DOM before computing the layout
        cancelAnimationFrame(this.positionAnimationFrame);
        this.positionAnimationFrame = requestAnimationFrame(() => this.updateOverlayPosition());
    }
    onSlotChange() {
        this.schedulePositionUpdate();
    }
    connectedCallback() {
        super.connectedCallback();
        this.schedulePositionUpdate();
    }
    applyContentAnimation(animation) {
        return new Promise((resolve, reject) => {
            /* istanbul ignore if */
            if (!this.shadowRoot) {
                reject();
                return;
            }
            const contents = this.shadowRoot.querySelector('#contents');
            const doneHandler = (event) => {
                if (animation !== event.animationName)
                    return;
                contents.removeEventListener('animationend', doneHandler);
                contents.removeEventListener('animationcancel', doneHandler);
                this.animating = false;
                resolve(event.type === 'animationcancel');
            };
            contents.addEventListener('animationend', doneHandler);
            contents.addEventListener('animationcancel', doneHandler);
            contents.style.animationName = animation;
            this.animating = true;
        });
    }
    renderTheme(content) {
        const color = this.color;
        const scale = this.scale;
        return html `
            <sp-theme .color=${color} .scale=${scale}>
                ${content}
            </sp-theme>
        `;
    }
    render() {
        const content = html `
            <div id="contents">
                <slot @slotchange=${this.onSlotChange} name="overlay"></slot>
            </div>
        `;
        return this.hasTheme ? this.renderTheme(content) : content;
    }
    static create(details) {
        const overlay = new ActiveOverlay();
        /* istanbul ignore else */
        if (details.content) {
            overlay.open(details);
        }
        return overlay;
    }
}
__decorate([
    property()
], ActiveOverlay.prototype, "_state", void 0);
__decorate([
    property({ reflect: true, type: Boolean })
], ActiveOverlay.prototype, "animating", void 0);
__decorate([
    property({ reflect: true })
], ActiveOverlay.prototype, "placement", void 0);
__decorate([
    property({ attribute: false })
], ActiveOverlay.prototype, "color", void 0);
__decorate([
    property({ attribute: false })
], ActiveOverlay.prototype, "scale", void 0);
__decorate([
    property({ attribute: 'data-popper-placement' })
], ActiveOverlay.prototype, "dataPopperPlacement", void 0);

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const DEFAULT_WARMUP = 1000;
const DEFAULT_COOLDOWN = 1000;
/**
 * A timer to help with implementation of warnup/cooldown behavior as described here:
 * https://spectrum.adobe.com/page/tooltip/#Immediate-or-delayed-appearance
 */
class OverlayTimer {
    constructor(options = {}) {
        this.warmUpDelay = DEFAULT_WARMUP;
        this.coolDownDelay = DEFAULT_COOLDOWN;
        this.isWarm = false;
        this.cooldownTimeout = 0;
        this.timeout = 0;
        Object.assign(this, options);
    }
    async openTimer(component) {
        this.cancelCooldownTimer();
        if (!this.component || !component.isSameNode(this.component)) {
            if (this.component) {
                this.close(this.component);
                this.cancelCooldownTimer();
            }
            this.component = component;
            if (this.isWarm) {
                return false;
            }
            this.promise = new Promise((resolve) => {
                this.resolve = resolve;
                this.timeout = window.setTimeout(() => {
                    if (this.resolve) {
                        this.resolve(false);
                        this.isWarm = true;
                    }
                }, this.warmUpDelay);
            });
            return this.promise;
        }
        else if (this.promise) {
            return this.promise;
        }
        else {
            // This should never happen
            throw new Error('Inconsistent state');
        }
    }
    close(component) {
        if (this.component && this.component.isSameNode(component)) {
            this.resetCooldownTimer();
            if (this.timeout > 0) {
                clearTimeout(this.timeout);
                this.timeout = 0;
            }
            if (this.resolve) {
                this.resolve(true);
                delete this.resolve;
            }
            delete this.promise;
            delete this.component;
        }
    }
    resetCooldownTimer() {
        if (this.isWarm) {
            if (this.cooldownTimeout) {
                window.clearTimeout(this.cooldownTimeout);
            }
            this.cooldownTimeout = window.setTimeout(() => {
                this.isWarm = false;
                delete this.cooldownTimeout;
            }, this.coolDownDelay);
        }
    }
    cancelCooldownTimer() {
        if (this.cooldownTimeout) {
            window.clearTimeout(this.cooldownTimeout);
        }
        delete this.cooldownTimeout;
    }
}

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
function isLeftClick(event) {
    return event.button === 0;
}
function hasModifier(event) {
    return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}
class OverlayStack {
    constructor() {
        this.overlays = [];
        this.preventMouseRootClose = false;
        this.root = document.body;
        this.handlingResize = false;
        this.overlayTimer = new OverlayTimer();
        this.handleMouseCapture = (event) => {
            const topOverlay = this.topOverlay;
            if (!event.target ||
                !topOverlay ||
                !topOverlay.overlayContent ||
                hasModifier(event) ||
                !isLeftClick(event)) {
                this.preventMouseRootClose = true;
                return;
            }
            if (event.target instanceof Node) {
                const path = event.composedPath();
                if (path.indexOf(topOverlay.overlayContent) >= 0) {
                    this.preventMouseRootClose = true;
                    return;
                }
                this.preventMouseRootClose = false;
            }
        };
        this.handleMouse = () => {
            if (!this.preventMouseRootClose) {
                this.closeTopOverlay();
            }
        };
        this.handleKeyUp = (event) => {
            if (event.key === 'Escape') {
                this.closeTopOverlay();
            }
        };
        this.handleResize = () => {
            if (this.handlingResize)
                return;
            this.handlingResize = true;
            requestAnimationFrame(async () => {
                const promises = this.overlays.map((overlay) => overlay.updateOverlayPosition());
                await Promise.all(promises);
                this.handlingResize = false;
            });
        };
        this.addEventListeners();
    }
    get document() {
        return this.root.ownerDocument || document;
    }
    get topOverlay() {
        return this.overlays.slice(-1)[0];
    }
    findOverlayForContent(overlayContent) {
        for (const item of this.overlays) {
            if (overlayContent.isSameNode(item.overlayContent)) {
                return item;
            }
        }
    }
    addEventListeners() {
        this.document.addEventListener('click', this.handleMouseCapture, true);
        this.document.addEventListener('click', this.handleMouse);
        this.document.addEventListener('keyup', this.handleKeyUp);
        window.addEventListener('resize', this.handleResize);
    }
    isClickOverlayActiveForTrigger(trigger) {
        return this.overlays.some((item) => trigger.isSameNode(item.trigger) &&
            item.interaction === 'click');
    }
    async openOverlay(details) {
        if (this.findOverlayForContent(details.content)) {
            return false;
        }
        if (details.delayed) {
            const promise = this.overlayTimer.openTimer(details.content);
            const cancelled = await promise;
            if (cancelled) {
                return promise;
            }
        }
        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                if (details.interaction === 'click') {
                    this.closeAllHoverOverlays();
                }
                else if (details.interaction === 'hover' &&
                    this.isClickOverlayActiveForTrigger(details.trigger)) {
                    // Don't show a hover popover if the click popover is already active
                    resolve(true);
                    return;
                }
                const activeOverlay = ActiveOverlay.create(details);
                this.overlays.push(activeOverlay);
                document.body.appendChild(activeOverlay);
                resolve(false);
            });
        });
    }
    closeOverlay(content) {
        this.overlayTimer.close(content);
        requestAnimationFrame(() => {
            const overlay = this.findOverlayForContent(content);
            this.hideAndCloseOverlay(overlay);
        });
    }
    closeAllHoverOverlays() {
        for (const overlay of this.overlays) {
            if (overlay.interaction === 'hover') {
                this.hideAndCloseOverlay(overlay, false);
            }
        }
    }
    async hideAndCloseOverlay(overlay, animated = true) {
        if (overlay) {
            await overlay.hide(animated);
            if (overlay.state != 'dispose')
                return;
            overlay.remove();
            overlay.dispose();
            const index = this.overlays.indexOf(overlay);
            /* istanbul ignore else */
            if (index >= 0) {
                this.overlays.splice(index, 1);
            }
        }
    }
    closeTopOverlay() {
        return this.hideAndCloseOverlay(this.topOverlay);
    }
}

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
/**
 * This class allows access to the overlay system which allows a client to
 * position an element in the overlay positioned relative to another node.
 */
class Overlay {
    /**
     *
     * @param owner the parent element we will use to position the overlay element
     * @param interaction the type of interaction that caused this overlay to be shown
     * @param overlayElement the item to display as an overlay
     */
    constructor(owner, interaction, overlayElement) {
        this.isOpen = false;
        this.owner = owner;
        this.overlayElement = overlayElement;
        this.interaction = interaction;
    }
    /**
     * Open an overlay
     *
     * @param owner the parent element we will use to position the overlay element
     * @param interaction the type of interaction that caused this overlay to be shown
     * @param overlayElement the item to display as an overlay
     * @param options display parameters
     * @param options.delayed if true delay opening of the overlay based on the global warmup/cooldown timer
     * @param options.offset distance to offset the overlay
     * @param options.placement side on which to position the overlay
     * @returns an Overlay object which can be used to close the overlay
     */
    static open(owner, interaction, overlayElement, options) {
        const overlay = new Overlay(owner, interaction, overlayElement);
        overlay.open(options);
        return () => overlay.close();
    }
    static update() {
        const overlayUpdateEvent = new CustomEvent('sp-update-overlays', {
            bubbles: true,
            composed: true,
            cancelable: true,
        });
        document.dispatchEvent(overlayUpdateEvent);
    }
    /**
     * Open an overlay
     *
     * @param options display parameters
     * @param options.delayed delay before opening the overlay
     * @param options.offset distance to offset the overlay
     * @param options.placement side on which to position the overlay
     * @returns a Promise that resolves to true if this operation was cancelled
     */
    async open({ delayed, offset = 0, placement = 'top', }) {
        /* istanbul ignore if */
        if (this.isOpen)
            return true;
        /* istanbul ignore else */
        if (delayed === undefined) {
            delayed = this.overlayElement.hasAttribute('delayed');
        }
        const queryThemeDetail = {
            color: undefined,
            scale: undefined,
        };
        const queryThemeEvent = new CustomEvent('sp-query-theme', {
            bubbles: true,
            composed: true,
            detail: queryThemeDetail,
            cancelable: true,
        });
        this.owner.dispatchEvent(queryThemeEvent);
        const overlayDetailQuery = {};
        const queryOverlayDetailEvent = new CustomEvent('sp-overlay-query', {
            bubbles: true,
            composed: true,
            detail: overlayDetailQuery,
            cancelable: true,
        });
        this.overlayElement.dispatchEvent(queryOverlayDetailEvent);
        Overlay.overlayStack.openOverlay(Object.assign({ content: this.overlayElement, contentTip: overlayDetailQuery.overlayContentTipElement, delayed, offset: offset, placement: placement, trigger: this.owner, interaction: this.interaction, theme: queryThemeDetail }, overlayDetailQuery));
        this.isOpen = true;
        return true;
    }
    /**
     * Close the overlay if it is open
     */
    close() {
        Overlay.overlayStack.closeOverlay(this.overlayElement);
    }
}
Overlay.overlayStack = new OverlayStack();

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
/**
 * A overlay trigger component for displaying overlays relative to other content.
 * @element overlay-trigger
 *
 * @slot hover-content - The content that will be displayed on hover
 * @slot click-content - The content that will be displayed on click
 */
class OverlayTrigger extends LitElement {
    constructor() {
        super(...arguments);
        this.placement = 'bottom';
        this.offset = 6;
        this.disabled = false;
    }
    static get styles() {
        return [styles$m];
    }
    render() {
        return html `
            <div
                id="trigger"
                @click=${this.onTriggerClick}
                @mouseenter=${this.onTriggerMouseEnter}
                @mouseleave=${this.onTriggerMouseLeave}
            >
                <slot
                    @slotchange=${this.onTargetSlotChange}
                    name="trigger"
                ></slot>
            </div>
            <div id="overlay-content">
                <slot
                    @slotchange=${this.onClickSlotChange}
                    name="click-content"
                ></slot>
                <slot
                    @slotchange=${this.onHoverSlotChange}
                    name="hover-content"
                ></slot>
            </div>
        `;
    }
    onTriggerClick() {
        /* istanbul ignore else */
        if (this.targetContent && this.clickContent) {
            this.closeClickOverlay = Overlay.open(this.targetContent, 'click', this.clickContent, {
                offset: this.offset,
                placement: this.placement,
            });
        }
    }
    onTriggerMouseEnter() {
        /* istanbul ignore else */
        if (this.targetContent && this.hoverContent) {
            this.closeHoverOverlay = Overlay.open(this.targetContent, 'hover', this.hoverContent, {
                offset: this.offset,
                placement: this.placement,
            });
        }
    }
    onTriggerMouseLeave() {
        /* istanbul ignore else */
        if (this.closeHoverOverlay) {
            this.closeHoverOverlay();
            delete this.closeHoverOverlay;
        }
    }
    onClickSlotChange(event) {
        const content = this.extractSlotContentFromEvent(event);
        this.clickContent = content;
    }
    onHoverSlotChange(event) {
        const content = this.extractSlotContentFromEvent(event);
        this.hoverContent = content;
    }
    onTargetSlotChange(event) {
        const content = this.extractSlotContentFromEvent(event);
        this.targetContent = content;
    }
    extractSlotContentFromEvent(event) {
        /* istanbul ignore if */
        if (!event.target) {
            return;
        }
        const slot = event.target;
        const nodes = slot.assignedNodes();
        return nodes.find((node) => node instanceof HTMLElement);
    }
    disconnectedCallback() {
        /* istanbul ignore else */
        if (this.closeClickOverlay) {
            this.closeClickOverlay();
            delete this.closeClickOverlay;
        }
        if (this.closeHoverOverlay) {
            this.closeHoverOverlay();
            delete this.closeHoverOverlay;
        }
        super.disconnectedCallback();
    }
}
__decorate([
    property({ reflect: true })
], OverlayTrigger.prototype, "placement", void 0);
__decorate([
    property({ type: Number, reflect: true })
], OverlayTrigger.prototype, "offset", void 0);
__decorate([
    property({ type: Boolean, reflect: true })
], OverlayTrigger.prototype, "disabled", void 0);

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
/* istanbul ignore else */
if (!customElements.get('overlay-trigger')) {
    customElements.define('overlay-trigger', OverlayTrigger);
}
/* istanbul ignore else */
if (!customElements.get('active-overlay')) {
    customElements.define('active-overlay', ActiveOverlay);
}

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
/**
 * @slot label - The placeholder content for the dropdown
 * @slot {"sp-menu"} - The menu of options that will display when the dropdown is open
 */
class DropdownBase extends Focusable {
    constructor() {
        super();
        this.disabled = false;
        this.invalid = false;
        this.open = false;
        this.placement = 'bottom-start';
        this.quiet = false;
        this.value = '';
        this.selectedItemText = '';
        this.listRole = 'listbox';
        this.itemRole = 'option';
        this.onKeydown = this.onKeydown.bind(this);
        this.addEventListener('sp-menu-item-query-role', (event) => {
            event.stopPropagation();
            event.detail.role = this.itemRole;
        });
        this.addEventListener('sp-menu-query-role', (event) => {
            event.stopPropagation();
            event.detail.role = this.listRole;
        });
    }
    static get styles() {
        return [
            ...super.styles,
            styles$2,
            styles$f,
            styles$b,
            styles$h,
        ];
    }
    get focusElement() {
        /* istanbul ignore if */
        if (typeof this.button === 'undefined') {
            return this;
        }
        if (this.open && this.optionsMenu) {
            return this.optionsMenu;
        }
        return this.button;
    }
    click() {
        this.focusElement.click();
    }
    onButtonBlur() {
        /* istanbul ignore if */
        if (typeof this.button === 'undefined') {
            return;
        }
        this.button.removeEventListener('keydown', this.onKeydown);
    }
    onButtonClick() {
        this.toggle();
    }
    onButtonFocus() {
        /* istanbul ignore if */
        if (typeof this.button === 'undefined') {
            return;
        }
        this.button.addEventListener('keydown', this.onKeydown);
    }
    onClick(event) {
        const target = event.target;
        /* istanbul ignore if */
        if (!target || target.disabled) {
            if (target) {
                this.focus();
            }
            return;
        }
        this.setValueFromItem(target);
    }
    onKeydown(event) {
        if (event.code !== 'ArrowDown') {
            return;
        }
        /* istanbul ignore if */
        if (!this.optionsMenu) {
            return;
        }
        this.open = true;
    }
    setValueFromItem(item) {
        const oldSelectedItemText = this.selectedItemText;
        const oldValue = this.value;
        this.selectedItemText = item.itemText;
        this.value = item.value;
        const applyDefault = this.dispatchEvent(new Event('change', {
            cancelable: true,
        }));
        if (!applyDefault) {
            this.selectedItemText = oldSelectedItemText;
            this.value = oldValue;
            return;
        }
        const parentElement = item.parentElement;
        const selectedItem = parentElement.querySelector('[selected]');
        /* istanbul ignore if */
        if (selectedItem) {
            selectedItem.selected = false;
        }
        item.selected = true;
        this.open = false;
        this.focus();
    }
    toggle() {
        this.open = !this.open;
    }
    close() {
        this.open = false;
    }
    onOverlayClosed() {
        this.close();
        /* istanbul ignore else */
        if (this.optionsMenu && this.placeholder) {
            const parentElement = this.placeholder.parentElement ||
                this.placeholder.getRootNode();
            /* istanbul ignore else */
            if (parentElement) {
                parentElement.replaceChild(this.optionsMenu, this.placeholder);
            }
        }
        delete this.placeholder;
    }
    openMenu() {
        /* istanbul ignore if */
        if (!this.popover ||
            !this.button ||
            !this.optionsMenu ||
            this.optionsMenu.children.length === 0)
            return;
        this.placeholder = document.createComment('placeholder for optionsMenu');
        const parentElement = this.optionsMenu.parentElement || this.optionsMenu.getRootNode();
        /* istanbul ignore else */
        if (parentElement) {
            parentElement.replaceChild(this.placeholder, this.optionsMenu);
        }
        this.popover.append(this.optionsMenu);
        // only use `this.offsetWidth` when Standard variant
        const menuWidth = !this.quiet && `${this.offsetWidth}px`;
        if (menuWidth) {
            this.popover.style.setProperty('width', menuWidth);
        }
        this.closeOverlay = Overlay.open(this.button, 'click', this.popover, {
            placement: this.placement,
        });
    }
    closeMenu() {
        if (this.closeOverlay) {
            this.closeOverlay();
            delete this.closeOverlay;
        }
    }
    get buttonContent() {
        return [
            html `
                <div
                    id="label"
                    class=${ifDefined(this.value ? undefined : 'placeholder')}
                >
                    ${this.value
                ? this.selectedItemText
                : html `
                              <slot name="label">${this.label}</slot>
                          `}
                </div>
                ${this.invalid
                ? html `
                          <sp-icon
                              class="icon alert-small"
                              name="ui:AlertSmall"
                              size="s"
                          ></sp-icon>
                      `
                : nothing}
                <sp-icon
                    class="icon dropdown chevron-down-medium"
                    name="ui:ChevronDownMedium"
                    size="s"
                ></sp-icon>
            `,
        ];
    }
    render() {
        return html `
            <sp-icons-medium></sp-icons-medium>
            <button
                aria-haspopup="true"
                aria-label=${ifDefined(this.label || undefined)}
                id="button"
                @blur=${this.onButtonBlur}
                @click=${this.onButtonClick}
                @focus=${this.onButtonFocus}
                ?disabled=${this.disabled}
            >
                ${this.buttonContent}
            </button>
            <sp-popover
                open
                id="popover"
                @click=${this.onClick}
                @sp-overlay-closed=${this.onOverlayClosed}
            ></sp-popover>
        `;
    }
    firstUpdated(changedProperties) {
        super.firstUpdated(changedProperties);
        this.optionsMenu = this.querySelector('sp-menu');
    }
    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('value') && this.optionsMenu) {
            const items = [
                ...this.optionsMenu.querySelectorAll(`[role=${this.optionsMenu.childRole}]`),
            ];
            let selectedItem;
            items.map((item) => {
                if (this.value === item.value && !item.disabled) {
                    selectedItem = item;
                }
                else {
                    item.selected = false;
                }
            });
            if (selectedItem) {
                selectedItem.selected = true;
                this.selectedItemText = selectedItem.itemText;
            }
            else {
                this.value = '';
                this.selectedItemText = '';
            }
            this.optionsMenu.updateSelectedItemIndex();
        }
        if (changedProperties.has('disabled') && this.disabled) {
            this.open = false;
        }
        if (changedProperties.has('open')) {
            if (this.open) {
                this.openMenu();
                requestAnimationFrame(() => {
                    /* istanbul ignore if */
                    if (!this.optionsMenu) {
                        return;
                    }
                    /* Trick :focus-visible polyfill into thinking keyboard based focus */
                    this.dispatchEvent(new KeyboardEvent('keydown', {
                        code: 'Tab',
                    }));
                    this.optionsMenu.focus();
                });
            }
            else {
                this.closeMenu();
            }
        }
    }
    disconnectedCallback() {
        this.open = false;
        super.disconnectedCallback();
    }
}
__decorate([
    query('#button')
], DropdownBase.prototype, "button", void 0);
__decorate([
    property({ type: Boolean, reflect: true })
], DropdownBase.prototype, "disabled", void 0);
__decorate([
    property({ type: Boolean, reflect: true })
], DropdownBase.prototype, "invalid", void 0);
__decorate([
    property()
], DropdownBase.prototype, "label", void 0);
__decorate([
    property({ type: Boolean, reflect: true })
], DropdownBase.prototype, "open", void 0);
__decorate([
    property()
], DropdownBase.prototype, "placement", void 0);
__decorate([
    property({ type: Boolean, reflect: true })
], DropdownBase.prototype, "quiet", void 0);
__decorate([
    property({ type: String })
], DropdownBase.prototype, "value", void 0);
__decorate([
    property({ type: String })
], DropdownBase.prototype, "selectedItemText", void 0);
__decorate([
    query('sp-popover')
], DropdownBase.prototype, "popover", void 0);
class Dropdown extends DropdownBase {
    static get styles() {
        return [...super.styles, styles$g];
    }
}

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
/* istanbul ignore else */
if (!customElements.get('sp-dropdown')) {
    customElements.define('sp-dropdown', Dropdown);
}
//# sourceMappingURL=index.js.map
