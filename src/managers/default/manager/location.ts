export function currentLocation() {
	this.updateLayout();
	if (this.isPaginated && this.settings.axis === "horizontal") {
		this.location = this.paginatedLocation();
	} else {
		this.location = this.scrolledLocation();
	}
	return this.location;
}

export function scrolledLocation() {
	let visible = this.visible();
	let container = this.container.getBoundingClientRect();
	let pageHeight =
		container.height < window.innerHeight ? container.height : window.innerHeight;
	let pageWidth =
		container.width < window.innerWidth ? container.width : window.innerWidth;
	let vertical = this.settings.axis === "vertical";
	let rtl = this.settings.direction === "rtl";

	let offset = 0;
	let used = 0;

	if (this.settings.fullsize) {
		offset = vertical ? window.scrollY : window.scrollX;
	}

	let sections = visible.map((view) => {
		let { index, href } = view.section;
		let position = view.position();
		let width = view.width();
		let height = view.height();

		let startPos;
		let endPos;
		let stopPos;
		let totalPages;

		if (vertical) {
			startPos = offset + container.top - position.top + used;
			endPos = startPos + pageHeight - used;
			totalPages = this.layout.count(height, pageHeight).pages;
			stopPos = pageHeight;
		} else {
			startPos = offset + container.left - position.left + used;
			endPos = startPos + pageWidth - used;
			totalPages = this.layout.count(width, pageWidth).pages;
			stopPos = pageWidth;
		}

		let currPage = Math.ceil(startPos / stopPos);
		let pages = [];
		let endPage = Math.ceil(endPos / stopPos);

		// Reverse page counts for horizontal rtl
		if (this.settings.direction === "rtl" && !vertical) {
			let tempStartPage = currPage;
			currPage = totalPages - endPage;
			endPage = totalPages - tempStartPage;
		}

		pages = [];
		for (var i = currPage; i <= endPage; i++) {
			let pg = i + 1;
			pages.push(pg);
		}

		let mapping = this.mapping.page(
			view.contents,
			view.section.cfiBase,
			startPos,
			endPos
		);

		return {
			index,
			href,
			pages,
			totalPages,
			mapping,
		};
	});

	return sections;
}

export function paginatedLocation() {
	let visible = this.visible();
	let container = this.container.getBoundingClientRect();

	let left = 0;
	let used = 0;

	if (this.settings.fullsize) {
		left = window.scrollX;
	}

	let sections = visible.map((view) => {
		let { index, href } = view.section;
		let offset;
		let position = view.position();
		let width = view.width();

		// Find mapping
		let start;
		let end;
		let pageWidth;

		if (this.settings.direction === "rtl") {
			offset = container.right - left;
			pageWidth =
				Math.min(Math.abs(offset - position.left), this.layout.width) - used;
			end = position.width - (position.right - offset) - used;
			start = end - pageWidth;
		} else {
			offset = container.left + left;
			pageWidth = Math.min(position.right - offset, this.layout.width) - used;
			start = offset - position.left + used;
			end = start + pageWidth;
		}

		used += pageWidth;

		let mapping = this.mapping.page(
			view.contents,
			view.section.cfiBase,
			start,
			end
		);

		let totalPages = this.layout.count(width).pages;
		let startPage = Math.floor(start / this.layout.pageWidth);
		let pages = [];
		let endPage = Math.floor(end / this.layout.pageWidth);

		// start page should not be negative
		if (startPage < 0) {
			startPage = 0;
			endPage = endPage + 1;
		}

		// Reverse page counts for rtl
		if (this.settings.direction === "rtl") {
			let tempStartPage = startPage;
			startPage = totalPages - endPage;
			endPage = totalPages - tempStartPage;
		}

		for (var i = startPage + 1; i <= endPage; i++) {
			let pg = i;
			pages.push(pg);
		}

		return {
			index,
			href,
			pages,
			totalPages,
			mapping,
		};
	});

	return sections;
}

