"use client";

import { maskEmail, maskWhatsapp } from "@/lib/masks";
import { PENDING_CONTENT } from "@/lib/placeholders";

export function SuccessSlide({
  fullName,
  email,
  whatsapp,
  registrationId,
  submittedAt,
  onDone,
}: {
  fullName: string;
  email: string;
  whatsapp: string;
  registrationId: string;
  submittedAt?: string;
  onDone: () => void;
}) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Pendaftaran berhasil
        </h1>
        <p className="text-base text-ink-muted">
          Terima kasih, {fullName || "peserta"}. Pendaftaran Anda telah kami
          terima dengan baik. Kami mengundang Anda untuk bergabung ke grup
          WhatsApp resmi Career Fest 2026 melalui tautan di bawah guna
          mendapatkan informasi dan pengumuman selanjutnya.
        </p>
      </div>

      <dl className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap justify-between gap-2 px-4 py-3">
          <dt className="text-sm text-ink-muted">Nomor pendaftaran</dt>
          <dd className="font-mono text-base text-ink">{registrationId}</dd>
        </div>
        {submittedAt ? (
          <div className="flex flex-wrap justify-between gap-2 px-4 py-3">
            <dt className="text-sm text-ink-muted">Waktu pendaftaran</dt>
            <dd className="font-mono text-base text-ink">
              {formatSubmittedAt(submittedAt)}
            </dd>
          </div>
        ) : null}
        <div className="flex flex-wrap justify-between gap-2 px-4 py-3">
          <dt className="text-sm text-ink-muted">Email</dt>
          <dd className="font-mono text-base text-ink">{maskEmail(email)}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2 px-4 py-3">
          <dt className="text-sm text-ink-muted">Nomor WhatsApp</dt>
          <dd className="font-mono text-base text-ink">{maskWhatsapp(whatsapp)}</dd>
        </div>
      </dl>

      <a
        href={PENDING_CONTENT.whatsappGroupUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 underline underline-offset-4 transition-colors hover:bg-primary-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-current">
          <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.39a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.03h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.26.86 5.82 2.41a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29Z" />
        </svg>
        Join Grup WhatsApp Career Fest 2026
      </a>

      <ul className="flex flex-col gap-2 text-base text-ink-muted">
        <li>
          QR Code absensi dikirim otomatis ke email Anda dalam beberapa menit.
          Jika belum masuk, periksa folder Spam atau Promosi.
        </li>
        <li>
          QR Code absensi bersifat pribadi dan tidak boleh disebarkan kepada
          pihak lain.
        </li>
        <li>
          Mohon disiapkan QR Code Anda ketika datang di lokasi acara untuk
          dipindai sebagai bukti absensi.
        </li>
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onDone}
          className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-base font-medium text-accent-ink transition-transform duration-150 hover:bg-accent-hover active:translate-y-px"
        >
          Selesai
        </button>
      </div>

      <p className="text-sm text-ink-muted">
        Ada pertanyaan atau memerlukan koreksi data? Silakan hubungi panitia
        melalui grup WhatsApp resmi dengan menyebutkan nomor pendaftaran Anda.
        Kontak panitia: {PENDING_CONTENT.committeeContact}
      </p>
    </section>
  );
}

/** Mengubah ISO-8601 UTC menjadi waktu lokal yang mudah dibaca peserta. */
function formatSubmittedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  });
}