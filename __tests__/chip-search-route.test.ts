// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/chips/search/route";
import { createUser } from "@/lib/server/store";
import { createSessionToken } from "@/lib/server/security";
import { searchChipWeb } from "@/lib/server/chip-resource-search";

vi.mock("@/lib/server/chip-resource-search", () => ({ searchChipWeb: vi.fn(), ChipWebSearchError: class extends Error {} }));
beforeEach(() => vi.mocked(searchChipWeb).mockReset());

const request = (cookie = "", body: unknown = { model: "RV1106" }) => new NextRequest("https://example.test/api/chips/search", {
  method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(body),
});
async function session(role: "admin" | "member") {
  const user = await createUser({ email: `${crypto.randomUUID()}@example.invalid`, passwordHash: "test", inviteCode: "test" });
  user.role = role;
  return `vibehard_session=${createSessionToken(user)}`;
}

it("requires a reviewer role before contacting the web provider", async () => {
  expect((await POST(request())).status).toBe(401);
  expect((await POST(request(await session("member")))).status).toBe(403);
  expect(searchChipWeb).not.toHaveBeenCalled();
});

it("validates the model and returns live search leads without storing them", async () => {
  const cookie = await session("admin");
  expect((await POST(request(cookie, { model: "" }))).status).toBe(400);
  expect((await POST(request(cookie, { model: "R".repeat(600) }))).status).toBe(400);
  vi.mocked(searchChipWeb).mockResolvedValue([{ title: "RV1106 Datasheet", url: "https://vendor.example/rv1106",
    host: "vendor.example", description: "", kind: "数据手册", source: "其他来源" }]);
  const response = await POST(request(cookie));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toMatchObject({ model: "RV1106", results: [{ title: "RV1106 Datasheet" }] });
  expect(searchChipWeb).toHaveBeenCalledWith("RV1106", expect.any(AbortSignal));
});
