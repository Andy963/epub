import assert from "assert";
import { replaceLinks } from "../src/utils/replacements";

describe("replaceLinks security", function () {
    let contents;

    beforeEach(function() {
        contents = document.createElement("div");
        document.body.appendChild(contents);
    });

    afterEach(function() {
        document.body.removeChild(contents);
    });

    it("should remove javascript: links", function () {
        const anchor = document.createElement("a");
        anchor.setAttribute("href", "javascript:alert(1)");
        contents.appendChild(anchor);

        replaceLinks(contents, () => {});

        assert.equal(anchor.hasAttribute("href"), false, "href should be removed");
    });

    it("should remove vbscript: links", function () {
        const anchor = document.createElement("a");
        anchor.setAttribute("href", "vbscript:alert(1)");
        contents.appendChild(anchor);

        replaceLinks(contents, () => {});

        assert.equal(anchor.hasAttribute("href"), false, "href should be removed");
    });

    it("should remove obfuscated javascript: links (tabs)", function () {
        const anchor = document.createElement("a");
        anchor.setAttribute("href", "java\tscript:alert(1)");
        contents.appendChild(anchor);

        replaceLinks(contents, () => {});

        assert.equal(anchor.hasAttribute("href"), false, "href should be removed");
    });

    it("should remove obfuscated javascript: links (newlines)", function () {
        const anchor = document.createElement("a");
        anchor.setAttribute("href", "java\nscript:alert(1)");
        contents.appendChild(anchor);

        replaceLinks(contents, () => {});

        assert.equal(anchor.hasAttribute("href"), false, "href should be removed");
    });

    it("should remove data: links", function () {
        const anchor = document.createElement("a");
        anchor.setAttribute("href", "data:text/html,<script>alert(1)</script>");
        contents.appendChild(anchor);

        replaceLinks(contents, () => {});

        assert.equal(anchor.hasAttribute("href"), false, "href should be removed");
    });

    it("should not remove http links", function () {
        const anchor = document.createElement("a");
        anchor.setAttribute("href", "http://example.com");
        contents.appendChild(anchor);

        replaceLinks(contents, () => {});

        assert.equal(anchor.getAttribute("href"), "http://example.com");
    });
});
