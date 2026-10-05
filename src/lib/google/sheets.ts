import "server-only";

import type { sheets_v4 } from "googleapis";
import { ConfigError } from "./config";
import {
  SHEET_COLUMNS,
  findMissingHeaderColumns,
  type SheetColumn,
} from "@/lib/submissions/sheet-row";

/**
 * Akses Google Sheets.
 *
 * Sheets bukan database bertransaksi (lihat aturan implementasi di
 * `docs/MILESTONES.md`), jadi modul ini hanya melakukan operasi sederhana:
 * baca baris, tambah baris, perbarui satu baris. Semua urutan kolom berasal
 * dari `SHEET_COLUMNS` agar selaras dengan header di Sheet panitia.
 */

export class SheetsError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "SheetsError";
  }
}

/** Huruf kolom terakhir untuk jumlah kolom yang diketahui. */
export function lastColumnLetter(columnCount: number): string {
  let index = columnCount;
  let letters = "";
  while (index > 0) {
    const remainder = (index - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    index = Math.floor((index - 1) / 26);
  }
  return letters;
}

export const LAST_COLUMN = lastColumnLetter(SHEET_COLUMNS.length);

function dataRange(sheetName: string): string {
  return `${sheetName}!A1:${LAST_COLUMN}`;
}

export type SheetLayout = {
  /** True bila baris 1 sudah berisi seluruh kolom wajib. */
  headerOk: boolean;
  /** True bila Sheet benar-benar kosong sehingga header boleh ditulis. */
  isEmpty: boolean;
  missingColumns: SheetColumn[];
  rowCount: number;
  headerFrozen: boolean;
};

/**
 * Memeriksa baris header dan jumlah baris data.
 *
 * Bila header tidak lengkap, fungsi melempar error alih-alih menulis sendiri.
 * Menulis header ke Sheet yang sudah berisi data akan menggeser arti kolom dan
 * merusak data panitia yang sudah ada.
 */
export async function readSheetLayout({
  sheets,
  spreadsheetId,
  sheetName,
}: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  sheetName: string;
}): Promise<SheetLayout> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: dataRange(sheetName),
    });

    const rows = response.data.values ?? [];
    const headerRow = rows[0] ?? [];
    const missingColumns = findMissingHeaderColumns(headerRow);

    if (headerRow.length === 0) {
      return {
        headerOk: false,
        isEmpty: true,
        missingColumns,
        rowCount: 0,
        headerFrozen: false,
      };
    }

    return {
      headerOk: missingColumns.length === 0,
      isEmpty: false,
      missingColumns,
      rowCount: Math.max(0, rows.length - 1),
      headerFrozen: await isHeaderFrozen({ sheets, spreadsheetId, sheetName }),
    };
  } catch (error) {
    throw new SheetsError("Gagal membaca struktur Google Sheets.", error);
  }
}

async function isHeaderFrozen({
  sheets,
  spreadsheetId,
  sheetName,
}: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  sheetName: string;
}): Promise<boolean> {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets(properties(sheetId,title,gridProperties.frozenRowCount))",
    });

    const sheet = response.data.sheets?.find(
      (item) => item.properties?.title === sheetName,
    );

    return (sheet?.properties?.gridProperties?.frozenRowCount ?? 0) >= 1;
  } catch {
    // Pembacaan properti hanya untuk kenyamanan panitia, kegagalan tidak fatal.
    return false;
  }
}

/**
 * Menulis baris header pada Sheet kosong.
 *
 * Hanya dipanggil ketika Sheet benar-benar kosong.
 */
export async function writeHeaderRow({
  sheets,
  spreadsheetId,
  sheetName,
}: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  sheetName: string;
}): Promise<void> {
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:${LAST_COLUMN}1`,
      valueInputOption: "RAW",
      requestBody: { values: [[...SHEET_COLUMNS]] },
    });
  } catch (error) {
    throw new SheetsError("Gagal menulis baris header Google Sheets.", error);
  }
}

/** Membaca seluruh baris data, tanpa baris header. */
export async function readDataRows({
  sheets,
  spreadsheetId,
  sheetName,
}: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  sheetName: string;
}): Promise<string[][]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A2:${LAST_COLUMN}`,
    });
    return response.data.values ?? [];
  } catch (error) {
    throw new SheetsError("Gagal membaca data peserta dari Google Sheets.", error);
  }
}

/** Menambah satu baris di akhir tabel. */
export async function appendRow({
  sheets,
  spreadsheetId,
  sheetName,
  values,
}: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  sheetName: string;
  values: string[];
}): Promise<void> {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1:${LAST_COLUMN}`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values] },
    });
  } catch (error) {
    throw new SheetsError("Gagal menulis baris peserta ke Google Sheets.", error);
  }
}

/** Memperbarui satu baris yang sudah ada, dipakai untuk retry. */
export async function updateRow({
  sheets,
  spreadsheetId,
  sheetName,
  rowNumber,
  values,
}: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  sheetName: string;
  rowNumber: number;
  values: string[];
}): Promise<void> {
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${rowNumber}:${LAST_COLUMN}${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [values] },
    });
  } catch (error) {
    throw new SheetsError("Gagal memperbarui baris peserta di Google Sheets.", error);
  }
}

/** Membekukan baris header agar panitia mudah memfilter. */
export async function freezeHeaderRow({
  sheets,
  spreadsheetId,
  sheetName,
}: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  sheetName: string;
}): Promise<boolean> {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets(properties(sheetId,title))",
    });
    const sheet = response.data.sheets?.find(
      (item) => item.properties?.title === sheetName,
    );
    const sheetId = sheet?.properties?.sheetId;

    if (sheetId === undefined || sheetId === null) return false;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
              fields: "gridProperties.frozenRowCount",
            },
          },
        ],
      },
    });
    return true;
  } catch {
    return false;
  }
}

export { ConfigError };
