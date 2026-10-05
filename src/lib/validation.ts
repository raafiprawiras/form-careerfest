/**
 * Validasi sisi client untuk Milestone 2.
 *
 * Aturan mengikuti `docs/FORM-SPECIFICATION.md` bagian 4 dan 5.
 * Logika yang sama akan dipakai ulang oleh schema server pada Milestone 3,
 * jadi fungsi di sini harus murni dan mudah diuji.
 */

import type { Affiliation } from "./types";

/** A-01: batas ukuran file, diusulkan 5 MB. */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const ACCEPTED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const ACCEPTED_FILE_EXTENSIONS = "jpg,jpeg,png,webp,pdf";

export const FULL_NAME_MIN_LENGTH = 3;
export const FULL_NAME_MAX_LENGTH = 100;

export const WHATSAPP_MIN_DIGITS = 9;
export const WHATSAPP_MAX_DIGITS = 15;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** A-05: domain yang diterima untuk link profil Instagram. */
export const INSTAGRAM_HOSTS = [
  "instagram.com",
  "www.instagram.com",
  "instagram.co.id",
];

/** Huruf Latin, spasi, tanda hubung, apostrof, dan titik. */
export const FULL_NAME_PATTERN = /^[\p{L} .'-]+$/u;

export function normalizeFullName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Menormalkan nomor WhatsApp menjadi digit saja.
 * Awalan `62` dipetakan ke `0` agar konsisten dengan kolom Sheets.
 */
export function normalizeWhatsapp(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 11 && digits.startsWith("62")) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

export function validateFullName(value: string): string | null {
  const normalized = normalizeFullName(value);
  if (normalized.length === 0) return "Nama lengkap wajib diisi.";
  if (normalized.length < FULL_NAME_MIN_LENGTH) {
    return "Nama lengkap minimal 3 karakter.";
  }
  if (normalized.length > FULL_NAME_MAX_LENGTH) {
    return "Nama lengkap maksimal 100 karakter.";
  }
  if (!FULL_NAME_PATTERN.test(normalized)) {
    return "Nama hanya boleh berisi huruf, spasi, tanda hubung, apostrof, atau titik.";
  }
  return null;
}

export function validateEmail(value: string): string | null {
  const normalized = normalizeEmail(value);
  if (normalized.length === 0) return "Email wajib diisi.";
  if (normalized.length > 254) return "Email terlalu panjang.";
  if (!EMAIL_PATTERN.test(normalized)) {
    return "Format email belum benar. Contoh: nama@email.com";
  }
  return null;
}

export function validateWhatsapp(value: string): string | null {
  const normalized = normalizeWhatsapp(value);
  if (value.trim().length === 0) return "Nomor WhatsApp wajib diisi.";
  if (normalized.length < WHATSAPP_MIN_DIGITS) {
    return "Nomor WhatsApp minimal 9 digit.";
  }
  if (normalized.length > WHATSAPP_MAX_DIGITS) {
    return "Nomor WhatsApp maksimal 15 digit.";
  }
  return null;
}

export function validateAffiliation(value: string): string | null {
  if (value === "UNISSULA" || value === "Umum") return null;
  return "Pilih salah satu asal instansi.";
}

export function validateInstagramProfileUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "Link Instagram wajib diisi.";

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "Gunakan link profil Instagram, contoh: https://instagram.com/username";
  }

  if (parsed.protocol !== "https:") {
    return "Link Instagram harus dimulai dengan https://";
  }
  if (!INSTAGRAM_HOSTS.includes(parsed.hostname.toLowerCase())) {
    return "Domain link Instagram tidak dikenali. Contoh: https://instagram.com/username";
  }
  const path = parsed.pathname;
  if (path === "/" || path.startsWith("/?") || path.startsWith("/#")) {
    return "Masukkan URL profil Instagram, bukan halaman utama.";
  }
  return null;
}

export function validateFileMeta(file: {
  name: string;
  size: number;
  type: string;
}): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return "Ukuran file melebihi 5 MB. Kompres file atau ambil ulang screenshot.";
  }
  if (file.size === 0) return "File kosong, pilih file lain.";
  if (!(ACCEPTED_FILE_TYPES as readonly string[]).includes(file.type)) {
    return "Format file belum sesuai. Gunakan JPG, PNG, WEBP, atau PDF.";
  }
  return null;
}

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

/** Kunci field yang divalidasi pada tiap slide. */
export type SignupValues = {
  consent: boolean;
  fullName: string;
  email: string;
  whatsapp: string;
  affiliation: Affiliation | "";
  instagramUrl: string;
  instagramFileMeta: { name: string; size: number; type: string } | null;
  paymentFileMeta: { name: string; size: number; type: string } | null;
};

/**
 * Menjalankan semua validator untuk satu nilai payload dan mengumpulkan
 * pesan error. Urutan pesan mengikuti urutan tampilan field.
 */
export function validateAll(values: SignupValues): ValidationResult {
  const errors: string[] = [];

  if (values.consent !== true) {
    errors.push("Persetujuan penggunaan data wajib disetujui.");
  }
  const nameError = validateFullName(values.fullName);
  if (nameError) errors.push(nameError);
  const emailError = validateEmail(values.email);
  if (emailError) errors.push(emailError);
  const whatsappError = validateWhatsapp(values.whatsapp);
  if (whatsappError) errors.push(whatsappError);
  const affiliationError = validateAffiliation(values.affiliation);
  if (affiliationError) errors.push(affiliationError);
  const instagramError = validateInstagramProfileUrl(values.instagramUrl);
  if (instagramError) errors.push(instagramError);
  if (!values.instagramFileMeta) {
    errors.push("Screenshot bukti follow Instagram wajib diunggah.");
  } else {
    const fileError = validateFileMeta(values.instagramFileMeta);
    if (fileError) errors.push(fileError);
  }
  if (!values.paymentFileMeta) {
    errors.push("Bukti transfer wajib diunggah.");
  } else {
    const fileError = validateFileMeta(values.paymentFileMeta);
    if (fileError) errors.push(fileError);
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
