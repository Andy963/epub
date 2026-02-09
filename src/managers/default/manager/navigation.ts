export function next() {
	var next;
	var left;

	let dir = this.settings.direction;

	if (!this.views.length) return;

	if (this.isPaginated && this.settings.axis === "horizontal" && (!dir || dir === "ltr")) {
		this.scrollLeft = this.container.scrollLeft;

		left = this.container.scrollLeft + this.container.offsetWidth + this.layout.delta;

		if (left <= this.container.scrollWidth) {
			this.scrollBy(this.layout.delta, 0, true);
		} else {
			next = this.views.last().section.next();
		}
	} else if (this.isPaginated && this.settings.axis === "horizontal" && dir === "rtl") {
		this.scrollLeft = this.container.scrollLeft;

		if (this.settings.rtlScrollType === "default") {
			left = this.container.scrollLeft;

			if (left > 0) {
				this.scrollBy(this.layout.delta, 0, true);
			} else {
				next = this.views.last().section.next();
			}
		} else {
			left = this.container.scrollLeft + this.layout.delta * -1;

			if (left > this.container.scrollWidth * -1) {
				this.scrollBy(this.layout.delta, 0, true);
			} else {
				next = this.views.last().section.next();
			}
		}
	} else if (this.isPaginated && this.settings.axis === "vertical") {
		this.scrollTop = this.container.scrollTop;

		let top = this.container.scrollTop + this.container.offsetHeight;

		if (top < this.container.scrollHeight) {
			this.scrollBy(0, this.layout.height, true);
		} else {
			next = this.views.last().section.next();
		}
	} else {
		next = this.views.last().section.next();
	}

	if (next) {
		this.clear();
		// The new section may have a different writing-mode from the old section. Thus, we need to update layout.
		this.updateLayout();

		let forceRight = false;
		if (
			this.layout.name === "pre-paginated" &&
			this.layout.divisor === 2 &&
			next.properties.includes("page-spread-right")
		) {
			forceRight = true;
		}

		return this.append(next, forceRight)
			.then(
				function () {
					return this.handleNextPrePaginated(forceRight, next, this.append);
				}.bind(this),
				(err) => {
					return err;
				}
			)
			.then(
				function () {
					// Reset position to start for scrolled-doc vertical-rl in default mode
					if (
						!this.isPaginated &&
						this.settings.axis === "horizontal" &&
						this.settings.direction === "rtl" &&
						this.settings.rtlScrollType === "default"
					) {
						this.scrollTo(this.container.scrollWidth, 0, true);
					}
					this.views.show();
				}.bind(this)
			);
	}
}

export function prev() {
	var prev;
	var left;
	let dir = this.settings.direction;

	if (!this.views.length) return;

	if (this.isPaginated && this.settings.axis === "horizontal" && (!dir || dir === "ltr")) {
		this.scrollLeft = this.container.scrollLeft;

		left = this.container.scrollLeft;

		if (left > 0) {
			this.scrollBy(-this.layout.delta, 0, true);
		} else {
			prev = this.views.first().section.prev();
		}
	} else if (this.isPaginated && this.settings.axis === "horizontal" && dir === "rtl") {
		this.scrollLeft = this.container.scrollLeft;

		if (this.settings.rtlScrollType === "default") {
			left = this.container.scrollLeft + this.container.offsetWidth;

			if (left < this.container.scrollWidth) {
				this.scrollBy(-this.layout.delta, 0, true);
			} else {
				prev = this.views.first().section.prev();
			}
		} else {
			left = this.container.scrollLeft;

			if (left < 0) {
				this.scrollBy(-this.layout.delta, 0, true);
			} else {
				prev = this.views.first().section.prev();
			}
		}
	} else if (this.isPaginated && this.settings.axis === "vertical") {
		this.scrollTop = this.container.scrollTop;

		let top = this.container.scrollTop;

		if (top > 0) {
			this.scrollBy(0, -this.layout.height, true);
		} else {
			prev = this.views.first().section.prev();
		}
	} else {
		prev = this.views.first().section.prev();
	}

	if (prev) {
		this.clear();
		// The new section may have a different writing-mode from the old section. Thus, we need to update layout.
		this.updateLayout();

		let forceRight = false;
		if (this.layout.name === "pre-paginated" && this.layout.divisor === 2 && typeof prev.prev() !== "object") {
			forceRight = true;
		}

		return this.prepend(prev, forceRight)
			.then(
				function () {
					var left;
					if (this.layout.name === "pre-paginated" && this.layout.divisor > 1) {
						left = prev.prev();
						if (left) {
							return this.prepend(left);
						}
					}
				}.bind(this),
				(err) => {
					return err;
				}
			)
			.then(
				function () {
					if (this.isPaginated && this.settings.axis === "horizontal") {
						if (this.settings.direction === "rtl") {
							if (this.settings.rtlScrollType === "default") {
								this.scrollTo(0, 0, true);
							} else {
								this.scrollTo((this.container.scrollWidth * -1) + this.layout.delta, 0, true);
							}
						} else {
							this.scrollTo(this.container.scrollWidth - this.layout.delta, 0, true);
						}
					}
					this.views.show();
				}.bind(this)
			);
	}
}

export function current() {
	var visible = this.visible();
	if (visible.length) {
		// Current is the last visible view
		return visible[visible.length - 1];
	}
	return null;
}

