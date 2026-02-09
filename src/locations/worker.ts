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
\tconst locations = [];\n\tlet range;\n\tconst body = (doc && (doc.querySelector && doc.querySelector(\"body\"))) ||\n\t\t(doc && doc.getElementsByTagName && doc.getElementsByTagName(\"body\")[0]) ||\n\t\t(doc && doc.documentElement);\n\tlet counter = 0;\n\tlet prev;\n\tconst breakLength = chars || 150;\n\n\tconst createRange = () => {\n\t\treturn {\n\t\t\tstartContainer: undefined,\n\t\t\tstartOffset: undefined,\n\t\t\tendContainer: undefined,\n\t\t\tendOffset: undefined\n\t\t};\n\t};\n\n\tconst parser = (node) => {\n\t\tconst text = node && node.textContent ? node.textContent : \"\";\n\t\tconst len = text.length;\n\t\tlet dist;\n\t\tlet pos = 0;\n\n\t\tif (text.trim().length === 0) {\n\t\t\treturn false;\n\t\t}\n\n\t\tif (counter === 0) {\n\t\t\trange = createRange();\n\t\t\trange.startContainer = node;\n\t\t\trange.startOffset = 0;\n\t\t}\n\n\t\tdist = breakLength - counter;\n\n\t\tif (dist > len) {\n\t\t\tcounter += len;\n\t\t\tpos = len;\n\t\t}\n\n\t\twhile (pos < len) {\n\t\t\tdist = breakLength - counter;\n\n\t\t\tif (counter === 0) {\n\t\t\t\tpos += 1;\n\t\t\t\trange = createRange();\n\t\t\t\trange.startContainer = node;\n\t\t\t\trange.startOffset = pos;\n\t\t\t}\n\n\t\t\tif (pos + dist >= len) {\n\t\t\t\tcounter += len - pos;\n\t\t\t\tpos = len;\n\t\t\t} else {\n\t\t\t\tpos += dist;\n\t\t\t\trange.endContainer = node;\n\t\t\t\trange.endOffset = pos;\n\t\t\t\tlocations.push(cfiFromRange(range, cfiBase));\n\t\t\t\tcounter = 0;\n\t\t\t}\n\t\t}\n\n\t\tprev = node;\n\t};\n\n\twalkTextNodes(body, parser);\n\n\tif (range && range.startContainer && prev) {\n\t\trange.endContainer = prev;\n\t\trange.endOffset = prev.textContent ? prev.textContent.length : 0;\n\t\tlocations.push(cfiFromRange(range, cfiBase));\n\t\tcounter = 0;\n\t}\n\n\treturn locations;\n}

self.onmessage = (event) => {
\tconst message = event && event.data;\n\tif (!message || message.type !== \"parse\") {\n\t\treturn;\n\t}\n\tconst id = message.id;\n\ttry {\n\t\tif (typeof DOMParser === \"undefined\") {\n\t\t\tthrow new Error(\"DOMParser is not available in this worker\");\n\t\t}\n\t\tconst parser = new DOMParser();\n\t\tconst doc = parser.parseFromString(message.xhtml, \"application/xhtml+xml\");\n\t\tconst locations = parseLocations(doc, message.cfiBase, message.chars);\n\t\tself.postMessage({ id, locations });\n\t} catch (error) {\n\t\tself.postMessage({ id, error: (error && error.message) || String(error) });\n\t}\n};\n`;
}

