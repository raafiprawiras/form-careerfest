/**
 * Konten yang belum diberikan panitia.
 *
 * Semua token memakai format `[PLACEHOLDER: ...]` agar mudah dicari dan tidak
 * ikut terkirim ke production tanpa penggantian. Lihat FORM-SPECIFICATION.md
 * bagian 9 untuk daftar A-01 sampai A-10.
 */

export const EVENT = {
  /** Nama pendek yang sudah pasti dari judul acara. */
  name: "Career Fest 2026",
  /** A-08: nama resmi acara, logo, dan warna brand. */
  officialName: "[PLACEHOLDER: nama resmi acara]",
} as const;

export const PENDING_CONTENT = {
  /** A-05: Instagram resmi acara (sudah diberikan panitia). */
  instagramAccountUrl:
    "https://www.instagram.com/career_fest_2026?utm_source=ig_web_button_share_sheet&stkn=ZDNlZDc0MzIxNw==",
  /** A-10: link grup WhatsApp panitia. */
  whatsappGroupUrl: "[PLACEHOLDER: link grup WhatsApp]",
  /** A-09: nominal transfer. */
  transferAmount: "[PLACEHOLDER: nominal transfer]",
  /** A-09: rekening tujuan. */
  bankAccount: "[PLACEHOLDER: rekening tujuan]",
  /** A-09: pemilik rekening tujuan. */
  bankAccountName: "[PLACEHOLDER: nama pemilik rekening]",
  /** A-02: kontak panitia koreksi data. */
  committeeContact: "[PLACEHOLDER: kontak panitia]",
} as const;
