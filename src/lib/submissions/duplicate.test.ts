import { describe, expect, it } from "vitest";
import {
  collectRecordedFileIds,
  collectTakenIds,
  decideDuplicate,
} from "./duplicate";
import type { ParsedSheetRow } from "./sheet-row";

function row(
  overrides: Partial<ParsedSheetRow> & Pick<ParsedSheetRow, "rowNumber">,
): ParsedSheetRow {
  return {
    registrationId: "CF2026-AAAAAA",
    submittedAt: "2026-01-01T00:00:00.000Z",
    status: "submitted",
    fullName: "Peserta",
    email: "peserta@email.com",
    whatsappNumber: "081234567890",
    affiliation: "UNISSULA",
    instagramFileId: "file-instagram",
    paymentFileId: "file-payment",
    errorCode: "",
    ...overrides,
  };
}

describe("decideDuplicate", () => {
  it("mengizinkan submit baru ketika Sheet kosong", () => {
    const decision = decideDuplicate({
      email: "baru@email.com",
      whatsappNumber: "081200000000",
      rows: [],
    });

    expect(decision).toEqual({ kind: "new", duplicateFlag: "" });
  });

  it("menolak email yang sudah punya baris submitted", () => {
    const decision = decideDuplicate({
      email: "Peserta@Email.com",
      whatsappNumber: "081200000000",
      rows: [row({ rowNumber: 2 })],
    });

    expect(decision.kind).toBe("reject");
    if (decision.kind === "reject") {
      expect(decision.message).toContain("sudah terdaftar");
    }
  });

  it("menolak ketika email dan WhatsApp sama-sama cocok", () => {
    const decision = decideDuplicate({
      email: "peserta@email.com",
      whatsappNumber: "081234567890",
      rows: [row({ rowNumber: 2 })],
    });

    expect(decision.kind).toBe("reject");
  });

  it("mengizinkan WhatsApp sama asalkan email berbeda, dengan tanda duplikat", () => {
    const decision = decideDuplicate({
      email: "orang-lain@email.com",
      whatsappNumber: "081234567890",
      rows: [row({ rowNumber: 2 })],
    });

    expect(decision.kind).toBe("new");
    if (decision.kind === "new") {
      expect(decision.duplicateFlag).toBe("duplicate_whatsapp_suspected");
    }
  });

  it("mengabaikan baris dengan status yang tidak terbaca", () => {
    const decision = decideDuplicate({
      email: "peserta@email.com",
      whatsappNumber: "081234567890",
      rows: [row({ rowNumber: 2, status: undefined })],
    });

    expect(decision.kind).toBe("new");
  });

  it("mengizinkan retry pada baris failed milik email yang sama", () => {
    const decision = decideDuplicate({
      email: "peserta@email.com",
      whatsappNumber: "081234567890",
      rows: [row({ rowNumber: 5, status: "failed", errorCode: "DRIVE_UPLOAD_FAILED" })],
    });

    expect(decision.kind).toBe("retry");
    if (decision.kind === "retry") {
      expect(decision.existing.rowNumber).toBe(5);
      expect(decision.existing.registrationId).toBe("CF2026-AAAAAA");
    }
  });

  it("mengutamakan penolakan atas baris submitted daripada retry pada baris failed", () => {
    const decision = decideDuplicate({
      email: "peserta@email.com",
      whatsappNumber: "081234567890",
      rows: [
        row({ rowNumber: 5, status: "failed" }),
        row({ rowNumber: 9 }),
      ],
    });

    expect(decision.kind).toBe("reject");
  });

  it("mengabaikan baris tanpa email saat mencari duplikat email", () => {
    const decision = decideDuplicate({
      email: "baru@email.com",
      whatsappNumber: "081234567890",
      rows: [row({ rowNumber: 2, email: "" })],
    });

    expect(decision.kind).toBe("new");
    if (decision.kind === "new") {
      // WhatsApp tetap dicatat sebagai tanda duplikat, hanya penolakan email
      // yang tidak berlaku karena baris tidak punya email.
      expect(decision.duplicateFlag).toBe("duplicate_whatsapp_suspected");
    }
  });
});

describe("collectTakenIds", () => {
  it("mengumpulkan registration_id yang tidak kosong", () => {
    const taken = collectTakenIds([
      row({ rowNumber: 2 }),
      row({ rowNumber: 3, registrationId: "" }),
      row({ rowNumber: 4, registrationId: "CF2026-BBBBBB" }),
    ]);

    expect(taken).toEqual(new Set(["CF2026-AAAAAA", "CF2026-BBBBBB"]));
  });
});

describe("collectRecordedFileIds", () => {
  it("mengumpulkan ID file Drive dari kedua slot", () => {
    const ids = collectRecordedFileIds([row({ rowNumber: 2 })]);

    expect(ids).toEqual(new Set(["file-instagram", "file-payment"]));
  });

  it("mengabaikan sel kosong", () => {
    const ids = collectRecordedFileIds([
      row({ rowNumber: 2, instagramFileId: "", paymentFileId: "" }),
    ]);

    expect(ids.size).toBe(0);
  });
});
