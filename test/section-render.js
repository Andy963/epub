import assert from "assert";
import { DOMParser as XMLDOMParser } from "@xmldom/xmldom";
import Section from "../src/section";

describe("Section.render", function () {
	it("serializes using xmldom XMLSerializer when XMLSerializer is unavailable", function () {
		const original = globalThis.XMLSerializer;
		let overridden = false;
		try {
			try {
				globalThis.XMLSerializer = undefined;
				overridden = typeof globalThis.XMLSerializer === "undefined";
			} catch (e) {
				overridden = false;
			}
			if (!overridden && typeof original !== "undefined") {
				this.skip();
			}

			const doc = new XMLDOMParser().parseFromString(
				"<html><head><title>x</title></head><body><p>Hello</p></body></html>",
				"application/xhtml+xml"
			);

			const section = new Section({
				idref: "s",
				linear: "yes",
				properties: [],
				index: 0,
				href: "s.xhtml",
				url: "s.xhtml",
				canonical: "s.xhtml",
				next: null,
				prev: null,
				cfiBase: "/6/2[s]",
			});

			const request = () => Promise.resolve(doc);
			return section.render(request).then((markup) => {
				assert.ok(typeof markup === "string" && markup.indexOf("<p") >= 0);
			});
		} finally {
			if (overridden) {
				globalThis.XMLSerializer = original;
			}
		}
	});
});
