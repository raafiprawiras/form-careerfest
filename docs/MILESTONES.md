# Career Fest 2026 Form

## Tujuan Produk

Form pendaftaran berbasis slide seperti Typeform dengan logic sederhana, penyimpanan data peserta ke Google Sheets, penyimpanan bukti upload ke Google Drive, dan halaman sukses yang memberi informasi tindak lanjut. Sistem QR Code, email barcode, scanner, dan one-time attendance dikerjakan partner pada fase terpisah.

## Keputusan Arsitektur Sementara

- Frontend: Next.js, TypeScript, Tailwind CSS, React Hook Form, Zod, Framer Motion.
- Hosting: Vercel.
- Backend: Next.js Route Handlers atau Vercel API Routes.
- Database peserta: Google Sheets API.
- File storage: Google Drive API.
- Email dan QR attendance: out of scope untuk agent utama; dikerjakan partner pada fase terpisah.
- Source control: GitHub.
- File Google Drive bersifat private dan hanya dapat diakses panitia yang berwenang.

## Isi Form Saat Ini

1. Welcome: identitas Career Fest, judul, deskripsi, dan tombol mulai.
2. Persetujuan: persetujuan penggunaan data sebagai field wajib.
3. Data diri: nama lengkap, email, dan nomor WhatsApp, semuanya wajib.
4. Asal instansi: `UNISSULA` atau `Umum`, wajib.
5. Bukti follow Instagram Career Fest 2026: upload screenshot wajib dan link Instagram.
6. Bukti transfer ke bendahara: upload wajib.
7. Success: ucapan terima kasih, pemberitahuan barcode absensi melalui email, dan link grup WhatsApp.

## Milestone 0: Requirement dan Keputusan Produk

### Output

- `docs/FORM-SPECIFICATION.md` berisi semua slide, field, tipe data, validasi, dan copywriting.
- Flow logic form.
- Keputusan batas file, format file, aturan duplikasi email/WhatsApp, dan kebijakan privasi.
- Daftar placeholder yang belum diberikan, seperti link Instagram, link WhatsApp, nominal transfer, dan identitas brand.

### Selesai Jika

- Tidak ada field wajib yang ambigu.
- Semua aturan submit dan revisi jawaban terdokumentasi.
- Belum ada credential atau data produksi yang digunakan.

## Milestone 1: Fondasi Project

### Output

- Project Next.js TypeScript yang dapat dijalankan lokal.
- Tailwind CSS dan struktur folder dasar.
- Lint, typecheck, dan test command.
- `.env.example` tanpa secret.
- README setup lokal.

### Selesai Jika

- `npm run dev`, `npm run lint`, dan `npm run typecheck` berjalan.
- Halaman awal dapat dibuka di desktop dan mobile.

## Milestone 2: Form Slide dan UX

### Output

- Welcome slide.
- Persetujuan.
- Slide data diri.
- Slide asal instansi.
- Slide upload bukti Instagram.
- Slide upload bukti transfer.
- Success slide.
- Navigasi next/back, progress, focus input, error state, loading state, dan keyboard support.

### Selesai Jika

- Peserta tidak dapat melewati field wajib yang invalid.
- Back tidak menghapus jawaban.
- Layout usable pada mobile.
- Tidak ada upload ke production pada milestone ini.

## Milestone 3: Model Data dan Validasi

### Output

- TypeScript type untuk participant dan submission.
- Schema Zod frontend dan server.
- Generator `registration_id` unik.
- Status submission: `draft`, `submitted`, `failed`.
- Pencegahan double submit di UI dan server.
- Struktur Google Sheets terdokumentasi.

### Selesai Jika

- Payload invalid ditolak oleh server.
- Logic yang wajib tidak hanya bergantung pada frontend.
- Error dapat ditampilkan tanpa membocorkan secret atau detail internal.

## Milestone 4: Integrasi Google Drive dan Google Sheets

### Output

- Route server-side untuk menerima submission.
- Upload file ke folder Google Drive private.
- Penulisan metadata peserta ke Google Sheets API.
- Penyimpanan `drive_file_id`, nama file, status, dan link operasional.
- Cleanup atau status penanganan jika upload berhasil tetapi penulisan Sheets gagal.
- Setup credential menggunakan environment variable Vercel.

### Selesai Jika

- Credential tidak pernah masuk bundle browser atau repository.
- Service account hanya memiliki akses minimum ke folder Drive dan Sheet.
- Upload ukuran dan MIME type dibatasi.
- Test menggunakan folder dan spreadsheet testing, bukan production.

## Milestone 5: Link Foto dan Operasional Admin

### Output

- Kolom `Lihat Foto` di Google Sheets.
- File tetap private.
- Halaman atau route preview yang dilindungi untuk panitia, jika dibutuhkan.
- Dokumentasi permission Google Drive.
- Log submission dan error yang aman.

### Selesai Jika

- Link tidak membuat file peserta menjadi public secara default.
- Panitia dapat menemukan foto berdasarkan `registration_id`.
- File orphan dapat diidentifikasi dan dibersihkan.

## Milestone 6: Finalisasi Konsep dan Handoff Partner

### Output

- Contract status untuk integrasi partner tanpa implementasi QR atau absensi.
- Field placeholder opsional seperti `attendance_status` hanya jika diperlukan untuk kompatibilitas data.
- Dokumen handoff yang menjelaskan event submit sukses, `registration_id`, email peserta, dan timestamp.
- Halaman sukses tidak membuat barcode dan tidak mengirim email barcode.

### Selesai Jika

- Partner memiliki kontrak data yang jelas.
- Agent utama tidak mengimplementasikan Apps Script, QR Code, email barcode, scanner, atau one-time attendance.
- Form tetap dapat disubmit tanpa bergantung pada sistem absensi partner.

## Milestone 7: Security, Accessibility, dan QA

### Output

- Privacy notice dan consent final.
- Rate limiting atau anti-spam yang sesuai.
- File validation dan sanitasi nama file.
- Accessibility keyboard, focus, label, contrast, dan error announcement.
- Test browser/device.
- Test failure untuk Google API, timeout, retry, dan duplicate submission.
- Checklist release.

### Selesai Jika

- Tidak ada secret di Git.
- Semua route server memvalidasi input.
- Pendaftaran tetap memberi pesan yang aman ketika provider eksternal gagal.
- QA dilakukan pada environment testing.

## Milestone 8: Staging dan Production Form

### Output

- Environment `development`, `preview`, dan `production` terpisah.
- Google Sheet dan folder Drive testing/production terpisah.
- Vercel preview deployment.
- Domain production.
- Budget alert dan monitoring Google Cloud jika diperlukan.
- SOP panitia untuk melihat data, memverifikasi pembayaran, dan menangani submission form. SOP absensi dikerjakan partner.

### Selesai Jika

- Smoke test production selesai dengan data uji yang jelas dan dapat dibersihkan.
- Backup Sheet dan prosedur pemulihan tersedia.
- Panitia memahami siapa yang memiliki akses ke data pribadi dan file.

## Aturan Implementasi

- Jangan memakai Google Apps Script untuk QR/email absensi pada scope ini. Integrasi Apps Script yang belum diminta juga tidak boleh dibuat.
- Jangan memakai Google Drive production atau credential production sebelum milestone terkait dikonfirmasi.
- Jangan membuat file peserta public.
- Jangan menaruh credential Google di frontend atau variabel `NEXT_PUBLIC_*`.
- Jangan menganggap Google Sheets sebagai database dengan transaksi penuh.
- Setelah setiap milestone, jalankan lint, typecheck, test, dan build yang tersedia.
- Jika requirement belum jelas, gunakan placeholder yang eksplisit dan catat pertanyaan di dokumentasi.
- QR Code, email barcode, scanner, dan one-time attendance adalah tanggung jawab partner dan tidak boleh dikerjakan dalam milestone form ini.
