import { useState, useRef, useMemo, useEffect } from "react";
import { QAMatrixEntry } from "@/types/qaMatrix";
import { DVXEntry, MatchedRepeat, UnmatchedDefect } from "@/types/dvxReport";
import { parseDVXSheet } from "@/utils/dvxParser";
import { recalculateStatuses } from "@/utils/qaCalculations";
import { exportToXLSX } from "@/utils/xlsxExport";
import { fetchWorkbookFromUrl, isGoogleSheetsUrl } from "@/utils/googleSheetsImport";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "@/components/Dashboard";
import MatrixDashboard from "@/components/MatrixDashboard";
import QAMatrixTable from "@/components/QAMatrixTable";
import PairingContainer from "@/components/PairingContainer";
import ClosedLoopDashboard from "@/components/ClosedLoopDashboard";
import ClosedLoopDashboardV2 from "@/components/ClosedLoopDashboardV2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, Plus, AlertTriangle, CheckCircle, X, Search, Filter, FileSpreadsheet, ArrowUpCircle, Link2, Brain, Loader2, ChevronDown, ChevronRight, ListFilter, Download, Play, Calendar, BarChart3, Activity } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface UniqueDefectGroup {
  key: string;
  defectCode: string;
  defectDescription: string;
  defectDescriptionDetails: string;
  gravity: string;
  totalQty: number;
  entries: DVXEntry[];
}

interface RepeatsTabProps {
  qaData: QAMatrixEntry[];
  dvxEntries: DVXEntry[];
  fileName: string;
  matched: MatchedRepeat[];
  unmatched: UnmatchedDefect[];
  addedIds: Set<string>;
  onFileUpload: (entries: DVXEntry[], fileName: string, mode: "code" | "semantic") => void;
  onAddToQAMatrix: (entry: QAMatrixEntry) => void;
  onClear: () => void;
  onSetAddedIds: (ids: Set<string>) => void;
  onWeeklyUpdate: (sNo: number, weekIndex: number, value: number) => void;
  onScoreUpdate: (sNo: number, section: "trim" | "chassis" | "final" | "qControl" | "qControlDetail", key: string, value: number | null) => void;
  onFieldUpdate: (sNo: number, field: string, value: string) => void;
  onDeleteEntry: (sNo: number) => void;
  onDashboardFilter: (filterType: string, filterValue: string) => void;
  onApplyToMatrix: () => void;
  onUnpair: (qaSNo: number, dvxIdx: number) => void;
  onReassign: (dvxEntry: DVXEntry, fromSNo: number, toSNo: number) => void;
  onManualPair: (unmatchedId: string, qaSNo: number) => void;
  isApplied: boolean;
  isAIMatching?: boolean;
}

const RepeatsTab = ({
  qaData, dvxEntries, fileName, matched, unmatched, addedIds,
  onFileUpload, onAddToQAMatrix, onClear, onSetAddedIds,
  onWeeklyUpdate, onScoreUpdate, onFieldUpdate, onDeleteEntry, onDashboardFilter,
  onApplyToMatrix, onUnpair, onReassign, onManualPair, isApplied, isAIMatching,
}: RepeatsTabProps) => {
  const [lastDefectUpdate, setLastDefectUpdate] = useState<string | null>(null);
  const [lastPairedDate, setLastPairedDate] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [clDashView, setClDashView] = useState<"classic" | "analytics">("classic");

  // Fetch last updated dates
  useEffect(() => {
    const fetchDates = async () => {
      const { data: defectData } = await supabase
        .from("final_defect")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      if (defectData && defectData.length > 0) {
        setLastDefectUpdate(defectData[0].created_at);
      }
    };
    fetchDates();
  }, [dvxEntries]);

  const handleStartPairing = async (mode: "code" | "semantic") => {
    setPairingLoading(true);
    try {
      const { data: finalDefects, error } = await supabase
        .from("final_defect")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!finalDefects || finalDefects.length === 0) {
        toast({ title: "No defect data", description: "Upload defect data first in the Defect Data page.", variant: "destructive" });
        setPairingLoading(false);
        return;
      }

      // Convert final_defect rows to DVXEntry format for the matching engine
      const entries: DVXEntry[] = finalDefects.map((d: any, idx: number) => ({
        date: new Date(d.created_at).toLocaleDateString(),
        locationCode: d.defect_location_code || "",
        locationDetails: d.defect_location_code || "",
        defectCode: d.defect_code || "",
        defectDescription: d.defect_description_details?.split(" ").slice(0, 5).join(" ") || "",
        defectDescriptionDetails: d.defect_description_details || "",
        gravity: d.gravity || "",
        quantity: 1,
        source: d.source || "",
        responsible: "",
        pofFamily: "",
        pofCode: "",
      }));

      setLastPairedDate(new Date().toISOString());
      onFileUpload(entries, `Final Defect Data (${entries.length} records)`, mode);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setPairingLoading(false);
    }
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadMode, setUploadMode] = useState<"file" | "link">("file");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedUnmatched, setSelectedUnmatched] = useState<UnmatchedDefect | null>(null);
  const [pairMode, setPairMode] = useState<"new" | "existing">("existing");
  const [selectedPairSNo, setSelectedPairSNo] = useState<string>("");

  // Add concern form state
  const [formSource, setFormSource] = useState("");
  const [formStation, setFormStation] = useState("");
  const [formDesignation, setFormDesignation] = useState("Trim");
  const [formRating, setFormRating] = useState<1 | 3 | 5>(1);
  const [formConcern, setFormConcern] = useState("");
  const [formAction, setFormAction] = useState("");
  const [formResp, setFormResp] = useState("");
  const [formTarget, setFormTarget] = useState("");

  // Filters for matched QA table
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const entries = parseDVXSheet(sheet);
      onFileUpload(entries, file.name, "semantic");
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
      const entries = parseDVXSheet(sheet);
      if (entries.length === 0) {
        setLinkError("No valid defect rows found. Make sure this is a DVX/Repeat Issues report.");
      } else {
        const name = isGoogleSheetsUrl(linkUrl) ? "Google Sheets" : linkUrl.split("/").pop() || "Link";
        onFileUpload(entries, name, "semantic");
        setLinkUrl("");
      }
    } catch (err: any) {
      setLinkError(err.message || "Failed to fetch. Make sure the sheet is publicly accessible.");
    } finally {
      setLinkLoading(false);
    }
  };

  const handleClear = () => {
    onClear();
    if (fileRef.current) fileRef.current.value = "";
    setLinkUrl("");
    setLinkError("");
  };

  const openAddDialog = (item: UnmatchedDefect) => {
    setSelectedUnmatched(item);
    setPairMode("existing");
    setSelectedPairSNo("");
    const dvx = item.dvxEntry;
    setFormSource(dvx.source || "");
    setFormStation(dvx.locationDetails || "");
    setFormDesignation(dvx.pofCode || "Trim");
    setFormRating(dvx.gravity === "A" ? 5 : dvx.gravity === "B" ? 3 : 1);
    setFormConcern(`${dvx.defectDescription} - ${dvx.defectDescriptionDetails}`.trim().replace(/ - $/, ""));
    setFormAction("");
    setFormResp(dvx.responsible || "");
    setFormTarget("");
    setAddDialogOpen(true);
  };

  const handlePairExisting = () => {
    if (!selectedUnmatched || !selectedPairSNo) return;
    onManualPair(selectedUnmatched.id, Number(selectedPairSNo));
    onSetAddedIds(new Set(addedIds).add(selectedUnmatched.id));
    setAddDialogOpen(false);
    setSelectedUnmatched(null);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnmatched || !formConcern) return;

    const nextSNo = qaData.length > 0 ? Math.max(...qaData.map(q => q.sNo)) + 1 : 1;
    const n = null;
    const newEntry: QAMatrixEntry = {
      sNo: nextSNo,
      source: formSource,
      operationStation: formStation,
      designation: formDesignation,
      concern: formConcern,
      defectRating: formRating,
      recurrence: selectedUnmatched.dvxEntry.quantity,
      weeklyRecurrence: [0, 0, 0, 0, 0, selectedUnmatched.dvxEntry.quantity],
      recurrenceCountPlusDefect: 0,
      trim: { T10: n, T20: n, T30: n, T40: n, T50: n, T60: n, T70: n, T80: n, T90: n, T100: n, TPQG: n },
      chassis: { C10: n, C20: n, C30: n, C40: n, C45: n, P10: n, P20: n, P30: n, C50: n, C60: n, C70: n, RSub: n, TS: n, C80: n, CPQG: n },
      final: { F10: n, F20: n, F30: n, F40: n, F50: n, F60: n, F70: n, F80: n, F90: n, F100: n, FPQG: n, ResidualTorque: n },
      qControl: { freqControl_1_1: n, visualControl_1_2: n, periodicAudit_1_3: n, humanControl_1_4: n, saeAlert_3_1: n, freqMeasure_3_2: n, manualTool_3_3: n, humanTracking_3_4: n, autoControl_5_1: n, impossibility_5_2: n, saeProhibition_5_3: n },
      qControlDetail: { CVT: n, SHOWER: n, DynamicUB: n, CC4: n },
      controlRating: { MFG: 0, Quality: 0, Plant: 0 },
      guaranteedQuality: { Workstation: n, MFG: n, Plant: n },
      workstationStatus: "NG",
      mfgStatus: "NG",
      plantStatus: "NG",
      mfgAction: formAction,
      defectCode: '',
      defectLocationCode: '',
      resp: formResp,
      target: formTarget,
    };

    onAddToQAMatrix(recalculateStatuses(newEntry));
    onSetAddedIds(new Set(addedIds).add(selectedUnmatched.id));
    setAddDialogOpen(false);
    setSelectedUnmatched(null);
  };

  // Get matched QA entries for the table
  const matchedSNos = useMemo(() => new Set(matched.map(m => m.qaSNo)), [matched]);
  // matchedQAData still used by Dashboard + export button below
  const matchedQAData = useMemo(() => qaData.filter(q => matchedSNos.has(q.sNo)), [qaData, matchedSNos]);

  // Build full display dataset: all 191 concerns, matched ones pinned at top
  // with plant forced to NG and reoccurrence count added for display.
  const displayAllData = useMemo(() => {
    // Matched concerns: add DVX repeat count to recurrence, force plantStatus=NG
    const matchedRows = qaData
      .filter(d => matchedSNos.has(d.sNo))
      .map(entry => {
        const m = matched.find(m => m.qaSNo === entry.sNo);
        const addedCount = m?.repeatCount || 0;
        return {
          ...entry,
          recurrence: entry.recurrence + addedCount,
          plantStatus: "NG" as const,   // reoccurrence detected → plant NG
        };
      })
      .sort((a, b) => {
        const aCount = matched.find(m => m.qaSNo === a.sNo)?.repeatCount || 0;
        const bCount = matched.find(m => m.qaSNo === b.sNo)?.repeatCount || 0;
        return bCount - aCount; // highest repeat count first
      });
    // Remaining concerns (no matched defects)
    const otherRows = qaData.filter(d => !matchedSNos.has(d.sNo));
    return [...matchedRows, ...otherRows];
  }, [qaData, matched, matchedSNos]);

  // Filtered display data
  const sources = useMemo(() => [...new Set(qaData.map(d => d.source))].sort(), [qaData]);
  const designations = useMemo(() => [...new Set(qaData.map(d => d.designation.toUpperCase()))].sort(), [qaData]);

  const filteredDisplayData = useMemo(() => {
    let result = displayAllData;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(d => d.concern.toLowerCase().includes(term) || d.operationStation.toLowerCase().includes(term) || d.sNo.toString().includes(term));
    }
    if (sourceFilter) result = result.filter(d => d.source.toUpperCase() === sourceFilter.toUpperCase());
    if (designationFilter) result = result.filter(d => d.designation.toUpperCase() === designationFilter.toUpperCase());
    if (ratingFilter) result = result.filter(d => d.defectRating === Number(ratingFilter));
    if (statusFilter === "NG") result = result.filter(d => d.workstationStatus === "NG" || d.mfgStatus === "NG" || d.plantStatus === "NG");
    if (statusFilter === "OK") result = result.filter(d => d.workstationStatus === "OK" && d.mfgStatus === "OK" && d.plantStatus === "OK");
    return result;
  }, [displayAllData, searchTerm, sourceFilter, designationFilter, ratingFilter, statusFilter]);

  const hasActiveFilters = sourceFilter || designationFilter || statusFilter || ratingFilter || searchTerm;
  const clearAllFilters = () => { setSearchTerm(""); setSourceFilter(""); setDesignationFilter(""); setStatusFilter(""); setRatingFilter(""); };

  const activeUnmatched = unmatched.filter(u => !addedIds.has(u.id));

  // Unique defects grouping
  const [expandedDefects, setExpandedDefects] = useState<Set<string>>(new Set());
  const [uniqueDefectSearch, setUniqueDefectSearch] = useState("");
  const [showUniqueDefects, setShowUniqueDefects] = useState(false);

  const uniqueDefectGroups = useMemo((): UniqueDefectGroup[] => {
    const map = new Map<string, UniqueDefectGroup>();
    dvxEntries.forEach(entry => {
      const key = `${entry.defectCode}||${entry.defectDescription}||${entry.defectDescriptionDetails}`;
      const existing = map.get(key);
      if (existing) {
        existing.totalQty += entry.quantity;
        existing.entries.push(entry);
      } else {
        map.set(key, {
          key,
          defectCode: entry.defectCode,
          defectDescription: entry.defectDescription,
          defectDescriptionDetails: entry.defectDescriptionDetails,
          gravity: entry.gravity,
          totalQty: entry.quantity,
          entries: [entry],
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
  }, [dvxEntries]);

  const filteredUniqueDefects = useMemo(() => {
    if (!uniqueDefectSearch) return uniqueDefectGroups;
    const term = uniqueDefectSearch.toLowerCase();
    return uniqueDefectGroups.filter(g =>
      g.defectDescription.toLowerCase().includes(term) ||
      g.defectDescriptionDetails.toLowerCase().includes(term) ||
      g.defectCode.toLowerCase().includes(term)
    );
  }, [uniqueDefectGroups, uniqueDefectSearch]);

  const toggleDefectExpand = (key: string) => {
    setExpandedDefects(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const exportUnpaired = () => {
    const rows = activeUnmatched.map(item => ({
      "Defect Code": item.dvxEntry.defectCode,
      "Location Code": item.dvxEntry.locationCode,
      "Location Details": item.dvxEntry.locationDetails,
      "Description": item.dvxEntry.defectDescription,
      "Description Details": item.dvxEntry.defectDescriptionDetails,
      "Gravity": item.dvxEntry.gravity,
      "Quantity": item.dvxEntry.quantity,
      "Source": item.dvxEntry.source,
      "Responsible": item.dvxEntry.responsible,
      "Date": item.dvxEntry.date,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Not Paired");
    XLSX.writeFile(wb, "not-paired-defects.xlsx");
  };

  const exportUniqueDefects = () => {
    const rows = uniqueDefectGroups.flatMap(g =>
      g.entries.map(e => ({
        "Defect Code": e.defectCode,
        "Description": e.defectDescription,
        "Details": e.defectDescriptionDetails,
        "Gravity": e.gravity,
        "Qty": e.quantity,
        "Location": e.locationDetails,
        "Source": e.source,
        "Responsible": e.responsible,
        "Date": e.date,
      }))
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Unique Defects");
    XLSX.writeFile(wb, "unique-defects.xlsx");
  };

  // QA options for manual pairing dropdown - sorted by relevance
  const qaOptions = useMemo(() =>
    qaData.map(q => ({ sNo: q.sNo, label: `#${q.sNo} - ${q.concern.substring(0, 50)} (${q.operationStation})` })),
    [qaData]
  );

  return (
    <div className="space-y-6">
      {/* Date info + Start Pairing */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Play className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-sm font-bold">Defect Pairing</h2>
              <div className="flex items-center gap-4 mt-1">
                {lastDefectUpdate && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Defect data updated: {new Date(lastDefectUpdate).toLocaleString()}
                  </span>
                )}
                {lastPairedDate && (
                  <span className="text-[10px] text-primary flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Last paired: {new Date(lastPairedDate).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => handleStartPairing("code")}
              disabled={pairingLoading || isAIMatching}
            >
              {pairingLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Loading...</>
              ) : (
                <><Play className="w-4 h-4" />Pair with Code</>
              )}
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => handleStartPairing("semantic")}
              disabled={pairingLoading || isAIMatching}
            >
              {pairingLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Loading...</>
              ) : isAIMatching ? (
                <><Loader2 className="w-4 h-4 animate-spin" />AI Matching...</>
              ) : (
                <><Brain className="w-4 h-4" />Pair with AI (Semantic)</>
              )}
            </Button>
            {fileName && (
              <Button size="sm" variant="ghost" onClick={handleClear} className="text-destructive">
                <X className="w-4 h-4 mr-1" /> Clear
              </Button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Use <strong>Pair with Code</strong> to match defects by Defect Code + Location Code, or <strong>Pair with AI</strong> for semantic matching. You can also upload a file manually below.
        </p>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 w-fit mb-4">
          <button
            onClick={() => { setUploadMode("file"); setLinkError(""); }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${uploadMode === "file" ? "bg-card shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Upload File
          </button>
          <button
            onClick={() => { setUploadMode("link"); setLinkError(""); }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${uploadMode === "link" ? "bg-card shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Link2 className="w-3.5 h-3.5" />
            From Link
          </button>
        </div>

        {uploadMode === "file" ? (
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFile}
              className="block flex-1 text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
            />
            {fileName && (
              <span className="text-xs text-muted-foreground">
                {fileName} — {dvxEntries.length} defects parsed
              </span>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Paste a Google Sheets or Excel URL. The sheet must be publicly accessible (sharing set to "Anyone with the link can view").
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
                {linkLoading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Loading...</> : "Fetch"}
              </Button>
            </div>
            {linkError && <p className="text-xs text-destructive">{linkError}</p>}
            {fileName && (
              <p className="text-xs text-muted-foreground font-medium">
                ✓ Loaded: {fileName} — {dvxEntries.length} defects parsed
              </p>
            )}
          </div>
        )}
      </div>

      {isAIMatching && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <div>
            <p className="text-sm font-semibold text-primary">AI Agent Analyzing Defects...</p>
            <p className="text-xs text-muted-foreground">Semantically matching defect descriptions with QA concerns</p>
          </div>
        </div>
      )}

      {dvxEntries.length > 0 && !isAIMatching && (
        <>


          {/* Unique Defects Summary */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <button
              className="w-full px-4 py-3 flex items-center gap-2 hover:bg-muted/30 transition-colors"
              onClick={() => setShowUniqueDefects(v => !v)}
            >
              <ListFilter className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold">Unique Defects</span>
              <span className="ml-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">
                {uniqueDefectGroups.length} unique · {dvxEntries.reduce((s, e) => s + e.quantity, 0)} total qty
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {showUniqueDefects ? "Hide" : "Show"}
              </span>
              {showUniqueDefects ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </button>

            {showUniqueDefects && (
              <div className="border-t border-border">
                <div className="p-3 flex items-center gap-2 bg-muted/20">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search defects..."
                      value={uniqueDefectSearch}
                      onChange={(e) => setUniqueDefectSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={exportUniqueDefects}>
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </Button>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {filteredUniqueDefects.length} of {uniqueDefectGroups.length}
                  </p>
                </div>
                <div className="overflow-auto" style={{ maxHeight: 420 }}>
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 text-left font-bold w-6"></th>
                        <th className="px-3 py-2 text-left font-bold">Defect Code</th>
                        <th className="px-3 py-2 text-left font-bold">Description</th>
                        <th className="px-3 py-2 text-left font-bold">Details</th>
                        <th className="px-3 py-2 text-center font-bold">Gravity</th>
                        <th className="px-3 py-2 text-center font-bold">Occurrences</th>
                        <th className="px-3 py-2 text-center font-bold">Total Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUniqueDefects.map((group) => (
                        <>
                          <tr
                            key={group.key}
                            className="border-t border-border/30 hover:bg-muted/20 cursor-pointer"
                            onClick={() => toggleDefectExpand(group.key)}
                          >
                            <td className="px-3 py-2 text-center">
                              {expandedDefects.has(group.key)
                                ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                            </td>
                            <td className="px-3 py-2 font-mono font-semibold">{group.defectCode || "—"}</td>
                            <td className="px-3 py-2 max-w-[220px] truncate font-medium" title={group.defectDescription}>{group.defectDescription}</td>
                            <td className="px-3 py-2 max-w-[220px] truncate text-muted-foreground" title={group.defectDescriptionDetails}>{group.defectDescriptionDetails}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${group.gravity === "A" ? "bg-destructive/15 text-destructive" :
                                group.gravity === "B" ? "bg-warning/15 text-warning" :
                                  "bg-muted text-muted-foreground"
                                }`}>
                                {group.gravity || "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center font-mono">{group.entries.length}</td>
                            <td className="px-3 py-2 text-center font-mono font-bold text-primary">{group.totalQty}</td>
                          </tr>
                          {expandedDefects.has(group.key) && group.entries.map((entry, idx) => (
                            <tr key={`${group.key}-${idx}`} className="bg-muted/10 border-t border-border/20">
                              <td className="px-3 py-1.5"></td>
                              <td className="px-3 py-1.5 text-muted-foreground font-mono text-[11px]" colSpan={1}></td>
                              <td className="px-3 py-1.5 text-[11px] text-muted-foreground" colSpan={2}>{entry.locationDetails}</td>
                              <td className="px-3 py-1.5 text-center text-[11px] text-muted-foreground">{entry.date}</td>
                              <td className="px-3 py-1.5 text-center text-[11px] text-muted-foreground">{entry.source}</td>
                              <td className="px-3 py-1.5 text-center font-mono text-[11px] font-semibold">{entry.quantity}</td>
                            </tr>
                          ))}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Dashboard View Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setClDashView("classic")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${clDashView === "classic" ? "bg-card shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Activity className="w-3.5 h-3.5" />
                Classic View
              </button>
              <button
                onClick={() => setClDashView("analytics")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${clDashView === "analytics" ? "bg-card shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Analytics View
              </button>
            </div>
          </div>

          {/* Closed Loop Dashboard */}
          {clDashView === "classic" ? (
            <ClosedLoopDashboard
              qaData={qaData}
              matched={matched}
              unmatched={activeUnmatched}
              onOpenPairDialog={openAddDialog}
            />
          ) : (
            <ClosedLoopDashboardV2
              qaData={qaData}
              matched={matched}
              unmatched={activeUnmatched}
              onOpenPairDialog={openAddDialog}
            />
          )}

          {/* Pairing Container - Feature 2 */}
          <PairingContainer
            matched={matched}
            unmatched={activeUnmatched}
            qaData={qaData}
            onUnpair={onUnpair}
            onReassign={onReassign}
            onManualPair={onManualPair}
          />

          {matchedQAData.length > 0 && (
            <>

              {/* Action buttons bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportToXLSX(matchedQAData, "repeat-matched-export.xlsx")}>
                  <FileSpreadsheet className="w-4 h-4" />
                  Export Matched (Excel)
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 ml-auto"
                  variant={isApplied ? "outline" : "default"}
                  onClick={onApplyToMatrix}
                  disabled={isApplied}
                >
                  <ArrowUpCircle className="w-4 h-4" />
                  {isApplied ? "Applied to QA Matrix ✓" : "Apply to QA Matrix"}
                </Button>
              </div>

              {/* Filters */}
              <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Filters</span>
                  {hasActiveFilters && (
                    <button onClick={clearAllFilters} className="ml-auto text-xs text-destructive hover:underline flex items-center gap-1">
                      <X className="w-3 h-3" /> Clear all
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="text" placeholder="Search concerns, stations..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="px-3 py-2 text-sm border border-input rounded-md bg-background">
                    <option value="">All Sources</option>
                    {sources.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={designationFilter} onChange={(e) => setDesignationFilter(e.target.value)} className="px-3 py-2 text-sm border border-input rounded-md bg-background">
                    <option value="">All Areas</option>
                    {designations.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)} className="px-3 py-2 text-sm border border-input rounded-md bg-background">
                    <option value="">All Ratings</option>
                    <option value="1">Rating 1</option>
                    <option value="3">Rating 3</option>
                    <option value="5">Rating 5</option>
                  </select>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 text-sm border border-input rounded-md bg-background">
                    <option value="">All Status</option>
                    <option value="NG">Has NG</option>
                    <option value="OK">All OK</option>
                  </select>
                </div>
                {hasActiveFilters && (
                  <p className="text-xs text-muted-foreground">Showing {filteredDisplayData.length} of {displayAllData.length} concerns ({matchedSNos.size} with reported defects)</p>
                )}
              </div>

              {/* Full QA Matrix Table — matched concerns at top with NG plant */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="section-header">QA Matrix — All Concerns</h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-orange-500/15 text-orange-400">
                    {matchedSNos.size} reoccurred ↑ pinned to top · plant forced NG
                  </span>
                </div>
                <QAMatrixTable
                  data={filteredDisplayData}
                  filter={null}
                  onClearFilter={() => { }}
                  onWeeklyUpdate={onWeeklyUpdate}
                  onScoreUpdate={onScoreUpdate}
                  onFieldUpdate={onFieldUpdate}
                  onDeleteEntry={onDeleteEntry}
                />
              </div>
            </>
          )}

          {/* Unmatched / Not Paired - Feature 5: manual pairing */}
          {activeUnmatched.length > 0 && (
            <div className="bg-card border border-warning/30 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-warning/5 border-b border-warning/20 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <h3 className="text-sm font-bold">Not Paired Concerns</h3>
                <span className="text-xs text-muted-foreground ml-2">{activeUnmatched.length} defects not matched</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto gap-1.5 text-xs h-7 border-warning/40 hover:border-warning/70"
                  onClick={exportUnpaired}
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </Button>
              </div>
              <div className="overflow-auto" style={{ maxHeight: 400 }}>
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold">Location</th>
                      <th className="px-3 py-2 text-left font-bold">Defect Code</th>
                      <th className="px-3 py-2 text-left font-bold">Description</th>
                      <th className="px-3 py-2 text-left font-bold">Details</th>
                      <th className="px-3 py-2 text-center font-bold">Gravity</th>
                      <th className="px-3 py-2 text-center font-bold">Qty</th>
                      <th className="px-3 py-2 text-left font-bold">Source</th>
                      <th className="px-3 py-2 text-center font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeUnmatched.map((item) => (
                      <tr key={item.id} className="border-t border-border/30 hover:bg-muted/20">
                        <td className="px-3 py-2 max-w-[150px] truncate" title={item.dvxEntry.locationDetails}>{item.dvxEntry.locationDetails}</td>
                        <td className="px-3 py-2 font-mono">{item.dvxEntry.defectCode}</td>
                        <td className="px-3 py-2 max-w-[180px] truncate" title={item.dvxEntry.defectDescription}>{item.dvxEntry.defectDescription}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate" title={item.dvxEntry.defectDescriptionDetails}>{item.dvxEntry.defectDescriptionDetails}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${item.dvxEntry.gravity === "A" ? "bg-destructive/15 text-destructive" :
                            item.dvxEntry.gravity === "B" ? "bg-warning/15 text-warning" :
                              "bg-muted text-muted-foreground"
                            }`}>
                            {item.dvxEntry.gravity || "-"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center font-mono">{item.dvxEntry.quantity}</td>
                        <td className="px-3 py-2">{item.dvxEntry.source}</td>
                        <td className="px-3 py-2 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] gap-1 px-2"
                            onClick={() => openAddDialog(item)}
                          >
                            <Link2 className="w-3 h-3" />
                            Pair / Add
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {dvxEntries.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Upload className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Upload a repeat issues report to match defects against QA Matrix concerns</p>
          <p className="text-xs mt-1">Supports CSV, XLSX, and XLS files</p>
        </div>
      )}

      {/* Pair / Add Dialog - Feature 5 */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pair or Add Concern</DialogTitle>
          </DialogHeader>

          {selectedUnmatched && (
            <div className="bg-warning/5 border border-warning/20 rounded-lg p-3 text-xs space-y-1 mb-2">
              <p className="font-bold text-warning text-sm">Defect to be paired:</p>
              <p><span className="text-muted-foreground">Location:</span> {selectedUnmatched.dvxEntry.locationDetails}</p>
              <p><span className="text-muted-foreground">Code:</span> {selectedUnmatched.dvxEntry.defectCode}</p>
              <p><span className="text-muted-foreground">Description:</span> {selectedUnmatched.dvxEntry.defectDescription}</p>
              <p><span className="text-muted-foreground">Details:</span> {selectedUnmatched.dvxEntry.defectDescriptionDetails}</p>
              <p><span className="text-muted-foreground">Gravity:</span> {selectedUnmatched.dvxEntry.gravity} | <span className="text-muted-foreground">Qty:</span> {selectedUnmatched.dvxEntry.quantity}</p>
            </div>
          )}

          {/* Toggle: pair to existing or create new */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 mb-3">
            <button
              type="button"
              onClick={() => setPairMode("existing")}
              className={`flex-1 px-4 py-2 text-xs font-semibold rounded-md transition-all ${pairMode === "existing" ? "bg-card shadow text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Pair to Existing Concern
            </button>
            <button
              type="button"
              onClick={() => setPairMode("new")}
              className={`flex-1 px-4 py-2 text-xs font-semibold rounded-md transition-all ${pairMode === "new" ? "bg-card shadow text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Create New Concern
            </button>
          </div>

          {pairMode === "existing" ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Select QA Matrix Concern</Label>
                <select
                  value={selectedPairSNo}
                  onChange={(e) => setSelectedPairSNo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background"
                >
                  <option value="">-- Select a concern --</option>
                  {qaOptions.map(o => (
                    <option key={o.sNo} value={o.sNo}>{o.label}</option>
                  ))}
                </select>
              </div>
              {selectedPairSNo && (
                <div className="bg-primary/5 border border-primary/20 rounded p-3 text-xs">
                  {(() => {
                    const qa = qaData.find(q => q.sNo === Number(selectedPairSNo));
                    if (!qa) return null;
                    return (
                      <>
                        <p className="font-bold text-primary">Will pair to:</p>
                        <p>#{qa.sNo} — {qa.concern}</p>
                        <p className="text-muted-foreground">{qa.source} · {qa.operationStation} · {qa.designation}</p>
                      </>
                    );
                  })()}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handlePairExisting} disabled={!selectedPairSNo}>
                  <Link2 className="w-4 h-4 mr-1" /> Pair Defect
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="r-source">Source *</Label>
                  <Input id="r-source" value={formSource} onChange={(e) => setFormSource(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-station">Station *</Label>
                  <Input id="r-station" value={formStation} onChange={(e) => setFormStation(e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="r-area">Area</Label>
                  <select id="r-area" value={formDesignation} onChange={(e) => setFormDesignation(e.target.value)} className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background">
                    <option value="Trim">Trim</option>
                    <option value="Chassis">Chassis</option>
                    <option value="Final">Final</option>
                    <option value="TRIM">TRIM</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-rating">Defect Rating *</Label>
                  <select id="r-rating" value={formRating} onChange={(e) => setFormRating(Number(e.target.value) as 1 | 3 | 5)} className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background">
                    <option value={1}>1 - Low</option>
                    <option value={3}>3 - Medium</option>
                    <option value={5}>5 - High</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-concern">Concern Description *</Label>
                <Input id="r-concern" value={formConcern} onChange={(e) => setFormConcern(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-action">MFG Action</Label>
                <Input id="r-action" value={formAction} onChange={(e) => setFormAction(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="r-resp">Responsible</Label>
                  <Input id="r-resp" value={formResp} onChange={(e) => setFormResp(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-target">Target</Label>
                  <Input id="r-target" value={formTarget} onChange={(e) => setFormTarget(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                <Button type="submit">
                  <Plus className="w-4 h-4 mr-1" /> Add Concern
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RepeatsTab;
