import Layout from "../layout";
import { EVENTS } from "../utils/constants";

//-- http://www.idpf.org/epub/301/spec/epub-publications.html#meta-properties-rendering
/**
 * Determine the Layout properties from metadata and settings
 * @private
 * @param  {object} metadata
 * @return {object} properties
 */
export function determineLayoutProperties(metadata){
	var properties;
	var layout = this.settings.layout || metadata.layout || "reflowable";
	var spread = this.settings.spread != null ? this.settings.spread : (metadata.spread || "auto");
	var orientation = this.settings.orientation || metadata.orientation || "auto";
	var flow = this.settings.flow || metadata.flow || "auto";
	var viewport = metadata.viewport || "";
	var minSpreadWidth = this.settings.minSpreadWidth != null ? this.settings.minSpreadWidth : (metadata.minSpreadWidth || 800);
	var direction = this.settings.direction || metadata.direction || "ltr";
	var fixedLayoutZoom;

	if ((this.settings.width === 0 || this.settings.width > 0) &&
			(this.settings.height === 0 || this.settings.height > 0)) {
		// viewport = "width="+this.settings.width+", height="+this.settings.height+"";
	}

	if (this.settings.fixedLayout && typeof this.settings.fixedLayout === "object") {
		fixedLayoutZoom = this.settings.fixedLayout.zoom;
	}

	properties = {
		layout : layout,
		spread : spread,
		orientation : orientation,
		flow : flow,
		viewport : viewport,
		minSpreadWidth : minSpreadWidth,
		direction: direction,
		fixedLayoutZoom: fixedLayoutZoom
	};

	return properties;
}

/**
 * Adjust the flow of the rendition to paginated or scrolled
 * (scrolled-continuous vs scrolled-doc are handled by different view managers)
 * @param  {string} flow
 */
export function flow(flow){
	var _flow = flow;
	if (flow === "scrolled" ||
			flow === "scrolled-doc" ||
			flow === "scrolled-continuous") {
		_flow = "scrolled";
	}

	if (flow === "auto" || flow === "paginated") {
		_flow = "paginated";
	}

	this.settings.flow = flow;

	if (this._layout) {
		this._layout.flow(_flow);
	}

	if (this.manager && this._layout) {
		this.manager.applyLayout(this._layout);
	}

	if (this.manager) {
		this.manager.updateFlow(_flow);
	}

	if (this.manager && this.manager.isRendered() && this.location) {
		this.manager.clear();
		this.display(this.location.start.cfi);
	}
}

/**
 * Adjust the layout of the rendition to reflowable or pre-paginated
 * @param  {object} settings
 */
export function layout(settings){
	if (settings) {
		this._layout = new Layout(settings);
		this._layout.spread(settings.spread, this.settings.minSpreadWidth);

		// this.mapping = new Mapping(this._layout.props);

		this._layout.on(EVENTS.LAYOUT.UPDATED, (props, changed) => {
			this.emit(EVENTS.RENDITION.LAYOUT, props, changed);
		})
	}

	if (this.manager && this._layout) {
		this.manager.applyLayout(this._layout);
	}

	return this._layout;
}

/**
 * Get or set fixed layout zoom
 * @param {number | "fit-width" | "fit-page"} [zoom]
 * @returns {number | "fit-width" | "fit-page" | undefined}
 */
export function fixedLayoutZoom(zoom?) {
	if (typeof zoom !== "undefined") {
		const isValidNumber =
			typeof zoom === "number" && isFinite(zoom) && zoom > 0;
		const isValidPreset = zoom === "fit-width" || zoom === "fit-page";
		if (!isValidNumber && !isValidPreset) {
			return this.fixedLayoutZoom();
		}

		if (!this.settings.fixedLayout || typeof this.settings.fixedLayout !== "object") {
			this.settings.fixedLayout = {};
		}

		this.settings.fixedLayout.zoom = zoom;

		if (this._layout && this._layout.settings) {
			this._layout.settings.fixedLayoutZoom = zoom;
			if (typeof this._layout.update === "function") {
				this._layout.update({ fixedLayoutZoom: zoom });
			}
		}

		if (this.manager && this._layout && typeof this.manager.setLayout === "function") {
			this.manager.setLayout(this._layout);
		}
	}

	return this.settings.fixedLayout && typeof this.settings.fixedLayout === "object"
		? this.settings.fixedLayout.zoom
		: undefined;
}

/**
 * Adjust if the rendition uses spreads
 * @param  {string} spread none | auto (TODO: implement landscape, portrait, both)
 * @param  {int} [min] min width to use spreads at
 */
export function spread(spread, min){
	this.settings.spread = spread;

	if (min) {
		this.settings.minSpreadWidth = min;
	}

	if (this._layout) {
		this._layout.spread(spread, min);
	}

	if (this.manager && this.manager.isRendered()) {
		this.manager.updateLayout();
	}
}

/**
 * Adjust the direction of the rendition
 * @param  {string} dir
 */
export function direction(dir){
	this.settings.direction = dir || "ltr";

	if (this.manager) {
		this.manager.direction(this.settings.direction);
	}

	if (this.manager && this.manager.isRendered() && this.location) {
		this.manager.clear();
		this.display(this.location.start.cfi);
	}
}

