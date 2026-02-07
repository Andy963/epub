import IframeView from "../managers/views/iframe";

class PdfView extends IframeView {
	constructor(section, options) {
		super(section, options);
		this._pdfRenderKey = undefined;
		this._pdfRenderVersion = 0;
		this._pdfRenderController = undefined;
	}

	destroy() {
		if (this._pdfRenderController) {
			try {
				this._pdfRenderController.abort();
			} catch (e) {
				// NOOP
			}
		}
		this._pdfRenderController = undefined;

		super.destroy();
	}

	container(axis) {
		const element = super.container(axis);
		if (axis !== "horizontal") {
			element.style.marginLeft = "auto";
			element.style.marginRight = "auto";
		}
		return element;
	}

	onLoad(event, promise) {
		super.onLoad(event, promise);

		const book = this.section && this.section.book;
		if (book && typeof book.pageCacheKey === "function") {
			this._pdfRenderKey = book.pageCacheKey(this.section.pageNumber);
		}

		const doc = this.document;
		if (!doc || typeof doc.querySelector !== "function") {
			return;
		}

		const textLayer = doc.querySelector(".textLayer");
		if (!textLayer) {
			return;
		}

		const marker = "__epubjsTextSelectionFix";
		if (textLayer[marker]) {
			return;
		}
		textLayer[marker] = true;

		textLayer.onpointerdown = () => textLayer.classList.add("selecting");
		textLayer.onpointerup = () => textLayer.classList.remove("selecting");
		textLayer.onpointercancel = () => textLayer.classList.remove("selecting");
	}

	queueRenderForScale(scale) {
		const book = this.section && this.section.book;
		if (!book || !book.pageCache || typeof book.pageCache.acquire !== "function") {
			return;
		}

		const pageNumber = this.section && this.section.pageNumber;
		if (typeof pageNumber !== "number" || !isFinite(pageNumber) || pageNumber <= 0) {
			return;
		}

		const baseQuality =
			book.settings &&
			typeof book.settings.renderScale === "number" &&
			isFinite(book.settings.renderScale) &&
			book.settings.renderScale > 0
				? book.settings.renderScale
				: 1;

		const requestedScale =
			typeof scale === "number" && isFinite(scale) && scale > 0 ? scale : 1;
		const renderScale =
			Math.ceil(Math.max(0.1, baseQuality * requestedScale) * 4) / 4;

		const key =
			typeof book.pageCacheKey === "function"
				? book.pageCacheKey(pageNumber, renderScale, {
						textLayer: false,
						annotationLayer: false,
					})
				: undefined;
		if (!key || key === this._pdfRenderKey) {
			return;
		}

		this._pdfRenderVersion += 1;
		const version = this._pdfRenderVersion;

		if (this._pdfRenderController) {
			try {
				this._pdfRenderController.abort();
			} catch (e) {
				// NOOP
			}
		}

		const controller =
			typeof AbortController !== "undefined" ? new AbortController() : undefined;
		this._pdfRenderController = controller;

		const parentKey = this.id;
		const create = () => {
			if (typeof book.renderPageData !== "function") {
				throw new Error("PdfBook.renderPageData is required");
			}

			const options: any = { renderScale, textLayer: false, annotationLayer: false };
			if (controller) {
				options.signal = controller.signal;
			}
			return book.renderPageData(pageNumber, options);
		};

		book.pageCache
			.acquire(key, parentKey, create)
			.then((pageData) => {
				if (version !== this._pdfRenderVersion) {
					book.pageCache &&
						typeof book.pageCache.releaseChild === "function" &&
						book.pageCache.releaseChild(parentKey, key);
					return;
				}

				const doc = this.document;
				if (!doc || typeof doc.querySelector !== "function") {
					book.pageCache &&
						typeof book.pageCache.releaseChild === "function" &&
						book.pageCache.releaseChild(parentKey, key);
					return;
				}

				const img = doc.querySelector(".page img");
				if (!img || !pageData || !pageData.url) {
					book.pageCache &&
						typeof book.pageCache.releaseChild === "function" &&
						book.pageCache.releaseChild(parentKey, key);
					return;
				}

				img.src = pageData.url;

				const oldKey = this._pdfRenderKey;
				this._pdfRenderKey = key;

				if (
					oldKey &&
					oldKey !== key &&
					book.pageCache &&
					typeof book.pageCache.releaseChild === "function"
				) {
					book.pageCache.releaseChild(parentKey, oldKey);
				}
			})
			.catch(() => {
				book.pageCache &&
					typeof book.pageCache.releaseChild === "function" &&
					book.pageCache.releaseChild(parentKey, key);
			});
	}

	size(_width, _height) {
		const width = _width || this.settings.width;
		const height = _height || this.settings.height;

		if (this.shouldUseDynamicHeight()) {
			this.lock("width", width, height);
			this.settings.width = width;
			this.settings.height = height;
			return;
		}

		super.size(_width, _height);
	}

	expand(force) {
		super.expand(force);

		if (!this.iframe || !this.contents || !this.layout) {
			return;
		}

		if (this.layout.name !== "pre-paginated") {
			return;
		}

		if (this.shouldUseDynamicHeight()) {
			const width = this._width;
			const containerHeight = this._height || (this.layout && this.layout.height);
			if (!width) {
				return;
			}

			const viewport = this.contents.viewport();
			const viewportWidth = parseInt(viewport && viewport.width, 10);
			const viewportHeight = parseInt(viewport && viewport.height, 10);
			if (!viewportWidth || !viewportHeight) {
				return;
			}

			const zoom = this.layout && this.layout.settings ? this.layout.settings.fixedLayoutZoom : undefined;
			const widthScale = width / viewportWidth;
			const heightScale = containerHeight ? containerHeight / viewportHeight : widthScale;

			let scale;
			if (typeof zoom === "number" && isFinite(zoom) && zoom > 0) {
				scale = zoom;
			} else if (zoom === "fit-width") {
				scale = widthScale;
			} else {
				scale = Math.min(widthScale, heightScale);
			}

			if (!scale || !isFinite(scale)) {
				return;
			}

			let viewWidth = width;
			if (typeof zoom === "number" && isFinite(zoom) && zoom > 0) {
				viewWidth = Math.ceil(viewportWidth * scale);
			}
			const viewHeight = Math.ceil(viewportHeight * scale);

			if (!viewWidth || !isFinite(viewWidth) || !viewHeight || !isFinite(viewHeight)) {
				return;
			}

			try {
				this.contents.fit(viewWidth, viewHeight, this.section, undefined, zoom);
			} catch (e) {
				// NOOP
			}

			this.reframe(viewWidth, viewHeight);
			this.queueRenderForScale(scale);
			return;
		}

		this.centerFixedLayout();
		const width = this._width;
		const height = this._height || (this.layout && this.layout.height);
		if (!width || !height) {
			return;
		}

		const viewport = this.contents.viewport();
		const viewportWidth = parseInt(viewport && viewport.width, 10);
		const viewportHeight = parseInt(viewport && viewport.height, 10);
		if (!viewportWidth || !viewportHeight) {
			return;
		}

		const zoom =
			this.layout && this.layout.settings
				? this.layout.settings.fixedLayoutZoom
				: undefined;
		const widthScale = width / viewportWidth;
		const heightScale = height / viewportHeight;

		let scale;
		if (typeof zoom === "number" && isFinite(zoom) && zoom > 0) {
			scale = zoom;
		} else if (zoom === "fit-width") {
			scale = widthScale;
		} else {
			scale = Math.min(widthScale, heightScale);
		}

		if (!scale || !isFinite(scale)) {
			return;
		}

		this.queueRenderForScale(scale);
	}

	shouldUseDynamicHeight() {
		if (!this.layout || this.layout.name !== "pre-paginated") {
			return false;
		}

		const flow = typeof this.layout.flow === "function" ? this.layout.flow() : undefined;
		return flow === "scrolled";
	}

	centerFixedLayout() {
		if (!this.contents || typeof this.contents.viewport !== "function") {
			return;
		}

		if (
			this.section &&
			this.section.properties &&
			this.section.properties.includes("page-spread-left")
		) {
			return;
		}

		const viewport = this.contents.viewport();
		const viewportWidth = parseInt(viewport && viewport.width, 10);
		const viewportHeight = parseInt(viewport && viewport.height, 10);
		const width = this.width();
		const height = this.height();

		if (!viewportWidth || !viewportHeight || !width || !height) {
			return;
		}

		const scale = Math.min(width / viewportWidth, height / viewportHeight);
		if (!scale || !isFinite(scale)) {
			return;
		}

		const offsetX = Math.max(0, Math.floor((width - viewportWidth * scale) / 2));
		const offsetY = Math.max(0, Math.floor((height - viewportHeight * scale) / 2));

		this.contents.css("margin-left", `${offsetX}px`);
		this.contents.css("margin-top", `${offsetY}px`);
	}
}

export default PdfView;
