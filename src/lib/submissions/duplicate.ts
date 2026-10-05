/**
 * Aturan duplikasi email dan WhatsApp (spesifikasi 6.3).
 *
 * Modul murni supaya aturan bisa diuji tanpa Google API.
 */

import type { ParsedSheetRow } from "./sheet-row";

export const DUPLICATE_EMAIL_MESSAGE =
  "Pendaftaran dengan email ini sudah terdaftar. Hubungi panitia bila Anda merasa ini keliru.";

export type DuplicateFlag = "" | "duplicate_whatsapp_suspected";

export type DuplicateDecision =
  | { kind: "reject"; message: string }
  | {
      kind: "retry";
      /** Baris `failed` milik email yang sama, dipakai untuk retry. */
      existing: ParsedSheetRow;
      duplicateFlag: DuplicateFlag;
    }
  | { kind: "new"; duplicateFlag: DuplicateFlag };

export function normalizeEmailForLookup(email: string): string {
  return email.trim().toLowerCase();
}

function emailMatches(row: ParsedSheetRow, email: string): boolean {
  return row.email.length > 0 && normalizeEmailForLookup(row.email) === email;
}

function whatsappMatches(row: ParsedSheetRow, whatsapp: string): boolean {
  return row.whatsappNumber.length > 0 && row.whatsappNumber === whatsapp;
}

/**
 * Menentukan tindakan untuk satu percobaan submit.
 *
 * Tiga aturan dari spesifikasi:
 * 1. email cocok dengan baris `submitted` -> tolak.
 * 2. WhatsApp cocok, email berbeda -> lanjut dengan tanda `duplicate_whatsapp_suspected`.
 * 3. email dan WhatsApp sama-sama cocok -> tolak, pesan sama seperti kasus 1.
 *
 * Tambahan retry: bila email yang sama punya baris `failed`, submit diizinkan
 * untuk memperbarui baris tersebut, bukan membuat baris baru. Ini dibutuhkan
 * agar opsi retry setelah kegagalan provider benar-benar bisa dipakai peserta.
 */
export function decideDuplicate({
  email,
  whatsappNumber,
  rows,
}: {
  email: string;
  whatsappNumber: string;
  rows: ParsedSheetRow[];
}): DuplicateDecision {
  const normalizedEmail = normalizeEmailForLookup(email);

  const sameEmailRows = rows.filter((row) => emailMatches(row, normalizedEmail));

  if (sameEmailRows.some((row) => row.status === "submitted")) {
    return { kind: "reject", message: DUPLICATE_EMAIL_MESSAGE };
  }

  const sameWhatsappRows = rows.filter(
    (row) =>
      whatsappMatches(row, whatsappNumber) &&
      !emailMatches(row, normalizedEmail),
  );

  const duplicateFlag: DuplicateFlag =
    sameWhatsappRows.length > 0 ? "duplicate_whatsapp_suspected" : "";

  const previousFailed = sameEmailRows.find((row) => row.status === "failed");

  if (previousFailed) {
    return { kind: "retry", existing: previousFailed, duplicateFlag };
  }

  return { kind: "new", duplicateFlag };
}

/** Daftar `registration_id` yang sudah dipakai, untuk generator ID unik. */
export function collectTakenIds(rows: ParsedSheetRow[]): Set<string> {
  return new Set(
    rows
      .map((row) => row.registrationId)
      .filter((id) => id.length > 0),
  );
}

/** ID file Drive yang sudah tercatat di Sheet, untuk deteksi orphan. */
export function collectRecordedFileIds(rows: ParsedSheetRow[]): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.instagramFileId) ids.add(row.instagramFileId);
    if (row.paymentFileId) ids.add(row.paymentFileId);
  }
  return ids;
}
