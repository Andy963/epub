const DEFAULT_MAX_ENTRIES = 500;

function defaultNow() {
	if (typeof performance !== "undefined" && typeof performance.now === "function") {
		return performance.now();
	}

	return Date.now();
}

class PerformanceTracker {
	constructor(options) {
		let settings = options;
		if (typeof options === "boolean") {
			settings = {
				enabled: options
			};
		}

		this.settings = {
			enabled: true,
			maxEntries: DEFAULT_MAX_ENTRIES,
			now: undefined
		};

		if (settings && typeof settings === "object") {
			if (typeof settings.enabled === "boolean") {
				this.settings.enabled = settings.enabled;
			}
			if (typeof settings.maxEntries === "number" && settings.maxEntries > 0) {
				this.settings.maxEntries = settings.maxEntries;
			}
			if (typeof settings.now === "function") {
				this.settings.now = settings.now;
			}
		}

		this.reset();
	}

	isEnabled() {
		return this.settings.enabled === true;
	}

	setEnabled(enabled) {
		this.settings.enabled = !!enabled;
	}

	start(name, data) {
		if (!this.isEnabled()) {
			return undefined;
		}

		this.sequence += 1;
		this.activeSpans[this.sequence] = {
			name: name,
			start: this.now(),
			data: data || {}
		};
		return this.sequence;
	}

	end(spanId, data) {
		if (!this.isEnabled() || typeof spanId === "undefined") {
			return;
		}

		const span = this.activeSpans[spanId];
		if (!span) {
			return;
		}
		delete this.activeSpans[spanId];

		const end = this.now();
		const duration = end - span.start;
		const entry = {
			type: "span",
			name: span.name,
			start: span.start,
			end: end,
			duration: duration,
			data: span.data,
			result: data || {}
		};

		this.push(entry);
		this.count(`${span.name}.count`, 1);
		this.count(`${span.name}.duration`, duration);

		return entry;
	}

	mark(name, data) {
		if (!this.isEnabled()) {
			return;
		}

		const entry = {
			type: "mark",
			name: name,
			at: this.now(),
			data: data || {}
		};
		this.push(entry);
		this.count(`${name}.count`, 1);

		return entry;
	}

	count(name, value) {
		if (!this.isEnabled() || !name) {
			return;
		}

		if (!this.counters[name]) {
			this.counters[name] = 0;
		}

		this.counters[name] += typeof value === "number" ? value : 1;
	}

	snapshot() {
		return {
			enabled: this.isEnabled(),
			counters: Object.assign({}, this.counters),
			entries: this.entries.slice(),
			activeSpans: Object.keys(this.activeSpans).length
		};
	}

	reset() {
		this.entries = [];
		this.counters = {};
		this.activeSpans = {};
		this.sequence = 0;
	}

	now() {
		if (typeof this.settings.now === "function") {
			return this.settings.now();
		}
		return defaultNow();
	}

	push(entry) {
		this.entries.push(entry);
		if (this.entries.length > this.settings.maxEntries) {
			this.entries.shift();
		}
	}
}

export default PerformanceTracker;
