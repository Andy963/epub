import { prefixed, defaults } from "../utils/core";

/**
 * Set overflow css style of the contents
 * @param {string} [overflow]
 */
export function overflow(overflow?) {
	if (overflow) {
		this.documentElement.style.overflow = overflow;
	}

	return this.window.getComputedStyle(this.documentElement)["overflow"];
}

/**
 * Set overflowX css style of the documentElement
 * @param {string} [overflow]
 */
export function overflowX(overflow?) {
	if (overflow) {
		this.documentElement.style.overflowX = overflow;
	}

	return this.window.getComputedStyle(this.documentElement)["overflowX"];
}

/**
 * Set overflowY css style of the documentElement
 * @param {string} [overflow]
 */
export function overflowY(overflow?) {
	if (overflow) {
		this.documentElement.style.overflowY = overflow;
	}

	return this.window.getComputedStyle(this.documentElement)["overflowY"];
}

/**
 * Set Css styles on the contents element (typically Body)
 * @param {string} property
 * @param {string} value
 * @param {boolean} [priority] set as "important"
 */
export function css(property, value?, priority?) {
	var content = this.content || this.document.body;

	if (value) {
		content.style.setProperty(property, value, priority ? "important" : "");
	} else {
		content.style.removeProperty(property);
	}

	return this.window.getComputedStyle(content)[property];
}

/**
 * Get or Set the viewport element
 * @param {object} [options]
 * @param {string} [options.width]
 * @param {string} [options.height]
 * @param {string} [options.scale]
 * @param {string} [options.minimum]
 * @param {string} [options.maximum]
 * @param {string} [options.scalable]
 */
export function viewport(options?) {
	// var width, height, scale, minimum, maximum, scalable;
	var $viewport = this.document.querySelector("meta[name='viewport']");
	var parsed = {
		"width": undefined,
		"height": undefined,
		"scale": undefined,
		"minimum": undefined,
		"maximum": undefined,
		"scalable": undefined
	};
	var newContent = [];
	var settings: any = {};

	/*
	* check for the viewport size
	* <meta name="viewport" content="width=1024,height=697" />
	*/
	if ($viewport && $viewport.hasAttribute("content")) {
		let content = $viewport.getAttribute("content");
		let _width = content.match(/width\s*=\s*([^,]*)/);
		let _height = content.match(/height\s*=\s*([^,]*)/);
		let _scale = content.match(/initial-scale\s*=\s*([^,]*)/);
		let _minimum = content.match(/minimum-scale\s*=\s*([^,]*)/);
		let _maximum = content.match(/maximum-scale\s*=\s*([^,]*)/);
		let _scalable = content.match(/user-scalable\s*=\s*([^,]*)/);

		if (_width && _width.length && typeof _width[1] !== "undefined") {
			parsed.width = _width[1];
		}
		if (_height && _height.length && typeof _height[1] !== "undefined") {
			parsed.height = _height[1];
		}
		if (_scale && _scale.length && typeof _scale[1] !== "undefined") {
			parsed.scale = _scale[1];
		}
		if (_minimum && _minimum.length && typeof _minimum[1] !== "undefined") {
			parsed.minimum = _minimum[1];
		}
		if (_maximum && _maximum.length && typeof _maximum[1] !== "undefined") {
			parsed.maximum = _maximum[1];
		}
		if (_scalable && _scalable.length && typeof _scalable[1] !== "undefined") {
			parsed.scalable = _scalable[1];
		}
	}

	settings = defaults(options || {}, parsed);

	if (options) {
		if (settings.width) {
			newContent.push("width=" + settings.width);
		}

		if (settings.height) {
			newContent.push("height=" + settings.height);
		}

		if (settings.scale) {
			newContent.push("initial-scale=" + settings.scale);
		}

		if (settings.scalable === "no") {
			newContent.push("minimum-scale=" + settings.scale);
			newContent.push("maximum-scale=" + settings.scale);
			newContent.push("user-scalable=" + settings.scalable);
		} else {
			if (settings.scalable) {
				newContent.push("user-scalable=" + settings.scalable);
			}

			if (settings.minimum) {
				newContent.push("minimum-scale=" + settings.minimum);
			}

			if (settings.maximum) {
				newContent.push("minimum-scale=" + settings.maximum);
			}
		}

		if (!$viewport) {
			$viewport = this.document.createElement("meta");
			$viewport.setAttribute("name", "viewport");
			this.document.querySelector("head").appendChild($viewport);
		}

		$viewport.setAttribute("content", newContent.join(", "));

		this.window.scrollTo(0, 0);
	}

	return settings;
}

/**
 * Append a stylesheet link to the document head
 * @param {string} src url
 */
export function addStylesheet(src) {
	return new Promise(function (resolve, reject) {
		var $stylesheet;
		var ready = false;

		if (!this.document) {
			resolve(false);
			return;
		}

		// Check if link already exists
		$stylesheet = this.document.querySelector("link[href='" + src + "']");
		if ($stylesheet) {
			resolve(true);
			return; // already present
		}

		$stylesheet = this.document.createElement("link");
		$stylesheet.type = "text/css";
		$stylesheet.rel = "stylesheet";
		$stylesheet.href = src;
		$stylesheet.onload = $stylesheet.onreadystatechange = function () {
			if (!ready && (!this.readyState || this.readyState == "complete")) {
				ready = true;
				// Let apply
				setTimeout(() => {
					resolve(true);
				}, 1);
			}
		};

		this.document.head.appendChild($stylesheet);
	}.bind(this));
}

export function _getStylesheetNode(key) {
	var styleEl;
	key = "epubjs-inserted-css-" + (key || "");

	if (!this.document) return false;

	// Check if link already exists
	styleEl = this.document.getElementById(key);
	if (!styleEl) {
		styleEl = this.document.createElement("style");
		styleEl.id = key;
		// Append style element to head
		this.document.head.appendChild(styleEl);
	}
	return styleEl;
}

/**
 * Append stylesheet css
 * @param {string} serializedCss
 * @param {string} key If the key is the same, the CSS will be replaced instead of inserted
 */
export function addStylesheetCss(serializedCss, key?) {
	if (!this.document || !serializedCss) return false;

	var styleEl;
	styleEl = this._getStylesheetNode(key);
	styleEl.innerHTML = serializedCss;

	return true;
}

/**
 * Append stylesheet rules to a generate stylesheet
 * Array: https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/insertRule
 * Object: https://github.com/desirable-objects/json-to-css
 * @param {array | object} rules
 * @param {string} key If the key is the same, the CSS will be replaced instead of inserted
 */
export function addStylesheetRules(rules, key?) {
	var styleSheet;
	var styleEl;

	if (!this.document || !rules || rules.length === 0) return;

	// Grab style sheet
	styleEl = this._getStylesheetNode(key);
	styleSheet = styleEl.sheet;

	if (styleSheet && styleSheet.cssRules && styleSheet.cssRules.length) {
		try {
			for (var c = styleSheet.cssRules.length - 1; c >= 0; c--) {
				styleSheet.deleteRule(c);
			}
		} catch (e) {
			// Fallback for browsers that don't allow deleting cssRules
			styleEl.innerHTML = "";
			styleSheet = styleEl.sheet;
		}
	}

	if (Object.prototype.toString.call(rules) === "[object Array]") {
		for (var i = 0, rl = rules.length; i < rl; i++) {
			var j = 1, rule = rules[i], selector = rules[i][0], propStr = "";
			// If the second argument of a rule is an array of arrays, correct our variables.
			if (Object.prototype.toString.call(rule[1][0]) === "[object Array]") {
				rule = rule[1];
				j = 0;
			}

			for (var pl = rule.length; j < pl; j++) {
				var prop = rule[j];
				propStr += prop[0] + ":" + prop[1] + (prop[2] ? " !important" : "") + ";\n";
			}

			// Insert CSS Rule
			styleSheet.insertRule(selector + "{" + propStr + "}", styleSheet.cssRules.length);
		}
	} else {
		const selectors = Object.keys(rules);
		selectors.forEach((selector) => {
			const definition = rules[selector];
			if (Array.isArray(definition)) {
				definition.forEach((item) => {
					const _rules = Object.keys(item);
					const result = _rules.map((rule) => {
						return `${rule}:${item[rule]}`;
					}).join(";");
					styleSheet.insertRule(`${selector}{${result}}`, styleSheet.cssRules.length);
				});
			} else {
				const _rules = Object.keys(definition);
				const result = _rules.map((rule) => {
					return `${rule}:${definition[rule]}`;
				}).join(";");
				styleSheet.insertRule(`${selector}{${result}}`, styleSheet.cssRules.length);
			}
		});
	}
}

/**
 * Append a script tag to the document head
 * @param {string} src url
 * @returns {Promise} loaded
 */
export function addScript(src) {
	return new Promise(function (resolve, reject) {
		var $script;
		var ready = false;

		if (!this.document) {
			resolve(false);
			return;
		}

		$script = this.document.createElement("script");
		$script.type = "text/javascript";
		$script.async = true;
		$script.src = src;
		$script.onload = $script.onreadystatechange = function () {
			if (!ready && (!this.readyState || this.readyState == "complete")) {
				ready = true;
				setTimeout(function () {
					resolve(true);
				}, 1);
			}
		};

		this.document.head.appendChild($script);
	}.bind(this));
}

/**
 * Add a class to the contents container
 * @param {string} className
 */
export function addClass(className) {
	var content;

	if (!this.document) return;

	content = this.content || this.document.body;

	if (content) {
		content.classList.add(className);
	}
}

/**
 * Remove a class from the contents container
 * @param {string} removeClass
 */
export function removeClass(className) {
	var content;

	if (!this.document) return;

	content = this.content || this.document.body;

	if (content) {
		content.classList.remove(className);
	}
}

/**
 * Set the direction of the text
 * @param {string} [dir="ltr"] "rtl" | "ltr"
 */
export function direction(dir?) {
	if (this.documentElement) {
		this.documentElement.style["direction"] = dir;
	}
}

/**
 * Set the writingMode of the text
 * @param {string} [mode="horizontal-tb"] "horizontal-tb" | "vertical-rl" | "vertical-lr"
 */
export function writingMode(mode?) {
	let WRITING_MODE = prefixed("writing-mode");

	if (mode && this.documentElement) {
		this.documentElement.style[WRITING_MODE] = mode;
	}

	return this.window.getComputedStyle(this.documentElement)[WRITING_MODE] || "";
}

