import { describe, expect, it } from "vitest";

import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("leaves plain text alone and renders null/undefined as empty", () => {
    expect(csvCell("hello")).toBe("hello");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(42)).toBe("42");
  });

  it("quotes cells with commas, quotes and newlines, doubling inner quotes", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell("a\r\nb")).toBe('"a\r\nb"');
  });

  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("\tTabbed")).toBe("'\tTabbed");
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe(
      '"\'=HYPERLINK(""http://x"",""y"")"'
    );
  });

  it("does not touch text that only contains those characters later on", () => {
    expect(csvCell("a=b")).toBe("a=b");
    expect(csvCell("5-3")).toBe("5-3");
  });
});

describe("toCsv", () => {
  it("emits a BOM, CRLF line endings and a trailing newline", () => {
    const csv = toCsv(["A", "B"], [["1", "x,y"], ["2", ""]]);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.slice(1)).toBe('A,B\r\n1,"x,y"\r\n2,\r\n');
  });

  it("writes just the header when there are no rows", () => {
    expect(toCsv(["A"], []).slice(1)).toBe("A\r\n");
  });
});
