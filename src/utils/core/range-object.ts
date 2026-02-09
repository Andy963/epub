import { parents } from "./dom";

/**
 * Lightweight Polyfill for DOM Range
 * @class
 * @memberof Core
 */
export class RangeObject {
	collapsed: boolean;
	commonAncestorContainer: any;
	endContainer: any;
	endOffset: any;
	startContainer: any;
	startOffset: any;

	constructor() {
		this.collapsed = false;
		this.commonAncestorContainer = undefined;
		this.endContainer = undefined;
		this.endOffset = undefined;
		this.startContainer = undefined;
		this.startOffset = undefined;
	}

	setStart(startNode, startOffset) {
		this.startContainer = startNode;
		this.startOffset = startOffset;

		if (!this.endContainer) {
			this.collapse(true);
		} else {
			this.commonAncestorContainer = this._commonAncestorContainer();
		}

		this._checkCollapsed();
	}

	setEnd(endNode, endOffset) {
		this.endContainer = endNode;
		this.endOffset = endOffset;

		if (!this.startContainer) {
			this.collapse(false);
		} else {
			this.collapsed = false;
			this.commonAncestorContainer = this._commonAncestorContainer();
		}

		this._checkCollapsed();
	}

	collapse(toStart) {
		this.collapsed = true;
		if (toStart) {
			this.endContainer = this.startContainer;
			this.endOffset = this.startOffset;
			this.commonAncestorContainer = this.startContainer.parentNode;
		} else {
			this.startContainer = this.endContainer;
			this.startOffset = this.endOffset;
			this.commonAncestorContainer = this.endContainer.parentNode;
		}
	}

	selectNode(referenceNode) {
		let parent = referenceNode.parentNode;
		let index = Array.prototype.indexOf.call(parent.childNodes, referenceNode);
		this.setStart(parent, index);
		this.setEnd(parent, index + 1);
	}

	selectNodeContents(referenceNode) {
		let end = referenceNode.childNodes[referenceNode.childNodes.length - 1];
		let parent = referenceNode.parentNode;
		let endIndex =
			referenceNode.nodeType === 3
				? referenceNode.textContent.length
				: parent.childNodes.length;
		this.setStart(referenceNode, 0);
		this.setEnd(referenceNode, endIndex);
	}

	_commonAncestorContainer(startContainer?, endContainer?) {
		var startParents = parents(startContainer || this.startContainer);
		var endParents = parents(endContainer || this.endContainer);

		if (startParents[0] != endParents[0]) return undefined;

		for (var i = 0; i < startParents.length; i++) {
			if (startParents[i] != endParents[i]) {
				return startParents[i - 1];
			}
		}
	}

	_checkCollapsed() {
		if (
			this.startContainer === this.endContainer &&
			this.startOffset === this.endOffset
		) {
			this.collapsed = true;
		} else {
			this.collapsed = false;
		}
	}

	toString() {
		// TODO: implement walking between start and end to find text
	}
}

