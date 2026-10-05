/**
 * Uji submit dummy ke API Career Fest (lokal atau produksi).
 * Pemakaian: node scripts/test-local-submission.mjs [email] [baseUrl]
 */
import { readFileSync } from "node:fs";

const boundary = "----careerfest-local-" + Date.now();
const email = process.argv[2] ?? `dummy-careerfest-00${Date.now() % 10}@example.com`;
const baseUrl = process.argv[3] ?? "http://localhost:3000";
const jpegPath = "C:/Users/Aspire 7/AppData/Local/Temp/opencode/dummy-instagram.jpg";
const jpeg = readFileSync(jpegPath);

function field(name, value) {
  return `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
}

function filePart(name) {
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="dummy.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
  );
  return Buffer.concat([head, jpeg, Buffer.from("\r\n")]);
}

const body = Buffer.concat([
  Buffer.from(
    field("consent", "true") +
      field("fullName", "Peserta Lokal Dummy") +
      field("email", email) +
      field("whatsapp", "081234567890") +
      field("affiliation", "Umum") +
      field("instagramUrl", "https://instagram.com/peserta_dummy"),
  ),
  filePart("instagram_file"),
  filePart("payment_file"),
  Buffer.from(`--${boundary}--\r\n`),
]);

const response = await fetch(`${baseUrl}/api/submissions`, {
  method: "POST",
  headers: {
    "content-type": `multipart/form-data; boundary=${boundary}`,
    "x-idempotency-key": "local-test-" + Date.now(),
  },
  body,
});

console.log("HTTP", response.status);
console.log(await response.text());
