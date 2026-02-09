import EventEmitter from "event-emitter";
import { extend } from "../../utils/core";
import Queue from "../../utils/queue";

import {
	addEventListeners as addEventListenersImpl,
	removeEventListeners as removeEventListenersImpl,
	render as renderImpl,
} from "./manager/render";
import {
	clear as clearImpl,
	destroy as destroyImpl,
	direction as directionImpl,
	getContents as getContentsImpl,
	isRendered as isRenderedImpl,
} from "./manager/lifecycle";
import { onOrientationChange as onOrientationChangeImpl, onResized as onResizedImpl, resize as resizeImpl } from "./manager/resize";
import {
	add as addImpl,
	afterDisplayed as afterDisplayedImpl,
	afterResized as afterResizedImpl,
	append as appendImpl,
	counter as counterImpl,
	createView as createViewImpl,
	display as displayImpl,
	handleNextPrePaginated as handleNextPrePaginatedImpl,
	moveTo as moveToImpl,
	prepend as prependImpl,
} from "./manager/display";
import { current as currentImpl, next as nextImpl, prev as prevImpl } from "./manager/navigation";
import {
	currentLocation as currentLocationImpl,
	paginatedLocation as paginatedLocationImpl,
	scrolledLocation as scrolledLocationImpl,
} from "./manager/location";
import {
	isVisible as isVisibleImpl,
	onScroll as onScrollImpl,
	scrollBy as scrollByImpl,
	scrollTo as scrollToImpl,
	visible as visibleImpl,
} from "./manager/scroll";
import {
	applyLayout as applyLayoutImpl,
	bounds as boundsImpl,
	setLayout as setLayoutImpl,
	updateAxis as updateAxisImpl,
	updateFlow as updateFlowImpl,
	updateLayout as updateLayoutImpl,
	updateWritingMode as updateWritingModeImpl,
} from "./manager/layout";

class DefaultViewManager {
	[key: string]: any;

	constructor(options) {

		this.name = "default";
		this.optsSettings = options.settings;
		this.View = options.view;
		this.request = options.request;
		this.renditionQueue = options.queue;
		this.q = new Queue(this);

		this.settings = extend(this.settings || {}, {
			infinite: true,
			hidden: false,
			width: undefined,
			height: undefined,
			axis: undefined,
			writingMode: undefined,
			flow: "scrolled",
			ignoreClass: "",
			fullsize: undefined,
			snap: false,
			afterScrolledTimeout: 20,
			allowScriptedContent: false,
			allowPopups: false
		});

		extend(this.settings, options.settings || {});

		this.viewSettings = {
			ignoreClass: this.settings.ignoreClass,
			axis: this.settings.axis,
			flow: this.settings.flow,
			layout: this.layout,
			method: this.settings.method, // srcdoc, blobUrl, write
			width: 0,
			height: 0,
			forceEvenPages: true,
			allowScriptedContent: this.settings.allowScriptedContent,
			allowPopups: this.settings.allowPopups
		};

		this.rendered = false;

	}

	render(element, size){
		return renderImpl.call(this, element, size);
	}

	addEventListeners(){
		return addEventListenersImpl.call(this);
	}

	removeEventListeners(){
		return removeEventListenersImpl.call(this);
	}

	destroy(){
		return destroyImpl.call(this);
	}

	onOrientationChange(e) {
		return onOrientationChangeImpl.call(this, e);
	}

	onResized(e) {
		return onResizedImpl.call(this, e);
	}

	resize(width?, height?, epubcfi?){
		return resizeImpl.call(this, width, height, epubcfi);
	}

	createView(section, forceRight?) {
		return createViewImpl.call(this, section, forceRight);
	}

	handleNextPrePaginated(forceRight, section, action) {
		return handleNextPrePaginatedImpl.call(this, forceRight, section, action);
	}

	display(section, target?){
		return displayImpl.call(this, section, target);
	}

	afterDisplayed(view){
		return afterDisplayedImpl.call(this, view);
	}

	afterResized(view){
		return afterResizedImpl.call(this, view);
	}

	moveTo(offset, width){
		return moveToImpl.call(this, offset, width);
	}

	add(section, forceRight){
		return addImpl.call(this, section, forceRight);
	}

	append(section, forceRight){
		return appendImpl.call(this, section, forceRight);
	}

	prepend(section, forceRight){
		return prependImpl.call(this, section, forceRight);
	}

	counter(bounds){
		return counterImpl.call(this, bounds);

	}

	// resizeView(view) {
	//
	// 	if(this.settings.globalLayoutProperties.layout === "pre-paginated") {
	// 		view.lock("both", this.bounds.width, this.bounds.height);
	// 	} else {
	// 		view.lock("width", this.bounds.width, this.bounds.height);
	// 	}
	//
	// };

	next(){
		return nextImpl.call(this);
	}

	prev(){
		return prevImpl.call(this);
	}

	current(){
		return currentImpl.call(this);
	}

	clear () {
		return clearImpl.call(this);
	}

	currentLocation(){
		return currentLocationImpl.call(this);
	}

	scrolledLocation() {
		return scrolledLocationImpl.call(this);
	}

	paginatedLocation(){
		return paginatedLocationImpl.call(this);
	}

	isVisible(view, offsetPrev, offsetNext, _container){
		return isVisibleImpl.call(this, view, offsetPrev, offsetNext, _container);
	}

	visible(){
		return visibleImpl.call(this);
	}

	scrollBy(x, y, silent){
		return scrollByImpl.call(this, x, y, silent);
	}

	scrollTo(x, y, silent){
		return scrollToImpl.call(this, x, y, silent);
	}

	onScroll(){
		return onScrollImpl.call(this);
	}

	bounds() {
		return boundsImpl.call(this);
	}

	applyLayout(layout) {
		return applyLayoutImpl.call(this, layout);
	}

	updateLayout() {
		return updateLayoutImpl.call(this);
	}

	setLayout(layout){
		return setLayoutImpl.call(this, layout);
	}

	updateWritingMode(mode) {
		return updateWritingModeImpl.call(this, mode);
	}

	updateAxis(axis, forceUpdate?){
		return updateAxisImpl.call(this, axis, forceUpdate);
	}

	updateFlow(flow, defaultScrolledOverflow="auto"){
		return updateFlowImpl.call(this, flow, defaultScrolledOverflow);
	}

	getContents(){
		return getContentsImpl.call(this);
	}

	direction(dir="ltr") {
		return directionImpl.call(this, dir);
	}

	isRendered() {
		return isRenderedImpl.call(this);
	}
}

//-- Enable binding events to Manager
EventEmitter(DefaultViewManager.prototype);

export default DefaultViewManager;
