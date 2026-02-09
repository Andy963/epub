import EpubCFI from "../epubcfi";
import Mapping from "../mapping";

const hasNavigator = typeof (navigator) !== "undefined";

const isChrome = hasNavigator && /Chrome/.test(navigator.userAgent);
const isWebkit = hasNavigator && !isChrome && /AppleWebKit/.test(navigator.userAgent);

const ELEMENT_NODE = 1;

/**
 * Get the documentElement
 * @returns {element} documentElement
 */
export function root() {
	if (!this.document) return null;
	return this.document.documentElement;
}

/**
 * Get the location offset of a EpubCFI or an #id
 * @param {string | EpubCFI} target
 * @param {string} [ignoreClass] for the cfi
 * @returns { {left: Number, top: Number }
 */
export function locationOf(target, ignoreClass?) {
	var position;
	var targetPos = { "left": 0, "top": 0 };

	if (!this.document) return targetPos;

	if (this.epubcfi.isCfiString(target)) {
		let range = new EpubCFI(target).toRange(this.document, ignoreClass);

		if (range) {
			try {
				if (!range.endContainer ||
					(range.startContainer == range.endContainer
						&& range.startOffset == range.endOffset)) {
					// If the end for the range is not set, it results in collapsed becoming
					// true. This in turn leads to inconsistent behaviour when calling
					// getBoundingRect. Wrong bounds lead to the wrong page being displayed.
					// https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/15684911/
					let pos = range.startContainer.textContent.indexOf(" ", range.startOffset);
					if (pos == -1) {
						pos = range.startContainer.textContent.length;
					}
					range.setEnd(range.startContainer, pos);
				}
			} catch (e) {
				console.error("setting end offset to start container length failed", e);
			}

			if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
				position = range.startContainer.getBoundingClientRect();
				targetPos.left = position.left;
				targetPos.top = position.top;
			} else {
				// Webkit does not handle collapsed range bounds correctly
				// https://bugs.webkit.org/show_bug.cgi?id=138949

				// Construct a new non-collapsed range
				if (isWebkit) {
					let container = range.startContainer;
					let newRange = new Range();
					try {
						if (container.nodeType === ELEMENT_NODE) {
							position = container.getBoundingClientRect();
						} else if (range.startOffset + 2 < container.length) {
							newRange.setStart(container, range.startOffset);
							newRange.setEnd(container, range.startOffset + 2);
							position = newRange.getBoundingClientRect();
						} else if (range.startOffset - 2 > 0) {
							newRange.setStart(container, range.startOffset - 2);
							newRange.setEnd(container, range.startOffset);
							position = newRange.getBoundingClientRect();
						} else { // empty, return the parent element
							position = container.parentNode.getBoundingClientRect();
						}
					} catch (e) {
						console.error(e, e.stack);
					}
				} else {
					position = range.getBoundingClientRect();
				}
			}
		}
	} else if (typeof target === "string" &&
		target.indexOf("#") > -1) {
		let id = target.substring(target.indexOf("#") + 1);
		let el = this.document.getElementById(id);
		if (el) {
			if (isWebkit) {
				// Webkit reports incorrect bounding rects in Columns
				let newRange = new Range();
				newRange.selectNode(el);
				position = newRange.getBoundingClientRect();
			} else {
				position = el.getBoundingClientRect();
			}
		}
	}

	if (position) {
		targetPos.left = position.left;
		targetPos.top = position.top;
	}

	return targetPos;
}

/**
 * Get a Dom Range from EpubCFI
 * @param {EpubCFI} _cfi
 * @param {string} [ignoreClass]
 * @returns {Range} range
 */
export function range(_cfi, ignoreClass?) {
	var cfi = new EpubCFI(_cfi);
	return cfi.toRange(this.document, ignoreClass);
}

/**
 * Get an EpubCFI from a Dom Range
 * @param {Range} range
 * @param {string} [ignoreClass]
 * @returns {EpubCFI} cfi
 */
export function cfiFromRange(range, ignoreClass?) {
	return new EpubCFI(range, this.cfiBase, ignoreClass).toString();
}

/**
 * Get an EpubCFI from a Dom node
 * @param {node} node
 * @param {string} [ignoreClass]
 * @returns {EpubCFI} cfi
 */
export function cfiFromNode(node, ignoreClass?) {
	return new EpubCFI(node, this.cfiBase, ignoreClass).toString();
}

// TODO: find where this is used - remove?
export function map(layout, view) {
	var map = new Mapping(layout);
	return map.section(view);
}

export function mapPage(cfiBase, layout, start, end, dev) {
	var mapping = new Mapping(layout, dev);

	return mapping.page(this, cfiBase, start, end);
}

