import { FileField, TextField } from "@/components/registration/ui";
import { PENDING_CONTENT } from "@/lib/placeholders";
import { ACCEPTED_FILE_EXTENSIONS, MAX_FILE_SIZE } from "@/lib/validation";

export function InstagramProofSlide({
  instagramUrl,
  instagramFile,
  errors,
  onUrlChange,
  onFileChange,
}: {
  instagramUrl: string;
  instagramFile: File | null;
  errors: { instagramUrl?: string | null; instagramFile?: string | null };
  onUrlChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
}) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Bukti follow Instagram
        </h1>
        <p className="text-base text-ink-muted">
          Ikuti akun resmi Career Fest 2026 lalu unggah screenshot bukti follow.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <TextField
          id="instagram-url"
          label="Link profil Instagram Anda"
          value={instagramUrl}
          onChange={(event) => onUrlChange(event.target.value)}
          error={errors.instagramUrl}
          inputMode="url"
          placeholder="Contoh: https://instagram.com/username"
          helper={`Akun acara: ${PENDING_CONTENT.instagramAccountUrl}`}
        />
        <FileField
          id="instagram-file"
          label="Screenshot bukti follow"
          helper={`JPG, PNG, WEBP, atau PDF, maksimal ${formatSize(MAX_FILE_SIZE)}.`}
          accept={ACCEPTED_FILE_EXTENSIONS}
          value={instagramFile}
          error={errors.instagramFile}
          onChange={onFileChange}
          onRemove={() => onFileChange(null)}
        />
      </div>
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
