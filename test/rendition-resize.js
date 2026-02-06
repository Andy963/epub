import assert from "assert";
import ePub from "../src/epub";
import { EVENTS } from "../src/utils/constants";

describe("Rendition", function () {
  it("should not end up blank after resize during initial display (#1384)", async function () {
    this.timeout(15000);

    const book = ePub("/fixtures/alice.epub");
    await book.opened;

    const host = document.createElement("div");
    host.style.width = "800px";
    host.style.height = "600px";
    document.body.appendChild(host);

    try {
      const rendition = book.renderTo(host);

      const displayedTwice = new Promise((resolve) => {
        let count = 0;
        const onDisplayed = () => {
          count += 1;
          if (count === 2) {
            rendition.off(EVENTS.RENDITION.DISPLAYED, onDisplayed);
            resolve();
          }
        };
        rendition.on(EVENTS.RENDITION.DISPLAYED, onDisplayed);
      });

      let resized = false;
      let viewsAfterResize = null;
      await rendition.q.enqueue(() => {
        rendition.manager.on(EVENTS.MANAGERS.ADDED, () => {
          if (resized) return;
          resized = true;

          host.style.width = "700px";
          host.offsetWidth;

          // Simulate a resize happening before the manager has a stable stage size
          // (the edge-case described in #1384).
          rendition.manager._stageSize = undefined;
          rendition.manager.onResized();

          viewsAfterResize = rendition.manager.views.length;
        });
      });

      await rendition.display();
      await displayedTwice;

      const iframes = host.querySelectorAll("iframe");
      assert.equal(resized, true, "test should trigger a resize during display");
      assert.ok(viewsAfterResize > 0, "resize should not clear views mid-display");
      assert.ok(iframes.length > 0, "iframe should be rendered after resize");
    } finally {
      document.body.removeChild(host);
      book.destroy();
    }
  });
});
