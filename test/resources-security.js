import assert from "assert";
import Resources from "../src/resources";
import { replaceLinks } from "../src/utils/replacements";

function createResources() {
	return new Resources(
		{},
		{
			replacements: "none",
			lazy: true,
			resolver: (href) => href,
			request: async () => {
				throw new Error("unexpected request");
			},
		}
	);
}

describe("Resources security", function () {
	it("removes unsafe javascript: URLs from common attributes", async function () {
		const resources = createResources();

		const markup =
			'<!doctype html><html><head><link rel="stylesheet" href="javascript:alert(1)"></head>' +
			'<body>' +
			'<img src="javascript:alert(1)">' +
			'<object data="javascript:alert(1)"></object>' +
			"</body></html>";

		const doc = new DOMParser().parseFromString(markup, "text/html");

		await resources.replaceDocument(doc, "https://example.invalid/chapter.xhtml", "parent", [
			"https://example.invalid/chapter.xhtml",
		]);

		const link = doc.querySelector('link[rel="stylesheet"]');
		assert.ok(link, "stylesheet link exists");
		assert.equal(link.hasAttribute("href"), false, "unsafe link[href] removed");

		const img = doc.querySelector("img");
		assert.ok(img, "img exists");
		assert.equal(img.hasAttribute("src"), false, "unsafe img[src] removed");

		const obj = doc.querySelector("object");
		assert.ok(obj, "object exists");
		assert.equal(obj.hasAttribute("data"), false, "unsafe object[data] removed");
	});

	it("filters unsafe javascript: candidates from srcset", async function () {
		const resources = createResources();

		const markup = '<img srcset="javascript:alert(1) 1x, cover.png 2x">';
		const doc = new DOMParser().parseFromString(markup, "text/html");

		await resources.replaceDocument(doc, "https://example.invalid/chapter.xhtml", "parent", [
			"https://example.invalid/chapter.xhtml",
		]);

		const img = doc.querySelector("img");
		assert.ok(img, "img exists");

		const srcset = img.getAttribute("srcset") || "";
		assert.ok(srcset.indexOf("javascript:") === -1, "unsafe srcset url removed");
		assert.ok(srcset.indexOf("cover.png") !== -1, "safe srcset candidate preserved");
	});

	it("rewrites unsafe javascript: URLs inside CSS url() to empty", async function () {
		const resources = createResources();

		const markup =
			"<html><head><style>body{background:url(\"javascript:alert(1)\")}</style></head>" +
			"<body><div style=\"background:url(javascript:alert(1))\"></div></body></html>";
		const doc = new DOMParser().parseFromString(markup, "text/html");

		await resources.replaceDocument(doc, "https://example.invalid/chapter.xhtml", "parent", [
			"https://example.invalid/chapter.xhtml",
		]);

		const styleTag = doc.querySelector("style");
		assert.ok(styleTag, "style tag exists");
		assert.ok(
			(styleTag.textContent || "").indexOf("javascript:") === -1,
			"unsafe css url removed from <style>"
		);

		const div = doc.querySelector("div");
		assert.ok(div, "div exists");
		assert.ok((div.getAttribute("style") || "").indexOf("javascript:") === -1, "unsafe css url removed from style attr");
	});

	it("removes unsafe xlink:href attributes", async function () {
		const resources = createResources();

		const markup =
			'<?xml version="1.0" encoding="UTF-8"?>' +
			'<html xmlns="http://www.w3.org/1999/xhtml" xmlns:xlink="http://www.w3.org/1999/xlink">' +
			"<body>" +
			'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
			'<a xlink:href="javascript:alert(1)"></a>' +
			"</svg>" +
			"</body></html>";

		const doc = new DOMParser().parseFromString(markup, "application/xhtml+xml");

		await resources.replaceDocument(doc, "https://example.invalid/chapter.xhtml", "parent", [
			"https://example.invalid/chapter.xhtml",
		]);

		const el = doc.querySelector("a");
		assert.ok(el, "svg anchor exists");
		assert.equal(
			el.getAttributeNS("http://www.w3.org/1999/xlink", "href"),
			null,
			"unsafe xlink:href removed"
		);
	});

	it("removes unsafe javascript: links during link replacement", function () {
		const markup = '<div><a href="javascript:alert(1)">click</a></div>';
		const doc = new DOMParser().parseFromString(markup, "text/html");
		const root = doc.querySelector("div");
		assert.ok(root, "root exists");

		replaceLinks(root, () => {
			throw new Error("unexpected callback invocation");
		});

		const a = doc.querySelector("a");
		assert.ok(a, "anchor exists");
		assert.equal(a.hasAttribute("href"), false, "unsafe a[href] removed");
	});
});
