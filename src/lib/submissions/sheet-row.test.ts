import { describe, expect, it } from "vitest";
import {
  SHEET_COLUMNS,
  buildSheetRow,
  findMissingHeaderColumns,
  parseSheetRow,
} from "./sheet-row";
import type { SubmissionRecord } from "./types";

const record: SubmissionRecord = {
  registrationId: "CF2026-7F3K9Q",
  submittedAt: "2026-10-05T10:00:00.000Z",
  status: "submitted",
  fullName: "Siti Rahma Wulandari",
  email: "siti.rahma@email.com",
  whatsappNumber: "081234567890",
  affiliation: "UNISSULA",
  instagramProfileUrl: "https://instagram.com/siti.rahma",
  instagramFile: {
    fileId: "drive-instagram-id",
    fileName: "CF2026-7F3K9Q-instagram.png",
    mimeType: "image/png",
    sizeBytes: 2048,
  },
  paymentFile: {
    fileId: "drive-payment-id",
    fileName: "CF2026-7F3K9Q-payment.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 4096,
  },
  duplicateFlag: "",
  errorCode: "",
  notes: "",
};

describe("buildSheetRow", () => {
  it("menghasilkan satu sel per kolom sesuai urutan spesifikasi", () => {
    const values = buildSheetRow(record);

    expect(values).toHaveLength(SHEET_COLUMNS.length);
    expect(values[0]).toBe("CF2026-7F3K9Q");
    expect(values[1]).toBe("2026-10-05T10:00:00.000Z");
    expect(values[2]).toBe("submitted");
    expect(values[6]).toBe("UNISSULA");
    expect(values[11]).toBe("2048");
    expect(values[15]).toBe("4096");
  });

  it("mengisi kolom Milestone 6 dan 7 dengan string kosong, bukan angka", () => {
    const values = buildSheetRow(record);

    expect(values[17]).toBe("");
    expect(values[18]).toBe("");
    expect(values[19]).toBe("");
    expect(values[20]).toBe("");
  });

  it("mengisi sel kosong ketika file belum ada", () => {
    const values = buildSheetRow({
      ...record,
      status: "failed",
      errorCode: "DRIVE_UPLOAD_FAILED",
      instagramFile: null,
      paymentFile: null,
    });

    expect(values[8]).toBe("");
    expect(values[11]).toBe("");
    expect(values[21]).toBe("DRIVE_UPLOAD_FAILED");
  });
});

describe("parseSheetRow", () => {
  it("membaca kembali baris dengan kolom yang sama", () => {
    const values = buildSheetRow(record);
    const parsed = parseSheetRow(values, 2);

    expect(parsed.rowNumber).toBe(2);
    expect(parsed.registrationId).toBe("CF2026-7F3K9Q");
    expect(parsed.email).toBe("siti.rahma@email.com");
    expect(parsed.whatsappNumber).toBe("081234567890");
    expect(parsed.status).toBe("submitted");
    expect(parsed.affiliation).toBe("UNISSULA");
    expect(parsed.instagramFileId).toBe("drive-instagram-id");
    expect(parsed.paymentFileId).toBe("drive-payment-id");
  });

  it("tidak melempar error untuk baris kosong", () => {
    const parsed = parseSheetRow([], 3);

    expect(parsed.status).toBeUndefined();
    expect(parsed.affiliation).toBeUndefined();
    expect(parsed.registrationId).toBe("");
  });

  it("menolak status yang tidak dikenal", () => {
    const parsed = parseSheetRow(
      [...SHEET_COLUMNS].map((_, index) => (index === 2 ? "weird" : "")),
      4,
    );

    expect(parsed.status).toBeUndefined();
  });
});

describe("findMissingHeaderColumns", () => {
  it("mengembalikan daftar kosong bila header lengkap", () => {
    expect(findMissingHeaderColumns([...SHEET_COLUMNS])).toEqual([]);
  });

  it("melaporkan kolom yang belum ada", () => {
    const missing = findMissingHeaderColumns([
      "registration_id",
      "submitted_at",
    ]);

    expect(missing).toContain("status");
    expect(missing).toContain("email");
    expect(missing).not.toContain("registration_id");
  });
});
