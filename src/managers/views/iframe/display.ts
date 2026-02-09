import { bounds, defer } from "../../../utils/core";
import { EVENTS } from "../../../utils/constants";

export function addListeners() {
	//TODO: Add content listeners for expanding
}

export function removeListeners(layoutFunc?) {
	//TODO: remove content listeners for expanding
}

export function display(request) {
	var displayed = new defer();

	if (!this.displayed) {

		this.render(request)
			.then(function () {

				this.emit(EVENTS.VIEWS.DISPLAYED, this);
				this.onDisplayed(this);

				this.displayed = true;
				displayed.resolve(this);

				}.bind(this), function (err) {
					displayed.reject(err);
				});

		} else {
		displayed.resolve(this);
	}


	return displayed.promise;
}

export function show() {
	this.element.style.visibility = "visible";

	if(this.iframe){
		this.iframe.style.visibility = "visible";

		// Remind Safari to redraw the iframe
		this.iframe.style.transform = "translateZ(0)";
		this.iframe.offsetWidth;
		this.iframe.style.transform = null;
	}

	this.emit(EVENTS.VIEWS.SHOWN, this);
}

export function hide() {
	// this.iframe.style.display = "none";
	this.element.style.visibility = "hidden";
	this.iframe.style.visibility = "hidden";

	this.stopExpanding = true;
	this.emit(EVENTS.VIEWS.HIDDEN, this);
}

export function offset() {
	return {
		top: this.element.offsetTop,
		left: this.element.offsetLeft
	}
}

export function width() {
	return this._width;
}

export function height() {
	return this._height;
}

export function position() {
	return this.element.getBoundingClientRect();
}

export function locationOf(target) {
	var parentPos = this.iframe.getBoundingClientRect();
	var targetPos = this.contents.locationOf(target, this.settings.ignoreClass);

	return {
		"left": targetPos.left,
		"top": targetPos.top
	};
}

export function onDisplayed(view) {
	// Stub, override with a custom functions
}

export function onResize(view, e) {
	// Stub, override with a custom functions
}

export function viewBounds(force) {
	if(force || !this.elementBounds) {
		this.elementBounds = bounds(this.element);
	}

	return this.elementBounds;
}

