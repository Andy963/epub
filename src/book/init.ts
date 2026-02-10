import { extend, defer } from "../utils/core";
import Spine from "../spine";
import Locations from "../locations";
import request from "../utils/request";
import PerformanceTracker from "../utils/performance";
import ResourceResolver from "../core/resource-resolver";
import SpineLoader from "../core/spine-loader";
import { EVENTS } from "../utils/constants";

export function initializeBook(book: any, url: any, options: any): void {
	book.settings = extend(book.settings || {}, {
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
		deobfuscate: true,
		metrics: false,
		prefetchDistance: 1,
		maxLoadedSections: 0,
		lazyResources: false,
	});

	extend(book.settings, options);

	const metricsOptions = typeof book.settings.metrics === "undefined" ? false : book.settings.metrics;
	book.performance = new PerformanceTracker(metricsOptions);

	// Promises
	book.opening = new defer();
	/**
	 * @member {promise} opened returns after the book is loaded
	 * @memberof Book
	 */
	book.opened = book.opening.promise;
	book.isOpen = false;

	book.loading = {
		manifest: new defer(),
		spine: new defer(),
		metadata: new defer(),
		cover: new defer(),
		navigation: new defer(),
		pageList: new defer(),
		resources: new defer(),
		displayOptions: new defer(),
	};

	book.loaded = {
		manifest: book.loading.manifest.promise,
		spine: book.loading.spine.promise,
		metadata: book.loading.metadata.promise,
		cover: book.loading.cover.promise,
		navigation: book.loading.navigation.promise,
		pageList: book.loading.pageList.promise,
		resources: book.loading.resources.promise,
		displayOptions: book.loading.displayOptions.promise,
	};

	/**
	 * @member {promise} ready returns after the book is loaded and parsed
	 * @memberof Book
	 * @private
	 */
	book.ready = Promise.all([
		book.loaded.manifest,
		book.loaded.spine,
		book.loaded.metadata,
		book.loaded.cover,
		book.loaded.navigation,
		book.loaded.resources,
		book.loaded.displayOptions,
	]);

	// Queue for methods used before opening
	book.isRendered = false;
	// book._q = queue(book);

	/**
	 * @member {method} request
	 * @memberof Book
	 * @private
	 */
	book.request = book.settings.requestMethod || request;

	/**
	 * @member {Spine} spine
	 * @memberof Book
	 */
	book.spine = new Spine();

	/**
	 * @member {Locations} locations
	 * @memberof Book
	 */
	book.locations = new Locations(book.spine, book.load.bind(book));

	/**
	 * @member {Navigation} navigation
	 * @memberof Book
	 */
	book.navigation = undefined;

	/**
	 * @member {PageList} pagelist
	 * @memberof Book
	 */
	book.pageList = undefined;

	/**
	 * @member {Url} url
	 * @memberof Book
	 * @private
	 */
	book.url = undefined;

	/**
	 * @member {Path} path
	 * @memberof Book
	 * @private
	 */
	book.path = undefined;

	/**
	 * @member {boolean} archived
	 * @memberof Book
	 * @private
	 */
	book.archived = false;

	/**
	 * @member {Archive} archive
	 * @memberof Book
	 * @private
	 */
	book.archive = undefined;
	book.obfuscation = undefined;

	book.resourceResolver = new ResourceResolver({
		resolvePath: book.resolve.bind(book),
		isArchived: () => book.archived,
		requestArchive: (resolvedPath, type) => book.archive.request(resolvedPath, type),
		requestRemote: (resolvedPath, type, credentials, headers, requestOptions) => {
			const loading = book.request(resolvedPath, type, credentials, headers, requestOptions);

			if (type !== "blob") {
				return loading;
			}

			const obfuscation = book.obfuscation;
			if (
				!obfuscation ||
				typeof obfuscation.isObfuscated !== "function" ||
				typeof obfuscation.deobfuscate !== "function"
			) {
				return loading;
			}

			if (!obfuscation.isObfuscated(resolvedPath)) {
				return loading;
			}

			return loading.then(async (blob) => {
				const signal = requestOptions && requestOptions.signal;
				if (signal && signal.aborted) {
					throw {
						name: "AbortError",
						message: "Aborted",
					};
				}

				if (!blob || typeof blob.arrayBuffer !== "function") {
					return blob;
				}

				const buffer = await blob.arrayBuffer();
				if (signal && signal.aborted) {
					throw {
						name: "AbortError",
						message: "Aborted",
					};
				}

				const bytes = new Uint8Array(buffer);
				const next = obfuscation.deobfuscate(resolvedPath, bytes);
				if (!next || next === bytes) {
					return blob;
				}

				return new Blob([next], { type: blob.type });
			});
		},
		requestCredentials: () => book.settings.requestCredentials,
		requestHeaders: () => book.settings.requestHeaders,
		performance: book.performance,
	});

	book.spineLoader = new SpineLoader({
		loadResource: book.load.bind(book),
		performance: book.performance,
		maxLoadedSections: book.settings.maxLoadedSections,
	});

	/**
	 * @member {Store} storage
	 * @memberof Book
	 * @private
	 */
	book.storage = undefined;

	/**
	 * @member {Resources} resources
	 * @memberof Book
	 * @private
	 */
	book.resources = undefined;

	/**
	 * @member {Rendition} rendition
	 * @memberof Book
	 * @private
	 */
	book.rendition = undefined;

	/**
	 * @member {Container} container
	 * @memberof Book
	 * @private
	 */
	book.container = undefined;

	/**
	 * @member {Packaging} packaging
	 * @memberof Book
	 * @private
	 */
	book.packaging = undefined;

	/**
	 * @member {DisplayOptions} displayOptions
	 * @memberof DisplayOptions
	 * @private
	 */
	book.displayOptions = undefined;

	// book.toc = undefined;
	if (book.settings.store) {
		book.store(book.settings.store);
	}

	if (url) {
		book.open(url, book.settings.openAs).catch((_error) => {
			var err = new Error("Cannot load book at " + url);
			book.emit(EVENTS.BOOK.OPEN_FAILED, err);
		});
	}
}

