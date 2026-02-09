/**
 * Check if a string is wrapped with "epubcfi()"
 * @param {string} str
 * @returns {boolean}
 */
export function isCfiString(str) {
	if(typeof str === "string" &&
		str.indexOf("epubcfi(") === 0 &&
		str[str.length-1] === ")") {
		return true;
	}

	return false;
}

/**
 * Collapse a CFI Range to a single CFI Position
 * @param {boolean} [toStart=false]
 */
export function collapse(toStart?) {
	if (!this.range) {
		return;
	}

	this.range = false;

	if (toStart) {
		this.path.steps = this.path.steps.concat(this.start.steps);
		this.path.terminal = this.start.terminal;
	} else {
		this.path.steps = this.path.steps.concat(this.end.steps);
		this.path.terminal = this.end.terminal;
	}
}

