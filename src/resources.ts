import {substitute} from "./utils/replacements";
import {createBase64Url, createBlobUrl, blob2base64} from "./utils/core";
import Url from "./utils/url";
import mime from "./utils/mime";
import Path from "./utils/path";
import path from "path-webpack";
import ResourceCache from "./core/resource-cache";

const XLINK_NS = "http://www.w3.org/1999/xlink";

type Manifest = Record<string, ManifestItem>;

interface ManifestItem {
	href: string;
	type?: string;
	[key: string]: any;
}

type ResourcesResolver = (href: string) => string;

type ResourcesRequester = (url: string, type?: string | null) => Promise<any>;

interface ResourcesArchive {
	createUrl: (url: string, options?: { base64?: boolean }) => Promise<string>;
	getText: (url: string, encoding?: string) => Promise<string> | undefined;
	getBlob: (url: string, mimeType?: string) => Promise<Blob> | undefined;
	getBase64: (url: string, mimeType?: string) => Promise<string> | undefined;
}

export interface ResourcesSettings {
	replacements?: "none" | "base64" | "blobUrl" | string;
	archive?: ResourcesArchive;
	resolver?: ResourcesResolver;
	request?: ResourcesRequester;
	lazy?: boolean;
	performance?: any;
}

async function replaceSeries(
	str: string,
	regex: RegExp,
	asyncReplacer: (...args: any[]) => Promise<string> | string
): Promise<string> {
	let result = "";
	let lastIndex = 0;
	let match;

	regex.lastIndex = 0;

	while ((match = regex.exec(str)) !== null) {
		result += str.slice(lastIndex, match.index);
		result += await asyncReplacer.apply(null, match);
		lastIndex = match.index + match[0].length;
	}

	result += str.slice(lastIndex);
	return result;
}

/**
 * Handle Package Resources
 * @class
 * @param {Manifest} manifest
 * @param {object} [options]
 * @param {string} [options.replacements="base64"]
 * @param {Archive} [options.archive]
 * @param {method} [options.resolver]
 */
class Resources {
	settings: ResourcesSettings;
	resourceCache: ResourceCache<string> | undefined;
	manifest: Manifest | undefined;
	resources: ManifestItem[] | undefined;
	replacementUrls: Array<string | undefined> | undefined;
	html: ManifestItem[] | undefined;
	assets: ManifestItem[] | undefined;
	css: ManifestItem[] | undefined;
	urls: string[] | undefined;
	cssUrls: string[] | undefined;
	resolvedManifest: Map<string, ManifestItem> | undefined;

	constructor(manifest: Manifest, options?: ResourcesSettings) {
		this.settings = {
			replacements: (options && options.replacements) || "base64",
			archive: (options && options.archive),
			resolver: (options && options.resolver),
			request: (options && options.request),
			lazy: (options && options.lazy) || false,
			performance: options && options.performance
		};

		this.resourceCache = new ResourceCache({
			performance: this.settings.performance
		});

		this.process(manifest);
	}

	/**
	 * Process resources
	 * @param {Manifest} manifest
	 */
	process(manifest: Manifest): void {
		this.manifest = manifest;
		this.resources = Object.keys(manifest).
			map(function (key){
				return manifest[key];
			});

		this.replacementUrls = [];

		this.html = [];
		this.assets = [];
		this.css = [];

		this.urls = [];
		this.cssUrls = [];

		this.split();
		this.splitUrls();
		this.buildResolvedManifest();
	}

	/**
	 * Split resources by type
	 * @private
	 */
	split(): void {

		// HTML
		this.html = this.resources.
			filter(function (item){
				if (item.type === "application/xhtml+xml" ||
						item.type === "text/html") {
					return true;
				}
			});

		// Exclude HTML
		this.assets = this.resources.
			filter(function (item){
				if (item.type !== "application/xhtml+xml" &&
						item.type !== "text/html") {
					return true;
				}
			});

		// Only CSS
		this.css = this.resources.
			filter(function (item){
				if (item.type === "text/css") {
					return true;
				}
			});
	}

	/**
	 * Convert split resources into Urls
	 * @private
	 */
	splitUrls(): void {

		// All Assets Urls
		this.urls = this.assets.
			map(function(item) {
				return item.href;
			}.bind(this));

		// Css Urls
		this.cssUrls = this.css.map(function(item) {
			return item.href;
		});

	}

	buildResolvedManifest(): void {
		this.resolvedManifest = new Map();
		if (!this.settings || typeof this.settings.resolver !== "function") {
			return;
		}

		this.resources.forEach((item) => {
			if (!item || !item.href) {
				return;
			}
			const resolved = this.settings.resolver(item.href);
			if (resolved) {
				this.resolvedManifest.set(resolved, item);
			}
		});
	}

	/**
	 * Create a url to a resource
	 * @param {string} url
	 * @return {Promise<string>} Promise resolves with url string
	 */
	createUrl (url: string): Promise<string> {
		var parsedUrl = new Url(url);
		var mimeType = mime.lookup(parsedUrl.filename);

		if (this.settings.archive) {
			return this.settings.archive.createUrl(url, {"base64": (this.settings.replacements === "base64")});
		} else {
			if (this.settings.replacements === "base64") {
				return this.settings.request!(url, "blob").then((blob) => {
					return blob2base64(blob);
				});
			} else {
				return this.settings.request!(url, 'blob').then((blob) => {
					return createBlobUrl(blob, mimeType);
				})
			}
		}
	}

	/**
	 * Create blob urls for all the assets
	 * @return {Promise}         returns replacement urls
	 */
	replacements(): Promise<Array<string | undefined>> {
		if (this.settings.replacements === "none") {
			return new Promise(function(resolve) {
				resolve(this.urls as any);
			}.bind(this));
		}

		var replacements = this.urls!.map( (url) => {
				var absolute = this.settings.resolver!(url);

				return this.createUrl(absolute).
					catch((err) => {
						console.error(err);
						return null;
					});
			});

		return Promise.all(replacements)
			.then( (replacementUrls) => {
				this.replacementUrls = replacementUrls.map((url) => {
					return typeof url === "string" ? url : undefined;
				});
				return this.replacementUrls!;
			});
	}

	/**
	 * Replace URLs in CSS resources
	 * @private
	 * @param  {Archive} [archive]
	 * @param  {method} [resolver]
	 * @return {Promise}
	 */
	replaceCss(archive?: ResourcesArchive, resolver?: ResourcesResolver): Promise<any[]> {
		var replaced = [];
		archive = archive || this.settings.archive;
		resolver = resolver || this.settings.resolver;
		this.cssUrls.forEach(function(href) {
			var replacement = this.createCssFile(href, archive, resolver)
				.then(function (replacementUrl) {
					// switch the url in the replacementUrls
					var indexInUrls = this.urls.indexOf(href);
					if (indexInUrls > -1) {
						this.replacementUrls[indexInUrls] = replacementUrl;
					}
				}.bind(this))


			replaced.push(replacement);
		}.bind(this));
		return Promise.all(replaced);
	}

	/**
	 * Create a new CSS file with the replaced URLs
	 * @private
	 * @param  {string} href the original css file
	 * @return {Promise}  returns a BlobUrl to the new CSS file or a data url
	 */
	createCssFile(href: string, archive?: ResourcesArchive, resolver?: ResourcesResolver): Promise<string | undefined> {
		var newUrl;

		if (path.isAbsolute(href)) {
			return new Promise(function(resolve){
				resolve();
			});
		}

		archive = archive || this.settings.archive;
		resolver = resolver || this.settings.resolver;

		var absolute = resolver!(href);

		// Get the text of the css file from the archive
		var textResponse;

		if (archive) {
			textResponse = archive.getText(absolute);
		} else {
			textResponse = this.settings.request!(absolute, "text");
		}

		// Get asset links relative to css file
		var relUrls = this.urls!.map( (assetHref) => {
			var resolved = resolver!(assetHref);
			var relative = new Path(absolute).relative(resolved);

			return relative;
		});

		if (!textResponse) {
			// file not found, don't replace
			return new Promise(function(resolve){
				resolve();
			});
		}

		return textResponse.then( (text) => {
			// Replacements in the css text
			text = substitute(text, relUrls, this.replacementUrls);

			// Get the new url
			if (this.settings.replacements === "base64") {
				newUrl = createBase64Url(text, "text/css");
			} else {
				newUrl = createBlobUrl(text, "text/css");
			}

			return newUrl;
		}, (err) => {
			// handle response errors
			return new Promise(function(resolve){
				resolve();
			});
		});

	}

	/**
	 * Resolve all resources URLs relative to an absolute URL
	 * @param  {string} absolute to be resolved to
	 * @param  {resolver} [resolver]
	 * @return {string[]} array with relative Urls
	 */
	relativeTo(absolute: string, resolver?: ResourcesResolver): string[] {
		resolver = resolver || this.settings.resolver;

		// Get Urls relative to current sections
		return this.urls!.
			map(function(href) {
				var resolved = resolver!(href);
				var relative = new Path(absolute).relative(resolved);
				return relative;
			}.bind(this));
	}

	/**
	 * Get a URL for a resource
	 * @param  {string} path
	 * @return {string} url
	 */
	get(path: string): Promise<string> | undefined {
		var indexInUrls = this.urls!.indexOf(path);
		if (indexInUrls === -1) {
			return;
		}

		const replacement = this.replacementUrls && this.replacementUrls[indexInUrls];
		if (replacement) {
			return Promise.resolve(replacement);
		}

		return this.createUrl(path);
	}

	/**
	 * Substitute urls in content, with replacements,
	 * relative to a url if provided
	 * @param  {string} content
	 * @param  {string} [url]   url to resolve to
	 * @return {string}         content with urls substituted
	 */
	substitute(content: string, url?: string): string {
		var relUrls;
		if (url) {
			relUrls = this.relativeTo(url);
		} else {
			relUrls = this.urls;
		}
		return substitute(content, relUrls, this.replacementUrls);
	}

	replace(output: string, section: any): Promise<string> {
		if (!this.settings || !this.settings.lazy) {
			section.output = output;
			return Promise.resolve(output);
		}

		if (!output || !section) {
			return Promise.resolve(output);
		}

		const baseUrl = section.url;
		const parentKey = section._resourceParentKey || section.href || baseUrl;

		if (!baseUrl || !parentKey) {
			section.output = output;
			return Promise.resolve(output);
		}

		return this.replaceMarkup(output, "application/xhtml+xml", baseUrl, parentKey, [baseUrl]).then((replaced) => {
			section.output = replaced;
			return replaced;
		});
	}

	unload(parentKey: string): void {
		if (!this.resourceCache || !parentKey) {
			return;
		}
		this.resourceCache.releaseParent(parentKey);
	}

	isExternalUrl(href: string): boolean {
		if (!href || typeof href !== "string") {
			return true;
		}

		if (href.indexOf("#") === 0) {
			return true;
		}

		return /^[a-z][a-z0-9+.-]*:/i.test(href);
	}

	resolveUrl(href: string, baseUrl: string): string {
		const resolved = new Url(href, baseUrl);
		if (resolved.origin) {
			return resolved.origin + resolved.Path.path;
		}
		return resolved.Path.path;
	}

	loadText(url: string): Promise<string> {
		if (this.settings.archive) {
			const response = this.settings.archive.getText(url);
			if (!response) {
				return Promise.reject(new Error("File not found in archive: " + url));
			}
			return response;
		}

		return this.settings.request!(url, "text");
	}

	loadBlob(url: string, mimeType: string): Promise<Blob> {
		if (this.settings.archive) {
			const response = this.settings.archive.getBlob(url, mimeType);
			if (!response) {
				return Promise.reject(new Error("File not found in archive: " + url));
			}
			return response;
		}

		return this.settings.request!(url, "blob");
	}

	createTextUrl(text: string, mediaType: string): Promise<string> {
		if (this.settings.replacements === "base64") {
			return blob2base64(new Blob([text], { type: mediaType }));
		}

		return Promise.resolve(createBlobUrl(text, mediaType));
	}

	createBinaryUrl(url: string, mediaType: string): Promise<string> {
		if (this.settings.replacements === "base64") {
			if (this.settings.archive) {
				const response = this.settings.archive.getBase64(url, mediaType);
				if (response) {
					return response;
				}
			}

			return this.loadBlob(url, mediaType).then((blob) => blob2base64(blob));
		}

		const w = window as any;
		const _URL = window.URL || w.webkitURL || w.mozURL;
		return this.loadBlob(url, mediaType).then((blob) => _URL.createObjectURL(blob));
	}

	isReplaceableType(mediaType: string): boolean {
		return (
			mediaType === "text/css" ||
			mediaType === "application/xhtml+xml" ||
			mediaType === "text/html" ||
			mediaType === "image/svg+xml"
		);
	}

	loadHref(href: string, baseUrl: string, parentKey: string, parents?: string[]): Promise<string> {
		if (!href || typeof href !== "string") {
			return Promise.resolve(href);
		}

		if (this.isExternalUrl(href)) {
			return Promise.resolve(href);
		}

		const resolved = this.resolveUrl(href, baseUrl);
		const item = this.resolvedManifest && this.resolvedManifest.get(resolved);
		if (!item) {
			return Promise.resolve(href);
		}

		if (parents && parents.indexOf(resolved) !== -1) {
			return Promise.resolve(href);
		}

		return this.loadItem(resolved, item, parentKey, parents || []).catch(() => href);
	}

	loadItem(resolvedUrl: string, item: ManifestItem, parentKey: string, parents?: string[]): Promise<string> {
		if (!this.resourceCache) {
			return Promise.resolve(resolvedUrl);
		}

		return this.resourceCache.acquire(resolvedUrl, parentKey, () => {
			return this.createItem(resolvedUrl, item, parents || []);
		});
	}

	async createItem(resolvedUrl: string, item: ManifestItem, parents?: string[]): Promise<string> {
		const mediaType = item && item.type ? item.type : mime.lookup(new Url(resolvedUrl).filename);
		const nextParents = (parents || []).concat(resolvedUrl);

		if (this.settings.lazy && this.isReplaceableType(mediaType)) {
			const markup = await this.loadText(resolvedUrl);

			if (mediaType === "text/css") {
				const replaced = await this.replaceCSS(markup, resolvedUrl, resolvedUrl, nextParents);
				return this.createTextUrl(replaced, mediaType);
			}

			const replaced = await this.replaceMarkup(markup, mediaType as SupportedType, resolvedUrl, resolvedUrl, nextParents);
			return this.createTextUrl(replaced, mediaType);
		}

		return this.createBinaryUrl(resolvedUrl, mediaType);
	}

	async replaceMarkup(
		markup: string,
		mediaType: SupportedType,
		baseUrl: string,
		parentKey: string,
		parents?: string[]
	): Promise<string> {
		let doc = new DOMParser().parseFromString(markup, mediaType);

		if (doc.querySelector("parsererror") && mediaType !== "text/html") {
			doc = new DOMParser().parseFromString(markup, "text/html");
		}

		await this.replaceDocument(doc, baseUrl, parentKey, parents || []);

		return new XMLSerializer().serializeToString(doc);
	}

	async replaceDocument(doc: Document, baseUrl: string, parentKey: string, parents?: string[]): Promise<void> {
		const replaceAttribute = async (el, attr) => {
			const value = el.getAttribute(attr);
			const replaced = await this.loadHref(value, baseUrl, parentKey, parents);
			if (replaced && replaced !== value) {
				el.setAttribute(attr, replaced);
			}
		};

		for (const el of Array.from(doc.querySelectorAll("link[href]"))) {
			const rel = (el.getAttribute("rel") || "").toLowerCase();
			if (rel.split(/\s+/).indexOf("stylesheet") === -1) {
				continue;
			}
			await replaceAttribute(el, "href");
		}

		for (const el of Array.from(doc.querySelectorAll("[src]"))) {
			await replaceAttribute(el, "src");
		}

		for (const el of Array.from(doc.querySelectorAll("[poster]"))) {
			await replaceAttribute(el, "poster");
		}

		for (const el of Array.from(doc.querySelectorAll("object[data]"))) {
			await replaceAttribute(el, "data");
		}

		for (const el of Array.from(doc.querySelectorAll("image[href], use[href]"))) {
			await replaceAttribute(el, "href");
		}

		for (const el of Array.from(doc.querySelectorAll("[*|href]:not([href])"))) {
			const value = el.getAttributeNS(XLINK_NS, "href");
			const replaced = await this.loadHref(value, baseUrl, parentKey, parents);
			if (replaced && replaced !== value) {
				el.setAttributeNS(XLINK_NS, "href", replaced);
			}
		}

		for (const el of Array.from(doc.querySelectorAll("[srcset]"))) {
			const value = el.getAttribute("srcset");
			if (!value) {
				continue;
			}
			const replaced = await this.replaceSrcset(value, baseUrl, parentKey, parents);
			if (replaced && replaced !== value) {
				el.setAttribute("srcset", replaced);
			}
		}

		for (const el of Array.from(doc.querySelectorAll("style"))) {
			if (!el.textContent) {
				continue;
			}
			el.textContent = await this.replaceCSS(el.textContent, baseUrl, parentKey, parents);
		}

		for (const el of Array.from(doc.querySelectorAll("[style]"))) {
			const value = el.getAttribute("style");
			if (!value) {
				continue;
			}
			el.setAttribute("style", await this.replaceCSS(value, baseUrl, parentKey, parents));
		}
	}

	async replaceSrcset(srcset: string, baseUrl: string, parentKey: string, parents?: string[]): Promise<string> {
		const parts = srcset
			.split(",")
			.map((part) => part.trim())
			.filter(Boolean);

		const rewritten = [];

		for (const part of parts) {
			const segments = part.split(/\s+/).filter(Boolean);
			const url = segments.shift();
			if (!url) {
				continue;
			}
			const replacedUrl = await this.loadHref(url, baseUrl, parentKey, parents);
			rewritten.push([replacedUrl].concat(segments).join(" "));
		}

		return rewritten.join(", ");
	}

	async replaceCSS(str: string, baseUrl: string, parentKey: string, parents?: string[]): Promise<string> {
		const replacedUrls = await replaceSeries(
			str,
			/url\(\s*["']?([^'"\n]*?)\s*["']?\s*\)/gi,
			(_, url) => this.loadHref(url, baseUrl, parentKey, parents).then((nextUrl) => `url("${nextUrl}")`)
		);

		return replaceSeries(
			replacedUrls,
			/@import\s*["']([^"'\n]*?)["']/gi,
			(_, url) => this.loadHref(url, baseUrl, parentKey, parents).then((nextUrl) => `@import "${nextUrl}"`)
		);
	}

	destroy(): void {
		this.resourceCache && this.resourceCache.clear();
		this.resourceCache = undefined;
		this.resolvedManifest = undefined;
		if (this.replacementUrls && this.replacementUrls.length) {
			this.replacementUrls.forEach((url) => {
				if (url && typeof url === "string" && url.indexOf("blob:") === 0) {
					try {
						URL.revokeObjectURL(url);
					} catch (e) {
						// NOOP
					}
				}
			});
		}
		this.settings = undefined;
		this.manifest = undefined;
		this.resources = undefined;
		this.replacementUrls = undefined;
		this.html = undefined;
		this.assets = undefined;
		this.css = undefined;

		this.urls = undefined;
		this.cssUrls = undefined;
	}
}

export default Resources;
