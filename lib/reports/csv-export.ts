/**
 * CSV export utility for custom reports.
 * RFC 4180 compliant — escapes commas, quotes, and newlines.
 */

function escapeCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  // Flatten nested PostgREST embedded objects
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const vals = Object.values(obj)
      .filter((v) => v !== null && v !== undefined && typeof v !== 'object')
      .map(String);
    if (vals.length > 0) return vals.join(', ');
    // Nested objects
    const nested = Object.values(obj)
      .filter((v) => v !== null && typeof v === 'object')
      .map((v) => formatValue(v));
    return nested.filter(Boolean).join(', ');
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    return value.map((item) => formatValue(item)).filter(Boolean).join('; ');
  }

  return String(value);
}

/**
 * Convert report rows to CSV string.
 *
 * @param columns - Column keys in display order
 * @param rows - Data rows
 * @param headerLabels - Optional mapping from column key to readable label
 */
export function rowsToCsv(
  columns: string[],
  rows: Record<string, unknown>[],
  headerLabels?: Record<string, string>
): string {
  const header = columns
    .map((col) => escapeCell(headerLabels?.[col] ?? col))
    .join(',');

  const body = rows
    .map((row) =>
      columns.map((col) => escapeCell(formatValue(row[col]))).join(',')
    )
    .join('\n');

  return header + '\n' + body;
}
