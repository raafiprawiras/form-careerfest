import { FileField } from "@/components/registration/ui";
import { PENDING_CONTENT } from "@/lib/placeholders";
import { ACCEPTED_FILE_EXTENSIONS, MAX_FILE_SIZE } from "@/lib/validation";

export function InstagramProofSlide({
  instagramFile,
  error,
  onFileChange,
}: {
  instagramFile: File | null;
  error: string | null;
  onFileChange: (file: File | null) => void;
}) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Bukti follow Instagram
        </h1>
        <p className="text-base text-ink-muted">
          Ikuti akun resmi Career Fest 2026 melalui tautan di bawah, lalu unggah
          screenshot bukti follow.
        </p>
      </div>

      <a
        href={PENDING_CONTENT.instagramAccountUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 underline underline-offset-4 transition-colors hover:bg-primary-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-current">
          <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.1 0-3.5 0-4.8.1-1.1.1-1.5.2-1.9.3-.5.2-.8.4-1.1.7-.3.3-.5.6-.7 1.1-.1.4-.3.8-.3 1.9-.1 1.3-.1 1.7-.1 4.8s0 3.5.1 4.8c.1 1.1.2 1.5.3 1.9.2.5.4.8.7 1.1.3.3.6.5 1.1.7.4.1.8.3 1.9.3 1.3.1 1.7.1 4.8.1s3.5 0 4.8-.1c1.1-.1 1.5-.2 1.9-.3.5-.2.8-.4 1.1-.7.3-.3.5-.6.7-1.1.1-.4.3-.8.3-1.9.1-1.3.1-1.7.1-4.8s0-3.5-.1-4.8c-.1-1.1-.2-1.5-.3-1.9-.2-.5-.4-.8-.7-1.1-.3-.3-.6-.5-1.1-.7-.4-.1-.8-.3-1.9-.3-1.3-.1-1.7-.1-4.8-.1Zm0 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Zm5.2-3a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z" />
        </svg>
        @career_fest_2026 — buka profil Instagram
      </a>

      <FileField
        id="instagram-file"
        label="Screenshot bukti follow"
        helper={`JPG, PNG, WEBP, atau PDF, maksimal ${formatSize(MAX_FILE_SIZE)}. Pastikan nama akun Anda terlihat pada screenshot.`}
        accept={ACCEPTED_FILE_EXTENSIONS}
        value={instagramFile}
        error={error}
        onChange={onFileChange}
        onRemove={() => onFileChange(null)}
      />
    </section>
  );
}

export function PaymentProofSlide({
  paymentFile,
  error,
  onFileChange,
}: {
  paymentFile: File | null;
  error: string | null;
  onFileChange: (file: File | null) => void;
}) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Bukti transfer
        </h1>
        <p className="text-base text-ink-muted">
          Transfer sebesar {PENDING_CONTENT.transferAmount} ke{" "}
          {PENDING_CONTENT.bankAccount} atas nama {PENDING_CONTENT.bankAccountName},
          lalu unggah bukti pembayaran.
        </p>
      </div>

      <FileField
        id="payment-file"
        label="Bukti transfer"
        helper={`JPG, PNG, WEBP, atau PDF, maksimal ${formatSize(MAX_FILE_SIZE)}.`}
        accept={ACCEPTED_FILE_EXTENSIONS}
        value={paymentFile}
        error={error}
        onChange={onFileChange}
        onRemove={() => onFileChange(null)}
      />
    </section>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}
