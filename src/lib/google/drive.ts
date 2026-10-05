import "server-only";

import type { drive_v3 } from "googleapis";
import type { DriveFileMeta } from "@/lib/submissions/types";

/**
 * Upload file peserta ke folder Drive privat.
 *
 * Aturan yang dijaga di sini:
 * - File hanya masuk ke satu folder: `driveFolderId` dari environment.
 * - Tidak ada `permission` publik yang pernah dibuat. File memakai default
 *   private milik service account dan dibagikan ke akun panitia terpisah.
 * - Nama file dibuat server dari `registration_id`, bukan dari nama asli peserta.
 */

export type UploadResult = {
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export class DriveUploadError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "DriveUploadError";
  }
}

export async function uploadPrivateFile({
  drive,
  folderId,
  fileName,
  mimeType,
  bytes,
}: {
  drive: drive_v3.Drive;
  folderId: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<UploadResult> {
  try {
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
        mimeType,
      },
      media: {
        mimeType,
        // Body berupa Buffer in-memory, aman untuk file maksimal 5 MB.
        body: Buffer.from(bytes),
      },
      fields: "id,name,mimeType,size",
      // Wajib agar file tetap privat dan tidak terlihat lewat link bersama.
      supportsAllDrives: true,
    });

    const fileId = response.data.id;
    if (!fileId) {
      throw new DriveUploadError("Google Drive tidak mengembalikan ID file.");
    }

    return {
      fileId,
      fileName: response.data.name ?? fileName,
      mimeType: response.data.mimeType ?? mimeType,
      sizeBytes: Number(response.data.size ?? bytes.byteLength),
    };
  } catch (error) {
    if (error instanceof DriveUploadError) throw error;
    throw new DriveUploadError("Upload file ke Google Drive gagal.", error);
  }
}

/**
 * Menghapus file orphan saat penulisan Sheets gagal.
 *
 * Kegagalan di sini tidak membuat submit gagal dua kali: status sudah `failed`,
 * dan file yang tidak bisa dibersihkan dicatat sebagai orphan untuk Milestone 5/9.
 */
export async function deleteDriveFile({
  drive,
  fileId,
}: {
  drive: drive_v3.Drive;
  fileId: string;
}): Promise<boolean> {
  try {
    await drive.files.delete({ fileId, supportsAllDrives: true });
    return true;
  } catch {
    return false;
  }
}

export function toDriveFileMeta(upload: UploadResult): DriveFileMeta {
  return {
    fileId: upload.fileId,
    fileName: upload.fileName,
    mimeType: upload.mimeType,
    sizeBytes: upload.sizeBytes,
  };
}
