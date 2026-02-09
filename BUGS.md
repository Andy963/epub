# Bug Report

本文档记录在阅读源码过程中发现的**高置信缺陷**与**工程化/兼容性问题**，并给出最小复现思路与修复建议（未在本次改动中直接修复）。

## 1. `Path` 将带点号的目录误判为文件，导致目录模式被识别为 `epub`

- 位置：
  - `src/utils/path.ts:34` / `src/utils/path.ts:40`
  - `src/book.ts:651`
  - `test/core.js:61`（该用例被 `xit` 跳过）
- 问题：
  - 当输入是目录且目录名包含点号（例如 `index.epub/`）时，`path.parse("/a/index.epub/")` 会把 `index.epub` 当作 `base/ext`，`Path` 仍会把 `extension` 设置为 `"epub"`，即使它是目录。
  - `Book.determineType` 依赖 `Path.extension` 判断输入类型，从而把 `https://example.com/book.epub/` 这种“解压后的目录模式”误判成 `INPUT_TYPE.EPUB`（归档 epub），进而走错打开路径。
- 复现思路：

```js
import Book from "./src/book";

const book = new Book();
await book.open("https://example.com/my-book.epub/");
```

- 修复建议（二选一，推荐前者）：
  1. 在 `Path` 构造函数里，如果 `isDirectory(pathString)` 为真，则强制 `filename = ""`、`extension = ""`。
  2. 在 `Book.determineType` 里优先判断 `input.endsWith("/")`，直接返回 `INPUT_TYPE.DIRECTORY`，不要依赖 `extension`。

## 2. `Url` 构造函数在非浏览器环境会直接触发 `ReferenceError: window is not defined`

- 位置：`src/utils/url.ts:36`
- 问题：
  - 代码通过 `window && window.location` 判断是否存在 `window`，但在 Node/SSR 环境里引用 `window` 本身就会抛 `ReferenceError`，导致相对路径解析不可用。
- 复现思路：

```js
import Url from "./src/utils/url";

new Url("OPS/chapter1.xhtml");
```

- 修复建议：
  - 把条件改为 `typeof window !== "undefined" && window.location`。

## 3. `Url.relative()` 参数顺序反了（从/to 颠倒）

- 位置：`src/utils/url.ts:107`
- 问题：
  - `path.relative(from, to)` 的参数顺序应为 `(this.directory, what)`，当前实现为 `(what, this.directory)`，得到的是反向路径。
- 复现思路：

```js
import Url from "./src/utils/url";

const base = new Url("http://example.com/a/b/");
base.relative("/a/b/c.xhtml"); // expected: "c.xhtml"
```

- 修复建议：
  - 改为 `return path.relative(this.directory, what);`。

## 4. `Queue.dequeue()` 对同步返回值的处理会抛异常（误用 `Function.prototype.apply`）

- 位置：`src/utils/queue.ts:96`
- 问题：
  - 同步返回的 `result` 被当作 `apply` 的第二个参数使用：`resolve.apply(..., result)`。
  - 当 `result` 是数字/对象等非 array-like 时，会触发 `TypeError: CreateListFromArrayLike called on non-object`，或在其他情况下把 resolve 参数错误展开。
- 复现思路：

```js
const Queue = require("./lib/utils/queue").default;

const q = new Queue({});
q.running = true; // prevent auto-run

const p = q.enqueue(() => 123);
q.dequeue(); // throws

await p;
```

- 修复建议：
  - 直接 `inwait.deferred.resolve(result);`。
  - promise 分支也不需要 `apply(arguments)`，用 `then(value => resolve(value), err => reject(err))` 即可。

## 5. `Queue.run()` 假设存在 `window` 与 `requestAnimationFrame`

- 位置：`src/utils/queue.ts:133`
- 问题：
  - `this.tick` 可能为 `false`（见 `src/utils/core.ts` 对 `requestAnimationFrame` 的导出），且 `run()` 内部硬编码 `this.tick.call(window, ...)`：
    - 在没有 `window` 的环境（Worker/SSR/Node）会直接崩溃。
    - 在没有 `requestAnimationFrame` 的环境会因为 `tick` 非函数而崩溃。
- 修复建议：
  - 用 `typeof window !== "undefined"` 守卫。
  - 当 `requestAnimationFrame` 不可用时 fallback 到 `setTimeout(fn, 0)`。

## 6. `Stage.destroy()` 存在两处清理错误：DOM 移除对象不对、orientation 事件名大小写不一致

- 位置：
  - `src/managers/helpers/stage.ts:221`（注册 `"orientationchange"`）
  - `src/managers/helpers/stage.ts:414`（移除节点）
  - `src/managers/helpers/stage.ts:422`（移除 `"orientationChange"`）
- 问题 1（DOM 移除）：
  - `hidden` 模式下 `attachTo()` 把 `wrapper` append 到外部元素，`container` 是 `wrapper` 的子节点。
  - `destroy()` 用 `this.element.removeChild(this.container)` 移除，会抛 `NotFoundError`（`container` 不是 `element` 的直接 child）。
- 问题 2（事件清理）：
  - 注册事件名是 `"orientationchange"`，移除时却使用 `"orientationChange"`，导致监听永远不会被移除。
- 修复建议：
  - 用 `base`（`wrapper` 或 `container`）作为实际移除对象，或用 `this.container.parentNode?.removeChild(this.container)`。
  - 统一事件名为 `"orientationchange"`。

## 7. Manager 注册的 `window.unload` 监听无法移除，可能导致实例泄漏

- 位置：
  - `src/managers/default/index.ts:128`
  - `src/managers/continuous/index.ts:401`
- 问题：
  - 使用 `window.addEventListener("unload", function () { ... }.bind(this))` 注册匿名且已 bind 的函数；
  - `removeEventListeners()` / `destroy()` 没有对应移除逻辑，且因为缺少函数引用也无法移除；
  - 若生命周期中会创建/销毁多个 manager，旧实例会被 unload handler 强引用，可能影响 GC。
- 修复建议：
  - 将 handler 保存到字段（例如 `this._onUnload`），并在 `destroy()` 里 `removeEventListener`。

## 8. `npm run lint` 实际不生效：不匹配 `.ts` 且强制 `exit 0`

- 位置：`package.json:20`
- 问题：
  - `eslint ... src` 在默认扩展名规则下不会匹配 TypeScript 文件，导致 lint 不运行或直接提示 “No files matching the pattern 'src' were found”。
  - 末尾 `exit 0` 会把任何 eslint 失败都吞掉，CI/本地无法感知问题。
- 修复建议：
  - 明确匹配扩展名并移除吞错逻辑，例如：

```json
{
  "lint": "eslint -c .eslintrc.js \"src/**/*.{ts,js}\""
}
```

