import { EVENTS } from "../utils/constants";

/**
 * Report the current location
 * @fires relocated
 * @fires locationChanged
 */
export function reportLocation(){
	return this.q.enqueue(function reportedLocation(){
		requestAnimationFrame(function reportedLocationAfterRAF() {
			var location = this.manager.currentLocation();
			if (location && location.then && typeof location.then === "function") {
				location.then(function(result) {
					let located = this.located(result);

					if (!located || !located.start || !located.end) {
						return;
					}

					this.location = located;

					this.hooks.header.trigger(this.location, this).catch(() => {
						return;
					});
					this.hooks.footer.trigger(this.location, this).catch(() => {
						return;
					});

					this.emit(EVENTS.RENDITION.LOCATION_CHANGED, {
						index: this.location.start.index,
						href: this.location.start.href,
						start: this.location.start.cfi,
						end: this.location.end.cfi,
						percentage: this.location.start.percentage
					});

					this.emit(EVENTS.RENDITION.RELOCATED, this.location);
				}.bind(this));
			} else if (location) {
				let located = this.located(location);

				if (!located || !located.start || !located.end) {
					return;
				}

				this.location = located;

				this.hooks.header.trigger(this.location, this).catch(() => {
					return;
				});
				this.hooks.footer.trigger(this.location, this).catch(() => {
					return;
				});

				/**
				 * @event locationChanged
				 * @deprecated
				 * @type {object}
				 * @property {number} index
				 * @property {string} href
				 * @property {EpubCFI} start
				 * @property {EpubCFI} end
				 * @property {number} percentage
				 * @memberof Rendition
				 */
				this.emit(EVENTS.RENDITION.LOCATION_CHANGED, {
					index: this.location.start.index,
					href: this.location.start.href,
					start: this.location.start.cfi,
					end: this.location.end.cfi,
					percentage: this.location.start.percentage
				});

				/**
				 * @event relocated
				 * @type {displayedLocation}
				 * @memberof Rendition
				 */
				this.emit(EVENTS.RENDITION.RELOCATED, this.location);
			}
		}.bind(this));
	}.bind(this));
}

/**
 * Get the Current Location object
 * @return {displayedLocation | promise} location (may be a promise)
 */
export function currentLocation(){
	var location = this.manager.currentLocation();
	if (location && location.then && typeof location.then === "function") {
		location.then(function(result) {
			let located = this.located(result);
			return located;
		}.bind(this));
	} else if (location) {
		let located = this.located(location);
		return located;
	}
}

/**
 * Creates a Rendition#locationRange from location
 * passed by the Manager
 * @returns {displayedLocation}
 * @private
 */
export function located(location){
	if (!location.length) {
		return {};
	}
	let start = location[0];
	let end = location[location.length-1];

	let located: any = {
		start: {
			index: start.index,
			href: start.href,
			cfi: start.mapping.start,
			displayed: {
				page: start.pages[0] || 1,
				total: start.totalPages
			}
		},
		end: {
			index: end.index,
			href: end.href,
			cfi: end.mapping.end,
			displayed: {
				page: end.pages[end.pages.length-1] || 1,
				total: end.totalPages
			}
		}
	};

	let locationStart = this.book.locations.locationFromCfi(start.mapping.start);
	let locationEnd = this.book.locations.locationFromCfi(end.mapping.end);

	if (locationStart != null) {
		located.start.location = locationStart;
		located.start.percentage = this.book.locations.percentageFromLocation(locationStart);
	}
	if (locationEnd != null) {
		located.end.location = locationEnd;
		located.end.percentage = this.book.locations.percentageFromLocation(locationEnd);
	}

	let pageStart = this.book.pageList.pageFromCfi(start.mapping.start);
	let pageEnd = this.book.pageList.pageFromCfi(end.mapping.end);

	if (pageStart != -1) {
		located.start.page = pageStart;
	}
	if (pageEnd != -1) {
		located.end.page = pageEnd;
	}

	if (end.index === this.book.spine.last().index &&
			located.end.displayed.page >= located.end.displayed.total) {
		located.atEnd = true;
	}

	if (start.index === this.book.spine.first().index &&
			located.start.displayed.page === 1) {
		located.atStart = true;
	}

	return located;
}

