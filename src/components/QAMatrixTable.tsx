import { QAMatrixEntry } from "@/types/qaMatrix";
import StatusBadge from "./StatusBadge";
import { ChevronDown, ChevronUp, X, Trash2, Pencil, Check, Factory, Layers } from "lucide-react";
import React, { useState, useRef, useLayoutEffect } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

interface QAMatrixTableProps {
  data: QAMatrixEntry[];
  filter: { rating?: 1 | 3 | 5; level?: string; status?: "OK" | "NG" } | null;
  onClearFilter: () => void;
  onWeeklyUpdate: (sNo: number, weekIndex: number, value: number) => void;
  onScoreUpdate?: (sNo: number, section: "trim" | "chassis" | "final" | "qControl" | "qControlDetail", key: string, value: number | null) => void;
  onFieldUpdate?: (sNo: number, field: string, value: string) => void;
  onDeleteEntry?: (sNo: number) => void;
  onRatingUpdate?: (sNo: number, section: "controlRating" | "recordedDefect" | "guaranteedQuality", key: string, value: any) => void;
  readOnly?: boolean;
}

const weekLabels = ["W-6", "W-5", "W-4", "W-3", "W-2", "W-1"];
const trimKeys = ["T10", "T20", "T30", "T40", "T50", "T60", "T70", "T80", "T90", "T100", "TPQG"] as const;
const chassisKeys = ["C10", "C20", "C30", "C40", "C45", "C50", "C60", "C70", "C80", "P10", "P20", "P30", "R10", "PRESS", "PQG"] as const;
const finalKeysDisplay = ["F10", "F20", "F30", "F40", "F50", "F60", "F70", "F80", "F90", "F100", "F110", "FPQG"] as const;

const outsideProcessKeys = [
  { key: "TLAudit" as const, label: "Team Leader Audit", section: "final" },
  { key: "TorqueAudit" as const, label: "Torque Audit", section: "final" },
  { key: "Static" as const, label: "Static", section: "outside" },
  { key: "WheelAlignment" as const, label: "Wheel Alignment", section: "outside" },
  { key: "HLAssembly" as const, label: "HL Aiming/ ABS", section: "outside" },
  { key: "DMCCABS" as const, label: "Dynamic/ UB", section: "outside" },
  { key: "CC4" as const, label: "CC4", section: "outside" },
  { key: "CertLine" as const, label: "Cert Line", section: "outside" },
];

const detectionKeys = [
  { key: "dvmPQG" as const, label: "DVM/PQG (Y/N)" },
  { key: "dvrDVT" as const, label: "DVR/DVT (Y/N)" },
  { key: "productAuditSCA" as const, label: "Product Audit SCA (Y/N)" },
  { key: "warranty" as const, label: "WARRANTY" },
];


const ScoreInput = ({ value, onChange, defectRating, type, readOnly }: { value: number | null; onChange: (v: number | null) => void; defectRating: number; type: 'trim' | 'chassis' | 'final' | 'outside' | 'impl'; readOnly?: boolean }) => (
  <input
    type="number"
    min={0}
    max={99}
    value={value ?? ""}
    readOnly={readOnly}
    onChange={(e) => {
      if (readOnly) return;
      const raw = e.target.value;
      onChange(raw === "" ? null : Math.max(0, parseInt(raw) || 0));
    }}
    onClick={(e) => e.stopPropagation()}
    className={`w-full h-full text-center font-bold text-[9px] border-0 focus:ring-0 outline-none data-row hit-${type} ${value !== null && value >= defectRating ? "text-primary bg-primary/10" : "bg-transparent"} ${readOnly ? "cursor-default pointer-events-none" : ""}`}
    style={{ minWidth: 28, padding: '2px 0' }}
  />
);

const makeYNCell = (val: string | undefined) => {
  if (!val) return <td className="data-row"></td>;
  return (
    <td className="data-row" style={{ color: val === 'Y' ? '#1B5E20' : '#B71C1C', fontWeight: 'bold', fontSize: '10px' }}>
      {val}
    </td>
  );
};

const makeERBadge = (source: string) => {
  if (!source) return null;
  const isER4 = source.toUpperCase().includes("ER4") || source.toUpperCase() === "ER4";
  const cls = isER4 ? 'er-badge-er4' : 'er-badge-er3';
  return <span className={`er-badge ${cls}`}>{source}</span>;
};


const QAMatrixTable = ({ data, filter, onClearFilter, onWeeklyUpdate, onScoreUpdate, onFieldUpdate, onDeleteEntry, onRatingUpdate, readOnly }: QAMatrixTableProps) => {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const tableRef = useRef<HTMLTableElement>(null);

  const filteredData = filter
    ? data.filter((d) => {
      if (!filter.rating) return true;
      if (d.defectRating !== filter.rating) return false;
      if (filter.status) {
        if (filter.level === "Workstation") return d.workstationStatus === filter.status;
        if (filter.level === "MFG") return d.mfgStatus === filter.status;
        if (filter.level === "Plant") return d.plantStatus === filter.status;
      }
      return true;
    })
    : data;

  // Dynamically calculate sticky column left offsets and header row top offsets
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const recalc = () => {
      // Find a regular data row (not expanded) to measure column widths
      const rows = table.querySelectorAll('tbody > tr');
      let measureRow: Element | null = null;
      for (const row of Array.from(rows)) {
        if (row.querySelector('.sqam-sticky-col-0')) {
          measureRow = row;
          break;
        }
      }
      if (!measureRow) return;

      // Calculate cumulative left offsets for sticky columns 0-12
      const cells = Array.from(measureRow.children) as HTMLElement[];
      const leftMap = new Map<number, number>();
      let cumLeft = 0;

      for (const cell of cells) {
        const cls = Array.from(cell.classList).find(c => /^sqam-sticky-col-\d+$/.test(c));
        if (cls) {
          const idx = parseInt(cls.replace('sqam-sticky-col-', ''));
          leftMap.set(idx, cumLeft);
          cumLeft += cell.getBoundingClientRect().width;
        } else if (leftMap.size > 0) {
          break; // No more sticky columns in this row
        }
      }

      // Apply calculated left offsets to ALL matching sticky elements across the table
      leftMap.forEach((left, idx) => {
        table.querySelectorAll(`.sqam-sticky-col-${idx}`).forEach(el => {
          const htmlEl = el as HTMLElement;
          htmlEl.style.left = `${Math.round(left)}px`;
          // Ensure intersection cells have highest z-index
          if (htmlEl.tagName === 'TH') {
            htmlEl.style.zIndex = '100';
          }
        });
      });

      // Dynamically calculate header row top offsets - apply to TH instead of TR
      const headerRows = Array.from(table.querySelectorAll('thead > tr')) as HTMLElement[];
      let cumTop = 0;
      headerRows.forEach(row => {
        const rowHeight = row.getBoundingClientRect().height;
        Array.from(row.children).forEach(cell => {
          const htmlCell = cell as HTMLElement;
          htmlCell.style.position = 'sticky';
          htmlCell.style.top = `${Math.round(cumTop)}px`;
          // If not a sticky col, set standard header z-index
          if (!Array.from(htmlCell.classList).some(c => c.startsWith('sqam-sticky-col-'))) {
            htmlCell.style.zIndex = '40';
          }
        });
        cumTop += rowHeight;
      });
    };

    // Run initial calculation
    recalc();

    // Recalculate on window resize
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [filteredData, expandedRow]);

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {filter && (
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-lg">
            <span className="text-sm text-primary">
              Showing Rating {filter.rating} — {filter.level} {filter.status ?? "All"} items ({filteredData.length} results)
            </span>
            <button onClick={onClearFilter} className="ml-auto p-1 hover:bg-primary/20 rounded">
              <X className="w-4 h-4 text-primary" />
            </button>
          </div>
        )}

        <div className="table-wrapper hidden md:block">
          <table ref={tableRef} id="sqamTable" className="sqam-body">
            <thead>
              {/* Row 1: Top level sections */}
              <tr>
                <th rowSpan={3} className="hdr-label sqam-sticky-col sqam-sticky-col-0" style={{ minWidth: 30 }}>S.no</th>
                <th rowSpan={3} className="hdr-label sqam-sticky-col sqam-sticky-col-1" style={{ minWidth: 80 }}>Detection Date</th>
                <th rowSpan={3} className="hdr-label sqam-sticky-col sqam-sticky-col-2" style={{ minWidth: 36 }}>ER</th>
                <th rowSpan={3} className="hdr-label sqam-sticky-col sqam-sticky-col-3" style={{ minWidth: 42 }}>Station No.</th>
                <th rowSpan={3} className="hdr-label sqam-sticky-col sqam-sticky-col-4" style={{ minWidth: 55 }}>Zone/Team</th>
                <th rowSpan={3} className="hdr-label sqam-sticky-col sqam-sticky-col-5" style={{ minWidth: 55 }}>Team Leader</th>
                <th rowSpan={3} className="hdr-label sqam-sticky-col sqam-sticky-col-6" style={{ minWidth: 150, textAlign: 'left' }}>Failure Mode</th>
                <th rowSpan={3} className="hdr-label sqam-sticky-col sqam-sticky-col-7" style={{ minWidth: 32 }}>Repair Time</th>

                {/* Detection date +24H */}
                <th colSpan={6} className="hdr-main-24h sqam-sticky-col sqam-sticky-col-8">

                  Detection date + 24H<br />
                  <small>Quality Plant ENG'g — Customer Protection Engineer [Dhakshna]</small>
                </th>

                {/* Detection date +48H */}
                <th colSpan={38} className="hdr-main-48h">
                  Detection date + 48H<br />
                  <small>MFG SUPERVISOR [David]</small>
                </th>

                {/* Outside Process Area */}
                <th colSpan={8} className="hdr-outside">Outside Process Area</th>

                {/* Last Check Implementation */}
                <th colSpan={2} className="hdr-impl">Last Check Implementation</th>

                {/* New sections from screenshot */}
                <th colSpan={4} className="hdr-label" style={{ background: '#92D050', color: 'black' }}>Control Rating</th>
                <th colSpan={4} className="hdr-label" style={{ background: '#92D050', color: 'black' }}>Recorded Defect</th>
                <th colSpan={4} className="hdr-label" style={{ background: '#92D050', color: 'black' }}>Guaranteed level of quality</th>

                <th rowSpan={3} className="hdr-label" style={{ minWidth: 60 }}>Actions</th>
              </tr>

              {/* Row 2: Sub-sections */}
              <tr>
                {/* Detection cols */}
                <th rowSpan={2} className="hdr-detection sqam-sticky-col sqam-sticky-col-8">DVM/PQG<br />(Y/N)</th>
                <th rowSpan={2} className="hdr-detection sqam-sticky-col sqam-sticky-col-9">DVR/DVT<br />(Y/N)</th>
                <th rowSpan={2} className="hdr-detection sqam-sticky-col sqam-sticky-col-10">Product Audit SCA (Y/N)</th>
                <th rowSpan={2} className="hdr-detection sqam-sticky-col sqam-sticky-col-11">WARRANTY</th>
                <th rowSpan={2} className="hdr-def sqam-sticky-col sqam-sticky-col-12" style={{ background: '#FF0000', color: 'white' }}>Defect<br />Rating<br />(1/3/5)</th>
                <th rowSpan={2} className="hdr-label sqam-sticky-col sqam-sticky-col-13">Reoccurrence<br />Broken<br />Clean Point</th>

                {/* Station Area Headers */}
                <th colSpan={11} className="hdr-trim focus:ring-0">TRIM</th>
                <th colSpan={15} className="hdr-chassis">CHASSIS</th>
                <th colSpan={12} className="hdr-final">FINAL</th>

                {/* Outside cols */}
                {outsideProcessKeys.map(k => (
                  <th key={k.key} rowSpan={2} className="hdr-outside">{k.label}</th>
                ))}

                {/* Impl cols */}
                <th rowSpan={2} className="hdr-impl">Impl. Date</th>
                <th rowSpan={2} className="hdr-impl">Audit Date & Name</th>

                {/* Control Rating sub-headers */}
                <th className="hdr-label" style={{ background: '#E2EFDA', color: 'black', fontSize: '8px', writingMode: 'vertical-rl' }}>Workstation</th>
                <th className="hdr-label" style={{ background: '#E2EFDA', color: 'black', fontSize: '8px', writingMode: 'vertical-rl' }}>Zone (Supervisor)</th>
                <th className="hdr-label" style={{ background: '#E2EFDA', color: 'black', fontSize: '8px', writingMode: 'vertical-rl' }}>Shop (GA, paintshop ...)</th>
                <th className="hdr-label" style={{ background: '#E2EFDA', color: 'black', fontSize: '8px', writingMode: 'vertical-rl' }}>Plant</th>

                {/* Recorded Defect sub-headers */}
                <th className="hdr-label" style={{ background: '#E2EFDA', color: 'black', fontSize: '8px', writingMode: 'vertical-rl' }}>Escaping Workstation <br /> 1M</th>
                <th className="hdr-label" style={{ background: '#E2EFDA', color: 'black', fontSize: '8px', writingMode: 'vertical-rl' }}>Escaping Zone <br /> 3M</th>
                <th className="hdr-label" style={{ background: '#E2EFDA', color: 'black', fontSize: '8px', writingMode: 'vertical-rl' }}>Escaping Shop <br /> 3M</th>
                <th className="hdr-label" style={{ background: '#D9D9D9', color: 'black', fontSize: '8px', writingMode: 'vertical-rl' }}>CUSTOMER <br /> 6M</th>

                {/* Guaranteed Quality sub-headers */}
                <th className="hdr-label" style={{ background: '#E2EFDA', color: 'black', fontSize: '8px', writingMode: 'vertical-rl' }}>Workstation</th>
                <th className="hdr-label" style={{ background: '#E2EFDA', color: 'black', fontSize: '8px', writingMode: 'vertical-rl' }}>Zone (Neighbor Check, PQG...)</th>
                <th className="hdr-label" style={{ background: '#E2EFDA', color: 'black', fontSize: '8px', writingMode: 'vertical-rl' }}>Shop (GA, paintshop ...)</th>
                <th className="hdr-label" style={{ background: '#E2EFDA', color: 'black', fontSize: '8px', writingMode: 'vertical-rl' }}>Plant</th>
              </tr>

              {/* Row 3: Station labels */}
              <tr>
                {trimKeys.map(k => <th key={k} className="sub-trim">{k}</th>)}
                {chassisKeys.map(k => <th key={k} className="sub-chassis">{k}</th>)}
                {finalKeysDisplay.map(k => <th key={k} className="sub-final">{k}</th>)}
              </tr>
            </thead>

            <tbody>
              {filteredData.map((entry) => (
                <React.Fragment key={entry.sNo}>
                  <tr
                    className={`border-t border-border hover:bg-muted/30 transition-colors cursor-pointer ${entry.recurrence > 0 ? 'bg-amber-500/5 hover:bg-amber-500/10' : ''
                      }`}
                    onClick={() => setExpandedRow(expandedRow === entry.sNo ? null : entry.sNo)}
                  >
                    <td className="data-row sqam-sticky-col sqam-sticky-col-0" style={{ fontWeight: 'bold' }}>{entry.sNo}</td>
                    <td className="data-row text-center font-mono text-[10px] sqam-sticky-col sqam-sticky-col-1">{entry.detectionDate || "—"}</td>
                    <td className="data-row col-er sqam-sticky-col sqam-sticky-col-2">{makeERBadge(entry.source)}</td>
                    <td className="data-row col-stn sqam-sticky-col sqam-sticky-col-3">{entry.operationStation}</td>
                    <td className="data-row col-zone sqam-sticky-col sqam-sticky-col-4" style={{ color: entry.designation.toLowerCase().includes('trim') ? '#1F4E79' : entry.designation.toLowerCase().includes('chassis') ? '#375623' : entry.designation.toLowerCase().includes('final') ? '#7F3F00' : 'inherit', fontWeight: 'bold' }}>{entry.designation}</td>
                    <td className="data-row col-tl sqam-sticky-col sqam-sticky-col-5">{entry.teamLeader ?? entry.resp}</td>
                    <td className="data-row col-fm sqam-sticky-col sqam-sticky-col-6" title={entry.concern}>{entry.concern}</td>
                    <td className="data-row col-rt sqam-sticky-col sqam-sticky-col-7">{entry.detectionFlags?.repairTime ?? ""}</td>

                    <td className="data-row sqam-sticky-col sqam-sticky-col-8" style={{ color: entry.detectionFlags?.dvmPQG === 'Y' ? '#1B5E20' : '#B71C1C', fontWeight: 'bold' }}>{entry.detectionFlags?.dvmPQG ?? ""}</td>
                    <td className="data-row sqam-sticky-col sqam-sticky-col-9" style={{ color: entry.detectionFlags?.dvrDVT === 'Y' ? '#1B5E20' : '#B71C1C', fontWeight: 'bold' }}>{entry.detectionFlags?.dvrDVT ?? ""}</td>
                    <td className="data-row sqam-sticky-col sqam-sticky-col-10" style={{ color: entry.detectionFlags?.productAuditSCA === 'Y' ? '#1B5E20' : '#B71C1C', fontWeight: 'bold' }}>{entry.detectionFlags?.productAuditSCA ?? ""}</td>
                    <td className="data-row sqam-sticky-col sqam-sticky-col-11">{entry.detectionFlags?.warranty ?? ""}</td>
                    <td className={`data-row sqam-sticky-col sqam-sticky-col-12 ${entry.defectRating === 1 ? 'def-1' : entry.defectRating === 3 ? 'def-3' : 'def-5'}`}>{entry.defectRating}</td>
                    <td className="data-row col-reoc sqam-sticky-col sqam-sticky-col-13">{entry.detectionFlags?.reoccurrence ?? ""}</td>


                    {trimKeys.map(k => (
                      <td key={k} className="p-0 border-l border-border">
                        <ScoreInput readOnly={readOnly} type="trim" value={entry.trim[k]} defectRating={entry.defectRating} onChange={(v) => onScoreUpdate?.(entry.sNo, "trim", k, v)} />
                      </td>
                    ))}
                    {chassisKeys.map(k => (
                      <td key={k} className="p-0 border-l border-border">
                        <ScoreInput readOnly={readOnly} type="chassis" value={entry.chassis[k]} defectRating={entry.defectRating} onChange={(v) => onScoreUpdate?.(entry.sNo, "chassis", k, v)} />
                      </td>
                    ))}
                    {finalKeysDisplay.map(k => (
                      <td key={k} className="p-0 border-l border-border">
                        <ScoreInput readOnly={readOnly} type="final" value={entry.final[k]} defectRating={entry.defectRating} onChange={(v) => onScoreUpdate?.(entry.sNo, "final", k, v)} />
                      </td>
                    ))}
                    {outsideProcessKeys.map(k => (
                      <td key={k.key} className="p-0 border-l border-border">
                        <ScoreInput
                          readOnly={readOnly}
                          type="outside"
                          value={k.section === "final" ? entry.final[k.key as keyof typeof entry.final] : entry.outsideProcess?.[k.key as keyof typeof entry.outsideProcess] ?? null}
                          defectRating={entry.defectRating}
                          onChange={(v) => k.section === "final" ? onScoreUpdate?.(entry.sNo, "final", k.key, v) : onScoreUpdate?.(entry.sNo, "outsideProcess" as any, k.key, v)}
                        />
                      </td>
                    ))}
                    <td className="data-row col-impl">{entry.implementationDate ?? ""}</td>
                    <td className="data-row col-impl">{entry.auditDateName ?? ""}</td>

                    {/* Control Rating Data — Editable */}
                    {(["Workstation", "Zone", "Shop", "Plant"] as const).map(k => (
                      <td key={`cr-${k}`} className="data-row val-ctrl p-0" onClick={e => e.stopPropagation()}>
                        <input
                          type="number" min={0} max={999}
                          value={entry.controlRating?.[k] ?? ""}
                          readOnly={readOnly}
                          onChange={e => !readOnly && onRatingUpdate?.(entry.sNo, "controlRating", k, e.target.value === "" ? null : parseInt(e.target.value) || 0)}
                          className={`w-full h-full text-center font-semibold text-[9px] border-0 focus:ring-1 focus:ring-green-400 outline-none bg-transparent ${readOnly ? "cursor-default pointer-events-none" : ""}`}
                          style={{ minWidth: 32, padding: '2px 0' }}
                        />
                      </td>
                    ))}

                    {/* Recorded Defect Data — Editable */}
                    {(["workstation", "zone", "shop", "customer"] as const).map(k => (
                      <td key={`rd-${k}`} className="data-row val-rd p-0" onClick={e => e.stopPropagation()}>
                        <input
                          type="number" min={0} max={999}
                          value={entry.recordedDefect?.[k] ?? ""}
                          readOnly={readOnly}
                          onChange={e => !readOnly && onRatingUpdate?.(entry.sNo, "recordedDefect", k, e.target.value === "" ? null : parseInt(e.target.value) || 0)}
                          className={`w-full h-full text-center font-semibold text-[9px] border-0 focus:ring-1 focus:ring-yellow-400 outline-none bg-transparent ${readOnly ? "cursor-default pointer-events-none" : ""}`}
                          style={{ minWidth: 32, padding: '2px 0' }}
                        />
                      </td>
                    ))}

                    {/* Guaranteed Quality Data — Editable OK/NG */}
                    {(["Workstation", "Zone", "Shop", "Plant"] as const).map(k => (
                      <td key={`gq-${k}`} className="data-row val-gq p-0" onClick={e => e.stopPropagation()}>
                        <select
                          value={entry.guaranteedQuality?.[k] ?? "OK"}
                          disabled={readOnly}
                          onChange={e => !readOnly && onRatingUpdate?.(entry.sNo, "guaranteedQuality", k, e.target.value)}
                          className={`w-full h-full text-center font-bold text-[9px] border-0 focus:ring-1 outline-none cursor-pointer ${entry.guaranteedQuality?.[k] === "NG" ? "bg-red-500 text-white" : "bg-green-600 text-white"} ${readOnly ? "cursor-default pointer-events-none appearance-none" : ""}`}
                          style={{ minWidth: 32, padding: '2px 0' }}
                        >
                          <option value="OK">OK</option>
                          <option value="NG">NG</option>
                        </select>
                      </td>
                    ))}

                    <td className="data-row" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5 justify-center">
                        {!readOnly && (
                          <>
                            {editingRow === entry.sNo ? (
                              <button onClick={() => { Object.entries(editFields).forEach(([field, value]) => { onFieldUpdate?.(entry.sNo, field, value); }); setEditingRow(null); setEditFields({}); }} className="p-1 rounded hover:bg-primary/10 text-primary" title="Save"><Check className="w-3.5 h-3.5" /></button>
                            ) : (
                              <button onClick={() => { setEditingRow(entry.sNo); setEditFields({ source: entry.source, operationStation: entry.operationStation, designation: entry.designation, teamLeader: entry.teamLeader ?? entry.resp, concern: entry.concern, defectCode: entry.defectCode, defectLocationCode: entry.defectLocationCode, mfgAction: entry.mfgAction, resp: entry.resp, target: entry.target }); }} className="p-1 rounded hover:bg-primary/10 text-muted-foreground" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                            )}
                            <button onClick={() => { if (confirm(`Delete concern #${entry.sNo}?`)) { onDeleteEntry?.(entry.sNo); } }} className="p-1 rounded hover:bg-destructive/10 text-destructive" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                        <button onClick={() => setExpandedRow(expandedRow === entry.sNo ? null : entry.sNo)} className="p-1 rounded hover:bg-muted">
                          {expandedRow === entry.sNo ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {expandedRow === entry.sNo && (
                    <tr key={`exp-${entry.sNo}`} className="bg-muted/20">
                      <td colSpan={100} className="px-4 py-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                          <div className="space-y-2">
                            <p className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">Concern Details</p>
                            {editingRow === entry.sNo ? (
                              <>
                                <div className="space-y-1">
                                  <label className="text-[10px] text-muted-foreground">Concern</label>
                                  <input value={editFields.concern ?? ""} onChange={(e) => setEditFields(f => ({ ...f, concern: e.target.value }))} className="w-full px-2 py-1 text-xs border border-input rounded bg-background" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground">Source</label>
                                    <input value={editFields.source ?? ""} onChange={(e) => setEditFields(f => ({ ...f, source: e.target.value }))} className="w-full px-2 py-1 text-xs border border-input rounded bg-background" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground">Station</label>
                                    <input value={editFields.operationStation ?? ""} onChange={(e) => setEditFields(f => ({ ...f, operationStation: e.target.value }))} className="w-full px-2 py-1 text-xs border border-input rounded bg-background" />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground">Team Leader</label>
                                    <input value={editFields.teamLeader ?? ""} onChange={(e) => setEditFields(f => ({ ...f, teamLeader: e.target.value }))} className="w-full px-2 py-1 text-xs border border-input rounded bg-background" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground">Defect Code</label>
                                    <input value={editFields.defectCode ?? ""} onChange={(e) => setEditFields(f => ({ ...f, defectCode: e.target.value }))} className="w-full px-2 py-1 text-xs border border-input rounded bg-background" />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground">Location Code</label>
                                    <input value={editFields.defectLocationCode ?? ""} onChange={(e) => setEditFields(f => ({ ...f, defectLocationCode: e.target.value }))} className="w-full px-2 py-1 text-xs border border-input rounded bg-background" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground">MFG Action</label>
                                    <input value={editFields.mfgAction ?? ""} onChange={(e) => setEditFields(f => ({ ...f, mfgAction: e.target.value }))} className="w-full px-2 py-1 text-xs border border-input rounded bg-background" />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="text-foreground">{entry.concern}</p>
                                <p className="mt-2"><span className="text-muted-foreground">Station:</span> {entry.operationStation} — {entry.designation}</p>
                                <p><span className="text-muted-foreground">Source:</span> {entry.source}</p>
                                <p><span className="text-muted-foreground">Defect Code:</span> {entry.defectCode || "—"} <span className="ml-3 text-muted-foreground">Location Code:</span> {entry.defectLocationCode || "—"}</p>
                              </>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">Weekly Recurrence</p>
                            <div className="flex gap-1">
                              {weekLabels.map((w, i) => (
                                <div key={w} className={`px-2 py-1 rounded text-center ${entry.weeklyRecurrence[i] > 0 ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
                                  <p className="text-[9px]">{w}</p>
                                  <p className="font-mono font-bold">{entry.weeklyRecurrence[i]}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">Action & Responsibility</p>
                            {editingRow === entry.sNo ? (
                              <>
                                <div className="space-y-1">
                                  <label className="text-[10px] text-muted-foreground">MFG Action</label>
                                  <input value={editFields.mfgAction ?? ""} onChange={(e) => setEditFields(f => ({ ...f, mfgAction: e.target.value }))} className="w-full px-2 py-1 text-xs border border-input rounded bg-background" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground">Responsible</label>
                                    <input value={editFields.resp ?? ""} onChange={(e) => setEditFields(f => ({ ...f, resp: e.target.value }))} className="w-full px-2 py-1 text-xs border border-input rounded bg-background" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground">Target</label>
                                    <input value={editFields.target ?? ""} onChange={(e) => setEditFields(f => ({ ...f, target: e.target.value }))} className="w-full px-2 py-1 text-xs border border-input rounded bg-background" />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="text-foreground">{entry.mfgAction || "—"}</p>
                                <p className="mt-2"><span className="text-muted-foreground">Resp:</span> {entry.resp}</p>
                                <p><span className="text-muted-foreground">Target:</span> {entry.target || "—"}</p>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Cards */}
        <div className="md:hidden space-y-4">
          {filteredData.map((entry) => (
            <div key={entry.sNo} className={`mobile-card ${entry.recurrence > 0 ? 'bg-amber-500/5 ring-1 ring-amber-500/20' : ''}`}>
              <div className="mobile-card-header">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black bg-slate-100 px-2 py-0.5 rounded">#{entry.sNo}</span>
                  {makeERBadge(entry.source)}
                </div>
                <div className={`text-[10px] px-2 py-0.5 rounded font-black ${entry.defectRating === 1 ? 'bg-green-100 text-green-700' : entry.defectRating === 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                  RATING {entry.defectRating}
                </div>
              </div>

              <div className="mobile-card-section">
                <h4 className="text-sm font-bold leading-tight">{entry.concern}</h4>
                <div className="flex flex-wrap gap-2 text-[11px] mt-1 text-muted-foreground">
                  <span className="flex items-center gap-1 font-semibold text-primary">
                    <Factory className="w-3 h-3" />
                    {entry.operationStation}
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    {entry.designation}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                <div className="mobile-card-section">
                  <p className="mobile-card-label">Guaranteed Quality</p>
                  <div className="flex gap-1 mt-1">
                    {(['Workstation', 'Zone', 'Shop', 'Plant'] as const).map(k => (
                      <div key={k} className={`w-6 h-6 rounded flex items-center justify-center text-[8px] font-black text-white ${entry.guaranteedQuality[k] === 'OK' ? 'bg-green-600' : 'bg-red-500'}`}>
                        {k[0]}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mobile-card-section text-right">
                  <p className="mobile-card-label">Weekly Repeats</p>
                  <div className="flex justify-end gap-1 mt-1">
                    {entry.weeklyRecurrence.slice(-3).map((w, i) => (
                      <div key={i} className={`w-6 h-6 rounded flex flex-col items-center justify-center text-[8px] ${w > 0 ? 'bg-red-100 text-red-600 font-bold' : 'bg-slate-50 text-slate-400'}`}>
                        <span>{weekLabels[i + 3]}</span>
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex gap-1">
                  {entry.detectionFlags?.reoccurrence ? (
                    <div className="flex items-center gap-1 text-[10px] text-amber-600 font-bold">
                      <Check className="w-3 h-3" />
                      Reoccurrence Updated
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {!readOnly && (
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingRow(entry.sNo)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" onClick={() => setExpandedRow(expandedRow === entry.sNo ? null : entry.sNo)}>
                    {expandedRow === entry.sNo ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>

              {expandedRow === entry.sNo && (
                <div className="bg-muted/30 -mx-4 -mb-4 p-4 mt-2 rounded-b-xl space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="mobile-card-label">Team Leader</p>
                      <p className="font-medium">{entry.teamLeader || entry.resp || "—"}</p>
                    </div>
                    <div>
                      <p className="mobile-card-label">Source</p>
                      <p className="font-medium">{entry.source}</p>
                    </div>
                  </div>
                  <div>
                    <p className="mobile-card-label">MFG Action</p>
                    <p className="mt-1 leading-relaxed">{entry.mfgAction || "No action recorded"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="mobile-card-label">Respondent</p>
                      <p className="font-medium">{entry.resp}</p>
                    </div>
                    <div>
                      <p className="mobile-card-label">Target Date</p>
                      <p className="font-medium">{entry.target || "—"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider >
  );
};

export default QAMatrixTable;
