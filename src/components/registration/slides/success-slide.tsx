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
          Terima kasih, {fullName || "peserta"}. Pendaftaran Anda sudah kami
          terima.
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
          <dt className="text-sm text-ink-muted">Email penerima QR Code</dt>
          <dd className="font-mono text-base text-ink">{maskEmail(email)}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2 px-4 py-3">
          <dt className="text-sm text-ink-muted">Nomor WhatsApp</dt>
          <dd className="font-mono text-base text-ink">{maskWhatsapp(whatsapp)}</dd>
        </div>
      </dl>

      <ul className="flex flex-col gap-2 text-base text-ink-muted">
        <li>
          QR Code absensi akan dikirim ke email di atas. Pastikan email Anda
          aktif.
        </li>
        <li>
          Grup WhatsApp:{" "}
          {isPlaceholder(PENDING_CONTENT.whatsappGroupUrl)
            ? PENDING_CONTENT.whatsappGroupUrl
            : null}
        </li>
        <li>Bawa QR Code dan kartu identitas ke lokasi acara.</li>
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
        Email belum diterima dalam 10 menit? Hubungi panitia lewat grup WhatsApp
        dan sebutkan nomor pendaftaran Anda. Kontak panitia:{" "}
        {PENDING_CONTENT.committeeContact}
      </p>
    </section>
  );
}

function isPlaceholder(value: string): boolean {
  return value.startsWith("[PLACEHOLDER");
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
