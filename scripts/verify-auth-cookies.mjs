import assert from "node:assert/strict";

const base = process.argv[2];
assert.match(base ?? "", /^(http:\/\/127\.0\.0\.1:321[01]|https:\/\/ldcx\.tech)\/vibehard$/);
// No credentials or accounts are created. The actual HTTP response must preserve
// both path deletions after Next's response adapter and any reverse proxy.
const response = await fetch(`${base}/api/auth/logout`, {
  method: "POST", signal: AbortSignal.timeout(10_000),
});
assert.equal(response.status, 200);
const cookies = response.headers.getSetCookie();
assert.equal(cookies.length, 2, "Both path-specific Set-Cookie headers must reach the client");
for (const path of ["/", "/vibehard"]) {
  const cookie = cookies.find((value) => value.split(";").some((part) => part.trim() === `Path=${path}`));
  assert.ok(cookie, `Missing expiry for ${path}`);
  assert.ok(cookie.includes("Max-Age=0"));
  assert.ok(cookie.includes("HttpOnly"));
  assert.ok(cookie.includes("Secure"));
}
assert.match(response.headers.get("Cache-Control"), /no-store/);
console.log(JSON.stringify({ base, expiredCookiePaths: ["/", "/vibehard"], noCredentialsUsed: true }));
