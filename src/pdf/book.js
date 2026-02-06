import EventEmitter from "event-emitter";

import { extend, defer } from "../utils/core";
import Spine from "../spine";
import EpubCFI from "../epubcfi";
import Rendition from "../rendition";
import ResourceCache from "../core/resource-cache";
import { EVENTS } from "../utils/constants";

import PdfSection from "./section";

class PdfBook {
	constructor(url, options) {
		if (typeof options === "undefined" &&
			typeof url !== "string" &&
			url instanceof Blob === false &&
			url instanceof ArrayBuffer === false) {
			options = url;
			url = undefined;
		}

		this.settings = extend(this.settings || {}, {
			pdfjs: undefined,
			workerSrc: undefined,
			password: undefined,
			withCredentials: undefined,
			httpHeaders: undefined,
			renderScale: 1
		});

		extend(this.settings, options);

		this.opening = new defer();
		this.opened = this.opening.promise;
		this.ready = this.opened;

		this.isOpen = false;

		this.pdf = undefined;
		this.numPages = 0;

		this.epubcfi = new EpubCFI();
		this.spine = new Spine();

		this.package = {
			metadata: {
				layout: "pre-paginated",
				spread: "none",
				direction: "ltr",
				flow: "paginated"
			}
		};

		this.displayOptions = {
			fixedLayout: "true"
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
			}
		});

		this.resources = {
			unload: (parentKey) => this.pageCache.releaseParent(parentKey)
		};

		this.rendition = undefined;

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
				httpHeaders: this.settings.httpHeaders
			});
		} else if (input instanceof Blob) {
			const buffer = await input.arrayBuffer();
			loadingTask = pdfjs.getDocument({
				data: buffer,
				password: this.settings.password
			});
		} else if (input instanceof ArrayBuffer) {
			loadingTask = pdfjs.getDocument({
				data: input,
				password: this.settings.password
			});
		} else {
			throw new Error("Unsupported PDF input");
		}

		this.pdf = await loadingTask.promise;
		this.numPages = this.pdf.numPages;

		this.buildSpine();
		this.isOpen = true;
		this.opening.resolve(this);
		return this;
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
			percentageFromLocation: (location) => {
				const total = book.numPages || 0;
				if (!total || typeof location !== "number") {
					return null;
				}
				return Math.max(0, Math.min(1, location / Math.max(1, total - 1)));
			},
			cfiFromPercentage: (percentage) => {
				const total = book.numPages || 0;
				if (!total || typeof percentage !== "number") {
					return null;
				}
				const index = Math.max(0, Math.min(total - 1, Math.floor(percentage * total)));
				const section = book.spine.get(index);
				return section ? `epubcfi(${section.cfiBase})` : null;
			}
		};
	}

	createPageListStub() {
		return {
			pageFromCfi: () => -1
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

	async renderPage(pageNumber, parentKey) {
		if (!this.pdf) {
			throw new Error("PDF is not open");
		}

		const key = `page:${pageNumber}`;
		const pageData = await this.pageCache.acquire(key, parentKey, async () => {
			return this.renderPageImage(pageNumber);
		});

		const style = [
			"html, body { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; }",
			"img { width: 100%; height: 100%; object-fit: contain; }"
		].join("\n");

		return [
			"<!DOCTYPE html>",
			"<html lang=\"en\">",
			"<head>",
			"<meta charset=\"utf-8\" />",
			`<meta name=\"viewport\" content=\"width=${pageData.width}, height=${pageData.height}\" />`,
			`<style>${style}</style>`,
			"</head>",
			"<body>",
			`<img src=\"${pageData.url}\" alt=\"Page ${pageNumber}\" />`,
			"</body>",
			"</html>"
		].join("");
	}

	async renderPageImage(pageNumber) {
		const page = await this.pdf.getPage(pageNumber);
		const baseScale = typeof this.settings.renderScale === "number" && this.settings.renderScale > 0 ? this.settings.renderScale : 1;
		const deviceScale = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
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
			viewport
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
		return {
			url,
			width: cssViewport.width,
			height: cssViewport.height
		};
	}

	destroy() {
		this.opened = undefined;
		this.opening = undefined;
		this.ready = undefined;

		this.isOpen = false;

		this.pageCache && this.pageCache.clear();
		this.pageCache = undefined;

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
		this.epubcfi = undefined;
	}
}

EventEmitter(PdfBook.prototype);

export default PdfBook;
