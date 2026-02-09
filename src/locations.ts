import Queue from "./utils/queue";
import EpubCFI from "./epubcfi";
import EventEmitter from "event-emitter";

import { cfiFromLocation as cfiFromLocationImpl, cfiFromPercentage as cfiFromPercentageImpl, destroy as destroyImpl, getCurrent as getCurrentImpl, length as lengthImpl, load as loadImpl, locationFromCfi as locationFromCfiImpl, percentageFromCfi as percentageFromCfiImpl, percentageFromLocation as percentageFromLocationImpl, save as saveImpl, setCurrent as setCurrentImpl } from "./locations/accessors";
import { generate as generateImpl, generateWithWorker as generateWithWorkerImpl } from "./locations/generate";
import { countWords as countWordsImpl, generateFromWords as generateFromWordsImpl, parseWords as parseWordsImpl, processWords as processWordsImpl } from "./locations/words";
import { createRange as createRangeImpl, parse as parseImpl, process as processImpl, processInWorker as processInWorkerImpl, serializeSectionContents as serializeSectionContentsImpl } from "./locations/process";
import { attachWorker as attachWorkerImpl, createLocationsWorker as createLocationsWorkerImpl, handleWorkerError as handleWorkerErrorImpl, handleWorkerMessage as handleWorkerMessageImpl, locationsWorkerSource as locationsWorkerSourceImpl, sendWorkerRequest as sendWorkerRequestImpl } from "./locations/worker";

/**
 * Find Locations for a Book
 * @param {Spine} spine
 * @param {request} request
 * @param {number} [pause=100]
 */
class Locations {
	spine: any;
	request: any;
	pause: number;

	q: any;
	epubcfi: EpubCFI;

	_locations: string[];
	_locationsWords: number[];
	total: number;

	"break": number | undefined;

	_current: number;
	_wordCounter: number;

	_currentCfi: string;
	processingTimeout: any;

	worker: Worker | undefined;
	workerRequests: Map<number, any>;
	workerRequestId: number;

	book: any;

	on: (event: string, listener: (...args: any[]) => void) => this;
	once: (event: string, listener: (...args: any[]) => void) => this;
	off: (event: string, listener?: (...args: any[]) => void) => this;
	emit: (event: string, ...args: any[]) => boolean;

	constructor(spine: any, request: any, pause?: number) {
		this.spine = spine;
		this.request = request;
		this.pause = pause || 100;

		this.q = new Queue(this);
		this.epubcfi = new EpubCFI();

		this._locations = [];
		this._locationsWords = [];
		this.total = 0;

		this.break = 150;

		this._current = 0;

		this._wordCounter = 0;

		this.currentLocation = 0;
		this._currentCfi ='';
		this.processingTimeout = undefined;

		this.worker = undefined;
		this.workerRequests = new Map();
		this.workerRequestId = 0;
	}

	generate(chars, options?) {
		return generateImpl.call(this, chars, options);
	}

	generateWithWorker(chars, options) {
		return generateWithWorkerImpl.call(this, chars, options);
	}

	createLocationsWorker() {
		return createLocationsWorkerImpl.call(this);
	}

	attachWorker(worker) {
		return attachWorkerImpl.call(this, worker);
	}

	handleWorkerMessage(event) {
		return handleWorkerMessageImpl.call(this, event);
	}

	handleWorkerError(event) {
		return handleWorkerErrorImpl.call(this, event);
	}

	sendWorkerRequest(worker, payload) {
		return sendWorkerRequestImpl.call(this, worker, payload);
	}

	serializeSectionContents(contents) {
		return serializeSectionContentsImpl.call(this, contents);
	}

	processInWorker(section, worker) {
		return processInWorkerImpl.call(this, section, worker);
	}

	locationsWorkerSource() {
		return locationsWorkerSourceImpl.call(this);
	}

	createRange () {
		return createRangeImpl.call(this);
	}

	process(section) {
		return processImpl.call(this, section);
	}

	parse(contents, cfiBase, chars) {
		return parseImpl.call(this, contents, cfiBase, chars);
	}

	generateFromWords(startCfi, wordCount, count) {
		return generateFromWordsImpl.call(this, startCfi, wordCount, count);
	}

	processWords(section, wordCount, startCfi, count) {
		return processWordsImpl.call(this, section, wordCount, startCfi, count);
	}

	countWords(s) {
		return countWordsImpl.call(this, s);
	}

	parseWords(contents, section, wordCount, startCfi) {
		return parseWordsImpl.call(this, contents, section, wordCount, startCfi);
	}

	locationFromCfi(cfi){
		return locationFromCfiImpl.call(this, cfi);
	}

	percentageFromCfi(cfi) {
		return percentageFromCfiImpl.call(this, cfi);
	}

	percentageFromLocation(loc) {
		return percentageFromLocationImpl.call(this, loc);
	}

	cfiFromLocation(loc){
		return cfiFromLocationImpl.call(this, loc);
	}

	cfiFromPercentage(percentage){
		return cfiFromPercentageImpl.call(this, percentage);
	}

	load(locations){
		return loadImpl.call(this, locations);
	}

	save(){
		return saveImpl.call(this);
	}

	getCurrent(){
		return getCurrentImpl.call(this);
	}

	setCurrent(curr){
		return setCurrentImpl.call(this, curr);
	}

	/**
	 * Get the current location
	 */
	get currentLocation() {
		return this._current;
	}

	/**
	 * Set the current location
	 */
	set currentLocation(curr) {
		this.setCurrent(curr);
	}

	length () {
		return lengthImpl.call(this);
	}

	destroy () {
		return destroyImpl.call(this);
	}
}

EventEmitter(Locations.prototype);

export default Locations;

