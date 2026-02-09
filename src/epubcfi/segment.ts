export function joinSteps(steps) {
	if(!steps) {
		return "";
	}

	return steps.map(function(part){
		var segment = "";

		if(part.type === "element") {
			segment += (part.index + 1) * 2;
		}

		if(part.type === "text") {
			segment += 1 + (2 * part.index); // TODO: double check that this is odd
		}

		if(part.id) {
			segment += "[" + part.id + "]";
		}

		return segment;

	}).join("/");
}

export function segmentString(segment) {
	var segmentString = "/";

	segmentString += this.joinSteps(segment.steps);

	if(segment.terminal && segment.terminal.offset != null){
		segmentString += ":" + segment.terminal.offset;
	}

	if(segment.terminal && segment.terminal.assertion != null){
		segmentString += "[" + segment.terminal.assertion + "]";
	}

	return segmentString;
}

/**
 * Convert CFI to a epubcfi(...) string
 * @returns {string} epubcfi
 */
export function toString() {
	var cfiString = "epubcfi(";

	cfiString += this.segmentString(this.base);

	cfiString += "!";
	cfiString += this.segmentString(this.path);

	// Add Range, if present
	if(this.range && this.start) {
		cfiString += ",";
		cfiString += this.segmentString(this.start);
	}

	if(this.range && this.end) {
		cfiString += ",";
		cfiString += this.segmentString(this.end);
	}

	cfiString += ")";

	return cfiString;
}

export function generateChapterComponent(_spineNodeIndex, _pos, id) {
	var pos = parseInt(_pos),
			spineNodeIndex = (_spineNodeIndex + 1) * 2,
			cfi = "/"+spineNodeIndex+"/";

	cfi += (pos + 1) * 2;

	if(id) {
		cfi += "[" + id + "]";
	}

	return cfi;
}

