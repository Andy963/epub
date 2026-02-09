import { EVENTS } from "../utils/constants";

/**
 * Report resize events and display the last seen location
 * @private
 */
export function onResized(size, epubcfi){
	/**
	 * Emit that the rendition has been resized
	 * @event resized
	 * @param {number} width
	 * @param {height} height
	 * @param {string} epubcfi (optional)
	 * @memberof Rendition
	 */
	this.emit(EVENTS.RENDITION.RESIZED, {
		width: size.width,
		height: size.height
	}, epubcfi);

	let hasTarget = false;
	let target = epubcfi;

	if (typeof target !== "undefined") {
		hasTarget = true;
	} else if (this.location && this.location.start) {
		target = this.location.start.cfi;
		hasTarget = true;
	} else if (this._hasRequestedDisplay) {
		target = this._lastRequestedTarget;
		hasTarget = true;
	}

	if (hasTarget) {
		this.display(target);
	}
}

/**
 * Report orientation events and display the last seen location
 * @private
 */
export function onOrientationChange(orientation){
	/**
	 * Emit that the rendition has been rotated
	 * @event orientationchange
	 * @param {string} orientation
	 * @memberof Rendition
	 */
	this.emit(EVENTS.RENDITION.ORIENTATION_CHANGE, orientation);
}

/**
 * Move the Rendition to a specific offset
 * Usually you would be better off calling display()
 * @param {object} offset
 */
export function moveTo(offset){
	this.manager.moveTo(offset);
}

/**
 * Trigger a resize of the views
 * @param {number} [width]
 * @param {number} [height]
 * @param {string} [epubcfi] (optional)
 */
export function resize(width, height, epubcfi){
	if (width) {
		this.settings.width = width;
	}
	if (height) {
		this.settings.height = height;
	}
	this.manager.resize(width, height, epubcfi);
}

/**
 * Clear all rendered views
 */
export function clear(){
	this.manager.clear();
}

/**
 * Go to the next "page" in the rendition
 * @return {Promise}
 */
export function next(){
	return this.q.enqueue(this.manager.next.bind(this.manager))
		.then(this.reportLocation.bind(this));
}

/**
 * Go to the previous "page" in the rendition
 * @return {Promise}
 */
export function prev(){
	return this.q.enqueue(this.manager.prev.bind(this.manager))
		.then(this.reportLocation.bind(this));
}

/**
 * Get the Contents object of each rendered view
 * @returns {Contents[]}
 */
export function getContents () {
	return this.manager ? this.manager.getContents() : [];
}

/**
 * Get the views member from the manager
 * @returns {Views}
 */
export function views () {
	let views = this.manager ? this.manager.views : undefined;
	return views || [];
}

/**
 * Remove and Clean Up the Rendition
 */
export function destroy(){
	// Clear the queue
	// this.q.clear();
	// this.q = undefined;

	this.manager && this.manager.destroy();

	this.book = undefined;

	// this.views = null;

	// this.hooks.display.clear();
	// this.hooks.serialize.clear();
	// this.hooks.content.clear();
	// this.hooks.layout.clear();
	// this.hooks.render.clear();
	// this.hooks.show.clear();
	// this.hooks = {};

	// this.themes.destroy();
	// this.themes = undefined;

	// this.epubcfi = undefined;

	// this.starting = undefined;
	// this.started = undefined;
}

