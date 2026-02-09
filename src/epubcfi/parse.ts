import { type, isNumber } from "../utils/core";

/**
 * Check the type of constructor input
 * @private
 */
export function checkType(cfi: any): string | false {
	const EpubCFIConstructor = this && this.constructor ? (this.constructor as any) : undefined;

	if (this.isCfiString(cfi)) {
		return "string";
	// Is a range object
	} else if (cfi && typeof cfi === "object" && (type(cfi) === "Range" || typeof(cfi.startContainer) != "undefined")){
		return "range";
	} else if (cfi && typeof cfi === "object" && typeof(cfi.nodeType) != "undefined" ){ // || typeof cfi === "function"
		return "node";
	} else if (EpubCFIConstructor && cfi && typeof cfi === "object" && cfi instanceof EpubCFIConstructor){
		return "EpubCFI";
	} else {
		return false;
	}
}

/**
 * Parse a cfi string to a CFI object representation
 * @param {string} cfiStr
 * @returns {object} cfi
 */
export function parse(cfiStr: any): any {
	var cfi: any = {
		spinePos: -1,
		range: false,
		base: {},
		path: {},
		start: null,
		end: null
	};
	var baseComponent, pathComponent, range;

	if(typeof cfiStr !== "string") {
		return {spinePos: -1};
	}

	if(cfiStr.indexOf("epubcfi(") === 0 && cfiStr[cfiStr.length-1] === ")") {
		// Remove initial epubcfi( and ending )
		cfiStr = cfiStr.slice(8, cfiStr.length-1);
	}

	baseComponent = this.getChapterComponent(cfiStr);

	// Make sure this is a valid cfi or return
	if(!baseComponent) {
		return {spinePos: -1};
	}

	cfi.base = this.parseComponent(baseComponent);

	pathComponent = this.getPathComponent(cfiStr);
	cfi.path = this.parseComponent(pathComponent);

	range = this.getRange(cfiStr);

	if(range) {
		cfi.range = true;
		cfi.start = this.parseComponent(range[0]);
		cfi.end = this.parseComponent(range[1]);
	}

	// Get spine node position
	// cfi.spineSegment = cfi.base.steps[1];

	// Chapter segment is always the second step
	cfi.spinePos = cfi.base.steps[1].index;

	return cfi;
}

export function parseComponent(componentStr){
	var component = {
		steps: [],
		terminal: {
			offset: null,
			assertion: null
		}
	};
	var parts = componentStr.split(":");
	var steps = parts[0].split("/");
	var terminal;

	if(parts.length > 1) {
		terminal = parts[1];
		component.terminal = this.parseTerminal(terminal);
	}

	if (steps[0] === "") {
		steps.shift(); // Ignore the first slash
	}

	component.steps = steps.map(function(step){
		return this.parseStep(step);
	}.bind(this));

	return component;
}

export function parseStep(stepStr){
	var type, num, index, has_brackets, id;

	has_brackets = stepStr.match(/\[(.*)\]/);
	if(has_brackets && has_brackets[1]){
		id = has_brackets[1];
	}

	//-- Check if step is a text node or element
	num = parseInt(stepStr);

	if(isNaN(num)) {
		return;
	}

	if(num % 2 === 0) { // Even = is an element
		type = "element";
		index = num / 2 - 1;
	} else {
		type = "text";
		index = (num - 1 ) / 2;
	}

	return {
		"type" : type,
		"index" : index,
		"id" : id || null
	};
}

export function parseTerminal(termialStr){
	var characterOffset, textLocationAssertion;
	var assertion = termialStr.match(/\[(.*)\]/);

	if(assertion && assertion[1]){
		characterOffset = parseInt(termialStr.split("[")[0]);
		textLocationAssertion = assertion[1];
	} else {
		characterOffset = parseInt(termialStr);
	}

	if (!isNumber(characterOffset)) {
		characterOffset = null;
	}

	return {
		"offset": characterOffset,
		"assertion": textLocationAssertion
	};
}

export function getChapterComponent(cfiStr) {
	var indirection = cfiStr.split("!");

	return indirection[0];
}

export function getPathComponent(cfiStr) {
	var indirection = cfiStr.split("!");

	if(indirection[1]) {
		let ranges = indirection[1].split(",");
		return ranges[0];
	}
}

export function getRange(cfiStr) {
	var ranges = cfiStr.split(",");

	if(ranges.length === 3){
		return [
			ranges[1],
			ranges[2]
		];
	}

	return false;
}

export function getCharecterOffsetComponent(cfiStr) {
	var splitStr = cfiStr.split(":");
	return splitStr[1] || "";
}
