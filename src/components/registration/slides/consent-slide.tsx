export function ConsentSlide({
  checked,
  error,
  onChange,
}: {
  checked: boolean;
  error: string | null;
  onChange: (checked: boolean) => void;
}) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Persetujuan penggunaan data
        </h1>
        <p className="text-base text-ink-muted">
          Persetujuan ini wajib agar pendaftaran dapat diproses.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-4">
          <input
            type="checkbox"
            data-autofocus="true"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "consent-error" : undefined}
            className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
          />
          <span className="text-base leading-relaxed text-ink">
            Saya menyetujui data saya (nama, email, nomor WhatsApp, dan bukti
            transfer) digunakan panitia Career Fest 2026 untuk pendaftaran,
            verifikasi pembayaran, dan absensi pada hari acara.
          </span>
        </label>
        {error ? (
          <p
            id="consent-error"
            role="alert"
            className="flex items-start gap-1.5 text-sm text-danger"
          >
            <span aria-hidden="true">!</span>
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
