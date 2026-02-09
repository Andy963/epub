export function destroy() {
	this.opened = undefined;
	this.opening = undefined;
	this.ready = undefined;
	this.loading = undefined;
	this.loaded = undefined;

	this.isOpen = false;
	this.isPdf = false;

	try {
		this.cancelPrefetch();
	} catch (e) {
		// NOOP
	}
	this.prefetchVersion = undefined;
	this.prefetchController = undefined;
	this.prefetchParentKey = undefined;

	this.pageCache && this.pageCache.clear();
	this.pageCache = undefined;
	this.pageTextCache && this.pageTextCache.clear();
	this.pageTextCache = undefined;

	this.spine && this.spine.destroy();
	this.spine = undefined;

	this.rendition && this.rendition.destroy();
	this.rendition = undefined;

	if (this.pdf && typeof this.pdf.destroy === "function") {
		this.pdf.destroy();
	}
	this.pdf = undefined;
	this.numPages = 0;
	this._progressBaseWeight = undefined;
	this._progressDeltas = undefined;
	this._progressDeltaTree = undefined;
	this.resources = undefined;
	this.locations = undefined;
	this.pageList = undefined;
	this.displayOptions = undefined;
	this.package = undefined;
	this.navigation = undefined;
	this.path = undefined;
	this.epubcfi = undefined;
}

