import Image from "next/image";
import { Button } from "@/components/registration/ui";

export function WelcomeSlide({ onStart }: { onStart: () => void }) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4">
        {/* Logo asli berlatar gelap, jadi ditampilkan sebagai ubin bersudut bulat. */}
        <Image
          src="/logo-careerfest.png"
          alt="Logo Career Fest 2026"
          width={480}
          height={668}
          priority
          className="h-28 w-auto self-start rounded-2xl"
        />
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