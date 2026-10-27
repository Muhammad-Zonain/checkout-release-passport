#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function required(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

async function githubRequest(url, { method = "GET", token, body, fetchImpl = fetch }) {
  const response = await fetchImpl(url, {
    method,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "checkout-release-passport",
      "x-github-api-version": "2022-11-28",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!response.ok) {
    const message = parsed?.message ?? `HTTP ${response.status}`;
    throw new Error(`GitHub alert request failed: ${message}`);
  }
  return parsed;
}

export async function syncReviewAlert(alert, options = {}) {
  if (!alert || alert.kind !== "checkout-review-alert") {
    throw new Error("Alert file is not a checkout-review-alert payload");
  }
  const token = required(options.token ?? process.env.GITHUB_TOKEN, "GITHUB_TOKEN");
  const repository = required(options.repository ?? process.env.GITHUB_REPOSITORY, "GITHUB_REPOSITORY");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("GITHUB_REPOSITORY must use owner/repository format");
  }
  const apiUrl = (options.apiUrl ?? process.env.GITHUB_API_URL ?? "https://api.github.com").replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const issuesUrl = `${apiUrl}/repos/${repository}/issues`;
  const openIssues = await githubRequest(`${issuesUrl}?state=open&per_page=100`, {
    token,
    fetchImpl,
  });
  const existing = (Array.isArray(openIssues) ? openIssues : []).find(
    (issue) => !issue.pull_request && typeof issue.body === "string" && issue.body.includes(alert.issue_marker),
  );

  if (alert.action === "open_or_update") {
    if (!existing) {
      const created = await githubRequest(issuesUrl, {
        method: "POST",
        token,
        body: { title: alert.title, body: alert.body_markdown },
        fetchImpl,
      });
      return { operation: "created", issue_number: created.number, issue_url: created.html_url };
    }

    await githubRequest(`${issuesUrl}/${existing.number}/comments`, {
      method: "POST",
      token,
      body: { body: alert.body_markdown },
      fetchImpl,
    });
    const updated = await githubRequest(`${issuesUrl}/${existing.number}`, {
      method: "PATCH",
      token,
      body: { title: alert.title, body: alert.body_markdown },
      fetchImpl,
    });
    return { operation: "updated", issue_number: existing.number, issue_url: updated.html_url ?? existing.html_url };
  }

  if (alert.action === "resolve_if_open") {
    if (!existing) return { operation: "no_open_issue" };
    await githubRequest(`${issuesUrl}/${existing.number}/comments`, {
      method: "POST",
      token,
      body: { body: alert.body_markdown },
      fetchImpl,
    });
    const closed = await githubRequest(`${issuesUrl}/${existing.number}`, {
      method: "PATCH",
      token,
      body: { state: "closed", state_reason: "completed" },
      fetchImpl,
    });
    return { operation: "resolved", issue_number: existing.number, issue_url: closed.html_url ?? existing.html_url };
  }

  throw new Error(`Unsupported alert action: ${alert.action}`);
}

async function main() {
  const fileIndex = process.argv.indexOf("--file");
  const filePath = fileIndex >= 0 ? process.argv[fileIndex + 1] : null;
  if (!filePath) throw new Error("Missing --file <alert.json>");
  const alert = JSON.parse(await readFile(path.resolve(process.cwd(), filePath), "utf8"));
  const result = await syncReviewAlert(alert);
  console.log(`GitHub alert: ${result.operation}${result.issue_number ? ` (#${result.issue_number})` : ""}`);
}

const executedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (executedDirectly) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}
