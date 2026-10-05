/**
 * Struktur satu baris Google Sheets.
 *
 * Urutan kolom mengikuti `docs/FORM-SPECIFICATION.md` bagian 6.6 persis, karena
 * panitia akan memfilter Sheet berdasarkan kolom ini. Jangan menukar urutan
 * tanpa memperbarui dokumen spesifikasi.
 */

import type { SubmissionRecord } from "./types";
import type { Affiliation, SubmissionStatus } from "./types";

export const SHEET_COLUMNS = [
  "registration_id",
  "submitted_at",
  "status",
  "full_name",
  "email",
  "whatsapp_number",
  "affiliation",
  "instagram_profile_url",
  "instagram_file_id",
  "instagram_file_name",
  "instagram_mime_type",
  "instagram_size_bytes",
  "payment_file_id",
  "payment_file_name",
  "payment_mime_type",
  "payment_size_bytes",
  "duplicate_flag",
  "barcode_status",
  "attendance_status",
  "checked_in_at",
  "checked_in_by",
  "error_code",
  "notes",
] as const;

export type SheetColumn = (typeof SHEET_COLUMNS)[number];

/** Nilai akhir setiap baris, sesuai urutan `SHEET_COLUMNS`. */
export function buildSheetRow(record: SubmissionRecord): string[] {
  return [
    record.registrationId,
    record.submittedAt,
    record.status,
    record.fullName,
    record.email,
    record.whatsappNumber,
    record.affiliation,
    record.instagramProfileUrl,
    record.instagramFile?.fileId ?? "",
    record.instagramFile?.fileName ?? "",
    record.instagramFile?.mimeType ?? "",
    record.instagramFile ? String(record.instagramFile.sizeBytes) : "",
    record.paymentFile?.fileId ?? "",
    record.paymentFile?.fileName ?? "",
    record.paymentFile?.mimeType ?? "",
    record.paymentFile ? String(record.paymentFile.sizeBytes) : "",
    record.duplicateFlag,
    // Milestone 6 dan 7 mengisi kolom di bawah ini.
    "",
    "",
    "",
    "",
    record.errorCode,
    record.notes,
  ];
}

/** Salah satu baris Sheet yang sudah dibaca. */
export type ParsedSheetRow = {
  /** Nomor baris 1-based di Sheet, dipakai untuk update saat retry. */
  rowNumber: number;
  registrationId: string;
  submittedAt: string;
  status?: SubmissionStatus;
  fullName: string;
  email: string;
  whatsappNumber: string;
  affiliation?: Affiliation;
  instagramProfileUrl: string;
  instagramFileId: string;
  paymentFileId: string;
  errorCode: string;
};

/**
 * Membaca satu baris Sheet menjadi record.
 *
 * Kegagalan parse tidak melempar error; baris yang tidak bisa dibaca dianggap
 * tidak ada agar satu baris rusak tidak membuat seluruh Sheet tidak terbaca.
 */
export function parseSheetRow(row: string[], rowNumber: number): ParsedSheetRow {
  const cell = (column: SheetColumn): string => {
    const index = SHEET_COLUMNS.indexOf(column);
    return row[index]?.trim() ?? "";
  };

  const status = cell("status");
  const affiliation = cell("affiliation");

  return {
    rowNumber,
    registrationId: cell("registration_id"),
    submittedAt: cell("submitted_at"),
    status:
      status === "submitted" || status === "failed" || status === "draft"
        ? status
        : undefined,
    fullName: cell("full_name"),
    email: cell("email"),
    whatsappNumber: cell("whatsapp_number"),
    affiliation:
      affiliation === "UNISSULA" || affiliation === "Umum"
        ? affiliation
        : undefined,
    instagramProfileUrl: cell("instagram_profile_url"),
    instagramFileId: cell("instagram_file_id"),
    paymentFileId: cell("payment_file_id"),
    errorCode: cell("error_code"),
  };
}

/** Kolom baru yang belum ada di baris header Sheet. */
export function findMissingHeaderColumns(headerRow: string[]): SheetColumn[] {
  const trimmed = headerRow.map((value) => value.trim());
  return SHEET_COLUMNS.filter((column) => !trimmed.includes(column));
}
