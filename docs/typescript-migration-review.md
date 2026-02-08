# epub.js JavaScript → TypeScript 迁移 Review（ts-migration worktree）

本文面向 `ts-migration` 分支（worktree：`../epubjs-ts-migration`），聚焦“JS → TS 迁移是否引入发布/运行/类型层面的风险”，并给出可执行的修正建议与验证方式。

---

## 1. 变更范围快照（相对 `dev`）

整体方向与 `docs/typescript-migration-plan.md` 的“Babel 产出 JS + tsc typecheck / emit d.ts”一致：

- `src/**/*.js` 基本全部迁移为 `src/**/*.ts`，并同步更新入口与构建链路。
- `webpack.config.js`：入口改为 `./src/epub.ts`，并支持 `.ts` 与 `@babel/preset-typescript`。
- `karma.conf.js`：补充 TS glob 与插件显式列表。
- `package.json`：
  - 新增 `typecheck / types:build / types:test`。
  - `compile` 拆分为 `compile:cjs / compile:esm` 并覆盖 `".js,.ts"` 扩展名。
  - `module` 指向 `es/index.js`（避免下游消费 `src/` 里的 TS 源码）。
- 新增 `tsconfig.json` + `tsconfig.types.json`，并引入 `types/shims/*` 兜底声明。

---

## 2. 建议的验证命令（尽量贴近 CI）

### 2.1 TS / Types（不依赖浏览器）

```bash
npm run -s typecheck
npm run -s types:build
npm run -s types:test
```

### 2.2 Karma（需要 Chrome/Chromium）

当前 `npm test` 在“系统未预装 Chrome”时会直接失败，建议显式提供 `CHROME_BIN`。

如果你在 CI 或本地已经有 Playwright 的 Chromium 缓存，可用：

```bash
CHROME_BIN="$(find ~/.cache/ms-playwright -path '*chrome-linux*/chrome' -type f | head -n 1)" \
  NODE_OPTIONS=--openssl-legacy-provider \
  ./node_modules/.bin/karma start --single-run --browsers ChromeHeadlessNoSandbox
```

如果你使用系统 Chrome：

```bash
export CHROME_BIN=/path/to/chrome
npm test
```

---

## 3. 发现的问题与建议（按优先级）

### P0（建议在合并/发包前解决）

#### 3.1 `typescript` 未作为显式依赖声明

现状：

- `typecheck / types:build / types:test` 依赖 `tsc`。
- 仓库的 `devDependencies` **未声明** `typescript`。
- 当前能跑通通常是因为某个依赖**间接**带入了 `typescript`，这在锁文件/依赖更新后不稳定，容易导致 CI “突然找不到 tsc”。

建议：

- 在 `devDependencies` 中显式添加 `typescript`，并**选择一个明确版本策略**：
  - 若目标是“最小扰动”，可先 pin 到当前可用版本（例如 `~3.9.3`），再单独开 PR 升级 TS；
  - 若目标是“尽快现代化”，则需要同时处理 DOM lib、`ResizeObserver` shim 等潜在冲突（见 3.4）。

### P1（强烈建议处理，避免发布体积/契约漂移）

#### 3.2 `types:build` 产物可能被打进 npm 包，但并未作为对外 types 入口

现状：

- `types:build` 生成 `types/generated/**`（含 `.d.ts.map`）。
- `package.json#types` 仍指向手写 facade：`types/index.d.ts`。
- 仓库存在 `.npmignore`，因此 **`.gitignore` 不参与 npm 打包过滤**：
  - 如果 `prepare`/`prepack` 期间生成了 `types/generated/**`，它们很可能会被一并打包发布（除非 `.npmignore` 排除）。

风险：

- 包体积变大（尤其 `.d.ts.map`）。
- 下游/维护者容易困惑：手写 types 与生成 types 并存，哪个是“真相”。

建议（二选一，优先推荐 A）：

- A. 继续以手写 `types/index.d.ts` 为对外契约：
  - 将 `types/generated/`（以及 `**/*.d.ts.map`）加入 `.npmignore`；
  - 同时考虑把 `types:build` 从默认 `compile/prepare` 链路中移出，改为仅在需要时运行（或只在 CI 做回归检查）。
- B. 迁移为“发布 generated types”：
  - 将 `package.json#types` 指向 `types/generated/index.d.ts`；
  - 明确 `export as namespace ePub` 等 UMD 契约是否仍需手写补丁（通常仍需要一个 facade）。

#### 3.3 `.npmignore` 仍忽略旧文件名 `.babelrc`，未覆盖 `.babelrc.json`

现状：

```text
.npmignore:
  books
  test
  .babelrc
```

但仓库使用的是 `.babelrc.json`。这会导致 `.babelrc.json` 被意外打进 npm 包（是否有害取决于你的发布策略，但通常没必要）。

建议：

- `.npmignore` 增加 `.babelrc.json`（或统一忽略所有 babel 配置文件）。

#### 3.4 `types/shims/resize-observer.d.ts` 的长期兼容性风险

现状：

- shim 以全局 `declare class ResizeObserver` 形式提供类型。
- 在较新的 TypeScript/DOM lib 中，`ResizeObserver` 很可能已内置；届时 shim 可能触发重复声明错误。

建议：

- 若未来升级 `typescript`，优先在升级 PR 中验证是否仍需要该 shim：
  - 若不需要，删除或从 `tsconfig.json#include` 中排除；
  - 若仍需要，考虑改为更精准的模块声明（取决于项目实际如何使用它）。

### P2（质量/可维护性建议，可阶段性推进）

#### 3.5 `tsconfig.json` 当前关闭 `strict` 与 `noImplicitAny`

这符合“先迁移、再逐步收紧”的策略，但会导致：

- 迁移后的 TS 代码仍大量依赖 `any`，类型收益有限；
- `types:build` 生成的声明文件质量可能不理想（若未来选择发布 generated types）。

建议：

- 维持现状作为阶段 0/1 的落地，但明确后续节奏：
  - 先对 `src/utils/*` 与 `src/core/*` 引入少量关键类型（例如 `RequestOptions / ResourceResolverOptions` 这种边界接口）。
  - 再逐步开启更有性价比的约束（例如 `noImplicitAny`、`strictNullChecks`）并用局部 `// @ts-expect-error` 控制迁移成本。

#### 3.6 Babel 配置来源存在重复（`.babelrc.json` 与 `webpack.config.js`）

现状：

- `.babelrc.json` 声明了 presets（含 `@babel/preset-typescript`）。
- `webpack.config.js` 的 `babel-loader` 也内联声明了同样的 presets。

风险：

- Babel 配置合并行为在不同工具链/版本下可能产生“重复 preset”或“选项优先级不一致”的问题，导致产物差异难定位。

建议：

- 二选一：
  - A. Webpack 完全依赖 `.babelrc.json`（并用环境变量控制 legacy/minimize 目标）；或
  - B. Webpack 固定使用 loader 内联 presets，并在 loader 配置中设置 `babelrc: false` 以避免读取仓库 babel 配置。

---

## 4. 总结（是否可合并）

结论：迁移整体方向正确、构建链路已打通，且关键模块（如 `ResourceResolver`）的迁移保持了运行时语义一致性；但建议优先补齐 “工具链显式依赖 + npm 打包过滤 + types 策略收敛” 三件事，否则后续很容易在 CI / 发布环节出现不稳定或包体积/契约漂移问题。

