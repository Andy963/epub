import assert from "assert";
import Queue from "../src/utils/queue";

describe("Queue", function () {
	it("resolves sync task return value", function () {
		const queue = new Queue({});
		queue.running = true;

		const taskPromise = queue.enqueue(() => 123);
		assert.doesNotThrow(() => {
			queue.dequeue();
		});

		return taskPromise.then((value) => {
			assert.equal(value, 123);
		});
	});

	it("runs without requestAnimationFrame", function () {
		const queue = new Queue({});
		queue.tick = false;

		let taskPromise;
		assert.doesNotThrow(() => {
			taskPromise = queue.enqueue(() => 123);
		});

		return taskPromise.then((value) => {
			assert.equal(value, 123);
		});
	});
});
