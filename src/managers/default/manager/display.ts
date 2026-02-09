import { extend, defer, isNumber } from "../../../utils/core";
import { EVENTS } from "../../../utils/constants";

export function createView(section, forceRight?) {
	return new this.View(section, extend(this.viewSettings, { forceRight }));
}

export function handleNextPrePaginated(forceRight, section, action) {
	let next;

	if (this.layout.name === "pre-paginated" && this.layout.divisor > 1) {
		if (
			forceRight ||
			section.index === 0 ||
			(section &&
				section.properties &&
				section.properties.includes("page-spread-center"))
		) {
			// First page (cover) should stand alone for pre-paginated books
			return;
		}
		next = section.next();
		if (next && !next.properties.includes("page-spread-left")) {
			return action.call(this, next);
		}
	}
}

export function display(section, target?) {
	var displaying = new defer();
	var displayed = displaying.promise;

	// Check if moving to target is needed
	if (target === section.href || isNumber(target)) {
		target = undefined;
	}

	// Check to make sure the section we want isn't already shown
	var visible = this.views.find(section);

	// View is already shown, just move to correct location in view
	if (visible && section && this.layout.name !== "pre-paginated") {
		let offset = visible.offset();

		if (this.settings.direction === "ltr") {
			this.scrollTo(offset.left, offset.top, true);
		} else {
			let width = visible.width();
			this.scrollTo(offset.left + width, offset.top, true);
		}

		if (target) {
			let offset = visible.locationOf(target);
			let width = visible.width();
			this.moveTo(offset, width);
		}

		displaying.resolve();
		this._pendingDisplayTarget = undefined;
		return displayed;
	}

	// Hide all current views
	this.clear();

	let forceRight = false;
	if (
		this.layout.name === "pre-paginated" &&
		this.layout.divisor === 2 &&
		section.properties.includes("page-spread-right")
	) {
		forceRight = true;
	}

	this.add(section, forceRight)
		.then(
			function (view) {
				// Move to correct place within the section, if needed
				if (target) {
					let offset = view.locationOf(target);
					let width = view.width();
					this.moveTo(offset, width);
				}
			}.bind(this),
			(err) => {
				displaying.reject(err);
			}
		)
		.then(
			function () {
				return this.handleNextPrePaginated(forceRight, section, this.add);
			}.bind(this)
		)
		.then(
			function () {
				this.views.show();

				displaying.resolve();
			}.bind(this)
		);

	if (target) {
		this._pendingDisplayTarget = {
			sectionIndex: section.index,
			target,
			remaining: 1,
		};
	} else {
		this._pendingDisplayTarget = undefined;
	}
	// .then(function(){
	// 	return this.hooks.display.trigger(view);
	// }.bind(this))
	// .then(function(){
	// 	this.views.show();
	// }.bind(this));
	return displayed;
}

export function afterDisplayed(view) {
	this.emit(EVENTS.MANAGERS.ADDED, view);
}

export function afterResized(view) {
	if (
		this._pendingDisplayTarget &&
		view &&
		view.section &&
		view.section.index === this._pendingDisplayTarget.sectionIndex &&
		typeof view.locationOf === "function"
	) {
		let offset = view.locationOf(this._pendingDisplayTarget.target);
		let width = typeof view.width === "function" ? view.width() : undefined;

		if (offset) {
			this.moveTo(offset, width);
		}

		if (this._pendingDisplayTarget.remaining > 1) {
			this._pendingDisplayTarget.remaining -= 1;
		} else {
			this._pendingDisplayTarget = undefined;
		}
	}

	this.emit(EVENTS.MANAGERS.RESIZE, view.section);
}

export function moveTo(offset, width) {
	var distX = 0,
		distY = 0;

	if (!this.isPaginated) {
		distY = offset.top;
	} else {
		distX = Math.floor(offset.left / this.layout.delta) * this.layout.delta;

		if (distX + this.layout.delta > this.container.scrollWidth) {
			distX = this.container.scrollWidth - this.layout.delta;
		}

		distY = Math.floor(offset.top / this.layout.delta) * this.layout.delta;

		if (distY + this.layout.delta > this.container.scrollHeight) {
			distY = this.container.scrollHeight - this.layout.delta;
		}
	}
	if (this.settings.direction === "rtl") {
		/***
				the `floor` function above (L343) is on positive values, so we should add one `layout.delta`
				to distX or use `Math.ceil` function, or multiply offset.left by -1
				before `Math.floor`
			*/
		distX = distX + this.layout.delta;
		distX = distX - width;
	}
	this.scrollTo(distX, distY, true);
}

export function add(section, forceRight) {
	var view = this.createView(section, forceRight);

	this.views.append(view);

	// view.on(EVENTS.VIEWS.SHOWN, this.afterDisplayed.bind(this));
	view.onDisplayed = this.afterDisplayed.bind(this);
	view.onResize = this.afterResized.bind(this);

	view.on(EVENTS.VIEWS.AXIS, (axis) => {
		this.updateAxis(axis);
	});

	view.on(EVENTS.VIEWS.WRITING_MODE, (mode) => {
		this.updateWritingMode(mode);
	});

	return view.display(this.request);
}

export function append(section, forceRight) {
	var view = this.createView(section, forceRight);
	this.views.append(view);

	view.onDisplayed = this.afterDisplayed.bind(this);
	view.onResize = this.afterResized.bind(this);

	view.on(EVENTS.VIEWS.AXIS, (axis) => {
		this.updateAxis(axis);
	});

	view.on(EVENTS.VIEWS.WRITING_MODE, (mode) => {
		this.updateWritingMode(mode);
	});

	return view.display(this.request);
}

export function prepend(section, forceRight) {
	var view = this.createView(section, forceRight);

	view.on(EVENTS.VIEWS.RESIZED, (bounds) => {
		this.counter(bounds);
	});

	this.views.prepend(view);

	view.onDisplayed = this.afterDisplayed.bind(this);
	view.onResize = this.afterResized.bind(this);

	view.on(EVENTS.VIEWS.AXIS, (axis) => {
		this.updateAxis(axis);
	});

	view.on(EVENTS.VIEWS.WRITING_MODE, (mode) => {
		this.updateWritingMode(mode);
	});

	return view.display(this.request);
}

export function counter(bounds) {
	if (this.settings.axis === "vertical") {
		this.scrollBy(0, bounds.heightDelta, true);
	} else {
		this.scrollBy(bounds.widthDelta, 0, true);
	}
}

