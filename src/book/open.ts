import Url from "../utils/url";
import Path from "../utils/path";
import Container from "../container";
import Packaging from "../packaging";
import Archive from "../archive";
import ZipJsArchive from "../core/zipjs-archive";
import { CONTAINER_PATH, INPUT_TYPE } from "./constants";

/**
 * Open a epub or url
 * @param {string | ArrayBuffer} input Url, Path or ArrayBuffer
 * @param {string} [what="binary", "base64", "epub", "opf", "json", "directory"] force opening as a certain type
 * @returns {Promise} of when the book has been loaded
 * @example book.open("/path/to/book.epub")
 */
export function open(input, what) {
	var opening;
	var type = what || this.determineType(input);
	var span = this.performance.start("book.open", {
		type: type,
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
	} else if (type == INPUT_TYPE.OPF) {
		this.url = new Url(input);
		opening = this.openPackaging(this.url.Path.toString());
	} else if (type == INPUT_TYPE.MANIFEST) {
		this.url = new Url(input);
		opening = this.openManifest(this.url.Path.toString());
	} else {
		this.url = new Url(input);
		opening = this.openContainer(CONTAINER_PATH).then(this.openPackaging.bind(this));
	}

	return opening
		.then((result) => {
			this.performance.end(span, {
				status: "resolved",
			});
			return result;
		})
		.catch((error) => {
			this.performance.end(span, {
				status: "rejected",
				error: error && error.message,
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
export function openEpub(data, encoding?) {
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
export function openContainer(url) {
	return this.load(url).then((xml) => {
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
export function openPackaging(url) {
	this.path = new Path(url);
	return this.load(url).then((xml) => {
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
export function openManifest(url) {
	this.path = new Path(url);
	return this.load(url).then((json) => {
		this.packaging = new Packaging();
		this.packaging.load(json);
		return this.unpack(this.packaging);
	});
}

/**
 * Determine the type of they input passed to open
 * @private
 * @param  {string} input
 * @return {string}  binary | directory | epub | opf
 */
export function determineType(input) {
	var url;
	var path;
	var extension;

	if (this.settings.encoding === "base64") {
		return INPUT_TYPE.BASE64;
	}

	if (typeof input != "string") {
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

	if (extension === "epub") {
		return INPUT_TYPE.EPUB;
	}

	if (extension === "opf") {
		return INPUT_TYPE.OPF;
	}

	if (extension === "json") {
		return INPUT_TYPE.MANIFEST;
	}
}

/**
 * Unarchive a zipped epub
 * @private
 * @param  {binary} input epub data
 * @param  {string} [encoding]
 * @return {Archive}
 */
export function unarchive(input, encoding) {
	const isBase64 = encoding === "base64";

	if (this.settings.archiveMethod === "zipjs") {
		this.archive = new ZipJsArchive({
			zipjs: this.settings.zipjs,
			requestHeaders: this.settings.requestHeaders,
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
