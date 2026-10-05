/**
 * Pengiriman pendaftaran ke Route Handler server.
 *
 * Berjalan di browser: mengirim satu request `multipart/form-data` berisi
 * metadata dan kedua file. Tidak ada kredensial Google di sisi ini; semua
 * integrasi provider ada di `src/lib/submissions/service.ts`.
 */

import type { RegistrationValues } from "./types";
import { NETWORK_ERROR_MESSAGE } from "@/lib/submissions/errors";
export type FieldErrorKey =
  | "consent"
  | "fullName"
  | "email"
  | "whatsapp"
  | "affiliation"
  | "instagramUrl"
  | "instagramFile"
  | "paymentFile"
  | "form";

export type SubmitOutcome =
  | {
      status: "submitted";
      registrationId: string;
      submittedAt: string;
    }
  | {
      status: "error";
      message: string;
      code: string;
      /** Boleh dicoba ulang: kegagalan jaringan atau provider. */
      retryable: boolean;
      /** Pesan per field saat server menolak validasi. */
      fields?: Record<string, string>;
    };

const RETRYABLE_CODES = new Set([
  "PROVIDER_ERROR",
  "CONFIG_ERROR",
  "IDEMPOTENCY_REPLAYED",
]);

/**
 * Kunci idempotency untuk satu sesi form.
 *
 * Dibuat sekali saat form dimuat, bukan setiap klik submit, supaya klik ganda
 * atau retry memakai kunci yang sama dan server bisa menolak duplikat.
 */
export function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `key-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Mengirim pendaftaran.
 *
 * `idempotencyKey` dibuat satu kali per sesi form agar submit ganda dari
 * jaringan yang lambat tidak menghasilkan dua pendaftaran.
 */
export async function submitRegistration(
  values: RegistrationValues,
  idempotencyKey: string,
): Promise<SubmitOutcome> {
  let response: Response;

  try {
    response = await fetch("/api/submissions", {
      method: "POST",
      headers: {
        "x-idempotency-key": idempotencyKey,
      },
      body: buildFormData(values),
    });
  } catch {
    return {
      status: "error",
      code: "NETWORK_ERROR",
      message: NETWORK_ERROR_MESSAGE,
      retryable: true,
    };
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    return {
      status: "error",
      code: "BAD_RESPONSE",
      message: NETWORK_ERROR_MESSAGE,
      retryable: true,
    };
  }

  if (response.ok && isRecord(body) && body.status === "submitted") {
    const registrationId = body.registration_id;
    const submittedAt = body.submitted_at;

    if (typeof registrationId === "string" && typeof submittedAt === "string") {
      return { status: "submitted", registrationId, submittedAt };
    }
  }

  const code =
    isRecord(body) && typeof body.code === "string"
      ? body.code
      : "PROVIDER_ERROR";

  const message =
    isRecord(body) && typeof body.message === "string"
      ? body.message
      : "Pendaftaran belum berhasil disimpan. Coba lagi beberapa saat lagi.";

  const fields =
    isRecord(body) && isRecord(body.fields)
      ? (body.fields as Record<string, string>)
      : undefined;

  return {
    status: "error",
    code,
    message,
    retryable: RETRYABLE_CODES.has(code),
    fields,
  };
}

function buildFormData(values: RegistrationValues): FormData {
  const formData = new FormData();

  formData.append("consent", values.consent ? "true" : "false");
  formData.append("fullName", values.fullName);
  formData.append("email", values.email);
  formData.append("whatsapp", values.whatsapp);
  formData.append("affiliation", values.affiliation);
  formData.append("instagramUrl", values.instagramUrl);

  if (values.instagramFile) {
    formData.append("instagram_file", values.instagramFile);
  }
  if (values.paymentFile) {
    formData.append("payment_file", values.paymentFile);
  }

  return formData;
}
