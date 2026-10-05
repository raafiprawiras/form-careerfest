/**
 * Career Fest 2026 - Apps Script Web App API.
 *
 * Deploy as Web app:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Required Script Properties:
 *   CAREERFEST_API_SECRET
 *   GOOGLE_SHEETS_ID
 *   GOOGLE_DRIVE_FOLDER_ID
 *   GOOGLE_SHEETS_NAME (optional, default: Registrations)
 *
 * The Next.js server sends JSON, not multipart, to this endpoint. Files are
 * base64 encoded only between the trusted Next.js server and this Web App.
 * Never expose this endpoint secret in browser code.
 */

var MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
var HEADERS = [
  "registration_id", "submitted_at", "status", "full_name", "email",
  "whatsapp_number", "affiliation", "instagram_profile_url",
  "instagram_file_id", "instagram_file_name", "instagram_mime_type",
  "instagram_size_bytes", "payment_file_id", "payment_file_name",
  "payment_mime_type", "payment_size_bytes", "duplicate_flag",
  "barcode_status", "attendance_status", "checked_in_at", "checked_in_by",
  "error_code", "notes"
];
var ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function doGet() {
  return json({ status: "ok", service: "career-fest-api" });
}

function doPost(e) {
  var uploadedIds = [];
  try {
    var body = parseBody(e);
    requireSecret(body.secret);
    var input = validateInput(body);
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var sheet = getSheet();
      ensureHeaders(sheet);
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
        input.whatsappNumber, input.affiliation, input.instagramProfileUrl,
        instagram.id, instagram.name, instagram.mimeType, instagram.size,
        payment.id, payment.name, payment.mimeType, payment.size,
        duplicate.whatsappRow ? "duplicate_whatsapp_suspected" : "",
        "", "", "", "", "", ""
      ];
      if (duplicate.emailRow) {
        sheet.getRange(duplicate.emailRow.row, 1, 1, HEADERS.length).setValues([row]);
      } else {
        sheet.appendRow(row);
      }
      return json({ status: "submitted", registration_id: registrationId, submitted_at: submittedAt });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    if (error && error.code === "DUPLICATE_EMAIL") {
      return json({ status: "error", code: error.code, retryable: false });
    }
    cleanup(uploadedIds);
    return json({ status: "error", code: error && error.code ? error.code : "PROVIDER_ERROR", retryable: true });
  }
}

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
    affiliation: text("affiliation"), instagramProfileUrl: text("instagramProfileUrl"),
    instagramFile: body.instagramFile, paymentFile: body.paymentFile
  };
  if (body.consent !== true || input.fullName.length < 3 || input.fullName.length > 100 ||
      !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(input.email) ||
      !/^\d{9,15}$/.test(input.whatsappNumber) ||
      (input.affiliation !== "UNISSULA" && input.affiliation !== "Umum") ||
      !/^https:\/\/(www\.)?(instagram\.com|instagram\.co\.id)\/[^/?#]+/i.test(input.instagramProfileUrl)) {
    throw providerError("VALIDATION_FAILED");
  }
  input.instagramFile = validateFile(input.instagramFile);
  input.paymentFile = validateFile(input.paymentFile);
  return input;
}

function normalizeWhatsapp(value) {
  var digits = value.replace(/\D/g, "");
  return digits.indexOf("62") === 0 ? "0" + digits.substring(2) : digits;
}

function validateFile(file) {
  if (!file || !file.data) throw providerError("VALIDATION_FAILED");
  var bytes = Utilities.base64Decode(file.data);
  if (bytes.length > MAX_UPLOAD_BYTES) throw providerError("FILE_TOO_LARGE");
  var detected = detectFile(bytes);
  if (!detected) throw providerError("INVALID_FILE_TYPE");
  return { bytes: bytes, mimeType: detected.mimeType, extension: detected.extension };
}

function detectFile(bytes) {
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { mimeType: "image/jpeg", extension: "jpg" };
  if (bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return { mimeType: "image/png", extension: "png" };
  if (bytes.length >= 12 && String.fromCharCode.apply(null, bytes.slice(0, 4)) === "RIFF" && String.fromCharCode.apply(null, bytes.slice(8, 12)) === "WEBP") return { mimeType: "image/webp", extension: "webp" };
  if (bytes.length >= 5 && String.fromCharCode.apply(null, bytes.slice(0, 5)) === "%PDF-") return { mimeType: "application/pdf", extension: "pdf" };
  return null;
}

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
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  else if (sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0].join("|") !== HEADERS.join("|")) throw providerError("SHEET_HEADER_INVALID");
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
