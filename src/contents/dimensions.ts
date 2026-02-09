import { isNumber, borders } from "../utils/core";

/**
 * Get or Set width
 * @param {number} [w]
 * @returns {number} width
 */
export function width(w?) {
	// var frame = this.documentElement;
	var frame = this.content;

	if (w && isNumber(w)) {
		w = w + "px";
	}

	if (w) {
		frame.style.width = w;
		// this.content.style.width = w;
	}

	return parseInt(this.window.getComputedStyle(frame)["width"]);
}

/**
 * Get or Set height
 * @param {number} [h]
 * @returns {number} height
 */
export function height(h?) {
	// var frame = this.documentElement;
	var frame = this.content;

	if (h && isNumber(h)) {
		h = h + "px";
	}

	if (h) {
		frame.style.height = h;
		// this.content.style.height = h;
	}

	return parseInt(this.window.getComputedStyle(frame)["height"]);
}

/**
 * Get or Set width of the contents
 * @param {number} [w]
 * @returns {number} width
 */
export function contentWidth(w?) {
	var content = this.content || this.document.body;

	if (w && isNumber(w)) {
		w = w + "px";
	}

	if (w) {
		content.style.width = w;
	}

	return parseInt(this.window.getComputedStyle(content)["width"]);
}

/**
 * Get or Set height of the contents
 * @param {number} [h]
 * @returns {number} height
 */
export function contentHeight(h?) {
	var content = this.content || this.document.body;

	if (h && isNumber(h)) {
		h = h + "px";
	}

	if (h) {
		content.style.height = h;
	}

	return parseInt(this.window.getComputedStyle(content)["height"]);
}

/**
 * Get the width of the text using Range
 * @returns {number} width
 */
export function textWidth() {
	let rect;
	let width;
	let range = this.document.createRange();
	let content = this.content || this.document.body;
	let border = borders(content);

	// Select the contents of frame
	range.selectNodeContents(content);

	// get the width of the text content
	rect = range.getBoundingClientRect();
	width = rect.width;

	if (border && border.width) {
		width += border.width;
	}

	return Math.round(width);
}

/**
 * Get the height of the text using Range
 * @returns {number} height
 */
export function textHeight() {
	let rect;
	let height;
	let range = this.document.createRange();
	let content = this.content || this.document.body;

	range.selectNodeContents(content);

	rect = range.getBoundingClientRect();
	height = rect.bottom;

	return Math.round(height);
}

/**
 * Get documentElement scrollWidth
 * @returns {number} width
 */
export function scrollWidth() {
	var width = this.documentElement.scrollWidth;

	return width;
}

/**
 * Get documentElement scrollHeight
 * @returns {number} height
 */
export function scrollHeight() {
	var height = this.documentElement.scrollHeight;

	return height;
}

