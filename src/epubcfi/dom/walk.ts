import { findChildren } from "../../utils/core";
import type { IgnoreClass } from "../ignore";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

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
		if (!Object.prototype.hasOwnProperty.call(map, childIndex)) return;

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
