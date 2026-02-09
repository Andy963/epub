import { extend } from "./utils/core";
import type { IgnoreClass } from "./epubcfi/ignore";

import {
	checkType as checkTypeImpl,
	getChapterComponent as getChapterComponentImpl,
	getCharecterOffsetComponent as getCharecterOffsetComponentImpl,
	getPathComponent as getPathComponentImpl,
	getRange as getRangeImpl,
	parse as parseImpl,
	parseComponent as parseComponentImpl,
	parseStep as parseStepImpl,
	parseTerminal as parseTerminalImpl,
} from "./epubcfi/parse";
import { compare as compareImpl, equalStep as equalStepImpl } from "./epubcfi/compare";
import {
	filter as filterImpl,
	filteredPosition as filteredPositionImpl,
	filteredStep as filteredStepImpl,
	findNode as findNodeImpl,
	fixMiss as fixMissImpl,
	fromNode as fromNodeImpl,
	fromRange as fromRangeImpl,
	normalizedMap as normalizedMapImpl,
	patchOffset as patchOffsetImpl,
	pathTo as pathToImpl,
	position as positionImpl,
	step as stepImpl,
	stepsToQuerySelector as stepsToQuerySelectorImpl,
	stepsToXpath as stepsToXpathImpl,
	textNodes as textNodesImpl,
	toRange as toRangeImpl,
	walkToNode as walkToNodeImpl,
} from "./epubcfi/dom";
import {
	generateChapterComponent as generateChapterComponentImpl,
	joinSteps as joinStepsImpl,
	segmentString as segmentStringImpl,
	toString as toStringImpl,
} from "./epubcfi/segment";
import { collapse as collapseImpl, isCfiString as isCfiStringImpl } from "./epubcfi/misc";

/**
 * Parsing and creation of EpubCFIs: http://www.idpf.org/epub/linking/cfi/epub-cfi.html

 * Implements:
 * - Character Offset: epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:3)
 * - Simple Ranges : epubcfi(/6/4[chap01ref]!/4[body01]/10[para05],/2/1:1,/3:4)

 * Does Not Implement:
 * - Temporal Offset (~)
 * - Spatial Offset (@)
 * - Temporal-Spatial Offset (~ + @)
 * - Text Location Assertion ([)
 * @class
 * @param {string | Range | Node } [cfiFrom]
 * @param {string | object} [base]
 * @param {string | function} [ignoreClass] selector class name or predicate to ignore when parsing DOM
 */
class EpubCFI {
	str: string;
	base: any;
	spinePos: number;
	range: boolean;
	path: any;
	start: any;
	end: any;

	constructor(cfiFrom?: any, base?: any, ignoreClass?: IgnoreClass){
		var type;

		this.str = "";

		this.base = {};
		this.spinePos = 0; // For compatibility

		this.range = false; // true || false;

		this.path = {};
		this.start = null;
		this.end = null;

		if(typeof base === "string") {
			this.base = this.parseComponent(base);
		} else if(typeof base === "object" && base.steps) {
			this.base = base;
		}

		type = this.checkType(cfiFrom);

		if(type === "string") {
			this.str = cfiFrom;
			return extend(this, this.parse(cfiFrom));
		} else if (type === "range") {
			return extend(this, this.fromRange(cfiFrom, this.base, ignoreClass));
		} else if (type === "node") {
			return extend(this, this.fromNode(cfiFrom, this.base, ignoreClass));
		} else if (type === "EpubCFI" && cfiFrom.path) {
			return cfiFrom;
		} else if (!cfiFrom) {
			return this;
		} else {
			throw new TypeError("not a valid argument for EpubCFI");
		}
	}

	checkType(cfi: any): string | false {
		return checkTypeImpl.call(this, cfi);
	}

	parse(cfiStr: any): any {
		return parseImpl.call(this, cfiStr);
	}

	parseComponent(componentStr){
		return parseComponentImpl.call(this, componentStr);
	}

	parseStep(stepStr){
		return parseStepImpl.call(this, stepStr);
	}

	parseTerminal(termialStr){
		return parseTerminalImpl.call(this, termialStr);
	}

	getChapterComponent(cfiStr) {
		return getChapterComponentImpl.call(this, cfiStr);
	}

	getPathComponent(cfiStr) {
		return getPathComponentImpl.call(this, cfiStr);
	}

	getRange(cfiStr) {
		return getRangeImpl.call(this, cfiStr);
	}

	getCharecterOffsetComponent(cfiStr) {
		return getCharecterOffsetComponentImpl.call(this, cfiStr);
	}

	joinSteps(steps) {
		return joinStepsImpl.call(this, steps);
	}

	segmentString(segment) {
		return segmentStringImpl.call(this, segment);
	}

	toString() {
		return toStringImpl.call(this);
	}

	compare(cfiOne, cfiTwo) {
		return compareImpl.call(this, cfiOne, cfiTwo);
	}

	step(node) {
		return stepImpl.call(this, node);
	}

	filteredStep(node, ignoreClass) {
		return filteredStepImpl.call(this, node, ignoreClass);
	}

	pathTo(node, offset, ignoreClass) {
		return pathToImpl.call(this, node, offset, ignoreClass);
	}

	equalStep(stepA, stepB) {
		return equalStepImpl.call(this, stepA, stepB);
	}

	fromRange(range: any, base?: any, ignoreClass?: IgnoreClass): any {
		return fromRangeImpl.call(this, range, base, ignoreClass);
	}

	fromNode(anchor: any, base?: any, ignoreClass?: IgnoreClass): any {
		return fromNodeImpl.call(this, anchor, base, ignoreClass);
	}

	filter(anchor, ignoreClass) {
		return filterImpl.call(this, anchor, ignoreClass);
	}

	patchOffset(anchor, offset, ignoreClass) {
		return patchOffsetImpl.call(this, anchor, offset, ignoreClass);
	}

	normalizedMap(children, nodeType, ignoreClass) {
		return normalizedMapImpl.call(this, children, nodeType, ignoreClass);
	}

	position(anchor) {
		return positionImpl.call(this, anchor);
	}

	filteredPosition(anchor, ignoreClass) {
		return filteredPositionImpl.call(this, anchor, ignoreClass);
	}

	stepsToXpath(steps) {
		return stepsToXpathImpl.call(this, steps);
	}

	stepsToQuerySelector(steps) {
		return stepsToQuerySelectorImpl.call(this, steps);
	}

	textNodes(container: any, ignoreClass?: IgnoreClass): any[] {
		return textNodesImpl.call(this, container, ignoreClass);
	}

	walkToNode(steps: any[], _doc?: any, ignoreClass?: IgnoreClass) {
		return walkToNodeImpl.call(this, steps, _doc, ignoreClass);
	}

	findNode(steps, _doc, ignoreClass) {
		return findNodeImpl.call(this, steps, _doc, ignoreClass);
	}

	fixMiss(steps, offset, _doc, ignoreClass) {
		return fixMissImpl.call(this, steps, offset, _doc, ignoreClass);
	}

	toRange(_doc?: any, ignoreClass?: IgnoreClass) {
		return toRangeImpl.call(this, _doc, ignoreClass);
	}

	isCfiString(str) {
		return isCfiStringImpl.call(this, str);
	}

	generateChapterComponent(_spineNodeIndex, _pos, id) {
		return generateChapterComponentImpl.call(this, _spineNodeIndex, _pos, id);
	}

	collapse(toStart?) {
		return collapseImpl.call(this, toStart);
	}
}

export default EpubCFI;
