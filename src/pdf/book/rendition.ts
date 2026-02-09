import { extend } from "../../utils/core";
import Rendition from "../../rendition";

import PdfView from "../view";

export function renderTo(element, options) {
	const renditionOptions = extend({}, options || {});
	if (typeof renditionOptions.view === "undefined") {
		renditionOptions.view = PdfView;
	}
	if (typeof renditionOptions.manager === "undefined") {
		renditionOptions.manager = "continuous";
	}
	if (typeof renditionOptions.flow === "undefined") {
		renditionOptions.flow = "scrolled-continuous";
	}
	if (typeof renditionOptions.allowScriptedContent === "undefined") {
		renditionOptions.allowScriptedContent = true;
	}
	if (!renditionOptions.fixedLayout || typeof renditionOptions.fixedLayout !== "object") {
		renditionOptions.fixedLayout = { zoom: "fit-width" };
	} else if (typeof renditionOptions.fixedLayout.zoom === "undefined") {
		renditionOptions.fixedLayout.zoom = "fit-width";
	}
	if (
		typeof renditionOptions.prefetch === "undefined" &&
		typeof this.settings.prefetchDistance === "number" &&
		this.settings.prefetchDistance > 0
	) {
		renditionOptions.prefetch = Math.floor(this.settings.prefetchDistance);
	}

	this.rendition = new Rendition(this, renditionOptions);
	this.rendition.attachTo(element);
	return this.rendition;
}

