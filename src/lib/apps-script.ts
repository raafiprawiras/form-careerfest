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
  idempotencyKey: string,
): Promise<{ status: "submitted"; registrationId: string; submittedAt: string }> {
  const url = process.env.APPS_SCRIPT_WEB_APP_URL?.trim();
  const secret = process.env.CAREERFEST_API_SECRET?.trim();
  if (!url || !secret) throw new AppsScriptError("CONFIG_ERROR", false);

  const body = JSON.stringify({
    secret,
    idempotencyKey,
    consent: payload.consent,
    fullName: payload.fullName,
    email: payload.email,
    whatsappNumber: payload.whatsappNumber,
    affiliation: payload.affiliation,
    instagramFile: encodeFile(payload.instagramFile),    paymentFile: encodeFile(payload.paymentFile),
  });

  const headers = { "content-type": "application/json" };

  // Apps Script menjawab POST dengan redirect yang diproses `follow`;
  // method POST tetap sampai ke `doPost`. Hati-hati: jangan ganti ke
  // `redirect: "manual"` — mengirim ulang POST ke URL Location gagal.
  const sendOnce = async (): Promise<Response> =>
    fetch(url, {
      method: "POST",
      headers,
      body,
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
    }).catch(() => {
      throw new AppsScriptError("PROVIDER_ERROR");
    });

  // Redirect hop bisa menyajikan response `doGet` yang basi dari cache;
  // response semacam itu dianggap tidak sah dan dicoba ulang.
  let lastError: AppsScriptError = new AppsScriptError("PROVIDER_ERROR");
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await sendOnce();

    let bodyJson: AppsScriptResponse;
    try {
      bodyJson = (await response.json()) as AppsScriptResponse;
    } catch {
      lastError = new AppsScriptError("PROVIDER_ERROR");
      continue;
    }

    if (response.ok && bodyJson.status === "submitted") {
      return {
        status: "submitted",
        registrationId: bodyJson.registration_id,
        submittedAt: bodyJson.submitted_at,
      };
    }

    if (bodyJson.status === "error") {
      throw new AppsScriptError(
        bodyJson.code ?? "PROVIDER_ERROR",
        bodyJson.retryable !== false,
      );
    }

    lastError = new AppsScriptError("PROVIDER_ERROR");
  }

  throw lastError;
}

function encodeFile(bytes: Uint8Array | null): { data: string } | null {
  return bytes ? { data: Buffer.from(bytes).toString("base64") } : null;
}
