import { useState, useMemo } from "react";
import { QAMatrixEntry } from "@/types/qaMatrix";
import { MatchedRepeat, UnmatchedDefect } from "@/types/dvxReport";
import { X, Link2, AlertTriangle, TrendingDown, Search, Filter, ChevronDown, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";

const OK_COLOR = "#1e7cb8";
const NG_COLOR = "#e87030";

// ─── Drill-down types ─────────────────────────────────────────
interface DrillItem {
    title: string;
    entries: QAMatrixEntry[];
}

// ─── Mini Donut ──────────────────────────────────────────────
const ClosedLoopDonut = ({
    label, ok, ng, size = 140,
    onClickOk, onClickNg,
}: {
    label: string; ok: number; ng: number; size?: number;
    onClickOk?: () => void; onClickNg?: () => void;
}) => {
    const total = ok + ng;
    const pct = total > 0 ? Math.round((ok / total) * 100) : 0;
    const chartData = [
        { name: "OK", value: ok || 0.001 },
        { name: "NG", value: ng || 0.001 },
    ];
    return (
        <div className="flex flex-col items-center gap-2">
            <div className="px-6 py-2 text-white text-sm font-bold tracking-widest uppercase rounded-lg min-w-[100px] text-center shadow-sm"
                style={{ background: `linear-gradient(135deg, hsl(210,70%,45%), hsl(210,70%,35%))` }}>
                {label}
            </div>
            <div className="relative" style={{ width: size, height: size }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%" cy="50%"
                            innerRadius={size * 0.30} outerRadius={size * 0.46}
                            dataKey="value" strokeWidth={3} stroke="transparent"
                            className="cursor-pointer"
                            onClick={(_, idx) => {
                                if (idx === 0 && onClickOk) onClickOk();
                                if (idx === 1 && onClickNg) onClickNg();
                            }}
                        >
                            <Cell fill={OK_COLOR} />
                            <Cell fill={NG_COLOR} />
                        </Pie>
                        <Tooltip
                            content={({ payload }) => {
                                if (!payload?.length) return null;
                                const p = payload[0];
                                return (
                                    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-lg text-foreground">
                                        <span className="font-semibold">{p.name}:</span> {Math.round(p.value as number)} · click to view
                                    </div>
                                );
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-2xl font-extrabold tabular-nums text-foreground">{pct}%</span>
                </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-foreground font-semibold">
                <span className="flex items-center gap-1.5 cursor-pointer hover:underline" onClick={onClickOk}>
                    <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: OK_COLOR }} /> OK ({ok})
                </span>
                <span className="flex items-center gap-1.5 cursor-pointer hover:underline" onClick={onClickNg}>
                    <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: NG_COLOR }} /> NG ({ng})
                </span>
            </div>
        </div>
    );
};

// ─── Row Layout ──────────────────────────────────────────────
const RowSection = ({
    referenceLabel, subtitle, count, badge, pct,
    wsOk, wsNg, mfgOk, mfgNg, plantOk, plantNg,
    onWsOk, onWsNg, onMfgOk, onMfgNg, onPlantOk, onPlantNg,
    rightBox,
}: {
    referenceLabel: string; subtitle?: string;
    count: number; badge?: { value: number; label: string }; pct: number;
    wsOk: number; wsNg: number; mfgOk: number; mfgNg: number; plantOk: number; plantNg: number;
    onWsOk?: () => void; onWsNg?: () => void;
    onMfgOk?: () => void; onMfgNg?: () => void;
    onPlantOk?: () => void; onPlantNg?: () => void;
    rightBox?: React.ReactNode;
}) => (
    <div className="grid items-center gap-8" style={{ gridTemplateColumns: "220px 1fr 1fr 1fr auto" }}>
        <div className="flex flex-col items-start pl-3">
            <div className="flex items-center gap-4">
                <span className="text-5xl font-extrabold tabular-nums text-foreground leading-none">{count}</span>
                {badge && (
                    <div className="flex flex-col items-center px-3 py-2 rounded-xl border-2 border-orange-500/40 bg-orange-500/10" title={badge.label}>
                        <span className="text-2xl font-extrabold tabular-nums text-orange-500 leading-none">{badge.value}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500/80 mt-1">Reoccurred</span>
                    </div>
                )}
            </div>
            <span className="text-4xl font-extrabold tabular-nums mt-2" style={{ color: OK_COLOR }}>{pct}%</span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider mt-2 font-semibold">{referenceLabel}</span>
            {subtitle && <span className="text-xs text-muted-foreground/70 mt-1">{subtitle}</span>}
        </div>
        <ClosedLoopDonut label="WSTN" ok={wsOk} ng={wsNg} onClickOk={onWsOk} onClickNg={onWsNg} />
        <ClosedLoopDonut label="MFG" ok={mfgOk} ng={mfgNg} onClickOk={onMfgOk} onClickNg={onMfgNg} />
        <ClosedLoopDonut label="PLANT" ok={plantOk} ng={plantNg} onClickOk={onPlantOk} onClickNg={onPlantNg} />
        {rightBox ? rightBox : <div />}
    </div>
);

// ─── Drill-down Modal ─────────────────────────────────────────
const DrillModal = ({ drill, onClose }: { drill: DrillItem; onClose: () => void }) => (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
        <div className="rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-border bg-card overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-primary/10">
                <h3 className="text-base font-bold text-foreground">{drill.title}</h3>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>
            <div className="overflow-auto flex-1">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                        <tr className="border-b border-border">
                            <th className="px-4 py-3 text-left font-bold text-muted-foreground">S.No</th>
                            <th className="px-4 py-3 text-left font-bold text-muted-foreground">Station</th>
                            <th className="px-4 py-3 text-left font-bold text-muted-foreground">Concern</th>
                            <th className="px-4 py-3 text-left font-bold text-muted-foreground">Source</th>
                            <th className="px-4 py-3 text-center font-bold text-muted-foreground">WS</th>
                            <th className="px-4 py-3 text-center font-bold text-muted-foreground">MFG</th>
                            <th className="px-4 py-3 text-center font-bold text-muted-foreground">Plant</th>
                        </tr>
                    </thead>
                    <tbody>
                        {drill.entries.map((e) => (
                            <tr key={e.sNo} className="border-t border-border/50 hover:bg-muted/40">
                                <td className="px-4 py-3 font-mono">{e.sNo}</td>
                                <td className="px-4 py-3">{e.operationStation}</td>
                                <td className="px-4 py-3 max-w-[280px] truncate" title={e.concern}>{e.concern}</td>
                                <td className="px-4 py-3">{e.source}</td>
                                <td className={`px-4 py-3 text-center font-bold ${e.workstationStatus === "NG" ? "text-destructive" : "text-emerald-600"}`}>{e.workstationStatus}</td>
                                <td className={`px-4 py-3 text-center font-bold ${e.mfgStatus === "NG" ? "text-destructive" : "text-emerald-600"}`}>{e.mfgStatus}</td>
                                <td className={`px-4 py-3 text-center font-bold ${e.plantStatus === "NG" ? "text-destructive" : "text-emerald-600"}`}>{e.plantStatus}</td>
                            </tr>
                        ))}
                        {drill.entries.length === 0 && (
                            <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-base">No entries found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
);

// ─── Main Component ───────────────────────────────────────────
interface ClosedLoopDashboardProps {
    qaData: QAMatrixEntry[];
    matched: MatchedRepeat[];
    unmatched: UnmatchedDefect[];
    onOpenPairDialog: (item: UnmatchedDefect) => void;
}

const ClosedLoopDashboard = ({ qaData, matched, unmatched, onOpenPairDialog }: ClosedLoopDashboardProps) => {
    // ── UI state ─────────────────────────────────────────────
    const [showUnmatchedModal, setShowUnmatchedModal] = useState(false);
    const [drill, setDrill] = useState<DrillItem | null>(null);

    // ── Dashboard filters ────────────────────────────────────
    const [areaFilter, setAreaFilter] = useState("");
    const [sourceFilter, setSourceFilter] = useState("");
    const [resultFilter, setResultFilter] = useState<"" | "OK" | "NG">("");

    // ── Unmatched modal filters ───────────────────────────────
    const [umSearch, setUmSearch] = useState("");
    const [umGravity, setUmGravity] = useState("");

    const matchedSNos = useMemo(() => new Set(matched.map((m) => m.qaSNo)), [matched]);

    // Apply dashboard filters to QA data
    const filteredQA = useMemo(() => {
        let d = qaData;
        if (areaFilter) d = d.filter((e) => e.designation.toUpperCase() === areaFilter);
        if (sourceFilter) d = d.filter((e) => e.source.toUpperCase() === sourceFilter);
        if (resultFilter === "OK") d = d.filter((e) => e.plantStatus === "OK");
        if (resultFilter === "NG") d = d.filter((e) => e.plantStatus === "NG");
        return d;
    }, [qaData, areaFilter, sourceFilter, resultFilter]);

    // ── Reference stats ───────────────────────────────────────
    const refTotal = filteredQA.length;
    const refWsOk = filteredQA.filter((d) => d.workstationStatus === "OK").length;
    const refMfgOk = filteredQA.filter((d) => d.mfgStatus === "OK").length;
    const refPlantOk = filteredQA.filter((d) => d.plantStatus === "OK").length;
    const refPct = refTotal > 0 ? Math.round((refPlantOk / refTotal) * 100) : 0;

    // ── Closed Loop stats (matched treated as NG) ─────────────
    const clTotal = refTotal;
    const clPlantOk = filteredQA.filter((d) => d.plantStatus === "OK" && !matchedSNos.has(d.sNo)).length;
    const clOkPct = clTotal > 0 ? Math.round((clPlantOk / clTotal) * 100) : 0;
    const clWsOk = filteredQA.filter((d) => d.workstationStatus === "OK" && !matchedSNos.has(d.sNo)).length;
    const clMfgOk = filteredQA.filter((d) => d.mfgStatus === "OK" && !matchedSNos.has(d.sNo)).length;

    const totalDefectsReported = useMemo(() => matched.reduce((s, m) => s + m.repeatCount, 0), [matched]);
    const matchedInFilter = useMemo(() => filteredQA.filter((d) => matchedSNos.has(d.sNo)).length, [filteredQA, matchedSNos]);

    // ── Drill helpers ─────────────────────────────────────────
    const openDrill = (title: string, entries: QAMatrixEntry[]) => {
        if (entries.length > 0) setDrill({ title: `${title} (${entries.length})`, entries });
    };

    // Reference row drill-down makers
    const refDrill = (status: "WS" | "MFG" | "PLANT", type: "OK" | "NG") => {
        const okFn = (e: QAMatrixEntry) =>
            status === "WS" ? e.workstationStatus === "OK" :
                status === "MFG" ? e.mfgStatus === "OK" :
                    e.plantStatus === "OK";
        const entries = type === "OK" ? filteredQA.filter(okFn) : filteredQA.filter((e) => !okFn(e));
        openDrill(`Reference ${status} — ${type}`, entries);
    };

    // Closed loop drill-down (matched treated as NG)
    const clDrill = (status: "WS" | "MFG" | "PLANT", type: "OK" | "NG") => {
        const isMatched = (e: QAMatrixEntry) => matchedSNos.has(e.sNo);
        let entries: QAMatrixEntry[];
        if (status === "WS") {
            entries = type === "OK"
                ? filteredQA.filter((e) => e.workstationStatus === "OK" && !isMatched(e))
                : filteredQA.filter((e) => e.workstationStatus === "NG" || isMatched(e));
        } else if (status === "MFG") {
            entries = type === "OK"
                ? filteredQA.filter((e) => e.mfgStatus === "OK" && !isMatched(e))
                : filteredQA.filter((e) => e.mfgStatus === "NG" || isMatched(e));
        } else {
            entries = type === "OK"
                ? filteredQA.filter((e) => e.plantStatus === "OK" && !isMatched(e))
                : filteredQA.filter((e) => e.plantStatus === "NG" || isMatched(e));
        }
        openDrill(`Closed Loop ${status} — ${type}`, entries);
    };

    // ── Filtered unmatched list ───────────────────────────────
    const filteredUnmatched = useMemo(() => {
        let list = unmatched;
        if (umSearch) {
            const t = umSearch.toLowerCase();
            list = list.filter((u) =>
                (u.dvxEntry.locationDetails || "").toLowerCase().includes(t) ||
                (u.dvxEntry.locationCode || "").toLowerCase().includes(t) ||
                (u.dvxEntry.defectCode || "").toLowerCase().includes(t) ||
                (u.dvxEntry.defectDescription || "").toLowerCase().includes(t) ||
                (u.dvxEntry.defectDescriptionDetails || "").toLowerCase().includes(t)
            );
        }
        if (umGravity) list = list.filter((u) => u.dvxEntry.gravity === umGravity);
        return list;
    }, [unmatched, umSearch, umGravity]);

    const hasFilter = areaFilter || sourceFilter || resultFilter;

    return (
        <>
            <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-lg">
                {/* Header */}
                <div className="px-8 py-4 flex items-center gap-4 border-b border-border"
                    style={{ background: `linear-gradient(135deg, hsl(210,70%,45%,0.08), hsl(210,70%,45%,0.03))` }}>
                    <div className="p-2.5 rounded-xl bg-primary/15">
                        <Activity className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-foreground tracking-tight">
                            Closed Loop F/B Cycle — QA Matrix Analysis
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Click any donut segment to drill down into data
                        </p>
                    </div>
                </div>

                {/* ── Filter bar ────────────────────────────────── */}
                <div className="px-8 py-4 border-b border-border bg-muted/20 flex flex-wrap items-center gap-4">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-muted-foreground">Filter</span>

                    {/* Area */}
                    <div className="relative">
                        <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}
                            className="appearance-none pl-4 pr-8 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-shadow">
                            <option value="">All Areas</option>
                            <option value="TRIM">Trim</option>
                            <option value="CHASSIS">Chassis</option>
                            <option value="FINAL">Final</option>
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>

                    {/* Source */}
                    <div className="relative">
                        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
                            className="appearance-none pl-4 pr-8 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-shadow">
                            <option value="">All Sources</option>
                            {["DVX", "SCA", "ER3", "ER4", "FIELD"].map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>

                    {/* Result */}
                    <div className="relative">
                        <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value as "" | "OK" | "NG")}
                            className="appearance-none pl-4 pr-8 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-shadow">
                            <option value="">All Results</option>
                            <option value="OK">Plant OK</option>
                            <option value="NG">Plant NG</option>
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>

                    {hasFilter && (
                        <button
                            onClick={() => { setAreaFilter(""); setSourceFilter(""); setResultFilter(""); }}
                            className="ml-2 text-sm text-destructive hover:underline flex items-center gap-1 font-medium"
                        >
                            <X className="w-4 h-4" /> Clear
                        </button>
                    )}
                    {hasFilter && (
                        <span className="text-xs text-muted-foreground ml-2 bg-muted px-3 py-1 rounded-full font-mono">
                            Showing {refTotal} of {qaData.length} concerns
                        </span>
                    )}
                </div>

                <div className="px-8 py-8 space-y-10">
                    {/* Row 1 — Reference */}
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-lg text-white shadow-sm"
                                style={{ background: `linear-gradient(135deg, hsl(210,70%,45%), hsl(210,70%,35%))` }}>
                                Reference
                            </span>
                            <span className="text-xs text-muted-foreground">All QA Matrix concerns (baseline) · click donut to view entries</span>
                        </div>
                        <RowSection
                            referenceLabel="Total Concerns"
                            count={refTotal} pct={refPct}
                            wsOk={refWsOk} wsNg={refTotal - refWsOk}
                            mfgOk={refMfgOk} mfgNg={refTotal - refMfgOk}
                            plantOk={refPlantOk} plantNg={refTotal - refPlantOk}
                            onWsOk={() => refDrill("WS", "OK")} onWsNg={() => refDrill("WS", "NG")}
                            onMfgOk={() => refDrill("MFG", "OK")} onMfgNg={() => refDrill("MFG", "NG")}
                            onPlantOk={() => refDrill("PLANT", "OK")} onPlantNg={() => refDrill("PLANT", "NG")}
                        />
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-4">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold">vs</span>
                        <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* Row 2 — Closed Loop */}
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-lg text-white shadow-sm bg-emerald-600">OK</span>
                            <span className="text-xs text-muted-foreground">
                                Closed loop F/B Cycle — concerns with reported defects are treated as NG · click donut to view
                            </span>
                        </div>
                        <RowSection
                            referenceLabel="All Concerns"
                            subtitle={`${matchedInFilter} with reported defects · ${totalDefectsReported} total`}
                            count={clTotal}
                            badge={matchedInFilter > 0 ? { value: matchedInFilter, label: `${matchedInFilter} concerns with reoccurred defects` } : undefined}
                            pct={clOkPct}
                            wsOk={clWsOk} wsNg={clTotal - clWsOk}
                            mfgOk={clMfgOk} mfgNg={clTotal - clMfgOk}
                            plantOk={clPlantOk} plantNg={clTotal - clPlantOk}
                            onWsOk={() => clDrill("WS", "OK")} onWsNg={() => clDrill("WS", "NG")}
                            onMfgOk={() => clDrill("MFG", "OK")} onMfgNg={() => clDrill("MFG", "NG")}
                            onPlantOk={() => clDrill("PLANT", "OK")} onPlantNg={() => clDrill("PLANT", "NG")}
                            rightBox={
                                <div className="flex flex-col items-center">
                                    <button
                                        onClick={() => setShowUnmatchedModal(true)}
                                        className="flex flex-col items-center justify-center rounded-2xl text-foreground font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer border-2 border-primary/30 hover:border-primary/60 bg-primary/5 hover:bg-primary/10"
                                        style={{ minWidth: 150, minHeight: 140, padding: "18px 20px" }}
                                        title="Click to view unmatched defects"
                                    >
                                        <span className="text-xs font-semibold uppercase tracking-wide text-center text-muted-foreground leading-tight mb-1">
                                            Additional Pairing
                                        </span>
                                        <span className="text-xs text-muted-foreground/60 mb-3 text-center">Under Validation</span>
                                        <span className="text-5xl font-extrabold tabular-nums text-primary">{unmatched.length}</span>
                                        <span className="text-xs text-muted-foreground mt-2 font-medium">defects · click to view</span>
                                    </button>
                                </div>
                            }
                        />
                    </div>

                    {/* Summary bar */}
                    {clTotal > 0 && matchedInFilter > 0 && (
                        <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/20 rounded-xl px-6 py-4 text-sm">
                            <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
                            <span className="text-foreground leading-relaxed">
                                <span className="font-bold text-orange-500">{matchedInFilter}</span> of {clTotal} concerns have reported defects
                                {" "}(<span className="font-bold">{totalDefectsReported}</span> total).{" "}
                                Plant OK%: <span className="font-bold">{refPct}%</span> (reference) →{" "}
                                <span className="font-bold" style={{ color: OK_COLOR }}>{clOkPct}%</span> (closed loop).{" "}
                                <span className="text-muted-foreground">{unmatched.length} defects unmatched.</span>
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Donut Drill-down Modal ──────────────────────────── */}
            {drill && <DrillModal drill={drill} onClose={() => setDrill(null)} />}

            {/* ── Unmatched Defects Modal ─────────────────────────── */}
            {showUnmatchedModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                    onClick={() => setShowUnmatchedModal(false)}>
                    <div className="rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col border border-border bg-card overflow-hidden"
                        onClick={(e) => e.stopPropagation()}>

                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-primary/10">
                            <div>
                                <h3 className="text-base font-bold text-foreground">
                                    Additional Pairing Requirement — Under Validation
                                </h3>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    {filteredUnmatched.length} of {unmatched.length} defects shown
                                </p>
                            </div>
                            <button onClick={() => setShowUnmatchedModal(false)}
                                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Filter bar */}
                        <div className="px-5 py-3 border-b border-border bg-muted/20 flex items-center gap-4 flex-wrap">
                            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                            <input
                                type="text"
                                placeholder="Search location, code, description..."
                                value={umSearch}
                                onChange={(e) => setUmSearch(e.target.value)}
                                className="flex-1 min-w-[200px] px-4 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                            />
                            <div className="relative">
                                <select value={umGravity} onChange={(e) => setUmGravity(e.target.value)}
                                    className="appearance-none pl-4 pr-8 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-shadow">
                                    <option value="">All Gravity</option>
                                    <option value="S">S</option>
                                    <option value="P">P</option>
                                    <option value="A">A</option>
                                </select>
                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            </div>
                            {(umSearch || umGravity) && (
                                <button onClick={() => { setUmSearch(""); setUmGravity(""); }}
                                    className="text-sm text-destructive hover:underline flex items-center gap-1 font-medium">
                                    <X className="w-4 h-4" /> Clear
                                </button>
                            )}
                        </div>

                        {/* Table */}
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                                    <tr className="border-b border-border">
                                        <th className="px-5 py-3 text-left font-bold text-muted-foreground">Location</th>
                                        <th className="px-5 py-3 text-left font-bold text-muted-foreground">Defect Code</th>
                                        <th className="px-5 py-3 text-left font-bold text-muted-foreground">Description</th>
                                        <th className="px-5 py-3 text-left font-bold text-muted-foreground">Details</th>
                                        <th className="px-5 py-3 text-center font-bold text-muted-foreground">Gravity</th>
                                        <th className="px-5 py-3 text-center font-bold text-muted-foreground">Qty</th>
                                        <th className="px-5 py-3 text-center font-bold text-muted-foreground">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUnmatched.map((item) => (
                                        <tr key={item.id} className="border-t border-border/50 hover:bg-muted/40 transition-colors">
                                            <td className="px-5 py-3 max-w-[150px] truncate text-foreground" title={item.dvxEntry.locationDetails}>
                                                {item.dvxEntry.locationDetails || item.dvxEntry.locationCode || "—"}
                                            </td>
                                            <td className="px-5 py-3 font-mono text-foreground">{item.dvxEntry.defectCode || "—"}</td>
                                            <td className="px-5 py-3 max-w-[200px] truncate text-foreground" title={item.dvxEntry.defectDescription}>
                                                {item.dvxEntry.defectDescription || "—"}
                                            </td>
                                            <td className="px-5 py-3 max-w-[200px] truncate text-muted-foreground" title={item.dvxEntry.defectDescriptionDetails}>
                                                {item.dvxEntry.defectDescriptionDetails || "—"}
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${item.dvxEntry.gravity === "A" ? "bg-destructive/15 text-destructive" :
                                                    item.dvxEntry.gravity === "B" ? "bg-orange-500/15 text-orange-500" :
                                                        "bg-muted text-muted-foreground"
                                                    }`}>{item.dvxEntry.gravity || "—"}</span>
                                            </td>
                                            <td className="px-5 py-3 text-center font-mono text-foreground">{item.dvxEntry.quantity}</td>
                                            <td className="px-5 py-3 text-center">
                                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 px-3"
                                                    onClick={() => { onOpenPairDialog(item); setShowUnmatchedModal(false); }}>
                                                    <Link2 className="w-3.5 h-3.5" /> Pair / Add
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredUnmatched.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-base">
                                                {unmatched.length === 0 ? "All defects are paired!" : "No results match your filters."}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ClosedLoopDashboard;
