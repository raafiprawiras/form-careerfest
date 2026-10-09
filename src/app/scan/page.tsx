import { Suspense } from "react";
import type { Metadata } from "next";
import { ScanClient } from "./scan-client";

export const metadata: Metadata = {
  title: "Absensi Career Fest 2026",
  robots: { index: false, follow: false },
};

/**
 * Halaman tujuan QR peserta. Dibuka panitia lewat kamera HP biasa:
 *   https://<domain-kamu>/scan?t=<token>
 * Tanpa `?t=` halaman ini hanya menampilkan layar login panitia.
 */
export default function ScanPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6 sm:py-10">
      <Suspense fallback={null}>
        <ScanClient />
      </Suspense>
    </main>
  );
}