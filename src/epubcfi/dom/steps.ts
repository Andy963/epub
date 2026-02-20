import type { IgnoreClass } from "../ignore";

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

