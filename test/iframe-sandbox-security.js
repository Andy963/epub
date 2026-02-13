import assert from "assert";
import IframeView from "../src/managers/views/iframe";

function sandboxTokens(iframe) {
  const value = iframe && typeof iframe.getAttribute === "function" ? iframe.getAttribute("sandbox") : "";
  return String(value || "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

describe("IframeView sandbox scripted content", function () {
  it("should not enable scripts unless allowUnsafeScriptedContent is set", function () {
    const view = new IframeView({ index: 0 }, { allowScriptedContent: true });
    const iframe = view.create();
    const tokens = sandboxTokens(iframe);

    assert.ok(tokens.includes("allow-same-origin"));
    assert.ok(!tokens.includes("allow-scripts"));
  });

  it("should enable scripts only with explicit allowUnsafeScriptedContent opt-in", function () {
    const view = new IframeView(
      { index: 0 },
      { allowScriptedContent: true, allowUnsafeScriptedContent: true }
    );
    const iframe = view.create();
    const tokens = sandboxTokens(iframe);

    assert.ok(tokens.includes("allow-same-origin"));
    assert.ok(tokens.includes("allow-scripts"));
  });

  it("should keep allow-scripts disabled when allowScriptedContent is false", function () {
    const view = new IframeView({ index: 0 }, { allowUnsafeScriptedContent: true });
    const iframe = view.create();
    const tokens = sandboxTokens(iframe);

    assert.ok(tokens.includes("allow-same-origin"));
    assert.ok(!tokens.includes("allow-scripts"));
  });
});

