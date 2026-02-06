import EventEmitter from "event-emitter";

import { extend, defer } from "../utils/core";
import Spine from "../spine";
import EpubCFI from "../epubcfi";
import Rendition from "../rendition";
import Navigation from "../navigation";
import ResourceCache from "../core/resource-cache";
import { EVENTS } from "../utils/constants";

import PdfSection from "./section";

class PdfBook {
	constructor(url, options) {
		if (
			typeof options === "undefined" &&
			typeof url !== "string" &&
			url instanceof Blob === false &&
			url instanceof ArrayBuffer === false
		) {
			options = url;
			url = undefined;
		}

		this.settings = extend(this.settings || {}, {
			pdfjs: undefined,
			workerSrc: undefined,
			password: undefined,
			withCredentials: undefined,
			httpHeaders: undefined,
			textLayer: true,
			annotationLayer: true,
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

		this.ready = Promise.all([
			this.loaded.metadata,
			this.loaded.navigation,
		]).then(() => this);

		this.isOpen = false;
		this.isPdf = true;

		this.pdf = undefined;
		this.numPages = 0;

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
				layout: "pre-paginated",
				spread: "none",
				direction: "ltr",
				flow: "paginated",
			},
		};

		this.displayOptions = {
			fixedLayout: "true",
		};

		this.locations = this.createLocationsStub();
		this.pageList = this.createPageListStub();

		this.pageCache = new ResourceCache({
			revoke: (value) => {
				if (!value || typeof value !== "object") {
					return;
				}
				const url = value.url;
				if (url && typeof url === "string" && url.indexOf("blob:") === 0) {
					URL.revokeObjectURL(url);
				}
			},
		});

		this.resources = {
			unload: (parentKey) => this.pageCache.releaseParent(parentKey),
		};

		this.pageTextCache = new Map();

		this.rendition = undefined;
		this.navigation = undefined;

		if (url) {
			this.open(url).catch((error) => {
				this.emit(EVENTS.BOOK.OPEN_FAILED, error);
			});
		}
	}

	pdfjsLib() {
		if (this.settings.pdfjs) {
			return this.settings.pdfjs;
		}

		if (typeof globalThis !== "undefined" && globalThis.pdfjsLib) {
			return globalThis.pdfjsLib;
		}
	}

	async open(input) {
		const pdfjs = this.pdfjsLib();
		if (!pdfjs || typeof pdfjs.getDocument !== "function") {
			throw new Error("pdfjsLib is required to open PDFs");
		}

		if (this.settings.workerSrc && pdfjs.GlobalWorkerOptions) {
			pdfjs.GlobalWorkerOptions.workerSrc = this.settings.workerSrc;
		}

		let loadingTask;
		if (typeof input === "string") {
			loadingTask = pdfjs.getDocument({
				url: input,
				password: this.settings.password,
				withCredentials: this.settings.withCredentials,
				httpHeaders: this.settings.httpHeaders,
			});
		} else if (input instanceof Blob) {
			const buffer = await input.arrayBuffer();
			loadingTask = pdfjs.getDocument({
				data: buffer,
				password: this.settings.password,
			});
		} else if (input instanceof ArrayBuffer) {
			loadingTask = pdfjs.getDocument({
				data: input,
				password: this.settings.password,
			});
		} else {
			throw new Error("Unsupported PDF input");
		}

		this.pdf = await loadingTask.promise;
		this.numPages = this.pdf.numPages;

		this.buildSpine();

		await this.loadMetadata();
		await this.loadNavigation();

		this.isOpen = true;
		this.opening.resolve(this);
		return this;
	}

	async loadMetadata() {
		if (!this.pdf || typeof this.pdf.getMetadata !== "function") {
			this.loading.metadata.resolve(
				this.package && this.package.metadata ? this.package.metadata : {},
			);
			return;
		}

		try {
			const data = await this.pdf.getMetadata();
			const info = data && data.info ? data.info : {};
			const metadata = extend(
				this.package && this.package.metadata ? this.package.metadata : {},
				{
					title: (info.Title || info.title || "").toString(),
					creator: (info.Author || info.author || "").toString(),
				},
			);

			if (this.package) {
				this.package.metadata = metadata;
			}

			this.loading.metadata.resolve(metadata);
		} catch (error) {
			this.loading.metadata.resolve(
				this.package && this.package.metadata ? this.package.metadata : {},
			);
		}
	}

	async loadNavigation() {
		if (!this.pdf || typeof this.pdf.getOutline !== "function") {
			this.navigation = new Navigation([]);
			this.loading.navigation.resolve(this.navigation);
			return;
		}

		try {
			const outline = await this.pdf.getOutline();
			const toc = outline ? await this.outlineToToc(outline) : [];
			this.navigation = new Navigation(toc);
			this.loading.navigation.resolve(this.navigation);
		} catch (error) {
			this.navigation = new Navigation([]);
			this.loading.navigation.resolve(this.navigation);
		}
	}

	async outlineToToc(outlineItems) {
		const toc = [];
		const items = Array.isArray(outlineItems) ? outlineItems : [];

		for (let i = 0; i < items.length; i += 1) {
			const item = items[i];
			if (!item) {
				continue;
			}

			const title = (item.title || "").toString();
			const children = await this.outlineToToc(
				item.items || item.children || [],
			);

			let href = undefined;
			if (item.dest) {
				const index = await this.resolveDestToPageIndex(item.dest);
				if (typeof index === "number") {
					href = this.hrefFromPageIndex(index);
				}
			}

			if (!href && item.url && typeof item.url === "string") {
				href = item.url;
			}

			if (!href && children.length === 0) {
				continue;
			}

			toc.push({
				title: title || `Item ${i + 1}`,
				href,
				children,
			});
		}

		return toc;
	}

	async resolveDestToPageIndex(dest) {
		if (!this.pdf) {
			return;
		}

		let resolved = dest;
		if (
			typeof dest === "string" &&
			typeof this.pdf.getDestination === "function"
		) {
			try {
				resolved = await this.pdf.getDestination(dest);
			} catch (e) {
				return;
			}
		}

		if (!Array.isArray(resolved) || resolved.length === 0) {
			return;
		}

		const ref = resolved[0];
		if (typeof ref === "number" && isFinite(ref)) {
			return Math.max(0, Math.min(this.numPages - 1, Math.floor(ref)));
		}

		if (ref && typeof this.pdf.getPageIndex === "function") {
			try {
				const index = await this.pdf.getPageIndex(ref);
				if (typeof index === "number" && isFinite(index)) {
					return Math.max(0, Math.min(this.numPages - 1, Math.floor(index)));
				}
			} catch (e) {
				return;
			}
		}
	}

	hrefFromPageIndex(pageIndex) {
		const index =
			typeof pageIndex === "number" && isFinite(pageIndex)
				? Math.floor(pageIndex)
				: 0;
		const section =
			this.spine && typeof this.spine.get === "function"
				? this.spine.get(index)
				: undefined;
		return section ? section.href : `page-${index + 1}`;
	}

	buildSpine() {
		if (!this.pdf) {
			return;
		}

		this.spine.spineItems = [];
		this.spine.spineByHref = {};
		this.spine.spineById = {};

		for (let page = 1; page <= this.pdf.numPages; page += 1) {
			const section = new PdfSection(this, page);
			this.spine.append(section);
		}

		this.spine.length = this.spine.spineItems.length;
		this.spine.loaded = true;
	}

	createLocationsStub() {
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
				return Math.max(0, Math.min(1, location / Math.max(1, total - 1)));
			},
			cfiFromLocation: (location) => {
				return book.locations.cfiFromPercentage(location);
			},
			cfiFromPercentage: (percentage) => {
				const total = book.numPages || 0;
				if (!total || typeof percentage !== "number") {
					return null;
				}
				const isIndex = Math.floor(percentage) === percentage;
				const index = isIndex
					? Math.max(0, Math.min(total - 1, Math.floor(percentage)))
					: Math.max(0, Math.min(total - 1, Math.floor(percentage * total)));
				const section = book.spine.get(index);
				return section ? `epubcfi(${section.cfiBase})` : null;
			},
		};
	}

	createPageListStub() {
		return {
			pageFromCfi: () => -1,
		};
	}

	load() {
		return Promise.reject(new Error("PdfBook.load is not supported"));
	}

	section(target) {
		return this.spine.get(target);
	}

	renderTo(element, options) {
		this.rendition = new Rendition(this, options);
		this.rendition.attachTo(element);
		return this.rendition;
	}

	async getPageText(pageNumber) {
		if (!this.pdf) {
			throw new Error("PDF is not open");
		}

		const page =
			typeof pageNumber === "number" && isFinite(pageNumber)
				? Math.floor(pageNumber)
				: 1;
		const cached = this.pageTextCache.get(page);
		if (cached) {
			return cached.promise || cached.text;
		}

		const entry = {
			text: "",
			promise: undefined,
		};

		entry.promise = this.pdf
			.getPage(page)
			.then((pageObj) => pageObj.getTextContent())
			.then((textContent) => {
				const items =
					textContent && Array.isArray(textContent.items)
						? textContent.items
						: [];
				const text = items
					.map((item) => {
						if (!item) {
							return "";
						}
						const str = item.str;
						return typeof str === "string" ? str : str ? String(str) : "";
					})
					.join(" ");

				entry.text = text;
				entry.promise = undefined;
				return text;
			})
			.catch((error) => {
				this.pageTextCache.delete(page);
				throw error;
			});

		this.pageTextCache.set(page, entry);
		return entry.promise;
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
		if (!query || typeof query !== "string") {
			return [];
		}

		query = query.trim();
		if (!query) {
			return [];
		}

		options = options || {};
		const signal = options.signal;
		const excerptLimit =
			typeof options.excerptLimit === "number" && options.excerptLimit > 0
				? Math.floor(options.excerptLimit)
				: 150;
		const onProgress =
			typeof options.onProgress === "function" ? options.onProgress : undefined;

		let maxResults = Infinity;
		if (
			typeof options.maxResults === "number" &&
			isFinite(options.maxResults) &&
			options.maxResults >= 0
		) {
			maxResults = Math.floor(options.maxResults);
		}

		await this.ready;

		const sections =
			this.spine && this.spine.spineItems ? this.spine.spineItems : [];
		const total = sections.length;
		const results = [];

		const needle = query.toLowerCase();

		const findMatches = (text) => {
			const matches = [];
			const haystack = (text || "").toLowerCase();
			let lastIndex = 0;

			while (matches.length < maxResults && lastIndex <= haystack.length) {
				const index = haystack.indexOf(needle, lastIndex);
				if (index === -1) {
					break;
				}

				const half = Math.floor(excerptLimit / 2);
				const start = Math.max(0, index - half);
				const end = Math.min(text.length, index + needle.length + half);
				let excerpt = text.slice(start, end);
				if (start > 0) {
					excerpt = "..." + excerpt;
				}
				if (end < text.length) {
					excerpt = excerpt + "...";
				}

				matches.push({ index, excerpt });
				lastIndex = index + needle.length;
			}

			return matches;
		};

		for (let i = 0; i < sections.length; i += 1) {
			const section = sections[i];
			if (!section || !section.linear) {
				continue;
			}

			if (signal && signal.aborted) {
				throw {
					name: "AbortError",
					message: "Aborted",
				};
			}

			const text = await this.getPageText(section.pageNumber);
			const matches = findMatches(text);
			for (const match of matches) {
				results.push({
					sectionIndex: section.index,
					href: section.href,
					cfi: `epubcfi(${section.cfiBase})`,
					excerpt: match.excerpt,
				});

				if (results.length >= maxResults) {
					break;
				}
			}

			if (onProgress) {
				onProgress({
					sectionIndex: section.index,
					href: section.href,
					processed: i + 1,
					total,
					results: results.length,
				});
			}

			if (results.length >= maxResults) {
				break;
			}
		}

		return results;
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
		if (!query || typeof query !== "string") {
			return [];
		}

		query = query.trim();
		if (!query) {
			return [];
		}

		options = options || {};
		const signal = options.signal;
		const maxResultsPerSection =
			typeof options.maxResultsPerSection === "number" &&
			options.maxResultsPerSection > 0
				? Math.floor(options.maxResultsPerSection)
				: 50;
		const excerptLimit =
			typeof options.excerptLimit === "number" && options.excerptLimit > 0
				? Math.floor(options.excerptLimit)
				: 150;
		const onProgress =
			typeof options.onProgress === "function" ? options.onProgress : undefined;

		let maxResults = Infinity;
		if (
			typeof options.maxResults === "number" &&
			isFinite(options.maxResults) &&
			options.maxResults >= 0
		) {
			maxResults = Math.floor(options.maxResults);
		}

		await this.ready;

		const sections =
			this.spine && this.spine.spineItems ? this.spine.spineItems : [];
		const total = sections.length;
		const results = [];

		const needle = query.toLowerCase();
		let totalMatches = 0;

		const findMatches = (text) => {
			const matches = [];
			const haystack = (text || "").toLowerCase();
			let lastIndex = 0;

			while (
				matches.length < maxResultsPerSection &&
				lastIndex <= haystack.length
			) {
				const index = haystack.indexOf(needle, lastIndex);
				if (index === -1) {
					break;
				}

				const half = Math.floor(excerptLimit / 2);
				const start = Math.max(0, index - half);
				const end = Math.min(text.length, index + needle.length + half);
				let excerpt = text.slice(start, end);
				if (start > 0) {
					excerpt = "..." + excerpt;
				}
				if (end < text.length) {
					excerpt = excerpt + "...";
				}

				matches.push({ index, excerpt });
				lastIndex = index + needle.length;
			}

			return matches;
		};

		for (let i = 0; i < sections.length; i += 1) {
			const section = sections[i];
			if (!section || !section.linear) {
				continue;
			}

			if (signal && signal.aborted) {
				throw {
					name: "AbortError",
					message: "Aborted",
				};
			}

			const text = await this.getPageText(section.pageNumber);
			const matches = findMatches(text);
			if (matches.length) {
				let sectionMatches = matches;
				if (totalMatches + sectionMatches.length > maxResults) {
					sectionMatches = sectionMatches.slice(
						0,
						Math.max(0, maxResults - totalMatches),
					);
				}

				results.push({
					sectionIndex: section.index,
					href: section.href,
					matches: sectionMatches,
				});

				totalMatches += sectionMatches.length;
			}

			if (onProgress) {
				onProgress({
					sectionIndex: section.index,
					href: section.href,
					processed: i + 1,
					total,
					results: results.length,
				});
			}

			if (totalMatches >= maxResults) {
				break;
			}
		}

		return results;
	}

	async renderPage(pageNumber, parentKey) {
		if (!this.pdf) {
			throw new Error("PDF is not open");
		}

		const key = this.pageCacheKey(pageNumber);
		const pageData = await this.pageCache.acquire(key, parentKey, async () => {
			return this.renderPageData(pageNumber);
		});

		const style = [
			"html, body { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; }",
			"body { position: relative; background: transparent; }",
			".page { position: relative; width: 100%; height: 100%; }",
			".page img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }",
			".textLayer { position: absolute; top: 0; left: 0; right: 0; bottom: 0; color: transparent; -webkit-text-fill-color: transparent; font-family: sans-serif; transform-origin: 0 0; }",
			".textLayer span { position: absolute; white-space: pre; transform-origin: 0 0; line-height: 1; }",
			".annotationLayer { position: absolute; top: 0; left: 0; right: 0; bottom: 0; }",
			".annotationLayer a { position: absolute; display: block; }",
		].join("\n");

		const layers = [
			`<img src=\"${pageData.url}\" alt=\"Page ${pageNumber}\" />`,
			pageData.textLayer || "",
			pageData.annotationLayer || "",
		].join("");

		return [
			"<!DOCTYPE html>",
			'<html lang="en">',
			"<head>",
			'<meta charset="utf-8" />',
			`<meta name=\"viewport\" content=\"width=${pageData.width}, height=${pageData.height}\" />`,
			`<style>${style}</style>`,
			"</head>",
			"<body>",
			`<div class=\"page\">${layers}</div>`,
			"</body>",
			"</html>",
		].join("");
	}

	pageCacheKey(pageNumber) {
		const page =
			typeof pageNumber === "number" && isFinite(pageNumber)
				? Math.floor(pageNumber)
				: 1;
		const baseScale =
			typeof this.settings.renderScale === "number" &&
			this.settings.renderScale > 0
				? this.settings.renderScale
				: 1;
		const textLayer = this.settings.textLayer ? "text:1" : "text:0";
		const annotationLayer = this.settings.annotationLayer ? "ann:1" : "ann:0";
		return `page:${page}|scale:${baseScale}|${textLayer}|${annotationLayer}`;
	}

	async renderPageData(pageNumber) {
		const pageIndex =
			typeof pageNumber === "number" && isFinite(pageNumber)
				? Math.floor(pageNumber)
				: 1;
		const page = await this.pdf.getPage(pageIndex);
		const baseScale =
			typeof this.settings.renderScale === "number" &&
			this.settings.renderScale > 0
				? this.settings.renderScale
				: 1;
		const deviceScale =
			typeof window !== "undefined" && window.devicePixelRatio
				? window.devicePixelRatio
				: 1;
		const cssViewport = page.getViewport({ scale: baseScale });
		const viewport = page.getViewport({ scale: baseScale * deviceScale });

		const canvas = document.createElement("canvas");
		canvas.width = Math.floor(viewport.width);
		canvas.height = Math.floor(viewport.height);

		const ctx = canvas.getContext("2d");
		if (!ctx) {
			throw new Error("CanvasRenderingContext2D is not available");
		}

		await page.render({
			canvasContext: ctx,
			viewport,
		}).promise;

		const blob = await new Promise((resolve, reject) => {
			canvas.toBlob((result) => {
				if (!result) {
					reject(new Error("Failed to render page"));
					return;
				}
				resolve(result);
			});
		});

		const url = URL.createObjectURL(blob);

		let textLayer = "";
		if (this.settings.textLayer) {
			try {
				const textContent = await page.getTextContent();
				textLayer = this.buildTextLayerHtml(textContent, cssViewport);
			} catch (e) {
				textLayer = "";
			}
		}

		let annotationLayer = "";
		if (this.settings.annotationLayer) {
			try {
				const annotations = await page.getAnnotations({ intent: "display" });
				annotationLayer = await this.buildAnnotationLayerHtml(
					annotations,
					cssViewport,
				);
			} catch (e) {
				annotationLayer = "";
			}
		}

		return {
			url,
			width: cssViewport.width,
			height: cssViewport.height,
			textLayer,
			annotationLayer,
		};
	}

	buildTextLayerHtml(textContent, viewport) {
		const items =
			textContent && Array.isArray(textContent.items) ? textContent.items : [];
		const pdfjs = this.pdfjsLib();
		const transform =
			pdfjs && pdfjs.Util && typeof pdfjs.Util.transform === "function"
				? pdfjs.Util.transform
				: this.transformMatrix;

		const spans = [];

		for (let i = 0; i < items.length; i += 1) {
			const item = items[i];
			if (!item) {
				continue;
			}

			const text = item.str;
			if (!text || typeof text !== "string") {
				continue;
			}

			const itemTransform = item.transform;
			if (!itemTransform || !Array.isArray(itemTransform)) {
				continue;
			}

			const tx = transform(viewport.transform, itemTransform);
			const angle = Math.atan2(tx[1], tx[0]);
			const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
			if (!fontHeight || !isFinite(fontHeight)) {
				continue;
			}

			const xScale = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
			const scaleX = xScale && isFinite(xScale) ? xScale / fontHeight : 1;
			const left = tx[4];
			const top = tx[5] - fontHeight;

			if (!isFinite(left) || !isFinite(top)) {
				continue;
			}

			const style = [
				`left:${left}px`,
				`top:${top}px`,
				`font-size:${fontHeight}px`,
				`transform:rotate(${angle}rad) scaleX(${scaleX})`,
			].join(";");

			spans.push(`<span style=\"${style}\">${this.escapeHtml(text)}</span>`);
		}

		return `<div class=\"textLayer\">${spans.join("")}</div>`;
	}

	async buildAnnotationLayerHtml(annotations, viewport) {
		const items = Array.isArray(annotations) ? annotations : [];
		const links = [];

		for (let i = 0; i < items.length; i += 1) {
			const item = items[i];
			if (!item || item.subtype !== "Link") {
				continue;
			}

			const rect = item.rect;
			if (!rect || !Array.isArray(rect) || rect.length !== 4) {
				continue;
			}

			let href = undefined;
			if (item.url && typeof item.url === "string") {
				href = item.url;
			} else if (item.dest) {
				const index = await this.resolveDestToPageIndex(item.dest);
				if (typeof index === "number") {
					href = this.hrefFromPageIndex(index);
				}
			}

			if (!href) {
				continue;
			}

			const points = viewport.convertToViewportRectangle(rect);
			if (!points || points.length !== 4) {
				continue;
			}

			const left = Math.min(points[0], points[2]);
			const top = Math.min(points[1], points[3]);
			const width = Math.abs(points[0] - points[2]);
			const height = Math.abs(points[1] - points[3]);

			if (
				!isFinite(left) ||
				!isFinite(top) ||
				!isFinite(width) ||
				!isFinite(height)
			) {
				continue;
			}

			const style = [
				`left:${left}px`,
				`top:${top}px`,
				`width:${width}px`,
				`height:${height}px`,
			].join(";");

			links.push(
				`<a href=\"${this.escapeHtml(href)}\" style=\"${style}\"></a>`,
			);
		}

		if (links.length === 0) {
			return "";
		}

		return `<div class=\"annotationLayer\">${links.join("")}</div>`;
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
		this.opened = undefined;
		this.opening = undefined;
		this.ready = undefined;
		this.loading = undefined;
		this.loaded = undefined;

		this.isOpen = false;
		this.isPdf = false;

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
		this.resources = undefined;
		this.locations = undefined;
		this.pageList = undefined;
		this.displayOptions = undefined;
		this.package = undefined;
		this.navigation = undefined;
		this.path = undefined;
		this.epubcfi = undefined;
	}
}

EventEmitter(PdfBook.prototype);

export default PdfBook;
