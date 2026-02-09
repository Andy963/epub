import type { Manifest } from "./types";

/**
 * Process resources
 * @param {Manifest} manifest
 */
export function process(manifest: Manifest): void {
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
export function split(): void {

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
export function splitUrls(): void {

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

export function buildResolvedManifest(): void {
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

