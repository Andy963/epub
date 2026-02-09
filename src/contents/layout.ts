import { isNumber, prefixed } from "../utils/core";

/**
 * Size the contents to a given width and height
 * @param {number} [width]
 * @param {number} [height]
 */
export function size(width, height) {
	var viewport: any = { scale: 1.0, scalable: "no" };

	this.layoutStyle("scrolling");

	if (width >= 0) {
		this.width(width);
		viewport.width = width;
		this.css("padding", "0 " + (width / 12) + "px");
	}

	if (height >= 0) {
		this.height(height);
		viewport.height = height;
	}

	this.css("margin", "0");
	this.css("box-sizing", "border-box");

	this.viewport(viewport);
}

/**
 * Apply columns to the contents for pagination
 * @param {number} width
 * @param {number} height
 * @param {number} columnWidth
 * @param {number} gap
 */
export function columns(width, height, columnWidth, gap, dir?) {
	let COLUMN_AXIS = prefixed("column-axis");
	let COLUMN_GAP = prefixed("column-gap");
	let COLUMN_WIDTH = prefixed("column-width");
	let COLUMN_FILL = prefixed("column-fill");

	let writingMode = this.writingMode();
	let axis = (writingMode.indexOf("vertical") === 0) ? "vertical" : "horizontal";

	this.layoutStyle("paginated");

	if (dir === "rtl" && axis === "horizontal") {
		this.direction(dir);
	}

	this.width(width);
	this.height(height);

	// Deal with Mobile trying to scale to viewport
	this.viewport({ width: width, height: height, scale: 1.0, scalable: "no" });

	// TODO: inline-block needs more testing
	// Fixes Safari column cut offs, but causes RTL issues
	// this.css("display", "inline-block");

	this.css("overflow-y", "hidden");
	this.css("margin", "0", true);

	if (axis === "vertical") {
		this.css("padding-top", (gap / 2) + "px", true);
		this.css("padding-bottom", (gap / 2) + "px", true);
		this.css("padding-left", "20px");
		this.css("padding-right", "20px");
		this.css(COLUMN_AXIS, "vertical");
	} else {
		this.css("padding-top", "20px");
		this.css("padding-bottom", "20px");
		this.css("padding-left", (gap / 2) + "px", true);
		this.css("padding-right", (gap / 2) + "px", true);
		this.css(COLUMN_AXIS, "horizontal");
	}

	this.css("box-sizing", "border-box");
	this.css("max-width", "inherit");

	this.css(COLUMN_FILL, "auto");

	this.css(COLUMN_GAP, gap + "px");
	this.css(COLUMN_WIDTH, columnWidth + "px");

	// Fix glyph clipping in WebKit
	// https://github.com/futurepress/epub.js/issues/983
	this.css("-webkit-line-box-contain", "block glyphs replaced");
}

/**
 * Scale contents from center
 * @param {number} scale
 * @param {number} offsetX
 * @param {number} offsetY
 */
export function scaler(scale, offsetX?, offsetY?) {
	var tx = isNumber(offsetX) ? offsetX : 0;
	var ty = isNumber(offsetY) ? offsetY : 0;
	this.css("transform-origin", "top left");
	this.css("transform", "matrix(" + scale + ", 0, 0, " + scale + ", " + tx + ", " + ty + ")");
}

/**
 * Fit contents into a fixed width and height
 * @param {number} width
 * @param {number} height
 */
export function fit(width, height, section, viewportOverride, zoom) {
	const resolveDimension = (value) => {
		const num = typeof value === "number" ? value : parseFloat(value);
		if (!isFinite(num) || num <= 0) {
			return;
		}
		return num;
	};

	const parseViewportString = (value) => {
		if (!value || typeof value !== "string") {
			return;
		}

		const entries = value.split(/[,;\s]/).filter(Boolean).map((part) => {
			return part.split("=").map((token) => token.trim());
		});

		const viewport = {};
		for (let i = 0; i < entries.length; i += 1) {
			const entry = entries[i];
			if (!entry || entry.length < 2) {
				continue;
			}
			viewport[entry[0]] = entry.slice(1).join("=");
		}

		return viewport;
	};

	let viewportWidth;
	let viewportHeight;

	const docEl = this.document && this.document.documentElement;
	if (docEl && docEl.localName === "svg") {
		const viewBox = docEl.getAttribute && docEl.getAttribute("viewBox");
		if (viewBox) {
			const parts = viewBox.split(/\s+/);
			if (parts.length >= 4) {
				viewportWidth = resolveDimension(parts[2]);
				viewportHeight = resolveDimension(parts[3]);
			}
		}
	}

	if (!viewportWidth || !viewportHeight) {
		const viewportMeta = this.viewport();
		viewportWidth = resolveDimension(viewportMeta && viewportMeta.width);
		viewportHeight = resolveDimension(viewportMeta && viewportMeta.height);
	}

	if ((!viewportWidth || !viewportHeight) && viewportOverride) {
		const parsed = typeof viewportOverride === "string" ? parseViewportString(viewportOverride) : viewportOverride;
		viewportWidth = viewportWidth || resolveDimension(parsed && parsed.width);
		viewportHeight = viewportHeight || resolveDimension(parsed && parsed.height);
	}

	if (!viewportWidth || !viewportHeight) {
		const img = this.document && this.document.querySelector && this.document.querySelector("img");
		if (img) {
			const naturalWidth = resolveDimension(img.naturalWidth);
			const naturalHeight = resolveDimension(img.naturalHeight);
			viewportWidth = viewportWidth || naturalWidth || resolveDimension(img.getAttribute && img.getAttribute("width"));
			viewportHeight = viewportHeight || naturalHeight || resolveDimension(img.getAttribute && img.getAttribute("height"));
		}
	}

	if (!viewportWidth || !viewportHeight) {
		viewportWidth = 1000;
		viewportHeight = 2000;
	}

	const widthScale = width / viewportWidth;
	const heightScale = height / viewportHeight;
	const fitPageScale = Math.min(widthScale, heightScale);

	let scale;
	if (typeof zoom === "number" && isFinite(zoom) && zoom > 0) {
		scale = zoom;
	} else if (zoom === "fit-width") {
		scale = widthScale;
	} else {
		scale = fitPageScale;
	}

	const scaledWidth = viewportWidth * scale;
	const scaledHeight = viewportHeight * scale;

	let offsetX = Math.floor((width - scaledWidth) / 2);
	let offsetY = Math.floor((height - scaledHeight) / 2);

	if (section && section.properties && section.properties.includes("page-spread-left")) {
		offsetX = 0;
	} else if (section && section.properties && section.properties.includes("page-spread-right")) {
		offsetX = Math.floor(width - scaledWidth);
	}

	offsetX = Math.max(0, offsetX);
	offsetY = Math.max(0, offsetY);

	this.layoutStyle("paginated");

	// scale needs width and height to be set
	this.width(viewportWidth);
	this.height(viewportHeight);
	this.overflow(scale > fitPageScale ? "auto" : "hidden");

	// Scale to the correct size
	this.scaler(scale, offsetX, offsetY);

	// background images are not scaled by transform
	this.css("background-size", scaledWidth + "px " + scaledHeight + "px");

	this.css("background-color", "transparent");
}

