"use client";

import { SuccessSlide } from "@/components/registration/slides/success-slide";

/**
 * Wrapper client untuk pratinjau desain slide sukses.
 *
 * `SuccessSlide` menerima prop event handler, jadi halaman route (Server
 * Component) tidak boleh memanggilnya langsung.
 */
export function SuccessPreview() {
  return (
    <SuccessSlide
      fullName="Siti Rahma Wulandari"
      email="siti.rahma@email.com"
      whatsapp="081234567890"
      registrationId="CF2026-7F3K9Q"
      onDone={() => undefined}
    />
  );
}
