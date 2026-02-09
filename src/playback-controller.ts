export type PlaybackState = "stopped" | "playing" | "paused" | "ended" | "error";

export interface PlaybackControllerEvents {
	onSegmentStart?: (index: number) => void;
	onSegmentEnd?: (index: number) => void;
	onError?: (index: number, error: unknown) => void;
	onStateChange?: (state: PlaybackState) => void;
}

export interface PlaybackControllerDriver<Segment = any> {
	playSegment(segments: Segment[], index: number, options?: { signal?: AbortSignal }): Promise<void>;
	pause(): void;
	resume(): void | Promise<void>;
	stop(): void;
}

export interface PlaybackControllerOptions<Segment = any> extends PlaybackControllerEvents {
	segments: Segment[];
	driver: PlaybackControllerDriver<Segment>;
	startIndex?: number;

	maxRetries?: number;
	retryDelayMs?: number | ((attempt: number, error: unknown) => number);
	skipOnError?: boolean;
}

type Deferred<T> = {
	promise: Promise<T>;
	resolve: (value?: T | PromiseLike<T>) => void;
	reject: (reason?: any) => void;
};

function createDeferred<T = void>(): Deferred<T> {
	let resolve: Deferred<T>["resolve"] = null as any;
	let reject: Deferred<T>["reject"] = null as any;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function createAbortError(): Error {
	const err = new Error("Aborted");
	(err as any).name = "AbortError";
	return err;
}

function isAbortError(error: unknown): boolean {
	if (!error) return false;
	const anyErr: any = error as any;
	if (anyErr && anyErr.name === "AbortError") return true;
	const msg = String((anyErr && anyErr.message) || "");
	return msg.toLowerCase().includes("aborted");
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	const delayMs = typeof ms === "number" && isFinite(ms) && ms > 0 ? Math.floor(ms) : 0;
	if (!delayMs) {
		return Promise.resolve();
	}
	if (signal && signal.aborted) {
		return Promise.reject(createAbortError());
	}

	return new Promise((resolve, reject) => {
		let done = false;
		let abortListener: (() => void) | undefined;
		const finish = (fn: () => void) => {
			if (done) return;
			done = true;
			if (abortListener && signal) {
				try {
					signal.removeEventListener("abort", abortListener as any);
				} catch (e) {
					// NOOP
				}
				abortListener = undefined;
			}
			fn();
		};

		const t = setTimeout(() => finish(resolve), delayMs);

		if (signal) {
			abortListener = () => {
				clearTimeout(t);
				finish(() => reject(createAbortError()));
			};
			try {
				signal.addEventListener("abort", abortListener as any, { once: true } as any);
			} catch (e) {
				// NOOP
			}
		}
	});
}

function clampIndex(value: number, length: number): number {
	const idx = typeof value === "number" && isFinite(value) ? Math.floor(value) : 0;
	if (!length) return 0;
	return Math.max(0, Math.min(length - 1, idx));
}

export class PlaybackController<Segment = any> {
	private segmentsValue: Segment[];
	private driver: PlaybackControllerDriver<Segment>;
	private stateValue: PlaybackState;
	private currentIndexValue: number;

	private maxRetries: number;
	private retryDelay: (attempt: number, error: unknown) => number;
	private skipOnError: boolean;

	private onSegmentStart?: PlaybackControllerEvents["onSegmentStart"];
	private onSegmentEnd?: PlaybackControllerEvents["onSegmentEnd"];
	private onError?: PlaybackControllerEvents["onError"];
	private onStateChange?: PlaybackControllerEvents["onStateChange"];

	private runId: number;
	private runPromise?: Promise<void>;
	private runAbortController?: AbortController;
	private segmentAbortController?: AbortController;
	private resumeDeferred?: Deferred<void>;
	private activeSegmentIndex: number | null;

	constructor(options: PlaybackControllerOptions<Segment>) {
		options = options || ({} as PlaybackControllerOptions<Segment>);
		this.segmentsValue = Array.isArray(options.segments) ? options.segments : [];
		this.driver = options.driver;
		if (!this.driver || typeof this.driver.playSegment !== "function") {
			throw new Error("PlaybackController: driver.playSegment is required");
		}

		this.stateValue = "stopped";
		const startIndex = typeof options.startIndex === "number" ? options.startIndex : 0;
		this.currentIndexValue = clampIndex(startIndex, this.segmentsValue.length);

		this.maxRetries = typeof options.maxRetries === "number" && isFinite(options.maxRetries) && options.maxRetries > 0 ? Math.floor(options.maxRetries) : 0;
		this.skipOnError = options.skipOnError !== false;

		const retryDelayMs = options.retryDelayMs;
		if (typeof retryDelayMs === "function") {
			this.retryDelay = retryDelayMs;
		} else if (typeof retryDelayMs === "number" && isFinite(retryDelayMs) && retryDelayMs >= 0) {
			this.retryDelay = () => Math.floor(retryDelayMs);
		} else {
			this.retryDelay = (attempt) => Math.min(250 * Math.pow(2, Math.max(0, attempt - 1)), 5000);
		}

		this.onSegmentStart = options.onSegmentStart;
		this.onSegmentEnd = options.onSegmentEnd;
		this.onError = options.onError;
		this.onStateChange = options.onStateChange;

		this.runId = 0;
		this.runPromise = undefined;
		this.runAbortController = undefined;
		this.segmentAbortController = undefined;
		this.resumeDeferred = undefined;
		this.activeSegmentIndex = null;
	}

	get state(): PlaybackState {
		return this.stateValue;
	}

	get currentIndex(): number {
		return this.currentIndexValue;
	}

	get segments(): Segment[] {
		return this.segmentsValue;
	}

	play(): void {
		if (this.stateValue === "playing") {
			return;
		}
		if (this.stateValue === "paused") {
			this.resume();
			return;
		}
		if (!this.segmentsValue.length) {
			return;
		}

		if (this.currentIndexValue < 0 || this.currentIndexValue >= this.segmentsValue.length) {
			this.currentIndexValue = clampIndex(this.currentIndexValue, this.segmentsValue.length);
		}

		this.setState("playing");
		this.startRunIfNeeded();
	}

	pause(): void {
		if (this.stateValue !== "playing") {
			return;
		}
		this.setState("paused");
		if (!this.resumeDeferred) {
			this.resumeDeferred = createDeferred<void>();
		}
		try {
			this.driver.pause();
		} catch (e) {
			// NOOP
		}
	}

	resume(): void {
		if (this.stateValue === "playing") {
			return;
		}
		if (this.stateValue === "stopped" || this.stateValue === "ended" || this.stateValue === "error") {
			this.play();
			return;
		}
		if (this.stateValue !== "paused") {
			return;
		}

		this.setState("playing");
		if (this.resumeDeferred) {
			this.resumeDeferred.resolve();
			this.resumeDeferred = undefined;
		}
		try {
			void this.driver.resume();
		} catch (e) {
			// NOOP
		}
		this.startRunIfNeeded();
	}

	stop(): void {
		if (this.stateValue === "stopped") {
			return;
		}

		this.setState("stopped");
		this.cancelRun();
		try {
			this.driver.stop();
		} catch (e) {
			// NOOP
		}
		if (this.resumeDeferred) {
			this.resumeDeferred.resolve();
			this.resumeDeferred = undefined;
		}
	}

	seekToSegment(index: number): void {
		if (!this.segmentsValue.length) {
			return;
		}
		const idx = typeof index === "number" && isFinite(index) ? Math.floor(index) : NaN;
		if (!(idx >= 0 && idx < this.segmentsValue.length)) {
			throw new Error("PlaybackController: segment index out of bounds");
		}

		this.currentIndexValue = idx;

		if (this.stateValue === "playing") {
			this.restartRun();
			return;
		}

		if (this.stateValue === "paused") {
			this.cancelRun();
			return;
		}

		if (this.stateValue === "ended" || this.stateValue === "error") {
			this.setState("stopped");
		}
	}

	next(): void {
		if (!this.segmentsValue.length) {
			return;
		}
		const nextIndex = this.currentIndexValue + 1;
		if (nextIndex >= this.segmentsValue.length) {
			if (this.stateValue === "playing" || this.stateValue === "paused") {
				this.cancelRun();
			}
			this.setState("ended");
			return;
		}
		this.seekToSegment(nextIndex);
	}

	prev(): void {
		if (!this.segmentsValue.length) {
			return;
		}
		const prevIndex = this.currentIndexValue - 1;
		if (prevIndex < 0) {
			this.seekToSegment(0);
			return;
		}
		this.seekToSegment(prevIndex);
	}

	private setState(state: PlaybackState): void {
		if (this.stateValue === state) {
			return;
		}
		this.stateValue = state;
		if (this.onStateChange) {
			try {
				this.onStateChange(state);
			} catch (e) {
				// NOOP
			}
		}
	}

	private emitSegmentStart(index: number): void {
		if (!this.onSegmentStart) return;
		try {
			this.onSegmentStart(index);
		} catch (e) {
			// NOOP
		}
	}

	private emitSegmentEnd(index: number): void {
		if (!this.onSegmentEnd) return;
		try {
			this.onSegmentEnd(index);
		} catch (e) {
			// NOOP
		}
	}

	private emitError(index: number, error: unknown): void {
		if (!this.onError) return;
		try {
			this.onError(index, error);
		} catch (e) {
			// NOOP
		}
	}

	private startRunIfNeeded(): void {
		if (this.runPromise) {
			return;
		}
		const runId = (this.runId += 1);
		const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
		this.runAbortController = controller;
		const runSignal = controller ? controller.signal : undefined;

		const promise = this.runLoop(runId, runSignal).finally(() => {
			if (this.runPromise === promise) {
				this.runPromise = undefined;
			}
			if (this.runAbortController === controller) {
				this.runAbortController = undefined;
			}
		});
		this.runPromise = promise;
	}

	private restartRun(): void {
		this.cancelRun();
		this.startRunIfNeeded();
	}

	private cancelRun(): void {
		this.runId += 1;
		this.runPromise = undefined;

		const runController = this.runAbortController;
		this.runAbortController = undefined;
		if (runController) {
			try {
				runController.abort();
			} catch (e) {
				// NOOP
			}
		}

		const segController = this.segmentAbortController;
		this.segmentAbortController = undefined;
		if (segController) {
			try {
				segController.abort();
			} catch (e) {
				// NOOP
			}
		}

		try {
			this.driver.stop();
		} catch (e) {
			// NOOP
		}

		if (this.resumeDeferred) {
			this.resumeDeferred.resolve();
			this.resumeDeferred = undefined;
		}
	}

	private async awaitIfPaused(runId: number, runSignal?: AbortSignal): Promise<void> {
		while (this.runId === runId && this.stateValue === "paused") {
			if (runSignal && runSignal.aborted) {
				throw createAbortError();
			}
			if (!this.resumeDeferred) {
				this.resumeDeferred = createDeferred<void>();
			}
			await this.resumeDeferred.promise;
		}

		if (this.runId !== runId) {
			throw createAbortError();
		}
		if (runSignal && runSignal.aborted) {
			throw createAbortError();
		}
	}

	private async runLoop(runId: number, runSignal?: AbortSignal): Promise<void> {
		try {
			while (this.runId === runId && this.stateValue === "playing") {
				if (!this.segmentsValue.length) {
					this.setState("ended");
					return;
				}

				if (this.currentIndexValue >= this.segmentsValue.length) {
					this.setState("ended");
					return;
				}

				await this.awaitIfPaused(runId, runSignal);
				if (this.runId !== runId || this.stateValue !== "playing") {
					return;
				}

				const index = this.currentIndexValue;
				this.activeSegmentIndex = index;
				this.emitSegmentStart(index);
				let segmentEndEmitted = false;
				const emitEndOnce = () => {
					if (segmentEndEmitted) return;
					segmentEndEmitted = true;
					this.emitSegmentEnd(index);
				};

				const segController = typeof AbortController !== "undefined" ? new AbortController() : undefined;
				this.segmentAbortController = segController;
				const segSignal = segController ? segController.signal : undefined;

				let success = false;
				let lastError: unknown = undefined;

				try {
					for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
						await this.awaitIfPaused(runId, runSignal);

						if (this.runId !== runId || this.stateValue !== "playing") {
							throw createAbortError();
						}
						if (runSignal && runSignal.aborted) {
							throw createAbortError();
						}
						if (segSignal && segSignal.aborted) {
							throw createAbortError();
						}

						try {
							await this.driver.playSegment(this.segmentsValue, index, segSignal ? { signal: segSignal } : undefined);

							if (this.runId !== runId || this.stateValue !== "playing") {
								throw createAbortError();
							}
							if (runSignal && runSignal.aborted) {
								throw createAbortError();
							}
							if (segSignal && segSignal.aborted) {
								throw createAbortError();
							}

							success = true;
							break;
						} catch (error) {
							if (isAbortError(error) || (runSignal && runSignal.aborted) || (segSignal && segSignal.aborted) || this.runId !== runId) {
								throw createAbortError();
							}

							lastError = error;
							if (attempt >= this.maxRetries) {
								break;
							}

							try {
								this.driver.stop();
							} catch (e) {
								// NOOP
							}

							const delay = this.retryDelay(attempt + 1, error);
							await sleep(delay, runSignal);
						}
					}

					if (success) {
						emitEndOnce();
						this.currentIndexValue = index + 1;
						continue;
					}

					this.emitError(index, lastError || new Error("Segment playback failed"));
					emitEndOnce();

					if (this.skipOnError) {
						this.currentIndexValue = index + 1;
						continue;
					}

					this.setState("error");
					try {
						this.driver.stop();
					} catch (e) {
						// NOOP
					}
					return;
				} finally {
					if (this.activeSegmentIndex === index) {
						this.activeSegmentIndex = null;
					}
					if (this.segmentAbortController === segController) {
						this.segmentAbortController = undefined;
					}
					if (!segmentEndEmitted) {
						emitEndOnce();
					}
				}
			}
		} catch (error) {
			if (isAbortError(error)) {
				return;
			}

			const idx = typeof this.activeSegmentIndex === "number" ? this.activeSegmentIndex : this.currentIndexValue;
			this.emitError(idx, error);
			this.setState("error");
			try {
				this.driver.stop();
			} catch (e) {
				// NOOP
			}
		}
	}
}
