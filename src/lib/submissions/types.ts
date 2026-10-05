/**
 * Tipe bersama submission server-side.
 *
 * Nama field mengikuti `docs/FORM-SPECIFICATION.md` bagian 4 dan 6.
 */

export type Affiliation = "UNISSULA" | "Umum";

export type SubmissionStatus = "draft" | "submitted" | "failed";

export type DriveFileMeta = {
  /** ID Drive opaque. Bukan URL publik. */
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type SubmissionRecord = {
  registrationId: string;
  /** ISO-8601 UTC dari server. */
  submittedAt: string;
  status: SubmissionStatus;
  fullName: string;
  email: string;
  whatsappNumber: string;
  affiliation: Affiliation;
  instagramFile: DriveFileMeta | null;
  paymentFile: DriveFileMeta | null;
  duplicateFlag: "" | "duplicate_whatsapp_suspected";
  errorCode: string;
  notes: string;
};

export type UploadSlot = "instagram" | "payment";

export type UploadSlotInput = {
  slot: UploadSlot;
  bytes: Uint8Array;
};

/** Field yang dikirim browser beserta dua file. */
export type SubmissionInput = {
  consent: boolean;
  fullName: string;
  email: string;
  whatsappNumber: string;
  affiliation: string;
  instagramFile: Uint8Array | null;
  paymentFile: Uint8Array | null;
};
