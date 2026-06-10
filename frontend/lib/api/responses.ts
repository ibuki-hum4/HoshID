import "server-only";

export function jsonOk(
  data: Record<string, unknown>,
  status: number = 200,
): Response {
  return Response.json(data, { status });
}

export function jsonError(message: string, status: number = 400): Response {
  return Response.json({ error: message }, { status });
}

export function jsonUnauthorized(message: string): Response {
  return Response.json({ error: message }, { status: 401 });
}

export function jsonForbidden(message: string): Response {
  return Response.json({ error: message }, { status: 403 });
}

export function jsonNotFound(message: string): Response {
  return Response.json({ error: message }, { status: 404 });
}

export function jsonConflict(message: string): Response {
  return Response.json({ error: message }, { status: 409 });
}
