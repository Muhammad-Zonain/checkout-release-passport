import test from "node:test";
import assert from "node:assert/strict";
import { syncReviewAlert } from "../src/github-alert.js";

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function alert(action = "open_or_update") {
  return {
    kind: "checkout-review-alert",
    action,
    issue_marker: "<!-- checkout-release-passport-alert:demo -->",
    title: "Checkout review",
    body_markdown: "Evidence body",
  };
}

test("GitHub notifier creates an issue when no matching alert issue is open", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (options.method === "GET") return jsonResponse([]);
    return jsonResponse({ number: 7, html_url: "https://github.com/owner/repo/issues/7" }, 201);
  };
  const result = await syncReviewAlert(alert(), {
    token: "test-token",
    repository: "owner/repo",
    fetchImpl,
  });
  assert.equal(result.operation, "created");
  assert.equal(result.issue_number, 7);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.method, "POST");
  assert.equal(calls[1].options.headers.authorization, "Bearer test-token");
});

test("GitHub notifier comments and closes a matching issue after recovery", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (options.method === "GET") {
      return jsonResponse([{
        number: 3,
        body: "<!-- checkout-release-passport-alert:demo -->",
        html_url: "https://github.com/owner/repo/issues/3",
      }]);
    }
    return jsonResponse({ number: 3, html_url: "https://github.com/owner/repo/issues/3" });
  };
  const result = await syncReviewAlert(alert("resolve_if_open"), {
    token: "test-token",
    repository: "owner/repo",
    fetchImpl,
  });
  assert.equal(result.operation, "resolved");
  assert.equal(calls.length, 3);
  assert.match(calls[1].url, /\/comments$/);
  assert.deepEqual(JSON.parse(calls[2].options.body), { state: "closed", state_reason: "completed" });
});
