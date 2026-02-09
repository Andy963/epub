import { findChildren, RangeObject } from "../utils/core";
import { isIgnored, shouldUseIgnore } from "./ignore";
import type { IgnoreClass } from "./ignore";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const DOCUMENT_NODE = 9;

export function step(node) {
	var nodeType = (node.nodeType === TEXT_NODE) ? "text" : "element";

	return {
		"id" : node.id,
		"tagName" : node.tagName,
		"type" : nodeType,
		"index" : this.position(node)
	};
}

export function filteredStep(node, ignoreClass: IgnoreClass) {
	var filteredNode = this.filter(node, ignoreClass);
	var nodeType;

	// Node filtered, so ignore
	if (!filteredNode) {
		return;
	}

	// Otherwise add the filter node in
	nodeType = (filteredNode.nodeType === TEXT_NODE) ? "text" : "element";

	return {
		"id" : filteredNode.id,
		"tagName" : filteredNode.tagName,
		"type" : nodeType,
		"index" : this.filteredPosition(filteredNode, ignoreClass)
	};
}

export function pathTo(node, offset, ignoreClass?: IgnoreClass) {
	var segment = {
		steps: [],
		terminal: {
			offset: null,
			assertion: null
		}
	};
	var currentNode = node;
	var step;

	while(currentNode && currentNode.parentNode &&
				currentNode.parentNode.nodeType != DOCUMENT_NODE) {

		if (ignoreClass) {
			step = this.filteredStep(currentNode, ignoreClass);
		} else {
			step = this.step(currentNode);
		}

		if (step) {
			segment.steps.unshift(step);
		}

		currentNode = currentNode.parentNode;

	}

	if (offset != null && offset >= 0) {

		segment.terminal.offset = offset;

		// Make sure we are getting to a textNode if there is an offset
		if(segment.steps[segment.steps.length-1].type != "text") {
			segment.steps.push({
				"type" : "text",
				"index" : 0
			});
		}
	}

	return segment;
}

/**
 * Create a CFI object from a Range
 * @param {Range} range
 * @param {string | object} base
 * @param {string} [ignoreClass]
 * @returns {object} cfi
 */
export function fromRange(range: any, base?: any, ignoreClass?: IgnoreClass): any {
	var cfi: any = {
		range: false,
		base: {},
		path: {},
		start: null,
		end: null
	};

	var start = range.startContainer;
	var end = range.endContainer;

	var startOffset = range.startOffset;
	var endOffset = range.endOffset;

	var needsIgnoring = false;

	if (ignoreClass) {
		// Tell pathTo if / what to ignore
		needsIgnoring = shouldUseIgnore(start && start.ownerDocument, ignoreClass);
	}


	if (typeof base === "string") {
		cfi.base = this.parseComponent(base);
		cfi.spinePos = cfi.base.steps[1].index;
	} else if (typeof base === "object") {
		cfi.base = base;
	}

	if (range.collapsed) {
		if (needsIgnoring) {
			startOffset = this.patchOffset(start, startOffset, ignoreClass);
		}
		cfi.path = this.pathTo(start, startOffset, ignoreClass);
	} else {
		cfi.range = true;

		if (needsIgnoring) {
			startOffset = this.patchOffset(start, startOffset, ignoreClass);
		}

		cfi.start = this.pathTo(start, startOffset, ignoreClass);
		if (needsIgnoring) {
			endOffset = this.patchOffset(end, endOffset, ignoreClass);
		}

		cfi.end = this.pathTo(end, endOffset, ignoreClass);

		// Create a new empty path
		cfi.path = {
			steps: [],
			terminal: null
		};

		// Push steps that are shared between start and end to the common path
		var len = cfi.start.steps.length;
		var i;

		for (i = 0; i < len; i++) {
			if (this.equalStep(cfi.start.steps[i], cfi.end.steps[i])) {
				if(i === len-1) {
					// Last step is equal, check terminals
					if(cfi.start.terminal === cfi.end.terminal) {
						// CFI's are equal
						cfi.path.steps.push(cfi.start.steps[i]);
						// Not a range
						cfi.range = false;
					}
				} else {
					cfi.path.steps.push(cfi.start.steps[i]);
				}

			} else {
				break;
			}
		}

		cfi.start.steps = cfi.start.steps.slice(cfi.path.steps.length);
		cfi.end.steps = cfi.end.steps.slice(cfi.path.steps.length);

		// TODO: Add Sanity check to make sure that the end if greater than the start
	}

	return cfi;
}

/**
 * Create a CFI object from a Node
 * @param {Node} anchor
 * @param {string | object} base
 * @param {string} [ignoreClass]
 * @returns {object} cfi
 */
export function fromNode(anchor: any, base?: any, ignoreClass?: IgnoreClass): any {
	var cfi: any = {
		range: false,
		base: {},
		path: {},
		start: null,
		end: null
	};

	if (typeof base === "string") {
		cfi.base = this.parseComponent(base);
		cfi.spinePos = cfi.base.steps[1].index;
	} else if (typeof base === "object") {
		cfi.base = base;
	}

	cfi.path = this.pathTo(anchor, null, ignoreClass);

	return cfi;
}

export function filter(anchor, ignoreClass: IgnoreClass) {
	var needsIgnoring;
	var sibling; // to join with
	var parent, previousSibling, nextSibling;
	var isText = false;

	if (anchor.nodeType === TEXT_NODE) {
		isText = true;
		parent = anchor.parentNode;
		needsIgnoring = isIgnored(anchor.parentNode, ignoreClass);
	} else {
		isText = false;
		needsIgnoring = isIgnored(anchor, ignoreClass);
	}

	if (needsIgnoring && isText) {
		previousSibling = parent.previousSibling;
		nextSibling = parent.nextSibling;

		// If the sibling is a text node, join the nodes
		if (previousSibling && previousSibling.nodeType === TEXT_NODE) {
			sibling = previousSibling;
		} else if (nextSibling && nextSibling.nodeType === TEXT_NODE) {
			sibling = nextSibling;
		}

		if (sibling) {
			return sibling;
		} else {
			// Parent will be ignored on next step
			return anchor;
		}

	} else if (needsIgnoring && !isText) {
		// Otherwise just skip the element node
		return false;
	} else {
		// No need to filter
		return anchor;
	}
}

export function patchOffset(anchor, offset, ignoreClass: IgnoreClass) {
	if (anchor.nodeType != TEXT_NODE) {
		throw new Error("Anchor must be a text node");
	}

	var curr = anchor;
	var totalOffset = offset;

	// If the parent is a ignored node, get offset from it's start
	if (isIgnored(anchor.parentNode, ignoreClass)) {
		curr = anchor.parentNode;
	}

	while (curr.previousSibling) {
		if(curr.previousSibling.nodeType === ELEMENT_NODE) {
			// Originally a text node, so join
			if(isIgnored(curr.previousSibling, ignoreClass)){
				totalOffset += curr.previousSibling.textContent.length;
			} else {
				break; // Normal node, dont join
			}
		} else {
			// If the previous sibling is a text node, join the nodes
			totalOffset += curr.previousSibling.textContent.length;
		}

		curr = curr.previousSibling;
	}

	return totalOffset;
}

export function normalizedMap(children, nodeType, ignoreClass?: IgnoreClass) {
	var output = {};
	var prevIndex = -1;
	var i, len = children.length;
	var currNodeType;
	var prevNodeType;

	for (i = 0; i < len; i++) {

		currNodeType = children[i].nodeType;

		// Check if needs ignoring
		if (currNodeType === ELEMENT_NODE && ignoreClass && isIgnored(children[i], ignoreClass)) {
			currNodeType = TEXT_NODE;
		}

		if (i > 0 &&
				currNodeType === TEXT_NODE &&
				prevNodeType === TEXT_NODE) {
			// join text nodes
			output[i] = prevIndex;
		} else if (nodeType === currNodeType){
			prevIndex = prevIndex + 1;
			output[i] = prevIndex;
		}

		prevNodeType = currNodeType;

	}

	return output;
}

export function position(anchor) {
	var children, index;
	if (anchor.nodeType === ELEMENT_NODE) {
		children = anchor.parentNode.children;
		if (!children) {
			children = findChildren(anchor.parentNode);
		}
		index = Array.prototype.indexOf.call(children, anchor);
	} else {
		children = this.textNodes(anchor.parentNode);
		index = children.indexOf(anchor);
	}

	return index;
}

export function filteredPosition(anchor, ignoreClass: IgnoreClass) {
	var children, index, map;

	if (anchor.nodeType === ELEMENT_NODE) {
		children = anchor.parentNode.children;
		map = this.normalizedMap(children, ELEMENT_NODE, ignoreClass);
	} else {
		children = anchor.parentNode.childNodes;
		// Inside an ignored node
		if(isIgnored(anchor.parentNode, ignoreClass)) {
			anchor = anchor.parentNode;
			children = anchor.parentNode.childNodes;
		}
		map = this.normalizedMap(children, TEXT_NODE, ignoreClass);
	}


	index = Array.prototype.indexOf.call(children, anchor);

	return map[index];
}

export function stepsToXpath(steps) {
	var xpath = [".", "*"];

	steps.forEach(function(step){
		var position = step.index + 1;

		if(step.id){
			xpath.push("*[position()=" + position + " and @id='" + step.id + "']");
		} else if(step.type === "text") {
			xpath.push("text()[" + position + "]");
		} else {
			xpath.push("*[" + position + "]");
		}
	});

	return xpath.join("/");
}

export function stepsToQuerySelector(steps) {
	var query = ["html"];

	steps.forEach(function(step){
		var position = step.index + 1;

		if(step.id){
			query.push("#" + step.id);
		} else if(step.type === "text") {
			// unsupported in querySelector
			// query.push("text()[" + position + "]");
		} else {
			query.push("*:nth-child(" + position + ")");
		}
	});

	return query.join(">");
}

export function textNodes(container: any, ignoreClass?: IgnoreClass): any[] {
	return Array.prototype.slice.call(container.childNodes).
		filter(function (node) {
			if (node.nodeType === TEXT_NODE) {
				return true;
			} else if (ignoreClass && isIgnored(node, ignoreClass)) {
				return true;
			}
			return false;
			});
}

export function walkToNode(steps: any[], _doc?: any, ignoreClass?: IgnoreClass) {
	var doc = _doc || document;
	var container = doc.documentElement;
	var children;
	var step;
	var len = steps.length;
	var i;

	for (i = 0; i < len; i++) {
		step = steps[i];

		if(step.type === "element") {
			//better to get a container using id as some times step.index may not be correct
			//For ex.https://github.com/futurepress/epub.js/issues/561
			if(step.id) {
				container = doc.getElementById(step.id);
			}
			else {
				children = container.children || findChildren(container);
				container = children[step.index];
			}
		} else if(step.type === "text") {
			container = this.textNodes(container, ignoreClass)[step.index];
		}
		if(!container) {
			//Break the for loop as due to incorrect index we can get error if
			//container is undefined so that other functionailties works fine
			//like navigation
			break;
		}
	}

	return container;
}

export function findNode(steps, _doc, ignoreClass) {
	var doc = _doc || document;
	var container;
	var xpath;

	if(!ignoreClass && typeof doc.evaluate != "undefined") {
		xpath = this.stepsToXpath(steps);
		container = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

		if (!container && steps.length > 1 && steps[steps.length - 1].type === "text") {
			container = this.findNode(steps.slice(0, -1), doc, ignoreClass);
		}
	} else if(ignoreClass) {
		container = this.walkToNode(steps, doc, ignoreClass);
	} else {
		container = this.walkToNode(steps, doc);
	}

	return container;
}

export function fixMiss(steps, offset, _doc, ignoreClass) {
	var container = this.findNode(steps.slice(0,-1), _doc, ignoreClass);
	var children = container.childNodes;
	var map = this.normalizedMap(children, TEXT_NODE, ignoreClass);
	var child;
	var len;
	var lastStepIndex = steps[steps.length-1].index;

	for (let childIndex in map) {
		if (!map.hasOwnProperty(childIndex)) return;

		if(map[childIndex] === lastStepIndex) {
			child = children[childIndex];
			len = child.textContent.length;
			if(offset > len) {
				offset = offset - len;
			} else {
				if (child.nodeType === ELEMENT_NODE) {
					container = child.childNodes[0];
				} else {
					container = child;
				}
				break;
			}
		}
	}

	return {
		container: container,
		offset: offset
	};
}

/**
 * Creates a DOM range representing a CFI
 * @param {document} _doc document referenced in the base
 * @param {string} [ignoreClass]
 * @return {Range}
 */
export function toRange(_doc?: any, ignoreClass?: IgnoreClass) {
	var doc = _doc || document;
	var range;
	var start, end, startContainer, endContainer;
	var cfi = this;
	var startSteps, endSteps;
	var needsIgnoring = shouldUseIgnore(doc, ignoreClass);
	var missed;

	if (typeof(doc.createRange) !== "undefined") {
		range = doc.createRange();
	} else {
		range = new RangeObject();
	}

	if (cfi.range) {
		start = cfi.start;
		startSteps = cfi.path.steps.concat(start.steps);
		startContainer = this.findNode(startSteps, doc, needsIgnoring ? ignoreClass : null);
		end = cfi.end;
		endSteps = cfi.path.steps.concat(end.steps);
		endContainer = this.findNode(endSteps, doc, needsIgnoring ? ignoreClass : null);
	} else {
		start = cfi.path;
		startSteps = cfi.path.steps;
		startContainer = this.findNode(cfi.path.steps, doc, needsIgnoring ? ignoreClass : null);
	}

	if(startContainer) {
		try {

			if(start.terminal.offset != null) {
				range.setStart(startContainer, start.terminal.offset);
			} else {
				range.setStart(startContainer, 0);
			}

		} catch (e) {
			missed = this.fixMiss(startSteps, start.terminal.offset, doc, needsIgnoring ? ignoreClass : null);
			range.setStart(missed.container, missed.offset);
		}
	} else {
		console.log("No startContainer found for", this.toString());
		// No start found
		return null;
	}

	if (endContainer) {
		try {

			if(end.terminal.offset != null) {
				range.setEnd(endContainer, end.terminal.offset);
			} else {
				range.setEnd(endContainer, 0);
			}

		} catch (e) {
			missed = this.fixMiss(endSteps, cfi.end.terminal.offset, doc, needsIgnoring ? ignoreClass : null);
			range.setEnd(missed.container, missed.offset);
		}
	}

	// doc.defaultView.getSelection().addRange(range);
	return range;
}
