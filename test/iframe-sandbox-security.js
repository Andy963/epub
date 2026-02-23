import assert from "assert";
import IframeView from "../src/managers/views/iframe";

function getSandboxValue(iframe) {
	const attr = iframe.getAttribute("sandbox");
	if (typeof attr === "string") {
		return attr;
	}
	if (iframe.sandbox && typeof iframe.sandbox.toString === "function") {
		return iframe.sandbox.toString();
	}
	return "";
}

describe("IframeView sandbox", function () {
	it("does not enable scripts unless explicitly marked unsafe", function () {
		const view = new IframeView(
			{ index: 0 },
			{
				allowScriptedContent: true,
				allowUnsafeScriptedContent: false,
			}
		);
		const iframe = view.create();
		const sandbox = getSandboxValue(iframe);

		assert.ok(sandbox.indexOf("allow-same-origin") >= 0);
		assert.ok(sandbox.indexOf("allow-scripts") === -1);
	});

	it("enables scripts only when explicitly marked unsafe", function () {
		const view = new IframeView(
			{ index: 0 },
			{
				allowScriptedContent: true,
				allowUnsafeScriptedContent: true,
			}
		);
		const iframe = view.create();
		const sandbox = getSandboxValue(iframe);

		assert.ok(sandbox.indexOf("allow-same-origin") >= 0);
		assert.ok(sandbox.indexOf("allow-scripts") >= 0);
	});
});

