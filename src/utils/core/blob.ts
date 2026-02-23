const _window = typeof window !== "undefined" ? (window as any) : undefined;
const _URL =
	typeof URL !== "undefined"
		? URL
		: _window
			? _window.URL || _window.webkitURL || _window.mozURL
			: undefined;

/**
 * Create a new blob
 * @param {any} content
 * @param {string} mime
 * @returns {Blob}
 * @memberof Core
 */
export function createBlob(content, mime) {
	return new Blob([content], { type: mime });
}

/**
 * Create a new blob url
 * @param {any} content
 * @param {string} mime
 * @returns {string} url
 * @memberof Core
 */
export function createBlobUrl(content, mime) {
	var tempUrl;
	var blob = createBlob(content, mime);

	tempUrl = _URL.createObjectURL(blob);

	return tempUrl;
}

/**
 * Remove a blob url
 * @param {string} url
 * @memberof Core
 */
export function revokeBlobUrl(url) {
	return _URL.revokeObjectURL(url);
}

export function isObjectUrl(url: unknown): url is string {
	return typeof url === "string" && url.indexOf("blob:") === 0;
}

export function tryRevokeObjectUrl(url: unknown): void {
	if (!isObjectUrl(url) || !_URL || typeof (_URL as any).revokeObjectURL !== "function") {
		return;
	}

	try {
		(_URL as any).revokeObjectURL(url);
	} catch (e) {
		// NOOP
	}
}

/**
 * Create a new base64 encoded url
 * @param {any} content
 * @param {string} mime
 * @returns {string} url
 * @memberof Core
 */
export function createBase64Url(content, mime) {
	var data;
	var datauri;

	if (typeof content !== "string") {
		// Only handles strings
		return;
	}

	data = btoa(content);

	datauri = "data:" + mime + ";base64," + data;

	return datauri;
}

/**
 * Convert a blob to a base64 encoded string
 * @param {Blog} blob
 * @returns {string}
 * @memberof Core
 */
export function blob2base64(blob: Blob): Promise<string> {
	return new Promise<string>(function (resolve, reject) {
		var reader = new FileReader();
		reader.readAsDataURL(blob);
		reader.onloadend = function () {
			resolve(reader.result as any);
		};
	});
}
