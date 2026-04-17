import * as XLSX from "xlsx";

export function isGoogleSheetsUrl(url: string): boolean {
  return url.includes("docs.google.com/spreadsheets");
}

/**
 * Fetches an XLSX workbook via our backend (avoids CORS issues).
 */
export async function fetchWorkbookFromUrl(url: string): Promise<XLSX.WorkBook> {
  const response = await fetch("/api/fetch-spreadsheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    let errMsg = `Failed to fetch spreadsheet (${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson?.error) errMsg = errJson.error;
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }

  const arrayBuffer = await response.arrayBuffer();
  return XLSX.read(arrayBuffer, { type: "array" });
}
