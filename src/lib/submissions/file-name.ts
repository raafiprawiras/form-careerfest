/**
 * Nama file di Drive tidak pernah memakai nama asli peserta (spesifikasi 5).
 *
 * Format: `<registration_id>-<label slot>.<ext hasil deteksi>`
 * Contoh: `CF2026-7F3K9Q-instagram.png`
 */

import type { UploadSlot } from "./types";

export function buildDriveFileName({
  registrationId,
  slot,
  extension,
}: {
  registrationId: string;
  slot: UploadSlot;
  extension: string;
}): string {
  return `${registrationId}-${slot}.${extension}`;
}

/**
 * Membersihkan potensi nama file yang tak terduga.
 *
 * Nama file sekarang dibentuk server, jadi fungsi ini hanya pelindung tambahan
 * bila kelak ada jalur lain yang mengirim nama ke Drive.
 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
}
