import assert from "assert";
import Views from "../src/managers/helpers/views";
import DefaultViewManager from "../src/managers/default";
import { filterContainedRects } from "../src/managers/views/iframe";
import { EVENTS } from "../src/utils/constants";

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

describe("DefaultViewManager removed event", function () {
  it("should emit removed when clearing views so unloaded hooks can run (#933)", function () {
    const firstView = { id: "first" };
    const secondView = { id: "second" };
    const events = [];

    const manager = {
      views: {
        hideCalled: false,
        clearCalled: false,
        hide() {
          this.hideCalled = true;
        },
        clear() {
          this.clearCalled = true;
        },
        slice() {
          return [firstView, secondView];
        },
      },
      scrollToArgs: null,
      scrollTo(x, y, silent) {
        this.scrollToArgs = [x, y, silent];
      },
      emit(type, view) {
        events.push({ type, view });
      },
    };

    DefaultViewManager.prototype.clear.call(manager);

    assert.equal(manager.views.hideCalled, true);
    assert.equal(manager.views.clearCalled, true);
    assert.deepEqual(manager.scrollToArgs, [0, 0, true]);
    assert.deepEqual(events, [
      { type: EVENTS.MANAGERS.REMOVED, view: firstView },
      { type: EVENTS.MANAGERS.REMOVED, view: secondView },
    ]);
  });
});

describe("DefaultViewManager target relocation", function () {
  it("should realign pending target after view reflow (#558)", function () {
    const target = "epubcfi(/6/8!/4/2/16,/1:10,/1:30)";
    const offset = { left: 240, top: 0 };
    const moved = [];
    const emitted = [];

    const manager = {
      _pendingDisplayTarget: {
        sectionIndex: 3,
        target,
        remaining: 1,
      },
      moveTo(nextOffset, width) {
        moved.push({ offset: nextOffset, width });
      },
      emit(type, payload) {
        emitted.push({ type, payload });
      },
    };

    const view = {
      section: { index: 3 },
      locationOf(value) {
        assert.equal(value, target);
        return offset;
      },
      width() {
        return 320;
      },
    };

    DefaultViewManager.prototype.afterResized.call(manager, view);

    assert.deepEqual(moved, [{ offset, width: 320 }]);
    assert.equal(manager._pendingDisplayTarget, undefined);
    assert.deepEqual(emitted, [{ type: EVENTS.MANAGERS.RESIZE, payload: view.section }]);
  });
});
