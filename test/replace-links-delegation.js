import assert from "assert";
import { replaceLinks } from "../src/utils/replacements";

describe("replaceLinks event delegation", function () {
  it("should attach one delegated click handler per contents", function () {
    const contents = document.createElement("div");
    document.body.appendChild(contents);

    const doc = contents.ownerDocument;
    const existingBase = doc.querySelector("base");
    const base = existingBase || doc.createElement("base");
    if (!existingBase) {
      doc.head.appendChild(base);
    }
    base.setAttribute("href", "http://example.com/OPS/ch1.xhtml");

    const anchor = doc.createElement("a");
    anchor.setAttribute("href", "#note");
    const span = doc.createElement("span");
    span.textContent = "note";
    anchor.appendChild(span);
    contents.appendChild(anchor);

    let clickListenerAdds = 0;
    const originalAdd = contents.addEventListener.bind(contents);
    contents.addEventListener = (type, listener, options) => {
      if (type === "click") {
        clickListenerAdds += 1;
      }
      return originalAdd(type, listener, options);
    };

    const calls = [];
    const fn = (href, link) => calls.push({ href, link });

    replaceLinks(contents, fn);
    replaceLinks(contents, fn);

    assert.equal(clickListenerAdds, 1);

    span.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    assert.equal(calls.length, 1);
    assert.ok(String(calls[0].href).indexOf("#note") !== -1);
    assert.equal(calls[0].link, anchor);

    document.body.removeChild(contents);
    if (!existingBase) {
      doc.head.removeChild(base);
    }
  });
});

