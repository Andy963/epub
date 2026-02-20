import { requestAnimationFrame } from "../../utils/core";
import Snap from "../helpers/snap";
import { EVENTS } from "../../utils/constants";
import debounce from "lodash/debounce";

export function addEventListeners(stage?) {
	this._onUnload = () => {
		this.ignore = true;
		// this.scrollTo(0,0);
		this.destroy();
	};
	window.addEventListener("unload", this._onUnload);

	this.addScrollListeners();

	if (this.isPaginated && this.settings.snap) {
		this.snapper = new Snap(this, this.settings.snap && typeof this.settings.snap === "object" && this.settings.snap);
	}
}

export function addScrollListeners() {
	var scroller;

	this.tick = requestAnimationFrame;

	let dir = this.settings.direction === "rtl" && this.settings.rtlScrollType === "default" ? -1 : 1;

	this.scrollDeltaVert = 0;
	this.scrollDeltaHorz = 0;

	if (!this.settings.fullsize) {
		scroller = this.container;
		this.scrollTop = this.container.scrollTop;
		this.scrollLeft = this.container.scrollLeft;
	} else {
		scroller = window;
		this.scrollTop = window.scrollY * dir;
		this.scrollLeft = window.scrollX * dir;
	}

	this._onScroll = this.onScroll.bind(this);
	scroller.addEventListener("scroll", this._onScroll);
	this._scrolled = debounce(this.scrolled.bind(this), 30);
	// this.tick.call(window, this.onScroll.bind(this));

	this.didScroll = false;
}

export function removeEventListeners() {
	var scroller;

	if (!this.settings.fullsize) {
		scroller = this.container;
	} else {
		scroller = window;
	}

	if (this._onUnload) {
		window.removeEventListener("unload", this._onUnload);
		this._onUnload = undefined;
	}

	scroller.removeEventListener("scroll", this._onScroll);
	this._onScroll = undefined;
}

export function onScroll() {
	let scrollTop;
	let scrollLeft;
	let dir = this.settings.direction === "rtl" && this.settings.rtlScrollType === "default" ? -1 : 1;

	if (!this.settings.fullsize) {
		scrollTop = this.container.scrollTop;
		scrollLeft = this.container.scrollLeft;
	} else {
		scrollTop = window.scrollY * dir;
		scrollLeft = window.scrollX * dir;
	}

	this.scrollTop = scrollTop;
	this.scrollLeft = scrollLeft;

	if (!this.ignore) {
		this._scrolled();
	} else {
		this.ignore = false;
	}

	this.scrollDeltaVert += Math.abs(scrollTop - this.prevScrollTop);
	this.scrollDeltaHorz += Math.abs(scrollLeft - this.prevScrollLeft);

	this.prevScrollTop = scrollTop;
	this.prevScrollLeft = scrollLeft;

	clearTimeout(this.scrollTimeout);
	this.scrollTimeout = setTimeout(
		function () {
			this.scrollDeltaVert = 0;
			this.scrollDeltaHorz = 0;
		}.bind(this),
		150,
	);

	clearTimeout(this.afterScrolled);

	this.didScroll = false;
}

export function scrolled() {
	this.q.enqueue(
		function () {
			return this.check();
		}.bind(this),
	);

	this.emit(EVENTS.MANAGERS.SCROLL, {
		top: this.scrollTop,
		left: this.scrollLeft,
	});

	clearTimeout(this.afterScrolled);
	this.afterScrolled = setTimeout(
		function () {
			// Don't report scroll if we are about the snap
			if (this.snapper && this.snapper.supportsTouch && this.snapper.needsSnap()) {
				return;
			}

			this.emit(EVENTS.MANAGERS.SCROLLED, {
				top: this.scrollTop,
				left: this.scrollLeft,
			});
		}.bind(this),
		this.settings.afterScrolledTimeout,
	);
}

export function next() {
	let delta =
		this.layout.props.name === "pre-paginated" && this.layout.props.spread
			? this.layout.props.delta * 2
			: this.layout.props.delta;

	if (!this.views.length) return;

	if (this.isPaginated && this.settings.axis === "horizontal") {
		this.scrollBy(delta, 0, true);
	} else {
		this.scrollBy(0, this.layout.height, true);
	}

	this.q.enqueue(
		function () {
			return this.check();
		}.bind(this),
	);
}

export function prev() {
	let delta =
		this.layout.props.name === "pre-paginated" && this.layout.props.spread
			? this.layout.props.delta * 2
			: this.layout.props.delta;

	if (!this.views.length) return;

	if (this.isPaginated && this.settings.axis === "horizontal") {
		this.scrollBy(-delta, 0, true);
	} else {
		this.scrollBy(0, -this.layout.height, true);
	}

	this.q.enqueue(
		function () {
			return this.check();
		}.bind(this),
	);
}

