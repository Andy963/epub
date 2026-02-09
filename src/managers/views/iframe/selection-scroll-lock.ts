export function selectionScrollLockEligible() {
	return this.settings.axis === "horizontal";
}

export function getScrollContainer() {
	let node = this.element;

	while (node && node.parentNode && node.parentNode.nodeType === 1) {
		node = node.parentNode;

		if (node === document.body || node === document.documentElement) {
			break;
		}

		let style = window.getComputedStyle(node);
		let overflowX = style.overflowX || style.overflow;
		let overflowY = style.overflowY || style.overflow;

		let canScrollX = node.scrollWidth > node.clientWidth + 1 && overflowX !== "visible";
		let canScrollY = node.scrollHeight > node.clientHeight + 1 && overflowY !== "visible";

		if (canScrollX || canScrollY) {
			return node;
		}
	}

	return window;
}

export function enableSelectionScrollLock() {
	if (this._selectionScrollLockHandlers || !this.selectionScrollLockEligible()) {
		return;
	}

	if (!this.document) {
		return;
	}

	this._selectionScrollLock = {
		active: false,
		left: 0,
		top: 0,
		restoreRaf: undefined,
		endTimeout: undefined
	};

	let captureScroll = () => {
		let scroller = this.getScrollContainer();
		if (scroller === window) {
			this._selectionScrollLock.left = window.scrollX;
			this._selectionScrollLock.top = window.scrollY;
		} else {
			this._selectionScrollLock.left = scroller.scrollLeft;
			this._selectionScrollLock.top = scroller.scrollTop;
		}
	};

	let restoreScroll = () => {
		if (!this._selectionScrollLock.active || this._selectionScrollLock.restoreRaf) {
			return;
		}

		this._selectionScrollLock.restoreRaf = requestAnimationFrame(() => {
			this._selectionScrollLock.restoreRaf = undefined;

			let scroller = this.getScrollContainer();
			let left = this._selectionScrollLock.left;
			let top = this._selectionScrollLock.top;

			if (scroller === window) {
				if (window.scrollX !== left || window.scrollY !== top) {
					window.scrollTo(left, top);
				}
			} else {
				if (scroller.scrollLeft !== left) {
					scroller.scrollLeft = left;
				}
				if (scroller.scrollTop !== top) {
					scroller.scrollTop = top;
				}
			}
		});
	};

	let endLockSoon = () => {
		if (!this._selectionScrollLock.active) {
			return;
		}
		clearTimeout(this._selectionScrollLock.endTimeout);
		this._selectionScrollLock.endTimeout = setTimeout(() => {
			this._selectionScrollLock.active = false;
		}, 150);
	};

	let onStart = () => {
		this._selectionScrollLock.active = true;
		captureScroll();
	};

	let onSelectionChange = () => {
		if (!this._selectionScrollLock.active) {
			return;
		}

		let selection = this.document.getSelection ? this.document.getSelection() : this.window.getSelection();

		if (!selection || selection.rangeCount === 0) {
			endLockSoon();
			return;
		}

		let range = selection.getRangeAt(0);
		if (!range || range.collapsed) {
			return;
		}

		restoreScroll();
	};

	let options = { passive: true };

	this.document.addEventListener("mousedown", onStart, options);
	this.document.addEventListener("touchstart", onStart, options);
	this.document.addEventListener("mouseup", endLockSoon, options);
	this.document.addEventListener("touchend", endLockSoon, options);
	this.document.addEventListener("touchcancel", endLockSoon, options);
	this.document.addEventListener("selectionchange", onSelectionChange, options);

	this._selectionScrollLockHandlers = {
		onStart,
		onSelectionChange,
		endLockSoon
	};
}

export function disableSelectionScrollLock() {
	if (!this._selectionScrollLockHandlers || !this.document) {
		return;
	}

	let { onStart, onSelectionChange, endLockSoon } = this._selectionScrollLockHandlers;
	let options = { passive: true };

	this.document.removeEventListener("mousedown", onStart, options);
	this.document.removeEventListener("touchstart", onStart, options);
	this.document.removeEventListener("mouseup", endLockSoon, options);
	this.document.removeEventListener("touchend", endLockSoon, options);
	this.document.removeEventListener("touchcancel", endLockSoon, options);
	this.document.removeEventListener("selectionchange", onSelectionChange, options);

	if (this._selectionScrollLock) {
		clearTimeout(this._selectionScrollLock.endTimeout);
		if (this._selectionScrollLock.restoreRaf) {
			cancelAnimationFrame(this._selectionScrollLock.restoreRaf);
		}
	}

	this._selectionScrollLock = undefined;
	this._selectionScrollLockHandlers = undefined;
}

