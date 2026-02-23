import { defer, requestAnimationFrame } from "./core";
import type { Deferred } from "./core";

type QueueTask = (...args: any[]) => any;

type QueuedFunctionTask = {
	task: QueueTask;
	args: any[];
	deferred: Deferred<any>;
	promise: Promise<any>;
};

type QueuedPromiseTask = {
	promise: Promise<any>;
};

type QueueItem = QueuedFunctionTask | QueuedPromiseTask;

function isThenable(value: any): value is { then: (...args: any[]) => any } {
	return !!value && typeof value.then === "function";
}

function isQueuedFunctionTask(item: QueueItem): item is QueuedFunctionTask {
	return typeof (item as any).task === "function";
}

/**
 * Queue for handling tasks one at a time
 * @class
 * @param {scope} context what this will resolve to in the tasks
 */
class Queue {
	_q: QueueItem[];
	context: any;
	tick: typeof requestAnimationFrame;
	running: Promise<any> | boolean | undefined;
	paused: boolean;
	deferred: Deferred<void> | undefined;

	constructor(context: any) {
		this._q = [];
		this.context = context;
		this.tick = requestAnimationFrame;
		this.running = false;
		this.paused = false;
		this.deferred = undefined;
	}

	/**
	 * Add an item to the queue
	 * @return {Promise}
	 */
	enqueue(task: any, ...args: any[]): Promise<any> {
		if (!task) {
			throw new Error("No Task Provided");
		}

		let queued: QueueItem;
		if (typeof task === "function") {
			const deferred: Deferred<any> = new defer();
			queued = {
				task: task,
				args: args,
				deferred: deferred,
				promise: deferred.promise,
			};
		} else {
			// Task is a promise
			queued = {
				promise: task,
			};
		}

		this._q.push(queued);

		// Wait to start queue flush
		if (this.paused === false && !this.running) {
			this.run();
		}

		return queued.promise;
	}

	/**
	 * Run one item
	 * @return {Promise}
	 */
	dequeue(): Promise<any> {
		if (this._q.length && !this.paused) {
			const inwait = this._q.shift();
			if (!inwait) {
				const idle: Deferred<void> = new defer();
				idle.resolve();
				return idle.promise;
			}

			if (isQueuedFunctionTask(inwait)) {
				const result = inwait.task.apply(this.context, inwait.args);

				if (isThenable(result)) {
					// Task is a function that returns a promise
					return result.then(
						(...values: any[]) => {
							inwait.deferred.resolve(values[0]);
						},
						(...reasons: any[]) => {
							inwait.deferred.reject(reasons[0]);
						}
					);
				}

				// Task resolves immediately
				inwait.deferred.resolve(result);
				return inwait.promise;
			}

			if (inwait.promise) {
				// Task is a promise
				return inwait.promise;
			}
		}

		const idle: Deferred<void> = new defer();
		idle.resolve();
		return idle.promise;
	}

	// Run All Immediately
	dump(): void {
		while (this._q.length) {
			this.dequeue();
		}
	}

	private schedule(fn: () => void): void {
		if (typeof this.tick === "function") {
			const win = typeof window !== "undefined" ? window : undefined;
			try {
				this.tick.call(win, fn);
				return;
			} catch (e) {
				// Fall back to setTimeout below
			}
		}
		setTimeout(fn, 0);
	}

	/**
	 * Run all tasks sequentially, at convince
	 * @return {Promise}
	 */
	run(): Promise<void> {
		if (!this.running) {
			this.running = true;
			this.deferred = new defer();
		}

		this.schedule(() => {
			if (this._q.length) {
				this.dequeue().then(
					() => {
						this.run();
					},
					(error) => {
						if (this.deferred) {
							this.deferred.reject(error);
						}
						this.running = undefined;
					}
				);
				return;
			}

			if (this.deferred) {
				this.deferred.resolve();
			}
			this.running = undefined;
		});

		// Unpause
		if (this.paused === true) {
			this.paused = false;
		}

		return this.deferred ? this.deferred.promise : Promise.resolve();
	}

	/**
	 * Flush all, as quickly as possible
	 * @return {Promise}
	 */
	flush(): Promise<any> | boolean | undefined {
		if (this.running) {
			return this.running;
		}

		if (this._q.length) {
			this.running = this.dequeue().then(() => {
				this.running = undefined;
				return this.flush();
			});

			return this.running;
		}

		return undefined;
	}

	/**
	 * Clear all items in wait
	 */
	clear(): void {
		this._q = [];
	}

	/**
	 * Get the number of tasks in the queue
	 * @return {number} tasks
	 */
	length(): number {
		return this._q.length;
	}

	/**
	 * Pause a running queue
	 */
	pause(): void {
		this.paused = true;
	}

	/**
	 * End the queue
	 */
	stop(): void {
		this._q = [];
		this.running = false;
		this.paused = true;
	}
}

/**
 * Create a new task from a callback
 * @class
 * @private
 * @param {function} task
 * @param {array} args
 * @param {scope} context
 * @return {function} task
 */
class Task {
	constructor(task: QueueTask, args: any[], context: any) {
		return function (this: any) {
			const toApply = Array.prototype.slice.call(arguments) as any[];

			return new Promise((resolve, reject) => {
				const callback = function (value: any, err: any) {
					if (!value && err) {
						reject(err);
					} else {
						resolve(value);
					}
				};
				// Add the callback to the arguments list
				toApply.push(callback);

				// Apply all arguments to the functions
				task.apply(context || this, toApply);
			});
		} as any;
	}
}

export default Queue;
export { Task };
