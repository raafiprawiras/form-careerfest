/**
 * Career Fest 2026 - Apps Script Web App API
 * (Sheets + Drive backend untuk Next.js /api/submissions)
 *
 * Deploy sebagai Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Script Properties yang wajib:
 *   CAREERFEST_API_SECRET  - secret bersama dengan server Next.js
 *   GOOGLE_SHEETS_ID       - ID spreadsheet
 *   GOOGLE_DRIVE_FOLDER_ID - ID folder Drive tujuan upload
 *   GOOGLE_SHEETS_NAME     - nama tab (opsional, default: Registrations)
 *
 * Script Properties tambahan untuk QR + absensi:
 *   CHECKIN_BASE_URL       - alamat website form TANPA garis miring di akhir,
 *                            contoh: https://careerfest.vercel.app
 *   CHECKIN_PIN            - PIN rahasia panitia untuk scan (min. 6 karakter)
 *   WA_GROUP_URL           - (opsional) link grup WA di email
 *   EVENT_NAME             - (opsional) default: Career Fest 2026
 *   EVENT_INFO             - (opsional) teks tanggal/lokasi di email
 *   QR_SIGNING_SECRET      - (opsional) kunci tanda tangan QR; kalau kosong
 *                            memakai CAREERFEST_API_SECRET. JANGAN diganti
 *                            setelah email QR terkirim, QR lama jadi tidak valid.
 *
 * Fungsi utilitas yang bisa dijalankan manual dari editor:
 *   testSendQrToMe        - kirim email QR contoh ke akun pemilik script
 *   sendPendingQr         - kirim email QR ke peserta yang belum menerimanya
 *   reformatSheet         - paksa format ulang seluruh tampilan Sheet
 *   formatAllExistingRows - beri link Drive + warna untuk semua baris lama
 */

var MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
// Catatan: kolom instagram_profile_url dihapus — peserta tidak lagi memasukkan
// link IG; cukup screenshot bukti follow. Link file Drive otomatis dibuatkan
// hyperlink di kolom nama file.
var HEADERS = [
  "registration_id", "submitted_at", "status", "full_name", "email",
  "whatsapp_number", "affiliation",
  "instagram_file_id", "instagram_file_name", "instagram_mime_type",
  "instagram_size_bytes",
  "payment_file_id", "payment_file_name", "payment_mime_type",
  "payment_size_bytes",
  "duplicate_flag",
  "barcode_status", "attendance_status", "checked_in_at", "checked_in_by",
  "error_code", "notes"
];
var ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

// Nomor kolom (mulai 1) berdasarkan nama header, supaya tidak salah hitung.
var COL = {};
for (var ci = 0; ci < HEADERS.length; ci++) COL[HEADERS[ci]] = ci + 1;

var DEFAULT_WA_GROUP = "https://chat.whatsapp.com/KImqUyLgRY6KBggOAl22y0";
var DEFAULT_EVENT_NAME = "Career Fest 2026";
var MAX_PIN_FAILS = 10;      // percobaan PIN salah per pengirim
var PIN_FAIL_WINDOW_S = 600; // dalam 10 menit

// Warna tema Peacock Feather (selaras dengan form).
var COLOR_HEADER_BG = "#4d52b4";
var COLOR_HEADER_FG = "#ffffff";
var COLOR_SUBMITTED = "#d9ead3";
var COLOR_FAILED = "#f4cccc";
var COLOR_DRAFT = "#fff2cc";
var COLOR_FLAG = "#fce5cd";
var COLOR_BORDER = "#dbe3e8";
var COLOR_LINK = "#1a73e8";

function doGet() {
  formatOnceIfEnabled();
  return json({ status: "ok", service: "career-fest-api" });
}

function doPost(e) {
  var uploadedIds = [];
  try {
    var body = parseBody(e);
    requireSecret(body.secret);
    if (body.action === "checkin") return handleCheckin(body);
    return handleRegistration(body, uploadedIds);
  } catch (error) {
    if (error && error.code === "DUPLICATE_EMAIL") {
      return json({ status: "error", code: error.code, retryable: false });
    }
    cleanup(uploadedIds);
    // detail hanya untuk diagnosis pengembangan; tidak memuat secret.
    var detail = "";
    try { detail = String(error && error.message ? error.message : "").slice(0, 200); } catch (ignored) {}
    return json({ status: "error", code: error && error.code ? error.code : "PROVIDER_ERROR", retryable: true, detail: detail });
  }
}

/* ------------------------------------------------------------------ */
/* Pendaftaran                                                         */
/* ------------------------------------------------------------------ */

function handleRegistration(body, uploadedIds) {
  var cache = CacheService.getScriptCache();

  // Idempotency: kunci sama mengembalikan hasil yang sama, sehingga retry
  // yang responsnya sempat hilang tidak membuat peserta bingung.
  var idempotencyKey = String(body.idempotencyKey || "").slice(0, 200);
  if (idempotencyKey) {
    var cached = cache.get("idem:" + idempotencyKey);
    if (cached) return json(JSON.parse(cached));
  }

  var input = validateInput(body);
  var result;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet();
    ensureHeaders(sheet);
    formatOnceIfEnabled(sheet);
    var rows = sheet.getDataRange().getValues();
    var duplicate = findDuplicate(rows, input.email, input.whatsappNumber);
    if (duplicate.emailRow && duplicate.emailRow.status === "submitted") {
      return json({ status: "error", code: "DUPLICATE_EMAIL", retryable: false });
    }

    var registrationId = duplicate.emailRow
      ? duplicate.emailRow.registrationId
      : createRegistrationId(rows);
    var submittedAt = new Date().toISOString();
    var instagram = uploadFile(input.instagramFile, registrationId, "instagram");
    uploadedIds.push(instagram.id);
    var payment;
    try {
      payment = uploadFile(input.paymentFile, registrationId, "payment");
      uploadedIds.push(payment.id);
    } catch (paymentError) {
      cleanup(uploadedIds);
      throw providerError("DRIVE_UPLOAD_FAILED");
    }

    var row = [
      registrationId, submittedAt, "submitted", input.fullName, input.email,
      input.whatsappNumber, input.affiliation,
      instagram.id, instagram.name, instagram.mimeType, instagram.size,
      payment.id, payment.name, payment.mimeType, payment.size,
      duplicate.whatsappRow ? "duplicate_whatsapp_suspected" : "",
      "", "", "", "", "", ""
    ];
    var rowNumber;
    if (duplicate.emailRow) {
      rowNumber = duplicate.emailRow.row;
      sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([row]);
    } else {
      sheet.appendRow(row);
      rowNumber = sheet.getLastRow();
    }
    formatRow(sheet, rowNumber, row);

    result = { status: "submitted", registration_id: registrationId, submitted_at: submittedAt };
  } finally {
    lock.releaseLock();
  }

  if (idempotencyKey) cache.put("idem:" + idempotencyKey, JSON.stringify(result), 21600);

  // Email QR dikirim SETELAH lock dilepas (supaya pendaftar lain tidak antre)
  // dan kegagalannya tidak boleh membatalkan pendaftaran yang sudah tersimpan.
  try {
    deliverQr(result.registration_id);
  } catch (mailError) {
    Logger.log("deliverQr gagal: " + mailError);
  }
  return json(result);
}

/* ------------------------------------------------------------------ */
/* Absensi: panitia memindai QR dengan kamera HP biasa                 */
/* ------------------------------------------------------------------ */

function handleCheckin(body) {
  var cache = CacheService.getScriptCache();

  // Kirim ulang karena jaringan putus -> hasil yang sama, bukan "sudah dipakai".
  var scanId = String(body.scanId || "").slice(0, 100);
  if (scanId) {
    var cached = cache.get("scan:" + scanId);
    if (cached) return json(JSON.parse(cached));
  }

  // Batasi tebak-tebak PIN: 10 kali salah / 10 menit per pengirim.
  var clientKey = String(body.clientKey || "unknown").replace(/[^a-zA-Z0-9]/g, "").slice(0, 32) || "unknown";
  var failKey = "pinfail:" + clientKey;
  var fails = Number(cache.get(failKey) || 0);
  if (fails >= MAX_PIN_FAILS) return json({ status: "error", code: "RATE_LIMITED" });

  var expectedPin = PropertiesService.getScriptProperties().getProperty("CHECKIN_PIN");
  if (!expectedPin) return json({ status: "error", code: "CONFIG_ERROR" });
  if (!safeEqual(String(body.pin || ""), expectedPin)) {
    cache.put(failKey, String(fails + 1), PIN_FAIL_WINDOW_S);
    return json({ status: "error", code: "INVALID_PIN" });
  }

  var registrationId = parseQrToken(String(body.token || "").trim());
  if (!registrationId) return finishScan(cache, scanId, { status: "error", code: "INVALID_QR" });

  var scanner = cleanScannerName(body.scannerName);
  var result;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet();
    var rowNumber = findRowById(sheet, registrationId);
    if (!rowNumber) {
      result = { status: "error", code: "NOT_FOUND" };
    } else {
      var row = sheet.getRange(rowNumber, 1, 1, HEADERS.length).getValues()[0];
      var fullName = String(row[COL.full_name - 1]);
      if (String(row[COL.status - 1]) !== "submitted") {
        result = { status: "error", code: "NOT_ELIGIBLE", registration_id: registrationId };
      } else if (String(row[COL.attendance_status - 1]).toLowerCase() === "hadir") {
        result = {
          status: "error", code: "ALREADY_USED", registration_id: registrationId,
          full_name: fullName,
          checked_in_at: toIso(row[COL.checked_in_at - 1]),
          checked_in_by: String(row[COL.checked_in_by - 1] || "")
        };
      } else {
        var now = new Date();
        sheet.getRange(rowNumber, COL.attendance_status, 1, 3).setValues([["hadir", now, scanner]]);
        sheet.getRange(rowNumber, COL.checked_in_at).setNumberFormat("yyyy-mm-dd hh:mm:ss");
        SpreadsheetApp.flush();
        result = {
          status: "checked_in", registration_id: registrationId, full_name: fullName,
          affiliation: String(row[COL.affiliation - 1]), checked_in_at: now.toISOString()
        };
      }
    }
  } finally {
    lock.releaseLock();
  }
  return finishScan(cache, scanId, result);
}

function finishScan(cache, scanId, result) {
  if (scanId) cache.put("scan:" + scanId, JSON.stringify(result), 21600);
  return json(result);
}

function cleanScannerName(value) {
  // Buang awalan = + - @ agar nama tidak dibaca Sheets sebagai rumus.
  var name = String(value || "").replace(/^[=+\-@\s]+/, "").slice(0, 60);
  return name || "Panitia";
}

function toIso(value) {
  if (value instanceof Date) return value.toISOString();
  return String(value || "");
}

/* ------------------------------------------------------------------ */
/* QR token (ditandatangani HMAC, tidak bisa ditebak / dipalsukan)     */
/* ------------------------------------------------------------------ */

function qrSignature(registrationId) {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty("QR_SIGNING_SECRET") || props.getProperty("CAREERFEST_API_SECRET");
  if (!key) throw providerError("CONFIG_ERROR");
  var bytes = Utilities.computeHmacSha256Signature("careerfest-qr-v1:" + registrationId, key);
  var hex = "";
  for (var i = 0; i < bytes.length; i++) hex += ("0" + (bytes[i] & 0xFF).toString(16)).slice(-2);
  return hex.substring(0, 20);
}

function makeQrToken(registrationId) {
  return registrationId + "." + qrSignature(registrationId);
}

/** Mengembalikan registration ID bila token sah, selain itu null. */
function parseQrToken(token) {
  var match = /^(CF2026-[A-Z0-9]{6})\.([0-9a-f]{20})$/.exec(token);
  if (!match) return null;
  if (!safeEqual(match[2], qrSignature(match[1]))) return null;
  return match[1];
}

function safeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ------------------------------------------------------------------ */
/* Request handling                                                    */
/* ------------------------------------------------------------------ */

function parseBody(e) {
  if (!e || !e.postData || !e.postData.contents) throw providerError("BAD_REQUEST");
  var body = JSON.parse(e.postData.contents);
  if (!body || typeof body !== "object") throw providerError("BAD_REQUEST");
  return body;
}

function requireSecret(secret) {
  var expected = PropertiesService.getScriptProperties().getProperty("CAREERFEST_API_SECRET");
  if (!expected || secret !== expected) throw providerError("UNAUTHORIZED");
}

function validateInput(body) {
  var text = function (key) { return String(body[key] || "").trim(); };
  var input = {
    fullName: text("fullName"), email: text("email").toLowerCase(),
    whatsappNumber: normalizeWhatsapp(text("whatsappNumber")),
    affiliation: text("affiliation"),
    instagramFile: body.instagramFile, paymentFile: body.paymentFile
  };
  // Buang awalan = + - @ pada nama agar tidak dibaca Sheets sebagai rumus.
  input.fullName = input.fullName.replace(/^[=+\-@\s]+/, "");
  if (body.consent !== true || input.fullName.length < 3 || input.fullName.length > 100 ||
      /^[=+\-@]/.test(input.email) ||
      !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(input.email) ||
      !/^\d{9,15}$/.test(input.whatsappNumber) ||
      (input.affiliation !== "UNISSULA" && input.affiliation !== "Umum")) {
    throw providerError("VALIDATION_FAILED");
  }
  input.instagramFile = validateFile(input.instagramFile);
  input.paymentFile = validateFile(input.paymentFile);
  return input;
}

function normalizeWhatsapp(value) {
  var digits = value.replace(/\D/g, "");
  if (digits.indexOf("62") === 0) return "0" + digits.substring(2);
  if (digits.length > 0 && digits.indexOf("0") !== 0) return "0" + digits;
  return digits;
}

function validateFile(file) {
  if (!file || !file.data) throw providerError("VALIDATION_FAILED");
  var bytes = Utilities.base64Decode(file.data);
  if (bytes.length > MAX_UPLOAD_BYTES) throw providerError("FILE_TOO_LARGE");
  var detected = detectFile(bytes);
  if (!detected) throw providerError("INVALID_FILE_TYPE");
  return { bytes: bytes, mimeType: detected.mimeType, extension: detected.extension };
}

function detectFile(rawBytes) {
  // Utilities.base64Decode dapat mengembalikan byte bertanda (-128..127)
  // tergantung runtime; normalisasi ke 0..255 agar magic bytes selalu cocok.
  var bytes = rawBytes.map(function (b) { return b & 0xFF; });
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { mimeType: "image/jpeg", extension: "jpg" };
  if (bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return { mimeType: "image/png", extension: "png" };
  if (bytes.length >= 12 && String.fromCharCode.apply(null, bytes.slice(0, 4)) === "RIFF" && String.fromCharCode.apply(null, bytes.slice(8, 12)) === "WEBP") return { mimeType: "image/webp", extension: "webp" };
  if (bytes.length >= 5 && String.fromCharCode.apply(null, bytes.slice(0, 5)) === "%PDF-") return { mimeType: "application/pdf", extension: "pdf" };
  return null;
}

/* ------------------------------------------------------------------ */
/* Drive & Sheets                                                      */
/* ------------------------------------------------------------------ */

function uploadFile(file, registrationId, slot) {
  var name = "CF2026-" + registrationId.replace(/^CF2026-/, "") + "-" + slot + "." + file.extension;
  var blob = Utilities.newBlob(file.bytes, file.mimeType, name);
  var created = DriveApp.getFolderById(getProperty("GOOGLE_DRIVE_FOLDER_ID")).createFile(blob);
  return { id: created.getId(), name: created.getName(), mimeType: file.mimeType, size: file.bytes.length };
}

function getSheet() {
  var spreadsheet = SpreadsheetApp.openById(getProperty("GOOGLE_SHEETS_ID"));
  var name = PropertiesService.getScriptProperties().getProperty("GOOGLE_SHEETS_NAME") || "Registrations";
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  return sheet;
}

function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  } else if (sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0].join("|") !== HEADERS.join("|")) {
    throw providerError("SHEET_HEADER_INVALID");
  }
}

function findDuplicate(rows, email, whatsapp) {
  var result = { emailRow: null, whatsappRow: null };
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][4]).toLowerCase() === email) result.emailRow = { row: i + 1, registrationId: rows[i][0], status: rows[i][2] };
    if (String(rows[i][5]) === whatsapp) result.whatsappRow = { row: i + 1 };
  }
  return result;
}

function createRegistrationId(rows) {
  var taken = {};
  for (var i = 1; i < rows.length; i++) taken[rows[i][0]] = true;
  var id;
  do { id = "CF2026-" + randomString(6); } while (taken[id]);
  return id;
}

function randomString(length) {
  var value = "";
  for (var i = 0; i < length; i++) value += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  return value;
}

function cleanup(ids) {
  ids.forEach(function (id) { try { DriveApp.getFileById(id).setTrashed(true); } catch (ignored) {} });
}

function getProperty(name) {
  var value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) throw providerError("CONFIG_ERROR");
  return value;
}

function providerError(code) { var error = new Error(code); error.code = code; return error; }
function json(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }

/* ------------------------------------------------------------------ */
/* Tampilan Sheet (font, warna, border, link, kolom tersembunyi)       */
/* ------------------------------------------------------------------ */

/**
 * Memformat seluruh tampilan Sheet sekali saja.
 * Aman dipanggil berulang: hanya berjalan jika belum pernah sukses.
 */
function formatOnceIfEnabled(sheet) {
  try {
    var props = PropertiesService.getScriptProperties();
    // V4: kolom absensi (Q-T) ditampilkan + warna status QR / hadir.
    if (props.getProperty("CF_FORMAT_V4")) return;
    applySheetFormatting(sheet || getSheet());
    props.setProperty("CF_FORMAT_V4", "1");
  } catch (ignored) {
    // Kegagalan formatting tidak boleh menggagalkan request utama.
  }
}

/** Paksa format ulang: jalankan dari editor Apps Script. */
function reformatSheet() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty("CF_FORMAT_V4");
  var sheet = getSheet();
  applySheetFormatting(sheet);
  props.setProperty("CF_FORMAT_V4", "1");
  formatAllExistingRows();
}

/** Memberi link Drive, warna status, dan border untuk semua baris lama. */
function formatAllExistingRows() {
  var sheet = getSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  for (var i = 0; i < values.length; i++) {
    formatRow(sheet, i + 2, values[i]);
  }
}

/** Format satu baris: link Drive, link Instagram, warna status, border. */
function formatRow(sheet, rowNumber, row) {
  if (!row || row.length < HEADERS.length) return;

  sheet.getRange(rowNumber, 1, 1, HEADERS.length)
    .setBorder(null, null, null, null, true, true, COLOR_BORDER, SpreadsheetApp.BorderStyle.SOLID)
    .setVerticalAlignment("middle");

  // Kolom I (9) dan M (13): nama file jadi link buka file Drive.
  driveLinkCell(sheet, rowNumber, 9, row[7], row[8]);
  driveLinkCell(sheet, rowNumber, 13, row[11], row[12]);

  // Warna status (kolom C).
  var status = String(row[2] || "");
  var statusCell = sheet.getRange(rowNumber, 3);
  if (status === "submitted") statusCell.setBackground(COLOR_SUBMITTED).setFontColor("#1e4620").setFontWeight("bold");
  else if (status === "failed") statusCell.setBackground(COLOR_FAILED).setFontColor("#990000").setFontWeight("bold");
  else if (status === "draft") statusCell.setBackground(COLOR_DRAFT).setFontColor("#7f6000");

  // Flag WhatsApp ganda (kolom P) disorot agar panitia mudah menemukannya.
  if (String(row[15] || "") !== "") {
    sheet.getRange(rowNumber, 16).setBackground(COLOR_FLAG).setFontColor("#8a5000").setFontWeight("bold");
  }

  // Registration ID ditebalkan sebagai kunci visual baris.
  sheet.getRange(rowNumber, 1).setFontWeight("bold").setHorizontalAlignment("center");
}

function driveLinkCell(sheet, rowNumber, nameColumn, fileId, fileName) {
  if (!fileId) return;
  var url = "https://drive.google.com/file/d/" + fileId + "/view";
  var label = String(fileName || "Buka file Drive").replace(/"/g, "");
  if (!label) label = "Buka file Drive";
  sheet.getRange(rowNumber, nameColumn).setFormula('=HYPERLINK("' + url + '","' + label + '")');
}

function applySheetFormatting(sheet) {
  // Pastikan cukup baris agar format & conditional rules mencakup masa depan.
  if (sheet.getMaxRows() < 500) sheet.insertRowsAfter(sheet.getMaxRows(), 500 - sheet.getMaxRows());

  // Header: indigo brand, teks putih tebal, tengah, wrap.
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setBackground(COLOR_HEADER_BG).setFontColor(COLOR_HEADER_FG)
    .setFontWeight("bold").setFontSize(10).setFontFamily("Google Sans")
    .setHorizontalAlignment("center").setVerticalAlignment("middle").setWrap(true);

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);

  // Lebar kolom (piksel), urut sesuai HEADERS.
  var widths = [130, 155, 95, 180, 210, 130, 105,
                90, 200, 110, 100,
                90, 200, 110, 100,
                150,
                110, 120, 130, 110,
                110, 220];
  for (var i = 0; i < widths.length; i++) sheet.setColumnWidth(i + 1, widths[i]);

  // Font tubuh tabel.
  sheet.getRange(2, 1, sheet.getMaxRows() - 1, HEADERS.length)
    .setFontFamily("Google Sans").setFontSize(10);

  // Kolom F (whatsapp_number) dipaksa teks agar awalan `08` tidak hilang
  // karena konversi angka otomatis Google Sheets.
  sheet.getRange(2, 6, sheet.getMaxRows() - 1, 1).setNumberFormat("@");

  // Sembunyikan kolom teknis/lanjutan; data tetap tersimpan.
  // Disembunyikan: instagram_file_id, mime/size instagram, payment_file_id,
  // mime/size payment, barcode_status, kolom absensi partner, error_code.
  // Kolom terlihat: data peserta (A-G), nama file IG (I), nama file transfer
  // (M) sebagai link Drive, flag duplikat (P), dan notes (V).
  // Kolom QR/absensi (17-20) sekarang DITAMPILKAN agar panitia bisa memantau.
  try { sheet.showColumns(COL.barcode_status, 4); } catch (ignored) {}
  var hidden = [8, 10, 11, 12, 14, 15, 21];
  for (var h = 0; h < hidden.length; h++) {
    try { sheet.hideColumns(hidden[h]); } catch (ignored) {}
  }

  // Conditional formatting untuk status dan flag duplikat.
  var statusRange = sheet.getRange(2, 3, sheet.getMaxRows() - 1, 1);
  var flagRange = sheet.getRange(2, 16, sheet.getMaxRows() - 1, 1);
  var barcodeRange = sheet.getRange(2, COL.barcode_status, sheet.getMaxRows() - 1, 1);
  var attendRange = sheet.getRange(2, COL.attendance_status, sheet.getMaxRows() - 1, 1);
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("submitted")
      .setBackground(COLOR_SUBMITTED).setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("failed")
      .setBackground(COLOR_FAILED).setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("draft")
      .setBackground(COLOR_DRAFT).setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextContains("duplicate_whatsapp")
      .setBackground(COLOR_FLAG).setRanges([flagRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("sent")
      .setBackground(COLOR_SUBMITTED).setRanges([barcodeRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith("failed")
      .setBackground(COLOR_FAILED).setRanges([barcodeRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("hadir")
      .setBackground(COLOR_SUBMITTED).setBold(true).setRanges([attendRange]).build()
  ]);
}

/* ------------------------------------------------------------------ */
/* Email QR                                                            */
/* ------------------------------------------------------------------ */

function findRowById(sheet, registrationId) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var ids = sheet.getRange(1, 1, last, 1).getValues();
  for (var i = 1; i < ids.length; i++) {
    if (String(ids[i][0]) === registrationId) return i + 1;
  }
  return 0;
}

function optionalProperty(name) {
  return PropertiesService.getScriptProperties().getProperty(name) || "";
}

/** Kirim email QR untuk satu pendaftar lalu catat hasilnya di kolom barcode_status. */
function deliverQr(registrationId) {
  var sheet = getSheet();
  var rowNumber = findRowById(sheet, registrationId);
  if (!rowNumber) return;
  var row = sheet.getRange(rowNumber, 1, 1, HEADERS.length).getValues()[0];
  if (String(row[COL.status - 1]) !== "submitted") return;

  var outcome = sendQrEmail(String(row[0]), String(row[COL.full_name - 1]), String(row[COL.email - 1]));

  var target = findRowById(sheet, registrationId) || rowNumber;
  sheet.getRange(target, COL.barcode_status).setValue(outcome.status);
  if (outcome.note) {
    var notesCell = sheet.getRange(target, COL.notes);
    var existing = String(notesCell.getValue() || "");
    notesCell.setValue(existing ? existing + "; " + outcome.note : outcome.note);
  }
}

/** Mengembalikan { status: "sent" | "failed:...", note? }. Tidak pernah melempar error. */
function sendQrEmail(registrationId, fullName, email) {
  var base = optionalProperty("CHECKIN_BASE_URL").replace(/\/+$/, "");
  if (!base) return { status: "failed:config", note: "CHECKIN_BASE_URL belum diisi" };

  var scanUrl = base + "/scan?t=" + encodeURIComponent(makeQrToken(registrationId));
  var qrBlob = fetchQrBlob(scanUrl, registrationId + "-qr.png");
  if (!qrBlob) return { status: "failed:qr", note: "gagal membuat gambar QR" };

  try {
    if (MailApp.getRemainingDailyQuota() < 1) {
      return { status: "failed:quota", note: "kuota email harian habis" };
    }
  } catch (ignored) {}

  var eventName = optionalProperty("EVENT_NAME") || DEFAULT_EVENT_NAME;
  var content = buildQrEmail({
    registrationId: registrationId, fullName: fullName, eventName: eventName,
    eventInfo: optionalProperty("EVENT_INFO"),
    waGroup: optionalProperty("WA_GROUP_URL") || DEFAULT_WA_GROUP,
    logoUrl: base + "/logo-careerfest.png"
  });

  try {
    MailApp.sendEmail({
      to: email,
      subject: "QR Absensi " + eventName + " - " + registrationId,
      body: content.text,
      htmlBody: content.html,
      name: eventName,
      inlineImages: { qrcode: qrBlob }
    });
  } catch (error) {
    return { status: "failed:mail", note: String(error && error.message ? error.message : error).slice(0, 150) };
  }
  return { status: "sent" };
}

/** Membuat gambar QR lewat layanan gratis; mencoba penyedia kedua bila yang pertama gagal. */
function fetchQrBlob(text, fileName) {
  var encoded = encodeURIComponent(text);
  var urls = [
    "https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=12&ecc=M&format=png&data=" + encoded,
    "https://quickchart.io/qr?size=400&margin=2&ecc=M&format=png&text=" + encoded
  ];
  for (var i = 0; i < urls.length; i++) {
    try {
      var response = UrlFetchApp.fetch(urls[i], { muteHttpExceptions: true });
      if (response.getResponseCode() !== 200) continue;
      var blob = response.getBlob();
      if (String(blob.getContentType()).indexOf("image/") !== 0) continue;
      return blob.setName(fileName);
    } catch (ignored) {}
  }
  return null;
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildQrEmail(d) {
  var name = escapeHtml(d.fullName);
  var event = escapeHtml(d.eventName);
  var info = d.eventInfo ? '<p style="margin:0 0 16px;font-size:15px;line-height:1.5"><strong>Waktu &amp; tempat:</strong><br>' + escapeHtml(d.eventInfo) + '</p>' : "";

  var html =
    '<div style="background:#e1edd4;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#19344a">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden">' +
    '<tr><td style="background:#0b0e14;padding:20px;text-align:center">' +
    '<img src="' + escapeHtml(d.logoUrl) + '" alt="' + event + '" height="84" style="height:84px;width:auto;border:0">' +
    '</td></tr>' +
    '<tr><td style="padding:24px">' +
    '<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">Pendaftaran berhasil, ' + name + '</h1>' +
    '<p style="margin:0 0 16px;font-size:15px;line-height:1.5">Berikut QR Code absensi Anda untuk ' + event + '. Tunjukkan QR ini kepada panitia saat tiba di lokasi acara.</p>' +
    '<p style="margin:0 0 4px;text-align:center"><img src="cid:qrcode" alt="QR Code absensi" width="260" height="260" style="width:260px;height:260px;border:0"></p>' +
    '<p style="margin:0 0 20px;text-align:center;font-family:Courier New,monospace;font-size:16px;letter-spacing:1px">' + escapeHtml(d.registrationId) + '</p>' +
    info +
    '<ul style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:1.6">' +
    '<li>QR ini bersifat pribadi. Jangan dibagikan atau diunggah ke media sosial.</li>' +
    '<li>QR hanya berlaku satu kali. Setelah dipindai, QR yang sama akan ditolak.</li>' +
    '<li>Simpan email ini atau tangkap layar QR agar mudah dibuka tanpa sinyal.</li>' +
    '</ul>' +
    '<p style="margin:0 0 8px"><a href="' + escapeHtml(d.waGroup) + '" style="display:inline-block;background:#4d52b4;color:#ffffff;padding:12px 22px;border-radius:999px;text-decoration:none;font-size:15px">Gabung Grup WhatsApp</a></p>' +
    '</td></tr></table>' +
    '<p style="max-width:520px;margin:12px auto 0;text-align:center;font-size:12px;color:#4e6570">Email otomatis dari panitia ' + event + '. Pertanyaan? Hubungi panitia lewat grup WhatsApp.</p>' +
    '</div>';

  var text =
    "Pendaftaran berhasil, " + d.fullName + "\n\n" +
    "Nomor pendaftaran: " + d.registrationId + "\n" +
    (d.eventInfo ? "Waktu & tempat: " + d.eventInfo + "\n" : "") +
    "\nQR Code absensi ada di email ini (gambar). Jika tidak tampil, aktifkan tampilan gambar atau buka email lewat Gmail.\n" +
    "QR bersifat pribadi dan hanya berlaku satu kali.\n\n" +
    "Grup WhatsApp: " + d.waGroup + "\n";

  return { html: html, text: text };
}

/* ------------------------------------------------------------------ */
/* Utilitas manual (jalankan dari editor Apps Script)                  */
/* ------------------------------------------------------------------ */

/**
 * Uji kirim email QR contoh ke akun Google pemilik script.
 * Pertama kali dijalankan akan meminta izin (Gmail kirim email + akses URL).
 * QR contoh sah secara tanda tangan tetapi tidak ada di Sheet,
 * jadi bila dipindai hasilnya "PESERTA TIDAK ADA" (itu normal).
 */
function testSendQrToMe() {
  var me = Session.getEffectiveUser().getEmail();
  var outcome = sendQrEmail("CF2026-TEST22", "Peserta Contoh", me);
  Logger.log("Tujuan: " + me + " | Hasil: " + outcome.status + (outcome.note ? " | " + outcome.note : ""));
}

/** Kirim email QR ke semua peserta 'submitted' yang barcode_status-nya belum 'sent'. */
function sendPendingQr() {
  var sheet = getSheet();
  var last = sheet.getLastRow();
  if (last < 2) return;
  var rows = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var sent = 0, failed = 0;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (String(row[COL.status - 1]) !== "submitted") continue;
    if (String(row[COL.barcode_status - 1]) === "sent") continue;
    if (MailApp.getRemainingDailyQuota() < 1) { Logger.log("Kuota email habis, berhenti."); break; }
    deliverQr(String(row[0]));
    var after = String(sheet.getRange(i + 2, COL.barcode_status).getValue());
    if (after === "sent") sent++; else failed++;
  }
  Logger.log("Terkirim: " + sent + " | Gagal: " + failed + " | Sisa kuota: " + MailApp.getRemainingDailyQuota());
}