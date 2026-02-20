import { Pane, Highlight, Underline } from "marks-pane";
import { EVENTS } from "../../../utils/constants";

function isSameRect(rectA, rectB) {
	return (
		rectA.top === rectB.top &&
		rectA.right === rectB.right &&
		rectA.bottom === rectB.bottom &&
		rectA.left === rectB.left
	);
}

function strictlyContainsRect(container, target) {
	if (
		target.right > container.right ||
		target.left < container.left ||
		target.top < container.top ||
		target.bottom > container.bottom
	) {
		return false;
	}

	return !isSameRect(container, target);
}

export function filterContainedRects(rects) {
	const ranges = Array.from(rects || []);

	return ranges.filter((currentRect, currentIndex) => {
		return !ranges.some((candidateRect, candidateIndex) => {
			if (candidateIndex === currentIndex) {
				return false;
			}

			if (isSameRect(candidateRect, currentRect)) {
				return candidateIndex < currentIndex;
			}

			return strictlyContainsRect(currentRect, candidateRect);
		});
	});
}

class EpubHighlight extends Highlight {
	filteredRanges() {
		return filterContainedRects((this as any).range.getClientRects());
	}
}

class EpubUnderline extends Underline {
	filteredRanges() {
		return filterContainedRects((this as any).range.getClientRects());
	}
}

export function highlight(cfiRange, data={}, cb, className = "epubjs-hl", styles = {}) {
	if (!this.contents) {
		return;
	}
	const attributes = Object.assign({ "fill": "yellow", "fill-opacity": "0.3", "mix-blend-mode": "multiply" }, styles);
	let range = this.contents.range(cfiRange);

	let emitter = () => {
		this.emit(EVENTS.VIEWS.MARK_CLICKED, cfiRange, data);
	};

	data["epubcfi"] = cfiRange;

	if (!this.pane) {
		this.pane = new Pane(this.iframe, this.element);
	}

	let m = new EpubHighlight(range, className, data, attributes);
	let h = this.pane.addMark(m);

	this.highlights[cfiRange] = { "mark": h, "element": h.element, "listeners": [emitter, cb] };

	h.element.setAttribute("ref", className);
	h.element.addEventListener("click", emitter);
	h.element.addEventListener("touchstart", emitter);

	if (cb) {
		h.element.addEventListener("click", cb);
		h.element.addEventListener("touchstart", cb);
	}
	return h;
}

export function underline(cfiRange, data={}, cb, className = "epubjs-ul", styles = {}) {
	if (!this.contents) {
		return;
	}
	const attributes = Object.assign({ "stroke": "black", "stroke-opacity": "0.3", "mix-blend-mode": "multiply" }, styles);
	let range = this.contents.range(cfiRange);
	let emitter = () => {
		this.emit(EVENTS.VIEWS.MARK_CLICKED, cfiRange, data);
	};

	data["epubcfi"] = cfiRange;

	if (!this.pane) {
		this.pane = new Pane(this.iframe, this.element);
	}

	let m = new EpubUnderline(range, className, data, attributes);
	let h = this.pane.addMark(m);

	this.underlines[cfiRange] = { "mark": h, "element": h.element, "listeners": [emitter, cb] };

	h.element.setAttribute("ref", className);
	h.element.addEventListener("click", emitter);
	h.element.addEventListener("touchstart", emitter);

	if (cb) {
		h.element.addEventListener("click", cb);
		h.element.addEventListener("touchstart", cb);
	}
	return h;
}

export function mark(cfiRange, data={}, cb) {
	if (!this.contents) {
		return;
	}

	if (cfiRange in this.marks) {
		let item = this.marks[cfiRange];
		return item;
	}

	let range = this.contents.range(cfiRange);
	if (!range) {
		return;
	}
	let container = range.commonAncestorContainer;
	let parent = (container.nodeType === 1) ? container : container.parentNode;

	let emitter = (e) => {
		this.emit(EVENTS.VIEWS.MARK_CLICKED, cfiRange, data);
	};

	if (range.collapsed && container.nodeType === 1) {
		range = new Range();
		range.selectNodeContents(container);
	} else if (range.collapsed) { // Webkit doesn't like collapsed ranges
		range = new Range();
		range.selectNodeContents(parent);
	}

	let mark = this.document.createElement("a");
	mark.setAttribute("ref", "epubjs-mk");
	mark.style.position = "absolute";

	mark.dataset["epubcfi"] = cfiRange;

	if (data) {
		Object.keys(data).forEach((key) => {
			mark.dataset[key] = data[key];
		});
	}

	if (cb) {
		mark.addEventListener("click", cb);
		mark.addEventListener("touchstart", cb);
	}

	mark.addEventListener("click", emitter);
	mark.addEventListener("touchstart", emitter);

	this.placeMark(mark, range);

	this.element.appendChild(mark);

	this.marks[cfiRange] = { "element": mark, "range": range, "listeners": [emitter, cb] };

	return parent;
}

export function placeMark(element, range) {
	let top, right, left;

	if(this.layout.name === "pre-paginated" ||
		this.settings.axis !== "horizontal") {
		let pos = range.getBoundingClientRect();
		top = pos.top;
		right = pos.right;
	} else {
		// Element might break columns, so find the left most element
		let rects = range.getClientRects();

		let rect;
		for (var i = 0; i != rects.length; i++) {
			rect = rects[i];
			if (!left || rect.left < left) {
				left = rect.left;
				// right = rect.right;
				right = Math.ceil(left / this.layout.props.pageWidth) * this.layout.props.pageWidth - (this.layout.gap / 2);
				top = rect.top;
			}
		}
	}

	element.style.top = `${top}px`;
	element.style.left = `${right}px`;
}

export function unhighlight(cfiRange) {
	let item;
	if (cfiRange in this.highlights) {
		item = this.highlights[cfiRange];

		this.pane.removeMark(item.mark);
		item.listeners.forEach((l) => {
			if (l) {
				item.element.removeEventListener("click", l);
				item.element.removeEventListener("touchstart", l);
			}
		});
		delete this.highlights[cfiRange];
	}
}

export function ununderline(cfiRange) {
	let item;
	if (cfiRange in this.underlines) {
		item = this.underlines[cfiRange];
		this.pane.removeMark(item.mark);
		item.listeners.forEach((l) => {
			if (l) {
				item.element.removeEventListener("click", l);
				item.element.removeEventListener("touchstart", l);
			}
		});
		delete this.underlines[cfiRange];
	}
}

export function unmark(cfiRange) {
	let item;
	if (cfiRange in this.marks) {
		item = this.marks[cfiRange];
		this.element.removeChild(item.element);
		item.listeners.forEach((l) => {
			if (l) {
				item.element.removeEventListener("click", l);
				item.element.removeEventListener("touchstart", l);
			}
		});
		delete this.marks[cfiRange];
	}
}
