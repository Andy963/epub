class FenwickTree {
	[key: string]: any;

	constructor(size) {
		this.size =
			typeof size === "number" && isFinite(size) && size > 0
				? Math.floor(size)
				: 0;
		this.tree = this.size ? new Float64Array(this.size + 1) : new Float64Array(0);
	}

	add(index, delta) {
		if (!this.size) {
			return;
		}

		const resolvedIndex =
			typeof index === "number" && isFinite(index) ? Math.floor(index) : -1;
		const value = typeof delta === "number" && isFinite(delta) ? delta : 0;

		if (resolvedIndex < 0 || resolvedIndex >= this.size || value === 0) {
			return;
		}

		let i = resolvedIndex + 1;
		while (i <= this.size) {
			this.tree[i] += value;
			i += i & -i;
		}
	}

	sum(endExclusive) {
		if (!this.size) {
			return 0;
		}

		const resolvedEnd =
			typeof endExclusive === "number" && isFinite(endExclusive)
				? Math.max(0, Math.min(this.size, Math.floor(endExclusive)))
				: 0;

		let i = resolvedEnd;
		let out = 0;
		while (i > 0) {
			out += this.tree[i];
			i -= i & -i;
		}
		return out;
	}
}

export default FenwickTree;

