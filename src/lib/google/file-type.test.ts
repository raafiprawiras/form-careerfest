import { describe, expect, it } from "vitest";
import {
  ALLOWED_MIME_TYPES,
  detectFileType,
  formatBytes,
  validateUploadedFile,
} from "./file-type";

const bytes = (...values: number[]): Uint8Array => new Uint8Array(values);

describe("detectFileType", () => {
  it("mengenali JPEG dari magic bytes", () => {
    // FF D8 FF DB
    expect(detectFileType(bytes(0xff, 0xd8, 0xff, 0xdb, 0, 0, 0, 0))).toEqual({
      mimeType: "image/jpeg",
      extension: "jpg",
    });
  });

  it("mengenali PNG dari signature lengkap", () => {
    // 89 50 4E 47 0D 0A 1A 0A
    expect(
      detectFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    ).toEqual({ mimeType: "image/png", extension: "png" });
  });

  it("mengenali WEBP dari RIFF dan WEBP", () => {
    // "RIFF" + 4 byte ukuran + "WEBP"
    expect(
      detectFileType(
        bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50),
      ),
    ).toEqual({ mimeType: "image/webp", extension: "webp" });
  });

  it("mengenali PDF", () => {
    // "%PDF-"
    expect(detectFileType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31))).toEqual({
      mimeType: "application/pdf",
      extension: "pdf",
    });
  });

  it("menolak file yang hanya punya ekstensi mengkilap", () => {
    // Plain text dengan isi "<html>", bukan magic bytes file gambar.
    expect(detectFileType(bytes(0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e))).toBeNull();
  });
});

describe("validateUploadedFile", () => {
  const pngBytes = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

  it("menerima file yang tipe dan ukurannya benar", () => {
    const result = validateUploadedFile(pngBytes, 5 * 1024 * 1024);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.detected).toEqual({
        mimeType: "image/png",
        extension: "png",
      });
    }
  });

  it("menolak file kosong", () => {
    const result = validateUploadedFile(new Uint8Array(0), 5 * 1024 * 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("kosong");
  });

  it("menolak file melebihi batas", () => {
    const result = validateUploadedFile(pngBytes, 4);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("melebihi");
  });

  it("menolak tipe yang tidak diizinkan", () => {
    // GIF89a
    const gif = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
    const result = validateUploadedFile(gif, 5 * 1024 * 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("Format file belum sesuai");
  });

  it("mencatat MIME yang diizinkan sesuai spesifikasi", () => {
    expect(ALLOWED_MIME_TYPES.sort()).toEqual([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
  });
});

describe("formatBytes", () => {
  it("memakai MB untuk kelipatan megabyte", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
  });

  it("memakai satu desimal untuk nilai tidak bulat", () => {
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });

  it("memakai KB untuk nilai kecil", () => {
    expect(formatBytes(2048)).toBe("2 KB");
  });
});
