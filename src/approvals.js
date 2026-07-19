import { readFile } from "node:fs/promises";

function isExpired(approval, now = new Date()) {
  if (!approval.expires_at) {
    return false;
  }
  const expiry = new Date(`${approval.expires_at}T23:59:59.999Z`);
  return Number.isNaN(expiry.valueOf()) || expiry < now;
}

function matches(script, approval) {
  if (approval.kind !== script.kind) {
    return false;
  }

  const candidate = script.kind === "external" ? script.src : script.content_sha256;
  if (!candidate) {
    return false;
  }

  if (approval.match_type === "prefix") {
    return candidate.startsWith(approval.match);
  }

  return candidate === approval.match;
}

export async function loadApprovals(filePath, targetId) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return { schema_version: "1.0", target_id: targetId, approvals: [] };
    }
    throw error;
  }

  if (parsed.target_id !== targetId) {
    throw new Error(`Approvals target_id ${parsed.target_id} does not match ${targetId}`);
  }
  if (!Array.isArray(parsed.approvals)) {
    throw new Error("Approvals file must contain an approvals array");
  }

  return parsed;
}

export function evaluateScriptApprovals(scripts, approvalDocument, now = new Date()) {
  return scripts.map((script) => {
    const approval = approvalDocument.approvals.find(
      (candidate) => !isExpired(candidate, now) && matches(script, candidate),
    );

    return {
      ...script,
      approval: approval
        ? {
            status: "approved",
            approval_id: approval.approval_id,
            owner: approval.owner,
            purpose: approval.purpose,
            approved_by: approval.approved_by,
            approved_at: approval.approved_at,
            expires_at: approval.expires_at ?? null,
          }
        : { status: "unapproved" },
    };
  });
}

export function buildApprovalTemplate(snapshot) {
  return {
    schema_version: "1.0",
    target_id: snapshot.target.target_id,
    instructions: "Review every entry. Fill owner, purpose, approved_by, and approved_at before treating it as approved.",
    approvals: snapshot.scripts.map((script, index) => ({
      approval_id: `review-${String(index + 1).padStart(3, "0")}`,
      kind: script.kind,
      match_type: "exact",
      match: script.kind === "external" ? script.src : script.content_sha256,
      owner: "REVIEW_REQUIRED",
      purpose: "REVIEW_REQUIRED",
      approved_by: "REVIEW_REQUIRED",
      approved_at: "YYYY-MM-DD",
      expires_at: null,
    })),
  };
}
