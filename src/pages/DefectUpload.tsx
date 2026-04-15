import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Shield, Upload, Trash2, ArrowLeft, Eye, Edit2, Save, Check, X, Calendar, Database, BarChart3, Lock, AlertTriangle, Filter } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Source = "DVX" | "SCA" | "YARD";

interface DefectRow {
  defect_code: string;
  defect_location_code: string;
  defect_description_details: string;
}

interface DVXFullRow {
  location_code: string;
  location_details: string;
  defect_code: string;
  defect_description: string;
  defect_description_details: string;
  gravity: string;
  quantity: number;
  source: string;
  responsible: string;
  pof_family: string;
  pof_code: string;
}

interface StoredDefect extends DefectRow {
  id: string;
  source: Source;
  uploaded_at: string;
}

interface StoredDVXDefect {
  id: string;
  location_code: string;
  location_details: string;
  defect_code: string;
  defect_description: string;
  defect_description_details: string;
  gravity: string;
  quantity: number;
  source: string;
  responsible: string;
  pof_family: string;
  pof_code: string;
  pairing_status: string;
  pairing_method: string | null;
  match_score: number | null;
  qa_matrix_sno: number | null;
  created_at: string;
}

const SOURCES: Source[] = ["DVX", "SCA", "YARD"];
const VALID_GRAVITIES = ["S", "P", "A"];

function normalizeHeader(h: string): string {
  return String(h || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\s]+/g, " ");
}

function findCol(headers: string[], ...names: string[]): number {
  for (const name of names) {
    const nm = normalizeHeader(name);
    const exact = headers.indexOf(nm);
    if (exact !== -1) return exact;
    const starts = headers.findIndex(h => h.startsWith(nm));
    if (starts !== -1) return starts;
    const contains = headers.findIndex(h => h.includes(nm));
    if (contains !== -1) return contains;
  }
  return -1;
}

function parseDVXFullFile(file: File): Promise<DVXFullRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length < 2) { resolve([]); return; }

        // Find header row
        const knownHeaders = ["defect description", "defect code", "gravity", "location details", "quantity"];
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          const row = rows[i];
          if (!row) continue;
          const normalized = row.map((c: any) => normalizeHeader(String(c || "")));
          const matchCount = knownHeaders.filter(kh => normalized.some(h => h.includes(kh))).length;
          if (matchCount >= 3) { headerRowIdx = i; break; }
        }

        const headers = (rows[headerRowIdx] || []).map((h: any) => normalizeHeader(String(h || "")));

        const dateCol = findCol(headers, "Date");
        const locCodeCol = findCol(headers, "Location Code", "Loc Code");
        const locDetailsCol = findCol(headers, "Location Details", "Location");
        const codeCol = findCol(headers, "Defect Code");
        const descCol = headers.indexOf("defect description") !== -1
          ? headers.indexOf("defect description")
          : findCol(headers, "Defect Description");
        const detailsCol = findCol(headers, "Defect Description Details");
        const gravityCol = findCol(headers, "Gravity");
        const qtyCol = findCol(headers, "Quantity");
        const sourceCol = findCol(headers, "Source");
        const respCol = findCol(headers, "Responsible");
        const pofFamilyCol = findCol(headers, "POF Family");
        const pofCodeCol = findCol(headers, "POF CODE", "POF Code");

        const getVal = (row: any[], col: number): string => {
          if (col < 0 || col >= row.length) return "";
          return String(row[col] ?? "").trim();
        };

        const entries: DVXFullRow[] = [];
        for (let i = headerRowIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const gravity = getVal(row, gravityCol).toUpperCase();
          // Only keep S, P, A gravity
          if (!VALID_GRAVITIES.includes(gravity)) continue;

          const desc = getVal(row, descCol);
          const details = getVal(row, detailsCol);
          if (!desc && !details) continue;

          const qtyRaw = qtyCol >= 0 ? row[qtyCol] : 0;
          const qty = typeof qtyRaw === "number" ? qtyRaw : parseInt(String(qtyRaw)) || 1;

          const dateVal = getVal(row, dateCol);
          // Fall back to Date column if no dedicated Location Code column
          const locCode = locCodeCol >= 0 ? getVal(row, locCodeCol) : dateVal;

          entries.push({
            location_code: locCode,
            location_details: getVal(row, locDetailsCol),
            defect_code: getVal(row, codeCol),
            defect_description: desc,
            defect_description_details: details,
            gravity,
            quantity: qty,
            source: getVal(row, sourceCol),
            responsible: getVal(row, respCol),
            pof_family: getVal(row, pofFamilyCol),
            pof_code: getVal(row, pofCodeCol),
          });
        }
        resolve(entries);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function parseFile(file: File): Promise<DefectRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length < 2) { resolve([]); return; }

        const headers = (rows[0] || []).map((h: any) => String(h || "").trim().toLowerCase());
        const findC = (...names: string[]) => {
          for (const name of names) {
            const idx = headers.findIndex(h => h.includes(name.toLowerCase()));
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const codeCol = findC("defect code", "code");
        const locCol = findC("location code", "location", "loc code");
        const descCol = findC("description detail", "defect description", "description");

        const entries: DefectRow[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          const code = String(row[codeCol] ?? "").trim();
          const loc = String(row[locCol] ?? "").trim();
          const desc = String(row[descCol] ?? "").trim();
          if (!code && !desc) continue;
          entries.push({ defect_code: code, defect_location_code: loc, defect_description_details: desc });
        }
        resolve(entries);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// DVX Upload Section with gravity filtering
const DVXUploadSection = ({ onRefresh }: { onRefresh: () => void }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<DVXFullRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [totalParsed, setTotalParsed] = useState(0);
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [dvxData, setDvxData] = useState<StoredDVXDefect[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [gravityFilter, setGravityFilter] = useState<string>("");
  const [pairingFilter, setPairingFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchDVXData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("dvx_defects")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setDvxData(data as StoredDVXDefect[]);
    setLoading(false);
  };

  useEffect(() => { fetchDVXData(); }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Parse with gravity filter
      const allRows = await parseDVXFullFile(file);
      // allRows already filtered to S/P/A
      // But let's also count how many were in the raw file
      const rawReader = new FileReader();
      const rawCount = await new Promise<number>((resolve) => {
        rawReader.onload = (evt) => {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          resolve(Math.max(0, rows.length - 1));
        };
        rawReader.readAsArrayBuffer(file);
      });

      setTotalParsed(rawCount);
      setTotalFiltered(allRows.length);

      if (allRows.length === 0) {
        toast({ title: "No matching data", description: "No rows found with Gravity S, P, or A.", variant: "destructive" });
        return;
      }
      setPreview(allRows);
      setShowPreview(true);
    } catch {
      toast({ title: "Parse error", description: "Could not read the file.", variant: "destructive" });
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleUpload = async () => {
    setUploading(true);
    try {
      const insertRows = preview.map(r => ({
        location_code: r.location_code,
        location_details: r.location_details,
        defect_code: r.defect_code,
        defect_description: r.defect_description,
        defect_description_details: r.defect_description_details,
        gravity: r.gravity,
        quantity: r.quantity,
        source: r.source,
        responsible: r.responsible,
        pof_family: r.pof_family,
        pof_code: r.pof_code,
        pairing_status: "not_paired",
      }));

      // Batch insert
      const BATCH = 200;
      for (let i = 0; i < insertRows.length; i += BATCH) {
        const batch = insertRows.slice(i, i + BATCH);
        const { error } = await supabase.from("dvx_defects").insert(batch);
        if (error) throw error;
      }

      // Also insert into final_defect for legacy compatibility
      const finalRows = preview.map(r => ({
        defect_code: r.defect_code,
        defect_location_code: r.location_code,
        defect_description_details: r.defect_description_details,
        source: r.source || "DVX",
        gravity: r.gravity,
      }));
      for (let i = 0; i < finalRows.length; i += BATCH) {
        const batch = finalRows.slice(i, i + BATCH);
        await supabase.from("final_defect").insert(batch);
      }

      toast({ title: "Upload successful", description: `${preview.length} DVX defects uploaded (filtered: S/P/A gravity).` });
      setPreview([]);
      setShowPreview(false);
      fetchDVXData();
      onRefresh();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleClearDVX = async () => {
    if (!confirm("Delete all DVX defect data?")) return;
    const { error } = await supabase.from("dvx_defects").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Cleared", description: "All DVX defect data deleted." });
      fetchDVXData();
      onRefresh();
    }
  };

  const filteredDVXData = dvxData.filter(d => {
    if (gravityFilter && d.gravity !== gravityFilter) return false;
    if (pairingFilter && d.pairing_status !== pairingFilter) return false;
    return true;
  });

  const pairedCount = dvxData.filter(d => d.pairing_status === "paired").length;
  const notPairedCount = dvxData.filter(d => d.pairing_status === "not_paired").length;

  return (
    <div className="border-l-4 border-sky-400/60 rounded-lg p-4 bg-card border border-border">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold">DVX Defects <span className="text-muted-foreground font-normal">({dvxData.length} records)</span></h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Only Gravity S / P / A records are stored ·
            <span className="text-primary font-semibold ml-1">{pairedCount} paired</span> ·
            <span className="text-warning font-semibold ml-1">{notPairedCount} not paired</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()}>
            <Upload className="w-3.5 h-3.5" />
            Upload DVX Excel
          </Button>
          {dvxData.length > 0 && (
            <>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowReview(true)}>
                <Eye className="w-3.5 h-3.5" />
                Review
              </Button>
              <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={handleClearDVX}>
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </Button>
            </>
          )}
        </div>
      </div>
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />

      {dvxData.length === 0 && !showPreview && (
        <p className="text-xs text-muted-foreground italic">No DVX data uploaded yet. Upload an Excel file with DVX defect data.</p>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={(v) => { if (!v) { setShowPreview(false); setPreview([]); } }}>
        <DialogContent className="sm:max-w-[850px] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>DVX Upload Preview</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3 text-xs mb-2">
            <span className="bg-muted px-2 py-1 rounded">Total rows in file: <strong>{totalParsed}</strong></span>
            <span className="bg-primary/10 text-primary px-2 py-1 rounded">After S/P/A filter: <strong>{totalFiltered}</strong></span>
            <span className="bg-destructive/10 text-destructive px-2 py-1 rounded">Filtered out: <strong>{totalParsed - totalFiltered}</strong></span>
          </div>
          <div className="flex-1 overflow-auto border border-border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold w-8">#</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Defect Code</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Location Code</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Description</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Details</th>
                  <th className="px-2 py-1.5 text-center font-semibold">Gravity</th>
                  <th className="px-2 py-1.5 text-center font-semibold">Qty</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Source</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 200).map((row, idx) => (
                  <tr key={idx} className="border-t border-border/30">
                    <td className="px-2 py-1 text-muted-foreground">{idx + 1}</td>
                    <td className="px-2 py-1 font-mono">{row.defect_code}</td>
                    <td className="px-2 py-1 font-mono">{row.location_code}</td>
                    <td className="px-2 py-1 max-w-[180px] truncate">{row.defect_description}</td>
                    <td className="px-2 py-1 max-w-[180px] truncate">{row.defect_description_details}</td>
                    <td className="px-2 py-1 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${row.gravity === "S" ? "bg-destructive/15 text-destructive" :
                          row.gravity === "P" ? "bg-warning/15 text-warning" :
                            "bg-primary/15 text-primary"
                        }`}>{row.gravity}</span>
                    </td>
                    <td className="px-2 py-1 text-center font-mono">{row.quantity}</td>
                    <td className="px-2 py-1">{row.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 200 && (
              <p className="text-xs text-muted-foreground text-center py-2">Showing first 200 of {preview.length} rows</p>
            )}
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-xs text-muted-foreground">{preview.length} rows ready (S/P/A only)</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setShowPreview(false); setPreview([]); }}>Cancel</Button>
              <Button size="sm" onClick={handleUpload} disabled={uploading}>
                {uploading ? "Uploading..." : `Upload ${preview.length} Rows`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review stored DVX data dialog */}
      <Dialog open={showReview} onOpenChange={setShowReview}>
        <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>DVX Defect Data ({dvxData.length} records)</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select value={gravityFilter} onChange={e => setGravityFilter(e.target.value)} className="px-2 py-1 text-xs border border-input rounded bg-background">
              <option value="">All Gravity</option>
              <option value="S">S - Safety</option>
              <option value="P">P - Performance</option>
              <option value="A">A - Appearance</option>
            </select>
            <select value={pairingFilter} onChange={e => setPairingFilter(e.target.value)} className="px-2 py-1 text-xs border border-input rounded bg-background">
              <option value="">All Status</option>
              <option value="paired">Paired</option>
              <option value="not_paired">Not Paired</option>
            </select>
            <span className="text-xs text-muted-foreground ml-auto">{filteredDVXData.length} of {dvxData.length}</span>
          </div>
          <div className="flex-1 overflow-auto border border-border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold">Defect Code</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Location</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Description</th>
                  <th className="px-2 py-1.5 text-center font-semibold">Gravity</th>
                  <th className="px-2 py-1.5 text-center font-semibold">Qty</th>
                  <th className="px-2 py-1.5 text-center font-semibold">Status</th>
                  <th className="px-2 py-1.5 text-center font-semibold">Method</th>
                  <th className="px-2 py-1.5 text-center font-semibold">QA #</th>
                </tr>
              </thead>
              <tbody>
                {filteredDVXData.map((d) => (
                  <tr key={d.id} className="border-t border-border/30">
                    <td className="px-2 py-1 font-mono">{d.defect_code}</td>
                    <td className="px-2 py-1 max-w-[150px] truncate">{d.location_details || d.location_code}</td>
                    <td className="px-2 py-1 max-w-[200px] truncate">{d.defect_description_details}</td>
                    <td className="px-2 py-1 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${d.gravity === "S" ? "bg-destructive/15 text-destructive" :
                          d.gravity === "P" ? "bg-warning/15 text-warning" :
                            "bg-primary/15 text-primary"
                        }`}>{d.gravity}</span>
                    </td>
                    <td className="px-2 py-1 text-center font-mono">{d.quantity}</td>
                    <td className="px-2 py-1 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${d.pairing_status === "paired" ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning"
                        }`}>{d.pairing_status === "paired" ? "Paired" : "Not Paired"}</span>
                    </td>
                    <td className="px-2 py-1 text-center text-[10px]">{d.pairing_method || "—"}</td>
                    <td className="px-2 py-1 text-center font-mono">{d.qa_matrix_sno || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SourceSection = ({ source, data, onRefresh, lastUploadDate }: { source: Source; data: StoredDefect[]; onRefresh: () => void; lastUploadDate: string | null }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<DefectRow[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<DefectRow>({ defect_code: "", defect_location_code: "", defect_description_details: "" });
  const [showPreview, setShowPreview] = useState(false);
  const [confirmUpload, setConfirmUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasEdits, setHasEdits] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseFile(file);
      if (rows.length === 0) {
        toast({ title: "No data found", description: "The file has no valid rows.", variant: "destructive" });
        return;
      }
      setPreview(rows);
      setShowPreview(true);
      setHasEdits(false);
      setConfirmUpload(false);
    } catch {
      toast({ title: "Parse error", description: "Could not read the file.", variant: "destructive" });
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const startEdit = (idx: number) => { setEditingIdx(idx); setEditRow({ ...preview[idx] }); };
  const saveEdit = () => {
    if (editingIdx === null) return;
    const updated = [...preview];
    updated[editingIdx] = { ...editRow };
    setPreview(updated);
    setEditingIdx(null);
    setHasEdits(true);
  };
  const deletePreviewRow = (idx: number) => { setPreview(prev => prev.filter((_, i) => i !== idx)); setHasEdits(true); };
  const handleConfirmEdits = () => { setHasEdits(false); toast({ title: "Edits saved", description: "Changes confirmed." }); };

  const handleUpload = async () => {
    setUploading(true);
    try {
      const insertRows = preview.map(r => ({ ...r, source }));
      const { error } = await supabase.from("defect_data").insert(insertRows);
      if (error) throw error;

      const finalRows = preview
        .filter(r => r.defect_code || r.defect_description_details)
        .map(r => ({ defect_code: r.defect_code, defect_location_code: r.defect_location_code, defect_description_details: r.defect_description_details, source }));
      if (finalRows.length > 0) {
        const { error: finalError } = await supabase.from("final_defect").insert(finalRows);
        if (finalError) console.error("final_defect insert error:", finalError);
      }

      toast({ title: "Upload successful", description: `${preview.length} defects uploaded for ${source}.` });
      setPreview([]); setShowPreview(false); setConfirmUpload(false);
      onRefresh();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  const handleClear = async () => {
    if (!confirm(`Delete all ${source} defect data?`)) return;
    const { error: e1 } = await supabase.from("defect_data").delete().eq("source", source);
    const { error: e2 } = await supabase.from("final_defect").delete().eq("source", source);
    if (e1 || e2) toast({ title: "Error", description: (e1 || e2)?.message, variant: "destructive" });
    else { toast({ title: "Cleared", description: `All ${source} data deleted.` }); onRefresh(); }
  };

  const sourceColors: Record<Source, string> = { DVX: "border-sky-400/60", SCA: "border-emerald-400/60", YARD: "border-amber-400/60" };

  return (
    <div className={`border-l-4 ${sourceColors[source]} rounded-lg p-4 bg-card border border-border`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold">{source} Defects <span className="text-muted-foreground font-normal">({data.length} records)</span></h3>
          {lastUploadDate && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Calendar className="w-3 h-3" />Last updated: {new Date(lastUploadDate).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()}>
            <Upload className="w-3.5 h-3.5" />Upload CSV/Excel
          </Button>
          {data.length > 0 && (
            <>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowReview(true)}>
                <Eye className="w-3.5 h-3.5" />Review
              </Button>
              <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={handleClear}>
                <Trash2 className="w-3.5 h-3.5" />Clear All
              </Button>
            </>
          )}
        </div>
      </div>
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />
      {data.length === 0 && !showPreview && <p className="text-xs text-muted-foreground italic">No data uploaded yet.</p>}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={(v) => { if (!v) { setShowPreview(false); setPreview([]); setConfirmUpload(false); } }}>
        <DialogContent className="sm:max-w-[750px] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>Preview — {source} Upload ({preview.length} rows)</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-auto border border-border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold w-8">#</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Defect Code</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Location Code</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Description Details</th>
                  <th className="px-2 py-1.5 text-center font-semibold w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, idx) => (
                  <tr key={idx} className="border-t border-border/30">
                    {editingIdx === idx ? (
                      <>
                        <td className="px-2 py-1 text-muted-foreground">{idx + 1}</td>
                        <td className="px-2 py-1"><input className="w-full px-1 py-0.5 border border-input rounded text-xs bg-background" value={editRow.defect_code} onChange={e => setEditRow({ ...editRow, defect_code: e.target.value })} /></td>
                        <td className="px-2 py-1"><input className="w-full px-1 py-0.5 border border-input rounded text-xs bg-background" value={editRow.defect_location_code} onChange={e => setEditRow({ ...editRow, defect_location_code: e.target.value })} /></td>
                        <td className="px-2 py-1"><input className="w-full px-1 py-0.5 border border-input rounded text-xs bg-background" value={editRow.defect_description_details} onChange={e => setEditRow({ ...editRow, defect_description_details: e.target.value })} /></td>
                        <td className="px-2 py-1 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={saveEdit} className="p-1 rounded hover:bg-primary/10 text-primary"><Check className="w-3 h-3" /></button>
                            <button onClick={() => setEditingIdx(null)} className="p-1 rounded hover:bg-destructive/10 text-destructive"><X className="w-3 h-3" /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-1 text-muted-foreground">{idx + 1}</td>
                        <td className="px-2 py-1 font-mono">{row.defect_code}</td>
                        <td className="px-2 py-1 font-mono">{row.defect_location_code}</td>
                        <td className="px-2 py-1 max-w-[300px] truncate">{row.defect_description_details}</td>
                        <td className="px-2 py-1 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => startEdit(idx)} className="p-1 rounded hover:bg-primary/10 text-muted-foreground"><Edit2 className="w-3 h-3" /></button>
                            <button onClick={() => deletePreviewRow(idx)} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-xs text-muted-foreground">{preview.length} rows ready</span>
            <div className="flex gap-2">
              {hasEdits && <Button size="sm" variant="outline" className="gap-1.5" onClick={handleConfirmEdits}><Save className="w-3.5 h-3.5" />Confirm Edits</Button>}
              <Button size="sm" variant="outline" onClick={() => { setShowPreview(false); setPreview([]); }}>Cancel</Button>
              {!confirmUpload ? (
                <Button size="sm" onClick={() => setConfirmUpload(true)} disabled={hasEdits}>Upload {preview.length} Rows</Button>
              ) : (
                <Button size="sm" variant="destructive" onClick={handleUpload} disabled={uploading}>{uploading ? "Uploading..." : `Confirm Upload to ${source}`}</Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review stored data */}
      <Dialog open={showReview} onOpenChange={setShowReview}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>Review — {source} Data ({data.length} records)</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-auto border border-border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold">Defect Code</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Location Code</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Description Details</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.id} className="border-t border-border/30">
                    <td className="px-2 py-1 font-mono">{d.defect_code}</td>
                    <td className="px-2 py-1 font-mono">{d.defect_location_code}</td>
                    <td className="px-2 py-1 max-w-[300px] truncate">{d.defect_description_details}</td>
                    <td className="px-2 py-1 text-muted-foreground">{new Date(d.uploaded_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const DefectUpload = () => {
  const [defects, setDefects] = useState<StoredDefect[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<"DVX" | "SCA" | "YARD" | "ALL" | "FINAL">("ALL");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchDefects = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("defect_data").select("*").order("uploaded_at", { ascending: false });
    if (!error && data) setDefects(data as StoredDefect[]);
    setLoading(false);
  };

  useEffect(() => { fetchDefects(); }, []);

  const getLastUploadDate = (source: Source): string | null => {
    const sourceData = defects.filter(d => d.source === source);
    if (sourceData.length === 0) return null;
    return sourceData[0].uploaded_at;
  };

  const handleDelete = async () => {
    if (!deletePassword.trim()) { setDeleteError("Enter password"); return; }
    setDeleteError("");
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-defects", {
        body: { password: deletePassword, target: deleteTarget },
      });
      if (error) throw error;
      if (data?.error) { setDeleteError(data.error); setDeleting(false); return; }
      toast({ title: "Deleted", description: `${deleteTarget} data deleted successfully.` });
      setDeleteDialogOpen(false); setDeletePassword(""); setDeleteTarget("ALL");
      fetchDefects();
    } catch (err: any) {
      setDeleteError(err.message || "Delete failed");
    } finally { setDeleting(false); }
  };

  const totalDefects = defects.length;
  const dvxCount = defects.filter(d => d.source === "DVX").length;
  const scaCount = defects.filter(d => d.source === "SCA").length;
  const yardCount = defects.filter(d => d.source === "YARD").length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors">
            <ArrowLeft className="w-5 h-5 text-primary" />
          </Link>
          <div className="p-2 rounded-lg bg-primary/10"><Shield className="w-5 h-5 text-primary" /></div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Defect Data Upload</h1>
            <p className="text-[11px] text-muted-foreground">Upload defect data for DVX, SCA, and YARD teams</p>
          </div>
          <div className="ml-auto">
            <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => { setDeleteDialogOpen(true); setDeletePassword(""); setDeleteError(""); }}>
              <Lock className="w-3.5 h-3.5" />Admin Delete
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 py-6 space-y-6">
        {/* Dashboard stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/15"><Database className="w-5 h-5 text-primary" /></div>
            <div><p className="text-2xl font-bold font-mono">{totalDefects}</p><p className="text-xs text-muted-foreground">Total Records</p></div>
          </div>
          {SOURCES.map(s => {
            const count = s === "DVX" ? dvxCount : s === "SCA" ? scaCount : yardCount;
            const colors = { DVX: "text-sky-500", SCA: "text-emerald-500", YARD: "text-amber-500" };
            return (
              <div key={s} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-muted"><BarChart3 className={`w-5 h-5 ${colors[s]}`} /></div>
                <div><p className="text-2xl font-bold font-mono">{count}</p><p className="text-xs text-muted-foreground">{s}</p></div>
              </div>
            );
          })}
        </div>

        {/* DVX Upload Section (with gravity filtering) */}
        <DVXUploadSection onRefresh={fetchDefects} />

        {/* SCA and YARD sections */}
        {(["SCA", "YARD"] as Source[]).map(source => (
          <SourceSection
            key={source}
            source={source}
            data={defects.filter(d => d.source === source)}
            onRefresh={fetchDefects}
            lastUploadDate={getLastUploadDate(source)}
          />
        ))}
      </main>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" />Admin Delete</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <select value={deleteTarget} onChange={e => setDeleteTarget(e.target.value as any)} className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background">
              <option value="ALL">All Data (defect_data + final_defect + dvx_defects)</option>
              <option value="DVX">DVX Only</option>
              <option value="SCA">SCA Only</option>
              <option value="YARD">YARD Only</option>
              <option value="FINAL">Final Defect Table Only</option>
            </select>
            <input type="password" placeholder="Admin password..." value={deletePassword} onChange={e => { setDeletePassword(e.target.value); setDeleteError(""); }}
              className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background" />
            {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? "Deleting..." : "Delete"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DefectUpload;
