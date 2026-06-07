export type AuditLogEvent = {
  actorId?: string;
  clientId?: string;
  event: string;
  outcome: "success" | "failure" | "info";
  ipAddress?: string;
  userAgent?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
};

const SENSITIVE_KEY_PATTERN = /pass(word)?|secret|token|code|verifier|privateKey|refreshToken|accessToken/i;

export function maskSecrets(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((item) => maskSecrets(item));
  }

  if (!input || typeof input !== "object") {
    return input;
  }

  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : maskSecrets(value);
  }

  return output;
}

export function logAuditEvent(event: AuditLogEvent): void {
  const record = {
    timestamp: event.timestamp ?? new Date().toISOString(),
    event: event.event,
    outcome: event.outcome,
    actorId: event.actorId,
    clientId: event.clientId,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
    metadata: maskSecrets(event.metadata ?? {}),
  };

  console.info(JSON.stringify(record));
}
