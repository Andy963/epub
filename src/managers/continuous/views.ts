import { defer } from "../../utils/core";
import { EVENTS } from "../../utils/constants";

export function afterResized(view) {
	this.emit(EVENTS.MANAGERS.RESIZE, view.section);
}

// Remove Previous Listeners if present
export function removeShownListeners(view) {
	// view.off("shown", this.afterDisplayed);
	// view.off("shown", this.afterDisplayedAbove);
	view.onDisplayed = function () {};
}

export function add(section) {
	var view = this.createView(section);

	this.views.append(view);

	view.on(EVENTS.VIEWS.RESIZED, (bounds) => {
		view.expanded = true;
	});

	view.on(EVENTS.VIEWS.AXIS, (axis) => {
		this.updateAxis(axis);
	});

	view.on(EVENTS.VIEWS.WRITING_MODE, (mode) => {
		this.updateWritingMode(mode);
	});

	// view.on(EVENTS.VIEWS.SHOWN, this.afterDisplayed.bind(this));
	view.onDisplayed = this.afterDisplayed.bind(this);
	view.onResize = this.afterResized.bind(this);

	return view.display(this.request);
}

export function append(section) {
	var view = this.createView(section);

	view.on(EVENTS.VIEWS.RESIZED, (bounds) => {
		view.expanded = true;
	});

	view.on(EVENTS.VIEWS.AXIS, (axis) => {
		this.updateAxis(axis);
	});

	view.on(EVENTS.VIEWS.WRITING_MODE, (mode) => {
		this.updateWritingMode(mode);
	});

	this.views.append(view);

	view.onDisplayed = this.afterDisplayed.bind(this);

	return view;
}

export function prepend(section) {
	var view = this.createView(section);

	view.on(EVENTS.VIEWS.RESIZED, (bounds) => {
		this.counter(bounds);
		view.expanded = true;
	});

	view.on(EVENTS.VIEWS.AXIS, (axis) => {
		this.updateAxis(axis);
	});

	view.on(EVENTS.VIEWS.WRITING_MODE, (mode) => {
		this.updateWritingMode(mode);
	});

	this.views.prepend(view);

	view.onDisplayed = this.afterDisplayed.bind(this);

	return view;
}

export function counter(bounds) {
	if (this.settings.axis === "vertical") {
		this.scrollBy(0, bounds.heightDelta, true);
	} else {
		this.scrollBy(bounds.widthDelta, 0, true);
	}
}

export function trim() {
	var task = new defer();
	var displayed = this.views.displayed();
	var first = displayed[0];
	var last = displayed[displayed.length - 1];
	var firstIndex = this.views.indexOf(first);
	var lastIndex = this.views.indexOf(last);
	var above = this.views.slice(0, firstIndex);
	var below = this.views.slice(lastIndex + 1);

	// Erase all but last above
	for (var i = 0; i < above.length - 1; i++) {
		this.erase(above[i], above);
	}

	// Erase all except first below
	for (var j = 1; j < below.length; j++) {
		this.erase(below[j]);
	}

	task.resolve();
	return task.promise;
}

export function erase(view, above?) {
	//Trim

	var prevTop;
	var prevLeft;

	if (!this.settings.fullsize) {
		prevTop = this.container.scrollTop;
		prevLeft = this.container.scrollLeft;
	} else {
		prevTop = window.scrollY;
		prevLeft = window.scrollX;
	}

	var bounds = view.bounds();

	this.views.remove(view);

	if (above) {
		if (this.settings.axis === "vertical") {
			this.scrollTo(0, prevTop - bounds.height, true);
		} else {
			if (this.settings.direction === "rtl") {
				if (!this.settings.fullsize) {
					this.scrollTo(prevLeft, 0, true);
				} else {
					this.scrollTo(prevLeft + Math.floor(bounds.width), 0, true);
				}
			} else {
				this.scrollTo(prevLeft - Math.floor(bounds.width), 0, true);
			}
		}
	}
}

