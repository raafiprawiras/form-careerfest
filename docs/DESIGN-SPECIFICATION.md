# Design Specification — Career Fest 2026

## Visual direction

Tema memakai referensi **Peacock Feather — Fresh, Modern, Elegant**. Indigo menjadi anchor yang tegas untuk aksi utama, biru memberi rasa terbuka dan modern, teal menjadi aksen interaksi, sementara dua warna hijau-krem menjaga permukaan tetap ringan dan hangat.

## Palette and tokens

| Token | Value | Peran |
|---|---|---|
| `background` | `#E1EDD4` | Latar halaman utama |
| `surface` | `#FFFFFF` | Kartu, field, dan konten utama |
| `surfaceMuted` | `#CAE5BC` | Area pendukung dan progress track |
| `primary` | `#4D52B4` | CTA utama dan fokus brand |
| `primaryForeground` | `#FFFFFF` | Teks di atas primary |
| `secondary` | `#4E9CE8` | Aksen sekunder dan hover CTA |
| `accent` | `#70D6C5` | Progress, selection, dan feedback ringan |
| `text` | `#19344A` | Teks utama, diturunkan untuk keterbacaan |
| `textMuted` | `#4E6570` | Helper text dan metadata |
| `border` | `#A8CBBD` | Border lembut, turunan dari teal dan hijau |
| `success` | `#2F806D` | Status sukses |
| `error` | `#B42318` | Error validasi |
| `warning` | `#8A6412` | Peringatan |

Nilai palet langsung dari gambar adalah `#4D52B4`, `#4E9CE8`, `#70D6C5`, `#CAE5BC`, dan `#E1EDD4`. Nilai teks/status/border adalah turunan aksesibilitas yang dipusatkan di `src/app/globals.css`, bukan hardcode per komponen.

## Component behavior

- Slide berpindah dengan fade dan perpindahan horizontal pendek; tidak memakai gerakan berlebihan.
- Tombol memberi scale ringan saat hover/tap.
- Pilihan radio dan file terpilih mendapat feedback scale/fade singkat.
- `prefers-reduced-motion` tetap dihormati oleh CSS dan Framer Motion.
- Tidak ada gradient, shadow dekoratif, atau background animation.

## Scope coverage

Token diterapkan pada welcome, consent, identity, affiliation, upload Instagram, upload transfer, review state, progress, notice, dan success. QR Code, email barcode, scanner, dan absensi tidak menjadi bagian dari UI ini.
