import { isNumber, borders } from "../utils/core";

function normalizeCssSize(value: any): string {
	if (isNumber(value)) {
		return `${value}px`;
	}

	return String(value);
}

function setDimensionStyle(el: HTMLElement, prop: "width" | "height", value: any): void {
	if (!value) {
		return;
	}

	el.style[prop] = normalizeCssSize(value);
}

/**
 * Get or Set width
 * @param {number} [w]
 * @returns {number} width
 */
export function width(w?) {
	// var frame = this.documentElement;
	const frame = this.content;
	setDimensionStyle(frame, "width", w);

	return parseInt(this.window.getComputedStyle(frame)["width"]);
}

/**
 * Get or Set height
 * @param {number} [h]
 * @returns {number} height
 */
export function height(h?) {
	// var frame = this.documentElement;
	const frame = this.content;
	setDimensionStyle(frame, "height", h);

	return parseInt(this.window.getComputedStyle(frame)["height"]);
}

/**
 * Get or Set width of the contents
 * @param {number} [w]
 * @returns {number} width
 */
export function contentWidth(w?) {
	const content = this.content || this.document.body;
	setDimensionStyle(content, "width", w);

	return parseInt(this.window.getComputedStyle(content)["width"]);
}

/**
 * Get or Set height of the contents
 * @param {number} [h]
 * @returns {number} height
 */
export function contentHeight(h?) {
	const content = this.content || this.document.body;
	setDimensionStyle(content, "height", h);

	return parseInt(this.window.getComputedStyle(content)["height"]);
}

/**
 * Get the width of the text using Range
 * @returns {number} width
 */
export function textWidth() {
	const range = this.document.createRange();
	const content = this.content || this.document.body;
	const border = borders(content);

	// Select the contents of frame
	range.selectNodeContents(content);

	// get the width of the text content
	const rect = range.getBoundingClientRect();
	const extra = border && border.width ? border.width : 0;

	return Math.round(rect.width + extra);
}

/**
 * Get the height of the text using Range
 * @returns {number} height
 */
export function textHeight() {
	const range = this.document.createRange();
	const content = this.content || this.document.body;

	range.selectNodeContents(content);

	const rect = range.getBoundingClientRect();

	return Math.round(rect.bottom);
}

/**
 * Get documentElement scrollWidth
 * @returns {number} width
 */
export function scrollWidth() {
	return this.documentElement.scrollWidth;
}

/**
 * Get documentElement scrollHeight
 * @returns {number} height
 */
export function scrollHeight() {
	return this.documentElement.scrollHeight;
}
