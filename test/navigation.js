import assert from "assert";
import ePub from "../src/epub";

describe("Navigation", function () {
  it("should normalize toc hrefs relative to nav document (#1367)", async function () {
    const book = ePub("/fixtures/issue-1367/package.opf");
    await book.opened;
    await book.loaded.navigation;

    try {
      assert.ok(book.navigation.toc.length > 0, "toc should be parsed");
      const item = book.navigation.toc[0];

      assert.equal(
        item.href,
        "Text/chapter.xhtml",
        "toc href should match manifest href"
      );

      const section = book.spine.get(item.href);
      assert.ok(section, "spine.get should resolve normalized toc href");
    } finally {
      book.destroy();
    }
  });
});

