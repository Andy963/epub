import { DOMParser as XMLDOMParser } from "@xmldom/xmldom";

/**
 * Check if extension is xml
 * @param {string} ext
 * @returns {boolean}
 * @memberof Core
 */
export function isXml(ext) {
	return ["xml", "opf", "ncx"].indexOf(ext) > -1;
}

/**
 * Parse xml (or html) markup
 * @param {string} markup
 * @param {string} mime
 * @param {boolean} forceXMLDom force using xmlDom to parse instead of native parser
 * @returns {document} document
 * @memberof Core
 */
export function parse(markup, mime, forceXMLDom) {
	var doc;
	var Parser;

	if (typeof DOMParser === "undefined" || forceXMLDom) {
		Parser = XMLDOMParser;
	} else {
		Parser = DOMParser;
	}

	// Remove byte order mark before parsing
	// https://www.w3.org/International/questions/qa-byte-order-mark
	if (markup.charCodeAt(0) === 0xfeff) {
		markup = markup.slice(1);
	}

	doc = new Parser().parseFromString(markup, mime);

	return doc;
}

