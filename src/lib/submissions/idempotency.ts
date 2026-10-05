/**
 * Idempotency store in-memory untuk mencegah submit ganda.
 *
 * Catatan penting: proses serverless di Vercel tidak berbagi memori antar
 * instance, jadi store ini hanya cukup untuk request berulang ke instance yang
 * sama. Pengaman yang benar-benar tahan lintas instance adalah pemeriksaan
 * email di Sheet (lihat `duplicate.ts`) plus kunci idempotency dari client.
 *
 * Modul murni supaya bisa diuji tanpa server.
 */

export type IdempotencyEntry<T> =
  | { state: "in-flight" }
  | { state: "done"; result: T };

export type BeginOutcome<T> =
  | { action: "proceed" }
  | { action: "reject" }
  | { action: "replay"; result: T };

export class IdempotencyStore<T> {
  private readonly entries = new Map<
    string,
    { entry: IdempotencyEntry<T>; expiresAt: number }
  >();

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly ttlMs: number = 10 * 60 * 1000,
  ) {}

  private sweep(current: number): void {
    for (const [key, value] of this.entries) {
      if (value.expiresAt <= current) this.entries.delete(key);
    }
  }

  /**
   * Mendaftarkan percobaan baru.
   *
   * - `proceed`: boleh jalan.
   * - `reject`: ada request lain dengan kunci sama yang masih berjalan.
   * - `replay`: kunci ini sudah pernah selesai, hasil yang sama dikembalikan.
   */
  begin(key: string): BeginOutcome<T> {
    const current = this.now();
    this.sweep(current);

    const existing = this.entries.get(key);
    if (!existing) {
      this.entries.set(key, {
        entry: { state: "in-flight" },
        expiresAt: current + this.ttlMs,
      });
      return { action: "proceed" };
    }

    if (existing.entry.state === "done") {
      return { action: "replay", result: existing.entry.result };
    }

    return { action: "reject" };
  }

  complete(key: string, result: T): void {
    const current = this.now();
    this.entries.set(key, {
      entry: { state: "done", result },
      expiresAt: current + this.ttlMs,
    });
  }

  /** Menandai percobaan gagal agar kunci bisa dipakai lagi untuk retry. */
  release(key: string): void {
    const existing = this.entries.get(key);
    if (existing?.entry.state === "in-flight") {
      this.entries.delete(key);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}
