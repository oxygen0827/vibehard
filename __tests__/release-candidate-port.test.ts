import { expect, it } from "vitest";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
it("runs all read-only BOM guards on the dedicated loopback candidate port", async () => {
  const paths: string[] = [];
  const server = createServer((request, response) => {
    paths.push(request.url!);
    if (request.url === "/vibehard/login") response.writeHead(200);
    else if (request.url === "/vibehard/app/bom") response.writeHead(307, { location: "/vibehard/login" });
    else response.writeHead(401);
    response.end();
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(3217, "127.0.0.1", resolve); });
  try {
    const result = await execute(process.execPath, ["scripts/verify-bom-release.mjs", "http://127.0.0.1:3217"]);
    expect(JSON.parse(result.stdout)).toMatchObject({ login: 200, bomAnonymousRedirect: 307, bomApiAnonymous: 401 });
    expect(paths).toHaveLength(4);
    await expect(execute(process.execPath, ["scripts/verify-bom-release.mjs", "http://127.0.0.1:3218"])).rejects.toThrow();
    expect(paths).toHaveLength(4);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
