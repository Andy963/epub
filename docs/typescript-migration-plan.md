# epub.js JavaScript → TypeScript 迁移计划（可发布、可回滚、可验证）

> 本文的目标不是“把代码改成 TS”，而是在不破坏发包与用户使用方式的前提下，逐步提升类型质量、可维护性与重构安全性。

---

## 0. 项目快照（以当前仓库为准）

| 项 | 当前状态 |
|---|---|
| 源码 | `src/` 约 47 个 `.js` 文件，ESM 语法 |
| 运行环境 | 浏览器优先（iframe / DOM），同时提供 Node 侧构建产物 |
| 构建 | Webpack 4（产出 `dist/` UMD）+ Babel（产出 `lib/` CJS） |
| 测试 | Karma + Mocha（浏览器环境） |
| 发布 | `npm run prepare` 需持续可用 |
| 类型 | `types/` 目录存在大量手写 `.d.ts`，且有 `types/tsconfig.json` + `types/epubjs-tests.ts` 作为编译期契约测试 |

> 如果你的工作区存在未合入的文件/改动，请先以 `git ls-files` 为准更新文件清单；本文以主线的 47 个 JS 文件为基准。

### 0.1 推荐开发方式：独立分支 + worktree（建议）

结论：**TS 迁移用独立 `worktree` 会更顺滑**，但**不会改变 merge 时的冲突概率**（冲突由“是否改到同一份文件/同一行”决定）。

建议的日常工作方式：

- 主 worktree（例如当前目录）保持在基线分支（例如 `refactor`），用于 review / 跟进上游变更。
- 迁移 worktree 专注在迁移分支（例如 `ts-migration`），用于连续迁移与跑构建/测试。

创建 worktree（示例命令）：

```bash
git switch refactor
git worktree add -b ts-migration ../epubjs-ts-migration HEAD
```

常见操作：

- 保持迁移分支不过度漂移：优先小 PR、按依赖顺序迁移；必要时用 `git merge` 吸收基线分支更新（避免长期大分叉导致一次性冲突）。
- 并行开发的冲突治理：同一时间尽量只迁移一个“依赖链末端”子集（例如先 `src/utils/*`），避免两条线同时改 `book/rendition/contents` 这类中心文件。

清理 worktree（谨慎执行，确保无未提交改动）：

```bash
git worktree remove ../epubjs-ts-migration
git branch -d ts-migration
```

### 0.2 本地 / CI 环境注意事项（避免“计划正确但跑不起来”）

- **Webpack 4 + Node >= 17**：可能因 OpenSSL 3 报错（`ERR_OSSL_EVP_UNSUPPORTED`）。建议在 `build/test/prepare` 时统一设置：

```bash
export NODE_OPTIONS=--openssl-legacy-provider
```

- **Karma / Chrome**：CI 或无桌面环境下需显式提供 Chrome。建议在运行 `npm test` 前设置 `CHROME_BIN` 指向可执行文件：

```bash
export CHROME_BIN=/path/to/chrome
```

---

## 1. 迁移目标与边界

### 1.1 迁移目标（Definition of Done）

1. 所有 `src/**/*.js` 均迁移为 `src/**/*.ts`（或 `.tsx`，若出现 JSX）。
2. 产物结构清晰且稳定：
   - `lib/`：CJS（供 `main` 使用）
   - `es/`：ESM JS（供 `module` 使用，**必须是 JS，不是 TS**）
   - `dist/`：UMD bundle（Webpack 产出）
   - `types/`：对外类型入口（保持 `types/index.d.ts` 为稳定 facade）
3. 发布链路不中断：`npm run prepare` 在迁移的每一个 PR 上都可运行。
4. API 兼容：默认导出 + 命名导出 + UMD global（`ePub`）在迁移期间保持可用。
5. 类型回归可验证：`npm run types:test` 作为公开 API 的“编译期契约测试”持续通过。

### 1.2 非目标（除非明确提出）

- 不绑定 Webpack 4 → 5 升级（放到 TS 迁移完成后的独立议题）。
- 不替换 Karma/Mocha（可在迁移完成后评估）。
- 不以“大文件拆分”为强制前置（拆分是可选收益，见后文）。

---

## 2. 发布兼容性契约（每个 PR 必须维持）

迁移期间最容易出事故的是“包入口”与“类型入口”。明确约束如下：

1. `package.json#main` / `package.json#module` 永远指向**已编译的 JS**（分别指向 `lib/` / `es/`）。
2. `package.json#types` 永远指向 `types/index.d.ts`（手写 facade，长期保留）。
3. 不把 `module` 指向 `src/`：
   - 一旦 `src/` 进入 TS，`module: "src/index.ts"` 会迫使下游编译 `node_modules` 中的 TS，几乎必炸。
4. `types/index.d.ts` 需要长期保留 `export as namespace ePub;`（UMD/global 能力无法从 `.ts` 自动生成）。

---

## 3. 工具链选择（推荐：Babel 产出 JS + tsc 产出类型）

### 3.1 推荐方案：Babel transpile + tsc typecheck / emit d.ts

核心思路：

- Webpack/Karma：继续使用 `babel-loader`，新增 `@babel/preset-typescript` 支持 `.ts`。
- 库产物：Babel CLI 同时编译 `.js/.ts`，分别输出：
  - `lib/`（CJS）
  - `es/`（ESM）
- TypeScript：只做两件事：
  - `typecheck`：`tsc --noEmit`
  - `types:build`：`tsc --emitDeclarationOnly` 输出到 `types/generated/`

收益：

- 避免 `ts-loader` 与 Babel 双重转译导致的产物差异。
- “运行时 JS 语义”以 Babel 为唯一来源，调试与问题定位更简单。
- 让 `module` 指向 `es/`，彻底解决“下游消费 TS 源码”的风险。

### 3.2 备选方案：ts-loader（不推荐，尤其在 Webpack 4）

只有当你必须依赖 tsc 转译（例如特定 TS transform 行为）时才考虑，否则成本高于收益：

- 双重转译（ts-loader + babel-loader）容易导致 sourcemap / helper / module 语义差异。
- Webpack 4 下版本兼容性更脆弱。

---

## 4. 产物与入口约定（建议）

| 产物 | 目录 | 格式 | 用途 |
|------|------|------|------|
| CommonJS | `lib/` | CJS | `package.json#main` |
| ES Module | `es/` | ESM JS | `package.json#module`（bundler 消费） |
| Browser bundle | `dist/` | UMD | `webpack` 产出，浏览器直接使用 |
| Types facade | `types/index.d.ts` | `.d.ts` | `package.json#types`，长期手写 |
| Generated types | `types/generated/` | `.d.ts` | `tsc --emitDeclarationOnly` 生成，作为类型主体来源 |
| Type shims | `types/shims/` | `.d.ts` | 对无类型依赖/子路径提供声明（必须被发布） |

---

## 5. 分阶段计划（推荐执行顺序）

> 每个阶段都必须有“可验证检查点”，并且每个 PR 都能独立回滚。

### 阶段 0：基线与护栏（1 个 PR）

目标：建立“迁移不会破坏发布”的最小护栏。

建议新增/确认以下命令（只要脚本存在即可，初期不追求严格类型）：

```jsonc
{
  "scripts": {
    "typecheck": "tsc -p tsconfig.json",
    "types:build": "tsc -p tsconfig.types.json",
    "types:test": "tsc -p types/tsconfig.json"
  }
}
```

检查点：

- `npm run test` 通过
- `npm run prepare` 通过
- `npm run types:test` 通过（它是对外 API 的编译期契约）

备注（环境相关）：

- 如果你在 Node >= 17 上跑 Webpack 4，优先加 `NODE_OPTIONS=--openssl-legacy-provider`。
- 如果测试机缺少 Chrome，需要配置 `CHROME_BIN`（或改用 CI 预装的 Chrome/Chromium）。

### 阶段 1：TS 基础设施（1 个 PR）

目标：让仓库支持：

1. `.ts` 源码被 Webpack/Karma 正确编译
2. Babel CLI 能编译 `.ts` 到 `lib/` 与 `es/`
3. `tsc` 能 typecheck（noEmit）与生成声明（emitDeclarationOnly）
4. 包入口指向编译产物（不是 `src/`）

#### 1.1 添加 TypeScript 配置

根目录新增 `tsconfig.json`（用于 typecheck，noEmit）：

```jsonc
{
  "compilerOptions": {
    "target": "ES2018",
    "module": "ESNext",
    "moduleResolution": "node",
    "lib": ["ES2018", "DOM", "DOM.Iterable"],

    "strict": false,
    "noImplicitAny": false,

    "allowJs": true,
    "checkJs": false,

    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,

    "isolatedModules": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,

    "noEmit": true
  },
  "include": ["src/**/*", "types/shims/**/*"]
}
```

新增 `tsconfig.types.json`（只生成声明到 `types/generated/`）：

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "emitDeclarationOnly": true,
    "declarationDir": "./types/generated",
    "declarationMap": true
  },
  "include": ["src/**/*", "types/shims/**/*"]
}
```

#### 1.2 Babel：同时产出 `lib/`（CJS）与 `es/`（ESM）

建议将 Babel 配置改为支持两套输出（示例使用 `BABEL_ENV`）：

```jsonc
{
  "env": {
    "cjs": {
      "presets": [
        ["@babel/preset-env", { "modules": "commonjs" }],
        "@babel/preset-typescript"
      ]
    },
    "esm": {
      "presets": [
        ["@babel/preset-env", { "modules": false }],
        "@babel/preset-typescript"
      ]
    }
  }
}
```

对应脚本建议：

```jsonc
{
  "scripts": {
    "compile:cjs": "BABEL_ENV=cjs babel src --extensions \".js,.ts\" --out-dir lib --source-maps",
    "compile:esm": "BABEL_ENV=esm babel src --extensions \".js,.ts\" --out-dir es --source-maps",
    "compile": "npm run compile:cjs && npm run compile:esm && npm run types:build"
  }
}
```

> 关键点：`babel` 默认不会处理 `.ts`，必须显式加 `--extensions ".js,.ts"`。

#### 1.3 Webpack：让 `babel-loader` 同时处理 `.js/.ts`

当前 Webpack 中 Babel preset 是内联配置，因此不要只改 `.babelrc*` 就以为生效；必须同步修改 Webpack loader 规则。

建议要点：

- `resolve.extensions` 增加 `.ts`
- loader `test` 改为 `/\.[jt]s$/`
- 在 `babel-loader` presets 中加入 `@babel/preset-typescript`

示例（只展示关键结构）：

```js
resolve: {
  extensions: [".ts", ".js"],
  alias: { path: "path-webpack" }
},
module: {
  rules: [
    {
      test: /\.[jt]s$/,
      exclude: /node_modules/,
      use: {
        loader: "babel-loader",
        options: {
          presets: [
            ["@babel/preset-env", { "modules": false }],
            "@babel/preset-typescript"
          ]
        }
      }
    }
  ]
}
```

#### 1.4 Type shims：对外发布所需的缺失声明

一些依赖（或其子路径 import）没有类型声明，必须由本包发布出来，否则消费者在读取 `types/*` 时会报错。

建议在 `types/shims/` 下维护 shim，并由 `types/index.d.ts` 引用：

```ts
/// <reference path="./shims/event-emitter.d.ts" />
/// <reference path="./shims/marks-pane.d.ts" />
/// <reference path="./shims/path-webpack.d.ts" />
/// <reference path="./shims/jszip-dist-jszip.d.ts" />
```

示例 shim（先追求“可编译”，再逐步精化）：

```ts
// types/shims/event-emitter.d.ts
declare module "event-emitter" {
  export type Listener = (...args: any[]) => void;

  export interface Emitter {
    on(event: string, listener: Listener): this;
    once(event: string, listener: Listener): this;
    off(event: string, listener?: Listener): this;
    emit(event: string, ...args: any[]): boolean;
  }

  function eventEmitter<T extends object>(target?: T): T & Emitter;
  export default eventEmitter;
}
```

```ts
// types/shims/marks-pane.d.ts
declare module "marks-pane" {
  export class Pane {}
  export class Highlight {}
  export class Underline {}
}
```

```ts
// types/shims/path-webpack.d.ts
declare module "path-webpack" {
  export function resolve(...paths: string[]): string;
  export function join(...paths: string[]): string;
  export function dirname(p: string): string;
  export function basename(p: string, ext?: string): string;
  export function extname(p: string): string;
}
```

```ts
// types/shims/jszip-dist-jszip.d.ts
declare module "jszip/dist/jszip" {
  import JSZip from "jszip";
  export default JSZip;
}
```

#### 1.5 package.json 入口切换（必须在任何 TS 源码合入前完成）

将入口指向编译产物（示例）：

```jsonc
{
  "main": "lib/index.js",
  "module": "es/index.js",
  "types": "types/index.d.ts"
}
```

检查点（阶段 1 结束）：

- `npm run compile` 通过（产出 `lib/` + `es/` + `types/generated/`）
- `npm run build` 通过（Webpack 能处理 `.ts`）
- `npm run test` 通过
- `npm run types:test` 通过
- `npm run prepare` 通过

---

### 阶段 2：迁移策略与 PR 粒度（持续规则）

每个迁移 PR（除了阶段 0/1 的 infra PR）建议遵循：

1. 每个 PR 迁移 1–3 个文件（按依赖从“叶子”到“核心”）。
2. 仅做“类型化改造 + 必要的语义等价重写”，避免顺便做大重构。
3. 每个 PR 的验证命令固定为：
   - `npm run typecheck`
   - `npm run compile`
   - `npm run build`
   - `npm run test`
   - `npm run types:test`

---

### 阶段 3：迁移 utils（建议先做，收益高、风险低）

迁移顺序（按依赖关系从简到繁）：

| 序号 | 文件 | 主要依赖 | 备注 |
|------|------|----------|------|
| 1 | `src/utils/constants.js` | - | 常量 |
| 2 | `src/utils/scrolltype.js` | - | 小文件 |
| 3 | `src/utils/mime.js` | - | - |
| 4 | `src/utils/performance.js` | - | - |
| 5 | `src/utils/hook.js` | - | - |
| 6 | `src/utils/path.js` | path-webpack | 依赖 shim |
| 7 | `src/utils/url.js` | path.js | - |
| 8 | `src/utils/footnotes.js` | - | - |
| 9 | `src/utils/replacements.js` | core.js, url.js | - |
| 10 | `src/utils/request.js` | core.js, path.js | - |
| 11 | `src/utils/queue.js` | core.js | - |
| 12 | `src/utils/core.js` | @xmldom/xmldom | 核心工具，最后迁移 |

每个文件的标准迁移步骤（模板）：

1. `git mv src/path/to/file.js src/path/to/file.ts`
2. 修复 TS 语法差异（例如 `var` → `const/let` 不是必须，但常常有助于更准确的类型）
3. 添加最小必要类型：
   - exported value / function signatures
   - function parameters / returns
4. 尽量避免引入新类型文件（除非多个模块共享类型）
5. 运行验证命令集

#### `src/utils/core` 的特殊点：`defer` 的“构造器用法”

当前调用点大量使用 `new defer()`（例如 `src/book.js`），迁移时容易踩坑：

- 如果把 `defer` 改成普通函数返回对象，会破坏 `new defer()` 的行为。
- 推荐做法是保持对外行为一致，先把类型建模出来：

```ts
export interface Deferred<T = unknown> {
  id: string;
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}
```

然后根据风险偏好二选一：

- 保守路线：继续保留 `function defer(this: Deferred<any>) { ... }` 的“new-able”实现。
- 渐进重构：引入 `class DeferredImpl<T>` 或 `createDeferred<T>()`，再逐步替换调用点（建议在 TS 化稳定后做）。

检查点（阶段 3 结束）：

- `src/utils/**/*.ts` 全部完成迁移
- 验证命令集全绿
- `types/generated/utils/*` 已生成（不要求质量完美，但要求可生成）

---

### 阶段 4：迁移 `src/core/`（适配层）

建议顺序：

1. `src/core/resource-resolver.js`
2. `src/core/resource-cache.js`
3. `src/core/spine-loader.js`
4. `src/core/zipjs-archive.js`

注意点：

- 这几个模块往往依赖 utils 与 zip.js 类型；迁移时优先把外部交互面（输入/输出）类型化。

检查点：

- `src/core/**/*.ts` 全部完成迁移
- 验证命令集全绿

---

### 阶段 5：迁移解析/数据模块（相对独立）

建议顺序（先小后大）：

1. `src/container.js`
2. `src/displayoptions.js`
3. `src/navigation.js`
4. `src/packaging.js`
5. `src/pagelist.js`
6. `src/layout.js`
7. `src/themes.js`
8. `src/archive.js`
9. `src/store.js`
10. `src/resources.js`（大文件，可拆成 2–3 个 PR）

共享类型建议：可以新增 `src/types.ts` 承载跨模块共享的接口（只在确实能降低重复时才引入）。

示例结构（概念性）：

```ts
export interface NavItem {
  id: string;
  href: string;
  label: string;
  parent?: string;
  subitems?: NavItem[];
}
```

检查点：

- 上述模块全部 TS 化
- 验证命令集全绿

---

### 阶段 6：迁移核心引擎模块（复杂度最高）

建议顺序：

1. `src/epubcfi.js`（最大风险）
2. `src/section.js`
3. `src/spine.js`
4. `src/mapping.js`
5. `src/locations.js`
6. `src/annotations.js`

建议策略：

- 先把“公共输入/输出结构”类型化，再逐步深入内部细节。
- 对 DOM / Range / Node 的使用要尽量对齐 TS 内置 DOM 类型；必要时允许有限的断言（配合注释说明原因）。

检查点：

- 上述模块全部 TS 化
- 验证命令集全绿

---

### 阶段 7：迁移渲染层（managers）

建议顺序：

1. `src/managers/helpers/views.js`
2. `src/managers/helpers/stage.js`
3. `src/managers/helpers/snap.js`
4. `src/managers/views/inline.js`
5. `src/managers/views/iframe.js`（依赖 marks-pane shim）
6. `src/managers/default/index.js`
7. `src/managers/continuous/index.js`

建议先把 View / ViewManager 的最小接口抽出来，避免全工程散落 `any`：

```ts
export interface View {
  id: string;
  index: number;
  element: HTMLElement;
  display(request: (...args: any[]) => any): Promise<unknown>;
  destroy(): void;
}
```

检查点：

- managers 全部 TS 化
- 验证命令集全绿

---

### 阶段 8：迁移顶层组合模块

建议顺序：

1. `src/contents.js`
2. `src/rendition.js`
3. `src/book.js`

这些文件体积大、状态复杂：

- 强烈建议拆成多个 PR（例如每次迁移一个内部子区域的方法组）。
- 保持对外 API 不变（尤其 `Book` / `Rendition` 的构造参数与事件语义）。

检查点：

- 以上模块 TS 化
- 验证命令集全绿

---

### 阶段 9：迁移 PDF 支持模块

建议顺序：

1. `src/pdf/section.js`
2. `src/pdf/view.js`
3. `src/pdf/book.js`

注意：

- `pdf/book` 体积巨大且与 pdf.js 交互深；如果未来引入 `pdfjs-dist` 的类型，需要在 shims 或依赖层明确策略。

检查点：

- pdf 模块 TS 化
- 验证命令集全绿

---

### 阶段 10：入口文件迁移 + 文档脚本修订

目标：迁移 `src/epub.js` 与 `src/index.js`，并确保：

- Webpack entry 指向 `src/epub.ts`
- 生成的 `lib/` / `es/` / `dist/` 都正常
- 文档生成脚本仍可运行

文档脚本注意点：

- 现有 `documentation` 工具对 TS 支持有限。
- 迁移后建议让 docs 生成基于已编译 JS（`es/epub.js` 或 `lib/epub.js`），或改用 `typedoc`（作为独立 PR）。

检查点：

- 入口 TS 化
- `npm run docs` 可运行（或明确迁移/替代方案）
- 验证命令集全绿

---

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
