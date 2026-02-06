import assert from "assert";
import Rendition from "../src/rendition";

describe("Rendition adjustImages", function () {
  it("should prevent figure elements from splitting across columns (#576)", async function () {
    let injectedRules;

    const mockContents = {
      window: {
        getComputedStyle() {
          return {
            paddingTop: "0",
            paddingBottom: "0",
            paddingLeft: "0",
            paddingRight: "0",
          };
        },
      },
      content: {
        offsetHeight: 800,
      },
      addStylesheetRules(rules) {
        injectedRules = rules;
      },
    };

    const fakeRendition = {
      _layout: {
        name: "reflowable",
        columnWidth: 400,
      },
    };

    await Rendition.prototype.adjustImages.call(fakeRendition, mockContents);

    assert.ok(injectedRules.figure, "figure rules should be injected");
    assert.equal(injectedRules.figure["page-break-inside"], "avoid");
    assert.equal(injectedRules.figure["break-inside"], "avoid");
  });
});
