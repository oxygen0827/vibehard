import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

// Developer-only static page. No native USB/ADB access, API, database or upload.
const port = Number(process.env.WEBUSB_PROBE_PORT || 3214);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid port");
const html = await readFile(new URL("../tools/webusb-probe/index.html", import.meta.url));
const bundle = await build({ entryPoints: [new URL("../tools/webusb-probe/client.ts", import.meta.url).pathname], bundle: true, write: false, platform: "browser", format: "esm", target: "chrome120" });
const server = createServer((req, res) => {
  if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`) { res.writeHead(403).end(); return; }
  const resource = req.url === "/" ? html : req.url === "/client.js" ? bundle.outputFiles[0].contents : undefined;
  if (req.method !== "GET" || !resource) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "Content-Type": req.url === "/" ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Permissions-Policy": "usb=(self)", "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" }).end(resource);
});
server.listen(port, "127.0.0.1", () => console.log(`Read-only WebUSB probe: http://127.0.0.1:${port}`));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit()));
