import EventEmitter from "event-emitter";
import Rendition from "./rendition";
import { EPUBJS_VERSION } from "./utils/constants";

import {
	determineType as determineTypeImpl,
	open as openImpl,
	openContainer as openContainerImpl,
	openEpub as openEpubImpl,
	openManifest as openManifestImpl,
	openPackaging as openPackagingImpl,
	unarchive as unarchiveImpl,
} from "./book/open";
import { canonical as canonicalImpl, resolve as resolveImpl } from "./book/paths";
import {
	cancelPrefetch as cancelPrefetchImpl,
	pinSection as pinSectionImpl,
	prefetch as prefetchImpl,
	unpinSection as unpinSectionImpl,
} from "./book/prefetch";
import { coverUrl as coverUrlImpl, store as storeImpl } from "./book/store";
import { getProgressOf as getProgressOfImpl, getTocItemOf as getTocItemOfImpl } from "./book/progress";
import {
	applyFontObfuscationReplacementsIfNeeded as applyFontObfuscationReplacementsIfNeededImpl,
	loadFontObfuscation as loadFontObfuscationImpl,
} from "./book/obfuscation";
import { getRange as getRangeImpl, search as searchImpl } from "./book/search";
import { searchText as searchTextImpl } from "./book/search-text";
import { createSearchWorker as createSearchWorkerImpl } from "./book/search-worker";
import {
	loadNavigation as loadNavigationImpl,
	replacements as replacementsImpl,
	unpack as unpackImpl,
} from "./book/unpack";
import { initializeBook } from "./book/init";

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
 * @param {boolean} [options.deobfuscate=true] decode obfuscated fonts referenced by `META-INF/encryption.xml`
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
	[key: string]: any;

	constructor(url?, options?) {
		// Allow passing just options to the Book
		if (typeof(options) === "undefined" &&
			  typeof(url) !== "string" &&
		    url instanceof Blob === false &&
		    url instanceof ArrayBuffer === false &&
		    url instanceof Uint8Array === false) {
			options = url;
			url = undefined;
		}

		initializeBook(this, url, options);
	}

	/**
	 * Open a epub or url
	 * @param {string | ArrayBuffer} input Url, Path or ArrayBuffer
	 * @param {string} [what="binary", "base64", "epub", "opf", "json", "directory"] force opening as a certain type
	 * @returns {Promise} of when the book has been loaded
	 * @example book.open("/path/to/book.epub")
	 */
	open(input, what) {
		return openImpl.call(this, input, what);
	}

	/**
	 * Open an archived epub
	 * @private
	 * @param  {binary} data
	 * @param  {string} [encoding]
	 * @return {Promise}
	 */
	openEpub(data, encoding?) {
		return openEpubImpl.call(this, data, encoding);
	}

	/**
	 * Open the epub container
	 * @private
	 * @param  {string} url
	 * @return {string} packagePath
	 */
	openContainer(url) {
		return openContainerImpl.call(this, url);
	}

	/**
	 * Open the Open Packaging Format Xml
	 * @private
	 * @param  {string} url
	 * @return {Promise}
	 */
	openPackaging(url) {
		return openPackagingImpl.call(this, url);
	}

	/**
	 * Open the manifest JSON
	 * @private
	 * @param  {string} url
	 * @return {Promise}
	 */
	openManifest(url) {
		return openManifestImpl.call(this, url);
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
	load(path, type?, withCredentials?, headers?, options?) {
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
		return prefetchImpl.call(this, target, distance);
	}

	/**
	 * Cancel active prefetch tasks
	 */
	cancelPrefetch() {
		return cancelPrefetchImpl.call(this);
	}

	pinSection(target) {
		return pinSectionImpl.call(this, target);
	}

	unpinSection(target) {
		return unpinSectionImpl.call(this, target);
	}

	/**
	 * Resolve a path to it's absolute position in the Book
	 * @param  {string} path
	 * @param  {boolean} [absolute] force resolving the full URL
	 * @return {string}          the resolved path string
	 */
	resolve(path, absolute?) {
		return resolveImpl.call(this, path, absolute);
	}

	/**
	 * Get a canonical link to a path
	 * @param  {string} path
	 * @return {string} the canonical path string
	 */
	canonical(path) {
		return canonicalImpl.call(this, path);
	}

	/**
	 * Determine the type of they input passed to open
	 * @private
	 * @param  {string} input
	 * @return {string}  binary | directory | epub | opf
	 */
	determineType(input) {
		return determineTypeImpl.call(this, input);
	}


	/**
	 * unpack the contents of the Books packaging
	 * @private
	 * @param {Packaging} packaging object
	 */
	unpack(packaging) {
		return unpackImpl.call(this, packaging);
	}

	/**
	 * Load Navigation and PageList from package
	 * @private
	 * @param {Packaging} packaging
	 */
	loadNavigation(packaging) {
		return loadNavigationImpl.call(this, packaging);
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
		return unarchiveImpl.call(this, input, encoding);
	}

	/**
	 * Store the epubs contents
	 * @private
	 * @param  {binary} input epub data
	 * @param  {string} [encoding]
	 * @return {Store}
	 */
	store(name) {
		return storeImpl.call(this, name);
	}

	/**
	 * Get the cover url
	 * @return {Promise<?string>} coverUrl
	 */
	coverUrl() {
		return coverUrlImpl.call(this);
	}

	/**
	 * Get progress (0..1) for a target without requiring Locations
	 * @param {any} target
	 * @returns {number | null}
	 */
	getProgressOf(target) {
		return getProgressOfImpl.call(this, target);
	}

	/**
	 * Get the best matching TOC item for a target
	 * @param {any} target
	 * @returns {any}
	 */
	getTocItemOf(target) {
		return getTocItemOfImpl.call(this, target);
	}

	/**
	 * Load replacement urls
	 * @private
	 * @return {Promise} completed loading urls
	 */
	replacements() {
		return replacementsImpl.call(this);
	}

	async applyFontObfuscationReplacementsIfNeeded() {
		return applyFontObfuscationReplacementsIfNeededImpl.call(this);
	}

	async loadFontObfuscation() {
		return loadFontObfuscationImpl.call(this);
	}

	/**
	 * Find a DOM Range for a given CFI Range
	 * @param  {EpubCFI} cfiRange a epub cfi range
	 * @return {Promise}
	 */
	getRange(cfiRange) {
		return getRangeImpl.call(this, cfiRange);
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
		return searchImpl.call(this, query, options);
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
		return searchTextImpl.call(this, query, options);
	}

	createSearchWorker() {
		return createSearchWorkerImpl.call(this);
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
