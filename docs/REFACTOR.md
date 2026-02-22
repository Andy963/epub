# 重构追踪（epub.js）

目标：在**不改变对外行为与发布契约**的前提下，逐步提升代码结构、可扩展性、可维护性与性能；每次改动都尽量小、可审阅、可回滚。

> 说明：本文件用于追踪“已经阅读过哪些模块 / 待重构点 / 尚未阅读模块”。每轮重构开始前，先同步到 `origin/main`（以本地 `origin/main` 引用为准），并确保工作区干净。

## 当前基线

- Base: `origin/main` @ `9166ba8`
- Last updated: 2026-02-22

## 已阅读模块（Reviewed）

### Tooling / Workflow

- [x] `package.json`（scripts: lint / typecheck / karma test）
- [x] `karma.conf.js`（Karma + webpack pipeline）

### Docs

- [x] `docs/typescript-migration-plan.md`（索引与拆分结构）

### Source (src/)

- [x] `src/epub.ts`（public entry: `ePub()` factory + static exports）
- [x] `src/utils/core.ts`（core utilities re-export surface）

### Tests

- [x] `test/book-pagelist.js`（新增：Book pageList contract）
- [x] `test/dom-treewalker.js`（新增：`sprint()` over detached document）
- [x] `test/section-render.js`（新增：`Section.render()` serializer fallback）

## 已完成（Completed）

- 2026-02-22：`src/epub.ts` 清理未使用 import（降低依赖噪音，减少 lint 告警）。

## 重构点（Backlog）

按优先级从高到低（会随阅读推进持续更新）：

1. `src/epubcfi/compare.ts`：存在未使用变量与重复声明告警，需梳理对外语义并补足测试（正确性 / 可维护性）。
2. `src/locations/worker.ts`：大量字符串转义与格式告警，建议抽取模板与构建逻辑，降低可读性负担（可维护性）。
3. `src/book/*` / `src/rendition/*`：梳理对象生命周期与依赖方向，减少“隐式全局 / side effect”耦合（可扩展性）。
4. `src/utils/core/dom.ts`：DOM 遍历/查询工具较集中，建议按“纯函数 vs DOM 环境依赖”分层，便于复用与测试（结构 / 可测试性）。

## 未阅读模块（Not Yet Reviewed）

### Source (src/)

- [ ] `src/annotations.ts`
- [ ] `src/archive.ts`
- [ ] `src/book/`
- [ ] `src/book.ts`
- [ ] `src/container.ts`
- [ ] `src/contents/`
- [ ] `src/contents.ts`
- [ ] `src/core/`
- [ ] `src/displayoptions.ts`
- [ ] `src/epubcfi/`
- [ ] `src/epubcfi.ts`
- [ ] `src/index.ts`
- [ ] `src/layout.ts`
- [ ] `src/locations/`
- [ ] `src/locations.ts`
- [ ] `src/managers/`
- [ ] `src/mapping/`
- [ ] `src/mapping.ts`
- [ ] `src/navigation.ts`
- [ ] `src/packaging.ts`
- [ ] `src/pagelist.ts`
- [ ] `src/pdf/`
- [ ] `src/playback-controller/`
- [ ] `src/playback-controller.ts`
- [ ] `src/read-aloud.ts`
- [ ] `src/rendition/`
- [ ] `src/rendition.ts`
- [ ] `src/resources/`
- [ ] `src/resources.ts`
- [ ] `src/section.ts`
- [ ] `src/speech-highlighter/`
- [ ] `src/speech-highlighter.ts`
- [ ] `src/spine.ts`
- [ ] `src/store.ts`
- [ ] `src/themes.ts`
- [ ] `src/utils/`
