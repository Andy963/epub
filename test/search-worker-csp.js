import assert from "assert";
import Book from "../src/book";

function setProp(obj, key, value) {
	try {
		obj[key] = value;
	} catch (e) {
		Object.defineProperty(obj, key, {
			value,
			configurable: true,
			writable: true,
		});
	}
}

describe("Book.createSearchWorker CSP", function () {
	it("uses searchWorkerUrl when provided (avoids blob: worker)", function () {
		const originalWorker = window.Worker;
		const originalCreateObjectURL = URL.createObjectURL;
		const originalRevokeObjectURL = URL.revokeObjectURL;

		try {
			let createObjectURLCalled = false;
			setProp(URL, "createObjectURL", () => {
				createObjectURLCalled = true;
				throw new Error("URL.createObjectURL should not be called when searchWorkerUrl is set");
			});
			setProp(URL, "revokeObjectURL", () => {
				throw new Error("URL.revokeObjectURL should not be called when searchWorkerUrl is set");
			});

			let workerUrl = null;
			function FakeWorker(url) {
				workerUrl = url;
				this.terminate = () => {};
			}
			setProp(window, "Worker", FakeWorker);

			const worker = Book.prototype.createSearchWorker.call({
				settings: { searchWorkerUrl: "https://example.invalid/search.worker.js" },
			});

			assert.ok(worker, "worker is returned");
			assert.equal(workerUrl, "https://example.invalid/search.worker.js");
			assert.equal(createObjectURLCalled, false);
		} finally {
			setProp(window, "Worker", originalWorker);
			setProp(URL, "createObjectURL", originalCreateObjectURL);
			setProp(URL, "revokeObjectURL", originalRevokeObjectURL);
		}
	});

	it("falls back to blob: worker when searchWorkerUrl is not set", function () {
		const originalWorker = window.Worker;
		const originalCreateObjectURL = URL.createObjectURL;
		const originalRevokeObjectURL = URL.revokeObjectURL;

		try {
			let createObjectURLCalled = false;
			let revokeObjectURLCalled = false;
			let createdWorkerUrl = null;

			setProp(URL, "createObjectURL", () => {
				createObjectURLCalled = true;
				return "blob:fake-worker-url";
			});
			setProp(URL, "revokeObjectURL", (url) => {
				revokeObjectURLCalled = true;
				assert.equal(url, "blob:fake-worker-url");
			});

			function FakeWorker(url) {
				createdWorkerUrl = url;
				this.terminate = () => {};
			}
			setProp(window, "Worker", FakeWorker);

			const worker = Book.prototype.createSearchWorker.call({
				settings: {},
			});

			assert.ok(worker, "worker is returned");
			assert.equal(createObjectURLCalled, true);
			assert.equal(revokeObjectURLCalled, true);
			assert.equal(createdWorkerUrl, "blob:fake-worker-url");
		} finally {
			setProp(window, "Worker", originalWorker);
			setProp(URL, "createObjectURL", originalCreateObjectURL);
			setProp(URL, "revokeObjectURL", originalRevokeObjectURL);
		}
	});
});

