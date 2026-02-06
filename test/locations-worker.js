import assert from "assert";
import Locations from "../src/locations";

describe("Locations worker integration", function () {
	it("resolves pending worker requests", async function () {
		const locations = new Locations();
		let captured;
		const worker = {
			postMessage(message) {
				captured = message;
			}
		};

		locations.attachWorker(worker);
		const pending = locations.sendWorkerRequest(worker, {
			type: "parse",
			xhtml: "<html></html>",
			cfiBase: "/6/4[chap01ref]",
			chars: 100
		});

		assert(captured);
		locations.handleWorkerMessage({
			data: {
				id: captured.id,
				locations: ["a", "b"]
			}
		});

		const result = await pending;
		assert.deepEqual(result, ["a", "b"]);
	});

	it("rejects pending worker requests on error response", async function () {
		const locations = new Locations();
		let captured;
		const worker = {
			postMessage(message) {
				captured = message;
			}
		};

		locations.attachWorker(worker);
		const pending = locations.sendWorkerRequest(worker, {
			type: "parse",
			xhtml: "<html></html>",
			cfiBase: "/6/4[chap01ref]",
			chars: 100
		});

		assert(captured);
		locations.handleWorkerMessage({
			data: {
				id: captured.id,
				error: "boom"
			}
		});

		try {
			await pending;
			assert.fail("expected worker request to reject");
		} catch (error) {
			assert.equal(error.message, "boom");
		}
	});
});

