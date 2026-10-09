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
    instagramFile: encodeFile(payload.instagramFile),
    paymentFile: encodeFile(payload.paymentFile),
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

/* ------------------------------------------------------------------ */
/* Absensi (scan QR)                                                   */
/* ------------------------------------------------------------------ */

export type CheckInOutcome =
  | {
      status: "checked_in";
      registrationId: string;
      fullName: string;
      affiliation: string;
      checkedInAt: string;
    }
  | {
      status: "error";
      /** INVALID_PIN, RATE_LIMITED, INVALID_QR, NOT_FOUND, NOT_ELIGIBLE, ALREADY_USED, ... */
      code: string;
      registrationId?: string;
      fullName?: string;
      checkedInAt?: string;
      checkedInBy?: string;
    };

type CheckInResponse =
  | {
      status: "checked_in";
      registration_id: string;
      full_name: string;
      affiliation: string;
      checked_in_at: string;
    }
  | {
      status: "error";
      code?: string;
      registration_id?: string;
      full_name?: string;
      checked_in_at?: string;
      checked_in_by?: string;
    };

/**
 * Meminta Apps Script mencatat kehadiran.
 *
 * `scanId` dibuat satu kali per pemindaian di browser. Bila jawaban hilang di
 * tengah jalan lalu dikirim ulang, Apps Script mengembalikan hasil yang sama,
 * bukan menganggap QR sudah dipakai.
 */
export async function checkInViaAppsScript(input: {
  token: string;
  pin: string;
  scannerName: string;
  scanId: string;
  clientKey: string;
}): Promise<CheckInOutcome> {
  const url = process.env.APPS_SCRIPT_WEB_APP_URL?.trim();
  const secret = process.env.CAREERFEST_API_SECRET?.trim();
  if (!url || !secret) throw new AppsScriptError("CONFIG_ERROR", false);

  const body = JSON.stringify({
    secret,
    action: "checkin",
    token: input.token,
    pin: input.pin,
    scannerName: input.scannerName,
    scanId: input.scanId,
    clientKey: input.clientKey,
  });

  let lastError = new AppsScriptError("PROVIDER_ERROR");
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      lastError = new AppsScriptError("PROVIDER_ERROR");
      continue;
    }

    let json: CheckInResponse;
    try {
      json = (await response.json()) as CheckInResponse;
    } catch {
      lastError = new AppsScriptError("PROVIDER_ERROR");
      continue;
    }

    if (json.status === "checked_in") {
      return {
        status: "checked_in",
        registrationId: json.registration_id,
        fullName: json.full_name,
        affiliation: json.affiliation,
        checkedInAt: json.checked_in_at,
      };
    }

    if (json.status === "error") {
      return {
        status: "error",
        code: json.code ?? "PROVIDER_ERROR",
        registrationId: json.registration_id,
        fullName: json.full_name,
        checkedInAt: json.checked_in_at,
        checkedInBy: json.checked_in_by,
      };
    }

    lastError = new AppsScriptError("PROVIDER_ERROR");
  }

  throw lastError;
}