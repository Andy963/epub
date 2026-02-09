import EventEmitter from "event-emitter";
import { extend, uuid } from "../../utils/core";
import EpubCFI from "../../epubcfi";

export { filterContainedRects } from "./iframe/marks";

import { container as containerImpl } from "./iframe/container";
import {
	create as createImpl,
	expand as expandImpl,
	load as loadImpl,
	lock as lockImpl,
	onLoad as onLoadImpl,
	reframe as reframeImpl,
	render as renderImpl,
	reset as resetImpl,
	size as sizeImpl,
} from "./iframe/render";
import { setAxis as setAxisImpl, setLayout as setLayoutImpl, setWritingMode as setWritingModeImpl } from "./iframe/layout";
import {
	disableSelectionScrollLock as disableSelectionScrollLockImpl,
	enableSelectionScrollLock as enableSelectionScrollLockImpl,
	getScrollContainer as getScrollContainerImpl,
	selectionScrollLockEligible as selectionScrollLockEligibleImpl,
} from "./iframe/selection-scroll-lock";
import {
	addListeners as addListenersImpl,
	display as displayImpl,
	height as heightImpl,
	hide as hideImpl,
	locationOf as locationOfImpl,
	offset as offsetImpl,
	onDisplayed as onDisplayedImpl,
	onResize as onResizeImpl,
	position as positionImpl,
	removeListeners as removeListenersImpl,
	show as showImpl,
	viewBounds as viewBoundsImpl,
	width as widthImpl,
} from "./iframe/display";
import {
	highlight as highlightImpl,
	mark as markImpl,
	placeMark as placeMarkImpl,
	underline as underlineImpl,
	unhighlight as unhighlightImpl,
	unmark as unmarkImpl,
	ununderline as ununderlineImpl,
} from "./iframe/marks";
import { destroy as destroyImpl } from "./iframe/lifecycle";

class IframeView {
	[key: string]: any;

	constructor(section, options) {
		this.settings = extend({
			ignoreClass : "",
			axis: undefined, //options.layout && options.layout.props.flow === "scrolled" ? "vertical" : "horizontal",
			direction: undefined,
			width: 0,
			height: 0,
			layout: undefined,
			globalLayoutProperties: {},
			method: undefined,
			forceRight: false,
			allowScriptedContent: false,
			allowPopups: false
		}, options || {});

		this.id = "epubjs-view-" + uuid();
		this.section = section;
		this.index = section.index;

		this.element = this.container(this.settings.axis);

		this.added = false;
		this.displayed = false;
		this.rendered = false;

		// this.width  = this.settings.width;
		// this.height = this.settings.height;

		this.fixedWidth  = 0;
		this.fixedHeight = 0;

		// Blank Cfi for Parsing
		this.epubcfi = new EpubCFI();

		this.layout = this.settings.layout;
		// Dom events to listen for
		// this.listenedEvents = ["keydown", "keyup", "keypressed", "mouseup", "mousedown", "click", "touchend", "touchstart"];

		this.pane = undefined;
		this.highlights = {};
		this.underlines = {};
		this.marks = {};
		this._selectionScrollLock = undefined;
		this._selectionScrollLockHandlers = undefined;
	}

	container(axis) {
		return containerImpl.call(this, axis);
	}

	create() {
		return createImpl.call(this);
	}

	render(request, show?) {
		return renderImpl.call(this, request, show);
	}

	reset () {
		return resetImpl.call(this);
	}

	size(_width?, _height?) {
		return sizeImpl.call(this, _width, _height);
	}

	lock(what, width, height) {
		return lockImpl.call(this, what, width, height);
	}

	expand(force?) {
		return expandImpl.call(this, force);
	}

	reframe(width, height) {
		return reframeImpl.call(this, width, height);
	}

	load(contents) {
		return loadImpl.call(this, contents);
	}

	onLoad(event, promise) {
		return onLoadImpl.call(this, event, promise);
	}

	setLayout(layout) {
		return setLayoutImpl.call(this, layout);
	}

	setAxis(axis) {
		return setAxisImpl.call(this, axis);
	}

	setWritingMode(mode) {
		return setWritingModeImpl.call(this, mode);
	}

	selectionScrollLockEligible() {
		return selectionScrollLockEligibleImpl.call(this);
	}

	getScrollContainer() {
		return getScrollContainerImpl.call(this);
	}

	enableSelectionScrollLock() {
		return enableSelectionScrollLockImpl.call(this);
	}

	disableSelectionScrollLock() {
		return disableSelectionScrollLockImpl.call(this);
	}

	addListeners() {
		return addListenersImpl.call(this);
	}

	removeListeners(layoutFunc?) {
		return removeListenersImpl.call(this, layoutFunc);
	}

	display(request) {
		return displayImpl.call(this, request);
	}

	show() {
		return showImpl.call(this);
	}

	hide() {
		return hideImpl.call(this);
	}

	offset() {
		return offsetImpl.call(this);
	}

	width() {
		return widthImpl.call(this);
	}

	height() {
		return heightImpl.call(this);
	}

	position() {
		return positionImpl.call(this);
	}

	locationOf(target) {
		return locationOfImpl.call(this, target);
	}

	onDisplayed(view) {
		return onDisplayedImpl.call(this, view);
	}

	onResize(view, e) {
		return onResizeImpl.call(this, view, e);
	}

	bounds(force) {
		return viewBoundsImpl.call(this, force);
	}

	highlight(cfiRange, data={}, cb, className = "epubjs-hl", styles = {}) {
		return highlightImpl.call(this, cfiRange, data, cb, className, styles);
	}

	underline(cfiRange, data={}, cb, className = "epubjs-ul", styles = {}) {
		return underlineImpl.call(this, cfiRange, data, cb, className, styles);
	}

	mark(cfiRange, data={}, cb) {
		return markImpl.call(this, cfiRange, data, cb);
	}

	placeMark(element, range) {
		return placeMarkImpl.call(this, element, range);
	}

	unhighlight(cfiRange) {
		return unhighlightImpl.call(this, cfiRange);
	}

	ununderline(cfiRange) {
		return ununderlineImpl.call(this, cfiRange);
	}

	unmark(cfiRange) {
		return unmarkImpl.call(this, cfiRange);
	}

	destroy() {
		return destroyImpl.call(this);
	}
}

EventEmitter(IframeView.prototype);

export default IframeView;

