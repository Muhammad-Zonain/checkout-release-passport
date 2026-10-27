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
        "content-security-policy": "default-src 'self'; script-src 'nonce-must-not-be-stored'; report-uri https://reports.example/csp?token=must-not-be-stored",
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
  assert.equal(snapshot.engine.version, "0.4.1");
  assert.equal(snapshot.page.title, "Test Checkout");
  assert.equal(snapshot.scripts.length, 1);
  assert.match(snapshot.scripts[0].src, /token=%3Credacted%3E/);
  assert.equal(snapshot.scripts[0].response_status, 200);
  assert.match(snapshot.scripts[0].content_sha256, /^[a-f0-9]{64}$/);

  const serialized = JSON.stringify(snapshot);
  assert.equal(serialized.includes("must-not-be-stored"), false);
  assert.equal(serialized.includes("set-cookie"), false);
  assert.equal(snapshot.page.security_headers["content-security-policy"].includes("nonce-<redacted>"), true);
  assert.equal(snapshot.page.security_headers["content-security-policy"].includes("token=<redacted>"), true);
});

test("redacted URL hashes do not depend on query values", async (context) => {
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/checkout") {
      response.writeHead(200, { "content-type": "text/html" });
      // Serve only fixed test fixtures; never reflect request data into HTML.
      if (url.searchParams.get("token") === "first-secret") {
        response.end('<!doctype html><script src="/sdk.js?token=first-secret"></script>');
      } else if (url.searchParams.get("token") === "second-secret") {
        response.end('<!doctype html><script src="/sdk.js?token=second-secret"></script>');
      } else {
        response.writeHead(400).end("Unsupported test token");
      }
      return;
    }
    if (url.pathname === "/sdk.js") {
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end("window.sdkLoaded = true;");
      return;
    }
    response.writeHead(404).end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const { port } = server.address();
  const baseConfig = {
    target_id: "redacted-hash-test",
    name: "Redacted Hash Test",
    authorization: {
      confirmed: true,
      confirmed_by: "Test owner",
      confirmed_at: "2026-08-15",
      scope_note: "In-process local test server owned by the test runner",
    },
    scan: {
      mode: "static",
      timeout_ms: 5000,
      wait_until: "networkidle",
      post_load_wait_ms: 0,
    },
  };

  const first = await scanPage({
    ...baseConfig,
    url: `http://127.0.0.1:${port}/checkout?token=first-secret`,
  });
  const second = await scanPage({
    ...baseConfig,
    url: `http://127.0.0.1:${port}/checkout?token=second-secret`,
  });

  assert.equal(first.target.requested_url_sha256, second.target.requested_url_sha256);
  assert.equal(first.page.final_url_sha256, second.page.final_url_sha256);
  assert.equal(first.scripts[0].src_sha256, second.scripts[0].src_sha256);
});

test("static scanner blocks a main-document redirect outside authorized origins", async (context) => {
  const destination = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><title>Outside scope</title>");
  });
  destination.listen(0, "127.0.0.1");
  await once(destination, "listening");
  context.after(() => new Promise((resolve) => destination.close(resolve)));

  const destinationPort = destination.address().port;
  const redirector = createServer((_request, response) => {
    response.writeHead(302, { location: `http://127.0.0.1:${destinationPort}/outside` });
    response.end();
  });
  redirector.listen(0, "127.0.0.1");
  await once(redirector, "listening");
  context.after(() => new Promise((resolve) => redirector.close(resolve)));

  const redirectorPort = redirector.address().port;
  await assert.rejects(
    () => scanPage({
      target_id: "redirect-test",
      name: "Redirect Test",
      url: `http://127.0.0.1:${redirectorPort}/checkout`,
      authorization: {
        confirmed: true,
        confirmed_by: "Test owner",
        confirmed_at: "2026-08-11",
        scope_note: "Only the redirecting local origin is authorized for this test",
        allowed_navigation_origins: [`http://127.0.0.1:${redirectorPort}`],
      },
      scan: {
        mode: "static",
        timeout_ms: 5000,
        wait_until: "networkidle",
        post_load_wait_ms: 0,
      },
    }),
    /left the authorized origins/,
  );
});
