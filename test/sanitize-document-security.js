import assert from "assert";
import { sanitizeDocument } from "../src/utils/sanitize";

describe("sanitizeDocument", function () {
	it("removes scripts, event handlers, and unsafe href schemes", function () {
		const doc = new DOMParser().parseFromString(
				[
					"<html><head></head><body>",
					"<script>window.__pwned = true;</script>",
					"<a id=\"a1\" href=\"java&#x0A;script:alert(1)\" onclick=\"alert(1)\">x</a>",
					"<a id=\"a2\" href=\"data:text/html,<script>alert(1)</script>\">y</a>",
					"<img id=\"img\" src=\"data:image/png;base64,AAAA\" />",
					"</body></html>",
				].join(""),
			"text/html"
		);

		sanitizeDocument(doc);

		assert.strictEqual(doc.querySelectorAll("script").length, 0);

		const a1 = doc.getElementById("a1");
		assert.ok(a1, "expected #a1 to exist");
		assert.ok(!a1.hasAttribute("href"), "expected #a1 href removed");
		assert.ok(!a1.hasAttribute("onclick"), "expected #a1 onclick removed");

		const a2 = doc.getElementById("a2");
		assert.ok(a2, "expected #a2 to exist");
		assert.ok(!a2.hasAttribute("href"), "expected #a2 href removed");

		const img = doc.getElementById("img");
		assert.ok(img, "expected #img to exist");
		assert.ok((img.getAttribute("src") || "").indexOf("data:image/png") === 0, "expected #img data: src preserved");
	});
});
