/**
 * Verifikasi CAREERFEST_API_SECRET lokal terhadap Apps Script.
 *
 * Pemakaian:
 *   node scripts/verify-apps-script-secret.mjs
 *
 * Skrip ini HANYA mencetak preview tersamarkan (4 karakter awal, 4 akhir,
 * dan panjang). Nilai lengkap secret tidak pernah dicetak.
 */

import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");

function readEnv(key) {
  const match = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match?.[1]?.trim() ?? "";
}

const url = readEnv("APPS_SCRIPT_WEB_APP_URL");
const secret = readEnv("CAREERFEST_API_SECRET");
const email = process.argv[2] ?? "dummy-careerfest-001@example.com";

if (!url || !secret) {
  console.log("APPS_SCRIPT_WEB_APP_URL atau CAREERFEST_API_SECRET kosong di .env.local");
  process.exit(1);
}

const preview = `${secret.slice(0, 4)}...${secret.slice(-4)} (panjang ${secret.length})`;
console.log(`Secret lokal : ${preview}`);
console.log(`Endpoint     : ${url}`);
console.log(`Email tes    : ${email}`);

const jpeg = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]).toString("base64");

const payload = {
  secret,
  idempotencyKey: "verify-" + Date.now(),
  consent: true,
  fullName: "Peserta Dummy Career Fest",
  email,
  whatsappNumber: "081234567890",
  affiliation: "Umum",
  instagramProfileUrl: "https://instagram.com/peserta_dummy",
  instagramFile: { data: jpeg },
  paymentFile: { data: jpeg },
};

try {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  console.log(`HTTP ${response.status}`);
  console.log(await response.text());
} catch (error) {
  console.log(`FETCH_ERROR ${error.message}`);
}
