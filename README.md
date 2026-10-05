# Form Career Fest 2026

Form pendaftaran berbasis slide untuk Career Fest 2026. Dibangun dengan Next.js 16, TypeScript, dan Tailwind CSS v4.

Referensi produk: [docs/FORM-SPECIFICATION.md](docs/FORM-SPECIFICATION.md). Roadmap: [docs/MILESTONES.md](docs/MILESTONES.md).

## Status Milestone

- Milestone 0 (Requirement dan Keputusan Produk): selesai.
- Milestone 1 (Fondasi Project): selesai, dibawa ulang di Milestone 2 karena scaffold di root sempat gagal.
- Milestone 2 (Form Slide dan UX): selesai.
- Milestone 3 (Model Data dan Validasi): sebagian masuk Milestone 4 karena server wajib memvalidasi sendiri, jadi skema Zod murni frontend belum dibuat.
- Milestone 4 (Integrasi Google Drive dan Google Sheets): selesai, menggunakan konfigurasi testing.
- Milestone 5 dan seterusnya: belum dimulai.

## Setup Lokal

Prasyarat: Node.js 24 atau lebih baru, dan npm 11.

```bash
# 1. Install dependency
npm install

# 2. Salin contoh environment variable
#    Milestone 2 tidak butuh nilai apa pun, file ini untuk Milestone 4.
copy .env.example .env.local    # Windows (PowerShell)
cp .env.example .env.local      # macOS / Linux

# 3. Jalankan development server
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

Pratinjau slide sukses tanpa backend: [http://localhost:3000/preview/success](http://localhost:3000/preview/success).

## Perintah yang Tersedia

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Build production |
| `npm run start` | Jalankan hasil build production |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript strict check (`tsc --noEmit`) |
| `npm run test` | Unit test Vitest untuk helper murni |
| `npm run verify` | Lint, typecheck, dan test sekaligus |

## Struktur Folder

```
src/
  app/                    Route App Router
    layout.tsx            Metadata dan font
    page.tsx              Halaman form
    preview/success/      Pratinjau slide sukses untuk QA desain
  components/registration/
    registration-form.tsx Kontroler slide, state, validasi per slide
    progress-bar.tsx      Indikator progres dengan ARIA
    ui.tsx                Primitive form (Button, TextField, FileField, RadioGroup, Notice)
    slides/               Satu file per slide form
  lib/
    types.ts              Tipe bersama dan definisi urutan slide
    placeholders.ts       Konten yang belum tersedia, format [PLACEHOLDER: ...]
    submit.ts             Pengiriman form ke API route dari browser
    validation.ts         Validasi frontend (aturan dari FORM-SPECIFICATION.md)
    masks.ts              Penyamaran email dan nomor WhatsApp untuk layar
    *.test.ts             Unit test untuk modul murni di atas
    google/               Integrasi Google, hanya server-side
      config.ts           Baca dan validasi environment variable
      auth.ts             JWT client Google
      file-type.ts        Deteksi tipe file dari magic bytes
      drive.ts            Upload dan hapus file di folder privat
      sheets.ts           Baca, tambah, perbarui baris Sheet
    submissions/          Logika submit yang bisa diuji
      service.ts          Orkestrasi submit, penanganan kegagalan parsial
      validate-input.ts   Validasi server lengkap dengan magic bytes
      duplicate.ts        Aturan duplikasi email dan WhatsApp
      registration-id.ts  Generator ID unik
      file-name.ts        Nama file Drive tanpa nama peserta
      sheet-row.ts        Struktur 23 kolom Sheet
      errors.ts           Kode error dan pesan aman
      idempotency.ts      Store kunci anti submit ganda
      log.ts              Logging tanpa data pribadi
      types.ts            Tipe submission

src/app/api/
  submissions/route.ts   POST multipart, dipanggil oleh form
```

Route API (`src/app/api/*`) adalah satu-satunya pintu ke Google API. Modul di `src/lib/google/` dan `src/lib/submissions/service.ts` semua diawali `import "server-only"`, jadi Next.js menolak dijalankannya di browser.

## Setup Google (Testing Saja)

Milestone 4 memakai environment variable, bukan credential di kode.

### 1. Siapkan service account di Google Cloud (test project)

1. Buat service account baru di project Google Cloud **testing**, bukan project acara.
2. Unduh JSON key, lalu ambil `client_email` dan `private_key` darinya.
3. Aktifkan **Google Drive API** dan **Google Sheets API** di project yang sama.

### 2. Siapkan folder Drive dan spreadsheet testing

1. Buat folder Drive baru untuk testing. Catat ID folder dari URL.
2. Share folder tersebut ke email service account dengan hak **Editor**.
3. Jangan pernah share folder atau spreadsheet production ke service account testing.
4. Buat spreadsheet testing dengan tab bernama `Registrations`, lalu catat ID spreadsheet dari URL.

### 3. Isi `.env.local`

```bash
copy .env.example .env.local
```

Isi enam variabel wajib berikut (nilai contoh kosong di `.env.example`):

| Variabel | Isi |
| --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` dari JSON key |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | `private_key`, newline ditulis `\n` |
| `GOOGLE_DRIVE_FOLDER_ID` | ID folder Drive testing |
| `GOOGLE_SHEETS_ID` | ID spreadsheet testing |
| `GOOGLE_SHEETS_NAME` | `Registrations` |
| `APP_ENV` | `development` |

### 4. Kolom Google Sheets

Baris header dibuat otomatis hanya bila Sheet kosong, dan mengikuti urutan 23 kolom di `docs/FORM-SPECIFICATION.md` bagian 6.6. Bila header sudah ada tetapi kolom wajib belum lengkap, aplikasi menolak submit dengan pesan yang menyebut kolom yang belum ada, supaya data panitia yang sudah ada tidak bergeser maknanya.

Daftar kolom lengkap ada di konstanta `SHEET_COLUMNS` pada `src/lib/submissions/sheet-row.ts`.

### 5. Batasan Google Sheets

Google Sheets bukan database bertransaksi. Konsekuensi yang diterima:

- Duplikasi dicek dengan membaca Sheet sebelum upload, jadi dua submit bersamaan dengan email sama masih bisa lolos dua-duanya.
- Idempotency key in-memory hanya menahan request berulang ke instance server yang sama. Pengaman lintas instance adalah pemeriksaan email di Sheet.
- Kalau penulisan Sheet gagal setelah file masuk Drive, aplikasi mencoba menghapus file tersebut. Kalau penghapusan juga gagal, file jadi orphan dan dicatat di kolom `notes` untuk dibersihkan pada Milestone 5/9.

## Status Submission dan Kegagalan

| Status | Arti |
| --- | --- |
| `draft` | Jawaban hanya di browser, tidak pernah ditulis ke Sheet |
| `submitted` | Metadata dan kedua file tersimpan |
| `failed` | Percobaan sudah terjadi, gagal di salah satu provider, ditulis ke Sheet dengan `error_code` |

Peserta boleh retry setelah kegagalan: baris `failed` milik email yang sama diperbarui, bukan membuat baris baru.

`error_code` yang mungkin muncul di Sheet:

| Kode | Arti |
| --- | --- |
| `DRIVE_UPLOAD_FAILED` | Upload ke Drive gagal |
| `SHEETS_WRITE_FAILED` | Baris gagal ditulis, file sudah dibersihkan dari Drive |
| `DRIVE_CLEANUP_FAILED` | Baris gagal ditulis dan file tidak bisa dibersihkan, orphan dicatat di `notes` |

Log server hanya memuat identifier teknis (`registration_id`, file ID Drive, kode error). Nama, email, dan nomor WhatsApp peserta tidak ditulis ke log.

## Lisensi data

- File peserta tidak pernah diberi permission publik di Drive.
- URL Drive publik tidak dibuat untuk tautan `Lihat Foto`. Rencananya lewat route preview terproteksi pada Milestone 5.

- Slide dibagi murni: kontroler di `registration-form.tsx`, tampilan di `slides/`, logika validasi di `lib/`.
- Validasi per slide, tidak bisa melewati slide yang isinya invalid, fokus otomatis pindah ke field pertama saat slide berganti, dan Tab plus Enter jalan seperti biasa.
- Belum ada library form atau schema (React Hook Form, Zod) sampai Milestone 3, sesuai rencana roadmap.
- `src/lib/submit.ts` sengaja mengembalikan status gagal sampai Milestone 4. Tidak ada upload dan tidak ada credential Google di repo ini.

## Keamanan yang Sudah Diterapkan

- Credential Google hanya environment variable server-side, tanpa awalan `NEXT_PUBLIC_*`.
- Verifikasi bundle: tidak ada referensi `googleapis`, `gserviceaccount`, atau URL Google di `.next/static`.
- Deteksi tipe file memakai magic bytes (`src/lib/google/file-type.ts`), bukan `Content-Type` browser.
- Ukuran file divalidasi dua kali: di browser (`src/lib/validation.ts`) dan di server (`src/lib/submissions/validate-input.ts`).
- Nama file di Drive dibentuk server dari `registration_id`, tidak pernah dari nama peserta.
- Response sukses hanya memuat `registration_id`, `submitted_at`, dan `status`. Nomor WhatsApp tidak dikembalikan.
- Pesan error ke browser memakai teks tetap dari spesifikasi, tanpa detail internal atau isi environment.

## Aturan

- Credential Google hanya environment variable server-side, tanpa awalan `NEXT_PUBLIC_*`.
- Jangan commit `.env.local`, file bawaan sudah tercatat di `.gitignore`.
- Jangan menjadikan file peserta public di Google Drive.
- Modul di `src/lib/google/` dan `src/lib/submissions/service.ts` dijaga `import "server-only"`; jangan mengimpornya dari komponen client.
- Log server tidak boleh memuat nama, email, atau nomor WhatsApp peserta.
- Setiap perubahan diakhiri dengan `npm run verify`.
