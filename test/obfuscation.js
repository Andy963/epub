import assert from "assert";

import FontObfuscation, {
	IDPF_FONT_ALGORITHM,
	ADOBE_FONT_ALGORITHM,
} from "../src/core/obfuscation";

function parseXml(xml) {
	return new DOMParser().parseFromString(xml, "application/xml");
}

function makeBytes(length) {
	const bytes = new Uint8Array(length);
	for (let i = 0; i < bytes.length; i += 1) {
		bytes[i] = i % 251;
	}
	return bytes;
}

describe("FontObfuscation", function () {
	it("should deobfuscate IDPF fonts", function () {
		const doc = parseXml(`
			<encryption xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
				<enc:EncryptedData>
					<enc:EncryptionMethod Algorithm="${IDPF_FONT_ALGORITHM}" />
					<enc:CipherData>
						<enc:CipherReference URI="OPS/font.otf" />
					</enc:CipherData>
				</enc:EncryptedData>
			</encryption>
		`);

		const obfuscation = FontObfuscation.fromEncryption(doc, "test");
		assert(obfuscation);
		assert(obfuscation.isObfuscated("/OPS/font.otf"));

		const original = makeBytes(2000);
		const obfuscated = obfuscation.deobfuscate("/OPS/font.otf", original);
		const recovered = obfuscation.deobfuscate("/OPS/font.otf", obfuscated);

		assert.deepStrictEqual(Array.from(recovered), Array.from(original));
		for (let i = 1040; i < original.length; i += 1) {
			assert.strictEqual(obfuscated[i], original[i]);
		}
	});

	it("should support directory-mode absolute URLs with a root directory", function () {
		const doc = parseXml(`
			<encryption xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
				<enc:EncryptedData>
					<enc:EncryptionMethod Algorithm="${IDPF_FONT_ALGORITHM}" />
					<enc:CipherData>
						<enc:CipherReference URI="OPS/font.otf" />
					</enc:CipherData>
				</enc:EncryptedData>
			</encryption>
		`);

		const obfuscation = FontObfuscation.fromEncryption(doc, "test", {
			rootDirectory: "/book/",
		});
		assert(obfuscation);
		assert(obfuscation.isObfuscated("https://example.com/book/OPS/font.otf"));
		assert(obfuscation.isObfuscated("/book/OPS/font.otf"));

		const original = makeBytes(2000);
		const obfuscated = obfuscation.deobfuscate(
			"https://example.com/book/OPS/font.otf",
			original,
		);
		const recovered = obfuscation.deobfuscate("/book/OPS/font.otf", obfuscated);

		assert.deepStrictEqual(Array.from(recovered), Array.from(original));
	});

	it("should deobfuscate Adobe RC fonts", function () {
		const doc = parseXml(`
			<encryption xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
				<enc:EncryptedData>
					<enc:EncryptionMethod Algorithm="${ADOBE_FONT_ALGORITHM}" />
					<enc:CipherData>
						<enc:CipherReference URI="/OPS/font.ttf" />
					</enc:CipherData>
				</enc:EncryptedData>
			</encryption>
		`);

		const obfuscation = FontObfuscation.fromEncryption(
			doc,
			"urn:uuid:12345678-1234-1234-1234-1234567890ab",
		);
		assert(obfuscation);
		assert(obfuscation.isObfuscated("OPS/font.ttf"));

		const original = makeBytes(1500);
		const obfuscated = obfuscation.deobfuscate("OPS/font.ttf", original);
		const recovered = obfuscation.deobfuscate("OPS/font.ttf", obfuscated);

		assert.deepStrictEqual(Array.from(recovered), Array.from(original));
		for (let i = 1024; i < original.length; i += 1) {
			assert.strictEqual(obfuscated[i], original[i]);
		}
	});

	it("should ignore unknown encryption algorithms", function () {
		const doc = parseXml(`
			<encryption xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
				<enc:EncryptedData>
					<enc:EncryptionMethod Algorithm="http://example.com/unknown" />
					<enc:CipherData>
						<enc:CipherReference URI="OPS/font.otf" />
					</enc:CipherData>
				</enc:EncryptedData>
			</encryption>
		`);

		const obfuscation = FontObfuscation.fromEncryption(doc, "test");
		assert.strictEqual(obfuscation, undefined);
	});
});
