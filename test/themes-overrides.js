import assert from "assert";
import Themes from "../src/themes";

class Hook {
	register() {}
}

describe("Themes", function () {
	it("should trigger expand after overrides", function (done) {
		let expandCalls = 0;
		let content = {
			css: () => {},
			expand: () => {
				expandCalls += 1;
			},
			window: {
				requestAnimationFrame: (cb) => {
					return setTimeout(cb, 0);
				},
				cancelAnimationFrame: (id) => {
					clearTimeout(id);
				},
			}
		};

		let rendition = {
			hooks: { content: new Hook() },
			getContents: () => [content]
		};

		let themes = new Themes(rendition);
		themes.fontSize("80%");

		setTimeout(() => {
			assert.equal(expandCalls, 1);
			done();
		}, 10);
	});
});
