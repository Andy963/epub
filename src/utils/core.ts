/**
 * Core Utilities and Helpers
 * @module Core
 */

export { requestAnimationFrame } from "./core/animation";
export { createBase64Url, createBlob, createBlobUrl, revokeBlobUrl, blob2base64 } from "./core/blob";
export { defer } from "./core/defer";
export type { Deferred, DeferConstructor } from "./core/defer";
export {
	borders,
	bounds,
	documentHeight,
	filterChildren,
	findChildren,
	getParentByTagName,
	indexOfElementNode,
	indexOfNode,
	indexOfTextNode,
	isElement,
	nodeBounds,
	parents,
	prefixed,
	qs,
	qsa,
	qsp,
	querySelectorByType,
	sprint,
	treeWalker,
	walk,
	windowBounds,
} from "./core/dom";
export { uuid } from "./core/id";
export { isFloat, isNumber } from "./core/number";
export { defaults, extend, type } from "./core/object";
export { isXml, parse } from "./core/parse";
export { RangeObject } from "./core/range-object";
export { indexOfSorted, insert, locationOf } from "./core/sorted-array";
