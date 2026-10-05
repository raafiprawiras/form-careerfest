/**
 * Validasi sisi server.
 *
 * Aturan mengikuti `docs/FORM-SPECIFICATION.md` bagian 4 dan 5, memakai
 * kembali aturan di `src/lib/validation.ts` agar client dan server tidak
 * pernah berjalan dengan aturan berbeda. Bedanya: tipe file di sini diperiksa
 * dari magic bytes, bukan `Content-Type` browser.
 *
 * Modul murni supaya bisa diuji tanpa Google API.
 */

import {
  validateUploadedFile,
  type DetectedFileType,
} from "@/lib/google/file-type";
import {
  validateAffiliation,
  validateEmail,
  validateFullName,
  validateInstagramProfileUrl,
  validateWhatsapp,
} from "@/lib/validation";
import type { SubmissionInput } from "./types";

export type ServerFieldKey =
  | "consent"
  | "fullName"
  | "email"
  | "whatsapp"
  | "affiliation"
  | "instagramUrl"
  | "instagramFile"
  | "paymentFile";

export type ServerValidationResult =
  | {
      ok: true;
      /** Nilai yang sudah dinormalkan dan aman ditulis ke Sheets. */
      normalized: {
        consent: boolean;
        fullName: string;
        email: string;
        whatsappNumber: string;
        affiliation: "UNISSULA" | "Umum";
        instagramProfileUrl: string;
      };
      instagramDetected: DetectedFileType;
      paymentDetected: DetectedFileType;
    }
  | { ok: false; fields: Partial<Record<ServerFieldKey, string>> };

const INSTAGRAM_MISSING = "Screenshot bukti follow Instagram wajib diunggah.";
const PAYMENT_MISSING = "Bukti transfer wajib diunggah.";

/**
 * Validasi seluruh input submit.
 *
 * Urutan pemeriksaan mengikuti urutan field di form supaya pesan error yang
 * muncul pertama sama seperti yang dilihat peserta.
 */
export function validateServerInput(
  input: SubmissionInput,
  maxFileBytes: number,
): ServerValidationResult {
  const fields: Partial<Record<ServerFieldKey, string>> = {};

  let consent = false;
  if (input.consent === true) {
    consent = true;
  } else {
    fields.consent = "Persetujuan penggunaan data wajib disetujui.";
  }

  const fullNameError = validateFullName(input.fullName);
  if (fullNameError) fields.fullName = fullNameError;

  const emailError = validateEmail(input.email);
  if (emailError) fields.email = emailError;

  const whatsappError = validateWhatsapp(input.whatsappNumber);
  if (whatsappError) fields.whatsapp = whatsappError;

  const affiliationError = validateAffiliation(input.affiliation);
  if (affiliationError) fields.affiliation = affiliationError;

  const instagramUrlError = validateInstagramProfileUrl(
    input.instagramProfileUrl,
  );
  if (instagramUrlError) fields.instagramUrl = instagramUrlError;

  let instagramDetected: DetectedFileType | null = null;
  if (!input.instagramFile) {
    fields.instagramFile = INSTAGRAM_MISSING;
  } else {
    const fileCheck = validateUploadedFile(input.instagramFile, maxFileBytes);
    if (fileCheck.ok) {
      instagramDetected = fileCheck.detected;
    } else {
      fields.instagramFile = fileCheck.message;
    }
  }

  let paymentDetected: DetectedFileType | null = null;
  if (!input.paymentFile) {
    fields.paymentFile = PAYMENT_MISSING;
  } else {
    const fileCheck = validateUploadedFile(input.paymentFile, maxFileBytes);
    if (fileCheck.ok) {
      paymentDetected = fileCheck.detected;
    } else {
      fields.paymentFile = fileCheck.message;
    }
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, fields };
  }

  if (!instagramDetected || !paymentDetected) {
    // Tidak bisa terjadi, tapi dijaga agar tipe di bawah tetap sempit.
    return {
      ok: false,
      fields: {
        instagramFile: INSTAGRAM_MISSING,
        paymentFile: PAYMENT_MISSING,
      },
    };
  }

  return {
    ok: true,
    normalized: {
      consent,
      fullName: normalizeName(input.fullName),
      email: normalizeEmail(input.email),
      whatsappNumber: normalizeDigits(input.whatsappNumber),
      affiliation: input.affiliation as "UNISSULA" | "Umum",
      instagramProfileUrl: input.instagramProfileUrl.trim(),
    },
    instagramDetected,
    paymentDetected,
  };
}

/** Sama dengan normalisasi di `src/lib/validation.ts`, dipisah agar tidak impor silang. */
function normalizeName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 11 && digits.startsWith("62")) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}
