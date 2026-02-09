import { defer, isFloat } from "../utils/core";
import { EVENTS } from "../utils/constants";

/**
 * Display a point in the book
 * The request will be added to the rendering Queue,
 * so it will wait until book is opened, rendering started
 * and all other rendering tasks have finished to be called.
 * @param  {string} target Url or EpubCFI
 * @return {Promise}
 */
export function display(target){
	if (this.displaying) {
		this.displaying.resolve();
	}
	return this.q.enqueue(this._display, target);
}

/**
 * Tells the manager what to display immediately
 * @private
 * @param  {string} target Url or EpubCFI
 * @return {Promise}
 */
export function _display(target){
	if (!this.book) {
		return;
	}
	var isCfiString = this.epubcfi.isCfiString(target);
	var displaying = new defer();
	var displayed = displaying.promise;
	var section;
	var moveTo;

	this.displaying = displaying;

	// Check if this is a book percentage
	if (this.book.locations.length() && !isCfiString) {
		if (typeof target === "string" && target.indexOf("%") === target.length - 1) {
			let percentValue = parseFloat(target);
			if (!isNaN(percentValue)) {
				target = this.book.locations.cfiFromPercentage(percentValue / 100);
			}
		} else if (isFloat(target)) {
			target = this.book.locations.cfiFromPercentage(parseFloat(target));
		}
	}

	this._hasRequestedDisplay = true;
	this._lastRequestedTarget = target;

	section = this.book.spine.get(target);

	if(!section){
		displaying.reject(new Error("No Section Found"));
		return displayed;
	}

	if (this.book && typeof this.book.cancelPrefetch === "function") {
		this.book.cancelPrefetch();
	}

	this.manager.display(section, target)
		.then(() => {
			displaying.resolve(section);
			this.displaying = undefined;

			/**
			 * Emit that a section has been displayed
			 * @event displayed
			 * @param {Section} section
			 * @memberof Rendition
			 */
			this.emit(EVENTS.RENDITION.DISPLAYED, section);
			this.reportLocation();
		}, (err) => {
			/**
			 * Emit that has been an error displaying
			 * @event displayError
			 * @param {Section} section
			 * @memberof Rendition
			 */
			this.emit(EVENTS.RENDITION.DISPLAY_ERROR, err);
		});

	return displayed;
}

