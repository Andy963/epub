# PDF (Experimental)

本仓库在 `epub.js` 的基础上提供了一个实验性的 `PdfBook`，用于用同一套 `Rendition`/View Manager 渲染 PDF（依赖 PDF.js）。

## 依赖与前置条件

- 需要在运行环境中提供 `pdfjsLib`（例如引入 `pdfjs-dist` 的 `build/pdf.min.js`，它会在 `globalThis` 上暴露 `pdfjsLib`）。
- 推荐设置 `workerSrc`，否则 PDF.js 可能会退化到主线程解析，影响性能。

## 最小用法

```html
<div id="viewer"></div>
<script src="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js"></script>
<script src="./dist/epub.min.js"></script>
<script>
  const book = ePub.pdf("example.pdf", {
    workerSrc: "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js"
  });

  const rendition = book.renderTo("viewer", {
    width: "100%",
    height: "100%",
    flow: "scrolled-continuous",
    spread: false,
    fixedLayout: { zoom: "fit-width" }
  });

  rendition.display();
</script>
```

## 常用能力

- `book.loaded.navigation`：PDF outline 会被转换为 `Navigation`（用于目录树）。
- `book.search(...)` / `book.searchText(...)`：
  - 支持 `locales` / `matchCase` / `matchDiacritics` / `matchWholeWords`（与 EPUB 的 `searchText` 行为一致）。
- `book.coverUrl()`：渲染第一页并返回一个图片的 `blob:` URL（用于封面/缩略图）。

## 关键参数说明

### `new PdfBook(input?, options?)`

`PdfBookOptions` 常用项：

- `workerSrc?: string`：PDF.js worker 脚本地址。
- `pdfjsViewer?: any`：可选，提供 PDF.js viewer 模块（如 `pdfjsViewer.renderTextLayer` / `AnnotationLayer.render`），用于提升 text/annotation layer 兼容性（缺失时自动回退到内置实现）。
- `cMapUrl?: string`：PDF.js CMap 资源路径（某些 PDF/字体渲染需要）。
- `cMapPacked?: boolean`：是否使用 packed CMaps（配合 `cMapUrl`）。
- `standardFontDataUrl?: string`：PDF.js 标准字体资源路径。
- `isEvalSupported?: boolean`：是否允许 PDF.js 使用 `eval`（默认 `false`，更安全但可能略降性能）。
- `textLayer?: boolean`：是否生成可选中文本层（默认 `true`）。
- `annotationLayer?: boolean`：是否生成链接注释层（默认 `true`）。
- `prefetchDistance?: number`：预取相邻页距离（默认 `0`）。
- `renderScale?: number`：渲染质量倍率（默认 `1`）。会与 `fixedLayout.zoom` 的缩放因子叠加以保持清晰度；提高该值会增加 CPU/内存占用。

### `book.renderTo(element, renditionOptions?)`

与 fixed-layout 体验最相关的项：

- `flow`：
  - `scrolled-continuous`：连续滚动（适合 PDF）。
  - `paginated`：分页模式（类似翻页）。
- `spread`：
  - `false` / `"none"`：禁用双页 spread。
  - `"auto"`：容器足够宽时启用双页 spread。
- `fixedLayout: { zoom }`：
  - `zoom: "fit-width"`：按宽度适配（`PdfBook.renderTo()` 默认行为，更易读；连续滚动时页面会变高）。
  - `zoom: "fit-page"`：整页适配（更像传统 PDF “整页” 预览）。
