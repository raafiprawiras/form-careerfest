import { describe, expect, it } from "vitest";
import {
  maskEmail,
  maskWhatsapp,
} from "./masks";

describe("maskEmail", () => {
  it("menyembunyikan nama lokal kecuali huruf pertama", () => {
    expect(maskEmail("siti.rahma@email.com")).toBe("s****@email.com");
  });

  it("menahan domain agar peserta bisa memastikan alamat email", () => {
    // Penyeragaman huruf kecil dilakukan normalizeEmail, bukan maskEmail,
    // jadi mask hanya mengikuti teks yang masuk.
    expect(maskEmail("Budi.Santoso@Campus.ac.id")).toBe("B****@Campus.ac.id");
  });

  it("mengganti string tanpa @ dengan mask", () => {
    expect(maskEmail("bukan-email")).toBe("****");
    expect(maskEmail("@email.com")).toBe("****");
  });
});

describe("maskWhatsapp", () => {
  it("menyisakan empat digit terakhir", () => {
    expect(maskWhatsapp("081234567890")).toBe("******7890");
  });

  it("menangani input dengan format campuran", () => {
    expect(maskWhatsapp("+62 812-3456-7890")).toBe("******7890");
  });

  it("memakai mask penuh untuk angka terlalu pendek", () => {
    expect(maskWhatsapp("0812")).toBe("****");
  });
});
