import { extend } from "../../utils/core";
import DefaultViewManager from "../default";
import Snap from "../helpers/snap";
import {
	check as checkImpl,
	display as displayImpl,
	fill as fillImpl,
	moveTo as moveToImpl,
	update as updateImpl,
} from "./render";
import {
	add as addImpl,
	afterResized as afterResizedImpl,
	append as appendImpl,
	counter as counterImpl,
	erase as eraseImpl,
	prepend as prependImpl,
	removeShownListeners as removeShownListenersImpl,
	trim as trimImpl,
} from "./views";
import {
	addEventListeners as addEventListenersImpl,
	addScrollListeners as addScrollListenersImpl,
	next as nextImpl,
	onScroll as onScrollImpl,
	prev as prevImpl,
	removeEventListeners as removeEventListenersImpl,
	scrolled as scrolledImpl,
} from "./scroll";

class ContinuousViewManager extends DefaultViewManager {
	constructor(options) {
		super(options);

		this.name = "continuous";

		this.settings = extend(this.settings || {}, {
			infinite: true,
			overflow: undefined,
			axis: undefined,
			writingMode: undefined,
			flow: "scrolled",
			offset: 500,
			offsetDelta: 250,
			width: undefined,
			height: undefined,
			snap: false,
			afterScrolledTimeout: 10,
			allowScriptedContent: false,
			allowPopups: false
		});

		extend(this.settings, options.settings || {});

		// Gap can be 0, but defaults doesn't handle that
		if (options.settings.gap != "undefined" && options.settings.gap === 0) {
			this.settings.gap = options.settings.gap;
		}

		this.viewSettings = {
			ignoreClass: this.settings.ignoreClass,
			axis: this.settings.axis,
			flow: this.settings.flow,
			layout: this.layout,
			width: 0,
			height: 0,
			forceEvenPages: false,
			allowScriptedContent: this.settings.allowScriptedContent,
			allowPopups: this.settings.allowPopups
		};

		this.scrollTop = 0;
		this.scrollLeft = 0;
	}

	display(section, target){
		return displayImpl.call(this, section, target);
	}

	fill(_full){
		return fillImpl.call(this, _full);
	}

	moveTo(offset){
		return moveToImpl.call(this, offset);
	}

	afterResized(view){
		return afterResizedImpl.call(this, view);
	}

	// Remove Previous Listeners if present
	removeShownListeners(view){
		return removeShownListenersImpl.call(this, view);
	}

	add(section){
		return addImpl.call(this, section);
	}

	append(section){
		return appendImpl.call(this, section);
	}

	prepend(section){
		return prependImpl.call(this, section);
	}

	counter(bounds){
		return counterImpl.call(this, bounds);
	}

	update(_offset){
		return updateImpl.call(this, _offset);
	}

	check(_offsetLeft?, _offsetTop?){
		return checkImpl.call(this, _offsetLeft, _offsetTop);
	}

	trim(){
		return trimImpl.call(this);
	}

	erase(view, above?){ //Trim
		return eraseImpl.call(this, view, above);
	}

	addEventListeners(stage?){
		return addEventListenersImpl.call(this, stage);
	}

	addScrollListeners() {
		return addScrollListenersImpl.call(this);
	}

	removeEventListeners(){
		return removeEventListenersImpl.call(this);
	}

	onScroll(){
		return onScrollImpl.call(this);
	}

	scrolled() {
		return scrolledImpl.call(this);
	}

	next(){
		return nextImpl.call(this);
	}

	prev(){
		return prevImpl.call(this);
	}

	updateFlow(flow){
		if (this.rendered && this.snapper) {
			this.snapper.destroy();
			this.snapper = undefined;
		}

		super.updateFlow(flow, "scroll");

		if (this.rendered && this.isPaginated && this.settings.snap) {
			this.snapper = new Snap(this, this.settings.snap && (typeof this.settings.snap === "object") && this.settings.snap);
		}
	}

	destroy(){
		super.destroy();

		if (this.snapper) {
			this.snapper.destroy();
		}
	}

}

export default ContinuousViewManager;
