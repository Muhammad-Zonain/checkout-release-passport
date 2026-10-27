import { digestObject } from "./hash.js";

const ARTIFACT_TYPES = {
  passport: {
    kind: "checkout-release-passport",
    idField: "passport_id",
    digestField: "passport_sha256",
    prefix: "crp_",
  },
  event: {
    kind: "checkout-monitoring-event",
    idField: "event_id",
    digestField: "event_sha256",
    prefix: "cme_",
  },
  alert: {
    kind: "checkout-review-alert",
    idField: "alert_id",
    digestField: "alert_sha256",
    prefix: "cra_",
  },
};

export function verifyArtifactDigest(document, type) {
  const definition = ARTIFACT_TYPES[type];
  if (!definition) throw new Error(`Unsupported artifact type: ${type}`);
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error(`${type} artifact must be a JSON object`);
  }
  if (document.kind !== definition.kind) {
    throw new Error(`Expected ${definition.kind} artifact`);
  }
  const {
    [definition.idField]: artifactId,
    [definition.digestField]: expectedDigest,
    ...core
  } = document;
  const actualDigest = digestObject(core);
  const expectedId = `${definition.prefix}${actualDigest.slice(0, 20)}`;
  if (expectedDigest !== actualDigest || artifactId !== expectedId) {
    throw new Error(`${type} digest verification failed`);
  }
  return {
    type,
    artifact_id: artifactId,
    digest: actualDigest,
    decision: document.decision?.status ?? document.decision ?? null,
  };
}
