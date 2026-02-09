import EventEmitter from "event-emitter";

import { extend, defer } from "../utils/core";
import Spine from "../spine";
import EpubCFI from "../epubcfi";
import ResourceCache from "../core/resource-cache";
import { EVENTS } from "../utils/constants";

import {
	pdfjsLib as pdfjsLibImpl,
	pdfjsViewer as pdfjsViewerImpl,
	open as openImpl,
} from "./book/open";
import { coverUrl as coverUrlImpl, loadMetadata as loadMetadataImpl } from "./book/metadata";
import {
	loadNavigation as loadNavigationImpl,
	outlineToToc as outlineToTocImpl,
	resolveDestToPageIndex as resolveDestToPageIndexImpl,
} from "./book/navigation";
import { hrefFromPageIndex as hrefFromPageIndexImpl, buildSpine as buildSpineImpl } from "./book/spine";
import {
	initProgressWeights as initProgressWeightsImpl,
	recordPageWeight as recordPageWeightImpl,
	progressDenominator as progressDenominatorImpl,
	progressPrefixBefore as progressPrefixBeforeImpl,
	percentageFromPageIndex as percentageFromPageIndexImpl,
	pageIndexFromPercentage as pageIndexFromPercentageImpl,
} from "./book/progress";
import { createLocationsStub as createLocationsStubImpl, createPageListStub as createPageListStubImpl } from "./book/stubs";
import { renderTo as renderToImpl } from "./book/rendition";
import {
	cancelPrefetch as cancelPrefetchImpl,
	prefetch as prefetchImpl,
	collectPrefetchCandidates as collectPrefetchCandidatesImpl,
} from "./book/prefetch";
import { getPageText as getPageTextImpl } from "./book/text";
import { search as searchImpl } from "./book/search";
import { searchText as searchTextImpl } from "./book/search-text";
import {
	renderPage as renderPageImpl,
	pageCacheKey as pageCacheKeyImpl,
	renderPageData as renderPageDataImpl,
} from "./book/render";
import {
	buildTextLayerHtml as buildTextLayerHtmlImpl,
	buildAnnotationLayerHtml as buildAnnotationLayerHtmlImpl,
} from "./book/layers";
import { destroy as destroyImpl } from "./book/lifecycle";

class PdfBook {
	[key: string]: any;

	constructor(url, options) {
		if (
			typeof options === "undefined" &&
			typeof url !== "string" &&
			url instanceof Blob === false &&
			url instanceof ArrayBuffer === false &&
			url instanceof Uint8Array === false
		) {
			options = url;
			url = undefined;
		}

		this.settings = extend(this.settings || {}, {
			pdfjs: undefined,
			pdfjsViewer: undefined,
			workerSrc: undefined,
			password: undefined,
			withCredentials: undefined,
			httpHeaders: undefined,
			cMapUrl: undefined,
			cMapPacked: undefined,
			standardFontDataUrl: undefined,
			isEvalSupported: false,
			textLayer: true,
			annotationLayer: true,
			prefetchDistance: 0,
			maxCachedPages: 6,
			maxCachedTextPages: 50,
			renderScale: 1,
		});

		extend(this.settings, options);

		this.opening = new defer();
		this.opened = this.opening.promise;

		this.loading = {
			metadata: new defer(),
			navigation: new defer(),
		};

		this.loaded = {
			metadata: this.loading.metadata.promise,
			navigation: this.loading.navigation.promise,
		};

		this.ready = Promise.all([this.loaded.metadata, this.loaded.navigation]).then(() => this);

		this.isOpen = false;
		this.isPdf = true;

		this.pdf = undefined;
		this.numPages = 0;
		this._progressBaseWeight = 1;
		this._progressDeltas = undefined;
		this._progressDeltaTree = undefined;

		this.epubcfi = new EpubCFI();
		this.spine = new Spine();
		this.path = {
			relative: (href) => {
				if (typeof href !== "string") {
					return href;
				}
				if (href.indexOf("://") > -1) {
					return href;
				}
				return href.charAt(0) === "/" ? href.slice(1) : href;
			},
		};

		this.package = {
			metadata: {
				title: "",
				creator: "",
				description: "",
				pubdate: "",
				publisher: "",
				identifier: "",
				language: "",
				rights: "",
				modified_date: "",
				layout: "pre-paginated",
				orientation: "",
				spread: "none",
				direction: "ltr",
				flow: "paginated",
				viewport: "",
			},
		};

		this.displayOptions = {
			fixedLayout: "true",
		};

		this.locations = this.createLocationsStub();
		this.pageList = this.createPageListStub();

		const maxCachedPages =
			typeof this.settings.maxCachedPages === "number" &&
			isFinite(this.settings.maxCachedPages) &&
			this.settings.maxCachedPages > 0
				? Math.floor(this.settings.maxCachedPages)
				: 0;

		this.pageCache = new ResourceCache({
			revoke: (value) => {
				if (!value || typeof value !== "object") {
					return;
				}
				const url = (value as any).url;
				if (url && typeof url === "string" && url.indexOf("blob:") === 0) {
					URL.revokeObjectURL(url);
				}
			},
			retain: maxCachedPages > 0,
			maxEntries: maxCachedPages,
		});

		this.resources = {
			unload: (parentKey) => this.pageCache.releaseParent(parentKey),
		};

		this.pageTextCache = new Map();

		this.prefetchVersion = 0;
		this.prefetchController = undefined;
		this.prefetchParentKey = undefined;

		this.rendition = undefined;
		this.navigation = undefined;

		if (url) {
			this.open(url).catch((error) => {
				this.emit(EVENTS.BOOK.OPEN_FAILED, error);
			});
		}
	}

	pdfjsLib() {
		return pdfjsLibImpl.call(this);
	}

	pdfjsViewer() {
		return pdfjsViewerImpl.call(this);
	}

	async open(input) {
		return openImpl.call(this, input);
	}

	/**
	 * Get a cover image URL (renders the first page)
	 * @return {Promise<?string>} coverUrl
	 */
	async coverUrl() {
		return coverUrlImpl.call(this);
	}

	async loadMetadata() {
		return loadMetadataImpl.call(this);
	}

	async loadNavigation() {
		return loadNavigationImpl.call(this);
	}

	async outlineToToc(outlineItems) {
		return outlineToTocImpl.call(this, outlineItems);
	}

	async resolveDestToPageIndex(dest) {
		return resolveDestToPageIndexImpl.call(this, dest);
	}

	hrefFromPageIndex(pageIndex) {
		return hrefFromPageIndexImpl.call(this, pageIndex);
	}

	buildSpine() {
		return buildSpineImpl.call(this);
	}

	async initProgressWeights() {
		return initProgressWeightsImpl.call(this);
	}

	recordPageWeight(pageIndex, viewport) {
		return recordPageWeightImpl.call(this, pageIndex, viewport);
	}

	progressDenominator() {
		return progressDenominatorImpl.call(this);
	}

	progressPrefixBefore(pageIndex) {
		return progressPrefixBeforeImpl.call(this, pageIndex);
	}

	percentageFromPageIndex(pageIndex) {
		return percentageFromPageIndexImpl.call(this, pageIndex);
	}

	pageIndexFromPercentage(percentage) {
		return pageIndexFromPercentageImpl.call(this, percentage);
	}

	createLocationsStub() {
		return createLocationsStubImpl.call(this);
	}

	createPageListStub() {
		return createPageListStubImpl.call(this);
	}

	load() {
		return Promise.reject(new Error("PdfBook.load is not supported"));
	}

	section(target) {
		return this.spine.get(target);
	}

	renderTo(element, options) {
		return renderToImpl.call(this, element, options);
	}

	cancelPrefetch() {
		return cancelPrefetchImpl.call(this);
	}

	prefetch(section, distance) {
		return prefetchImpl.call(this, section, distance);
	}

	collectPrefetchCandidates(section, distance) {
		return collectPrefetchCandidatesImpl.call(this, section, distance);
	}

	async getPageText(pageNumber) {
		return getPageTextImpl.call(this, pageNumber);
	}

	/**
	 * Search the PDF for a string (returns results with page-level CFIs)
	 * @param {string} query
	 * @param {object} [options]
	 * @param {AbortSignal} [options.signal]
	 * @param {number} [options.maxResults]
	 * @param {number} [options.excerptLimit]
	 * @param {function} [options.onProgress]
	 * @return {Promise<Array<{sectionIndex: number, href: string, cfi: string, excerpt: string}>>}
	 */
	async search(query, options) {
		return searchImpl.call(this, query, options);
	}

	/**
	 * Search the PDF for a string without generating CFIs per match
	 * @param {string} query
	 * @param {object} [options]
	 * @param {AbortSignal} [options.signal]
	 * @param {number} [options.maxResults]
	 * @param {number} [options.maxResultsPerSection]
	 * @param {number} [options.excerptLimit]
	 * @param {function} [options.onProgress]
	 * @return {Promise<Array<{sectionIndex: number, href: string, matches: Array<{index: number, excerpt: string}>}>>}
	 */
	async searchText(query, options) {
		return searchTextImpl.call(this, query, options);
	}

	async renderPage(pageNumber, parentKey) {
		return renderPageImpl.call(this, pageNumber, parentKey);
	}

	pageCacheKey(pageNumber, renderScale?, options?) {
		return pageCacheKeyImpl.call(this, pageNumber, renderScale, options);
	}

	async renderPageData(pageNumber, options?) {
		return renderPageDataImpl.call(this, pageNumber, options);
	}

	async buildTextLayerHtml(textContent, viewport) {
		return buildTextLayerHtmlImpl.call(this, textContent, viewport);
	}

	async buildAnnotationLayerHtml(annotations, viewport, page) {
		return buildAnnotationLayerHtmlImpl.call(this, annotations, viewport, page);
	}

	transformMatrix(m1, m2) {
		return [
			m1[0] * m2[0] + m1[2] * m2[1],
			m1[1] * m2[0] + m1[3] * m2[1],
			m1[0] * m2[2] + m1[2] * m2[3],
			m1[1] * m2[2] + m1[3] * m2[3],
			m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
			m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
		];
	}

	escapeHtml(value) {
		return String(value)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/\"/g, "&quot;")
			.replace(/'/g, "&#39;");
	}

	destroy() {
		return destroyImpl.call(this);
	}
}

EventEmitter(PdfBook.prototype);

export default PdfBook;

