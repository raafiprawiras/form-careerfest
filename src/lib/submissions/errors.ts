/**
 * Kode error dan pesan aman untuk response API.
 *
 * Pesan yang dikembalikan ke browser ditulis lengkap di spesifikasi bagian 7
 * dan tidak boleh memuat detail internal, nama provider, atau isi environment.
 */

export const ERROR_CODES = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  DUPLICATE_EMAIL: "DUPLICATE_EMAIL",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  MISSING_FILE: "MISSING_FILE",
  IDEMPOTENCY_REPLAYED: "IDEMPOTENCY_REPLAYED",
  CONFIG_ERROR: "CONFIG_ERROR",
  PROVIDER_ERROR: "PROVIDER_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const SAFE_MESSAGES: Record<ErrorCode, string> = {
  [ERROR_CODES.VALIDATION_FAILED]:
    "Ada data yang belum benar. Periksa kembali bagian yang ditandai.",
  [ERROR_CODES.DUPLICATE_EMAIL]:
    "Pendaftaran dengan email ini sudah terdaftar. Hubungi panitia bila Anda merasa ini keliru.",
  [ERROR_CODES.FILE_TOO_LARGE]:
    "Ukuran file melebihi 5 MB. Kompres file atau ambil ulang screenshot.",
  [ERROR_CODES.INVALID_FILE_TYPE]:
    "Format file belum sesuai. Gunakan JPG, PNG, WEBP, atau PDF.",
  [ERROR_CODES.MISSING_FILE]: "Bukti upload wajib dilengkapi.",
  [ERROR_CODES.IDEMPOTENCY_REPLAYED]:
    "Pendaftaran sedang diproses. Mohon tunggu sebentar.",
  [ERROR_CODES.CONFIG_ERROR]:
    "Pendaftaran belum bisa diproses. Hubungi panitia jika masalah berlanjut.",
  [ERROR_CODES.PROVIDER_ERROR]:
    "Pendaftaran belum berhasil disimpan. Coba lagi beberapa saat lagi. Jawaban Anda tetap tersimpan di halaman ini.",
  [ERROR_CODES.BAD_REQUEST]: "Permintaan tidak dapat diproses.",
};

export function safeMessage(code: ErrorCode): string {
  return SAFE_MESSAGES[code];
}

/** Pesan aman ketika jaringan atau fetch gagal total. */
export const NETWORK_ERROR_MESSAGE =
  "Koneksi terputus. Periksa jaringan Anda lalu coba kirim ulang.";

/**
 * Memetakan error tak terduga menjadi kode provider.
 *
 * `ConfigError` berasal dari `src/lib/google/config.ts`, tapi modul itu
 * `server-only`, jadi di sini cukup dicek dari nama error-nya agar berkas ini
 * tetap bisa dipakai bersama oleh server dan client.
 */
export function classifyServerError(error: unknown): ErrorCode {
  if (error instanceof Error && error.name === "ConfigError") {
    return ERROR_CODES.CONFIG_ERROR;
  }
  return ERROR_CODES.PROVIDER_ERROR;
}

export type ApiErrorBody = {
  status: "error";
  code: ErrorCode;
  message: string;
  /** Pesan per field, hanya ada pada kegagalan validasi. */
  fields?: Record<string, string>;
};

export function apiError(
  code: ErrorCode,
  options: { fields?: Record<string, string>; message?: string } = {},
): ApiErrorBody {
  return {
    status: "error",
    code,
    message: options.message ?? safeMessage(code),
    ...(options.fields ? { fields: options.fields } : {}),
  };
}
