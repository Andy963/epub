import assert from "assert";
import Views from "../src/managers/helpers/views";
import { filterContainedRects } from "../src/managers/views/iframe";

describe("Views", function () {
  it("should not throw when removing a view already detached (#1390)", function () {
    const container = document.createElement("div");
    document.body.appendChild(container);

    try {
      const views = new Views(container);

      let destroyed = false;
      const view = {
        element: document.createElement("div"),
        displayed: true,
        destroy: () => {
          destroyed = true;
          view.displayed = false;
        },
      };

      views.append(view);

      // Simulate an edge case where the view element has already been removed
      // from the container before Views.remove runs.
      container.removeChild(view.element);

      assert.doesNotThrow(() => views.remove(view));
      assert.equal(destroyed, true, "view.destroy should be called");
    } finally {
      document.body.removeChild(container);
    }
  });
});

describe("IframeView underline rect filtering", function () {
  it("should drop container rects so cross-paragraph underlines stay aligned (#1415)", function () {
    const lineOne = {
      top: 10,
      left: 10,
      right: 210,
      bottom: 30,
      width: 200,
      height: 20,
    };
    const lineTwo = {
      top: 40,
      left: 10,
      right: 190,
      bottom: 60,
      width: 180,
      height: 20,
    };
    const paragraphBox = {
      top: 10,
      left: 10,
      right: 210,
      bottom: 80,
      width: 200,
      height: 70,
    };

    const filtered = filterContainedRects([paragraphBox, lineOne, lineTwo]);

    assert.equal(filtered.length, 2);
    assert.ok(filtered.includes(lineOne));
    assert.ok(filtered.includes(lineTwo));
  });
});
