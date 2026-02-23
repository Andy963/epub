# 重构追踪（epub.js）

目标：在**不改变对外行为与发布契约**的前提下，逐步提升代码结构、可扩展性、可维护性与性能；每次改动都尽量小、可审阅、可回滚。

> 说明：本文件用于追踪“已经阅读过哪些模块 / 待重构点 / 尚未阅读模块”。每轮重构开始前，先同步到 `origin/dev`（以本地 `origin/dev` 引用为准），并确保工作区干净。

## 当前基线

- Base: `origin/dev` @ `6746283`
- Last updated: 2026-02-23

## 已阅读模块（Reviewed）

### Tooling / Workflow

- [x] `package.json`（scripts: lint / typecheck / karma test）
- [x] `karma.conf.js`（Karma + webpack pipeline）

### Source (src/)

- [x] `src/archive.ts`（Archive: url cache + revoke lifecycle）
- [x] `src/book.ts`（Book public API surface）
- [x] `src/book/init.ts`（Book initialization: loading/loaded/ready）
- [x] `src/book/unpack.ts`（Packaging unpack + navigation / pagelist loading）
- [x] `src/epubcfi.ts`（EpubCFI facade + method wiring）
- [x] `src/epubcfi/compare.ts`（CFI ordering）
- [x] `src/epubcfi/parse.ts`（CFI parsing and type checks）
- [x] `src/epub.ts`（public entry: `ePub()` factory + static exports）
- [x] `src/locations.ts`（Locations orchestration + worker integration）
- [x] `src/locations/worker.ts`（Worker protocol + inlined parser implementation）
- [x] `src/section.ts`（Section load/render/find/search）
- [x] `src/store.ts`（Store: url cache + revoke lifecycle）
- [x] `src/core/zipjs-archive.ts`（ZipJsArchive: url cache + revoke lifecycle）
- [x] `src/utils/core.ts`（core utilities re-export surface）
- [x] `src/utils/core/blob.ts`（Blob / base64 helpers + URL revoke helpers）

### Tests

- [x] `test/book-pagelist.js`（新增：Book pageList contract）
- [x] `test/dom-treewalker.js`（新增：`sprint()` over detached document）
- [x] `test/epubcfi-compare.js`（新增：EpubCFI.compare ordering）
- [x] `test/section-render.js`（新增：`Section.render()` serializer fallback）

## 部分已阅读（Partial）

- `src/book/`（已读：`src/book/init.ts`、`src/book/unpack.ts`）
- `src/epubcfi/`（已读：`src/epubcfi/parse.ts`、`src/epubcfi/compare.ts`）
- `src/locations/`（已读：`src/locations/generate.ts`、`src/locations/process.ts`）
- `src/pdf/`（已读：`src/pdf/book.ts`、`src/pdf/book/render.ts`、`src/pdf/book/layers.ts`）

## 已完成（Completed）

- 2026-02-22：`src/epub.ts` 清理未使用 import（降低依赖噪音，减少 lint 告警）。
- 2026-02-23：`src/epubcfi/compare.ts` 移除未使用变量与重复声明，并补充 `EpubCFI.compare` 回归测试。
- 2026-02-23：`src/locations/worker.ts` 将 worker 源码由“转义字符串”改为可读的多行模板字符串（无行为变更）。
- 2026-02-23：`src/pdf/book*.ts` 清理无意义的转义（降低 `no-useless-escape` 告警噪音，保持输出不变）。
- 2026-02-23：统一 `Archive` / `ZipJsArchive` / `Store` 的 `revokeUrl()` 语义：仅对 object URL 执行 revoke，并在 revoke 后清理 cache（提升鲁棒性，避免返回已失效的 blob URL）。

## 重构点（Backlog）

按优先级从高到低（会随阅读推进持续更新）：

1. `src/book/*` / `src/rendition/*`：梳理对象生命周期与依赖方向，减少“隐式全局 / side effect”耦合（可扩展性）。
2. `src/utils/core/dom.ts`：DOM 遍历/查询工具较集中，建议按“纯函数 vs DOM 环境依赖”分层，便于复用与测试（结构 / 可测试性）。

## 未阅读模块（Not Yet Reviewed）

### Source (src/)

- [ ] `src/annotations.ts`
- [ ] `src/container.ts`
- [ ] `src/contents/`
- [ ] `src/contents.ts`
- [ ] `src/core/`
- [ ] `src/displayoptions.ts`
- [ ] `src/index.ts`
- [ ] `src/layout.ts`
- [ ] `src/managers/`
- [ ] `src/mapping/`
- [ ] `src/mapping.ts`
- [ ] `src/navigation.ts`
- [ ] `src/packaging.ts`
- [ ] `src/pagelist.ts`
- [ ] `src/playback-controller/`
- [ ] `src/playback-controller.ts`
- [ ] `src/read-aloud.ts`
- [ ] `src/rendition/`
- [ ] `src/rendition.ts`
- [ ] `src/resources/`
- [ ] `src/resources.ts`
- [ ] `src/speech-highlighter/`
- [ ] `src/speech-highlighter.ts`
- [ ] `src/spine.ts`
- [ ] `src/themes.ts`
- [ ] `src/utils/`
