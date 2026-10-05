import "server-only";

/**
 * Logging aman untuk proses submit.
 *
 * Aturan: jangan mencatat data pribadi peserta (nama, email, nomor WhatsApp)
 * ke log. Hanya identifier teknis seperti `registration_id` dan file ID Drive.
 */

const ALLOWED_KEYS = new Set([
  "event",
  "registration_id",
  "file_id",
  "slot",
  "error_code",
  "error_name",
  "status",
  "row_number",
  "attempt",
  "duplicate_flag",
]);

export type LogEvent = Record<string, string | number | boolean | undefined>;

export function logServerEvent(event: string, data: LogEvent = {}): void {
  const payload: Record<string, string | number | boolean> = { event };

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (!ALLOWED_KEYS.has(key)) continue;
    payload[key] = value;
  }

  // `console.error` tetap dipakai agar terlihat di log Vercel.
  console.error(JSON.stringify(payload));
}
