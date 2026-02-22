import assert from "assert";
import { sprint } from "../src/utils/core";

describe("Core sprint", function () {
	it("walks text nodes from a detached document", function () {
		const otherDoc = document.implementation.createHTMLDocument("x");
		otherDoc.body.innerHTML = "<p>Hello</p>";

		const parts = [];
		assert.doesNotThrow(() => {
			sprint(otherDoc.body, (node) => {
				parts.push(node.textContent);
			});
		});

		assert.ok(parts.join("").indexOf("Hello") >= 0);
	});
});

