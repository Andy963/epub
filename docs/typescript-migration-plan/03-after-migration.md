# epub.js JavaScript → TypeScript 迁移计划（第 3 部分：类型切换 / 风险 / 收尾）

## 6. 类型切换策略（手写 `.d.ts` → tsc 生成）

### 6.1 原则

1. 迁移初期：继续以手写 `types/*.d.ts` 作为对外类型来源（保证稳定）。
2. 并行阶段：持续生成 `types/generated/`（允许存在 `any`，但必须能生成）。
3. 切换阶段：把 `types/index.d.ts` 变为 facade：
   - 保留 `export as namespace ePub;`
   - 引用 `types/shims/*`
   - 通过 re-export 暴露 `types/generated/*` 的主体类型
4. 切换完成后：逐步删除/归档旧手写 `types/*.d.ts`（保留 facade 与类型测试文件）。

### 6.2 推荐的 facade 结构（示例）

```ts
/// <reference path="./shims/event-emitter.d.ts" />
/// <reference path="./shims/marks-pane.d.ts" />
/// <reference path="./shims/path-webpack.d.ts" />
/// <reference path="./shims/jszip-dist-jszip.d.ts" />

export as namespace ePub;

export { default } from "./generated/epub";
export { default as Book } from "./generated/book";
export { default as PdfBook } from "./generated/pdf/book";
export { default as EpubCFI } from "./generated/epubcfi";
export { default as Rendition } from "./generated/rendition";
export { default as Contents } from "./generated/contents";
export { default as Layout } from "./generated/layout";
```

> 说明：路径以最终 generated 的输出为准；切换时一次性把入口整理清楚，避免 accidental export。

### 6.3 切换检查点（强制）

- `npm run types:build` 生成完整 `types/generated/`
- `npm run types:test` 通过
- 下游最小示例可通过（至少包含默认导出 + `Book` + `renderTo` 等关键路径）

---

## 7. 严格度收紧（在全量迁移完成后进行）

推荐顺序：

1. 开启 `noImplicitAny`
2. 开启 `strict`
3. 视情况开启：
   - `noUnusedLocals`
   - `noUnusedParameters`
   - `noFallthroughCasesInSwitch`
   - `exactOptionalPropertyTypes`

建议用“目录/模块”为单位分批推进，而不是一次性全开全修。

---

## 8. 大文件拆分（可选项，不建议与 TS 迁移强绑定）

### 8.1 为什么默认不在迁移时拆分

- 迁移本身已经是“语义改动风险”很高的操作；同时拆分会把 diff 放大、回归难度增大。
- 如果必须拆分，建议在 TS 化稳定后再做，或只对最难维护的文件做最小拆分。

### 8.2 如果决定拆分：兼容策略

关键原则：**保留旧路径的 facade 文件**，避免破坏内部/外部的 deep import 习惯用法。

示例结构（概念）：

```text
src/
  book/
    index.ts
    opener.ts
  book.ts        # facade: re-export default from "./book/index"
```

这样可以同时满足：

- `import Book from "./book"`（旧写法仍然工作）
- 编译后仍保留 `lib/book.js` / `es/book.js`（旧 deep import 更不容易被破坏）

---

## 9. 风险清单与应对

1. **依赖缺失类型**：通过 `types/shims/` 提供并确保发布；否则消费者会在读取 `.d.ts` 时报错。
2. **DOM 类型差异**：Karma/浏览器环境使用 DOM 类型，优先使用内置类型；必要时允许断言，但要收敛在边界层。
3. **动态属性/混入模式**：例如 `event-emitter` 的 prototype mixin。迁移时优先用交叉类型或接口合并描述，不要急着重写实现。
4. **`defer` 构造器语义**：先建模类型再考虑实现替换，避免破坏 `new defer()` 语义。
5. **文档生成工具**：`documentation` 对 TS 不友好，尽早决定是基于编译产物生成还是迁移到 `typedoc`。
6. **入口字段变更的生态影响**：`module` 从 `src/index.js` 切换到 `es/index.js`，对 bundler 影响小，但需要确保 `es/` 产物存在且可用。
7. **Node 版本与构建链路**：Webpack 4 在 Node >= 17 可能需要 `NODE_OPTIONS=--openssl-legacy-provider`；建议 CI 固化环境或显式设置环境变量。
8. **Headless 浏览器依赖**：Karma 运行依赖 Chrome/Chromium；CI 需预装浏览器或显式设置 `CHROME_BIN`。

---

## 10. PR 模板（建议复制到每个迁移 PR 描述中）

- Scope:
  - Migrated: `src/...` → `src/...`
  - Public API: unchanged
  - Runtime behavior: unchanged
- Verification:
  - `npm run typecheck`
  - `npm run compile`
  - `npm run build`
  - `npm run test`
  - `npm run types:test`
- Notes:
  - New shims: yes/no
  - Known follow-ups: ...

---

## 11. 发布前检查清单（建议在关键节点执行）

适用场景：

- 切换 `package.json#module`（从 `src/` → `es/`）
- 切换 `types/index.d.ts`（从手写主体 → generated facade）
- 引入/调整 `types/shims/*`
- 首次引入 `.ts` 源码进入发布包

建议检查项：

1. 包入口字段是否一致：`main`/`module`/`types` 都指向预期路径
2. `npm pack` 打出来的包内容是否包含必需目录：`lib/`、`es/`、`dist/`、`types/`（含 `types/shims/` 与未来的 `types/generated/`）
3. 是否意外发布了不应发布的内容（例如巨大的 fixture、调试产物等）
4. UMD/global 类型是否仍然可用（`export as namespace ePub`）

建议命令（示例）：

```bash
npm pack
tar -tf epubjs-*.tgz | head -n 200
node -e "const pkg=require('./package.json'); console.log(pkg.main, pkg.module, pkg.types)"
```

---

## 12. 最终化（收尾阶段建议拆成独立 PR）

### 12.1 删除不再需要的类型生成工具

当且仅当“类型切换策略”完成（`types/index.d.ts` 变为 facade，主体类型来自 `types/generated/`）后，再移除旧工具链：

```bash
npm uninstall tsd-jsdoc
```

### 12.2 ESLint 升级为 TS-aware（可选，但推荐）

```bash
npm install --save-dev @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

示例（概念性）：

```js
module.exports = {
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"]
};
```

### 12.3 文档生成策略收敛

二选一（建议独立 PR）：

1. 继续使用 `documentation`：让它基于编译产物（`es/epub.js` 或 `lib/epub.js`）生成
2. 迁移到 `typedoc`：以 TS 源码为准生成 API 文档

### 12.4 清理与稳定化

- 删除/归档旧手写 `types/*.d.ts`（保留 `types/index.d.ts` facade 与 `types/epubjs-tests.ts`）
- 可选：为 `compile` 增加 clean step，避免残留文件造成误判（例如删除 `lib/`、`es/`、`types/generated/` 后再编译）
- 可选：将“验证命令集”加入 CI（如果存在 CI）

---

## 附录 A：目标目录结构（概念）

```text
src/
  annotations.ts
  archive.ts
  book.ts
  container.ts
  contents.ts
  core/
    resource-cache.ts
    resource-resolver.ts
    spine-loader.ts
    zipjs-archive.ts
  displayoptions.ts
  epub.ts
  epubcfi.ts
  index.ts
  layout.ts
  locations.ts
  managers/
    continuous/index.ts
    default/index.ts
    helpers/snap.ts
    helpers/stage.ts
    helpers/views.ts
    views/iframe.ts
    views/inline.ts
  mapping.ts
  navigation.ts
  packaging.ts
  pagelist.ts
  pdf/
    book.ts
    section.ts
    view.ts
  resources.ts
  section.ts
  spine.ts
  store.ts
  themes.ts
  utils/
    constants.ts
    core.ts
    footnotes.ts
    hook.ts
    mime.ts
    path.ts
    performance.ts
    queue.ts
    replacements.ts
    request.ts
    scrolltype.ts
    url.ts

lib/
  (cjs output)
es/
  (esm js output)
dist/
  (webpack umd bundles)
types/
  index.d.ts
  epubjs-tests.ts
  tsconfig.json
  generated/
    (tsc declarations)
  shims/
    (ambient module declarations)
```
