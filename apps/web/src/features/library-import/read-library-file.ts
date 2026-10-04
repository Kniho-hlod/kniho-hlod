import { parseCsv, readLibraryTable } from '@kniho-hlod/domain';
import type { ParsedLibrary } from '@kniho-hlod/domain';
import { readXlsx } from '@/shared/read-xlsx';

const XLSX_EXTENSION = /\.xlsx$/i;
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** The file accepted for an import: Goodreads' CSV, Databáze knih's Excel table or any such table. */
export const LIBRARY_FILE_TYPES = `.csv,.xlsx,text/csv,${XLSX_TYPE}`;

/** Excel on Czech Windows saves CSV in Windows-1250; anything else is UTF-8. */
async function readText(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1250').decode(bytes);
  }
}

/** The file could be read, but no column holds the books' titles. */
export class NoTitleColumnError extends Error {
  constructor() {
    super('No column of the table holds titles');
  }
}

/** The books in an exported table; throws when the file can't be read or has no titles. */
export async function readLibraryFile(file: File): Promise<ParsedLibrary> {
  const isWorkbook = XLSX_EXTENSION.test(file.name) || file.type === XLSX_TYPE;
  const rows = isWorkbook ? await readXlsx(file) : parseCsv(await readText(file));
  const library = readLibraryTable(rows);
  if (!library) throw new NoTitleColumnError();
  return library;
}
