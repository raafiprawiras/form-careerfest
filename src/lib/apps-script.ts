import "server-only";

import type { SubmissionInput } from "@/lib/submissions/types";

type AppsScriptResponse =
  | { status: "submitted"; registration_id: string; submitted_at: string }
  | { status: "error"; code?: string; retryable?: boolean };

export class AppsScriptError extends Error {
  constructor(readonly code: string, readonly retryable = true) {
    super("Apps Script provider request failed");
    this.name = "AppsScriptError";
  }
}

export function isAppsScriptConfigured(): boolean {
  return Boolean(
    process.env.APPS_SCRIPT_WEB_APP_URL?.trim() &&
      process.env.CAREERFEST_API_SECRET?.trim(),
  );
}

export async function submitToAppsScript(
  payload: SubmissionInput,
): Promise<{ status: "submitted"; registrationId: string; submittedAt: string }> {
  const url = process.env.APPS_SCRIPT_WEB_APP_URL?.trim();
  const secret = process.env.CAREERFEST_API_SECRET?.trim();
  if (!url || !secret) throw new AppsScriptError("CONFIG_ERROR", false);

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      secret,
      consent: payload.consent,
      fullName: payload.fullName,
      email: payload.email,
      whatsappNumber: payload.whatsappNumber,
      affiliation: payload.affiliation,
      instagramProfileUrl: payload.instagramProfileUrl,
      instagramFile: encodeFile(payload.instagramFile),
      paymentFile: encodeFile(payload.paymentFile),
    }),
  }).catch(() => {
    throw new AppsScriptError("PROVIDER_ERROR");
  });

  let body: AppsScriptResponse;
  try {
    body = (await response.json()) as AppsScriptResponse;
  } catch {
    throw new AppsScriptError("PROVIDER_ERROR");
  }

  if (response.ok && body.status === "submitted") {
    return {
      status: "submitted",
      registrationId: body.registration_id,
      submittedAt: body.submitted_at,
    };
  }

  if (body.status === "error") {
    throw new AppsScriptError(
      body.code ?? "PROVIDER_ERROR",
      body.retryable !== false,
    );
  }

  throw new AppsScriptError("PROVIDER_ERROR");
}

function encodeFile(bytes: Uint8Array | null): { data: string } | null {
  return bytes ? { data: Buffer.from(bytes).toString("base64") } : null;
}
