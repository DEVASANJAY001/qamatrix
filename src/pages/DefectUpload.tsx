import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Shield, Upload, Trash2, ArrowLeft, Eye,
  Calendar, Database, BarChart3, Lock, AlertTriangle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type Source = "DVX" | "SCA" | "YARD";

/**
 * Raw row captured from the file — ALL columns, used only for preview display.
 * Extra columns beyond the 4 DB fields are never sent to the database.
 */
interface RawRow {
  // ── DB columns (inserted) ──────────────────────────────────────────────────
  defect_code: string;
  defect_location_code: string;
  defect_description_details: string;
  gravity: string;
  // ── Preview-only extra columns ────────────────────────────────────────────
  _date?: string;
  _defect_description?: string;
  _quantity?: string;
  _source_col?: string;
  _responsible?: string;
  _pof_family?: string;
  _pof_code?: string;
}

/**
 * What is stored in the `defect_data` table.
 * Matches the DB export: id · source · defect_code · defect_location_code
 *                        · defect_description_details · uploaded_at · gravity
 */
interface StoredDefect {
  id: string;
  source: Source;
  defect_code: string;
  defect_location_code: string;
  defect_description_details: string;
  gravity: string;
  uploaded_at: string;
}

const SOURCES: Source[] = ["DVX", "SCA", "YARD"];
const ALLOWED_GRAVITY = ["s", "p", "a"];

// ─── File Parser ──────────────────────────────────────────────────────────────
//  • Reads ALL columns → returned for full preview
//  • Filters rows: Gravity must be S, P, or A
//  • Only defect_code / defect_location_code / defect_description_details / gravity
//    are eventually sent to the DB

function parseFile(file: File): Promise<RawRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buf = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length < 2) { resolve([]); return; }

        // Locate the header row (scan first 10 rows)
        const knownHeaders = ["defect code", "defect description", "location", "gravity"];
        let hdrIdx = 0;
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          const row = rows[i];
          if (!row) continue;
          const norm = row.map((c: any) =>
            String(c ?? "").trim().toLowerCase().replace(/[\s\r\n]+/g, " ")
          );
          const hits = knownHeaders.filter(k => norm.some(h => h.includes(k))).length;
          if (hits >= 2) { hdrIdx = i; break; }
        }

        const headers = (rows[hdrIdx] || []).map((h: any) =>
          String(h ?? "").trim().toLowerCase().replace(/[\s\r\n]+/g, " ")
        );

        console.log("DefectUpload — headers:", headers);

        // Flexible column finder: exact → startsWith → contains
        const findCol = (...names: string[]) => {
          for (const pass of [
            (h: string, n: string) => h === n,
            (h: string, n: string) => h.startsWith(n),
            (h: string, n: string) => h.includes(n),
          ]) {
            for (const name of names) {
              const n = name.toLowerCase();
              const i = headers.findIndex(h => pass(h, n));
              if (i !== -1) return i;
            }
          }
          return -1;
        };

        // ── Column mapping ───────────────────────────────────────────────────
        // NOTE: In some DVX file formats the column literally named "Date"
        //       carries the Location Code value (not an actual date).
        //       We try dedicated location-code header names first; if none are
        //       found we fall back to the "date" column so those files keep
        //       working correctly.
        const locCol = (() => {
          const dedicated = findCol("location code", "loc code");
          if (dedicated !== -1) return dedicated;
          return findCol("date"); // fallback: "Date" column = location code
        })();

        const COL = {
          // "date" here is preview-only; if the file uses "date" as loc code
          // the preview cell will be empty — that is intentional.
          date: -1,
          loc: locCol,
          code: findCol("defect code"),
          // "Defect Description Details" must match before "Defect Description"
          details: findCol("defect description details"),
          // Short description — skip any header that contains "details"
          descShort: (() => {
            const exact = headers.indexOf("defect description");
            if (exact !== -1) return exact;
            return headers.findIndex(
              h => h.startsWith("defect description") && !h.includes("details")
            );
          })(),
          gravity: findCol("gravity"),
          qty: findCol("quantity"),
          src: findCol("source"),
          resp: findCol("responsible"),
          pofFam: findCol("pof family"),
          pofCode: findCol("pof code"),
        };

        console.log("DefectUpload — cols:", COL);

        const get = (row: any[], col: number) =>
          col !== -1 ? String(row[col] ?? "").trim() : "";

        const entries: RawRow[] = [];
        for (let i = hdrIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const code = get(row, COL.code);
          const loc = get(row, COL.loc);
          const details = get(row, COL.details);
          const gravity = get(row, COL.gravity);

          if (!code && !details) continue;

          // ── Filter: only gravity S / P / A ──────────────────────────────
          if (COL.gravity !== -1 && !ALLOWED_GRAVITY.includes(gravity.toLowerCase())) continue;

          entries.push({
            // DB fields
            defect_code: code,
            defect_location_code: loc,
            defect_description_details: details,
            gravity: gravity.toUpperCase(),
            // Preview-only
            _date: get(row, COL.date),
            _defect_description: get(row, COL.descShort),
            _quantity: get(row, COL.qty),
            _source_col: get(row, COL.src),
            _responsible: get(row, COL.resp),
            _pof_family: get(row, COL.pofFam),
            _pof_code: get(row, COL.pofCode),
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

// ─── UI helpers ───────────────────────────────────────────────────────────────

const SOURCE_BORDER: Record<Source, string> = {
  DVX: "border-sky-400/60",
  SCA: "border-emerald-400/60",
  YARD: "border-amber-400/60",
};

const GRAVITY_CLS: Record<string, string> = {
  S: "bg-red-100    text-red-700    dark:bg-red-900/40    dark:text-red-300",
  P: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  A: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
};

const GBadge = ({ g }: { g: string }) => (
  <span
    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold
      ${GRAVITY_CLS[g] ?? "bg-muted text-muted-foreground"}`}
  >
    {g || "—"}
  </span>
);

// DB-column header cell (highlighted)
const DBTh = ({ children }: { children: React.ReactNode }) => (
  <th className="px-2 py-2 text-left font-semibold text-primary bg-primary/10 border-x border-primary/20 whitespace-nowrap">
    {children}
    <span className="ml-1 text-[9px] opacity-60">★DB</span>
  </th>
);

// Extra (preview-only) header cell
const ExTh = ({ children }: { children: React.ReactNode }) => (
  <th className="px-2 py-2 text-left font-normal text-muted-foreground whitespace-nowrap">{children}</th>
);

// DB-column data cell
const DBTd = ({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) => (
  <td className={`px-2 py-1.5 bg-primary/5 border-x border-primary/10 max-w-[200px] truncate ${mono ? "font-mono" : ""}`}>
    {children}
  </td>
);

// Extra data cell
const ExTd = ({ children }: { children: React.ReactNode }) => (
  <td className="px-2 py-1.5 text-muted-foreground max-w-[180px] truncate">{children}</td>
);

// ─── Source Section ───────────────────────────────────────────────────────────

const SourceSection = ({
  source, data, onRefresh, lastUploadDate,
}: {
  source: Source;
  data: StoredDefect[];
  onRefresh: () => void;
  lastUploadDate: string | null;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<RawRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [confirmUpload, setConfirmUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showReview, setShowReview] = useState(false);

  // ── Select file ────────────────────────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseFile(file);
      if (rows.length === 0) {
        toast({
          title: "No data found",
          description: "No rows with Gravity S, P, or A were found.",
          variant: "destructive",
        });
        return;
      }
      setPreview(rows);
      setShowPreview(true);
      setConfirmUpload(false);
    } catch {
      toast({ title: "Parse error", description: "Could not read the file.", variant: "destructive" });
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Upload — only the 4 DB fields + source ────────────────────────────────
  const handleUpload = async () => {
    setUploading(true);
    try {
      // Map to DB schema: id · source · defect_code · defect_location_code
      //                   · defect_description_details · uploaded_at · gravity
      const dbRows = preview.map(r => ({
        source,
        defect_code: r.defect_code,
        defect_location_code: r.defect_location_code,
        defect_description_details: r.defect_description_details,
        gravity: r.gravity,
      }));

      const { error } = await supabase.from("defect_data").insert(dbRows);
      if (error) throw error;

      // Mirror to final_defect if it exists
      const { error: fe } = await supabase.from("final_defect").insert(dbRows);
      if (fe) console.warn("final_defect insert:", fe.message);

      toast({
        title: "Upload successful",
        description: `${dbRows.length} defects saved for ${source}.`,
      });
      setPreview([]); setShowPreview(false); setConfirmUpload(false);
      onRefresh();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // ── Clear source data ──────────────────────────────────────────────────────
  const handleClear = async () => {
    if (!confirm(`Delete all ${source} defect data?`)) return;
    const { error: e1 } = await supabase.from("defect_data").delete().eq("source", source);
    const { error: e2 } = await supabase.from("final_defect").delete().eq("source", source);
    if (e1 || e2) {
      toast({ title: "Error", description: (e1 || e2)?.message, variant: "destructive" });
    } else {
      toast({ title: "Cleared", description: `All ${source} data deleted.` });
      onRefresh();
    }
  };

  return (
    <div className={`border-l-4 ${SOURCE_BORDER[source]} rounded-lg p-4 bg-card border border-border`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold">
            {source} Defects{" "}
            <span className="font-normal text-muted-foreground">({data.length} records)</span>
          </h3>
          {lastUploadDate && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Calendar className="w-3 h-3" />
              Last updated: {new Date(lastUploadDate).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()}>
            <Upload className="w-3.5 h-3.5" />
            Upload CSV / Excel
          </Button>
          {data.length > 0 && (
            <>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowReview(true)}>
                <Eye className="w-3.5 h-3.5" />
                Review
              </Button>
              <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={handleClear}>
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </Button>
            </>
          )}
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />

      {data.length === 0 && !showPreview && (
        <p className="text-xs text-muted-foreground italic">
          No data uploaded yet. Upload a CSV or Excel file.
        </p>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PREVIEW DIALOG
          Shows ALL columns from the source file.
          Columns that will be saved to the DB are highlighted (★DB).
          Only Gravity = S / P / A rows are included (already filtered by parser).
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={showPreview}
        onOpenChange={(v) => {
          if (!v) { setShowPreview(false); setPreview([]); setConfirmUpload(false); }
        }}
      >
        <DialogContent className="max-w-[96vw] w-full max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              Preview — {source} Upload
              <span className="text-xs font-normal text-muted-foreground">
                {preview.length} rows · Gravity S / P / A only
              </span>
              <span className="ml-auto text-xs font-normal text-primary flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary/30 border border-primary/40" />
                Columns marked ★DB will be saved to database
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto border border-border rounded-md">
            <table className="text-xs whitespace-nowrap border-collapse">
              <thead className="sticky top-0 z-10 bg-card shadow-sm">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold border-r border-border/50 w-8">#</th>

                  {/* ── Preview-only columns ── */}
                  <ExTh>null</ExTh>

                  {/* ── DB columns (highlighted) ── */}
                  <DBTh>Location Code</DBTh>
                  <DBTh>Defect Code</DBTh>

                  {/* ── Preview-only ── */}
                  <ExTh>Defect Description</ExTh>

                  {/* ── DB column ── */}
                  <DBTh>Description Details</DBTh>

                  {/* ── DB column ── */}
                  <DBTh>Gravity</DBTh>

                  {/* ── Preview-only columns ── */}
                  <ExTh>Qty</ExTh>
                  <ExTh>Source</ExTh>
                  <ExTh>Responsible</ExTh>
                  <ExTh>POF Family</ExTh>
                  <ExTh>POF Code</ExTh>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, idx) => (
                  <tr key={idx} className="border-t border-border/30 hover:bg-muted/20">
                    <td className="px-2 py-1.5 text-muted-foreground border-r border-border/40">{idx + 1}</td>

                    {/* Preview-only */}
                    <ExTd>{row._date}</ExTd>

                    {/* DB columns */}
                    <DBTd>{row.defect_location_code}</DBTd>
                    <DBTd mono>{row.defect_code}</DBTd>

                    {/* Preview-only */}
                    <ExTd>{row._defect_description}</ExTd>

                    {/* DB column */}
                    <DBTd>{row.defect_description_details}</DBTd>

                    {/* DB column — gravity badge */}
                    <td className="px-2 py-1.5 text-center bg-primary/5 border-x border-primary/10">
                      <GBadge g={row.gravity} />
                    </td>

                    {/* Preview-only */}
                    <ExTd>{row._quantity}</ExTd>
                    <ExTd>{row._source_col}</ExTd>
                    <ExTd>{row._responsible}</ExTd>
                    <ExTd>{row._pof_family}</ExTd>
                    <ExTd>{row._pof_code}</ExTd>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              size="sm" variant="outline"
              onClick={() => { setShowPreview(false); setPreview([]); }}
            >
              Cancel
            </Button>
            {!confirmUpload ? (
              <Button size="sm" onClick={() => setConfirmUpload(true)}>
                Upload {preview.length} Rows
              </Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={handleUpload} disabled={uploading}>
                {uploading ? "Uploading…" : `Confirm Upload to ${source}`}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          REVIEW DIALOG — shows what is stored in the DB
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={showReview} onOpenChange={setShowReview}>
        <DialogContent className="sm:max-w-[750px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Review — {source} Database Records ({data.length})</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto border border-border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold">Defect Code</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Location Details</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Description Details</th>
                  <th className="px-2 py-1.5 text-center font-semibold w-20">Gravity</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.id} className="border-t border-border/30 hover:bg-muted/20">
                    <td className="px-2 py-1 font-mono">{d.defect_code}</td>
                    <td className="px-2 py-1 max-w-[200px] truncate">{d.defect_location_code}</td>
                    <td className="px-2 py-1 max-w-[260px] truncate">{d.defect_description_details}</td>
                    <td className="px-2 py-1 text-center"><GBadge g={d.gravity ?? ""} /></td>
                    <td className="px-2 py-1 text-muted-foreground">
                      {new Date(d.uploaded_at).toLocaleDateString()}
                    </td>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

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
    const { data, error } = await supabase
      .from("defect_data")
      .select("id, source, defect_code, defect_location_code, defect_description_details, gravity, uploaded_at")
      .order("uploaded_at", { ascending: false });
    if (!error && data) setDefects(data as unknown as StoredDefect[]);
    setLoading(false);
  };

  useEffect(() => { fetchDefects(); }, []);

  const getLastUpload = (source: Source) =>
    defects.find(d => d.source === source)?.uploaded_at ?? null;

  const handleDelete = async () => {
    if (!deletePassword.trim()) { setDeleteError("Enter password"); return; }
    setDeleteError(""); setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-defects", {
        body: { password: deletePassword, target: deleteTarget },
      });
      if (error) throw error;
      if (data?.error) { setDeleteError(data.error); return; }
      toast({ title: "Deleted", description: `${deleteTarget} data deleted successfully.` });
      setDeleteDialogOpen(false); setDeletePassword(""); setDeleteTarget("ALL");
      fetchDefects();
    } catch (err: any) {
      setDeleteError(err.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const total = defects.length;
  const dvxCnt = defects.filter(d => d.source === "DVX").length;
  const scaCnt = defects.filter(d => d.source === "SCA").length;
  const yardCnt = defects.filter(d => d.source === "YARD").length;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top bar ── */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors">
            <ArrowLeft className="w-5 h-5 text-primary" />
          </Link>
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Defect Data Upload</h1>
            <p className="text-[11px] text-muted-foreground">
              Upload defect data for DVX, SCA, and YARD teams
            </p>
          </div>
          <div className="ml-auto">
            <Button
              size="sm" variant="destructive" className="gap-1.5"
              onClick={() => { setDeleteDialogOpen(true); setDeletePassword(""); setDeleteError(""); }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Data
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 py-6 space-y-6">
        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Defects", count: total, icon: <Database className="w-5 h-5 text-primary" />, bg: "bg-primary/15" },
            { label: "DVX Defects", count: dvxCnt, icon: <BarChart3 className="w-5 h-5 text-foreground" />, bg: "bg-muted" },
            { label: "SCA Defects", count: scaCnt, icon: <BarChart3 className="w-5 h-5 text-foreground" />, bg: "bg-muted" },
            { label: "YARD Defects", count: yardCnt, icon: <BarChart3 className="w-5 h-5 text-foreground" />, bg: "bg-muted" },
          ].map(({ label, count, icon, bg }) => (
            <div key={label} className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${bg}`}>{icon}</div>
              <div>
                <p className="text-2xl font-bold font-mono">{count}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Source panels ── */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          SOURCES.map(source => (
            <SourceSection
              key={source}
              source={source}
              data={defects.filter(d => d.source === source)}
              onRefresh={fetchDefects}
              lastUploadDate={getLastUpload(source)}
            />
          ))
        )}
      </main>

      {/* ── Delete Dialog ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Defect Data
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will permanently delete data from the database. Select what to delete:
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Delete Target</label>
              <select
                value={deleteTarget}
                onChange={e => setDeleteTarget(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background"
              >
                <option value="ALL">All Data (defect_data + final_defect)</option>
                <option value="FINAL">Final Defect Data Only</option>
                <option value="DVX">DVX Only</option>
                <option value="SCA">SCA Only</option>
                <option value="YARD">YARD Only</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3" /> Password Required
              </label>
              <input
                type="password"
                value={deletePassword}
                onChange={e => { setDeletePassword(e.target.value); setDeleteError(""); }}
                placeholder="Enter delete password"
                className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background
                           focus:outline-none focus:ring-2 focus:ring-ring"
                onKeyDown={e => e.key === "Enter" && handleDelete()}
                maxLength={50}
              />
            </div>
            {deleteError && (
              <p className="text-xs text-destructive font-semibold">{deleteError}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting || !deletePassword.trim()}
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DefectUpload;
