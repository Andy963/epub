import { EVENTS } from "../../../utils/constants";

export function isVisible(view, offsetPrev, offsetNext, _container) {
	var position = view.position();
	var container = _container || this.bounds();

	if (
		this.settings.axis === "horizontal" &&
		position.right > container.left - offsetPrev &&
		position.left < container.right + offsetNext
	) {
		return true;
	} else if (
		this.settings.axis === "vertical" &&
		position.bottom > container.top - offsetPrev &&
		position.top < container.bottom + offsetNext
	) {
		return true;
	}

	return false;
}

export function visible() {
	var container = this.bounds();
	var views = this.views.displayed();
	var viewsLength = views.length;
	var visible = [];
	var isVisible;
	var view;

	for (var i = 0; i < viewsLength; i++) {
		view = views[i];
		isVisible = this.isVisible(view, 0, 0, container);

		if (isVisible === true) {
			visible.push(view);
		}
	}
	return visible;
}

export function scrollBy(x, y, silent) {
	let dir = this.settings.direction === "rtl" ? -1 : 1;

	if (silent) {
		this.ignore = true;
	}

	if (!this.settings.fullsize) {
		if (x) this.container.scrollLeft += x * dir;
		if (y) this.container.scrollTop += y;
	} else {
		window.scrollBy(x * dir, y * dir);
	}
	this.scrolled = true;
}

export function scrollTo(x, y, silent) {
	if (silent) {
		this.ignore = true;
	}

	if (!this.settings.fullsize) {
		this.container.scrollLeft = x;
		this.container.scrollTop = y;
	} else {
		window.scrollTo(x, y);
	}
	this.scrolled = true;
}

export function onScroll() {
	let scrollTop;
	let scrollLeft;

	if (!this.settings.fullsize) {
		scrollTop = this.container.scrollTop;
		scrollLeft = this.container.scrollLeft;
	} else {
		scrollTop = window.scrollY;
		scrollLeft = window.scrollX;
	}

	this.scrollTop = scrollTop;
	this.scrollLeft = scrollLeft;

	if (!this.ignore) {
		this.emit(EVENTS.MANAGERS.SCROLL, {
			top: scrollTop,
			left: scrollLeft,
		});

		clearTimeout(this.afterScrolled);
		const timeout =
			typeof this.settings.afterScrolledTimeout === "number" &&
			isFinite(this.settings.afterScrolledTimeout) &&
			this.settings.afterScrolledTimeout >= 0
				? this.settings.afterScrolledTimeout
				: 20;

		this.afterScrolled = setTimeout(
			function () {
				// Don't report scroll if we are about to snap
				if (this.snapper && this.snapper.supportsTouch && this.snapper.needsSnap()) {
					return;
				}

				this.emit(EVENTS.MANAGERS.SCROLLED, {
					top: this.scrollTop,
					left: this.scrollLeft,
				});
			}.bind(this),
			timeout
		);
	} else {
		this.ignore = false;
	}
}

