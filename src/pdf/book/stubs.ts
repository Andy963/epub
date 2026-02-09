import EpubCFI from "../../epubcfi";

export function createLocationsStub() {
	const book = this;
	return {
		length: () => book.numPages || 0,
		locationFromCfi: (cfi) => {
			try {
				const parsed = new EpubCFI(cfi);
				return parsed.spinePos;
			} catch (e) {
				return null;
			}
		},
		percentageFromCfi: (cfi) => {
			try {
				const loc = book.locations.locationFromCfi(cfi);
				return book.locations.percentageFromLocation(loc);
			} catch (e) {
				return null;
			}
		},
		percentageFromLocation: (location) => {
			const total = book.numPages || 0;
			if (!total || typeof location !== "number") {
				return null;
			}
			return book.percentageFromPageIndex(location);
		},
		cfiFromLocation: (location) => {
			const total = book.numPages || 0;
			if (!total || typeof location !== "number") {
				return null;
			}
			const index = Math.max(0, Math.min(total - 1, Math.floor(location)));
			const section = book.spine.get(index);
			return section ? `epubcfi(${section.cfiBase})` : null;
		},
		cfiFromPercentage: (percentage) => {
			const total = book.numPages || 0;
			if (!total || typeof percentage !== "number") {
				return null;
			}
			const isIndex = Math.floor(percentage) === percentage;
			const index = isIndex
				? Math.max(0, Math.min(total - 1, Math.floor(percentage)))
				: book.pageIndexFromPercentage(percentage);
			const section = book.spine.get(index);
			return section ? `epubcfi(${section.cfiBase})` : null;
		},
	};
}

export function createPageListStub() {
	return {
		pageFromCfi: (cfi) => {
			try {
				const parsed = new EpubCFI(cfi);
				const index =
					parsed && typeof parsed.spinePos === "number" ? parsed.spinePos : NaN;
				if (isNaN(index)) {
					return -1;
				}
				return index + 1;
			} catch (e) {
				return -1;
			}
		},
	};
}

