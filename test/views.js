import assert from "assert";
import Views from "../src/managers/helpers/views";

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

