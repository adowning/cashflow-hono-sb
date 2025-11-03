import { expect, test } from "vitest";

export function sum(a: number, b: number)
{
	return a + b;
}

test("adds 1 + 2 to equal 3", () =>
{
	expect(sum(1, 2)).toBe(3);
});

// Test commented out due to non-existent API endpoint
// it("test", async () => {
// 	const res = await testClient(app).api.iam.test.$get();
// 	const spectedUser = {
// 		id: "1",
// 		email: "test@gmail.com",
// 	};
// 	expect(await res.json()).toEqual(spectedUser);
// });
