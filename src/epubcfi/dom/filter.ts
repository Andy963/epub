import { isIgnored } from "../ignore";
import type { IgnoreClass } from "../ignore";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

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

