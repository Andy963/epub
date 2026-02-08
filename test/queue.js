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
});

