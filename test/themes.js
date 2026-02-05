import assert from "assert";
import Contents from "../src/contents";
import Themes from "../src/themes";

class Hook {
	constructor() {
		this.fns = [];
	}

	register(fn) {
		this.fns.push(fn);
	}
}

describe("Themes", function () {
	it("should re-apply a theme when selected again", function () {
		let el = document.createElement("div");
		el.id = "theme-test";
		document.body.appendChild(el);

		let contents = new Contents(document, document.body, "", 0);
		let rendition = {
			hooks: { content: new Hook() },
			getContents: () => [contents]
		};
		let themes = new Themes(rendition);

		themes.register("light", {
			"#theme-test": { "background-color": "#FFFFFF" }
		});
		themes.register("dark", {
			"#theme-test": { "background-color": "#111111" }
		});

		themes.select("light");
		assert.equal(getComputedStyle(el).backgroundColor, "rgb(255, 255, 255)");

		themes.select("dark");
		assert.equal(getComputedStyle(el).backgroundColor, "rgb(17, 17, 17)");

		themes.select("light");
		assert.equal(getComputedStyle(el).backgroundColor, "rgb(255, 255, 255)");

		contents.destroy();

		["light", "dark"].forEach((name) => {
			let styleEl = document.getElementById("epubjs-inserted-css-" + name);
			if (styleEl) {
				styleEl.remove();
			}
		});

		document.body.classList.remove("light");
		document.body.classList.remove("dark");
		el.remove();
	});
});

