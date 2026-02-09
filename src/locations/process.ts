import { qs, sprint, defer } from "../utils/core";
import EpubCFI from "../epubcfi";

export function serializeSectionContents(contents) {
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

export function processInWorker(section, worker) {
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

export function createRange () {
	return {
		startContainer: undefined,
		startOffset: undefined,
		endContainer: undefined,
		endOffset: undefined
	};
}

export function process(section) {
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

export function parse(contents, cfiBase, chars) {
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

