import { describe, expect, it } from "vitest";
import { validateServerInput } from "./validate-input";
import type { SubmissionInput } from "./types";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX = 5 * 1024 * 1024;

const validInput: SubmissionInput = {
  consent: true,
  fullName: "  Siti   Rahma  ",
  email: " Siti.Rahma@Email.com ",
  whatsappNumber: "+62 812-3456-7890",
  affiliation: "UNISSULA",
  instagramFile: PNG,
  paymentFile: PNG,
};

describe("validateServerInput", () => {
  it("menerima input yang lengkap dan menormalkan nilai", () => {
    const result = validateServerInput(validInput, MAX);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized.fullName).toBe("Siti Rahma");
      expect(result.normalized.email).toBe("siti.rahma@email.com");
      expect(result.normalized.whatsappNumber).toBe("081234567890");
      expect(result.normalized.affiliation).toBe("UNISSULA");
      expect(result.instagramDetected.extension).toBe("png");
      expect(result.paymentDetected.extension).toBe("png");
    }
  });

  it("menolak persetujuan yang tidak dicentang", () => {
    const result = validateServerInput(
      { ...validInput, consent: false },
      MAX,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields.consent).toContain("wajib disetujui");
    }
  });

  it("menolak field wajib yang kosong", () => {
    const result = validateServerInput(
      {
        ...validInput,
        fullName: "",
        email: "",
        whatsappNumber: "",
        affiliation: "",
      },
      MAX,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fields).sort()).toEqual([
        "affiliation",
        "email",
        "fullName",
        "whatsapp",
      ]);
    }
  });

  it("menolak file yang tidak dikirim", () => {
    const result = validateServerInput(
      { ...validInput, instagramFile: null, paymentFile: null },
      MAX,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields.instagramFile).toContain("wajib diunggah");
      expect(result.fields.paymentFile).toContain("wajib diunggah");
    }
  });

  it("menolak file dengan tipe palsu dari Content-Type browser", () => {
    // Byte plain text yang diklaim sebagai gambar oleh browser.
    const fake = new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e]);
    const result = validateServerInput({ ...validInput, paymentFile: fake }, MAX);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields.paymentFile).toContain("Format file belum sesuai");
    }
  });

  it("menolak file melebihi batas yang dikonfigurasi", () => {
    const result = validateServerInput({ ...validInput, instagramFile: PNG }, 4);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields.instagramFile).toContain("melebihi");
    }
  });

  it("menerima batas konfigurasi yang berbeda dari default", () => {
    const result = validateServerInput({ ...validInput, paymentFile: PNG }, 8);

    expect(result.ok).toBe(true);
  });
});
