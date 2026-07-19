function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shortHash(value) {
  return value ? `${value.slice(0, 12)}…` : "Unavailable";
}

function display(value) {
  return value === null || value === undefined || value === "" ? "—" : value;
}

function scriptLabel(script) {
  return script.kind === "external" ? script.src : `Inline script #${script.dom_index}`;
}

function renderRows(rows, emptyMessage, columns) {
  if (!rows.length) {
    return `<p class="empty">${escapeHtml(emptyMessage)}</p>`;
  }

  return `<div class="table-wrap"><table><thead><tr>${columns
    .map((column) => `<th>${escapeHtml(column.label)}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr>${columns
          .map((column) => `<td>${column.render ? column.render(row) : escapeHtml(display(row[column.key]))}</td>`)
          .join("")}</tr>`,
    )
    .join("")}</tbody></table></div>`;
}

function renderChangeList(title, scripts, emptyMessage) {
  const columns = [
    { label: "Script", render: (row) => `<code>${escapeHtml(scriptLabel(row))}</code>` },
    { label: "Kind", key: "kind" },
    { label: "Content hash", render: (row) => `<code>${escapeHtml(shortHash(row.content_sha256))}</code>` },
  ];
  return `<section><h2>${escapeHtml(title)}</h2>${renderRows(scripts, emptyMessage, columns)}</section>`;
}

export function generateHtmlReport(config, baseline, current, comparison) {
  const statusClass = comparison.status === "PASS" ? "pass" : "review";
  const inventoryColumns = [
    { label: "Script", render: (row) => `<code>${escapeHtml(scriptLabel(row))}</code>` },
    { label: "Party", render: (row) => (row.first_party ? "First party" : "Third party") },
    { label: "Content hash", render: (row) => `<code>${escapeHtml(shortHash(row.content_sha256))}</code>` },
    {
      label: "Approval",
      render: (row) =>
        row.approval.status === "approved"
          ? `<span class="pill approved">Approved</span><br><small>${escapeHtml(row.approval.owner)} · ${escapeHtml(row.approval.purpose)}</small>`
          : '<span class="pill unapproved">Unapproved</span>',
    },
  ];
  const modifiedRows = comparison.scripts.modified.map((entry) => ({
    script: scriptLabel(entry.after),
    before: shortHash(entry.before.content_sha256),
    after: shortHash(entry.after.content_sha256),
  }));
  const headerRows = comparison.security_headers.changed;
  const originRows = comparison.network_origins.current;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(config.name)} evidence report</title>
  <style>
    :root { color-scheme: light; --ink:#18212f; --muted:#64748b; --line:#dbe3ec; --bg:#f6f8fb; --card:#fff; --green:#0f7a4d; --green-bg:#e8f7ef; --amber:#9a4b00; --amber-bg:#fff4dd; --red:#a82222; --red-bg:#fff0f0; }
    * { box-sizing: border-box; }
    body { margin:0; font:14px/1.5 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:var(--ink); background:var(--bg); }
    main { width:min(1120px,calc(100% - 32px)); margin:32px auto 64px; }
    header, section { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:22px; margin-bottom:16px; box-shadow:0 4px 18px rgba(24,33,47,.04); }
    h1 { margin:0 0 8px; font-size:28px; } h2 { margin:0 0 14px; font-size:18px; } p { margin:6px 0; }
    .muted, small { color:var(--muted); } code { overflow-wrap:anywhere; font-size:12px; }
    .status { display:inline-block; border-radius:999px; padding:7px 12px; font-weight:750; letter-spacing:.03em; }
    .status.pass { color:var(--green); background:var(--green-bg); } .status.review { color:var(--amber); background:var(--amber-bg); }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; margin-top:18px; }
    .metric { border:1px solid var(--line); border-radius:10px; padding:13px; } .metric strong { display:block; font-size:24px; }
    .table-wrap { overflow-x:auto; } table { width:100%; border-collapse:collapse; } th,td { text-align:left; vertical-align:top; padding:10px; border-bottom:1px solid var(--line); } th { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
    .pill { display:inline-block; border-radius:999px; padding:3px 8px; font-size:12px; font-weight:700; } .approved { color:var(--green); background:var(--green-bg); } .unapproved { color:var(--red); background:var(--red-bg); }
    .empty { color:var(--muted); font-style:italic; } .notice { border-left:4px solid var(--amber); padding-left:12px; }
    dl { display:grid; grid-template-columns:max-content 1fr; gap:7px 14px; } dt { color:var(--muted); } dd { margin:0; overflow-wrap:anywhere; }
    @media (max-width:640px) { main { width:min(100% - 18px,1120px); margin-top:10px; } header,section { padding:16px; } dl { grid-template-columns:1fr; gap:2px; } dd { margin-bottom:8px; } }
  </style>
</head>
<body><main>
  <header>
    <span class="status ${statusClass}">${escapeHtml(comparison.status)}</span>
    <h1>${escapeHtml(config.name)}</h1>
    <p class="muted">Authorized script inventory and change-evidence report</p>
    <div class="grid">
      ${Object.entries(comparison.summary).map(([label, value]) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label.replaceAll("_", " "))}</span></div>`).join("")}
    </div>
  </header>

  <section>
    <h2>Evidence identity</h2>
    <dl>
      <dt>Target</dt><dd>${escapeHtml(current.target.requested_url)}</dd>
      <dt>Captured</dt><dd>${escapeHtml(current.captured_at)}</dd>
      <dt>Capture mode</dt><dd>${escapeHtml(current.engine.capture_mode)} · ${escapeHtml(current.engine.behavior)}</dd>
      <dt>Baseline digest</dt><dd><code>${escapeHtml(baseline.snapshot_sha256)}</code></dd>
      <dt>Current digest</dt><dd><code>${escapeHtml(current.snapshot_sha256)}</code></dd>
      <dt>Authorization</dt><dd>${escapeHtml(current.target.authorization.confirmed_by)} · ${escapeHtml(current.target.authorization.confirmed_at)} · ${escapeHtml(current.target.authorization.scope_note)}</dd>
      <dt>Review reasons</dt><dd>${comparison.review_reasons.length ? comparison.review_reasons.map(escapeHtml).join(", ") : "None"}</dd>
    </dl>
  </section>

  ${renderChangeList("Added scripts", comparison.scripts.added, "No scripts were added.")}
  ${renderChangeList("Removed scripts", comparison.scripts.removed, "No scripts were removed.")}
  <section><h2>Modified scripts</h2>${renderRows(modifiedRows, "No scripts were modified.", [
    { label: "Script", key: "script" },
    { label: "Before", render: (row) => `<code>${escapeHtml(row.before)}</code>` },
    { label: "After", render: (row) => `<code>${escapeHtml(row.after)}</code>` },
  ])}</section>

  <section><h2>Security-header changes</h2>${renderRows(headerRows, "No stored security headers changed.", [
    { label: "Header", key: "name" },
    { label: "Before", render: (row) => `<code>${escapeHtml(display(row.before))}</code>` },
    { label: "After", render: (row) => `<code>${escapeHtml(display(row.after))}</code>` },
  ])}</section>

  <section><h2>Current script inventory</h2>${renderRows(comparison.scripts.current, "No script elements were observed.", inventoryColumns)}</section>
  <section><h2>Observed network origins</h2>${renderRows(originRows, "No HTTP(S) network origins were observed.", [
    { label: "Origin", render: (row) => `<code>${escapeHtml(row.origin)}</code>` },
    { label: "Party", render: (row) => (row.first_party ? "First party" : "Third party") },
    { label: "Requests", key: "request_count" },
    { label: "Resource types", render: (row) => escapeHtml(row.resource_types.join(", ")) },
  ])}</section>

  <section class="notice">
    <h2>Scope and limitations</h2>
    <p>This report supports evidence collection; it is not a PCI DSS certification, legal opinion, penetration test, or guarantee of security.</p>
    <p>The engine does not click, fill, submit, authenticate, purchase, exploit, or retain response bodies, cookies, form values, or URL query values.</p>
    <p>${current.engine.capture_mode === "static" ? "Static mode does not execute JavaScript. Dynamically injected scripts, runtime requests, and scripts loaded only after interaction are outside this report and require separately authorized browser-mode coverage." : "Dynamic scripts that load only after user interaction may require a separately authorized and reviewed future workflow."}</p>
  </section>
</main></body></html>`;
}

export { escapeHtml };
