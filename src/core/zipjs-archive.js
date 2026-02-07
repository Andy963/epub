import { defer, isXml, parse } from "../utils/core";
import mime from "../utils/mime";
import Path from "../utils/path";

class ZipJsArchive {
	constructor(options) {
		this.settings = options || {};

		this.zipjs = undefined;
		this.reader = undefined;
		this.entries = undefined;
		this.entryMap = new Map();

		this.urlCache = {};
	}

	async zipjsLib() {
		if (this.settings.zipjs) {
			return this.settings.zipjs;
		}

		if (this.zipjs) {
			return this.zipjs;
		}

		if (typeof globalThis !== "undefined") {
			if (globalThis.zipjs) {
				this.zipjs = globalThis.zipjs;
				return this.zipjs;
			}
			if (globalThis.zip) {
				this.zipjs = globalThis.zip;
				return this.zipjs;
			}
		}
		return;
	}

	decodePath(url) {
		if (!url || typeof url !== "string") {
			return "";
		}

		const decode =
			typeof window !== "undefined" && window.decodeURIComponent
				? window.decodeURIComponent
				: decodeURIComponent;
		const stripped = url.charAt(0) === "/" ? url.slice(1) : url;
		return decode(stripped);
	}

	async open(input, isBase64) {
		const zipjs = await this.zipjsLib();
		if (!zipjs || typeof zipjs.ZipReader !== "function") {
			throw new Error(
				"zip.js is required. Provide BookOptions.zipjs or load zip.js as global `zip` (e.g. @zip.js/zip.js/dist/zip.js)"
			);
		}

		if (zipjs.configure) {
			try {
				zipjs.configure({
					useWebWorkers: false,
				});
			} catch (e) {
				// NOOP
			}
		}

		const {
			ZipReader,
			BlobReader,
			Uint8ArrayReader,
			Data64URIReader,
		} = zipjs;

		let reader;
		if (typeof input === "string") {
			if (!isBase64) {
				throw new Error("Unsupported zip input string");
			}
			const dataUri = `data:application/zip;base64,${input}`;
			reader = new Data64URIReader(dataUri);
		} else if (typeof Blob !== "undefined" && input instanceof Blob) {
			reader = new BlobReader(input);
		} else if (input instanceof ArrayBuffer) {
			reader = new Uint8ArrayReader(new Uint8Array(input));
		} else if (input && typeof input.buffer === "object") {
			const array = input instanceof Uint8Array ? input : new Uint8Array(input);
			reader = new Uint8ArrayReader(array);
		} else {
			throw new Error("Unsupported zip input");
		}

		this.reader = new ZipReader(reader);
		this.entries = await this.reader.getEntries();
		this.entryMap = new Map();

		(this.entries || []).forEach((entry) => {
			if (!entry || entry.directory) {
				return;
			}
			this.entryMap.set(entry.filename, entry);
		});
	}

	async openUrl(zipUrl, isBase64) {
		if (!zipUrl || typeof zipUrl !== "string") {
			throw new Error("zipUrl is required");
		}

		const zipjs = await this.zipjsLib();
		if (!zipjs || typeof zipjs.ZipReader !== "function") {
			throw new Error(
				"zip.js is required. Provide BookOptions.zipjs or load zip.js as global `zip` (e.g. @zip.js/zip.js/dist/zip.js)"
			);
		}

		if (isBase64) {
			throw new Error("Base64 zipUrl is not supported");
		}

		if (zipjs.configure) {
			try {
				zipjs.configure({
					useWebWorkers: false,
				});
			} catch (e) {
				// NOOP
			}
		}

		const { ZipReader, HttpRangeReader, HttpReader } = zipjs;
		const headers = this.settings.requestHeaders || {};
		const headerEntries = Object.entries(headers);

		let reader;
		try {
			reader = new HttpRangeReader(zipUrl, {
				headers: headerEntries.length ? headerEntries : undefined,
			});
		} catch (e) {
			reader = new HttpReader(zipUrl, {
				headers: headerEntries.length ? headerEntries : undefined,
				useRangeHeader: true,
			});
		}

		this.reader = new ZipReader(reader);
		this.entries = await this.reader.getEntries();
		this.entryMap = new Map();

		(this.entries || []).forEach((entry) => {
			if (!entry || entry.directory) {
				return;
			}
			this.entryMap.set(entry.filename, entry);
		});
	}

	request(url, type) {
		const deferred = new defer();

		if (!type) {
			type = new Path(url).extension;
		}

		let response;
		if (type === "blob") {
			response = this.getBlob(url);
		} else {
			response = this.getText(url);
		}

		if (response) {
			response
				.then((r) => {
					const result = this.handleResponse(r, type);
					deferred.resolve(result);
				})
				.catch((error) => deferred.reject(error));
		} else {
			deferred.reject({
				message: "File not found in the epub: " + url,
				stack: new Error().stack,
			});
		}

		return deferred.promise;
	}

	handleResponse(response, type) {
		let r;

		if (type === "json") {
			r = JSON.parse(response);
		} else if (isXml(type)) {
			r = parse(response, "text/xml");
		} else if (type === "xhtml") {
			r = parse(response, "application/xhtml+xml");
		} else if (type === "html" || type === "htm") {
			r = parse(response, "text/html");
		} else {
			r = response;
		}

		return r;
	}

	getEntry(url) {
		const decodedPath = this.decodePath(url);
		if (!decodedPath) {
			return;
		}
		return this.entryMap.get(decodedPath);
	}

	async getBlob(url, mimeType) {
		const entry = this.getEntry(url);
		if (!entry) {
			return;
		}

		mimeType = mimeType || mime.lookup(entry.filename);
		const zipjs = await this.zipjsLib();
		const { BlobWriter } = zipjs;
		return entry.getData(new BlobWriter(mimeType));
	}

	async getText(url, encoding) {
		const entry = this.getEntry(url);
		if (!entry) {
			return;
		}

		const zipjs = await this.zipjsLib();
		const { TextWriter } = zipjs;
		return entry.getData(new TextWriter(encoding));
	}

	async getBase64(url, mimeType) {
		const entry = this.getEntry(url);
		if (!entry) {
			return;
		}

		mimeType = mimeType || mime.lookup(entry.filename);
		const zipjs = await this.zipjsLib();
		const { Data64URIWriter } = zipjs;
		return entry.getData(new Data64URIWriter(mimeType));
	}

	createUrl(url, options) {
		const deferred = new defer();
		const _URL = window.URL || window.webkitURL || window.mozURL;
		const useBase64 = options && options.base64;

		if (url in this.urlCache) {
			deferred.resolve(this.urlCache[url]);
			return deferred.promise;
		}

		let response;
		if (useBase64) {
			response = this.getBase64(url);
			if (response) {
				response
					.then((tempUrl) => {
						this.urlCache[url] = tempUrl;
						deferred.resolve(tempUrl);
					})
					.catch((error) => deferred.reject(error));
			}
		} else {
			response = this.getBlob(url);
			if (response) {
				response
					.then((blob) => {
						const tempUrl = _URL.createObjectURL(blob);
						this.urlCache[url] = tempUrl;
						deferred.resolve(tempUrl);
					})
					.catch((error) => deferred.reject(error));
			}
		}

		if (!response) {
			deferred.reject({
				message: "File not found in the epub: " + url,
				stack: new Error().stack,
			});
		}

		return deferred.promise;
	}

	revokeUrl(url) {
		const _URL = window.URL || window.webkitURL || window.mozURL;
		const fromCache = this.urlCache[url];
		if (fromCache) {
			try {
				_URL.revokeObjectURL(fromCache);
			} catch (e) {
				// NOOP
			}
		}
	}

	async destroy() {
		const _URL = window.URL || window.webkitURL || window.mozURL;
		for (const key in this.urlCache) {
			const value = this.urlCache[key];
			if (value && typeof value === "string" && value.indexOf("blob:") === 0) {
				try {
					_URL.revokeObjectURL(value);
				} catch (e) {
					// NOOP
				}
			}
		}

		try {
			if (this.reader && typeof this.reader.close === "function") {
				await this.reader.close();
			}
		} catch (e) {
			// NOOP
		}

		this.reader = undefined;
		this.entries = undefined;
		this.entryMap = new Map();
		this.urlCache = {};
	}
}

export default ZipJsArchive;
