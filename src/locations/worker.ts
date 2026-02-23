import { defer } from "../utils/core";

export function createLocationsWorker() {
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

export function attachWorker(worker) {
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

export function handleWorkerMessage(event) {
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

export function handleWorkerError(event) {
	const message = (event && (event.message || (event.error && event.error.message))) || "Locations worker error";

	this.workerRequests.forEach((pending) => {
		pending.reject(new Error(message));
	});
	this.workerRequests.clear();
}

export function sendWorkerRequest(worker, payload) {
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

export function locationsWorkerSource() {
	return `
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const DOCUMENT_NODE = 9;

function getNodeId(node) {
	if (!node) {
		return null;
	}
	if (node.id) {
		return node.id;
	}
	if (typeof node.getAttribute === "function") {
		return node.getAttribute("id") || null;
	}
	return null;
}

function textNodes(container) {
	if (!container || !container.childNodes) {
		return [];
	}
	return Array.prototype.slice.call(container.childNodes).filter((node) => node && node.nodeType === TEXT_NODE);
}

function elementChildren(container) {
	if (!container) {
		return [];
	}
	if (container.children) {
		return Array.prototype.slice.call(container.children);
	}
	if (!container.childNodes) {
		return [];
	}
	return Array.prototype.slice.call(container.childNodes).filter((node) => node && node.nodeType === ELEMENT_NODE);
}

function position(anchor) {
	if (!anchor || !anchor.parentNode) {
		return 0;
	}
	if (anchor.nodeType === ELEMENT_NODE) {
		const children = elementChildren(anchor.parentNode);
		return children.indexOf(anchor);
	}
	const children = textNodes(anchor.parentNode);
	return children.indexOf(anchor);
}

function step(node) {
	const nodeType = node && node.nodeType === TEXT_NODE ? "text" : "element";
	return {
		id: nodeType === "element" ? getNodeId(node) : null,
		type: nodeType,
		index: position(node)
	};
}

function pathTo(node, offset) {
	const segment = {
		steps: [],
		terminal: { offset: null }
	};
	let currentNode = node;
	while (currentNode && currentNode.parentNode && currentNode.parentNode.nodeType !== DOCUMENT_NODE) {
		segment.steps.unshift(step(currentNode));
		currentNode = currentNode.parentNode;
	}
	if (offset != null && offset >= 0) {
		segment.terminal.offset = offset;
		const lastStep = segment.steps[segment.steps.length - 1];
		if (!lastStep || lastStep.type !== "text") {
			segment.steps.push({ type: "text", index: 0, id: null });
		}
	}
	return segment;
}

function equalStep(stepA, stepB) {
	if (!stepA || !stepB) {
		return false;
	}
	return stepA.index === stepB.index && stepA.type === stepB.type && stepA.id === stepB.id;
}

function joinSteps(steps) {
	if (!steps || steps.length === 0) {
		return "";
	}
	return steps.map((part) => {
		let segment = "";
		if (part.type === "element") {
			segment += (part.index + 1) * 2;
		}
		if (part.type === "text") {
			segment += 1 + (2 * part.index);
		}
		if (part.id) {
			segment += "[" + part.id + "]";
		}
		return segment;
	}).join("/");
}

function segmentString(segment) {
	let segmentString = "/";
	segmentString += joinSteps(segment.steps);
	if (segment.terminal && segment.terminal.offset != null) {
		segmentString += ":" + segment.terminal.offset;
	}
	return segmentString;
}

function cfiFromRange(range, base) {
	const startSegment = pathTo(range.startContainer, range.startOffset);
	const endSegment = pathTo(range.endContainer, range.endOffset);

	let commonLen = 0;
	const maxLen = Math.min(startSegment.steps.length, endSegment.steps.length);
	while (commonLen < maxLen && equalStep(startSegment.steps[commonLen], endSegment.steps[commonLen])) {
		commonLen += 1;
	}

	if (commonLen === startSegment.steps.length &&
			commonLen === endSegment.steps.length &&
			startSegment.terminal.offset !== endSegment.terminal.offset &&
			commonLen > 0) {
		commonLen -= 1;
	}

	const pathSteps = startSegment.steps.slice(0, commonLen);
	const startSteps = startSegment.steps.slice(commonLen);
	const endSteps = endSegment.steps.slice(commonLen);

	const pathString = segmentString({ steps: pathSteps, terminal: { offset: null } });
	const startString = segmentString({ steps: startSteps, terminal: { offset: startSegment.terminal.offset } });
	const endString = segmentString({ steps: endSteps, terminal: { offset: endSegment.terminal.offset } });

	return "epubcfi(" + base + "!" + pathString + "," + startString + "," + endString + ")";
}

function walkTextNodes(root, callback) {
	if (!root) {
		return;
	}
	const stack = [root];
	while (stack.length) {
		const node = stack.pop();
		if (!node || !node.childNodes) {
			continue;
		}
		for (let i = node.childNodes.length - 1; i >= 0; i -= 1) {
			const child = node.childNodes[i];
			if (!child) {
				continue;
			}
			if (child.nodeType === TEXT_NODE) {
				callback(child);
			} else if (child.nodeType === ELEMENT_NODE) {
				stack.push(child);
			}
		}
	}
}

function parseLocations(doc, cfiBase, chars) {
	const locations = [];
	let range;
	const body = (doc && (doc.querySelector && doc.querySelector("body"))) ||
		(doc && doc.getElementsByTagName && doc.getElementsByTagName("body")[0]) ||
		(doc && doc.documentElement);
	let counter = 0;
	let prev;
	const breakLength = chars || 150;

	const createRange = () => {
		return {
			startContainer: undefined,
			startOffset: undefined,
			endContainer: undefined,
			endOffset: undefined
		};
	};

	const parser = (node) => {
		const text = node && node.textContent ? node.textContent : "";
		const len = text.length;
		let dist;
		let pos = 0;

		if (text.trim().length === 0) {
			return false;
		}

		if (counter === 0) {
			range = createRange();
			range.startContainer = node;
			range.startOffset = 0;
		}

		dist = breakLength - counter;

		if (dist > len) {
			counter += len;
			pos = len;
		}

		while (pos < len) {
			dist = breakLength - counter;

			if (counter === 0) {
				pos += 1;
				range = createRange();
				range.startContainer = node;
				range.startOffset = pos;
			}

			if (pos + dist >= len) {
				counter += len - pos;
				pos = len;
			} else {
				pos += dist;
				range.endContainer = node;
				range.endOffset = pos;
				locations.push(cfiFromRange(range, cfiBase));
				counter = 0;
			}
		}

		prev = node;
	};

	walkTextNodes(body, parser);

	if (range && range.startContainer && prev) {
		range.endContainer = prev;
		range.endOffset = prev.textContent ? prev.textContent.length : 0;
		locations.push(cfiFromRange(range, cfiBase));
		counter = 0;
	}

	return locations;
}

self.onmessage = (event) => {
	const message = event && event.data;
	if (!message || message.type !== "parse") {
		return;
	}
	const id = message.id;
	try {
		if (typeof DOMParser === "undefined") {
			throw new Error("DOMParser is not available in this worker");
		}
		const parser = new DOMParser();
		const doc = parser.parseFromString(message.xhtml, "application/xhtml+xml");
		const locations = parseLocations(doc, message.cfiBase, message.chars);
		self.postMessage({ id, locations });
	} catch (error) {
		self.postMessage({ id, error: (error && error.message) || String(error) });
	}
};
`;
}
