import EpubCFI from "../epubcfi";
import { EVENTS, DOM_EVENTS } from "../utils/constants";

/**
 * Pass the events from a view's Contents
 * @private
 * @param  {Contents} view contents
 */
export function passEvents(contents){
	DOM_EVENTS.forEach((e) => {
		contents.on(e, (ev) => this.triggerViewEvent(ev, contents));
	});

	contents.on(EVENTS.CONTENTS.SELECTED, (e) => this.triggerSelectedEvent(e, contents));
}

/**
 * Emit events passed by a view
 * @private
 * @param  {event} e
 */
export function triggerViewEvent(e, contents){
	this.emit(e.type, e, contents);
}

/**
 * Emit a selection event's CFI Range passed from a a view
 * @private
 * @param  {string} cfirange
 */
export function triggerSelectedEvent(cfirange, contents){
	/**
	 * Emit that a text selection has occurred
	 * @event selected
	 * @param {string} cfirange
	 * @param {Contents} contents
	 * @memberof Rendition
	 */
	this.emit(EVENTS.RENDITION.SELECTED, cfirange, contents);
}

/**
 * Emit a markClicked event with the cfiRange and data from a mark
 * @private
 * @param  {EpubCFI} cfirange
 */
export function triggerMarkEvent(cfiRange, data, contents){
	/**
	 * Emit that a mark was clicked
	 * @event markClicked
	 * @param {EpubCFI} cfirange
	 * @param {object} data
	 * @param {Contents} contents
	 * @memberof Rendition
	 */
	this.emit(EVENTS.RENDITION.MARK_CLICKED, cfiRange, data, contents);
}

/**
 * Get a Range from a Visible CFI
 * @param  {string} cfi EpubCfi String
 * @param  {string} ignoreClass
 * @return {range}
 */
export function getRange(cfi, ignoreClass){
	var _cfi = new EpubCFI(cfi);
	var found = this.manager.visible().filter(function (view) {
		if(_cfi.spinePos === view.index) return true;
	});

	// Should only every return 1 item
	if (found.length) {
		return found[0].contents.range(_cfi, ignoreClass);
	}
}

/**
 * Hook to adjust images to fit in columns
 * @param  {Contents} contents
 * @private
 */
export function adjustImages(contents) {
	if (this._layout.name === "pre-paginated") {
		return new Promise(function(resolve){
			resolve();
		});
	}

	let computed = contents.window.getComputedStyle(contents.content, null);
	let height = (contents.content.offsetHeight - (parseFloat(computed.paddingTop) + parseFloat(computed.paddingBottom))) * .95;
	let horizontalPadding = parseFloat(computed.paddingLeft) + parseFloat(computed.paddingRight);

	contents.addStylesheetRules({
		"img" : {
			"max-width": (this._layout.columnWidth ? (this._layout.columnWidth - horizontalPadding) + "px" : "100%") + "!important",
			"max-height": height + "px" + "!important",
			"object-fit": "contain",
			"page-break-inside": "avoid",
			"break-inside": "avoid",
			"box-sizing": "border-box"
		},
		"figure" : {
			"page-break-inside": "avoid",
			"break-inside": "avoid"
		},
		"svg" : {
			"max-width": (this._layout.columnWidth ? (this._layout.columnWidth - horizontalPadding) + "px" : "100%") + "!important",
			"max-height": height + "px" + "!important",
			"page-break-inside": "avoid",
			"break-inside": "avoid"
		}
	});

	return new Promise(function(resolve, reject){
		// Wait to apply
		setTimeout(function() {
			resolve();
		}, 1);
	});
}

