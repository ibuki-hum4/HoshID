export const DEFAULT_API_ORIGIN =
  process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3000";

export const DEFAULT_AUTH_ORIGIN =
  process.env.NEXT_PUBLIC_AUTH_SERVICE_ORIGIN ?? "http://localhost:3000";

export function withAuthHeader(token: string): Record<string, string> {
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

export async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as {
      message?: string;
      error?: string;
    };
    return payload.message || payload.error || "Request failed.";
  }
  const text = await response.text();
  return text || "Request failed.";
}

export function formatDateTime(input?: string | Date | null): string {
  if (!input) {
    return "-";
  }
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
