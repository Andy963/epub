const IDPF_FONT_ALGORITHM = "http://www.idpf.org/2008/embedding";
const ADOBE_FONT_ALGORITHM = "http://ns.adobe.com/pdf/enc#RC";

export type FontAlgorithm =
	| typeof IDPF_FONT_ALGORITHM
	| typeof ADOBE_FONT_ALGORITHM;

interface XmlElementLike {
	localName?: string | null;
	getAttribute?: (name: string) => string | null;
	getElementsByTagName?: (name: string) => ArrayLike<XmlElementLike>;
}

interface XmlDocumentLike {
	getElementsByTagName?: (name: string) => ArrayLike<XmlElementLike>;
}

export interface FontObfuscationOptions {
	uniqueIdentifier?: string;
	items?: Map<string, FontAlgorithm>;
	rootDirectory?: string;
}

export interface FontObfuscationFromEncryptionOptions {
	rootDirectory?: string;
}

function normalizeRootDirectory(value: unknown): string {
	if (!value || typeof value !== "string") {
		return "";
	}

	let stripped = value.split("#")[0].split("?")[0];
	if (stripped.indexOf("://") > -1) {
		try {
			stripped = new URL(stripped).pathname;
		} catch (e) {
			// NOOP
		}
	}

	stripped = stripped.replace(/^\/+/, "");
	if (stripped && stripped.charAt(stripped.length - 1) !== "/") {
		stripped += "/";
	}

	try {
		return decodeURIComponent(stripped);
	} catch (e) {
		return stripped;
	}
}

function normalizeResourcePath(value: unknown, rootDirectory?: string): string {
	if (!value || typeof value !== "string") {
		return "";
	}

	let stripped = value.split("#")[0].split("?")[0];
	if (stripped.indexOf("://") > -1) {
		try {
			stripped = new URL(stripped).pathname;
		} catch (e) {
			// NOOP
		}
	}

	stripped = stripped.replace(/^\/+/, "");

	try {
		stripped = decodeURIComponent(stripped);
	} catch (e) {
		// NOOP
	}

	if (rootDirectory && stripped.indexOf(rootDirectory) === 0) {
		stripped = stripped.slice(rootDirectory.length);
	}

	return stripped;
}

function stripXmlWhitespace(value: unknown): string {
	if (!value || typeof value !== "string") {
		return "";
	}
	return value.replace(/\s/g, "");
}

function toUtf8Bytes(value: string): Uint8Array {
	if (typeof TextEncoder !== "undefined") {
		return new TextEncoder().encode(value);
	}

	// Fallback: percent-encode then decode back to bytes
	const encoded = encodeURIComponent(value);
	const bytes = [];
	for (let i = 0; i < encoded.length; i += 1) {
		const ch = encoded.charAt(i);
		if (ch === "%") {
			const hex = encoded.slice(i + 1, i + 3);
			bytes.push(parseInt(hex, 16));
			i += 2;
		} else {
			bytes.push(ch.charCodeAt(0));
		}
	}
	return new Uint8Array(bytes);
}

function rotl(value: number, shift: number): number {
	return (value << shift) | (value >>> (32 - shift));
}

function sha1(bytes: Uint8Array): Uint8Array {
	// Based on FIPS PUB 180-4
	const length = bytes.length;
	const bitLengthHi = Math.floor((length * 8) / 0x100000000);
	const bitLengthLo = (length * 8) >>> 0;

	const withPaddingLength = ((length + 9 + 63) & ~63) >>> 0;
	const buffer = new Uint8Array(withPaddingLength);
	buffer.set(bytes);
	buffer[length] = 0x80;
	buffer[withPaddingLength - 8] = (bitLengthHi >>> 24) & 0xff;
	buffer[withPaddingLength - 7] = (bitLengthHi >>> 16) & 0xff;
	buffer[withPaddingLength - 6] = (bitLengthHi >>> 8) & 0xff;
	buffer[withPaddingLength - 5] = bitLengthHi & 0xff;
	buffer[withPaddingLength - 4] = (bitLengthLo >>> 24) & 0xff;
	buffer[withPaddingLength - 3] = (bitLengthLo >>> 16) & 0xff;
	buffer[withPaddingLength - 2] = (bitLengthLo >>> 8) & 0xff;
	buffer[withPaddingLength - 1] = bitLengthLo & 0xff;

	let h0 = 0x67452301;
	let h1 = 0xefcdab89;
	let h2 = 0x98badcfe;
	let h3 = 0x10325476;
	let h4 = 0xc3d2e1f0;

	const w = new Int32Array(80);

	for (let i = 0; i < buffer.length; i += 64) {
		for (let t = 0; t < 16; t += 1) {
			const j = i + t * 4;
			w[t] =
				((buffer[j] << 24) |
					(buffer[j + 1] << 16) |
					(buffer[j + 2] << 8) |
					buffer[j + 3]) >>
				0;
		}

		for (let t = 16; t < 80; t += 1) {
			w[t] = rotl(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1) >> 0;
		}

		let a = h0;
		let b = h1;
		let c = h2;
		let d = h3;
		let e = h4;

		for (let t = 0; t < 80; t += 1) {
			let f;
			let k;
			if (t < 20) {
				f = (b & c) | (~b & d);
				k = 0x5a827999;
			} else if (t < 40) {
				f = b ^ c ^ d;
				k = 0x6ed9eba1;
			} else if (t < 60) {
				f = (b & c) | (b & d) | (c & d);
				k = 0x8f1bbcdc;
			} else {
				f = b ^ c ^ d;
				k = 0xca62c1d6;
			}

			const temp = (rotl(a, 5) + f + e + k + w[t]) >> 0;
			e = d;
			d = c;
			c = rotl(b, 30) >> 0;
			b = a;
			a = temp;
		}

		h0 = (h0 + a) >> 0;
		h1 = (h1 + b) >> 0;
		h2 = (h2 + c) >> 0;
		h3 = (h3 + d) >> 0;
		h4 = (h4 + e) >> 0;
	}

	const out = new Uint8Array(20);
	const words = [h0, h1, h2, h3, h4];
	for (let i = 0; i < words.length; i += 1) {
		const w32 = words[i] >>> 0;
		out[i * 4] = (w32 >>> 24) & 0xff;
		out[i * 4 + 1] = (w32 >>> 16) & 0xff;
		out[i * 4 + 2] = (w32 >>> 8) & 0xff;
		out[i * 4 + 3] = w32 & 0xff;
	}
	return out;
}

function uuidToBytes(value: string): Uint8Array | undefined {
	if (!value || typeof value !== "string") {
		return;
	}

	let normalized = value.trim().toLowerCase();
	if (normalized.indexOf("urn:uuid:") === 0) {
		normalized = normalized.slice("urn:uuid:".length);
	}
	normalized = normalized.replace(/-/g, "");

	if (!/^[0-9a-f]{32}$/.test(normalized)) {
		return;
	}

	const bytes = new Uint8Array(16);
	for (let i = 0; i < 16; i += 1) {
		bytes[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

function xorBytes(bytes: Uint8Array, key: Uint8Array | undefined, maxBytes: number): Uint8Array {
	if (!key || !(key instanceof Uint8Array) || key.length === 0) {
		return bytes;
	}

	const out = new Uint8Array(bytes);
	const limit = Math.min(out.length, maxBytes);
	for (let i = 0; i < limit; i += 1) {
		out[i] ^= key[i % key.length];
	}
	return out;
}

class FontObfuscation {
	uniqueIdentifier: string;
	items: Map<string, FontAlgorithm>;
	rootDirectory: string;
	private idpfKey: Uint8Array | undefined;
	private adobeKey: Uint8Array | undefined;

	constructor(options?: FontObfuscationOptions) {
		options = options || {};
		this.uniqueIdentifier = options.uniqueIdentifier || "";
		this.items = options.items || new Map();
		this.rootDirectory = normalizeRootDirectory(options.rootDirectory || "");

		const stripped = stripXmlWhitespace(this.uniqueIdentifier);
		this.idpfKey = stripped ? sha1(toUtf8Bytes(stripped)) : undefined;
		this.adobeKey = uuidToBytes(stripped);
	}

	static parseEncryption(encryptionDocument: XmlDocumentLike | undefined | null): Map<string, FontAlgorithm> {
		const items = new Map<string, FontAlgorithm>();

		if (!encryptionDocument || !encryptionDocument.getElementsByTagName) {
			return items;
		}

		const all = encryptionDocument.getElementsByTagName("*");
		for (let i = 0; i < all.length; i += 1) {
			const el = all[i];
			if (!el || el.localName !== "EncryptedData") {
				continue;
			}

			let algorithm: string | undefined;
			let cipherReferences: string[] = [];

			const children =
				el.getElementsByTagName && typeof el.getElementsByTagName === "function"
					? el.getElementsByTagName("*")
					: [];
			for (let j = 0; j < children.length; j += 1) {
				const child = children[j];
				if (!child || !child.localName) {
					continue;
				}

				if (!algorithm && child.localName === "EncryptionMethod") {
					algorithm =
						(child.getAttribute && child.getAttribute("Algorithm")) || undefined;
				}

				if (child.localName === "CipherReference") {
					const uri =
						(child.getAttribute && child.getAttribute("URI")) || "";
					if (uri) {
						cipherReferences.push(uri);
					}
				}
			}

			if (!algorithm) {
				continue;
			}

			if (
				algorithm !== IDPF_FONT_ALGORITHM &&
				algorithm !== ADOBE_FONT_ALGORITHM
			) {
				continue;
			}

			const alg = algorithm as FontAlgorithm;
			cipherReferences.forEach((uri) => {
				const normalized = normalizeResourcePath(uri);
				if (normalized) {
					items.set(normalized, alg);
				}
			});
		}

		return items;
	}

	static fromEncryption(
		encryptionDocument: XmlDocumentLike | undefined | null,
		uniqueIdentifier: string | undefined,
		options?: FontObfuscationFromEncryptionOptions,
	): FontObfuscation | undefined {
		const items = FontObfuscation.parseEncryption(encryptionDocument);
		if (!items || items.size === 0) {
			return;
		}

		return new FontObfuscation({
			uniqueIdentifier: uniqueIdentifier || "",
			items,
			rootDirectory: options && options.rootDirectory,
		});
	}

	isObfuscated(path: string): boolean {
		const normalized = normalizeResourcePath(path, this.rootDirectory);
		return normalized ? this.items.has(normalized) : false;
	}

	deobfuscate(path: string, bytes: Uint8Array): Uint8Array {
		const normalized = normalizeResourcePath(path, this.rootDirectory);
		const algorithm = normalized ? this.items.get(normalized) : undefined;

		if (algorithm === IDPF_FONT_ALGORITHM) {
			return xorBytes(bytes, this.idpfKey, 1040);
		}
		if (algorithm === ADOBE_FONT_ALGORITHM) {
			return xorBytes(bytes, this.adobeKey, 1024);
		}

		return bytes;
	}
}

export { IDPF_FONT_ALGORITHM, ADOBE_FONT_ALGORITHM };

export default FontObfuscation;
