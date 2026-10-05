import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Uji perilaku route tanpa memanggil Google sungguhan.
 *
 * Modul service di-mock supaya pemeriksaan tetap pada tanggung jawab route:
 * parsing multipart, header idempotency, kode status, dan bentuk response.
 * Integrasi Google diuji terpisah memakai Sheet dan folder testing.
 */

/** Guard `server-only` hanya berlaku di build client, jadi di-mock saat test. */
vi.mock("server-only", () => ({}));

const processSubmissionMock = vi.fn();

vi.mock("@/lib/submissions/service", () => ({
  processSubmission: (input: unknown) => processSubmissionMock(input),
  SubmissionRejectedError: class SubmissionRejectedError extends Error {
    constructor(
      readonly code: string,
      readonly fields?: Record<string, string>,
      message?: string,
    ) {
      super(message ?? "");
      this.name = "SubmissionRejectedError";
    }
  },
  SubmissionProviderError: class SubmissionProviderError extends Error {
    constructor(
      readonly code: string,
      message?: string,
    ) {
      super(message ?? "");
      this.name = "SubmissionProviderError";
    }
  },
}));

const { POST, GET } = await import("./route");

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function buildRequest(
  options: {
    withFiles?: boolean;
    /** Kirim body mentah dengan content-type tertentu, untuk uji penolakan. */
    rawContentType?: string;
  } = {},
): NextRequest {
  const withFiles = options.withFiles ?? true;
  const formData = new FormData();

  formData.append("consent", "true");
  formData.append("fullName", "Siti Rahma");
  formData.append("email", "siti.rahma@email.com");
  formData.append("whatsapp", "081234567890");
  formData.append("affiliation", "UNISSULA");
  formData.append("instagramUrl", "https://instagram.com/siti.rahma");

  if (withFiles) {
    formData.append(
      "instagram_file",
      new File([PNG], "bukti.png", { type: "image/png" }),
    );
    formData.append(
      "payment_file",
      new File([PNG], "transfer.png", { type: "image/png" }),
    );
  }

  const headers: Record<string, string> = {
    "x-idempotency-key": "kunci-test-1",
  };
  let body: BodyInit = formData;

  if (options.rawContentType) {
    // Body mentah: content-type diatur eksplisit karena FormData akan
    // menghasilkan boundary sendiri.
    body = JSON.stringify({ salah: "format" });
    headers["content-type"] = options.rawContentType;
  }

  return new NextRequest("http://localhost/api/submissions", {
    method: "POST",
    headers,
    body,
  });
}

describe("POST /api/submissions", () => {
  it("meneruskan metadata dan file ke service", async () => {
    processSubmissionMock.mockResolvedValue({
      status: "submitted",
      registrationId: "CF2026-7F3K9Q",
      submittedAt: "2026-10-05T10:00:00.000Z",
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "submitted",
      registration_id: "CF2026-7F3K9Q",
      submitted_at: "2026-10-05T10:00:00.000Z",
    });

    const call = processSubmissionMock.mock.calls[0]?.[0] as {
      idempotencyKey: string;
      payload: Record<string, unknown>;
    };
    expect(call.idempotencyKey).toBe("kunci-test-1");
    expect(call.payload.fullName).toBe("Siti Rahma");
    expect(call.payload.consent).toBe(true);
    expect(call.payload.instagramFile).toBeInstanceOf(Uint8Array);
    expect(call.payload.paymentFile).toBeInstanceOf(Uint8Array);
  });

  it("tidak mengembalikan nomor WhatsApp", async () => {
    processSubmissionMock.mockResolvedValue({
      status: "submitted",
      registrationId: "CF2026-ABCDEF",
      submittedAt: "2026-10-05T10:00:00.000Z",
    });

    const response = await POST(buildRequest());
    const raw = await response.text();

    expect(raw).not.toContain("081234567890");
  });

  it("mengembalikan 400 saat idempotency key tidak dikirim", async () => {
    const request = buildRequest();
    request.headers.delete("x-idempotency-key");

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("BAD_REQUEST");
  });

  it("mengembalikan 400 saat content-type bukan multipart", async () => {
    const response = await POST(
      buildRequest({ rawContentType: "application/json" }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("BAD_REQUEST");
  });

  it("meneruskan error per field dengan kode 400", async () => {
    const { SubmissionRejectedError } = await import("@/lib/submissions/service");
    processSubmissionMock.mockRejectedValue(
      new SubmissionRejectedError("VALIDATION_FAILED", {
        email: "Format email belum benar.",
      }),
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.fields.email).toBe("Format email belum benar.");
  });

  it("mengembalikan 409 untuk email duplikat", async () => {
    const { SubmissionRejectedError } = await import("@/lib/submissions/service");
    processSubmissionMock.mockRejectedValue(
      new SubmissionRejectedError(
        "DUPLICATE_EMAIL",
        undefined,
        "Pendaftaran dengan email ini sudah terdaftar.",
      ),
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("DUPLICATE_EMAIL");
  });

  it("mengembalikan 502 saat provider gagal", async () => {
    const { SubmissionProviderError } = await import("@/lib/submissions/service");
    processSubmissionMock.mockRejectedValue(
      new SubmissionProviderError("PROVIDER_ERROR"),
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.code).toBe("PROVIDER_ERROR");
    expect(body.message).toContain("Coba lagi");
  });

  it("mengembalikan 500 untuk error tak terduga tanpa membocorkan detail", async () => {
    processSubmissionMock.mockRejectedValue(
      new Error("detail internal yang tidak boleh bocor"),
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("detail internal");
  });
});

describe("GET /api/submissions", () => {
  it("menjawab ok", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });
});
