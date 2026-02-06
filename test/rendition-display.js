import assert from "assert";
import Rendition from "../src/rendition";

describe("Rendition display target parsing", function () {
  it("should resolve percentage string targets to a CFI (#414)", async function () {
    const section = { index: 2, href: "chapter-2.xhtml" };
    const seen = {};

    const fakeRendition = {
      epubcfi: {
        isCfiString() {
          return false;
        },
      },
      book: {
        locations: {
          length() {
            return 100;
          },
          cfiFromPercentage(value) {
            seen.percentage = value;
            return "converted-cfi";
          },
        },
        spine: {
          get(target) {
            seen.spineTarget = target;
            if (target === "converted-cfi") {
              return section;
            }
          },
        },
      },
      manager: {
        display(receivedSection, receivedTarget) {
          seen.display = { section: receivedSection, target: receivedTarget };
          return Promise.resolve();
        },
      },
      emit() {
        return;
      },
      reportLocation() {
        seen.reported = true;
      },
    };

    await Rendition.prototype._display.call(fakeRendition, "23%");

    assert.equal(seen.percentage, 0.23);
    assert.equal(seen.spineTarget, "converted-cfi");
    assert.equal(seen.display.section, section);
    assert.equal(seen.display.target, "converted-cfi");
    assert.equal(seen.reported, true);
  });
});
