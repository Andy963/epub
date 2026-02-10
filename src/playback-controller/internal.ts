export type Deferred<T> = {
	promise: Promise<T>;
	resolve: (value?: T | PromiseLike<T>) => void;
	reject: (reason?: any) => void;
};

export function createDeferred<T = void>(): Deferred<T> {
	let resolve: Deferred<T>["resolve"] = null as any;
	let reject: Deferred<T>["reject"] = null as any;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

export function createAbortError(): Error {
	const err = new Error("Aborted");
	(err as any).name = "AbortError";
	return err;
}

export function isAbortError(error: unknown): boolean {
	if (!error) return false;
	const anyErr: any = error as any;
	if (anyErr && anyErr.name === "AbortError") return true;
	const msg = String((anyErr && anyErr.message) || "");
	return msg.toLowerCase().includes("aborted");
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
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

export function clampIndex(value: number, length: number): number {
	const idx = typeof value === "number" && isFinite(value) ? Math.floor(value) : 0;
	if (!length) return 0;
	return Math.max(0, Math.min(length - 1, idx));
}

