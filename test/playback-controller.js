import assert from "assert";
import { PlaybackController } from "../src/playback-controller";

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function createAbortError() {
	const err = new Error("Aborted");
	err.name = "AbortError";
	return err;
}

function createFakeDriver(options) {
	const durations = options && options.durations ? options.durations : [];
	const defaultDuration = options && typeof options.defaultDuration === "number" ? options.defaultDuration : 20;
	const failures = Object.assign({}, (options && options.failures) || {});

	const state = {
		playCalls: [],
	};

	let paused = false;
	let current = null;

	const stopCurrent = () => {
		if (!current) return;
		const c = current;
		current = null;
		if (c.timer) {
			clearTimeout(c.timer);
		}
		if (c.abortListener && c.signal) {
			try {
				c.signal.removeEventListener("abort", c.abortListener);
			} catch (e) {
				// NOOP
			}
		}
		c.reject(createAbortError());
	};

	const schedule = () => {
		if (!current) return;
		if (paused) return;
		current.startedAt = Date.now();
		current.timer = setTimeout(() => {
			const c = current;
			current = null;
			if (c.abortListener && c.signal) {
				try {
					c.signal.removeEventListener("abort", c.abortListener);
				} catch (e) {
					// NOOP
				}
			}
			c.resolve();
		}, current.remaining);
	};

	const driver = {
		playSegment: (segments, index, opts) => {
			state.playCalls.push(index);
			const signal = opts && opts.signal ? opts.signal : undefined;
			if (signal && signal.aborted) {
				return Promise.reject(createAbortError());
			}

			stopCurrent();

			const duration = typeof durations[index] === "number" ? durations[index] : defaultDuration;
			const failLeft = failures[index] || 0;
			if (failLeft > 0) {
				failures[index] = failLeft - 1;
				return new Promise((resolve, reject) => {
					setTimeout(() => {
						if (signal && signal.aborted) {
							reject(createAbortError());
							return;
						}
						reject(new Error(`fail:${index}`));
					}, 1);
				});
			}

			return new Promise((resolve, reject) => {
				const item = {
					index,
					remaining: Math.max(0, duration),
					timer: null,
					startedAt: 0,
					resolve,
					reject,
					signal,
					abortListener: null,
				};
				current = item;

				if (signal) {
					const onAbort = () => stopCurrent();
					item.abortListener = onAbort;
					try {
						signal.addEventListener("abort", onAbort, { once: true });
					} catch (e) {
						// NOOP
					}
				}

				schedule();
			});
		},
		pause: () => {
			paused = true;
			if (!current || !current.timer) return;
			clearTimeout(current.timer);
			current.timer = null;
			const elapsed = Date.now() - current.startedAt;
			current.remaining = Math.max(0, current.remaining - elapsed);
		},
		resume: () => {
			paused = false;
			if (!current || current.timer) return;
			schedule();
		},
		stop: () => {
			stopCurrent();
		},
	};

	return { driver, state };
}

describe("PlaybackController", function () {
	it("plays segments sequentially and emits start/end/state", async function () {
		const events = { starts: [], ends: [], states: [], errors: [] };
		const { driver } = createFakeDriver({ defaultDuration: 5 });

		let done;
		const ended = new Promise((resolve) => {
			done = resolve;
		});

		const controller = new PlaybackController({
			segments: ["a", "b", "c"],
			driver,
			skipOnError: false,
			onSegmentStart: (i) => events.starts.push(i),
			onSegmentEnd: (i) => events.ends.push(i),
			onError: (i, e) => events.errors.push([i, e && e.message]),
			onStateChange: (s) => {
				events.states.push(s);
				if (s === "ended") {
					done();
				}
			},
		});

		controller.play();
		await ended;

		assert.deepStrictEqual(events.starts, [0, 1, 2]);
		assert.deepStrictEqual(events.ends, [0, 1, 2]);
		assert.deepStrictEqual(events.errors, []);
		assert.ok(events.states[0] === "playing");
		assert.ok(events.states.includes("ended"));
	});

	it("pauses and resumes without advancing", async function () {
		const events = { starts: [], ends: [], states: [] };
		const { driver } = createFakeDriver({ defaultDuration: 30 });

		let endedResolve;
		const ended = new Promise((resolve) => {
			endedResolve = resolve;
		});

		const controller = new PlaybackController({
			segments: ["a", "b"],
			driver,
			skipOnError: false,
			onSegmentStart: (i) => {
				events.starts.push(i);
				if (i === 0) {
					setTimeout(() => controller.pause(), 5);
					setTimeout(() => controller.resume(), 40);
				}
			},
			onSegmentEnd: (i) => events.ends.push(i),
			onStateChange: (s) => {
				events.states.push(s);
				if (s === "ended") endedResolve();
			},
		});

		controller.play();

		await sleep(25);
		assert.deepStrictEqual(events.ends, []);
		assert.ok(events.states.includes("paused"));

		await ended;
		assert.deepStrictEqual(events.starts, [0, 1]);
		assert.deepStrictEqual(events.ends, [0, 1]);
	});

	it("seekToSegment restarts from target index while playing", async function () {
		const events = { starts: [], ends: [] };
		const { driver } = createFakeDriver({ defaultDuration: 40 });

		let endedResolve;
		const ended = new Promise((resolve) => {
			endedResolve = resolve;
		});

		const controller = new PlaybackController({
			segments: ["a", "b", "c"],
			driver,
			skipOnError: false,
			onSegmentStart: (i) => {
				events.starts.push(i);
				if (i === 0) {
					setTimeout(() => controller.seekToSegment(2), 5);
				}
			},
			onSegmentEnd: (i) => events.ends.push(i),
			onStateChange: (s) => {
				if (s === "ended") endedResolve();
			},
		});

		controller.play();
		await ended;

		assert.ok(events.starts.includes(0));
		assert.ok(events.starts.includes(2));
		assert.ok(!events.starts.includes(1));
		assert.ok(events.ends.includes(2));
	});

	it("resumes from target index after seeking while paused", async function () {
		const events = { starts: [], states: [] };
		const { driver } = createFakeDriver({ defaultDuration: 80 });

		let firstStartedResolve;
		const firstStarted = new Promise((resolve) => {
			firstStartedResolve = resolve;
		});

		let endedResolve;
		const ended = new Promise((resolve) => {
			endedResolve = resolve;
		});

		const controller = new PlaybackController({
			segments: ["a", "b", "c"],
			driver,
			skipOnError: false,
			onSegmentStart: (i) => {
				events.starts.push(i);
				if (i === 0 && firstStartedResolve) {
					firstStartedResolve();
					firstStartedResolve = null;
				}
			},
			onStateChange: (s) => {
				events.states.push(s);
				if (s === "ended") endedResolve();
			},
		});

		controller.play();
		await firstStarted;

		controller.pause();
		assert.strictEqual(controller.state, "paused");

		controller.seekToSegment(2);
		assert.strictEqual(controller.state, "paused");

		controller.resume();
		await ended;

		assert.deepStrictEqual(events.starts, [0, 2]);
		assert.ok(events.states.includes("paused"));
		assert.ok(events.states.includes("playing"));
	});

	it("retries failed segments up to maxRetries", async function () {
		const events = { errors: [] };
		const { driver, state } = createFakeDriver({ defaultDuration: 5, failures: { 0: 2 } });

		let endedResolve;
		const ended = new Promise((resolve) => {
			endedResolve = resolve;
		});

		const controller = new PlaybackController({
			segments: ["a", "b"],
			driver,
			maxRetries: 2,
			skipOnError: false,
			onError: (i, e) => events.errors.push([i, e && e.message]),
			onStateChange: (s) => {
				if (s === "ended") endedResolve();
			},
		});

		controller.play();
		await ended;

		const playsFor0 = state.playCalls.filter((i) => i === 0).length;
		assert.strictEqual(playsFor0, 3);
		assert.deepStrictEqual(events.errors, []);
	});

	it("skips failed segments when skipOnError is enabled", async function () {
		const events = { starts: [], ends: [], errors: [] };
		const { driver, state } = createFakeDriver({ defaultDuration: 5, failures: { 1: 10 } });

		let endedResolve;
		const ended = new Promise((resolve) => {
			endedResolve = resolve;
		});

		const controller = new PlaybackController({
			segments: ["a", "b", "c"],
			driver,
			maxRetries: 1,
			skipOnError: true,
			onSegmentStart: (i) => events.starts.push(i),
			onSegmentEnd: (i) => events.ends.push(i),
			onError: (i, e) => events.errors.push([i, e && e.message]),
			onStateChange: (s) => {
				if (s === "ended") endedResolve();
			},
		});

		controller.play();
		await ended;

		assert.deepStrictEqual(events.errors.length, 1);
		assert.strictEqual(events.errors[0][0], 1);
		assert.ok(events.starts.includes(2));
		assert.ok(events.ends.includes(2));

		const playsFor1 = state.playCalls.filter((i) => i === 1).length;
		assert.strictEqual(playsFor1, 2);
	});

	it("stop cancels playback and transitions to stopped", async function () {
		const events = { states: [], starts: [] };
		const { driver } = createFakeDriver({ defaultDuration: 50 });

		const controller = new PlaybackController({
			segments: ["a", "b"],
			driver,
			skipOnError: false,
			onSegmentStart: (i) => {
				events.starts.push(i);
				setTimeout(() => controller.stop(), 5);
			},
			onStateChange: (s) => events.states.push(s),
		});

		controller.play();
		await sleep(80);

		assert.ok(events.states.includes("stopped"));
		assert.ok(!events.states.includes("ended"));
		assert.deepStrictEqual(events.starts, [0]);
	});
});
