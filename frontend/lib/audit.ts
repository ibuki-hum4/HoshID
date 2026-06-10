type AuditDetails = Record<string, unknown>;

function maskValue(v: unknown): unknown {
  if (v == null) return v;
  const s = String(v);
  if (s.length <= 8) return "****";
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
}

function redact(obj: AuditDetails): AuditDetails {
  const redacted: AuditDetails = {};
  for (const [k, v] of Object.entries(obj)) {
    if (/secret|token|password|private|key|jwks/i.test(k)) {
      redacted[k] = maskValue(v);
    } else if (typeof v === "object" && v !== null) {
      try {
        redacted[k] = redact(v as AuditDetails);
      } catch {
        redacted[k] = "<redacted>";
      }
    } else {
      redacted[k] = v;
    }
  }
  return redacted;
}

export function auditLog(event: string, details: AuditDetails = {}) {
  const payload = {
    ts: new Date().toISOString(),
    service: "frontend",
    env: process.env.NODE_ENV ?? "development",
    event,
    details: redact(details),
  } as const;

  // Structured JSON log (one line) for audit pipelines to ingest
  try {
    console.log(JSON.stringify(payload));
  } catch (_e) {
    // fallback
    console.log({ ...payload, details: "<unserializable>" });
  }
}

export default auditLog;
