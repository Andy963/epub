import EventEmitter from "event-emitter";
import EpubCFI from "./epubcfi";
import { EPUBJS_VERSION, DOM_EVENTS } from "./utils/constants";

import {
	contentHeight as contentHeightImpl,
	contentWidth as contentWidthImpl,
	height as heightImpl,
	scrollHeight as scrollHeightImpl,
	scrollWidth as scrollWidthImpl,
	textHeight as textHeightImpl,
	textWidth as textWidthImpl,
	width as widthImpl,
} from "./contents/dimensions";
import {
	addClass as addClassImpl,
	addScript as addScriptImpl,
	addStylesheet as addStylesheetImpl,
	addStylesheetCss as addStylesheetCssImpl,
	addStylesheetRules as addStylesheetRulesImpl,
	css as cssImpl,
	direction as directionImpl,
	_getStylesheetNode as _getStylesheetNodeImpl,
	overflow as overflowImpl,
	overflowX as overflowXImpl,
	overflowY as overflowYImpl,
	removeClass as removeClassImpl,
	viewport as viewportImpl,
	writingMode as writingModeImpl,
} from "./contents/styles";
import {
	addEventListeners as addEventListenersImpl,
	addSelectionListeners as addSelectionListenersImpl,
	destroy as destroyImpl,
	expand as expandImpl,
	fontLoadListeners as fontLoadListenersImpl,
	imageLoadListeners as imageLoadListenersImpl,
	linksHandler as linksHandlerImpl,
	listeners as listenersImpl,
	mediaQueryListeners as mediaQueryListenersImpl,
	mutationObservers as mutationObserversImpl,
	onSelectionChange as onSelectionChangeImpl,
	removeEventListeners as removeEventListenersImpl,
	removeListeners as removeListenersImpl,
	removeSelectionListeners as removeSelectionListenersImpl,
	resizeCheck as resizeCheckImpl,
	resizeListeners as resizeListenersImpl,
	resizeObservers as resizeObserversImpl,
	transitionListeners as transitionListenersImpl,
	triggerEvent as triggerEventImpl,
	triggerSelectedEvent as triggerSelectedEventImpl,
	visibilityListeners as visibilityListenersImpl,
} from "./contents/events";
import {
	cfiFromNode as cfiFromNodeImpl,
	cfiFromRange as cfiFromRangeImpl,
	locationOf as locationOfImpl,
	map as mapImpl,
	mapPage as mapPageImpl,
	range as rangeImpl,
	root as rootImpl,
} from "./contents/cfi";
import { columns as columnsImpl, fit as fitImpl, scaler as scalerImpl, size as sizeImpl } from "./contents/layout";
import { epubReadingSystem as epubReadingSystemImpl, layoutStyle as layoutStyleImpl } from "./contents/reading-system";

/**
 * Handles DOM manipulation, queries and events for View contents
 * @class
 * @param {document} doc Document
 * @param {element} content Parent Element (typically Body)
 * @param {string} cfiBase Section component of CFIs
 * @param {number} sectionIndex Index in Spine of Conntent's Section
 */
class Contents {
	[key: string]: any;

	constructor(doc: Document, content?: HTMLElement, cfiBase?: string, sectionIndex?: number) {
		// Blank Cfi for Parsing
		this.epubcfi = new EpubCFI();

		this.document = doc;
		this.documentElement = this.document.documentElement;
		this.content = content || this.document.body;
		this.window = this.document.defaultView;

		this._size = {
			width: 0,
			height: 0
		};

		this.sectionIndex = sectionIndex || 0;
		this.cfiBase = cfiBase || "";

		this.epubReadingSystem("epub.js", EPUBJS_VERSION);
		this.called = 0;
		this.active = true;
		this.listeners();
	}

	/**
	 * Get DOM events that are listened for and passed along
	 */
	static get listenedEvents() {
		return DOM_EVENTS;
	}

	width(w?) {
		return widthImpl.call(this, w);
	}

	height(h?) {
		return heightImpl.call(this, h);
	}

	contentWidth(w?) {
		return contentWidthImpl.call(this, w);
	}

	contentHeight(h?) {
		return contentHeightImpl.call(this, h);
	}

	textWidth() {
		return textWidthImpl.call(this);
	}

	textHeight() {
		return textHeightImpl.call(this);
	}

	scrollWidth() {
		return scrollWidthImpl.call(this);
	}

	scrollHeight() {
		return scrollHeightImpl.call(this);
	}

	overflow(overflow?) {
		return overflowImpl.call(this, overflow);
	}

	overflowX(overflow?) {
		return overflowXImpl.call(this, overflow);
	}

	overflowY(overflow?) {
		return overflowYImpl.call(this, overflow);
	}

	css(property, value?, priority?) {
		return cssImpl.call(this, property, value, priority);
	}

	viewport(options?) {
		return viewportImpl.call(this, options);
	}

	expand() {
		return expandImpl.call(this);
	}

	listeners() {
		return listenersImpl.call(this);
	}

	removeListeners() {
		return removeListenersImpl.call(this);
	}

	resizeCheck() {
		return resizeCheckImpl.call(this);
	}

	resizeListeners() {
		return resizeListenersImpl.call(this);
	}

	visibilityListeners() {
		return visibilityListenersImpl.call(this);
	}

	transitionListeners() {
		return transitionListenersImpl.call(this);
	}

	mediaQueryListeners() {
		return mediaQueryListenersImpl.call(this);
	}

	resizeObservers() {
		return resizeObserversImpl.call(this);
	}

	mutationObservers() {
		return mutationObserversImpl.call(this);
	}

	imageLoadListeners() {
		return imageLoadListenersImpl.call(this);
	}

	fontLoadListeners() {
		return fontLoadListenersImpl.call(this);
	}

	root() {
		return rootImpl.call(this);
	}

	locationOf(target, ignoreClass?) {
		return locationOfImpl.call(this, target, ignoreClass);
	}

	addStylesheet(src) {
		return addStylesheetImpl.call(this, src);
	}

	_getStylesheetNode(key) {
		return _getStylesheetNodeImpl.call(this, key);
	}

	addStylesheetCss(serializedCss, key?) {
		return addStylesheetCssImpl.call(this, serializedCss, key);
	}

	addStylesheetRules(rules, key?) {
		return addStylesheetRulesImpl.call(this, rules, key);
	}

	addScript(src) {
		return addScriptImpl.call(this, src);
	}

	addClass(className) {
		return addClassImpl.call(this, className);
	}

	removeClass(className) {
		return removeClassImpl.call(this, className);
	}

	addEventListeners() {
		return addEventListenersImpl.call(this);
	}

	removeEventListeners() {
		return removeEventListenersImpl.call(this);
	}

	triggerEvent(e) {
		return triggerEventImpl.call(this, e);
	}

	addSelectionListeners() {
		return addSelectionListenersImpl.call(this);
	}

	removeSelectionListeners() {
		return removeSelectionListenersImpl.call(this);
	}

	onSelectionChange(e) {
		return onSelectionChangeImpl.call(this, e);
	}

	triggerSelectedEvent(selection) {
		return triggerSelectedEventImpl.call(this, selection);
	}

	range(_cfi, ignoreClass?) {
		return rangeImpl.call(this, _cfi, ignoreClass);
	}

	cfiFromRange(range, ignoreClass?) {
		return cfiFromRangeImpl.call(this, range, ignoreClass);
	}

	cfiFromNode(node, ignoreClass?) {
		return cfiFromNodeImpl.call(this, node, ignoreClass);
	}

	map(layout, view) {
		return mapImpl.call(this, layout, view);
	}

	size(width, height) {
		return sizeImpl.call(this, width, height);
	}

	columns(width, height, columnWidth, gap, dir?) {
		return columnsImpl.call(this, width, height, columnWidth, gap, dir);
	}

	scaler(scale, offsetX?, offsetY?) {
		return scalerImpl.call(this, scale, offsetX, offsetY);
	}

	fit(width, height, section, viewportOverride, zoom) {
		return fitImpl.call(this, width, height, section, viewportOverride, zoom);
	}

	direction(dir?) {
		return directionImpl.call(this, dir);
	}

	mapPage(cfiBase, layout, start, end, dev) {
		return mapPageImpl.call(this, cfiBase, layout, start, end, dev);
	}

	linksHandler() {
		return linksHandlerImpl.call(this);
	}

	writingMode(mode?) {
		return writingModeImpl.call(this, mode);
	}

	layoutStyle(style?) {
		return layoutStyleImpl.call(this, style);
	}

	epubReadingSystem(name, version) {
		return epubReadingSystemImpl.call(this, name, version);
	}

	destroy() {
		return destroyImpl.call(this);
	}
}

EventEmitter(Contents.prototype);

export default Contents;

