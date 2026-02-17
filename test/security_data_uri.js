import assert from "assert";
import { replaceLinks } from "../src/utils/replacements";

describe("Sentinel Security Check", function () {
	it("should remove data: URLs from href attributes", function () {
		const markup = '<div><a href="data:text/html,<script>alert(1)</script>">click</a></div>';
		const doc = new DOMParser().parseFromString(markup, "text/html");
		const root = doc.querySelector("div");

		replaceLinks(root, () => {});

		const a = doc.querySelector("a");
		// Now data: IS blocked, so the attribute should be removed
		assert.equal(a.hasAttribute("href"), false, "unsafe data: href should be removed");
	});

	it("should allow valid URLs", function () {
		const markup = '<div><a href="http://example.com">http</a><a href="https://example.com">https</a><a href="mailto:user@example.com">mailto</a></div>';
		const doc = new DOMParser().parseFromString(markup, "text/html");
		const root = doc.querySelector("div");

		replaceLinks(root, () => {});

		const anchors = doc.querySelectorAll("a");
		assert.equal(anchors[0].getAttribute("href"), "http://example.com");
		assert.equal(anchors[1].getAttribute("href"), "https://example.com");
		assert.equal(anchors[2].getAttribute("href"), "mailto:user@example.com");
	});
});
