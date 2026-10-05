# Form Specification: Career Fest 2026

## Scope

Dokumen ini menjadi kontrak konsep dan implementasi untuk Form Pendaftaran Career Fest 2026. Scope saat ini hanya mencakup pengalaman pendaftaran, penyimpanan data peserta, upload bukti, dan halaman sukses.

Di luar scope agent utama:

- Pembuatan QR Code atau barcode.
- Pengiriman email barcode.
- Scanner panitia.
- One-time attendance.
- Logic absensi pada hari pelaksanaan.

Fitur absensi akan diintegrasikan partner melalui kontrak data setelah form stabil.

## Alur Utama

```text
Welcome
  -> Persetujuan
  -> Data Diri
  -> Asal Instansi
  -> Bukti Follow Instagram
  -> Bukti Transfer
  -> Review state pada slide 6 lalu Submit
  -> Success
```

Submit final hanya boleh dilakukan setelah semua field wajib valid dan dua file berhasil diproses.

## Slide 1: Welcome

### Tujuan

Memberi konteks sebelum peserta mulai mengisi form.

### Konten

- Logo atau identitas Career Fest.
- Judul: `Career Fest 2026`.
- Deskripsi singkat acara.
- Tombol: `Mulai Pendaftaran`.

### Data

Tidak ada data peserta yang disimpan.

### Placeholder

- `[PLACEHOLDER: logo Career Fest 2026]`
- `[PLACEHOLDER: deskripsi acara final]`

## Slide 2: Persetujuan

### Field

| ID | Label | Tipe | Wajib |
|---|---|---|---|
| `consent` | Saya menyetujui penggunaan data untuk keperluan Career Fest 2026 | Checkbox | Ya |

### Behavior

- Default tidak dicentang.
- Peserta tidak dapat melanjutkan sebelum dicentang.
- Teks privacy notice dapat ditambahkan tanpa mengubah data model.

## Slide 3: Data Diri

### Field

| ID | Label | Tipe | Wajib | Validasi |
|---|---|---|---|---|
| `full_name` | Nama lengkap | Text | Ya | Minimal 3 karakter setelah normalisasi; hanya huruf, spasi, tanda hubung, apostrof, dan titik |
| `email` | Email | Email | Ya | Format email valid, normalisasi lowercase |
| `whatsapp_number` | Nomor WhatsApp | Tel | Ya | 9-15 digit setelah normalisasi |

### Behavior

- Email dan WhatsApp dapat digunakan untuk mendeteksi duplikasi sesuai keputusan final.
- Nilai yang ditampilkan kembali saat review harus sudah dinormalisasi.
- Nomor WhatsApp tidak boleh disimpan sebagai angka agar angka nol awal tidak hilang.

## Slide 4: Asal Instansi

### Field

| ID | Label | Tipe | Wajib | Pilihan |
|---|---|---|---|---|
| `affiliation` | Asal instansi Anda | Radio/card select | Ya | `UNISSULA`, `Umum` |

### Behavior

- Hanya dua nilai tersebut yang diterima server.
- Jangan menerima label bebas untuk field ini.

## Slide 5: Bukti Follow Instagram

### Konten

- Instruksi upload screenshot bukti follow Instagram Career Fest 2026.
- Link Instagram resmi dan instruksi follow.
- File upload wajib.

### Field

| ID | Label | Tipe | Wajib | Aturan sementara |
|---|---|---|---|---|
| `instagram_file` | Screenshot bukti follow | File | Ya | 1 file, JPG/JPEG/PNG/WebP/PDF, maksimal 5 MB |

### Placeholder

- `[PLACEHOLDER: link Instagram resmi Career Fest 2026]`

### Behavior

- Link Instagram terbuka pada tab baru.
- File tidak dianggap tersimpan sampai backend mengonfirmasi upload berhasil.
- Nama file user disanitasi sebelum disimpan.

## Slide 6: Bukti Transfer

### Konten

- Instruksi upload bukti transfer ke bendahara.
- Informasi transfer dapat ditambahkan setelah diberikan.
- File upload wajib.

### Field

| ID | Label | Tipe | Wajib | Aturan sementara |
|---|---|---|---|---|
| `payment_file` | Upload bukti transfer | File | Ya | 1 file, JPG/JPEG/PNG/WebP/PDF, maksimal 5 MB |

### Placeholder

- `[PLACEHOLDER: instruksi transfer lengkap]`

### Behavior

- File bersifat private.
- Akses hanya untuk panitia/bendahara yang berwenang.
- File tidak dibuat public hanya demi membuat link dapat dibuka.

## Review state dan Submit

Review adalah state pada slide `payment_proof` (slide 6), bukan slide kedelapan. Peserta dapat memeriksa dan mengedit jawaban sebelum submit tanpa menambah slide baru.

Review menampilkan:

- Nama lengkap.
- Email.
- Nomor WhatsApp.
- Asal instansi.
- Nama file screenshot Instagram.
- Nama file bukti transfer.

Action:

- `Kembali dan Edit`.
- `Kirim Pendaftaran`.

Saat submit:

- Disable tombol submit.
- Tampilkan progress.
- Tolak submit kedua.
- Jika gagal, tampilkan error aman dan opsi retry tanpa menghapus jawaban.

## Slide 7: Success

### Konten

- Ucapan terima kasih.
- Informasi bahwa pendaftaran berhasil.
- `registration_id` yang dibuat server.
- Catatan tindak lanjut dari panitia, tanpa membuat barcode, mengirim email, atau memvalidasi absensi.
- Link grup WhatsApp Career Fest 2026.

### Placeholder

- `[PLACEHOLDER: link grup WhatsApp Career Fest 2026]`

### Batasan Scope

Slide ini tidak membuat barcode, tidak mengirim email barcode, dan tidak memvalidasi absensi.

## Data Model Submission

```ts
type ParticipantSubmission = {
  registration_id: string;
  submitted_at: string;
  full_name: string;
  email: string;
  whatsapp_number: string;
  affiliation: "UNISSULA" | "Umum";
  consent: true;
  instagram_file: FileMetadata;
  payment_file: FileMetadata;
  status: "draft" | "submitted" | "failed";
};

type FileMetadata = {
  drive_file_id: string;
  drive_file_name: string;
  mime_type: string;
  size_bytes: number;
  status: "uploaded" | "failed";
};
```

Kolom dan field partner bukan bagian dari implementasi form. Jika dibutuhkan kemudian, partner membuat kontrak data terpisah tanpa menambahkan logic QR, email, scanner, atau absensi ke form.

## Google Sheets Columns

```text
registration_id
submitted_at
status
full_name
email
whatsapp_number
affiliation
instagram_file_id
instagram_file_name
instagram_mime_type
instagram_size_bytes
payment_file_id
payment_file_name
payment_mime_type
payment_size_bytes
duplicate_flag
barcode_status
attendance_status
checked_in_at
checked_in_by
error_code
notes
```

Catatan perubahan: kolom `instagram_profile_url` dihapus. Peserta tidak lagi
memasukkan link profil Instagram; slide bukti follow menampilkan link resmi
akun `@career_fest_2026` dan peserta hanya mengunggah screenshot bukti follow.
Di tampilan Sheet, kolom nama file (`instagram_file_name`, `payment_file_name`)
dihyperlink otomatis ke file Drive agar verifikasi cukup satu klik.

Status ditetapkan server:

```text
status = submitted
payment_verification_status = pending
```

## Kontrak Handoff Data (Tanpa Implementasi Partner)

Setelah submit sukses, sistem form harus memiliki data berikut untuk partner:

```json
{
  "registration_id": "CF2026-XXXXXX",
  "full_name": "Nama Peserta",
  "email": "peserta@example.com",
  "submitted_at": "ISO-8601 timestamp",
  "status": "submitted"
}
```

Partner dapat memakai event submit sukses sesuai kontrak data ini pada fase terpisah. Dokumen ini tidak mendefinisikan token absensi, QR, email, scanner, atau endpoint absensi.

## Open Decisions

- Logo, identitas visual, dan deskripsi acara final.
- Deskripsi acara final.
- Link Instagram resmi dan instruksi follow.
- Link grup WhatsApp.
- Instruksi, nominal, rekening/e-wallet, dan nama penerima transfer.
- Batas ukuran file final; asumsi sementara 5 MB per file.
- Apakah peserta boleh mendaftar lebih dari sekali untuk kebutuhan acara berbeda.
- Apakah pembayaran diverifikasi sebelum status operasional peserta dianggap valid.
- Copy privacy notice, pihak berwenang, kontak koreksi/penghapusan, dan periode retensi data.


## Asumsi yang Dipakai

| ID | Asumsi | Dampak |
|---|---|---|
| AS-01 | Batas file 5 MB per file | Wajib dikonfirmasi sebelum release |
| AS-02 | File yang diterima JPG/JPEG/PNG/WebP/PDF | Tipe final dapat dipersempit oleh panitia |
| AS-03 | Email adalah kunci duplikasi utama | Email submission `submitted` ditolak |
| AS-04 | WhatsApp duplikat dengan email berbeda diizinkan dan diberi flag | Panitia perlu meninjau flag tersebut |
| AS-05 | Draft hanya berada di memori browser | Refresh menghapus draft |
| AS-06 | `submitted` berarti data form dan bukti tersimpan, bukan pembayaran telah diverifikasi | Status verifikasi pembayaran terpisah |
| AS-07 | Tidak ada revisi mandiri peserta | Koreksi dilakukan melalui panitia sampai ada keputusan baru |
| AS-08 | Folder Drive dan Sheet testing terpisah dari production | Tidak ada credential atau data production pada milestone ini |

## Checklist Verifikasi Milestone 0

- [x] Tujuh slide terdokumentasi tanpa menambah slide absensi.
- [x] Setiap field memiliki ID, tipe input, validasi, dan status wajib.
- [x] Placeholder logo, deskripsi, Instagram, transfer, dan grup WhatsApp tercatat.
- [x] Struktur payload, metadata file, `registration_id`, status, dan kolom Sheet terdokumentasi.
- [x] Alur Next/Back/review/submit dan retry terdokumentasi.
- [x] Aturan duplikasi email dan WhatsApp terdokumentasi.
- [x] Aturan file private, batas ukuran, tipe, dan validasi server terdokumentasi.
- [x] QR Code, barcode, absensi, scanner, email barcode, dan Apps Script tidak termasuk implementasi.
- [x] Tidak ada credential atau data production di dokumen.


