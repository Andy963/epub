import { findChildren } from "../../utils/core";
import { isIgnored } from "../ignore";
import type { IgnoreClass } from "../ignore";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

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

