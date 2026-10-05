# Apps Script API — Career Fest 2026

Script ini adalah backend gratis untuk testing/staging: menyimpan metadata ke Google Sheets dan dua bukti upload ke folder Google Drive private.

## Setup

1. Buat project baru di [script.google.com](https://script.google.com).
2. Salin seluruh isi `Code.gs` ke editor Apps Script.
3. Buka **Project Settings → Script Properties** dan isi:

```text
CAREERFEST_API_SECRET=<secret acak, minimal 32 karakter>
GOOGLE_SHEETS_ID=1NAS1wH7PWNatZouYz6n_iNwnpHKI9XDhhxUcmHp-9Cw
GOOGLE_DRIVE_FOLDER_ID=1Lh6_sCUzn0HaW4m7Ddkxox0vgtDgTnJH
GOOGLE_SHEETS_NAME=Registrations
```

`CAREERFEST_API_SECRET` harus dibuat sendiri dan tidak dikirim melalui chat.

4. Jalankan fungsi `doGet` sekali dari editor untuk memicu authorization prompt, lalu izinkan akses Drive dan Sheets.
5. Deploy → **New deployment** → **Web app**.
6. Pilih:

```text
Execute as: Me
Who has access: Anyone
```

7. Salin URL yang berakhiran `/exec`.
8. Uji GET URL tersebut. Response yang benar:

```json
{"status":"ok","service":"career-fest-api"}
```

## Kontrak POST dari Next.js

Apps Script menerima JSON dari server Next.js. File dikirim sebagai base64; browser tidak pernah menerima secret.

```json
{
  "secret": "server-only-secret",
  "consent": true,
  "fullName": "Peserta Dummy",
  "email": "dummy@example.com",
  "whatsappNumber": "081234567890",
  "affiliation": "Umum",
  "instagramProfileUrl": "https://instagram.com/peserta_dummy",
  "instagramFile": { "data": "<base64>", "fileName": "instagram.png" },
  "paymentFile": { "data": "<base64>", "fileName": "payment.png" }
}
```

Response sukses hanya:

```json
{"status":"submitted","registration_id":"CF2026-ABC234","submitted_at":"..."}
```

## Keamanan dan batasan

- File tidak diberi permission public; hanya akun pemilik/panitia yang memiliki akses Drive.
- File dinamai berdasarkan registration ID, bukan nama peserta.
- `LockService` mencegah race condition ketika dua submit datang bersamaan.
- Email duplikat `submitted` ditolak; WhatsApp berbeda email diberi flag.
- File yang sudah dibuat dihapus/trash jika upload kedua atau penulisan Sheet gagal.
- Script tidak membuat QR Code, sistem absensi, scanner, atau email sertifikat.
- Sebelum deployment, pastikan folder dan Sheet adalah resource testing yang benar.

## Dummy test aman

Jangan menjalankan dummy sebelum memastikan Sheet dan folder yang dipilih memang testing. Setelah siap, dummy akan membuat satu row dan dua file nyata. Hapus row dan file dummy secara manual setelah test.
