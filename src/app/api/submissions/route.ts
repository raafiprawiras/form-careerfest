import { NextResponse, type NextRequest } from "next/server";
import { logServerEvent } from "@/lib/submissions/log";
import {
  SubmissionProviderError,
  SubmissionRejectedError,
  processSubmission,
} from "@/lib/submissions/service";
import {
  ERROR_CODES,
  apiError,
  classifyServerError,
} from "@/lib/submissions/errors";
import type { SubmissionInput } from "@/lib/submissions/types";

/**
 * POST /api/submissions
 *
 * Satu request `multipart/form-data` berisi metadata peserta dan dua file
 * (spesifikasi bagian 6.1). Seluruh kerja Google terjadi di server; tidak ada
 * kredensial atau token yang dikirim ke browser.
 *
 * Batas ukuran body diperiksa dari `Content-Length` agar request terlalu besar
 * ditolak sebelum dimuat ke memori. Ukuran per file tetap divalidasi lagi di
 * server dengan batas 5 MB.
 */

export const runtime = "nodejs";

/** Batas longgar: dua file 5 MB plus overhead multipart. */
const MAX_BODY_BYTES = 12 * 1024 * 1024;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(apiError(ERROR_CODES.BAD_REQUEST), { status: 400 });
  }

  const declaredLength = Number.parseInt(
    request.headers.get("content-length") ?? "0",
    10,
  );
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json(apiError(ERROR_CODES.FILE_TOO_LARGE), {
      status: 413,
    });
  }

  const idempotencyKey = request.headers.get("x-idempotency-key")?.trim() ?? "";
  if (idempotencyKey.length === 0 || idempotencyKey.length > 200) {
    return NextResponse.json(apiError(ERROR_CODES.BAD_REQUEST), { status: 400 });
  }

  let payload: SubmissionInput;
  try {
    payload = await parseSubmissionForm(request);
  } catch {
    logServerEvent("request_parse_failed", {});
    return NextResponse.json(apiError(ERROR_CODES.BAD_REQUEST), { status: 400 });
  }

  try {
    const result = await processSubmission({ idempotencyKey, payload });

    // Hanya tiga field ini yang dikembalikan (spesifikasi 6.1). Nomor WhatsApp
    // sengaja tidak dikirim ulang ke browser.
    return NextResponse.json(
      {
        status: result.status,
        registration_id: result.registrationId,
        submitted_at: result.submittedAt,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof SubmissionRejectedError) {
      logServerEvent("submission_rejected", { error_code: error.code });

      const statusCode =
        error.code === ERROR_CODES.DUPLICATE_EMAIL ? 409 : 400;
      return NextResponse.json(
        apiError(error.code, { fields: error.fields, message: error.message }),
        { status: statusCode },
      );
    }

    if (error instanceof SubmissionProviderError) {
      logServerEvent("submission_failed", { error_code: error.code });
      return NextResponse.json(apiError(error.code), { status: 502 });
    }

    logServerEvent("submission_unhandled", {
      error_code: classifyServerError(error),
      error_name: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(apiError(classifyServerError(error)), {
      status: 500,
    });
  }
}

/** Cek kesehatan sederhana untuk route. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { status: "ok", message: "Route submissions aktif." },
    { status: 200 },
  );
}

async function parseSubmissionForm(
  request: NextRequest,
): Promise<SubmissionInput> {
  const formData = await request.formData();

  const text = (key: string): string => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };

  const file = async (key: string): Promise<Uint8Array | null> => {
    const value = formData.get(key);
    if (!(value instanceof File)) return null;
    if (value.size === 0) return new Uint8Array(0);
    return new Uint8Array(await value.arrayBuffer());
  };

  return {
    consent: text("consent") === "true",
    fullName: text("fullName"),
    email: text("email"),
    whatsappNumber: text("whatsapp"),
    affiliation: text("affiliation"),
    instagramProfileUrl: text("instagramUrl"),
    instagramFile: await file("instagram_file"),
    paymentFile: await file("payment_file"),
  };
}
