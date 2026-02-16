import assert from "assert";
import DefaultViewManager from "../src/managers/default";

describe("DefaultViewManager currentLocation layout caching", function () {
  it("should only call updateLayout when layout is dirty", function () {
    const calls = { updateLayout: 0 };
    const manager = {
      _layoutNeedsUpdate: false,
      _stageSize: { width: 100, height: 200 },
      isPaginated: false,
      settings: { axis: "vertical" },
      updateLayout() {
        calls.updateLayout += 1;
        this._layoutNeedsUpdate = false;
        this._stageSize = { width: 100, height: 200 };
      },
      scrolledLocation() {
        return { kind: "scrolled" };
      },
      paginatedLocation() {
        return { kind: "paginated" };
      },
    };

    DefaultViewManager.prototype.currentLocation.call(manager);
    DefaultViewManager.prototype.currentLocation.call(manager);
    assert.equal(calls.updateLayout, 0);

    manager._layoutNeedsUpdate = true;
    DefaultViewManager.prototype.currentLocation.call(manager);
    assert.equal(calls.updateLayout, 1);

    DefaultViewManager.prototype.currentLocation.call(manager);
    assert.equal(calls.updateLayout, 1);
  });
});

