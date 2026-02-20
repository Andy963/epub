import { defer } from "../../utils/core";
import DefaultViewManager from "../default";

export function display(section, target) {
	return DefaultViewManager.prototype.display.call(this, section, target).then(
		function () {
			return this.fill();
		}.bind(this),
	);
}

export function fill(_full) {
	var full = _full || new defer();

	this.q
		.enqueue(() => {
			return this.check();
		})
		.then((result) => {
			if (result) {
				this.fill(full);
			} else {
				full.resolve();
			}
		});

	return full.promise;
}

export function moveTo(offset) {
	// var bounds = this.stage.bounds();
	// var dist = Math.floor(offset.top / bounds.height) * bounds.height;
	var distX = 0,
		distY = 0;

	var offsetX = 0,
		offsetY = 0;

	if (!this.isPaginated) {
		distY = offset.top;
		offsetY = offset.top + this.settings.offsetDelta;
	} else {
		distX = Math.floor(offset.left / this.layout.delta) * this.layout.delta;
		offsetX = distX + this.settings.offsetDelta;
	}

	if (distX > 0 || distY > 0) {
		this.scrollBy(distX, distY, true);
	}
}

export function update(_offset) {
	var container = this.bounds();
	var views = this.views.all();
	var viewsLength = views.length;
	var visible = [];
	var offset = typeof _offset != "undefined" ? _offset : this.settings.offset || 0;
	var isVisible;
	var view;

	var updating = new defer();
	var promises = [];
	for (var i = 0; i < viewsLength; i++) {
		view = views[i];

		isVisible = this.isVisible(view, offset, offset, container);

		if (isVisible === true) {
			// console.log("visible " + view.index, view.displayed);

			if (!view.displayed) {
				let displayed = view.display(this.request).then(
					function (view) {
						view.show();
					},
					(err) => {
						view.hide();
					},
				);
				promises.push(displayed);
			} else {
				view.show();
			}
			visible.push(view);
		} else {
			this.q.enqueue(view.destroy.bind(view));
			// console.log("hidden " + view.index, view.displayed);

			clearTimeout(this.trimTimeout);
			this.trimTimeout = setTimeout(
				function () {
					this.q.enqueue(this.trim.bind(this));
				}.bind(this),
				250,
			);
		}
	}

	if (promises.length) {
		return Promise.all(promises).catch((err) => {
			updating.reject(err);
		});
	} else {
		updating.resolve();
		return updating.promise;
	}
}

export function check(_offsetLeft?, _offsetTop?) {
	var checking = new defer();
	var newViews = [];

	var horizontal = this.settings.axis === "horizontal";
	var delta = this.settings.offset || 0;

	if (_offsetLeft && horizontal) {
		delta = _offsetLeft;
	}

	if (_offsetTop && !horizontal) {
		delta = _offsetTop;
	}

	var bounds = this._bounds; // bounds saved this until resize

	let offset = horizontal ? this.scrollLeft : this.scrollTop;
	let visibleLength = horizontal ? Math.floor(bounds.width) : bounds.height;
	let contentLength = horizontal ? this.container.scrollWidth : this.container.scrollHeight;
	let writingMode =
		this.writingMode && this.writingMode.indexOf("vertical") === 0 ? "vertical" : "horizontal";
	let rtlScrollType = this.settings.rtlScrollType;
	let rtl = this.settings.direction === "rtl";

	if (!this.settings.fullsize) {
		// Scroll offset starts at width of element
		if (rtl && rtlScrollType === "default" && writingMode === "horizontal") {
			offset = contentLength - visibleLength - offset;
		}
		// Scroll offset starts at 0 and goes negative
		if (rtl && rtlScrollType === "negative" && writingMode === "horizontal") {
			offset = offset * -1;
		}
	} else {
		// Scroll offset starts at 0 and goes negative
		if (
			(horizontal && rtl && rtlScrollType === "negative") ||
			(!horizontal && rtl && rtlScrollType === "default")
		) {
			offset = offset * -1;
		}
	}

	let prepend = () => {
		let first = this.views.first();
		let prev = first && first.section.prev();

		if (prev) {
			newViews.push(this.prepend(prev));
		}
	};

	let append = () => {
		let last = this.views.last();
		let next = last && last.section.next();

		if (next) {
			newViews.push(this.append(next));
		}
	};

	let end = offset + visibleLength + delta;
	let start = offset - delta;

	if (end >= contentLength) {
		append();
	}

	if (start < 0) {
		prepend();
	}

	let promises = newViews.map((view) => {
		return view.display(this.request);
	});

	if (newViews.length) {
		return Promise.all(promises)
			.then(() => {
				return this.check();
			})
			.then(
				() => {
					// Check to see if anything new is on screen after rendering
					return this.update(delta);
				},
				(err) => {
					return err;
				},
			);
	} else {
		this.q.enqueue(
			function () {
				this.update();
			}.bind(this),
		);
		checking.resolve(false);
		return checking.promise;
	}
}

