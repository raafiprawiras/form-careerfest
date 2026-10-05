import "server-only";

import { isAppsScriptConfigured, submitToAppsScript } from "@/lib/apps-script";
import { createGoogleClients } from "@/lib/google/auth";
import { ConfigError, getGoogleConfig } from "@/lib/google/config";
import {
  deleteDriveFile,
  uploadPrivateFile,
  type UploadResult,
} from "@/lib/google/drive";
import {
  appendRow,
  freezeHeaderRow,
  readDataRows,
  readSheetLayout,
  updateRow,
  writeHeaderRow,
} from "@/lib/google/sheets";
import type { drive_v3, sheets_v4 } from "googleapis";
import {
  collectTakenIds,
  decideDuplicate,
} from "@/lib/submissions/duplicate";
import {
  ERROR_CODES,
  type ErrorCode,
} from "@/lib/submissions/errors";
import { buildDriveFileName } from "@/lib/submissions/file-name";
import { IdempotencyStore } from "@/lib/submissions/idempotency";
import { logServerEvent } from "@/lib/submissions/log";
import { createUniqueRegistrationId } from "@/lib/submissions/registration-id";
import {
  SHEET_COLUMNS,
  buildSheetRow,
  parseSheetRow,
  type ParsedSheetRow,
} from "@/lib/submissions/sheet-row";
import type {
  SubmissionInput,
  SubmissionRecord,
  UploadSlot,
} from "@/lib/submissions/types";
import { validateServerInput } from "@/lib/submissions/validate-input";

export type SubmitResult = {
  status: "submitted";
  registrationId: string;
  submittedAt: string;
};

/** Submit ditolak sebelum menyentuh provider: validasi atau duplikasi. */
export class SubmissionRejectedError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly fields?: Record<string, string>,
    message?: string,
  ) {
    super(message ?? "");
    this.name = "SubmissionRejectedError";
  }
}

/** Provider gagal, percobaan harus dicatat sebagai `failed`. */
export class SubmissionProviderError extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? "");
    this.name = "SubmissionProviderError";
  }
}

/**
 * Idempotency store per proses server.
 *
 * Batasan serverless dijelaskan di `idempotency.ts`. Pengaman lintas instance
 * adalah pemeriksaan email di Sheet sebelum upload.
 */
const idempotencyStore = new IdempotencyStore<SubmitResult>();

export async function processSubmission({
  idempotencyKey,
  payload,
}: {
  idempotencyKey: string;
  payload: SubmissionInput;
}): Promise<SubmitResult> {
  const attempt = idempotencyStore.begin(idempotencyKey);

  if (attempt.action === "reject") {
    throw new SubmissionRejectedError(ERROR_CODES.IDEMPOTENCY_REPLAYED);
  }

  if (attempt.action === "replay") {
    // Kunci yang sama sudah pernah berhasil. Hasil yang sama dikembalikan agar
    // peserta tidak kehilangan nomor pendaftaran karena jaringan terputus.
    logServerEvent("idempotency_replay", {
      registration_id: attempt.result.registrationId,
    });
    return attempt.result;
  }

  try {
    const result = await runSubmission(payload, idempotencyKey);
    idempotencyStore.complete(idempotencyKey, result);
    logServerEvent("submission_succeeded", {
      registration_id: result.registrationId,
      status: result.status,
    });
    return result;
  } catch (error) {
    // Kunci dilepas agar peserta boleh mencoba lagi setelah kegagalan.
    idempotencyStore.release(idempotencyKey);
    throw error;
  }
}

async function runSubmission(
  payload: SubmissionInput,
  idempotencyKey: string,
): Promise<SubmitResult> {
  if (isAppsScriptConfigured()) {
    return submitViaAppsScript(payload, idempotencyKey);
  }

  // Konfigurasi dibaca lebih dulu supaya environment yang belum siap gagal
  // cepat dengan pesan yang jelas, bukan setengah jalan setelah upload.
  const config = getGoogleConfig();
  const clients = createGoogleClients(config);

  const validation = validateServerInput(payload, config.maxFileBytes);
  if (!validation.ok) {
    throw new SubmissionRejectedError(
      ERROR_CODES.VALIDATION_FAILED,
      validation.fields,
    );
  }

  await ensureSheetHeader({
    sheets: clients.sheets,
    spreadsheetId: config.sheetsId,
    sheetName: config.sheetsName,
  });

  const rows = await readSubmissionRows({
    sheets: clients.sheets,
    spreadsheetId: config.sheetsId,
    sheetName: config.sheetsName,
  });

  // Duplikasi diperiksa sebelum file diunggah, sesuai spesifikasi 6.3.
  const decision = decideDuplicate({
    email: validation.normalized.email,
    whatsappNumber: validation.normalized.whatsappNumber,
    rows,
  });

  if (decision.kind === "reject") {
    throw new SubmissionRejectedError(
      ERROR_CODES.DUPLICATE_EMAIL,
      undefined,
      decision.message,
    );
  }

  const isRetry = decision.kind === "retry";
  const registrationId = isRetry
    ? decision.existing.registrationId
    : createUniqueRegistrationId(collectTakenIds(rows));
  const existingRowNumber = isRetry ? decision.existing.rowNumber : null;

  const submittedAt = new Date().toISOString();
  const baseRecord: SubmissionRecord = {
    registrationId,
    submittedAt,
    status: "submitted",
    fullName: validation.normalized.fullName,
    email: validation.normalized.email,
    whatsappNumber: validation.normalized.whatsappNumber,
    affiliation: validation.normalized.affiliation,
    instagramFile: null,
    paymentFile: null,
    duplicateFlag: decision.duplicateFlag,
    errorCode: "",
    notes: "",
  };

  const instagramUpload = await uploadSlot({
    drive: clients.drive,
    folderId: config.driveFolderId,
    registrationId,
    slot: "instagram",
    mimeType: validation.instagramDetected.mimeType,
    extension: validation.instagramDetected.extension,
    bytes: payload.instagramFile,
  });

  if (!instagramUpload.ok) {
    await recordFailure({
      sheets: clients.sheets,
      spreadsheetId: config.sheetsId,
      sheetName: config.sheetsName,
      record: { ...baseRecord, status: "failed" },
      errorCode: "DRIVE_UPLOAD_FAILED",
      notes: "slot: instagram",
      existingRowNumber,
    });
    throw new SubmissionProviderError(ERROR_CODES.PROVIDER_ERROR);
  }

  const paymentUpload = await uploadSlot({
    drive: clients.drive,
    folderId: config.driveFolderId,
    registrationId,
    slot: "payment",
    mimeType: validation.paymentDetected.mimeType,
    extension: validation.paymentDetected.extension,
    bytes: payload.paymentFile,
  });

  if (!paymentUpload.ok) {
    // File pertama sudah masuk Drive: dibersihkan supaya tidak menjadi orphan.
    const leftover = await cleanupUploads(clients.drive, [
      instagramUpload.upload.fileId,
    ]);

    await recordFailure({
      sheets: clients.sheets,
      spreadsheetId: config.sheetsId,
      sheetName: config.sheetsName,
      record: { ...baseRecord, status: "failed" },
      errorCode: "DRIVE_UPLOAD_FAILED",
      notes: buildOrphanNotes(leftover, "slot: payment"),
      existingRowNumber,
    });
    throw new SubmissionProviderError(ERROR_CODES.PROVIDER_ERROR);
  }

  const successRecord: SubmissionRecord = {
    ...baseRecord,
    instagramFile: toFileMeta(instagramUpload.upload),
    paymentFile: toFileMeta(paymentUpload.upload),
  };

  try {
    if (existingRowNumber !== null) {
      await updateRow({
        sheets: clients.sheets,
        spreadsheetId: config.sheetsId,
        sheetName: config.sheetsName,
        rowNumber: existingRowNumber,
        values: buildSheetRow(successRecord),
      });
    } else {
      await appendRow({
        sheets: clients.sheets,
        spreadsheetId: config.sheetsId,
        sheetName: config.sheetsName,
        values: buildSheetRow(successRecord),
      });
    }
  } catch (error) {
    // Kegagalan parsial: file sudah di Drive tetapi Sheet belum bertambah.
    const leftover = await cleanupUploads(clients.drive, [
      instagramUpload.upload.fileId,
      paymentUpload.upload.fileId,
    ]);

    await recordFailure({
      sheets: clients.sheets,
      spreadsheetId: config.sheetsId,
      sheetName: config.sheetsName,
      record: successRecord,
      errorCode:
        leftover.length > 0 ? "DRIVE_CLEANUP_FAILED" : "SHEETS_WRITE_FAILED",
      notes: buildOrphanNotes(leftover, "partial_failure"),
      existingRowNumber,
    });

    logServerEvent("sheets_write_failed", {
      registration_id: registrationId,
      error_code: leftover.length > 0 ? "DRIVE_CLEANUP_FAILED" : "SHEETS_WRITE_FAILED",
      error_name: error instanceof Error ? error.name : "unknown",
    });

    throw new SubmissionProviderError(ERROR_CODES.PROVIDER_ERROR);
  }

  return {
    status: "submitted",
    registrationId,
    submittedAt,
  };
}

async function submitViaAppsScript(
  payload: SubmissionInput,
  idempotencyKey: string,
): Promise<SubmitResult> {
  const maxBytes = Number.parseInt(process.env.MAX_UPLOAD_BYTES ?? "5242880", 10);
  const validation = validateServerInput(payload, maxBytes);
  if (!validation.ok) {
    throw new SubmissionRejectedError(
      ERROR_CODES.VALIDATION_FAILED,
      validation.fields,
    );
  }

  try {
    return await submitToAppsScript(payload, idempotencyKey);
  } catch (error) {
    const code = error instanceof Error && "code" in error
      ? String((error as { code?: unknown }).code ?? "PROVIDER_ERROR")
      : "PROVIDER_ERROR";
    if (code === ERROR_CODES.DUPLICATE_EMAIL) {
      throw new SubmissionRejectedError(ERROR_CODES.DUPLICATE_EMAIL);
    }
    throw new SubmissionProviderError(ERROR_CODES.PROVIDER_ERROR);
  }
}

async function ensureSheetHeader({
  sheets,
  spreadsheetId,
  sheetName,
}: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  sheetName: string;
}): Promise<void> {
  const layout = await readSheetLayout({ sheets, spreadsheetId, sheetName });

  if (layout.isEmpty) {
    await writeHeaderRow({ sheets, spreadsheetId, sheetName });
    await freezeHeaderRow({ sheets, spreadsheetId, sheetName });
    logServerEvent("sheet_header_written", {});
    return;
  }

  if (!layout.headerOk) {
    throw new ConfigError(
      `Baris header Sheet belum sesuai. Kolom yang belum ada: ${layout.missingColumns.join(", ")}.`,
    );
  }

  if (!layout.headerFrozen) {
    const frozen = await freezeHeaderRow({ sheets, spreadsheetId, sheetName });
    logServerEvent("sheet_header_freeze", { frozen });
  }
}

async function readSubmissionRows({
  sheets,
  spreadsheetId,
  sheetName,
}: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  sheetName: string;
}): Promise<ParsedSheetRow[]> {
  const rawRows = await readDataRows({ sheets, spreadsheetId, sheetName });

  return rawRows.map((row, index) => parseSheetRow(row, index + 2));
}

async function uploadSlot({
  drive,
  folderId,
  registrationId,
  slot,
  mimeType,
  extension,
  bytes,
}: {
  drive: drive_v3.Drive;
  folderId: string;
  registrationId: string;
  slot: UploadSlot;
  mimeType: string;
  extension: string;
  bytes: Uint8Array | null;
}): Promise<{ ok: true; upload: UploadResult } | { ok: false }> {
  if (!bytes) return { ok: false };

  const fileName = buildDriveFileName({ registrationId, slot, extension });

  try {
    const upload = await uploadPrivateFile({
      drive,
      folderId,
      fileName,
      mimeType,
      bytes,
    });
    return { ok: true, upload };
  } catch (error) {
    logServerEvent("drive_upload_failed", {
      registration_id: registrationId,
      slot,
      error_name: error instanceof Error ? error.name : "unknown",
    });
    return { ok: false };
  }
}

/** Menghapus file yang sudah masuk Drive agar tidak jadi orphan. */
async function cleanupUploads(
  drive: drive_v3.Drive,
  fileIds: string[],
): Promise<string[]> {
  const leftover: string[] = [];

  for (const fileId of fileIds) {
    const deleted = await deleteDriveFile({ drive, fileId });
    if (!deleted) leftover.push(fileId);
  }

  return leftover;
}

function toFileMeta(upload: UploadResult) {
  return {
    fileId: upload.fileId,
    fileName: upload.fileName,
    mimeType: upload.mimeType,
    sizeBytes: upload.sizeBytes,
  };
}

function buildOrphanNotes(leftover: string[], fallback: string): string {
  if (leftover.length === 0) return fallback;
  return `${fallback}; orphan_file_id: ${leftover.join(", ")}`;
}

/**
 * Mencatat percobaan gagal sebagai baris `failed`.
 *
 * Penulisan ini best effort: bila Sheets sedang bermasalah, kegagalannya hanya
 * dilog, tidak menggagalkan response yang sudah jelas gagal.
 */
async function recordFailure({
  sheets,
  spreadsheetId,
  sheetName,
  record,
  errorCode,
  notes,
  existingRowNumber,
}: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  sheetName: string;
  record: SubmissionRecord;
  errorCode: string;
  notes: string;
  existingRowNumber: number | null;
}): Promise<void> {
  const failedRecord: SubmissionRecord = {
    ...record,
    status: "failed",
    errorCode,
    notes,
  };

  try {
    if (existingRowNumber !== null) {
      await updateRow({
        sheets,
        spreadsheetId,
        sheetName,
        rowNumber: existingRowNumber,
        values: buildSheetRow(failedRecord),
      });
      return;
    }

    await appendRow({
      sheets,
      spreadsheetId,
      sheetName,
      values: buildSheetRow(failedRecord),
    });
  } catch (error) {
    logServerEvent("failed_row_write_error", {
      registration_id: record.registrationId,
      error_code: errorCode,
      error_name: error instanceof Error ? error.name : "unknown",
    });
  }
}

export { SHEET_COLUMNS };
