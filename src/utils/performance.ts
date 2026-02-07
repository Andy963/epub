const DEFAULT_MAX_ENTRIES = 500;

export interface PerformanceTrackerOptions {
	enabled?: boolean;
	maxEntries?: number;
	now?: () => number;
}

export type PerformanceEntryType = "span" | "mark";

export interface PerformanceSpanEntry {
	type: "span";
	name: string;
	start: number;
	end: number;
	duration: number;
	data: Record<string, unknown>;
	result: Record<string, unknown>;
}

export interface PerformanceMarkEntry {
	type: "mark";
	name: string;
	at: number;
	data: Record<string, unknown>;
}

export type PerformanceEntry = PerformanceSpanEntry | PerformanceMarkEntry;

interface ActiveSpan {
	name: string;
	start: number;
	data: Record<string, unknown>;
}

interface PerformanceTrackerSettings {
	enabled: boolean;
	maxEntries: number;
	now?: () => number;
}

function defaultNow(): number {
	if (typeof performance !== "undefined" && typeof performance.now === "function") {
		return performance.now();
	}

	return Date.now();
}

class PerformanceTracker {
	settings: PerformanceTrackerSettings;
	entries: PerformanceEntry[];
	counters: Record<string, number>;
	activeSpans: Record<number, ActiveSpan>;
	sequence: number;

	constructor(options?: PerformanceTrackerOptions | boolean) {
		let settings: PerformanceTrackerOptions | undefined;
		if (typeof options === "boolean") {
			settings = {
				enabled: options
			};
		} else {
			settings = options;
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

	isEnabled(): boolean {
		return this.settings.enabled === true;
	}

	setEnabled(enabled: boolean): void {
		this.settings.enabled = !!enabled;
	}

	start(name: string, data?: Record<string, unknown>): number | undefined {
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

	end(
		spanId: number | undefined,
		data?: Record<string, unknown>
	): PerformanceSpanEntry | undefined {
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
		const entry: PerformanceSpanEntry = {
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

	mark(name: string, data?: Record<string, unknown>): PerformanceMarkEntry | undefined {
		if (!this.isEnabled()) {
			return;
		}

		const entry: PerformanceMarkEntry = {
			type: "mark",
			name: name,
			at: this.now(),
			data: data || {}
		};
		this.push(entry);
		this.count(`${name}.count`, 1);

		return entry;
	}

	count(name: string, value?: number): void {
		if (!this.isEnabled() || !name) {
			return;
		}

		if (!this.counters[name]) {
			this.counters[name] = 0;
		}

		this.counters[name] += typeof value === "number" ? value : 1;
	}

	snapshot(): {
		enabled: boolean;
		counters: Record<string, number>;
		entries: PerformanceEntry[];
		activeSpans: number;
	} {
		return {
			enabled: this.isEnabled(),
			counters: Object.assign({}, this.counters),
			entries: this.entries.slice(),
			activeSpans: Object.keys(this.activeSpans).length
		};
	}

	reset(): void {
		this.entries = [];
		this.counters = {};
		this.activeSpans = {};
		this.sequence = 0;
	}

	now(): number {
		if (typeof this.settings.now === "function") {
			return this.settings.now();
		}
		return defaultNow();
	}

	push(entry: PerformanceEntry): void {
		this.entries.push(entry);
		if (this.entries.length > this.settings.maxEntries) {
			this.entries.shift();
		}
	}
}

export default PerformanceTracker;
