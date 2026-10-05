/**
 * Deteksi tipe file memakai magic bytes, bukan `Content-Type` atau ekstensi
 * dari browser. Spesifikasi bagian 5: tipe di server wajib diperiksa dari
 * isi file.
 *
 * Modul ini murni supaya bisa diuji tanpa Google API.
 */

export type FileSlot = "instagram" | "payment";

export type DetectedFileType = {
  mimeType: string;
  /** Ekstensi yang dipakai untuk nama file di Drive. */
  extension: string;
};

const SIGNATURES: { mimeType: string; extension: string; test: (bytes: Uint8Array) => boolean }[] = [
  {
    mimeType: "image/jpeg",
    extension: "jpg",
    // FF D8 FF
    test: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  {
    mimeType: "image/png",
    extension: "png",
    // 89 50 4E 47 0D 0A 1A 0A
    test: (bytes) =>
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a,
  },
  {
    mimeType: "application/pdf",
    extension: "pdf",
    // 25 50 44 46 2D ("%PDF-")
    test: (bytes) =>
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d,
  },
  {
    mimeType: "image/webp",
    extension: "webp",
    // "RIFF" .... "WEBP"
    test: (bytes) =>
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50,
  },
];

export const ALLOWED_FILE_TYPES: DetectedFileType[] = [
  { mimeType: "image/jpeg", extension: "jpg" },
  { mimeType: "image/png", extension: "png" },
  { mimeType: "image/webp", extension: "webp" },
  { mimeType: "application/pdf", extension: "pdf" },
];

/** MIME yang diterima, untuk dipakai di pesan error. */
export const ALLOWED_MIME_TYPES: string[] = ALLOWED_FILE_TYPES.map(
  (item) => item.mimeType,
);

/**
 * Mendeteksi tipe dari byte awal file.
 *
 * Hanya mempercayai magic bytes. Tipe dari browser hanya dipakai sebagai
 * petunjuk awal dan diabaikan jika tidak cocok dengan hasil deteksi.
 */
export function detectFileType(bytes: Uint8Array): DetectedFileType | null {
  for (const signature of SIGNATURES) {
    if (signature.test(bytes)) {
      return { mimeType: signature.mimeType, extension: signature.extension };
    }
  }
  return null;
}

/**
 * Validasi lengkap satu file: ukuran lalu tipe.
 *
 * Mengembalikan null bila file lolos, atau pesan error Bahasa Indonesia yang
 * sama dengan pesan di client agar peserta melihat satu bahasa.
 */
export function validateUploadedFile(
  bytes: Uint8Array,
  maxBytes: number,
): { ok: true; detected: DetectedFileType } | { ok: false; message: string } {
  if (bytes.byteLength === 0) {
    return { ok: false, message: "File kosong. Pilih file lain." };
  }
  if (bytes.byteLength > maxBytes) {
    return {
      ok: false,
      message: `Ukuran file melebihi ${formatBytes(maxBytes)}. Kompres file atau ambil ulang screenshot.`,
    };
  }

  const detected = detectFileType(bytes);
  if (!detected) {
    return {
      ok: false,
      message: "Format file belum sesuai. Gunakan JPG, PNG, WEBP, atau PDF.",
    };
  }

  return { ok: true, detected };
}

/** Bentuk ukuran yang enak dibaca, untuk pesan error. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

/** Label slot file untuk nama file di Drive. */
export function fileSlotLabel(slot: FileSlot): string {
  return slot === "instagram" ? "instagram" : "payment";
}
