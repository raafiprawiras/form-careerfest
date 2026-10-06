import { describe, expect, it } from "vitest";
import {
  MAX_FILE_SIZE,
  normalizeEmail,
  normalizeFullName,
  normalizeWhatsapp,
  validateAffiliation,
  validateAll,
  validateEmail,
  validateFileMeta,
  validateFullName,
  validateWhatsapp,
} from "./validation";
import type { SignupValues } from "./validation";

const validValues: SignupValues = {
  consent: true,
  fullName: "Siti Rahma Wulandari",
  email: "siti.rahma@email.com",
  whatsapp: "081234567890",
  affiliation: "UNISSULA",
  instagramFileMeta: {
    name: "bukti.png",
    size: 1024,
    type: "image/png",
  },
  paymentFileMeta: {
    name: "transfer.jpg",
    size: 2048,
    type: "image/jpeg",
  },
};

describe("normalisasi", () => {
  it("merapikan spasi pada nama", () => {
    expect(normalizeFullName("  Siti   Rahma\tWulandari ")).toBe(
      "Siti Rahma Wulandari",
    );
  });

  it("menormalkan email ke huruf kecil tanpa spasi", () => {
    expect(normalizeEmail("  Siti.Rahma@Email.com ")).toBe("siti.rahma@email.com");
  });

  it("membuang karakter non-angka pada nomor WhatsApp", () => {
    expect(normalizeWhatsapp("+62 812-3456-7890")).toBe("081234567890");
    expect(normalizeWhatsapp("0812abc3456oo7890")).toBe("081234567890");
  });

  it("selalu menghasilkan awalan 08", () => {
    expect(normalizeWhatsapp("89776252162")).toBe("089776252162");
    expect(normalizeWhatsapp("6289776252162")).toBe("089776252162");
    expect(normalizeWhatsapp("+62 897-7625-2162")).toBe("089776252162");
  });
});

describe("validateFullName", () => {
  it("menerima nama dengan inisial dan tanda hubung", () => {
    expect(validateFullName("Budi S. Prasetyo-Wijaya")).toBeNull();
  });

  it("menolak nama terlalu pendek", () => {
    expect(validateFullName("Al")).toBe(
      "Nama lengkap minimal 3 karakter.",
    );
  });

  it("menolak nama berisi angka", () => {
    expect(validateFullName("Siti Rahma 2026")).toContain("hanya boleh berisi huruf");
  });

  it("menolak spasi saja", () => {
    expect(validateFullName("    ")).toBe("Nama lengkap wajib diisi.");
  });
});

describe("validateEmail", () => {
  it("menerima email valid", () => {
    expect(validateEmail("siti.rahma@email.com")).toBeNull();
  });

  it("menolak email tanpa titik di domain", () => {
    expect(validateEmail("siti@email")).toContain("Format email belum benar");
  });

  it("menolak email dengan spasi", () => {
    expect(validateEmail("siti rahma@email.com")).toContain(
      "Format email belum benar",
    );
  });
});

describe("validateWhatsapp", () => {
  it("menerima 9 sampai 15 digit", () => {
    expect(validateWhatsapp("812345678")).toBeNull();
    expect(validateWhatsapp("081234567890")).toBeNull();
  });

  it("menolak kurang dari 9 digit", () => {
    expect(validateWhatsapp("0812345")).toBe("Nomor WhatsApp minimal 9 digit.");
  });

  it("menolak lebih dari 15 digit", () => {
    expect(validateWhatsapp("0812345678901234")).toBe(
      "Nomor WhatsApp maksimal 15 digit.",
    );
  });
});

describe("validateAffiliation", () => {
  it("menerima dua nilai yang disepakati", () => {
    expect(validateAffiliation("UNISSULA")).toBeNull();
    expect(validateAffiliation("Umum")).toBeNull();
  });

  it("menolak nilai lain dan kosong", () => {
    expect(validateAffiliation("umum")).toContain("Pilih salah satu");
    expect(validateAffiliation("")).toContain("Pilih salah satu");
  });
});

describe("validateFileMeta", () => {
  it("menerima format yang disepakati", () => {
    expect(
      validateFileMeta({ name: "bukti.png", size: 1024, type: "image/png" }),
    ).toBeNull();
    expect(
      validateFileMeta({ name: "bukti.pdf", size: 1024, type: "application/pdf" }),
    ).toBeNull();
  });

  it("menolak file lebih besar dari batas", () => {
    expect(
      validateFileMeta({
        name: "besar.png",
        size: MAX_FILE_SIZE + 1,
        type: "image/png",
      }),
    ).toContain("melebihi 5 MB");
  });

  it("menolak format yang tidak disepakati", () => {
    expect(
      validateFileMeta({ name: "bukti.gif", size: 1024, type: "image/gif" }),
    ).toContain("Format file belum sesuai");
  });
});

describe("validateAll", () => {
  it("menerima payload lengkap", () => {
    expect(validateAll(validValues).ok).toBe(true);
  });

  it("menolak ketika persetujuan tidak dicentang", () => {
    const result = validateAll({ ...validValues, consent: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain(
        "Persetujuan penggunaan data wajib disetujui.",
      );
    }
  });

  it("mengumpulkan beberapa error sekaligus", () => {
    const result = validateAll({
      ...validValues,
      fullName: "Al",
      email: "salah",
      paymentFileMeta: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(3);
    }
  });
});
