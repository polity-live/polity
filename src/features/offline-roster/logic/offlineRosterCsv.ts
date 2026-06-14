import type { DraftRosterEntry } from '../types';

export interface ParsedOfflineRosterCsvResult {
  rows: DraftRosterEntry[];
  skippedDuplicates: number;
  skippedMissingNames: number;
}

export function normalizeDraftKey(entry: DraftRosterEntry) {
  return `${entry.firstName.trim().toLowerCase()}|${entry.lastName.trim().toLowerCase()}|${entry.reasonNotSignedUp.trim().toLowerCase()}`;
}

export function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values.map(value => value.replace(/^"|"$/g, '').trim());
}

export function parseOfflineRosterCsv(
  content: string,
  existingKeys: Set<string>
): ParsedOfflineRosterCsvResult {
  const lines = content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], skippedDuplicates: 0, skippedMissingNames: 0 };
  }

  const firstLineColumns = parseCsvLine(lines[0]).map(column => column.toLowerCase());
  const hasHeader =
    firstLineColumns.includes('firstname') ||
    firstLineColumns.includes('first_name') ||
    firstLineColumns.includes('lastname') ||
    firstLineColumns.includes('last_name');

  const rows = hasHeader ? lines.slice(1) : lines;
  const seenKeys = new Set(existingKeys);
  const parsedRows: DraftRosterEntry[] = [];
  let skippedDuplicates = 0;
  let skippedMissingNames = 0;

  for (const line of rows) {
    const [rawFirstName = '', rawLastName = '', rawReason = ''] = parseCsvLine(line);
    const entry: DraftRosterEntry = {
      firstName: rawFirstName.trim(),
      lastName: rawLastName.trim(),
      reasonNotSignedUp: rawReason.trim(),
    };

    if (!entry.firstName || !entry.lastName) {
      skippedMissingNames += 1;
      continue;
    }

    const key = normalizeDraftKey(entry);
    if (seenKeys.has(key)) {
      skippedDuplicates += 1;
      continue;
    }

    seenKeys.add(key);
    parsedRows.push(entry);
  }

  return {
    rows: parsedRows,
    skippedDuplicates,
    skippedMissingNames,
  };
}
