import DisplayOptions from "../displayoptions";
import Resources from "../resources";
import Navigation from "../navigation";
import PageList from "../pagelist";
import { IBOOKS_DISPLAY_OPTIONS_PATH } from "./constants";

/**
 * unpack the contents of the Books packaging
 * @private
 * @param {Packaging} packaging object
 */
export function unpack(packaging) {
	this.package = packaging; //TODO: deprecated this

	const obfuscationPromise = this.loadFontObfuscation();

	if (this.packaging.metadata.layout === "") {
		// rendition:layout not set - check display options if book is pre-paginated
		this.load(this.url.resolve(IBOOKS_DISPLAY_OPTIONS_PATH))
			.then((xml) => {
				this.displayOptions = new DisplayOptions(xml);
				this.loading.displayOptions.resolve(this.displayOptions);
			})
			.catch((err) => {
				this.displayOptions = new DisplayOptions();
				this.loading.displayOptions.resolve(this.displayOptions);
			});
	} else {
		this.displayOptions = new DisplayOptions();
		this.loading.displayOptions.resolve(this.displayOptions);
	}

	this.spine.unpack(this.packaging, this.resolve.bind(this), this.canonical.bind(this));

	this.resources = new Resources(this.packaging.manifest, {
		archive: this.archive,
		resolver: this.resolve.bind(this),
		request: this.load.bind(this),
		replacements: this.settings.replacements || (this.archived ? "blobUrl" : "base64"),
		lazy: this.settings.lazyResources,
		performance: this.performance,
	});

	const obfuscationReady = Promise.resolve(obfuscationPromise).then(() => {
		return this.applyFontObfuscationReplacementsIfNeeded();
	});

	this.loadNavigation(this.packaging).then(() => {
		// this.toc = this.navigation.toc;
		this.loading.navigation.resolve(this.navigation);
	});

	if (this.packaging.coverPath) {
		this.cover = this.resolve(this.packaging.coverPath);
	}
	// Resolve promises
	this.loading.manifest.resolve(this.packaging.manifest);
	this.loading.metadata.resolve(this.packaging.metadata);
	this.loading.spine.resolve(this.spine);
	this.loading.cover.resolve(this.cover);
	this.loading.resources.resolve(this.resources);
	this.loading.pageList.resolve(this.pageList);

	this.isOpen = true;

	if (this.archived || (this.settings.replacements && this.settings.replacements != "none")) {
		Promise.resolve(obfuscationReady)
			.then(() => this.replacements())
			.then(() => {
				return this.loaded.displayOptions;
			})
			.then(() => {
				this.performance.mark("book.ready", {
					archived: this.archived,
					spineLength: this.spine && this.spine.length,
				});
				this.opening.resolve(this);
			})
			.catch((err) => {
				console.error(err);
			});
	} else {
		// Resolve book opened promise
		Promise.resolve(obfuscationReady)
			.then(() => this.loaded.displayOptions)
			.then(() => {
				this.performance.mark("book.ready", {
					archived: this.archived,
					spineLength: this.spine && this.spine.length,
				});
				this.opening.resolve(this);
			});
	}
}

/**
 * Load Navigation and PageList from package
 * @private
 * @param {Packaging} packaging
 */
export function loadNavigation(packaging) {
	let navPath = packaging.navPath || packaging.ncxPath;
	let toc = packaging.toc;

	// From json manifest
	if (toc) {
		return new Promise((resolve, reject) => {
			this.navigation = new Navigation(toc);

			if (packaging.pageList) {
				this.pageList = new PageList(packaging.pageList); // TODO: handle page lists from Manifest
			}

			resolve(this.navigation);
		});
	}

	if (!navPath) {
		return new Promise((resolve, reject) => {
			this.navigation = new Navigation();
			this.pageList = new PageList();

			resolve(this.navigation);
		});
	}

	return this.load(navPath, "xml").then((xml) => {
		this.navigation = new Navigation(xml);
		this.pageList = new PageList(xml);
		if (navPath) {
			const baseUrl = new URL(navPath.replace(/^\/+/, ""), "http://example.com/").href;

			const resolveNavHref = (href) => {
				if (!href || typeof href !== "string") {
					return href;
				}

				// Skip in-document links and absolute URLs
				if (href.indexOf("#") === 0 || href.indexOf("://") > -1) {
					return href;
				}

				try {
					const url = new URL(href, baseUrl);
					const pathname = url.pathname.replace(/^\/+/, "");
					return pathname + (url.search || "") + (url.hash || "");
				} catch (e) {
					return href;
				}
			};

			const normalizeNavItems = (items) => {
				if (!Array.isArray(items)) {
					return;
				}

				items.forEach((item) => {
					if (!item) {
						return;
					}

					if (item.href) {
						item.href = resolveNavHref(item.href);
					}

					if (item.subitems && item.subitems.length) {
						normalizeNavItems(item.subitems);
					}
				});
			};

			normalizeNavItems(this.navigation.toc);
			normalizeNavItems(this.navigation.landmarks);

			// Rebuild navigation lookup maps after normalization
			this.navigation.tocByHref = {};
			this.navigation.tocById = {};
			this.navigation.length = 0;
			this.navigation.unpack(this.navigation.toc);
		}
		return this.navigation;
	});
}

/**
 * Load replacement urls
 * @private
 * @return {Promise} completed loading urls
 */
export function replacements() {
	this.spine.hooks.serialize.register((output, section) => {
		if (this.resources && this.resources.settings && this.resources.settings.lazy) {
			return this.resources.replace(output, section);
		}

		section.output = this.resources.substitute(output, section.url);
	});

	if (this.resources && this.resources.settings && this.resources.settings.lazy) {
		return Promise.resolve();
	}

	return this.resources.replacements().then(() => {
		return this.resources.replaceCss();
	});
}
