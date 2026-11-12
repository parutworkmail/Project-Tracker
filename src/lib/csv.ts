const FORMULA_START = /^[=+\-@\t\r]/;

// Spreadsheet apps run cells that start with these characters as formulas,
// so user-typed text must be neutralised before it lands in a download.
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = String(value);

  if (FORMULA_START.test(text)) {
    text = `'${text}`;
  }

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));

  // BOM so Excel opens the file as UTF-8; CRLF per RFC 4180.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
