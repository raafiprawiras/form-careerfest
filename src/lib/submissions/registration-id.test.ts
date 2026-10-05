import { describe, expect, it } from "vitest";
import {
  REGISTRATION_ID_PATTERN,
  createRegistrationId,
  createUniqueRegistrationId,
  isValidRegistrationId,
} from "./registration-id";

describe("createRegistrationId", () => {
  it("dengan sumber acak tetap menghasilkan ID dengan format benar", () => {
    expect(createRegistrationId(() => 0)).toBe("CF2026-222222");
    // Tiap karakter diambil dari alfabet yang sama, jadi hasilnya enam "Z".
    expect(createRegistrationId(() => 0.999999)).toBe("CF2026-ZZZZZZ");
  });

  it("memenuhi pola yang dipakai panitia", () => {
    for (let index = 0; index < 200; index += 1) {
      const id = createRegistrationId();
      expect(isValidRegistrationId(id)).toBe(true);
      expect(id).toMatch(REGISTRATION_ID_PATTERN);
    }
  });

  it("tidak memakai karakter ambigu 0, 1, I, O", () => {
    for (let attempt = 0; attempt < 500; attempt += 1) {
      const suffix = createRegistrationId().slice("CF2026-".length);
      expect(suffix).not.toMatch(/[01IO]/);
    }
  });

  it("menahan indeks di tepi rentang", () => {
    // Sumber yang mengembalikan tepat 1 tidak boleh menghasilkan indeks di luar alfabet.
    expect(createRegistrationId(() => 1)).toMatch(REGISTRATION_ID_PATTERN);
    expect(createRegistrationId(() => -5)).toMatch(REGISTRATION_ID_PATTERN);
  });
});

describe("createUniqueRegistrationId", () => {
  it("menghindari ID yang sudah dipakai", () => {
    const taken = new Set(["CF2026-222222", "CF2026-333333"]);
    let calls = 0;
    const random = () => {
      // Dua nilai pertama sudah dipakai, sisanya bebas.
      calls += 1;
      return calls <= 2 ? 0 : 0.5;
    };

    const id = createUniqueRegistrationId(taken, random);

    expect(taken.has(id)).toBe(false);
    expect(isValidRegistrationId(id)).toBe(true);
  });

  it("melempar error setelah batas percobaan", () => {
    const random = () => 0;
    expect(() => createUniqueRegistrationId(new Set(), random, 0)).toThrow(
      /unik/,
    );
  });
});
