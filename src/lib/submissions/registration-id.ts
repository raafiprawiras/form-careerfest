/**
 * Generator `registration_id` sesuai spesifikasi bagian 6.5.
 *
 * Format `CF2026-` + 6 karakter dari alfabet tanpa karakter ambigu:
 * `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (tanpa 0, 1, I, O).
 *
 * Modul murni: sumber acak disuntikkan supaya bisa diuji dan supaya tidak
 * bergantung pada `crypto` global tertentu.
 */

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const RANDOM_LENGTH = 6;
const PREFIX = "CF2026-";

export const REGISTRATION_ID_PATTERN = /^CF2026-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;

/** Sumber acak yang bisa diganti saat test. */
export type RandomSource = () => number;

export function createRegistrationId(random: RandomSource = Math.random): string {
  let suffix = "";
  for (let index = 0; index < RANDOM_LENGTH; index += 1) {
    // `random()` bisa mengembalikan 1 pada sumber yang salah; dibatasi agar
    // indeks selalu masuk alfabet.
    const bounded = Math.min(0.999999999, Math.max(0, random()));
    suffix += ALPHABET[Math.floor(bounded * ALPHABET.length)];
  }
  return `${PREFIX}${suffix}`;
}

export function isValidRegistrationId(value: string): boolean {
  return REGISTRATION_ID_PATTERN.test(value);
}

/**
 * Membuat ID yang belum ada di Sheet.
 *
 * Sheets tidak punya transaksi, jadi keuniquenan tetap perlu dicek sebelum
 * baris ditulis. `maxAttempts` mencegah loop tak berujung.
 */
export function createUniqueRegistrationId(
  takenIds: ReadonlySet<string>,
  random: RandomSource = Math.random,
  maxAttempts = 20,
): string {
  let lastId = "";
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    lastId = createRegistrationId(random);
    if (!takenIds.has(lastId)) return lastId;
  }
  throw new Error(
    `Tidak bisa membuat registration_id unik setelah ${maxAttempts} percobaan.`,
  );
}
