import assert from "assert";

import ResourceCache from "../src/core/resource-cache";

describe("ResourceCache", function () {
	it("should ref-count entries per parent", async function () {
		const revoked = [];
		const cache = new ResourceCache({
			revoke: (value) => revoked.push(value)
		});

		const create = async () => "blob:resource";
		await cache.acquire("a", "p1", create);
		await cache.acquire("a", "p1", create);
		await cache.acquire("a", "p2", create);

		cache.releaseParent("p1");
		assert.equal(revoked.length, 0, "should not revoke while still referenced");

		cache.releaseParent("p2");
		assert.deepEqual(revoked, ["blob:resource"]);
	});

	it("should release children when parent is released", async function () {
		const revoked = [];
		const cache = new ResourceCache({
			revoke: (value) => revoked.push(value)
		});

		await cache.acquire("a", "p", async () => "blob:a");
		await cache.acquire("b", "a", async () => "blob:b");

		cache.releaseParent("p");
		assert.deepEqual(revoked.sort(), ["blob:a", "blob:b"]);
	});

	it("should release a single child without affecting siblings", async function () {
		const revoked = [];
		const cache = new ResourceCache({
			revoke: (value) => revoked.push(value),
		});

		await cache.acquire("a", "p", async () => "blob:a");
		await cache.acquire("b", "p", async () => "blob:b");

		cache.releaseChild("p", "a");
		assert.deepEqual(revoked, ["blob:a"]);

		cache.releaseParent("p");
		assert.deepEqual(revoked.sort(), ["blob:a", "blob:b"]);
	});
});
