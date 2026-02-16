import {qs, sprint, locationOf, defer} from "./utils/core";
import Queue from "./utils/queue";
import EpubCFI from "./epubcfi";
import { EVENTS } from "./utils/constants";
import EventEmitter from "event-emitter";

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

	/**
	 * Load all of sections in the book to generate locations
	 * @param  {int} chars how many chars to split on
	 * @param  {object} [options]
	 * @return {Promise<Array<string>>} locations
	 */
	generate(chars, options?) {
		if (options && options.useWorker) {
			return this.generateWithWorker(chars, options);
		}

		if (chars) {
			this.break = chars;
		}

		this.q.pause();

		this.spine.each(function(section) {
			if (section.linear) {
				this.q.enqueue(this.process.bind(this), section);
			}
		}.bind(this));

		return this.q.run().then(function() {
			this.total = this._locations.length - 1;

			if (this._currentCfi) {
				this.currentLocation = this._currentCfi;
			}

			return this._locations;
			// console.log(this.percentage(this.book.rendition.location.start), this.percentage(this.book.rendition.location.end));
		}.bind(this));

	}

	generateWithWorker(chars, options) {
		if (chars) {
			this.break = chars;
		}

		let worker = options && options.worker;
		let shouldTerminate = false;

		if (!worker) {
			worker = this.createLocationsWorker();
			shouldTerminate = true;
		} else {
			this.attachWorker(worker);
		}

		if (!worker) {
			return this.generate(chars);
		}

		this.worker = worker;

		this.q.pause();

		this.spine.each(function(section) {
			if (section.linear) {
				this.q.enqueue(this.processInWorker.bind(this), section, worker);
			}
		}.bind(this));

		return this.q.run().then(function() {
			this.total = this._locations.length - 1;

			if (this._currentCfi) {
				this.currentLocation = this._currentCfi;
			}

			if (shouldTerminate) {
				worker.terminate();
				if (this.worker === worker) {
					this.worker = undefined;
				}
			}

			return this._locations;
		}.bind(this)).catch((error) => {
			if (shouldTerminate && worker) {
				worker.terminate();
				if (this.worker === worker) {
					this.worker = undefined;
				}
			}

			throw error;
		});
	}

	createLocationsWorker() {
		if (typeof Worker === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") {
			return;
		}

		const source = this.locationsWorkerSource();
		const blob = new Blob([source], { type: "text/javascript" });
		const url = URL.createObjectURL(blob);
		const worker = new Worker(url);
		URL.revokeObjectURL(url);
		this.attachWorker(worker);
		return worker;
	}

	attachWorker(worker) {
		if (!worker) {
			return;
		}

		if ((worker as any).__epubjsLocationsAttached) {
			return;
		}

		worker.onmessage = (event) => this.handleWorkerMessage(event);
		worker.onmessageerror = (event) => this.handleWorkerError(event);
		worker.onerror = (event) => this.handleWorkerError(event);
		(worker as any).__epubjsLocationsAttached = true;
	}

	handleWorkerMessage(event) {
		const message = event && event.data;
		if (!message || typeof message.id !== "number") {
			return;
		}

		const pending = this.workerRequests.get(message.id);
		if (!pending) {
			return;
		}
		this.workerRequests.delete(message.id);

		if (message.error) {
			pending.reject(new Error(message.error));
			return;
		}

		pending.resolve(message.locations || []);
	}

	handleWorkerError(event) {
		const message = (event && (event.message || (event.error && event.error.message))) || "Locations worker error";

		this.workerRequests.forEach((pending) => {
			pending.reject(new Error(message));
		});
		this.workerRequests.clear();
	}

	sendWorkerRequest(worker, payload) {
		const pending = new defer();
		this.workerRequestId += 1;
		const id = this.workerRequestId;
		this.workerRequests.set(id, pending);

		try {
			worker.postMessage(Object.assign({ id }, payload));
		} catch (error) {
			this.workerRequests.delete(id);
			pending.reject(error);
		}

		return pending.promise;
	}

	serializeSectionContents(contents) {
		const doc = contents && contents.ownerDocument;
		if (doc && typeof XMLSerializer !== "undefined") {
			try {
				return new XMLSerializer().serializeToString(doc);
			} catch (error) {
				return;
			}
		}

		if (doc && doc.documentElement && doc.documentElement.outerHTML) {
			return doc.documentElement.outerHTML;
		}

		if (contents && contents.outerHTML) {
			return contents.outerHTML;
		}
	}

	processInWorker(section, worker) {
		return section.load(this.request)
			.then(function(contents) {
				var completed = new defer();
				var markup = this.serializeSectionContents(contents);

				if (!markup) {
					let locations = this.parse(contents, section.cfiBase);
					this._locations = this._locations.concat(locations);
					section.unload();
					this.processingTimeout = setTimeout(() => completed.resolve(locations), this.pause);
					return completed.promise;
				}

				return this.sendWorkerRequest(worker, {
					type: "parse",
					xhtml: markup,
					cfiBase: section.cfiBase,
					chars: this.break
				}).then((locations) => {
					this._locations = this._locations.concat(locations);

					section.unload();

					this.processingTimeout = setTimeout(() => completed.resolve(locations), this.pause);
					return completed.promise;
				});
			}.bind(this));
	}

	locationsWorkerSource() {
		return `
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const DOCUMENT_NODE = 9;

function getNodeId(node) {
\tif (!node) {\n\t\treturn null;\n\t}\n\tif (node.id) {\n\t\treturn node.id;\n\t}\n\tif (typeof node.getAttribute === \"function\") {\n\t\treturn node.getAttribute(\"id\") || null;\n\t}\n\treturn null;\n}

function textNodes(container) {
\tif (!container || !container.childNodes) {\n\t\treturn [];\n\t}\n\treturn Array.prototype.slice.call(container.childNodes).filter((node) => node && node.nodeType === TEXT_NODE);\n}

function elementChildren(container) {
\tif (!container) {\n\t\treturn [];\n\t}\n\tif (container.children) {\n\t\treturn Array.prototype.slice.call(container.children);\n\t}\n\tif (!container.childNodes) {\n\t\treturn [];\n\t}\n\treturn Array.prototype.slice.call(container.childNodes).filter((node) => node && node.nodeType === ELEMENT_NODE);\n}

function position(anchor) {
\tif (!anchor || !anchor.parentNode) {\n\t\treturn 0;\n\t}\n\tif (anchor.nodeType === ELEMENT_NODE) {\n\t\tconst children = elementChildren(anchor.parentNode);\n\t\treturn children.indexOf(anchor);\n\t}\n\tconst children = textNodes(anchor.parentNode);\n\treturn children.indexOf(anchor);\n}

function step(node) {
\tconst nodeType = node && node.nodeType === TEXT_NODE ? \"text\" : \"element\";\n\treturn {\n\t\tid: nodeType === \"element\" ? getNodeId(node) : null,\n\t\ttype: nodeType,\n\t\tindex: position(node)\n\t};\n}

function pathTo(node, offset) {
\tconst segment = {\n\t\tsteps: [],\n\t\tterminal: { offset: null }\n\t};\n\tlet currentNode = node;\n\twhile (currentNode && currentNode.parentNode && currentNode.parentNode.nodeType !== DOCUMENT_NODE) {\n\t\tsegment.steps.unshift(step(currentNode));\n\t\tcurrentNode = currentNode.parentNode;\n\t}\n\tif (offset != null && offset >= 0) {\n\t\tsegment.terminal.offset = offset;\n\t\tconst lastStep = segment.steps[segment.steps.length - 1];\n\t\tif (!lastStep || lastStep.type !== \"text\") {\n\t\t\tsegment.steps.push({ type: \"text\", index: 0, id: null });\n\t\t}\n\t}\n\treturn segment;\n}

function equalStep(stepA, stepB) {
\tif (!stepA || !stepB) {\n\t\treturn false;\n\t}\n\treturn stepA.index === stepB.index && stepA.type === stepB.type && stepA.id === stepB.id;\n}

function joinSteps(steps) {
\tif (!steps || steps.length === 0) {\n\t\treturn \"\";\n\t}\n\treturn steps.map((part) => {\n\t\tlet segment = \"\";\n\t\tif (part.type === \"element\") {\n\t\t\tsegment += (part.index + 1) * 2;\n\t\t}\n\t\tif (part.type === \"text\") {\n\t\t\tsegment += 1 + (2 * part.index);\n\t\t}\n\t\tif (part.id) {\n\t\t\tsegment += \"[\" + part.id + \"]\";\n\t\t}\n\t\treturn segment;\n\t}).join(\"/\");\n}

function segmentString(segment) {
\tlet segmentString = \"/\";\n\tsegmentString += joinSteps(segment.steps);\n\tif (segment.terminal && segment.terminal.offset != null) {\n\t\tsegmentString += \":\" + segment.terminal.offset;\n\t}\n\treturn segmentString;\n}

function cfiFromRange(range, base) {
\tconst startSegment = pathTo(range.startContainer, range.startOffset);\n\tconst endSegment = pathTo(range.endContainer, range.endOffset);\n\n\tlet commonLen = 0;\n\tconst maxLen = Math.min(startSegment.steps.length, endSegment.steps.length);\n\twhile (commonLen < maxLen && equalStep(startSegment.steps[commonLen], endSegment.steps[commonLen])) {\n\t\tcommonLen += 1;\n\t}\n\n\tif (commonLen === startSegment.steps.length &&\n\t\t\tcommonLen === endSegment.steps.length &&\n\t\t\tstartSegment.terminal.offset !== endSegment.terminal.offset &&\n\t\t\tcommonLen > 0) {\n\t\tcommonLen -= 1;\n\t}\n\n\tconst pathSteps = startSegment.steps.slice(0, commonLen);\n\tconst startSteps = startSegment.steps.slice(commonLen);\n\tconst endSteps = endSegment.steps.slice(commonLen);\n\n\tconst pathString = segmentString({ steps: pathSteps, terminal: { offset: null } });\n\tconst startString = segmentString({ steps: startSteps, terminal: { offset: startSegment.terminal.offset } });\n\tconst endString = segmentString({ steps: endSteps, terminal: { offset: endSegment.terminal.offset } });\n\n\treturn \"epubcfi(\" + base + \"!\" + pathString + \",\" + startString + \",\" + endString + \")\";\n}

function walkTextNodes(root, callback) {
\tif (!root) {\n\t\treturn;\n\t}\n\tconst stack = [root];\n\twhile (stack.length) {\n\t\tconst node = stack.pop();\n\t\tif (!node || !node.childNodes) {\n\t\t\tcontinue;\n\t\t}\n\t\tfor (let i = node.childNodes.length - 1; i >= 0; i -= 1) {\n\t\t\tconst child = node.childNodes[i];\n\t\t\tif (!child) {\n\t\t\t\tcontinue;\n\t\t\t}\n\t\t\tif (child.nodeType === TEXT_NODE) {\n\t\t\t\tcallback(child);\n\t\t\t} else if (child.nodeType === ELEMENT_NODE) {\n\t\t\t\tstack.push(child);\n\t\t\t}\n\t\t}\n\t}\n}

function parseLocations(doc, cfiBase, chars) {
\tconst locations = [];\n\tlet range;\n\tconst body = (doc && (doc.querySelector && doc.querySelector(\"body\"))) ||\n\t\t(doc && doc.getElementsByTagName && doc.getElementsByTagName(\"body\")[0]) ||\n\t\t(doc && doc.documentElement);\n\tlet counter = 0;\n\tlet prev;\n\tconst breakLength = chars || 150;\n\n\tconst createRange = () => {\n\t\treturn {\n\t\t\tstartContainer: undefined,\n\t\t\tstartOffset: undefined,\n\t\t\tendContainer: undefined,\n\t\t\tendOffset: undefined\n\t\t};\n\t};\n\n\tconst parser = (node) => {\n\t\tconst text = node && node.textContent ? node.textContent : \"\";\n\t\tconst len = text.length;\n\t\tlet dist;\n\t\tlet pos = 0;\n\n\t\tif (text.trim().length === 0) {\n\t\t\treturn;\n\t\t}\n\n\t\tif (counter === 0) {\n\t\t\trange = createRange();\n\t\t\trange.startContainer = node;\n\t\t\trange.startOffset = 0;\n\t\t}\n\n\t\tdist = breakLength - counter;\n\n\t\tif (dist > len) {\n\t\t\tcounter += len;\n\t\t\tpos = len;\n\t\t}\n\n\t\twhile (pos < len) {\n\t\t\tdist = breakLength - counter;\n\n\t\t\tif (counter === 0) {\n\t\t\t\tpos += 1;\n\t\t\t\trange = createRange();\n\t\t\t\trange.startContainer = node;\n\t\t\t\trange.startOffset = pos;\n\t\t\t}\n\n\t\t\tif (pos + dist >= len) {\n\t\t\t\tcounter += len - pos;\n\t\t\t\tpos = len;\n\t\t\t} else {\n\t\t\t\tpos += dist;\n\t\t\t\trange.endContainer = node;\n\t\t\t\trange.endOffset = pos;\n\t\t\t\tlocations.push(cfiFromRange(range, cfiBase));\n\t\t\t\tcounter = 0;\n\t\t\t}\n\t\t}\n\n\t\tprev = node;\n\t};\n\n\twalkTextNodes(body, parser);\n\n\tif (range && range.startContainer && prev) {\n\t\trange.endContainer = prev;\n\t\trange.endOffset = prev.textContent ? prev.textContent.length : 0;\n\t\tlocations.push(cfiFromRange(range, cfiBase));\n\t\tcounter = 0;\n\t}\n\n\treturn locations;\n}

self.onmessage = (event) => {
\tconst message = event && event.data;\n\tif (!message || message.type !== \"parse\") {\n\t\treturn;\n\t}\n\tconst id = message.id;\n\ttry {\n\t\tif (typeof DOMParser === \"undefined\") {\n\t\t\tthrow new Error(\"DOMParser is not available in this worker\");\n\t\t}\n\t\tconst parser = new DOMParser();\n\t\tconst doc = parser.parseFromString(message.xhtml, \"application/xhtml+xml\");\n\t\tconst locations = parseLocations(doc, message.cfiBase, message.chars);\n\t\tself.postMessage({ id, locations });\n\t} catch (error) {\n\t\tself.postMessage({ id, error: (error && error.message) || String(error) });\n\t}\n};\n`;
	}

	createRange () {
		return {
			startContainer: undefined,
			startOffset: undefined,
			endContainer: undefined,
			endOffset: undefined
		};
	}

	process(section) {

		return section.load(this.request)
			.then(function(contents) {
				var completed = new defer();
				var locations = this.parse(contents, section.cfiBase);
				this._locations = this._locations.concat(locations);

				section.unload();

				this.processingTimeout = setTimeout(() => completed.resolve(locations), this.pause);
				return completed.promise;
			}.bind(this));

	}

	parse(contents, cfiBase, chars) {
		var locations = [];
		var range;
		var doc = contents.ownerDocument;
		var body = qs(doc, "body");
		var counter = 0;
		var prev;
		var _break = chars || this.break;
		var parser = function(node) {
			var len = node.length;
			var dist;
			var pos = 0;

			if (node.textContent.trim().length === 0) {
				return false; // continue
			}

			// Start range
			if (counter == 0) {
				range = this.createRange();
				range.startContainer = node;
				range.startOffset = 0;
			}

			dist = _break - counter;

			// Node is smaller than a break,
			// skip over it
			if(dist > len){
				counter += len;
				pos = len;
			}


			while (pos < len) {
				dist = _break - counter;

				if (counter === 0) {
					// Start new range
					pos += 1;
					range = this.createRange();
					range.startContainer = node;
					range.startOffset = pos;
				}

				// pos += dist;

				// Gone over
				if(pos + dist >= len){
					// Continue counter for next node
					counter += len - pos;
					// break
					pos = len;
				// At End
				} else {
					// Advance pos
					pos += dist;

					// End the previous range
					range.endContainer = node;
					range.endOffset = pos;
					// cfi = section.cfiFromRange(range);
					let cfi = new EpubCFI(range, cfiBase).toString();
					locations.push(cfi);
					counter = 0;
				}
			}
			prev = node;
		};

		sprint(body, parser.bind(this));

		// Close remaining
		if (range && range.startContainer && prev) {
			range.endContainer = prev;
			range.endOffset = prev.length;
			let cfi = new EpubCFI(range, cfiBase).toString();
			locations.push(cfi);
			counter = 0;
		}

		return locations;
	}


	/**
	 * Load all of sections in the book to generate locations
	 * @param  {string} startCfi start position
	 * @param  {int} wordCount how many words to split on
	 * @param  {int} count result count
	 * @return {object} locations
	 */
	generateFromWords(startCfi, wordCount, count) {
		var start = startCfi ? new EpubCFI(startCfi) : undefined;
		this.q.pause();
		this._locationsWords = [];
		this._wordCounter = 0;

		this.spine.each(function(section) {
			if (section.linear) {
				if (start) {
					if (section.index >= start.spinePos) {
						this.q.enqueue(this.processWords.bind(this), section, wordCount, start, count);
					}
				} else {
					this.q.enqueue(this.processWords.bind(this), section, wordCount, start, count);
				}
			}
		}.bind(this));

		return this.q.run().then(function() {
			if (this._currentCfi) {
				this.currentLocation = this._currentCfi;
			}

			return this._locationsWords;
		}.bind(this));

	}

	processWords(section, wordCount, startCfi, count) {
		if (count && this._locationsWords.length >= count) {
			return Promise.resolve();
		}

		return section.load(this.request)
			.then(function(contents) {
				var completed = new defer();
				var locations = this.parseWords(contents, section, wordCount, startCfi);
				var remainingCount = count - this._locationsWords.length;
				this._locationsWords = this._locationsWords.concat(locations.length >= count ? locations.slice(0, remainingCount) : locations);

				section.unload();

				this.processingTimeout = setTimeout(() => completed.resolve(locations), this.pause);
				return completed.promise;
			}.bind(this));
	}

	//http://stackoverflow.com/questions/18679576/counting-words-in-string
	countWords(s) {
		s = s.replace(/(^\s*)|(\s*$)/gi, "");//exclude  start and end white-space
		s = s.replace(/[ ]{2,}/gi, " ");//2 or more space to 1
		s = s.replace(/\n /, "\n"); // exclude newline with a start spacing
		return s.split(" ").length;
	}

	parseWords(contents, section, wordCount, startCfi) {
		var cfiBase = section.cfiBase;
		var locations = [];
		var doc = contents.ownerDocument;
		var body = qs(doc, "body");
		var prev;
		var _break = wordCount;
		var foundStartNode = startCfi ? startCfi.spinePos !== section.index : true;
		var startNode;
		if (startCfi && section.index === startCfi.spinePos) {
			startNode = startCfi.findNode(startCfi.range ? startCfi.path.steps.concat(startCfi.start.steps) : startCfi.path.steps, contents.ownerDocument);
		}
		var parser = function(node) {
			if (!foundStartNode) {
				if (node === startNode) {
					foundStartNode = true;
				} else {
					return false;
				}
			}
			if (node.textContent.length < 10) {
				if (node.textContent.trim().length === 0) {
					return false;
				}
			}
			var len  = this.countWords(node.textContent);
			var dist;
			var pos = 0;

			if (len === 0) {
				return false; // continue
			}

			dist = _break - this._wordCounter;

			// Node is smaller than a break,
			// skip over it
			if (dist > len) {
				this._wordCounter += len;
				pos = len;
			}


			while (pos < len) {
				dist = _break - this._wordCounter;

				// Gone over
				if (pos + dist >= len) {
					// Continue counter for next node
					this._wordCounter += len - pos;
					// break
					pos = len;
					// At End
				} else {
					// Advance pos
					pos += dist;

					let cfi = new EpubCFI(node, cfiBase);
					locations.push({ cfi: cfi.toString(), wordCount: this._wordCounter });
					this._wordCounter = 0;
				}
			}
			prev = node;
		};

		sprint(body, parser.bind(this));

		return locations;
	}

	/**
	 * Get a location from an EpubCFI
	 * @param {EpubCFI} cfi
	 * @return {number}
	 */
	locationFromCfi(cfi){
		let loc;
		if (EpubCFI.prototype.isCfiString(cfi)) {
			cfi = new EpubCFI(cfi);
		}
		// Check if the location has not been set yet
		if(this._locations.length === 0) {
			return -1;
		}

			const compare = this.epubcfi.compare.bind(this.epubcfi);
			loc = locationOf(cfi, this._locations, compare);

		if (loc > this.total) {
			return this.total;
		}

		return loc;
	}

	/**
	 * Get a percentage position in locations from an EpubCFI
	 * @param {EpubCFI} cfi
	 * @return {number}
	 */
	percentageFromCfi(cfi) {
		if(this._locations.length === 0) {
			return null;
		}
		// Find closest cfi
		var loc = this.locationFromCfi(cfi);
		// Get percentage in total
		return this.percentageFromLocation(loc);
	}

	/**
	 * Get a percentage position from a location index
	 * @param {number} location
	 * @return {number}
	 */
	percentageFromLocation(loc) {
		if (!loc || !this.total) {
			return 0;
		}

		return (loc / this.total);
	}

	/**
	 * Get an EpubCFI from location index
	 * @param {number} loc
	 * @return {EpubCFI} cfi
	 */
	cfiFromLocation(loc){
		var cfi: any = -1;
		// check that pg is an int
		if(typeof loc != "number"){
			loc = parseInt(loc);
		}

		if(loc >= 0 && loc < this._locations.length) {
			cfi = this._locations[loc];
		}

		return cfi;
	}

	/**
	 * Get an EpubCFI from location percentage
	 * @param {number} percentage
	 * @return {EpubCFI} cfi
	 */
	cfiFromPercentage(percentage){
		let loc;
		if (percentage > 1) {
			console.warn("Normalize cfiFromPercentage value to between 0 - 1");
		}

		// Make sure 1 goes to very end
		if (percentage >= 1) {
			let cfi = new EpubCFI(this._locations[this.total]);
			cfi.collapse();
			return cfi.toString();
		}

		loc = Math.ceil(this.total * percentage);
		return this.cfiFromLocation(loc);
	}

	/**
	 * Load locations from JSON
	 * @param {json} locations
	 */
	load(locations){
		if (typeof locations === "string") {
			this._locations = JSON.parse(locations);
		} else {
			this._locations = locations;
		}
		this.total = this._locations.length - 1;
		return this._locations;
	}

	/**
	 * Save locations to JSON
	 * @return {json}
	 */
	save(){
		return JSON.stringify(this._locations);
	}

	getCurrent(){
		return this._current;
	}

	setCurrent(curr){
		var loc;

		if(typeof curr == "string"){
			this._currentCfi = curr;
		} else if (typeof curr == "number") {
			this._current = curr;
		} else {
			return;
		}

		if(this._locations.length === 0) {
			return;
		}

		if(typeof curr == "string"){
			loc = this.locationFromCfi(curr);
			this._current = loc;
		} else {
			loc = curr;
		}

		this.emit(EVENTS.LOCATIONS.CHANGED, {
			percentage: this.percentageFromLocation(loc)
		});
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

	/**
	 * Locations length
	 */
	length () {
		return this._locations.length;
	}

	destroy () {
		this.spine = undefined;
		this.request = undefined;
		this.pause = undefined;

		this.q.stop();
		this.q = undefined;
		this.epubcfi = undefined;

		this._locations = undefined
		this.total = undefined;

		this.break = undefined;
		this._current = undefined;

		this.currentLocation = undefined;
		this._currentCfi = undefined;
		clearTimeout(this.processingTimeout);

		if (this.worker) {
			this.worker.terminate();
			this.worker = undefined;
		}

		this.workerRequests.forEach((pending) => {
			pending.reject(new Error("Locations destroyed"));
		});
		this.workerRequests.clear();
		this.workerRequests = undefined;
	}
}

EventEmitter(Locations.prototype);

export default Locations;
