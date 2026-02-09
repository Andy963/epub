import FenwickTree from "./fenwick-tree";

export async function initProgressWeights() {
	if (!this.pdf) {
		return;
	}

	const total = this.pdf.numPages || 0;
	if (!total) {
		return;
	}

	try {
		const first = await this.pdf.getPage(1);
		const viewport = first.getViewport({ scale: 1 });
		const weight =
			viewport &&
			typeof viewport.width === "number" &&
			isFinite(viewport.width) &&
			typeof viewport.height === "number" &&
			isFinite(viewport.height)
				? viewport.width * viewport.height
				: NaN;

		this._progressBaseWeight = weight && isFinite(weight) && weight > 0 ? weight : 1;
	} catch (e) {
		this._progressBaseWeight = 1;
	}

	this._progressDeltas = new Float64Array(total);
	this._progressDeltaTree = new FenwickTree(total);
}

export function recordPageWeight(pageIndex, viewport) {
	const total = this.numPages || 0;
	if (!total || !this._progressDeltaTree || !this._progressDeltas) {
		return;
	}

	const index =
		typeof pageIndex === "number" && isFinite(pageIndex)
			? Math.floor(pageIndex)
			: -1;
	if (index < 0 || index >= total) {
		return;
	}

	const weight =
		viewport &&
		typeof viewport.width === "number" &&
		isFinite(viewport.width) &&
		typeof viewport.height === "number" &&
		isFinite(viewport.height)
			? viewport.width * viewport.height
			: NaN;
	if (!weight || !isFinite(weight) || weight <= 0) {
		return;
	}

	const base =
		typeof this._progressBaseWeight === "number" &&
		isFinite(this._progressBaseWeight) &&
		this._progressBaseWeight > 0
			? this._progressBaseWeight
			: 1;

	const nextDelta = weight - base;
	const prevDelta = this._progressDeltas[index];
	const diff = nextDelta - prevDelta;
	if (!diff || !isFinite(diff)) {
		return;
	}

	this._progressDeltas[index] = nextDelta;
	this._progressDeltaTree.add(index, diff);
}

export function progressDenominator() {
	const total = this.numPages || 0;
	if (total <= 1) {
		return 0;
	}

	const base =
		typeof this._progressBaseWeight === "number" &&
		isFinite(this._progressBaseWeight) &&
		this._progressBaseWeight > 0
			? this._progressBaseWeight
			: 1;

	if (!this._progressDeltaTree || !this._progressDeltas) {
		return (total - 1) * base;
	}

	const deltaTotal = this._progressDeltaTree.sum(total);
	const deltaLast = this._progressDeltas[total - 1] || 0;
	const deltaBeforeLast = deltaTotal - deltaLast;
	return (total - 1) * base + deltaBeforeLast;
}

export function progressPrefixBefore(pageIndex) {
	const total = this.numPages || 0;
	if (!total) {
		return 0;
	}

	const index =
		typeof pageIndex === "number" && isFinite(pageIndex)
			? Math.max(0, Math.min(total - 1, Math.floor(pageIndex)))
			: 0;

	const base =
		typeof this._progressBaseWeight === "number" &&
		isFinite(this._progressBaseWeight) &&
		this._progressBaseWeight > 0
			? this._progressBaseWeight
			: 1;

	const delta =
		this._progressDeltaTree && this._progressDeltas
			? this._progressDeltaTree.sum(index)
			: 0;

	return index * base + delta;
}

export function percentageFromPageIndex(pageIndex) {
	const total = this.numPages || 0;
	if (total <= 1) {
		return 0;
	}

	const index =
		typeof pageIndex === "number" && isFinite(pageIndex)
			? Math.max(0, Math.min(total - 1, Math.floor(pageIndex)))
			: 0;

	const denom = this.progressDenominator();
	if (!denom || !isFinite(denom) || denom <= 0) {
		return Math.max(0, Math.min(1, index / Math.max(1, total - 1)));
	}

	return Math.max(0, Math.min(1, this.progressPrefixBefore(index) / denom));
}

export function pageIndexFromPercentage(percentage) {
	const total = this.numPages || 0;
	if (total <= 1) {
		return 0;
	}

	if (typeof percentage !== "number" || !isFinite(percentage)) {
		return 0;
	}

	if (percentage >= 1) {
		return total - 1;
	}

	if (percentage <= 0) {
		return 0;
	}

	const denom = this.progressDenominator();
	if (!denom || !isFinite(denom) || denom <= 0) {
		return Math.max(0, Math.min(total - 1, Math.ceil((total - 1) * percentage)));
	}

	const target = denom * percentage;

	let lo = 0;
	let hi = total - 1;

	while (lo < hi) {
		const mid = Math.floor((lo + hi) / 2);
		const pos = this.progressPrefixBefore(mid);
		if (pos >= target) {
			hi = mid;
		} else {
			lo = mid + 1;
		}
	}

	return lo;
}

