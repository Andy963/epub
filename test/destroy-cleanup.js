import assert from "assert";
import Hook from "../src/utils/hook";
import Rendition from "../src/rendition";
import { EVENTS } from "../src/utils/constants";

function createStubManager() {
  const listeners = new Map();
  const calls = { on: [], off: [], destroy: 0 };

  return {
    listeners,
    calls,
    on(event, fn) {
      calls.on.push([event, fn]);
      const existing = listeners.get(event) || [];
      existing.push(fn);
      listeners.set(event, existing);
      return this;
    },
    off(event, fn) {
      calls.off.push([event, fn]);
      const existing = listeners.get(event) || [];
      const filtered = existing.filter((candidate) => candidate !== fn);
      if (filtered.length) {
        listeners.set(event, filtered);
      } else {
        listeners.delete(event);
      }
      return this;
    },
    destroy() {
      calls.destroy += 1;
    },
    applyLayout() {},
    updateFlow() {},
    direction() {},
    isRendered() {
      return false;
    },
    clear() {},
  };
}

function createStubBook(spineContentHook) {
  return {
    opened: Promise.resolve(),
    spine: { hooks: { content: spineContentHook } },
    package: { metadata: { layout: "reflowable", spread: "auto", direction: "ltr" } },
    displayOptions: { fixedLayout: "false" },
  };
}

describe("destroy() cleanup", function () {
  it("should deregister spine content hooks registered by Rendition", async function () {
    const spineContentHook = new Hook();
    const manager = createStubManager();
    const book = createStubBook(spineContentHook);

    const rendition = new Rendition(book, {
      manager,
      stylesheet: "/styles.css",
      script: "/script.js",
    });

    await rendition.started;

    assert.equal(spineContentHook.list().length, 3);

    rendition.destroy();

    assert.equal(spineContentHook.list().length, 0);
  });

  it("should detach manager event listeners on Rendition.destroy()", async function () {
    const spineContentHook = new Hook();
    const manager = createStubManager();
    const book = createStubBook(spineContentHook);

    const rendition = new Rendition(book, { manager });
    await rendition.started;

    assert.ok(manager.listeners.has(EVENTS.MANAGERS.ADDED));
    assert.ok(manager.listeners.has(EVENTS.MANAGERS.REMOVED));
    assert.ok(manager.listeners.has(EVENTS.MANAGERS.RESIZED));
    assert.ok(manager.listeners.has(EVENTS.MANAGERS.ORIENTATION_CHANGE));
    assert.ok(manager.listeners.has(EVENTS.MANAGERS.SCROLLED));

    rendition.destroy();

    assert.equal(manager.calls.destroy, 1);
    assert.equal(manager.listeners.size, 0);
  });
});

