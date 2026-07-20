import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { scanPage } from "../src/scanner.js";

test("static scanner captures declared scripts without retaining query values or cookies", async (context) => {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    if (pathname === "/checkout") {
      response.writeHead(200, {
        "content-type": "text/html",
        "content-security-policy": "default-src 'self'",
        "set-cookie": "session=must-not-be-stored",
      });
      response.end('<!doctype html><title>Test Checkout</title><script defer src="/sdk.js?token=must-not-be-stored"></script>');
    } else if (pathname === "/sdk.js") {
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end("document.documentElement.dataset.test = 'loaded';");
    } else {
      response.writeHead(404).end();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const { port } = server.address();
  const snapshot = await scanPage({
    target_id: "scanner-test",
    name: "Scanner Test",
    url: `http://127.0.0.1:${port}/checkout`,
    authorization: {
      confirmed: true,
      confirmed_by: "Test owner",
      confirmed_at: "2026-07-18",
      scope_note: "In-process local test server owned by the test runner",
    },
    scan: {
      mode: "static",
      timeout_ms: 5000,
      wait_until: "networkidle",
      post_load_wait_ms: 0,
    },
  });

  assert.equal(snapshot.engine.capture_mode, "static");
  assert.equal(snapshot.engine.version, "0.3.0");
  assert.equal(snapshot.page.title, "Test Checkout");
  assert.equal(snapshot.scripts.length, 1);
  assert.match(snapshot.scripts[0].src, /token=%3Credacted%3E/);
  assert.equal(snapshot.scripts[0].response_status, 200);
  assert.match(snapshot.scripts[0].content_sha256, /^[a-f0-9]{64}$/);

  const serialized = JSON.stringify(snapshot);
  assert.equal(serialized.includes("must-not-be-stored"), false);
  assert.equal(serialized.includes("set-cookie"), false);
});
