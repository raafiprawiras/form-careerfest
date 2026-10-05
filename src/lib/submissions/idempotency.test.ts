import { describe, expect, it } from "vitest";
import { IdempotencyStore } from "./idempotency";

describe("IdempotencyStore", () => {
  it("mengizinkan kunci baru sekali jalan", () => {
    const store = new IdempotencyStore<string>();

    expect(store.begin("kunci-1")).toEqual({ action: "proceed" });
    expect(store.begin("kunci-1")).toEqual({ action: "reject" });
  });

  it("memutar ulang hasil untuk kunci yang sudah selesai", () => {
    const store = new IdempotencyStore<{ id: string }>();

    store.begin("kunci-2");
    store.complete("kunci-2", { id: "CF2026-ABC123" });

    expect(store.begin("kunci-2")).toEqual({
      action: "replay",
      result: { id: "CF2026-ABC123" },
    });
  });

  it("membebaskan kunci setelah gagal agar retry bisa jalan", () => {
    const store = new IdempotencyStore<string>();

    store.begin("kunci-3");
    store.release("kunci-3");

    expect(store.begin("kunci-3")).toEqual({ action: "proceed" });
  });

  it("tidak membebaskan kunci yang sudah selesai", () => {
    const store = new IdempotencyStore<string>();

    store.begin("kunci-4");
    store.complete("kunci-4", "selesai");
    store.release("kunci-4");

    expect(store.begin("kunci-4")).toEqual({
      action: "replay",
      result: "selesai",
    });
  });

  it("menghapus entri yang sudah kedaluwarsa", () => {
    let now = 1_000;
    const store = new IdempotencyStore<string>(() => now, 100);

    store.begin("kunci-5");
    store.complete("kunci-5", "aman");

    now += 101;
    // Entri kedaluwarsa dibersihkan saat percobaan berikutnya masuk.
    store.begin("kunci-lain");

    expect(store.begin("kunci-5")).toEqual({ action: "proceed" });
  });

  it("menjaga kunci yang masih dalam masa berlaku", () => {
    let now = 1_000;
    const store = new IdempotencyStore<string>(() => now, 1_000);

    store.begin("kunci-6");
    store.complete("kunci-6", "aman");

    now += 999;

    expect(store.begin("kunci-6")).toEqual({
      action: "replay",
      result: "aman",
    });
  });
});
