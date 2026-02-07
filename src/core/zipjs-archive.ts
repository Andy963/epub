import { defer, isXml, parse } from "../utils/core";
import mime from "../utils/mime";
import Path from "../utils/path";

export interface ZipJsArchiveOptions {
	zipjs?: unknown;
	requestHeaders?: Record<string, string>;
}

export interface ZipJsArchiveObfuscation {
	deobfuscate: (path: string, bytes: Uint8Array) => Uint8Array;
}

type UrlCache = Record<string, string>;

class ZipJsArchive {
	private settings: ZipJsArchiveOptions;
	private zipjs: any | undefined;
	private reader: any | undefined;
	private entries: any[] | undefined;
	private entryMap: Map<string, any>;
	private obfuscation: ZipJsArchiveObfuscation | undefined;
	private urlCache: UrlCache;

	constructor(options?: ZipJsArchiveOptions) {
		this.settings = options || {};

		this.zipjs = undefined;
		this.reader = undefined;
		this.entries = undefined;
		this.entryMap = new Map();
		this.obfuscation = undefined;

		this.urlCache = {};
	}

	setObfuscation(obfuscation: ZipJsArchiveObfuscation | undefined): void {
		this.obfuscation = obfuscation;
	}

	private uint8ArrayToBase64(uint8array: Uint8Array): string {
		let binary = "";
		const chunkSize = 0x8000;
		for (let i = 0; i < uint8array.length; i += chunkSize) {
			const chunk = uint8array.subarray(i, i + chunkSize);
			binary += String.fromCharCode.apply(null, chunk);
		}
		return btoa(binary);
	}

	private async zipjsLib(): Promise<any | undefined> {
		if (this.settings.zipjs) {
			return this.settings.zipjs;
		}

		if (this.zipjs) {
			return this.zipjs;
		}

		if (typeof globalThis !== "undefined") {
			const globalAny = globalThis as any;
			if (globalAny.zipjs) {
				this.zipjs = globalAny.zipjs;
				return this.zipjs;
			}
			if (globalAny.zip) {
				this.zipjs = globalAny.zip;
				return this.zipjs;
			}
		}
		return;
	}

	private decodePath(url: string): string {
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

	async open(input: unknown, isBase64?: boolean): Promise<void> {
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
		} else if (input && typeof (input as any).buffer === "object") {
			const array =
				input instanceof Uint8Array ? input : new Uint8Array(input as any);
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

	async openUrl(zipUrl: string, isBase64?: boolean): Promise<void> {
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

	request(url: string, type?: string): Promise<unknown> {
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

	private handleResponse(response: any, type: string): unknown {
		let r;

		if (type === "json") {
			r = JSON.parse(response);
		} else if (isXml(type)) {
			r = parse(response, "text/xml", false);
		} else if (type === "xhtml") {
			r = parse(response, "application/xhtml+xml", false);
		} else if (type === "html" || type === "htm") {
			r = parse(response, "text/html", false);
		} else {
			r = response;
		}

		return r;
	}

	private getEntry(url: string): any | undefined {
		const decodedPath = this.decodePath(url);
		if (!decodedPath) {
			return;
		}
		return this.entryMap.get(decodedPath);
	}

	private async getBlob(url: string, mimeType?: string): Promise<Blob | undefined> {
		const entry = this.getEntry(url);
		if (!entry) {
			return;
		}

		mimeType = mimeType || mime.lookup(entry.filename);
		const zipjs = await this.zipjsLib();
		const { BlobWriter, Uint8ArrayWriter } = zipjs;

		const obfuscation = this.obfuscation;
		if (obfuscation && typeof obfuscation.deobfuscate === "function") {
			const bytes = Uint8ArrayWriter
				? await entry.getData(new Uint8ArrayWriter())
				: new Uint8Array(
						await (await entry.getData(new BlobWriter(mimeType))).arrayBuffer(),
					);

			const next = obfuscation.deobfuscate(entry.filename, bytes);
			return new Blob([next], { type: mimeType });
		}

		return entry.getData(new BlobWriter(mimeType));
	}

	private async getText(url: string, encoding?: string): Promise<string | undefined> {
		const entry = this.getEntry(url);
		if (!entry) {
			return;
		}

		const zipjs = await this.zipjsLib();
		const { TextWriter } = zipjs;
		return entry.getData(new TextWriter(encoding));
	}

	private async getBase64(url: string, mimeType?: string): Promise<string | undefined> {
		const entry = this.getEntry(url);
		if (!entry) {
			return;
		}

		mimeType = mimeType || mime.lookup(entry.filename);
		const zipjs = await this.zipjsLib();
		const { Data64URIWriter, Uint8ArrayWriter, BlobWriter } = zipjs;

		const obfuscation = this.obfuscation;
		if (obfuscation && typeof obfuscation.deobfuscate === "function") {
			const bytes = Uint8ArrayWriter
				? await entry.getData(new Uint8ArrayWriter())
				: new Uint8Array(
						await (await entry.getData(new BlobWriter(mimeType))).arrayBuffer(),
					);

			const next = obfuscation.deobfuscate(entry.filename, bytes);
			const base64 = this.uint8ArrayToBase64(next);
			return `data:${mimeType};base64,${base64}`;
		}

		return entry.getData(new Data64URIWriter(mimeType));
	}

	createUrl(url: string, options?: { base64?: boolean }): Promise<string> {
		const deferred = new defer();
		const w = window as any;
		const _URL = window.URL || w.webkitURL || w.mozURL;
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

	revokeUrl(url: string): void {
		const w = window as any;
		const _URL = window.URL || w.webkitURL || w.mozURL;
		const fromCache = this.urlCache[url];
		if (fromCache) {
			try {
				_URL.revokeObjectURL(fromCache);
			} catch (e) {
				// NOOP
			}
		}
	}

	async destroy(): Promise<void> {
		const w = window as any;
		const _URL = window.URL || w.webkitURL || w.mozURL;
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
