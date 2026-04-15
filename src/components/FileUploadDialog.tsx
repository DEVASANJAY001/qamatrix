import { useState, useRef } from "react";
import { QAMatrixEntry } from "@/types/qaMatrix";
import { recalculateStatuses } from "@/utils/qaCalculations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Link2, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { fetchWorkbookFromUrl, isGoogleSheetsUrl } from "@/utils/googleSheetsImport";

interface FileUploadDialogProps {
  nextSNo: number;
  onImport: (entries: QAMatrixEntry[]) => void;
}

const n = null;

function normalizeHeader(h: string): string {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/[.\/\\_]+/g, " ") // Replace dots, slashes, backslashes, underscores with space
    .replace(/\s+/g, " ")       // Normalize spaces
    .trim();
}

function parseSheet(sheet: XLSX.WorkSheet, startSNo: number): QAMatrixEntry[] {
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (rows.length < 2) return [];

  const colMap: Record<string, number> = {};
  const rawHeaders: string[] = [];

  let lastHeaderRow = -1;
  // Scan first 10 rows for headers to handle multiple header levels
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r];
    if (row) {
      let rowHasHeader = false;
      row.forEach((h: any, i: number) => {
        const val = String(h || "").trim();
        if (val) {
          const norm = normalizeHeader(val);
          rawHeaders[i] = val;
          colMap[norm] = i;

          // Check if this cell looks like a known header keyword to identify the header row
          if (["station number", "station", "stn", "failure mode", "concern", "detection date", "date", "source", "s.no", "sno", "responsible", "team leader", "area", "designation"].includes(norm)) {
            rowHasHeader = true;
          }
        }
      });
      if (rowHasHeader) lastHeaderRow = r;
    }
  }

  const headers = rawHeaders.map(normalizeHeader);

  const find = (...names: string[]): number => {
    // 1. Exact matches first
    for (const name of names) {
      const nm = normalizeHeader(name);
      if (colMap[nm] !== undefined) return colMap[nm];
    }
    // 2. Fuzzy matches: Check if any detected header contains the target name
    for (const name of names) {
      const nm = normalizeHeader(name);
      if (nm.length < 2) continue;
      // Find a key in colMap that contains our normalized name (or vice versa)
      const foundKey = Object.keys(colMap).find(key =>
        key.includes(nm) || nm.includes(key)
      );
      if (foundKey !== undefined) return colMap[foundKey];
    }
    return -1;
  };

  const getVal = (row: any[], col: number): string => {
    if (col < 0 || col >= row.length) return "";
    return String(row[col] ?? "").trim();
  };

  const getNum = (row: any[], col: number): number | null => {
    if (col < 0 || col >= row.length) return null;
    const v = row[col];
    if (v === null || v === undefined || v === "") return null;
    const num = Number(v);
    return isNaN(num) ? null : num;
  };

  const sNoCol = find("S.No", "sno", "s.no");
  const sourceCol = find("Source", "src", "er", "detection date", "date");
  const stationCol = find("Station", "stn", "operation station", "station number", "station no", "station no.", "station id");
  const areaCol = find("Area", "designation", "zone", "team", "zone team", "zone/team", "department");
  const concernCol = find("Concern", "description", "failure", "failure mode", "defect description");
  const drCol = find("Defect Rating", "dr", "rating", "defect", "defect rating (1/3/5)", "severity");

  console.log("Header Map:", colMap);
  console.log("Detected Columns:", { stationCol, areaCol, concernCol, sourceCol });
  const respCol = find("Resp", "responsible", "tl", "team leader", "supervisor", "lead", "mfg supervisor");
  const actionCol = find("MFG Action", "action", "action plan", "corrective action");
  const targetCol = find("Target", "deadline", "target date");
  const defectCodeCol = find("Defect Code", "defect code", "code", "failure code");
  const locationCodeCol = find("Location Code", "location code", "loc code", "defect location code", "location");
  const repairTimeCol = find("Repair Time", "rt", "repair time", "rt (min)");

  console.log("Crucial Indices:", { stationCol, areaCol, respCol, concernCol, drCol });

  const w6Col = find("W-6");
  const w5Col = find("W-5");
  const w4Col = find("W-4");
  const w3Col = find("W-3");
  const w2Col = find("W-2");
  const w1Col = find("W-1");
  const rcdrCol = find("RC+DR");

  // Specific index fallback for SQAM_Updatw.xlsm structure
  const useIndices = (colMap["er"] !== undefined || colMap["source"] !== undefined || rows.length > 5);

  const getIdx = (name: string, fallbackIdx: number) => {
    const found = find(name);
    return (found === -1 && useIndices) ? fallbackIdx : found;
  };

  // Dynamic Anchors (only DVM and T10 needed now)
  const dvmIdx = find("DVM");
  const t10Idx = find("T10");
  const implIdx = find("Implementation date");

  const detectionCols = {
    dvm: dvmIdx !== -1 ? dvmIdx : getIdx("DVM", 7),
    dvr: dvmIdx !== -1 ? dvmIdx + 1 : getIdx("DVR", 8),
    audit: dvmIdx !== -1 ? dvmIdx + 2 : getIdx("Product Audit", 9),
    warranty: dvmIdx !== -1 ? dvmIdx + 3 : getIdx("WARRANTY", 10),
    reoc: dvmIdx !== -1 ? dvmIdx + 5 : getIdx("Reoccurrence", 12),
  };

  const tBase = t10Idx !== -1 ? t10Idx : 15;
  const tCols = {
    T10: tBase, T20: tBase + 1, T30: tBase + 2, T40: tBase + 3,
    T50: tBase + 4, T60: tBase + 5, T70: tBase + 6, T80: tBase + 7,
    T90: tBase + 8, T100: tBase + 9, TPQG: tBase + 10,
  };

  const cCols = {
    C10: tBase + 11, C20: tBase + 12, C30: tBase + 13, C40: tBase + 14,
    C45: tBase + 15, C50: tBase + 16, C60: tBase + 17, C70: tBase + 18,
    C80: tBase + 19, P10: tBase + 20, P20: tBase + 21, P30: tBase + 22,
    R10: tBase + 23, PRESS: tBase + 24, PQG: tBase + 25,
  };

  const fCols = {
    F10: tBase + 26, F20: tBase + 27, F30: tBase + 28, F40: tBase + 29,
    F50: tBase + 30, F60: tBase + 31, F70: tBase + 32, F80: tBase + 33,
    F90: tBase + 34, F100: tBase + 35, F110: tBase + 36, FPQG: tBase + 37,
    TLAudit: tBase + 38, TorqueAudit: tBase + 39,
  };

  const outsideCols = {
    Static: tBase + 40,
    WheelAlignment: tBase + 41,
    HLAssembly: tBase + 42,
    DMCCABS: tBase + 43,
    CC4: tBase + 44,
    CertLine: tBase + 45,
  };

  const implDateCol = implIdx !== -1 ? implIdx : getIdx("Impl. Date", 62);
  const auditDateNameCol = implIdx !== -1 ? implIdx + 1 : getIdx("Audit Date", 63);

  const entries: QAMatrixEntry[] = [];

  const dataStartRow = lastHeaderRow !== -1 ? lastHeaderRow + 1 : 1;

  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const operationStation = getVal(row, stationCol) || "";
    const designation = getVal(row, areaCol) || "";
    const concern = getVal(row, concernCol) || "";

    // A valid row must have AT LEAST a concern OR an operation station
    if (!concern && !operationStation) continue;

    // Skip if it is definitely a header repetition (fuzzy check)
    const lowerConcern = concern.toLowerCase();
    const lowerStation = operationStation.toLowerCase();

    if (lowerConcern === "concern" || lowerConcern === "failure mode" ||
      lowerStation === "station" || lowerStation === "number" ||
      lowerStation === "station no." || lowerStation === "station number" ||
      lowerConcern === "detection date") continue;

    const drRaw = getNum(row, drCol);
    const defectRating = (drRaw === 1 || drRaw === 3 || drRaw === 5) ? drRaw : 1;

    const weeklyRecurrence = [
      getNum(row, w6Col) ?? 0, getNum(row, w5Col) ?? 0, getNum(row, w4Col) ?? 0,
      getNum(row, w3Col) ?? 0, getNum(row, w2Col) ?? 0, getNum(row, w1Col) ?? 0,
    ];
    const recurrence = weeklyRecurrence.reduce((a, b) => a + b, 0);

    const trim = {
      T10: getNum(row, tCols.T10), T20: getNum(row, tCols.T20), T30: getNum(row, tCols.T30),
      T40: getNum(row, tCols.T40), T50: getNum(row, tCols.T50), T60: getNum(row, tCols.T60),
      T70: getNum(row, tCols.T70), T80: getNum(row, tCols.T80), T90: getNum(row, tCols.T90),
      T100: getNum(row, tCols.T100), TPQG: getNum(row, tCols.TPQG),
    };

    const chassis = {
      C10: getNum(row, cCols.C10), C20: getNum(row, cCols.C20), C30: getNum(row, cCols.C30),
      C40: getNum(row, cCols.C40), C45: getNum(row, cCols.C45), C50: getNum(row, cCols.C50),
      C60: getNum(row, cCols.C60), C70: getNum(row, cCols.C70), C80: getNum(row, cCols.C80),
      P10: getNum(row, cCols.P10), P20: getNum(row, cCols.P20), P30: getNum(row, cCols.P30),
      R10: getNum(row, cCols.R10), PRESS: getNum(row, cCols.PRESS), PQG: getNum(row, cCols.PQG),
    };

    const final = {
      F10: getNum(row, fCols.F10), F20: getNum(row, fCols.F20), F30: getNum(row, fCols.F30),
      F40: getNum(row, fCols.F40), F50: getNum(row, fCols.F50), F60: getNum(row, fCols.F60),
      F70: getNum(row, fCols.F70), F80: getNum(row, fCols.F80), F90: getNum(row, fCols.F90),
      F100: getNum(row, fCols.F100), F110: getNum(row, fCols.F110), FPQG: getNum(row, fCols.FPQG),
      TLAudit: getNum(row, fCols.TLAudit), TorqueAudit: getNum(row, fCols.TorqueAudit),
    };

    const qControl: any = {
      freqControl_1_1: null, visualControl_1_2: null, periodicAudit_1_3: null, humanControl_1_4: null,
      saeAlert_3_1: null, freqMeasure_3_2: null, manualTool_3_3: null, humanTracking_3_4: null,
      autoControl_5_1: null, impossibility_5_2: null, saeProhibition_5_3: null
    };

    const qControlDetail: any = {
      CVT: null, SHOWER: null, DynamicUB: null, CC4: null
    };

    const teamLeader = getVal(row, respCol) || "";
    const resp = getVal(row, respCol) || "";

    const entry: QAMatrixEntry = {
      sNo: getNum(row, sNoCol) ?? (startSNo + entries.length),
      source: getVal(row, sourceCol) || "Import",
      operationStation: getVal(row, stationCol) || "",
      designation: getVal(row, areaCol) || "",
      concern,
      defectRating,
      recurrence,
      weeklyRecurrence,
      recurrenceCountPlusDefect: getNum(row, rcdrCol) ?? (defectRating + recurrence),
      trim, chassis, final,
      outsideProcess: {
        Static: getNum(row, outsideCols.Static),
        WheelAlignment: getNum(row, outsideCols.WheelAlignment),
        HLAssembly: getNum(row, outsideCols.HLAssembly),
        DMCCABS: getNum(row, outsideCols.DMCCABS),
        CC4: getNum(row, outsideCols.CC4),
        CertLine: getNum(row, outsideCols.CertLine),
      },
      qControl,
      qControlDetail,
      controlRating: {
        Workstation: null,
        Zone: null,
        Shop: null,
        Plant: null,
      },
      recordedDefect: {
        workstation: null,
        zone: null,
        shop: null,
        customer: null,
      },
      guaranteedQuality: {
        Workstation: null,
        Zone: null,
        Shop: null,
        Plant: null,
      },
      workstationStatus: "NG",
      mfgStatus: "NG",
      plantStatus: "NG",
      mfgAction: getVal(row, actionCol),
      defectCode: getVal(row, defectCodeCol),
      defectLocationCode: getVal(row, locationCodeCol),
      resp,
      teamLeader,
      target: getVal(row, targetCol),
      detectionFlags: {
        repairTime: getVal(row, repairTimeCol),
        dvmPQG: getVal(row, detectionCols.dvm),
        dvrDVT: getVal(row, detectionCols.dvr),
        productAuditSCA: getVal(row, detectionCols.audit),
        warranty: getVal(row, detectionCols.warranty),
        reoccurrence: getVal(row, detectionCols.reoc),
      },
      implementationDate: getVal(row, implDateCol),
      auditDateName: getVal(row, auditDateNameCol),
    };

    entries.push(recalculateStatuses(entry));
  }

  return entries;
}

const FileUploadDialog = ({ nextSNo, onImport }: FileUploadDialogProps) => {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<QAMatrixEntry[]>([]);
  const [fileName, setFileName] = useState("");
  const [inputMode, setInputMode] = useState<"file" | "link">("file");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const entries = parseSheet(sheet, nextSNo);
      setPreview(entries);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleLinkFetch = async () => {
    if (!linkUrl.trim()) return;
    setLinkError("");
    setLinkLoading(true);
    try {
      const workbook = await fetchWorkbookFromUrl(linkUrl.trim());
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const entries = parseSheet(sheet, nextSNo);
      if (entries.length === 0) {
        setLinkError("No valid rows found. Make sure the sheet has the correct format.");
      } else {
        setPreview(entries);
        setFileName(isGoogleSheetsUrl(linkUrl) ? "Google Sheets" : linkUrl.split("/").pop() || "Link");
      }
    } catch (err: any) {
      setLinkError(err.message || "Failed to fetch the spreadsheet. Make sure it is publicly accessible.");
    } finally {
      setLinkLoading(false);
    }
  };

  const handleImport = () => {
    if (preview.length > 0) {
      onImport(preview);
      setOpen(false);
      setPreview([]);
      setFileName("");
      setLinkUrl("");
    }
  };

  const handleClose = () => {
    setOpen(false);
    setPreview([]);
    setFileName("");
    setLinkUrl("");
    setLinkError("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Upload className="w-4 h-4" />
          Upload File
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[580px]">
        <DialogHeader>
          <DialogTitle>Import QA Matrix Data</DialogTitle>
          <DialogDescription>
            Choose a file or provide a link to import your QA Matrix concerns.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 w-fit">
            <button
              onClick={() => { setInputMode("file"); setPreview([]); setFileName(""); }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${inputMode === "file" ? "bg-card shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Upload File
            </button>
            <button
              onClick={() => { setInputMode("link"); setPreview([]); setFileName(""); }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${inputMode === "link" ? "bg-card shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Link2 className="w-3.5 h-3.5" />
              From Link
            </button>
          </div>

          {inputMode === "file" ? (
            <>
              <p className="text-sm text-muted-foreground">
                Upload a CSV or Excel file (.xlsx, .xls) with QA Matrix data.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFile}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
              />
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Paste a <strong>Google Sheets</strong>, <strong>OneDrive</strong>, or <strong>SharePoint</strong> Excel link. The file must be shared as "Anyone with the link" with no sign-in required.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={linkUrl}
                  onChange={(e) => { setLinkUrl(e.target.value); setLinkError(""); }}
                  className="flex-1 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && handleLinkFetch()}
                />
                <Button onClick={handleLinkFetch} disabled={!linkUrl.trim() || linkLoading} size="sm">
                  {linkLoading ? "Loading..." : "Fetch"}
                </Button>
              </div>
              {linkError && (
                <p className="text-xs text-destructive">{linkError}</p>
              )}
            </>
          )}

          {fileName && (
            <p className="text-sm">
              File: <span className="font-semibold">{fileName}</span> — {preview.length} rows detected
            </p>
          )}
          {preview.length > 0 && (
            <div className="max-h-[200px] overflow-auto border border-border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted/80 sticky top-0 border-b border-border">
                  <tr>
                    <th rowSpan={2} className="px-1 py-1 text-center border-r border-border min-w-8">#</th>
                    <th rowSpan={2} className="px-2 py-1 text-left border-r border-border min-w-16">Station</th>
                    <th rowSpan={2} className="px-1 py-1 text-left border-r border-border min-w-16">Zone</th>
                    <th rowSpan={2} className="px-1 py-1 text-left border-r border-border min-w-16">TL</th>
                    <th rowSpan={2} className="px-2 py-1 text-left border-r border-border">Concern</th>
                    <th colSpan={4} className="px-1 py-0.5 text-center border-r border-border bg-green-100/50">Control Rating</th>
                    <th colSpan={4} className="px-1 py-0.5 text-center border-r border-border bg-amber-100/50">Recorded Defect</th>
                    <th colSpan={4} className="px-1 py-0.5 text-center border-border bg-blue-100/50">Guaranteed Quality</th>
                  </tr>
                  <tr className="border-t border-border">
                    {/* Control Rating */}
                    <th className="px-1 py-0.5 text-[9px] border-r border-border text-center">WS</th>
                    <th className="px-1 py-0.5 text-[9px] border-r border-border text-center">Z</th>
                    <th className="px-1 py-0.5 text-[9px] border-r border-border text-center">S</th>
                    <th className="px-1 py-0.5 text-[9px] border-r border-border text-center">P</th>
                    {/* Recorded Defect */}
                    <th className="px-1 py-0.5 text-[9px] border-r border-border text-center">1M</th>
                    <th className="px-1 py-0.5 text-[9px] border-r border-border text-center">3Mz</th>
                    <th className="px-1 py-0.5 text-[9px] border-r border-border text-center">3Ms</th>
                    <th className="px-1 py-0.5 text-[9px] border-r border-border text-center">6M</th>
                    {/* Guaranteed Quality */}
                    <th className="px-1 py-0.5 text-[9px] border-r border-border text-center">WS</th>
                    <th className="px-1 py-0.5 text-[9px] border-r border-border text-center">Z</th>
                    <th className="px-1 py-0.5 text-[9px] border-r border-border text-center">S</th>
                    <th className="px-1 py-0.5 text-[9px] text-center">P</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 20).map((entry) => (
                    <tr key={entry.sNo} className="border-t border-border/30 hover:bg-muted/30">
                      <td className="px-1 py-1 text-center border-r border-border/30">{entry.sNo}</td>
                      <td className="px-2 py-1 border-r border-border/30">{entry.operationStation}</td>
                      <td className="px-1 py-1 border-r border-border/30 text-[10px]">{entry.designation}</td>
                      <td className="px-1 py-1 border-r border-border/30 text-[10px]">{entry.teamLeader}</td>
                      <td className="px-2 py-1 max-w-[150px] truncate border-r border-border/30" title={entry.concern}>{entry.concern}</td>

                      {/* Control Rating */}
                      <td className="px-1 py-1 text-center border-r border-border/30 font-semibold text-green-700 bg-green-50/20">{entry.controlRating?.Workstation ?? "-"}</td>
                      <td className="px-1 py-1 text-center border-r border-border/30 font-semibold text-green-700 bg-green-50/20">{entry.controlRating?.Zone ?? "-"}</td>
                      <td className="px-1 py-1 text-center border-r border-border/30 font-semibold text-green-700 bg-green-50/20">{entry.controlRating?.Shop ?? "-"}</td>
                      <td className="px-1 py-1 text-center border-r border-border/30 font-semibold text-green-700 bg-green-50/20">{entry.controlRating?.Plant ?? "-"}</td>

                      {/* Recorded Defect */}
                      <td className="px-1 py-1 text-center border-r border-border/30 font-semibold text-amber-700 bg-amber-50/20">{entry.recordedDefect?.workstation ?? "-"}</td>
                      <td className="px-1 py-1 text-center border-r border-border/30 font-semibold text-amber-700 bg-amber-50/20">{entry.recordedDefect?.zone ?? "-"}</td>
                      <td className="px-1 py-1 text-center border-r border-border/30 font-semibold text-amber-700 bg-amber-50/20">{entry.recordedDefect?.shop ?? "-"}</td>
                      <td className="px-1 py-1 text-center border-r border-border/30 font-semibold text-amber-700 bg-amber-50/20">{entry.recordedDefect?.customer ?? "-"}</td>

                      {/* Guaranteed Quality */}
                      <td className="px-1 py-1 text-center border-r border-border/30 font-semibold text-blue-700 bg-blue-50/20">{entry.guaranteedQuality?.Workstation ?? "-"}</td>
                      <td className="px-1 py-1 text-center border-r border-border/30 font-semibold text-blue-700 bg-blue-50/20">{entry.guaranteedQuality?.Zone ?? "-"}</td>
                      <td className="px-1 py-1 text-center border-r border-border/30 font-semibold text-blue-700 bg-blue-50/20">{entry.guaranteedQuality?.Shop ?? "-"}</td>
                      <td className="px-1 py-1 text-center font-semibold text-blue-700 bg-blue-50/20">{entry.guaranteedQuality?.Plant ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 20 && (
                <p className="text-xs text-muted-foreground p-2">...and {preview.length - 20} more rows</p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleImport} disabled={preview.length === 0}>
              Import {preview.length} Rows
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FileUploadDialog;
