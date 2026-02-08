import assert from "assert";
import Stage from "../src/managers/helpers/stage";

describe("Stage", function () {
	it("destroys hidden stage without throwing", function () {
		const host = document.createElement("div");
		document.body.appendChild(host);

		const stage = new Stage({
			hidden: true,
			width: 100,
			height: 100
		});

		stage.attachTo(host);

		assert.doesNotThrow(() => {
			stage.destroy();
		});

		assert.equal(host.children.length, 0);
		document.body.removeChild(host);
	});
});

