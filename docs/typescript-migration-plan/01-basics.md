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

