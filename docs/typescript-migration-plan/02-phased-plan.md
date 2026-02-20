# epub.js JavaScript → TypeScript 迁移计划（第 2 部分：分阶段计划）

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

