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
 * Fungsi utilitas yang bisa dijalankan manual dari editor:
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
  var cache = CacheService.getScriptCache();
  try {
    var body = parseBody(e);
    requireSecret(body.secret);

    // Idempotency: kunci sama mengembalikan hasil yang sama, sehingga retry
    // yang responsnya sempat hilang tidak membuat peserta bingung.
    var idempotencyKey = String(body.idempotencyKey || "").slice(0, 200);
    if (idempotencyKey) {
      var cached = cache.get("idem:" + idempotencyKey);
      if (cached) return json(JSON.parse(cached));
    }

    var input = validateInput(body);
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

      var result = { status: "submitted", registration_id: registrationId, submitted_at: submittedAt };
      if (idempotencyKey) cache.put("idem:" + idempotencyKey, JSON.stringify(result), 21600);
      return json(result);
    } finally {
      lock.releaseLock();
    }
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
  if (body.consent !== true || input.fullName.length < 3 || input.fullName.length > 100 ||
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
    // V3: kolom WhatsApp berformat teks (awalan 08 aman).
    if (props.getProperty("CF_FORMAT_V3")) return;
    applySheetFormatting(sheet || getSheet());
    props.setProperty("CF_FORMAT_V3", "1");
  } catch (ignored) {
    // Kegagalan formatting tidak boleh menggagalkan request utama.
  }
}

/** Paksa format ulang: jalankan dari editor Apps Script. */
function reformatSheet() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty("CF_FORMAT_V3");
  var sheet = getSheet();
  applySheetFormatting(sheet);
  props.setProperty("CF_FORMAT_V3", "1");
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
  var hidden = [8, 10, 11, 12, 14, 15, 17, 18, 19, 20, 21];
  for (var h = 0; h < hidden.length; h++) {
    try { sheet.hideColumns(hidden[h]); } catch (ignored) {}
  }

  // Conditional formatting untuk status dan flag duplikat.
  var statusRange = sheet.getRange(2, 3, sheet.getMaxRows() - 1, 1);
  var flagRange = sheet.getRange(2, 16, sheet.getMaxRows() - 1, 1);
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("submitted")
      .setBackground(COLOR_SUBMITTED).setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("failed")
      .setBackground(COLOR_FAILED).setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("draft")
      .setBackground(COLOR_DRAFT).setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextContains("duplicate_whatsapp")
      .setBackground(COLOR_FLAG).setRanges([flagRange]).build()
  ]);
}
