# Refactor Notes (Experimental)

以下内容用于记录 `refactor` 分支新增/调整的能力点与用法。当前目标是：默认行为尽量不变，新能力尽量以 opt-in 的方式提供。

## 1. Performance Metrics

默认关闭，开启后可用于定位 `open/load/prefetch` 等路径的耗时与命中率。

```js
import ePub from "epubjs";

const book = ePub("/path/to/book.epub", {
  metrics: true
});

await book.opened;
console.log(book.getPerformanceSnapshot());
book.clearPerformanceMetrics();
```

## 2. Section Prefetch + Cache Budget

章节预取与章节缓存上限默认关闭（保持原行为）。启用后可减少翻页时的加载抖动，并限制章节常驻内存的数量。

```js
const book = ePub("/path/to/book.epub", {
  prefetchDistance: 2,
  maxLoadedSections: 6
});

const rendition = book.renderTo("viewer", {
  prefetch: 2
});
await rendition.display();
```

## 3. Lazy Resource Replacement (Inspired by foliate-js)

用于替代“整本预生成资源替换 URL”的模式：仅在章节渲染时按需创建 `blob:`/`data:` URL，并在视图移除后自动释放无引用资源。

```js
const book = ePub("/path/to/book.epub", {
  lazyResources: true
});
```

## 3.1 Zip.js Archive Backend (No Whole-File Load)

默认的归档 EPUB 解压依赖 JSZip，会在 `open()` 阶段把整个 zip 文件读入内存。为了对齐 foliate-js 的“按需读取”思路，可以启用 `archiveMethod: "zipjs"`（依赖 zip.js）。

启用后：

- 打开本地 `File/Blob` 时，zip.js 会按需读取条目内容，不要求整本载入内存；
- 打开远程 `*.epub` URL 时，zip.js 会尝试使用 `HttpRangeReader`（需要服务端支持 `Accept-Ranges`，并满足 CORS 头部要求）；否则会退化为普通 HTTP reader。
- 当前 zip.js 的 HTTP reader 不支持 `withCredentials`，如需带 cookie/鉴权头，建议自行在应用侧代理下载或改为先 `fetch(...).arrayBuffer()` 再传给 `ePub(buffer, ...)`。

```js
import ePub from "epubjs";
import * as zipjs from "@zip.js/zip.js";

const book = ePub(fileBlobOrUrl, {
  archiveMethod: "zipjs",
  zipjs
});
```

如果你使用的是 `dist/epub.min.js`（UMD 单文件），需要在应用侧提供 zip.js（通过 script 或显式注入模块）：

```js
import * as zipjs from "@zip.js/zip.js";
import ePub from "epubjs";

const book = ePub(fileBlobOrUrl, {
  archiveMethod: "zipjs",
  zipjs
});
```

如果你更偏向 script 方式（全局变量为 `zip`）：

```html
<script src="/path/to/zip.min.js"></script>
<script src="/path/to/epub.min.js"></script>
<script>
  const book = ePub("/path/to/book.epub", { archiveMethod: "zipjs" });
</script>
```

## 4. Abortable Requests

内部请求链路支持 `AbortSignal`（XHR abort），适用于预取取消、搜索取消等场景。

```js
const controller = new AbortController();

const loading = book.load("/path/to/resource.xhtml", "text", undefined, undefined, {
  signal: controller.signal
});

controller.abort();
await loading;
```

## 5. Full-Book Search

`search` 生成 CFI（主线程 DOM 路径，偏准确）；`searchText` 不生成 CFI（可选 Worker，偏快）。

```js
const results = await book.search("alice", {
  maxResults: 50,
  unload: true
});

const fastResults = await book.searchText("alice", {
  useWorker: true
});
```

## 6. PDF Prototype

提供 `PdfBook` 与 `ePub.pdf()` 的实验性入口；需要用户在运行环境中提供 `pdfjsLib`（例如通过单独加载 PDF.js）。

当前默认启用 `textLayer`（可选中复制）与 `annotationLayer`（可点击链接）。`rendition.display(n)` 中 `n` 为 **0-based page index**；如需按百分比跳转请使用 `\"50%\"` 或 `0.5` 这种小数。

```js
import ePub from "epubjs";

// globalThis.pdfjsLib must be available
const pdf = ePub.pdf("/path/to/file.pdf", {
  workerSrc: "/pdf.worker.js",
  renderScale: 1,
  textLayer: true,
  annotationLayer: true,

  // optional: warm neighboring pages after display
  prefetchDistance: 2,

  // optional: bound memory for cached render outputs / extracted text
  maxCachedPages: 6,
  maxCachedTextPages: 50
});

// Default: continuous scroll ("scrolled-continuous") with a PDF-optimized view
// To force paginated mode:
// const rendition = pdf.renderTo("viewer", { manager: "default", flow: "paginated" });
const rendition = pdf.renderTo("viewer");
await pdf.opened;
await rendition.display(0);
```

PDF 目录（outline）与搜索：

```js
const nav = await pdf.loaded.navigation;
console.log(nav.toc);

const results = await pdf.searchText("alice", { maxResults: 20 });
console.log(results);
```

## 7. foliate-js Parity TODO (Engine-only)

说明：以下 TODO 只覆盖“引擎层”能力（解析、渲染、定位、搜索、资源加载等），不包含阅读器壳（书库、UI、快捷键、主题面板等）。

### EPUB

- [x] `META-INF/encryption.xml`：支持字体混淆解码（IDPF + Adobe），确保含混淆字体的书可正常渲染（可用 `deobfuscate: false` 关闭）
  - [x] 目录模式（未归档）输入：仅为“命中混淆映射的字体资源”与“依赖这些字体的 CSS”生成替换 URL（避免全量 assets replacement），确保不经 archive backend 也能正确解码
- [x] 进度 / 目录对齐：提供不依赖 `Locations` 的进度计算与 `toc` 定位 helper（`book.getProgressOf(...)` / `book.getTocItemOf(...)`）
- [x] Paginator 能力补齐：更细粒度的分页参数（`margin` / `gap` / `maxColumnCount` 等）与可扩展的 header/footer hooks（不引入 UI）
  - [x] `margin` / `maxInlineSize` / `maxBlockSize`：通过 Stage padding/max-size 控制可视区域
  - [x] `maxColumnCount`：支持 >2 columns 的分页
  - [x] header/footer hooks：不引入 UI 的可扩展接口
- [x] CFI 稳定性：支持为 CFI 生成/解析提供 predicate filter（忽略注入节点/标注层），降低定位漂移风险
- [x] 交互手感（可选）：翻页动画/滑动吸附策略对齐（保持默认行为不变，作为 opt-in，通过 `snap` 启用）

最小用法示例：

```js
const progress = book.getProgressOf(rendition.currentLocation());
const tocItem = book.getTocItemOf(rendition.currentLocation());
```

CFI filter 示例（`ignoreClass` 同时支持 string 与 predicate）：

```js
const ignore = (node) =>
  node.nodeType === 1 &&
  node.classList &&
  (node.classList.contains("epubjs-skip") || node.classList.contains("annotation-layer"));

const rendition = book.renderTo("viewer", {
  ignoreClass: ignore
});
```

Paginator 参数示例（opt-in）：

```js
const rendition = book.renderTo("viewer", {
  flow: "paginated",
  margin: 32,
  maxColumnCount: 3,
  maxInlineSize: 900,
  gap: 40
});
```

header/footer hooks 示例（不引入 UI，仅提供 hook 点，便于应用侧渲染页眉/页脚）：

```js
rendition.hooks.header.register((location) => {
  // Update your header UI with `location`
});

rendition.hooks.footer.register((location) => {
  // Update your footer UI with `location`
});
```

### PDF

- [x] PDF 渲染层：更贴近 PDF.js 的 textLayer / annotationLayer（提升选择复制、链接/注释兼容性）
  - [x] textLayer：当提供 `pdfjsViewer`（或全局 `pdfjsViewer`）且存在 `renderTextLayer` 时，优先使用 PDF.js 的实现
  - [x] annotationLayer：当提供 `pdfjsViewer`（或全局 `pdfjsViewer`）且存在 `AnnotationLayer.render` 时，优先使用 PDF.js 的实现（失败时自动回退）
- [x] 进度权重：按页面积/权重计算进度（对齐基于 `size` 的 progress 语义）
- [x] 链接/outline：补齐更多注释类型与 outline 目标解析边界条件
