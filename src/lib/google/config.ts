import "server-only";

/**
 * Konfigurasi Google yang dibaca dari environment variable.
 *
 * Aturan agent: credential hanya lewat env, tidak pernah `NEXT_PUBLIC_*`,
 * tidak pernah masuk Git. Nilai dibaca satu kali per proses server, tidak
 * pernah dikirim ke browser.
 */

export type AppEnv = "development" | "preview" | "production";

export type GoogleConfig = {
  /** Email service account, contoh: nama-akun@project-id.iam.gserviceaccount.com */
  clientEmail: string;
  /** Private key PEM. Baris baru di env ditulis sebagai `\n` dan dinormalkan di sini. */
  privateKey: string;
  /** ID folder Drive privat tempat file peserta disimpan. Wajib, tidak ada default. */
  driveFolderId: string;
  /** ID spreadsheet Sheets tempat metadata peserta ditulis. Wajib, tidak ada default. */
  sheetsId: string;
  /** Nama tab di dalam spreadsheet. */
  sheetsName: string;
  /** Environment aktif, hanya untuk logging yang aman. */
  appEnv: AppEnv;
  /** Batas ukuran per file dalam byte. Default 5 MB (PLACEHOLDER A-01). */
  maxFileBytes: number;
  /** Scope Drive. Default `drive.file` agar akses service account minimum. */
  driveScopes: string[];
  /** Scope Sheets. */
  sheetsScopes: string[];
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const DEFAULT_MAX_FILE_BYTES = 5 * 1024 * 1024;

const DEFAULT_DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const DEFAULT_SHEETS_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function readAppEnv(): AppEnv {
  const raw = process.env.APP_ENV;
  if (raw === "production" || raw === "preview" || raw === "development") {
    return raw;
  }
  return "development";
}

/**
 * Menormalkan private key dari environment variable.
 *
 * Di Vercel dan `.env`, newline pada PEM tidak bisa ditulis mentah, jadi
 * dipakai escape `\n`. Tanpa normalisasi ini, JWT akan gagal divalidasi Google.
 */
export function normalizePrivateKey(raw: string): string {
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new ConfigError(
      `Environment variable ${name} belum diisi. Lihat .env.example.`,
    );
  }
  return value.trim();
}

/**
 * Membaca dan memvalidasi konfigurasi.
 *
 * Sengaja melempar `ConfigError`, bukan mengembalikan objek sebagian, supaya
 * kegagalan konfigurasi tidak diam-diam menghasilkan upload ke folder salah.
 */
export function getGoogleConfig(): GoogleConfig {
  const maxFileBytesRaw = process.env.MAX_UPLOAD_BYTES;
  const maxFileBytes = maxFileBytesRaw
    ? Number.parseInt(maxFileBytesRaw, 10)
    : DEFAULT_MAX_FILE_BYTES;

  if (!Number.isFinite(maxFileBytes) || maxFileBytes <= 0) {
    throw new ConfigError(
      "Environment variable MAX_UPLOAD_BYTES harus berupa angka byte positif.",
    );
  }

  const driveScopeRaw = process.env.GOOGLE_DRIVE_SCOPE;
  const sheetsScopeRaw = process.env.GOOGLE_SHEETS_SCOPE;

  return {
    clientEmail: required("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    privateKey: normalizePrivateKey(required("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")),
    driveFolderId: required("GOOGLE_DRIVE_FOLDER_ID"),
    sheetsId: required("GOOGLE_SHEETS_ID"),
    sheetsName: process.env.GOOGLE_SHEETS_NAME?.trim() || "Registrations",
    appEnv: readAppEnv(),
    maxFileBytes,
    driveScopes: driveScopeRaw ? [driveScopeRaw.trim()] : DEFAULT_DRIVE_SCOPES,
    sheetsScopes: sheetsScopeRaw ? [sheetsScopeRaw.trim()] : DEFAULT_SHEETS_SCOPES,
  };
}

/** True bila seluruh konfigurasi wajib sudah tersedia. */
export function isGoogleConfigured(): boolean {
  try {
    getGoogleConfig();
    return true;
  } catch {
    return false;
  }
}
