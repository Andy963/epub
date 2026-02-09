import EpubCFI from "../epubcfi";
import { replaceLinks } from "../utils/replacements";
import { EVENTS, DOM_EVENTS } from "../utils/constants";

/**
 * Event emitter for when the contents has expanded
 * @private
 */
export function expand() {
	this.emit(EVENTS.CONTENTS.EXPAND);
}

/**
 * Add DOM listeners
 * @private
 */
export function listeners() {
	this.imageLoadListeners();

	this.mediaQueryListeners();

	this.fontLoadListeners();

	this.addEventListeners();

	this.addSelectionListeners();

	// this.transitionListeners();

	if (typeof ResizeObserver === "undefined") {
		this.resizeListeners();
		this.visibilityListeners();
	} else {
		this.resizeObservers();
	}

	// this.mutationObservers();

	this.linksHandler();
}

/**
 * Remove DOM listeners
 * @private
 */
export function removeListeners() {
	this.removeEventListeners();

	this.removeSelectionListeners();

	if (this.observer) {
		this.observer.disconnect();
	}

	clearTimeout(this.expanding);
}

/**
 * Check if size of contents has changed and
 * emit 'resize' event if it has.
 * @private
 */
export function resizeCheck() {
	let width = this.textWidth();
	let height = this.textHeight();

	if (width != this._size.width || height != this._size.height) {
		this._size = {
			width: width,
			height: height
		};

		this.onResize && this.onResize(this._size);
		this.emit(EVENTS.CONTENTS.RESIZE, this._size);
	}
}

/**
 * Poll for resize detection
 * @private
 */
export function resizeListeners() {
	// Test size again
	clearTimeout(this.expanding);
	requestAnimationFrame(this.resizeCheck.bind(this));
	this.expanding = setTimeout(this.resizeListeners.bind(this), 350);
}

/**
 * Listen for visibility of tab to change
 * @private
 */
export function visibilityListeners() {
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible" && this.active === false) {
			this.active = true;
			this.resizeListeners();
		} else {
			this.active = false;
			clearTimeout(this.expanding);
		}
	});
}

/**
 * Use css transitions to detect resize
 * @private
 */
export function transitionListeners() {
	let body = this.content;

	body.style["transitionProperty"] = "font, font-size, font-size-adjust, font-stretch, font-variation-settings, font-weight, width, height";
	body.style["transitionDuration"] = "0.001ms";
	body.style["transitionTimingFunction"] = "linear";
	body.style["transitionDelay"] = "0";

	this._resizeCheck = this.resizeCheck.bind(this);
	this.document.addEventListener("transitionend", this._resizeCheck);
}

/**
 * Listen for media query changes and emit 'expand' event
 * Adapted from: https://github.com/tylergaw/media-query-events/blob/master/js/mq-events.js
 * @private
 */
export function mediaQueryListeners() {
	var sheets = this.document.styleSheets;
	var mediaChangeHandler = function (m) {
		if (m.matches && !this._expanding) {
			setTimeout(this.expand.bind(this), 1);
		}
	}.bind(this);

	for (var i = 0; i < sheets.length; i += 1) {
		var rules;
		// Firefox errors if we access cssRules cross-domain
		try {
			rules = sheets[i].cssRules;
		} catch (e) {
			return;
		}
		if (!rules) return; // Stylesheets changed
		for (var j = 0; j < rules.length; j += 1) {
			//if (rules[j].constructor === CSSMediaRule) {
			if (rules[j].media) {
				var mql = this.window.matchMedia(rules[j].media.mediaText);
				mql.addListener(mediaChangeHandler);
				//mql.onchange = mediaChangeHandler;
			}
		}
	}
}

/**
 * Use ResizeObserver to listen for changes in the DOM and check for resize
 * @private
 */
export function resizeObservers() {
	// create an observer instance
	this.observer = new ResizeObserver((e) => {
		requestAnimationFrame(this.resizeCheck.bind(this));
	});

	// pass in the target node
	this.observer.observe(this.document.documentElement);
}

/**
 * Use MutationObserver to listen for changes in the DOM and check for resize
 * @private
 */
export function mutationObservers() {
	// create an observer instance
	this.observer = new MutationObserver((mutations) => {
		this.resizeCheck();
	});

	// configuration of the observer:
	let config = { attributes: true, childList: true, characterData: true, subtree: true };

	// pass in the target node, as well as the observer options
	this.observer.observe(this.document, config);
}

/**
 * Test if images are loaded or add listener for when they load
 * @private
 */
export function imageLoadListeners() {
	var images = this.document.querySelectorAll("img");
	var img;
	for (var i = 0; i < images.length; i++) {
		img = images[i];

		if (typeof img.naturalWidth !== "undefined" &&
			img.naturalWidth === 0) {
			img.onload = this.expand.bind(this);
		}
	}
}

/**
 * Listen for font load and check for resize when loaded
 * @private
 */
export function fontLoadListeners() {
	if (!this.document || !this.document.fonts) {
		return;
	}

	this.document.fonts.ready.then(function () {
		this.resizeCheck();
	}.bind(this));
}

/**
 * Add DOM event listeners
 * @private
 */
export function addEventListeners() {
	if (!this.document) {
		return;
	}

	this._triggerEvent = this.triggerEvent.bind(this);

	DOM_EVENTS.forEach(function (eventName) {
		this.document.addEventListener(eventName, this._triggerEvent, { passive: true });
	}, this);
}

/**
 * Remove DOM event listeners
 * @private
 */
export function removeEventListeners() {
	if (!this.document) {
		return;
	}
	DOM_EVENTS.forEach(function (eventName) {
		this.document.removeEventListener(eventName, this._triggerEvent, { passive: true });
	}, this);
	this._triggerEvent = undefined;
}

/**
 * Emit passed browser events
 * @private
 */
export function triggerEvent(e) {
	this.emit(e.type, e);
}

/**
 * Add listener for text selection
 * @private
 */
export function addSelectionListeners() {
	if (!this.document) {
		return;
	}
	this._onSelectionChange = this.onSelectionChange.bind(this);
	this.document.addEventListener("selectionchange", this._onSelectionChange, { passive: true });
}

/**
 * Remove listener for text selection
 * @private
 */
export function removeSelectionListeners() {
	if (!this.document) {
		return;
	}
	this.document.removeEventListener("selectionchange", this._onSelectionChange, { passive: true });
	this._onSelectionChange = undefined;
}

/**
 * Handle getting text on selection
 * @private
 */
export function onSelectionChange(e) {
	if (this.selectionEndTimeout) {
		clearTimeout(this.selectionEndTimeout);
	}
	this.selectionEndTimeout = setTimeout(function () {
		var selection = this.window.getSelection();
		this.triggerSelectedEvent(selection);
	}.bind(this), 250);
}

/**
 * Emit event on text selection
 * @private
 */
export function triggerSelectedEvent(selection) {
	var range, cfirange;

	if (selection && selection.rangeCount > 0) {
		range = selection.getRangeAt(0);
		if (!range.collapsed) {
			// cfirange = this.section.cfiFromRange(range);
			cfirange = new EpubCFI(range, this.cfiBase).toString();
			this.emit(EVENTS.CONTENTS.SELECTED, cfirange);
			this.emit(EVENTS.CONTENTS.SELECTED_RANGE, range);
		}
	}
}

/**
 * Emit event when link in content is clicked
 * @private
 */
export function linksHandler() {
	replaceLinks(this.content, (href, link, event) => {
		this.emit(EVENTS.CONTENTS.LINK_CLICKED, href, link, event);
	});
}

export function destroy() {
	// this.document.removeEventListener('transitionend', this._resizeCheck);

	this.removeListeners();
}

