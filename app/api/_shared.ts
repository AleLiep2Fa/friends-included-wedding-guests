import { NextResponse } from "next/server";

export function apiError(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  const configuration = /Missing (SUPABASE|GOOGLE)|credentials are not configured/i.test(message);
  return NextResponse.json({ error: message }, { status: configuration ? 503 : status });
}

export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Expected a JSON object.");
  return body as Record<string, unknown>;
}
