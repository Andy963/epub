import EventEmitter from "event-emitter";
import {extend, defer} from "./utils/core";
import Url from "./utils/url";
import Path from "./utils/path";
import Spine from "./spine";
import Locations from "./locations";
import Container from "./container";
import Packaging from "./packaging";
import Navigation from "./navigation";
import Resources from "./resources";
import PageList from "./pagelist";
import Rendition from "./rendition";
import Archive from "./archive";
import request from "./utils/request";
import EpubCFI from "./epubcfi";
import Store from "./store";
import DisplayOptions from "./displayoptions";
import PerformanceTracker from "./utils/performance";
import ResourceResolver from "./core/resource-resolver";
import SpineLoader from "./core/spine-loader";
import ZipJsArchive from "./core/zipjs-archive";
import { EPUBJS_VERSION, EVENTS } from "./utils/constants";

const CONTAINER_PATH = "META-INF/container.xml";
const IBOOKS_DISPLAY_OPTIONS_PATH = "META-INF/com.apple.ibooks.display-options.xml";

const INPUT_TYPE = {
	BINARY: "binary",
	BASE64: "base64",
	EPUB: "epub",
	OPF: "opf",
	MANIFEST: "json",
	DIRECTORY: "directory"
};

/**
 * An Epub representation with methods for the loading, parsing and manipulation
 * of its contents.
 * @class
 * @param {string} [url]
 * @param {object} [options]
 * @param {method} [options.requestMethod] a request function to use instead of the default
 * @param {boolean} [options.requestCredentials=undefined] send the xhr request withCredentials
 * @param {object} [options.requestHeaders=undefined] send the xhr request headers
 * @param {("jszip"|"zipjs")} [options.archiveMethod=undefined] choose archive backend for `.epub` inputs
 * @param {any} [options.zipjs=undefined] provide zip.js module when using `archiveMethod: "zipjs"`
 * @param {string} [options.encoding=binary] optional to pass 'binary' or base64' for archived Epubs
 * @param {string} [options.replacements=none] use base64, blobUrl, or none for replacing assets in archived Epubs
 * @param {method} [options.canonical] optional function to determine canonical urls for a path
 * @param {string} [options.openAs] optional string to determine the input type
 * @param {string} [options.store=false] cache the contents in local storage, value should be the name of the reader
 * @returns {Book}
 * @example new Book("/path/to/book.epub", {})
 * @example new Book({ replacements: "blobUrl" })
 */
class Book {
	constructor(url, options) {
		// Allow passing just options to the Book
		if (typeof(options) === "undefined" &&
			  typeof(url) !== "string" &&
		    url instanceof Blob === false &&
		    url instanceof ArrayBuffer === false &&
		    url instanceof Uint8Array === false) {
			options = url;
			url = undefined;
		}

		this.settings = extend(this.settings || {}, {
			requestMethod: undefined,
			requestCredentials: undefined,
			requestHeaders: undefined,
			encoding: undefined,
			replacements: undefined,
			canonical: undefined,
			openAs: undefined,
			store: undefined,
			archiveMethod: undefined,
			zipjs: undefined,
			metrics: false,
			prefetchDistance: 1,
			maxLoadedSections: 0,
			lazyResources: false
		});

		extend(this.settings, options);

		const metricsOptions = typeof this.settings.metrics === "undefined" ? false : this.settings.metrics;
		this.performance = new PerformanceTracker(metricsOptions);

		// Promises
		this.opening = new defer();
		/**
		 * @member {promise} opened returns after the book is loaded
		 * @memberof Book
		 */
		this.opened = this.opening.promise;
		this.isOpen = false;

		this.loading = {
			manifest: new defer(),
			spine: new defer(),
			metadata: new defer(),
			cover: new defer(),
			navigation: new defer(),
			pageList: new defer(),
			resources: new defer(),
			displayOptions: new defer()
		};

		this.loaded = {
			manifest: this.loading.manifest.promise,
			spine: this.loading.spine.promise,
			metadata: this.loading.metadata.promise,
			cover: this.loading.cover.promise,
			navigation: this.loading.navigation.promise,
			pageList: this.loading.pageList.promise,
			resources: this.loading.resources.promise,
			displayOptions: this.loading.displayOptions.promise
		};

		/**
		 * @member {promise} ready returns after the book is loaded and parsed
		 * @memberof Book
		 * @private
		 */
		this.ready = Promise.all([
			this.loaded.manifest,
			this.loaded.spine,
			this.loaded.metadata,
			this.loaded.cover,
			this.loaded.navigation,
			this.loaded.resources,
			this.loaded.displayOptions
		]);


		// Queue for methods used before opening
		this.isRendered = false;
		// this._q = queue(this);

		/**
		 * @member {method} request
		 * @memberof Book
		 * @private
		 */
		this.request = this.settings.requestMethod || request;

		/**
		 * @member {Spine} spine
		 * @memberof Book
		 */
		this.spine = new Spine();

		/**
		 * @member {Locations} locations
		 * @memberof Book
		 */
		this.locations = new Locations(this.spine, this.load.bind(this));

		/**
		 * @member {Navigation} navigation
		 * @memberof Book
		 */
		this.navigation = undefined;

		/**
		 * @member {PageList} pagelist
		 * @memberof Book
		 */
		this.pageList = undefined;

		/**
		 * @member {Url} url
		 * @memberof Book
		 * @private
		 */
		this.url = undefined;

		/**
		 * @member {Path} path
		 * @memberof Book
		 * @private
		 */
		this.path = undefined;

		/**
		 * @member {boolean} archived
		 * @memberof Book
		 * @private
		 */
		this.archived = false;

		/**
		 * @member {Archive} archive
		 * @memberof Book
		 * @private
		 */
		this.archive = undefined;

		this.resourceResolver = new ResourceResolver({
			resolvePath: this.resolve.bind(this),
			isArchived: () => this.archived,
			requestArchive: (resolvedPath, type) => this.archive.request(resolvedPath, type),
			requestRemote: (resolvedPath, type, credentials, headers, options) => this.request(resolvedPath, type, credentials, headers, options),
			requestCredentials: () => this.settings.requestCredentials,
			requestHeaders: () => this.settings.requestHeaders,
			performance: this.performance
		});

		this.spineLoader = new SpineLoader({
			loadResource: this.load.bind(this),
			performance: this.performance,
			maxLoadedSections: this.settings.maxLoadedSections
		});

		/**
		 * @member {Store} storage
		 * @memberof Book
		 * @private
		 */
		this.storage = undefined;

		/**
		 * @member {Resources} resources
		 * @memberof Book
		 * @private
		 */
		this.resources = undefined;

		/**
		 * @member {Rendition} rendition
		 * @memberof Book
		 * @private
		 */
		this.rendition = undefined;

		/**
		 * @member {Container} container
		 * @memberof Book
		 * @private
		 */
		this.container = undefined;

		/**
		 * @member {Packaging} packaging
		 * @memberof Book
		 * @private
		 */
		this.packaging = undefined;

		/**
		 * @member {DisplayOptions} displayOptions
		 * @memberof DisplayOptions
		 * @private
		 */
		this.displayOptions = undefined;

		// this.toc = undefined;
		if (this.settings.store) {
			this.store(this.settings.store);
		}

		if(url) {
			this.open(url, this.settings.openAs).catch((error) => {
				var err = new Error("Cannot load book at "+ url );
				this.emit(EVENTS.BOOK.OPEN_FAILED, err);
			});
		}
	}

	/**
	 * Open a epub or url
	 * @param {string | ArrayBuffer} input Url, Path or ArrayBuffer
	 * @param {string} [what="binary", "base64", "epub", "opf", "json", "directory"] force opening as a certain type
	 * @returns {Promise} of when the book has been loaded
	 * @example book.open("/path/to/book.epub")
	 */
	open(input, what) {
		var opening;
		var type = what || this.determineType(input);
		var span = this.performance.start("book.open", {
			type: type
		});

		if (type === INPUT_TYPE.BINARY) {
			this.archived = true;
			this.url = new Url("/", "");
			opening = this.openEpub(input);
		} else if (type === INPUT_TYPE.BASE64) {
			this.archived = true;
			this.url = new Url("/", "");
			opening = this.openEpub(input, type);
		} else if (type === INPUT_TYPE.EPUB) {
			this.archived = true;
			this.url = new Url("/", "");
			if (this.settings.archiveMethod === "zipjs") {
				opening = this.openEpub(input);
			} else {
				opening = this.request(
					input,
					"binary",
					this.settings.requestCredentials,
					this.settings.requestHeaders
				).then(this.openEpub.bind(this));
			}
		} else if(type == INPUT_TYPE.OPF) {
			this.url = new Url(input);
			opening = this.openPackaging(this.url.Path.toString());
		} else if(type == INPUT_TYPE.MANIFEST) {
			this.url = new Url(input);
			opening = this.openManifest(this.url.Path.toString());
		} else {
			this.url = new Url(input);
			opening = this.openContainer(CONTAINER_PATH)
				.then(this.openPackaging.bind(this));
		}

		return opening.then((result) => {
			this.performance.end(span, {
				status: "resolved"
			});
			return result;
		}).catch((error) => {
			this.performance.end(span, {
				status: "rejected",
				error: error && error.message
			});
			throw error;
		});
	}

	/**
	 * Open an archived epub
	 * @private
	 * @param  {binary} data
	 * @param  {string} [encoding]
	 * @return {Promise}
	 */
	openEpub(data, encoding) {
		return this.unarchive(data, encoding || this.settings.encoding)
			.then(() => {
				return this.openContainer(CONTAINER_PATH);
			})
			.then((packagePath) => {
				return this.openPackaging(packagePath);
			});
	}

	/**
	 * Open the epub container
	 * @private
	 * @param  {string} url
	 * @return {string} packagePath
	 */
	openContainer(url) {
		return this.load(url)
			.then((xml) => {
				this.container = new Container(xml);
				return this.resolve(this.container.packagePath);
			});
	}

	/**
	 * Open the Open Packaging Format Xml
	 * @private
	 * @param  {string} url
	 * @return {Promise}
	 */
	openPackaging(url) {
		this.path = new Path(url);
		return this.load(url)
			.then((xml) => {
				this.packaging = new Packaging(xml);
				return this.unpack(this.packaging);
			});
	}

	/**
	 * Open the manifest JSON
	 * @private
	 * @param  {string} url
	 * @return {Promise}
	 */
	openManifest(url) {
		this.path = new Path(url);
		return this.load(url)
			.then((json) => {
				this.packaging = new Packaging();
				this.packaging.load(json);
				return this.unpack(this.packaging);
			});
	}

	/**
	 * Load a resource from the Book
	 * @param  {string} path path to the resource to load
	 * @param  {string} [type] specify the type of the returned result
	 * @param  {boolean} [withCredentials]
	 * @param  {object} [headers]
	 * @param  {object} [options]
	 * @return {Promise}     returns a promise with the requested resource
	 */
	load(path, type, withCredentials, headers, options) {
		return this.resourceResolver.load(path, type, withCredentials, headers, options);
	}

	/**
	 * Get a snapshot of collected performance entries
	 * @returns {{enabled: boolean, counters: object, entries: Array, activeSpans: number}}
	 */
	getPerformanceSnapshot() {
		return this.performance.snapshot();
	}

	/**
	 * Clear recorded performance entries and counters
	 */
	clearPerformanceMetrics() {
		this.performance.reset();
	}

	/**
	 * Prefetch neighboring sections for a target section
	 * @param  {Section | string | number} target
	 * @param  {number | boolean} [distance]
	 * @return {Promise<Array<any>>}
	 */
	prefetch(target, distance) {
		if (!this.spineLoader) {
			return Promise.resolve([]);
		}

		let section = target;
		if (!section || typeof section.load !== "function") {
			section = this.spine.get(target);
		}

		if (!section) {
			return Promise.resolve([]);
		}

		if (distance === false) {
			return Promise.resolve([]);
		}

		let resolvedDistance = distance;
		if (resolvedDistance === true || typeof resolvedDistance === "undefined" || resolvedDistance === null) {
			resolvedDistance = this.settings.prefetchDistance;
		}

		if (typeof resolvedDistance !== "number" || resolvedDistance <= 0) {
			resolvedDistance = 1;
		}

		const span = this.performance.start("book.prefetch", {
			sectionIndex: section.index,
			href: section.href,
			distance: resolvedDistance
		});

		return this.spineLoader.prefetch(section, resolvedDistance).then((results) => {
			this.performance.end(span, {
				status: "resolved",
				loaded: results.filter(Boolean).length
			});
			return results;
		}).catch((error) => {
			this.performance.end(span, {
				status: "rejected",
				error: error && error.message
			});
			throw error;
		});
	}

	/**
	 * Cancel active prefetch tasks
	 */
	cancelPrefetch() {
		if (!this.spineLoader) {
			return;
		}

		return this.spineLoader.cancelPrefetch();
	}

	pinSection(target) {
		if (!this.spineLoader || typeof this.spineLoader.pin !== "function") {
			return;
		}

		let section = target;
		if (!section || typeof section.load !== "function") {
			section = this.spine.get(target);
		}

		if (!section) {
			return;
		}

		this.spineLoader.pin(section);
	}

	unpinSection(target) {
		if (!this.spineLoader || typeof this.spineLoader.unpin !== "function") {
			return;
		}

		let section = target;
		if (!section || typeof section.load !== "function") {
			section = this.spine.get(target);
		}

		if (!section) {
			return;
		}

		this.spineLoader.unpin(section);
	}

	/**
	 * Resolve a path to it's absolute position in the Book
	 * @param  {string} path
	 * @param  {boolean} [absolute] force resolving the full URL
	 * @return {string}          the resolved path string
	 */
	resolve(path, absolute) {
		if (!path) {
			return;
		}
		var resolved = path;
		var isAbsolute = (path.indexOf("://") > -1);

		if (isAbsolute) {
			return path;
		}

		if (this.path) {
			resolved = this.path.resolve(path);
		}

		if(absolute != false && this.url) {
			resolved = this.url.resolve(resolved);
		}

		return resolved;
	}

	/**
	 * Get a canonical link to a path
	 * @param  {string} path
	 * @return {string} the canonical path string
	 */
	canonical(path) {
		var url = path;

		if (!path) {
			return "";
		}

		if (this.settings.canonical) {
			url = this.settings.canonical(path);
		} else {
			url = this.resolve(path, true);
		}

		return url;
	}

	/**
	 * Determine the type of they input passed to open
	 * @private
	 * @param  {string} input
	 * @return {string}  binary | directory | epub | opf
	 */
	determineType(input) {
		var url;
		var path;
		var extension;

		if (this.settings.encoding === "base64") {
			return INPUT_TYPE.BASE64;
		}

		if(typeof(input) != "string") {
			return INPUT_TYPE.BINARY;
		}

		url = new Url(input);
		path = url.path();
		extension = path.extension;

		// If there's a search string, remove it before determining type
		if (extension) {
			extension = extension.replace(/\?.*$/, "");
		}

		if (!extension) {
			return INPUT_TYPE.DIRECTORY;
		}

		if(extension === "epub"){
			return INPUT_TYPE.EPUB;
		}

		if(extension === "opf"){
			return INPUT_TYPE.OPF;
		}

		if(extension === "json"){
			return INPUT_TYPE.MANIFEST;
		}
	}


	/**
	 * unpack the contents of the Books packaging
	 * @private
	 * @param {Packaging} packaging object
	 */
	unpack(packaging) {
		this.package = packaging; //TODO: deprecated this

		if (this.packaging.metadata.layout === "") {
			// rendition:layout not set - check display options if book is pre-paginated
			this.load(this.url.resolve(IBOOKS_DISPLAY_OPTIONS_PATH)).then((xml) => {
				this.displayOptions = new DisplayOptions(xml);
				this.loading.displayOptions.resolve(this.displayOptions);
			}).catch((err) => {
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
			performance: this.performance
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

		if(this.archived || this.settings.replacements && this.settings.replacements != "none") {
			this.replacements().then(() => {
				this.loaded.displayOptions.then(() => {
					this.performance.mark("book.ready", {
						archived: this.archived,
						spineLength: this.spine && this.spine.length
					});
					this.opening.resolve(this);
				});
			}).catch((err) => {
				console.error(err);
			});
		} else {
			// Resolve book opened promise
			this.loaded.displayOptions.then(() => {
				this.performance.mark("book.ready", {
					archived: this.archived,
					spineLength: this.spine && this.spine.length
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
	loadNavigation(packaging) {
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

		return this.load(navPath, "xml")
			.then((xml) => {
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
	 * Gets a Section of the Book from the Spine
	 * Alias for `book.spine.get`
	 * @param {string} target
	 * @return {Section}
	 */
	section(target) {
		return this.spine.get(target);
	}

	/**
	 * Sugar to render a book to an element
	 * @param  {element | string} element element or string to add a rendition to
	 * @param  {object} [options]
	 * @return {Rendition}
	 */
	renderTo(element, options) {
		this.rendition = new Rendition(this, options);
		this.rendition.attachTo(element);

		return this.rendition;
	}

	/**
	 * Set if request should use withCredentials
	 * @param {boolean} credentials
	 */
	setRequestCredentials(credentials) {
		this.settings.requestCredentials = credentials;
	}

	/**
	 * Set headers request should use
	 * @param {object} headers
	 */
	setRequestHeaders(headers) {
		this.settings.requestHeaders = headers;
	}

	/**
	 * Unarchive a zipped epub
	 * @private
	 * @param  {binary} input epub data
	 * @param  {string} [encoding]
	 * @return {Archive}
	 */
	unarchive(input, encoding) {
		const isBase64 = encoding === "base64";

		if (this.settings.archiveMethod === "zipjs") {
			this.archive = new ZipJsArchive({
				zipjs: this.settings.zipjs,
				requestHeaders: this.settings.requestHeaders
			});

			if (typeof input === "string") {
				if (isBase64) {
					return this.archive.open(input, true);
				}
				return this.archive.openUrl(input, false);
			}

			return this.archive.open(input, isBase64);
		}

		this.archive = new Archive();
		if (typeof input === "string") {
			if (isBase64) {
				return this.archive.open(input, true);
			}
			return this.archive.openUrl(input, false);
		}
		return this.archive.open(input, isBase64);
	}

	/**
	 * Store the epubs contents
	 * @private
	 * @param  {binary} input epub data
	 * @param  {string} [encoding]
	 * @return {Store}
	 */
	store(name) {
		// Use "blobUrl" or "base64" for replacements
		let replacementsSetting = this.settings.replacements && this.settings.replacements !== "none";
		// Save original url
		let originalUrl = this.url;
		// Save original request method
		let requester = this.settings.requestMethod || request.bind(this);
		// Create new Store
		this.storage = new Store(name, requester, this.resolve.bind(this));
		// Replace request method to go through store
		this.request = this.storage.request.bind(this.storage);

		this.opened.then(() => {
			if (this.archived) {
				this.storage.requester = this.archive.request.bind(this.archive);
			}
			// Substitute hook
			let substituteResources = (output, section) => {
				if (this.resources && this.resources.settings && this.resources.settings.lazy) {
					return this.resources.replace(output, section);
				}

				section.output = this.resources.substitute(output, section.url);
			};

			// Set to use replacements
			this.resources.settings.replacements = replacementsSetting || "blobUrl";
			// Create replacement urls
			if (!this.resources.settings.lazy) {
				this.resources.replacements().then(() => {
					return this.resources.replaceCss();
				});
			}

			this.storage.on("offline", () => {
				// Remove url to use relative resolving for hrefs
				this.url = new Url("/", "");
				// Add hook to replace resources in contents
				this.spine.hooks.serialize.register(substituteResources);
			});

			this.storage.on("online", () => {
				// Restore original url
				this.url = originalUrl;
				// Remove hook
				this.spine.hooks.serialize.deregister(substituteResources);
			});

		});

		return this.storage;
	}

	/**
	 * Get the cover url
	 * @return {Promise<?string>} coverUrl
	 */
	coverUrl() {
		return this.loaded.cover.then(() => {
			if (!this.cover) {
				return null;
			}

			if (this.archived) {
				return this.archive.createUrl(this.cover);
			} else {
				return this.cover;
			}
		});
	}

	/**
	 * Load replacement urls
	 * @private
	 * @return {Promise} completed loading urls
	 */
	replacements() {
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

	/**
	 * Find a DOM Range for a given CFI Range
	 * @param  {EpubCFI} cfiRange a epub cfi range
	 * @return {Promise}
	 */
	getRange(cfiRange) {
		var cfi = new EpubCFI(cfiRange);
		var item = this.spine.get(cfi.spinePos);
		if (!item) {
			return new Promise((resolve, reject) => {
				reject("CFI could not be found");
			});
		}
		return this.spineLoader.load(item).then(function () {
			var range = cfi.toRange(item.document);
			return range;
		});
	}

	/**
	 * Search the book for a string
	 * @param {string} query
	 * @param {object} [options]
	 * @param {AbortSignal} [options.signal]
	 * @param {number} [options.maxResults]
	 * @param {number} [options.maxSeqEle]
	 * @param {boolean} [options.unload=true] unload sections after searching (skips pinned sections)
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
		const maxSeqEle = typeof options.maxSeqEle === "number" && options.maxSeqEle > 0 ? Math.floor(options.maxSeqEle) : undefined;
		const unload = options.unload !== false;
		const onProgress = typeof options.onProgress === "function" ? options.onProgress : undefined;

		let maxResults = Infinity;
		if (typeof options.maxResults === "number" && isFinite(options.maxResults) && options.maxResults >= 0) {
			maxResults = Math.floor(options.maxResults);
		}

		await this.ready;

		const sections = (this.spine && this.spine.spineItems) ? this.spine.spineItems : [];
		const total = sections.length;
		const results = [];

		for (let i = 0; i < sections.length; i += 1) {
			const section = sections[i];
			if (!section || !section.linear) {
				continue;
			}

			if (signal && signal.aborted) {
				throw {
					name: "AbortError",
					message: "Aborted"
				};
			}

			if (this.spineLoader) {
				await this.spineLoader.load(section, signal ? { signal } : undefined);
			} else {
				await section.load(signal ? (url) => this.load(url, undefined, undefined, undefined, { signal }) : this.load.bind(this));
			}

			const matches = maxSeqEle ? section.search(query, maxSeqEle) : section.search(query);
			for (const match of matches) {
				results.push({
					sectionIndex: section.index,
					href: section.href,
					cfi: match.cfi,
					excerpt: match.excerpt
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
					results: results.length
				});
			}

			if (unload && this.spineLoader && !this.spineLoader.isPinned(section) && typeof section.unload === "function") {
				section.unload();
			}

			if (results.length >= maxResults) {
				break;
			}
		}

		return results;
	}

	/**
	 * Search the book for a string without generating CFIs
	 * @param {string} query
	 * @param {object} [options]
	 * @param {AbortSignal} [options.signal]
	 * @param {number} [options.maxResults]
	 * @param {number} [options.maxResultsPerSection]
	 * @param {number} [options.excerptLimit]
	 * @param {string | string[]} [options.locales]
	 * @param {boolean} [options.matchCase=false]
	 * @param {boolean} [options.matchDiacritics=false]
	 * @param {boolean} [options.matchWholeWords=false]
	 * @param {boolean} [options.useWorker]
	 * @param {Worker} [options.worker]
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
		const maxResultsPerSection = typeof options.maxResultsPerSection === "number" && options.maxResultsPerSection > 0
			? Math.floor(options.maxResultsPerSection)
			: 50;
		const excerptLimit = typeof options.excerptLimit === "number" && options.excerptLimit > 0
			? Math.floor(options.excerptLimit)
			: 150;
		const localesOverride = options.locales;
		const matchCase = options.matchCase === true;
		const matchDiacritics = options.matchDiacritics === true;
		const matchWholeWords = options.matchWholeWords === true;
		const onProgress = typeof options.onProgress === "function" ? options.onProgress : undefined;

		let maxResults = Infinity;
		if (typeof options.maxResults === "number" && isFinite(options.maxResults) && options.maxResults >= 0) {
			maxResults = Math.floor(options.maxResults);
		}

		await this.ready;

		const sections = (this.spine && this.spine.spineItems) ? this.spine.spineItems : [];
		const total = sections.length;
		const results = [];

		const defaultLocales = this.packaging && this.packaging.metadata && this.packaging.metadata.language ? this.packaging.metadata.language : "en";
		const locales = localesOverride || defaultLocales;

		const stripMarkup = (markup) => {
			if (!markup || typeof markup !== "string") {
				return "";
			}
			return markup.replace(/<[^>]*>/g, " ");
		};

		const toLocaleLower = (value) => {
			if (matchCase) {
				return value;
			}
			try {
				return value.toLocaleLowerCase(locales);
			} catch (e) {
				return value.toLowerCase();
			}
		};

		const normalizeWhitespace = (value) => {
			return value.replace(/\s+/g, " ");
		};

		const makeExcerpt = (text, startOffset, endOffset) => {
			const half = Math.floor(excerptLimit / 2);
			const start = Math.max(0, startOffset - half);
			const end = Math.min(text.length, endOffset + half);
			let excerpt = normalizeWhitespace(text.slice(start, end)).trim();
			if (start > 0) {
				excerpt = "..." + excerpt;
			}
			if (end < text.length) {
				excerpt = excerpt + "...";
			}
			return excerpt;
		};

		let sensitivity = "base";
		if (matchDiacritics) {
			sensitivity = matchCase ? "variant" : "accent";
		} else {
			sensitivity = matchCase ? "case" : "base";
		}
		const granularity = matchWholeWords ? "word" : "grapheme";

		let segmenter;
		let collator;
		if (typeof Intl !== "undefined" && Intl.Segmenter && Intl.Collator) {
			try {
				segmenter = new Intl.Segmenter(locales, { usage: "search", granularity });
				collator = new Intl.Collator(locales, { sensitivity });
			} catch (e) {
				try {
					segmenter = new Intl.Segmenter("en", { usage: "search", granularity });
					collator = new Intl.Collator("en", { sensitivity });
				} catch (e2) {
					segmenter = undefined;
					collator = undefined;
				}
			}
		}

		let nonFormattingRegex;
		try {
			nonFormattingRegex = new RegExp("[^\\p{Format}]", "u");
		} catch (e) {
			nonFormattingRegex = undefined;
		}

		const findMatches = (text) => {
			const matches = [];
			const shouldUseSegmenter = !!(segmenter && collator) &&
				!(granularity === "grapheme" && (sensitivity === "variant" || sensitivity === "accent"));

			const searchSimple = () => {
				const haystack = toLocaleLower(text);
				const needle = toLocaleLower(query);
				let lastIndex = 0;

				while (matches.length < maxResultsPerSection) {
					const index = haystack.indexOf(needle, lastIndex);
					if (index === -1) {
						break;
					}

					matches.push({
						index,
						excerpt: makeExcerpt(text, index, index + needle.length)
					});
					lastIndex = index + needle.length;
				}
			};

			const searchSegmenter = () => {
				const queryLength = Array.from(segmenter.segment(query)).length;
				if (!queryLength) {
					return;
				}

				const substrArr = [];
				const segments = segmenter.segment(text)[Symbol.iterator]();

				const isFormatting = (segment) => {
					if (!nonFormattingRegex) {
						return false;
					}
					return !nonFormattingRegex.test(segment);
				};

				while (matches.length < maxResultsPerSection) {
					while (substrArr.length < queryLength) {
						const next = segments.next();
						if (next.done) {
							return;
						}
						const value = next.value;
						if (!value) {
							continue;
						}

						const segment = value.segment;
						if (!segment || isFormatting(segment)) {
							continue;
						}

						if (/\s/u.test(segment)) {
							const last = substrArr[substrArr.length - 1];
							if (!last || !/\s/u.test(last.segment)) {
								substrArr.push({ index: value.index, segment: " " });
							}
							continue;
						}

						substrArr.push({ index: value.index, segment });
					}

					const substr = substrArr.map((part) => part.segment).join("");
					if (collator.compare(query, substr) === 0) {
						const startOffset = substrArr[0].index;
						const lastSeg = substrArr[substrArr.length - 1];
						const endOffset = lastSeg.index + lastSeg.segment.length;
						matches.push({
							index: startOffset,
							excerpt: makeExcerpt(text, startOffset, endOffset)
						});
					}

					substrArr.shift();
				}
			};

			if (shouldUseSegmenter) {
				searchSegmenter();
			} else {
				searchSimple();
			}

			return matches;
		};

		const shouldUseWorker = options.useWorker && typeof Worker !== "undefined";
		const worker = shouldUseWorker ? (options.worker || this.createSearchWorker()) : undefined;
		const createdWorker = shouldUseWorker && !options.worker;
		let totalMatches = 0;

		const searchInWorker = (content) => {
			if (!worker) {
				return Promise.resolve([]);
			}

			const id = Math.random().toString(36).slice(2);
			return new Promise((resolve, reject) => {
				const onMessage = (event) => {
					const data = event && event.data;
					if (!data || data.id !== id) {
						return;
					}
					worker.removeEventListener("message", onMessage);
					worker.removeEventListener("error", onError);
					resolve(data.matches || []);
				};

				const onError = (event) => {
					worker.removeEventListener("message", onMessage);
					worker.removeEventListener("error", onError);
					reject(event);
				};

				worker.addEventListener("message", onMessage);
				worker.addEventListener("error", onError);

				worker.postMessage({
					id,
					query,
					content,
					maxResultsPerSection,
					excerptLimit,
					locales,
					matchCase,
					matchDiacritics,
					matchWholeWords
				});
			});
		};

		try {
			for (let i = 0; i < sections.length; i += 1) {
				const section = sections[i];
				if (!section || !section.linear) {
					continue;
				}

				if (signal && signal.aborted) {
					throw {
						name: "AbortError",
						message: "Aborted"
					};
				}

				const markup = await this.load(section.url, "text", undefined, undefined, signal ? { signal } : undefined);
				const text = stripMarkup(markup);
				const matches = worker ? await searchInWorker(text) : findMatches(text);

				if (matches.length) {
					let sectionMatches = matches;
					if (totalMatches + sectionMatches.length > maxResults) {
						sectionMatches = sectionMatches.slice(0, Math.max(0, maxResults - totalMatches));
					}

					results.push({
						sectionIndex: section.index,
						href: section.href,
						matches: sectionMatches
					});

					totalMatches += sectionMatches.length;
				}

				if (onProgress) {
					onProgress({
						sectionIndex: section.index,
						href: section.href,
						processed: i + 1,
						total,
						results: results.length
					});
				}

				if (totalMatches >= maxResults) {
					break;
				}
			}

			return results;
		} finally {
			if (createdWorker && worker) {
				worker.terminate();
			}
		}
	}

	createSearchWorker() {
		const source = `
self.onmessage = function(event) {
	var data = event && event.data;
	if (!data) return;
	var query = (data.query || "").trim();
	var content = data.content || "";
	var maxResultsPerSection = data.maxResultsPerSection || 50;
	var excerptLimit = data.excerptLimit || 150;
	var locales = data.locales || "en";
	var matchCase = data.matchCase === true;
	var matchDiacritics = data.matchDiacritics === true;
	var matchWholeWords = data.matchWholeWords === true;

	var normalizeWhitespace = function(value) {
		return String(value || "").replace(/\\s+/g, " ");
	};

	var makeExcerpt = function(text, startOffset, endOffset) {
		var half = Math.floor(excerptLimit / 2);
		var start = Math.max(0, startOffset - half);
		var end = Math.min(text.length, endOffset + half);
		var excerpt = normalizeWhitespace(text.slice(start, end)).trim();
		if (start > 0) excerpt = "..." + excerpt;
		if (end < text.length) excerpt = excerpt + "...";
		return excerpt;
	};

	var toLocaleLower = function(value) {
		if (matchCase) {
			return value;
		}
		try {
			return value.toLocaleLowerCase(locales);
		} catch (e) {
			return value.toLowerCase();
		}
	};

	var sensitivity = matchDiacritics && matchCase ? "variant"
		: matchDiacritics && !matchCase ? "accent"
		: !matchDiacritics && matchCase ? "case"
		: "base";
	var granularity = matchWholeWords ? "word" : "grapheme";

	if (!query) {
		self.postMessage({
			id: data.id,
			matches: []
		});
		return;
	}

	var matches = [];
	var segmenter;
	var collator;
	try {
		if (self.Intl && Intl.Segmenter && Intl.Collator) {
			segmenter = new Intl.Segmenter(locales, { usage: "search", granularity: granularity });
			collator = new Intl.Collator(locales, { sensitivity: sensitivity });
		}
	} catch (e) {
		segmenter = null;
		collator = null;
	}

	var nonFormattingRegex;
	try {
		nonFormattingRegex = new RegExp("[^\\\\p{Format}]", "u");
	} catch (e) {
		nonFormattingRegex = null;
	}

	var isFormatting = function(segment) {
		if (!nonFormattingRegex) {
			return false;
		}
		return !nonFormattingRegex.test(segment);
	};

	var shouldUseSegmenter = !!(segmenter && collator) &&
		!(granularity === "grapheme" && (sensitivity === "variant" || sensitivity === "accent"));

	if (shouldUseSegmenter) {
		var querySegments = Array.from(segmenter.segment(query));
		var queryLength = querySegments.length;
		if (queryLength) {
			var substrArr = [];
			var segments = segmenter.segment(content)[Symbol.iterator]();

			while (matches.length < maxResultsPerSection) {
				while (substrArr.length < queryLength) {
					var next = segments.next();
					if (next.done) {
						substrArr = null;
						break;
					}
					var value = next.value;
					if (!value) continue;
					var segment = value.segment;
					if (!segment || isFormatting(segment)) continue;
					if (/\\s/u.test(segment)) {
						var last = substrArr[substrArr.length - 1];
						if (!last || !/\\s/u.test(last.segment)) {
							substrArr.push({ index: value.index, segment: " " });
						}
						continue;
					}
					substrArr.push({ index: value.index, segment: segment });
				}

				if (!substrArr) break;

				var substr = substrArr.map(function(part) { return part.segment; }).join("");
				if (collator.compare(query, substr) === 0) {
					var startOffset = substrArr[0].index;
					var lastSeg = substrArr[substrArr.length - 1];
					var endOffset = lastSeg.index + lastSeg.segment.length;
					matches.push({ index: startOffset, excerpt: makeExcerpt(content, startOffset, endOffset) });
				}
				substrArr.shift();
			}
		}
	} else {
		var haystack = toLocaleLower(content);
		var needle = toLocaleLower(query);
		var needleLength = needle.length;
		var lastIndex = 0;
		while (matches.length < maxResultsPerSection) {
			var index = haystack.indexOf(needle, lastIndex);
			if (index === -1) break;
			matches.push({ index: index, excerpt: makeExcerpt(content, index, index + needleLength) });
			lastIndex = index + needleLength;
		}
	}

	self.postMessage({
		id: data.id,
		matches: matches
	});
};
`;

		const blob = new Blob([source], { type: "application/javascript" });
		const url = URL.createObjectURL(blob);
		const worker = new Worker(url);
		URL.revokeObjectURL(url);
		return worker;
	}

	/**
	 * Generates the Book Key using the identifier in the manifest or other string provided
	 * @param  {string} [identifier] to use instead of metadata identifier
	 * @return {string} key
	 */
	key(identifier) {
		var ident = identifier || this.packaging.metadata.identifier || this.url.filename;
		return `epubjs:${EPUBJS_VERSION}:${ident}`;
	}

	/**
	 * Destroy the Book and all associated objects
	 */
	destroy() {
		this.opened = undefined;
		this.loading = undefined;
		this.loaded = undefined;
		this.ready = undefined;

		this.isOpen = false;
		this.isRendered = false;

		this.performance && this.performance.reset();

		this.spine && this.spine.destroy();
		this.locations && this.locations.destroy();
		this.pageList && this.pageList.destroy();
		this.archive && this.archive.destroy();
		this.resources && this.resources.destroy();
		this.container && this.container.destroy();
		this.packaging && this.packaging.destroy();
		this.rendition && this.rendition.destroy();
		this.displayOptions && this.displayOptions.destroy();

		this.spine = undefined;
		this.locations = undefined;
		this.pageList = undefined;
		this.archive = undefined;
		this.resources = undefined;
		this.container = undefined;
		this.packaging = undefined;
		this.rendition = undefined;

		this.navigation = undefined;
		this.url = undefined;
		this.path = undefined;
		this.archived = false;
		this.resourceResolver = undefined;
		this.spineLoader = undefined;
		this.performance = undefined;
	}

}

//-- Enable binding events to book
EventEmitter(Book.prototype);

export default Book;
