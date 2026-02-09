import { qs, sprint, defer } from "../utils/core";
import EpubCFI from "../epubcfi";

/**
 * Load all of sections in the book to generate locations
 * @param  {string} startCfi start position
 * @param  {int} wordCount how many words to split on
 * @param  {int} count result count
 * @return {object} locations
 */
export function generateFromWords(startCfi, wordCount, count) {
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

export function processWords(section, wordCount, startCfi, count) {
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
export function countWords(s) {
	s = s.replace(/(^\\s*)|(\\s*$)/gi, "");//exclude  start and end white-space
	s = s.replace(/[ ]{2,}/gi, " ");//2 or more space to 1
	s = s.replace(/\\n /, "\\n"); // exclude newline with a start spacing
	return s.split(" ").length;
}

export function parseWords(contents, section, wordCount, startCfi) {
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

