import { Button } from "@/components/registration/ui";

export function WelcomeSlide({ onStart }: { onStart: () => void }) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4">
        {/* A-08: logo acara belum tersedia, tampil sebagai slot placeholder. */}
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface-alt text-sm text-ink-muted">
          Logo
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Registrasi Career Fest 2026
        </h1>
        <p className="max-w-[60ch] text-base leading-relaxed text-ink-muted">
          Satu formulir singkat untuk mendaftar, sekitar 3 menit. Data Anda hanya
          dipakai untuk keperluan acara dan tidak dibagikan kepada pihak lain tanpa
          persetujuan Anda.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Button type="button" onClick={onStart} className="self-start">
          Mulai
        </Button>
        <p className="text-sm text-ink-muted">
          Sudah daftar? Gunakan email yang sama saat meminta ulang konfirmasi.
        </p>
      </div>
    </section>
  );
}
