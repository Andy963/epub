/**
 * Set the layoutStyle of the content
 * @param {string} [style="paginated"] "scrolling" | "paginated"
 * @private
 */
export function layoutStyle(style?) {
	if (style) {
		this._layoutStyle = style;
		(navigator as any).epubReadingSystem.layoutStyle = this._layoutStyle;
	}

	return this._layoutStyle || "paginated";
}

/**
 * Add the epubReadingSystem object to the navigator
 * @param {string} name
 * @param {string} version
 * @private
 */
export function epubReadingSystem(name, version) {
	(navigator as any).epubReadingSystem = {
		name: name,
		version: version,
		layoutStyle: this.layoutStyle(),
		hasFeature: function (feature) {
			switch (feature) {
				case "dom-manipulation":
					return true;
				case "layout-changes":
					return true;
				case "touch-events":
					return true;
				case "mouse-events":
					return true;
				case "keyboard-events":
					return true;
				case "spine-scripting":
					return false;
				default:
					return false;
			}
		}
	};
	return (navigator as any).epubReadingSystem;
}

