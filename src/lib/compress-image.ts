/**
 * Kompresi gambar di sisi browser sebelum diunggah.
 *
 * Screenshot dari ponsel bisa berukuran 3-5 MB; mengecilkan resolusi dan
 * mengubahnya menjadi JPEG memangkas waktu upload hingga ~10x lipat tanpa
 * mengurangi keterbacaan bukti follow / transfer.
 *
 * Aturan:
 * - Hanya gambar (JPEG/PNG/WebP) yang dikompresi; PDF dan file kecil lolos.
 * - Sisi terpanjang dibatasi 1600 px, kualitas JPEG 0,82.
 * - Jika hasil kompresi lebih besar dari aslinya (sudah efisien), file
 *   asli dipakai. Kegagalan apa pun mengembalikan file asli — kompresi
 *   tidak boleh membuat submit gagal.
 */

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
/** File di bawah ambang ini sudah cepat diunggah; tidak perlu diproses. */
const MIN_BYTES_TO_COMPRESS = 250 * 1024;

export async function compressForUpload(file: File): Promise<File> {
  if (typeof document === "undefined") return file;
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  if (file.size <= MIN_BYTES_TO_COMPRESS) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }

    // Latar putih agar PNG transparan tidak menghasilkan hitam di JPEG.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    });
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "bukti";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}
