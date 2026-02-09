import ResourceCache from "./core/resource-cache";

import type { Manifest, ManifestItem, ResourcesSettings } from "./resources/types";

export type { ResourcesSettings } from "./resources/types";

import {
	buildResolvedManifest as buildResolvedManifestImpl,
	process as processImpl,
	split as splitImpl,
	splitUrls as splitUrlsImpl,
} from "./resources/setup";
import {
	createCssFile as createCssFileImpl,
	createUrl as createUrlImpl,
	get as getImpl,
	relativeTo as relativeToImpl,
	replacements as replacementsImpl,
	replaceCss as replaceCssImpl,
	substituteContent as substituteContentImpl,
} from "./resources/url";
import {
	createBinaryUrl as createBinaryUrlImpl,
	createItem as createItemImpl,
	createTextUrl as createTextUrlImpl,
	isExternalUrl as isExternalUrlImpl,
	isReplaceableType as isReplaceableTypeImpl,
	loadBlob as loadBlobImpl,
	loadHref as loadHrefImpl,
	loadItem as loadItemImpl,
	loadText as loadTextImpl,
	replace as replaceImpl,
	resolveUrl as resolveUrlImpl,
	unload as unloadImpl,
} from "./resources/lazy";
import {
	replaceCSS as replaceCSSImpl,
	replaceDocument as replaceDocumentImpl,
	replaceMarkup as replaceMarkupImpl,
	replaceSrcset as replaceSrcsetImpl,
} from "./resources/rewrite";
import { destroy as destroyImpl } from "./resources/lifecycle";

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

	process(manifest: Manifest): void {
		return processImpl.call(this, manifest);
	}

	split(): void {
		return splitImpl.call(this);
	}

	splitUrls(): void {
		return splitUrlsImpl.call(this);
	}

	buildResolvedManifest(): void {
		return buildResolvedManifestImpl.call(this);
	}

	createUrl (url: string): Promise<string> {
		return createUrlImpl.call(this, url);
	}

	replacements(): Promise<Array<string | undefined>> {
		return replacementsImpl.call(this);
	}

	replaceCss(archive?: any, resolver?: any): Promise<any[]> {
		return replaceCssImpl.call(this, archive, resolver);
	}

	createCssFile(href: string, archive?: any, resolver?: any): Promise<string | undefined> {
		return createCssFileImpl.call(this, href, archive, resolver);
	}

	relativeTo(absolute: string, resolver?: any): string[] {
		return relativeToImpl.call(this, absolute, resolver);
	}

	get(path: string): Promise<string> | undefined {
		return getImpl.call(this, path);
	}

	substitute(content: string, url?: string): string {
		return substituteContentImpl.call(this, content, url);
	}

	replace(output: string, section: any): Promise<string> {
		return replaceImpl.call(this, output, section);
	}

	unload(parentKey: string): void {
		return unloadImpl.call(this, parentKey);
	}

	isExternalUrl(href: string): boolean {
		return isExternalUrlImpl.call(this, href);
	}

	resolveUrl(href: string, baseUrl: string): string {
		return resolveUrlImpl.call(this, href, baseUrl);
	}

	loadText(url: string): Promise<string> {
		return loadTextImpl.call(this, url);
	}

	loadBlob(url: string, mimeType: string): Promise<Blob> {
		return loadBlobImpl.call(this, url, mimeType);
	}

	createTextUrl(text: string, mediaType: string): Promise<string> {
		return createTextUrlImpl.call(this, text, mediaType);
	}

	createBinaryUrl(url: string, mediaType: string): Promise<string> {
		return createBinaryUrlImpl.call(this, url, mediaType);
	}

	isReplaceableType(mediaType: string): boolean {
		return isReplaceableTypeImpl.call(this, mediaType);
	}

	loadHref(href: string, baseUrl: string, parentKey: string, parents?: string[]): Promise<string> {
		return loadHrefImpl.call(this, href, baseUrl, parentKey, parents);
	}

	loadItem(resolvedUrl: string, item: ManifestItem, parentKey: string, parents?: string[]): Promise<string> {
		return loadItemImpl.call(this, resolvedUrl, item, parentKey, parents);
	}

	createItem(resolvedUrl: string, item: ManifestItem, parents?: string[]): Promise<string> {
		return createItemImpl.call(this, resolvedUrl, item, parents);
	}

	replaceMarkup(
		markup: string,
		mediaType: SupportedType,
		baseUrl: string,
		parentKey: string,
		parents?: string[]
	): Promise<string> {
		return replaceMarkupImpl.call(this, markup, mediaType, baseUrl, parentKey, parents);
	}

	replaceDocument(doc: Document, baseUrl: string, parentKey: string, parents?: string[]): Promise<void> {
		return replaceDocumentImpl.call(this, doc, baseUrl, parentKey, parents);
	}

	replaceSrcset(srcset: string, baseUrl: string, parentKey: string, parents?: string[]): Promise<string> {
		return replaceSrcsetImpl.call(this, srcset, baseUrl, parentKey, parents);
	}

	replaceCSS(str: string, baseUrl: string, parentKey: string, parents?: string[]): Promise<string> {
		return replaceCSSImpl.call(this, str, baseUrl, parentKey, parents);
	}

	destroy(): void {
		return destroyImpl.call(this);
	}
}

export default Resources;

