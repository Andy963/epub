import { RangeObject } from "../../utils/core";
import { shouldUseIgnore } from "../ignore";
import type { IgnoreClass } from "../ignore";

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

