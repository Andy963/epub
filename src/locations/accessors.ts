import { locationOf } from "../utils/core";
import EpubCFI from "../epubcfi";
import { EVENTS } from "../utils/constants";

/**
 * Get a location from an EpubCFI
 * @param {EpubCFI} cfi
 * @return {number}
 */
export function locationFromCfi(cfi){
	let loc;
	if (EpubCFI.prototype.isCfiString(cfi)) {
		cfi = new EpubCFI(cfi);
	}
	// Check if the location has not been set yet
	if(this._locations.length === 0) {
		return -1;
	}

	loc = locationOf(cfi, this._locations, this.epubcfi.compare);

	if (loc > this.total) {
		return this.total;
	}

	return loc;
}

/**
 * Get a percentage position in locations from an EpubCFI
 * @param {EpubCFI} cfi
 * @return {number}
 */
export function percentageFromCfi(cfi) {
	if(this._locations.length === 0) {
		return null;
	}
	// Find closest cfi
	var loc = this.locationFromCfi(cfi);
	// Get percentage in total
	return this.percentageFromLocation(loc);
}

/**
 * Get a percentage position from a location index
 * @param {number} location
 * @return {number}
 */
export function percentageFromLocation(loc) {
	if (!loc || !this.total) {
		return 0;
	}

	return (loc / this.total);
}

/**
 * Get an EpubCFI from location index
 * @param {number} loc
 * @return {EpubCFI} cfi
 */
export function cfiFromLocation(loc){
	var cfi: any = -1;
	// check that pg is an int
	if(typeof loc != "number"){
		loc = parseInt(loc);
	}

	if(loc >= 0 && loc < this._locations.length) {
		cfi = this._locations[loc];
	}

	return cfi;
}

/**
 * Get an EpubCFI from location percentage
 * @param {number} percentage
 * @return {EpubCFI} cfi
 */
export function cfiFromPercentage(percentage){
	let loc;
	if (percentage > 1) {
		console.warn("Normalize cfiFromPercentage value to between 0 - 1");
	}

	// Make sure 1 goes to very end
	if (percentage >= 1) {
		let cfi = new EpubCFI(this._locations[this.total]);
		cfi.collapse();
		return cfi.toString();
	}

	loc = Math.ceil(this.total * percentage);
	return this.cfiFromLocation(loc);
}

/**
 * Load locations from JSON
 * @param {json} locations
 */
export function load(locations){
	if (typeof locations === "string") {
		this._locations = JSON.parse(locations);
	} else {
		this._locations = locations;
	}
	this.total = this._locations.length - 1;
	return this._locations;
}

/**
 * Save locations to JSON
 * @return {json}
 */
export function save(){
	return JSON.stringify(this._locations);
}

export function getCurrent(){
	return this._current;
}

export function setCurrent(curr){
	var loc;

	if(typeof curr == "string"){
		this._currentCfi = curr;
	} else if (typeof curr == "number") {
		this._current = curr;
	} else {
		return;
	}

	if(this._locations.length === 0) {
		return;
	}

	if(typeof curr == "string"){
		loc = this.locationFromCfi(curr);
		this._current = loc;
	} else {
		loc = curr;
	}

	this.emit(EVENTS.LOCATIONS.CHANGED, {
		percentage: this.percentageFromLocation(loc)
	});
}

/**
 * Locations length
 */
export function length () {
	return this._locations.length;
}

export function destroy () {
	this.spine = undefined;
	this.request = undefined;
	this.pause = undefined;

	this.q.stop();
	this.q = undefined;
	this.epubcfi = undefined;

	this._locations = undefined
	this.total = undefined;

	this.break = undefined;
	this._current = undefined;

	this.currentLocation = undefined;
	this._currentCfi = undefined;
	clearTimeout(this.processingTimeout);

	if (this.worker) {
		this.worker.terminate();
		this.worker = undefined;
	}

	this.workerRequests.forEach((pending) => {
		pending.reject(new Error("Locations destroyed"));
	});
	this.workerRequests.clear();
	this.workerRequests = undefined;
}

