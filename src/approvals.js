import { readFile } from "node:fs/promises";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PLACEHOLDER_VALUES = new Set(["REVIEW_REQUIRED", "YYYY-MM-DD"]);

function requiredText(value, field, minimumLength = 1) {
  if (
    typeof value !== "string" ||
    value.trim().length < minimumLength ||
    value.trim().length > 500 ||
    PLACEHOLDER_VALUES.has(value.trim())
  ) {
    throw new Error(`Invalid approval: ${field} must be completed`);
  }
}

function validDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isExpired(approval, now = new Date()) {
  if (!approval.expires_at) {
    return false;
  }
  const expiry = new Date(`${approval.expires_at}T23:59:59.999Z`);
  return Number.isNaN(expiry.valueOf()) || expiry < now;
}

function isNotYetEffective(approval, now = new Date()) {
  const effective = new Date(`${approval.approved_at}T00:00:00.000Z`);
  return !Number.isNaN(effective.valueOf()) && effective > now;
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

export function validateApprovalDocument(parsed, targetId) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Approvals file root must be an object");
  }
  if (parsed.target_id !== targetId) {
    throw new Error(`Approvals target_id ${parsed.target_id} does not match ${targetId}`);
  }
  if (!["1.0", "1.1"].includes(parsed.schema_version)) {
    throw new Error("Approvals schema_version must be 1.0 or 1.1");
  }
  if (!Array.isArray(parsed.approvals)) {
    throw new Error("Approvals file must contain an approvals array");
  }

  const identifiers = new Set();
  for (const approval of parsed.approvals) {
    if (!approval || typeof approval !== "object" || Array.isArray(approval)) {
      throw new Error("Invalid approval: every approvals entry must be an object");
    }
    requiredText(approval.approval_id, "approval_id");
    if (identifiers.has(approval.approval_id)) {
      throw new Error(`Invalid approval: duplicate approval_id ${approval.approval_id}`);
    }
    identifiers.add(approval.approval_id);

    if (!["external", "inline"].includes(approval.kind)) {
      throw new Error(`Invalid approval ${approval.approval_id}: kind must be external or inline`);
    }
    if (!["exact", "prefix"].includes(approval.match_type)) {
      throw new Error(`Invalid approval ${approval.approval_id}: match_type must be exact or prefix`);
    }
    if (approval.kind === "inline" && approval.match_type !== "exact") {
      throw new Error(`Invalid approval ${approval.approval_id}: inline scripts require exact matching`);
    }
    requiredText(approval.match, `${approval.approval_id}.match`);
    requiredText(approval.owner, `${approval.approval_id}.owner`);
    requiredText(approval.purpose, `${approval.approval_id}.purpose`, 8);
    requiredText(approval.approved_by, `${approval.approval_id}.approved_by`);
    if (!validDate(approval.approved_at)) {
      throw new Error(`Invalid approval ${approval.approval_id}: approved_at must be a real YYYY-MM-DD date`);
    }
    if (approval.expires_at !== null && approval.expires_at !== undefined && !validDate(approval.expires_at)) {
      throw new Error(`Invalid approval ${approval.approval_id}: expires_at must be null or a real YYYY-MM-DD date`);
    }
    if (approval.expires_at && approval.expires_at < approval.approved_at) {
      throw new Error(`Invalid approval ${approval.approval_id}: expires_at cannot be before approved_at`);
    }
    if (
      approval.integrity_method !== undefined &&
      !["observed-sha256", "sri", "csp", "vendor-attestation", "other"].includes(approval.integrity_method)
    ) {
      throw new Error(`Invalid approval ${approval.approval_id}: unsupported integrity_method`);
    }
  }

  return parsed;
}

function integrityEvidence(script) {
  const fingerprintObserved =
    typeof script.content_sha256 === "string" && /^[a-f0-9]{64}$/.test(script.content_sha256);
  const sriDeclared = script.kind === "external" && typeof script.integrity === "string" && Boolean(script.integrity.trim());
  const mechanisms = [];
  if (fingerprintObserved) mechanisms.push("observed-sha256");
  if (sriDeclared) mechanisms.push("sri-declared");

  return {
    status: fingerprintObserved ? "observed" : sriDeclared ? "declared" : "unavailable",
    fingerprint_observed: fingerprintObserved,
    sri_declared: sriDeclared,
    mechanisms,
  };
}

export async function loadApprovals(filePath, targetId) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return { schema_version: "1.1", target_id: targetId, approvals: [] };
    }
    throw error;
  }

  return validateApprovalDocument(parsed, targetId);
}

export function evaluateScriptApprovals(scripts, approvalDocument, now = new Date()) {
  return scripts.map((script) => {
    const candidates = approvalDocument.approvals.filter((candidate) => matches(script, candidate));
    const approval = candidates.find((candidate) => !isExpired(candidate, now) && !isNotYetEffective(candidate, now));
    const pendingApproval = approval ? null : candidates.find((candidate) => isNotYetEffective(candidate, now));
    const expiredApproval = approval || pendingApproval ? null : candidates.find((candidate) => isExpired(candidate, now));

    const approvalEvidence = approval
      ? {
          status: "approved",
          approval_id: approval.approval_id,
          owner: approval.owner,
          purpose: approval.purpose,
          approved_by: approval.approved_by,
          approved_at: approval.approved_at,
          expires_at: approval.expires_at ?? null,
          integrity_method: approval.integrity_method ?? null,
        }
      : pendingApproval
        ? {
            status: "pending",
            approval_id: pendingApproval.approval_id,
            owner: pendingApproval.owner,
            purpose: pendingApproval.purpose,
            approved_by: pendingApproval.approved_by,
            approved_at: pendingApproval.approved_at,
            expires_at: pendingApproval.expires_at ?? null,
            integrity_method: pendingApproval.integrity_method ?? null,
          }
        : expiredApproval
        ? {
            status: "expired",
            approval_id: expiredApproval.approval_id,
            owner: expiredApproval.owner,
            purpose: expiredApproval.purpose,
            approved_by: expiredApproval.approved_by,
            approved_at: expiredApproval.approved_at,
            expires_at: expiredApproval.expires_at,
            integrity_method: expiredApproval.integrity_method ?? null,
          }
        : { status: "unapproved" };

    return {
      ...script,
      approval: approvalEvidence,
      integrity_evidence: integrityEvidence(script),
    };
  });
}

export function buildApprovalTemplate(snapshot) {
  return {
    schema_version: "1.1",
    target_id: snapshot.target.target_id,
    instructions: "Review every entry. Fill owner, purpose, approved_by, and approved_at. Confirm the integrity method before treating a script as approved.",
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
      integrity_method: script.integrity ? "sri" : "observed-sha256",
    })),
  };
}
