import type { Metadata } from "next";
import { SuccessPreview } from "./success-preview";

export const metadata: Metadata = {
  title: "Pratinjau slide sukses",
};

/**
 * Halaman pratinjau desain saja. Tidak dipakai peserta.
 *
 * Slide sukses baru bisa dicapai peserta setelah Milestone 3 dan 4 menghidupkan
 * route pengiriman, jadi halaman ini dipakai untuk memeriksa tampilan slide
 * terakhir tanpa harus menunggu backend.
 */
export default function PreviewSuccessPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <p className="rounded-2xl border border-line bg-surface-alt px-4 py-3 text-sm text-ink-muted">
        Pratinjau desain untuk panitia. Data di bawah ini contoh dan tidak pernah
        dikirim ke server.
      </p>
      <SuccessPreview />
    </main>
  );
}
