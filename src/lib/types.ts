/**
 * Jenis data bersama form.
 * Struktur payload penuh mengikuti FORM-SPECIFICATION.md bagian 4.
 */

export type Affiliation = "UNISSULA" | "Umum";

export type FileMeta = {
  name: string;
  size: number;
  type: string;
};

export type RegistrationValues = {
  consent: boolean;
  fullName: string;
  email: string;
  whatsapp: string;
  affiliation: Affiliation | "";
  instagramFile: File | null;
  paymentFile: File | null;
};

export const INITIAL_VALUES: RegistrationValues = {
  consent: false,
  fullName: "",
  email: "",
  whatsapp: "",
  affiliation: "",
  instagramFile: null,
  paymentFile: null,
};

export type SlideId =
  | "welcome"
  | "consent"
  | "identity"
  | "affiliation"
  | "instagram_proof"
  | "payment_proof"
  | "success";

export const SLIDE_ORDER: SlideId[] = [
  "welcome",
  "consent",
  "identity",
  "affiliation",
  "instagram_proof",
  "payment_proof",
  "success",
];

/** Slide yang punya isian, dipakai untuk progress bar. */
export const FILLABLE_SLIDES: SlideId[] = [
  "consent",
  "identity",
  "affiliation",
  "instagram_proof",
  "payment_proof",
];

export function isFillableSlide(id: SlideId): boolean {
  return FILLABLE_SLIDES.includes(id);
}

/** 1 sampai 5, atau null untuk welcome dan success. */
export function stepNumberOfSlide(id: SlideId): number | null {
  const index = FILLABLE_SLIDES.indexOf(id);
  return index === -1 ? null : index + 1;
}

/** Persentase progres 0 sampai 100, hanya dihitung dari slide isian. */
export function progressPercent(id: SlideId): number {
  const step = stepNumberOfSlide(id);
  if (step === null) return 0;
  return Math.round((step / FILLABLE_SLIDES.length) * 100);
}
