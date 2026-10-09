import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  AppsScriptError,
  checkInViaAppsScript,
  isAppsScriptConfigured,
} from "@/lib/apps-script";

/**
 * POST /api/checkin
 *
 * Dipanggil halaman /scan di HP panitia. Body JSON:
 *   { token, pin, scannerName, scanId }
 *
 * Route ini hanya meneruskan ke Apps Script, yang menjadi satu-satunya tempat
 * keputusan hadir / sudah dipakai. PIN dicek di Apps Script, bukan di sini.
 */

export const runtime = "nodejs";

const MAX_FIELD = 200;

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ status: "error", code: "BAD_REQUEST" }, { status: 400 });
  }

  const str = (key: string): string => {
    const value = body[key];
    return typeof value === "string" ? value.trim().slice(0, MAX_FIELD) : "";
  };

  const token = str("token");
  const pin = str("pin");
  const scanId = str("scanId");
  const scannerName = str("scannerName").slice(0, 60) || "Panitia";

  if (!token || !pin || !scanId) {
    return NextResponse.json({ status: "error", code: "BAD_REQUEST" }, { status: 400 });
  }

  if (!isAppsScriptConfigured()) {
    return NextResponse.json({ status: "error", code: "CONFIG_ERROR" }, { status: 500 });
  }

  // Penghitung PIN salah di Apps Script dipisah per pengirim. IP di-hash agar
  // alamat aslinya tidak tersimpan di Apps Script.
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  const clientKey = createHash("sha256").update(ip).digest("hex").slice(0, 16);

  try {
    const outcome = await checkInViaAppsScript({
      token,
      pin,
      scannerName,
      scanId,
      clientKey,
    });
    return NextResponse.json(outcome, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    const code = error instanceof AppsScriptError ? error.code : "PROVIDER_ERROR";
    return NextResponse.json({ status: "error", code }, { status: 502 });
  }
}