import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../examples/demo-site");
const versionIndex = process.argv.indexOf("--version");
const version = versionIndex >= 0 ? process.argv[versionIndex + 1] : "1";

if (!["1", "2"].includes(version)) {
  console.error("Usage: node scripts/demo-server.js --version 1|2");
  process.exit(1);
}

const routes = new Map([
  ["/", { file: `checkout-v${version}.html`, type: "text/html; charset=utf-8" }],
  ["/checkout.html", { file: `checkout-v${version}.html`, type: "text/html; charset=utf-8" }],
  ["/static/payment-sdk.js", { file: "static/payment-sdk.js", type: "text/javascript; charset=utf-8" }],
  ["/static/storefront.js", { file: `static/storefront-v${version}.js`, type: "text/javascript; charset=utf-8" }],
  ["/static/support-widget.js", { file: "static/support-widget.js", type: "text/javascript; charset=utf-8" }],
]);

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  const route = routes.get(pathname);
  if (!route || (pathname === "/static/support-widget.js" && version === "1")) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  try {
    const body = await readFile(path.join(root, route.file));
    const contentSecurityPolicy =
      version === "1"
        ? "default-src 'self'; script-src 'self'"
        : "default-src 'self'; script-src 'self'; connect-src 'self'";
    response.writeHead(200, {
      "content-type": route.type,
      "cache-control": "no-store",
      "content-security-policy": contentSecurityPolicy,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end(`Local demo error: ${error.message}`);
  }
});

server.listen(4173, "127.0.0.1", () => {
  console.log(`Safe local demo v${version}: http://127.0.0.1:4173/checkout.html`);
  console.log("Press Ctrl+C to stop.");
});

process.on("SIGINT", () => server.close(() => process.exit(0)));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
