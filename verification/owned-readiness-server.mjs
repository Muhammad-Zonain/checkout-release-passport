import { createServer } from "node:http";
import { once } from "node:events";

// Loopback-only fixture. Never connects to a merchant or payment provider.
export async function startReadinessServer() {
  let state = "healthy";
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/checkout" && state === "timeout") return;
    if (url.pathname === "/checkout" && state === "redirect") {
      response.writeHead(302, { location: "/login?session=private-test-value" }).end();
      return;
    }
    if (url.pathname === "/app.js") {
      response.writeHead(200, { "content-type": "text/javascript" }).end("window.fixtureLoaded = true;");
      return;
    }
    const status = state === "http500" ? 500 : state === "http404" ? 404 : 200;
    response.writeHead(status, { "content-type": "text/html" });
    const marker = state === "missing" ? "" : `<main id="checkout-ready"${state === "hidden" ? " hidden" : ""}>Owned fixture</main>`;
    response.end(`<!doctype html><title>Owned fixture</title>${marker}<script src="/app.js"></script>${state === "late-redirect" && url.pathname === "/checkout" ? '<script>setTimeout(() => location.assign("/login"), 20)</script>' : ""}`);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin,
    setState(value) { state = value; },
    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
    config(mode = "static") {
      return {
        target_id: "readiness-fixture",
        name: "Owned readiness fixture",
        url: `${origin}/checkout`,
        authorization: { confirmed: true, confirmed_by: "Fixture owner", confirmed_at: "2026-09-27", scope_note: "Owned loopback-only automated regression fixture" },
        capture_expectations: { expected_final_url: `${origin}/checkout`, ready_element_id: "checkout-ready" },
        scan: { mode, timeout_ms: 1000, wait_until: "load", post_load_wait_ms: mode === "browser" ? 100 : 0 },
      };
    },
  };
}
