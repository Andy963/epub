import { createBlobUrl, blob2base64 } from "../utils/core";
import Url from "../utils/url";
import mime from "../utils/mime";

export function replace(output: string, section: any): Promise<string> {
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

export function unload(parentKey: string): void {
	if (!this.resourceCache || !parentKey) {
		return;
	}
	this.resourceCache.releaseParent(parentKey);
}

export function isExternalUrl(href: string): boolean {
	if (!href || typeof href !== "string") {
		return true;
	}

	if (href.indexOf("#") === 0) {
		return true;
	}

	return /^[a-z][a-z0-9+.-]*:/i.test(href);
}

export function resolveUrl(href: string, baseUrl: string): string {
	const resolved = new Url(href, baseUrl);
	if (resolved.origin) {
		return resolved.origin + resolved.Path.path;
	}
	return resolved.Path.path;
}

export function loadText(url: string): Promise<string> {
	if (this.settings.archive) {
		const response = this.settings.archive.getText(url);
		if (!response) {
			return Promise.reject(new Error("File not found in archive: " + url));
		}
		return response;
	}

	return this.settings.request!(url, "text");
}

export function loadBlob(url: string, mimeType: string): Promise<Blob> {
	if (this.settings.archive) {
		const response = this.settings.archive.getBlob(url, mimeType);
		if (!response) {
			return Promise.reject(new Error("File not found in archive: " + url));
		}
		return response;
	}

	return this.settings.request!(url, "blob");
}

export function createTextUrl(text: string, mediaType: string): Promise<string> {
	if (this.settings.replacements === "base64") {
		return blob2base64(new Blob([text], { type: mediaType }));
	}

	return Promise.resolve(createBlobUrl(text, mediaType));
}

export function createBinaryUrl(url: string, mediaType: string): Promise<string> {
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

export function isReplaceableType(mediaType: string): boolean {
	return (
		mediaType === "text/css" ||
		mediaType === "application/xhtml+xml" ||
		mediaType === "text/html" ||
		mediaType === "image/svg+xml"
	);
}

export function loadHref(href: string, baseUrl: string, parentKey: string, parents?: string[]): Promise<string> {
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

export function loadItem(resolvedUrl: string, item, parentKey: string, parents?: string[]): Promise<string> {
	if (!this.resourceCache) {
		return Promise.resolve(resolvedUrl);
	}

	return this.resourceCache.acquire(resolvedUrl, parentKey, () => {
		return this.createItem(resolvedUrl, item, parents || []);
	});
}

export async function createItem(resolvedUrl: string, item, parents?: string[]): Promise<string> {
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

