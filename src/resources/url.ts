import { substitute } from "../utils/replacements";
import { createBase64Url, createBlobUrl, blob2base64 } from "../utils/core";
import Url from "../utils/url";
import mime from "../utils/mime";
import Path from "../utils/path";
import path from "path-webpack";
import type { ResourcesArchive, ResourcesResolver } from "./types";

/**
 * Create a url to a resource
 * @param {string} url
 * @return {Promise<string>} Promise resolves with url string
 */
export function createUrl (url: string): Promise<string> {
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
export function replacements(): Promise<Array<string | undefined>> {
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
export function replaceCss(archive?: ResourcesArchive, resolver?: ResourcesResolver): Promise<any[]> {
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
export function createCssFile(href: string, archive?: ResourcesArchive, resolver?: ResourcesResolver): Promise<string | undefined> {
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
export function relativeTo(absolute: string, resolver?: ResourcesResolver): string[] {
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
export function get(path: string): Promise<string> | undefined {
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
export function substituteContent(content: string, url?: string): string {
	var relUrls;
	if (url) {
		relUrls = this.relativeTo(url);
	} else {
		relUrls = this.urls;
	}
	return substitute(content, relUrls, this.replacementUrls);
}

