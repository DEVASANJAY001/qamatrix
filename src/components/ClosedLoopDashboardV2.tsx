import { useState, useMemo } from "react";
import { QAMatrixEntry } from "@/types/qaMatrix";
import { MatchedRepeat, UnmatchedDefect } from "@/types/dvxReport";
import {
    X, AlertTriangle, TrendingDown, TrendingUp, Search,
    Filter, ChevronDown, Activity, ArrowRight, Link2,
    BarChart3, Target, Repeat, Shield, Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";

const OK_COLOR = "#1e7cb8";
const NG_COLOR = "#e87030";
const AREA_COLORS: Record<string, string> = {
    TRIM: "#6366f1",
    CHASSIS: "#0ea5e9",
    FINAL: "#10b981",
};

// ─── Drill Modal ─────────────────────────────────────────────
interface DrillItem { title: string; entries: QAMatrixEntry[]; }

const DrillModal = ({ drill, onClose }: { drill: DrillItem; onClose: () => void }) => (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
        <div className="rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-border bg-card overflow-hidden"
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
                            <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No entries found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
);

// ─── Progress Bar ────────────────────────────────────────────
const ProgressBar = ({
    label, okCount, total, color, onClick
}: {
    label: string; okCount: number; total: number; color: string; onClick?: () => void;
}) => {
    const pct = total > 0 ? Math.round((okCount / total) * 100) : 0;
    return (
        <div className="space-y-1.5 cursor-pointer group" onClick={onClick}>
            <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{label}</span>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{okCount} / {total}</span>
                    <span className="font-bold tabular-nums" style={{ color }}>{pct}%</span>
                </div>
            </div>
            <div className="h-3 rounded-full bg-muted/60 overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }}
                />
            </div>
        </div>
    );
};

// ─── Stat Card ───────────────────────────────────────────────
const StatCard = ({
    icon: Icon, label, value, subtitle, color, trend, onClick
}: {
    icon: any; label: string; value: string | number; subtitle?: string;
    color: string; trend?: { value: number; direction: "up" | "down" };
    onClick?: () => void;
}) => (
    <div
        className={`relative rounded-2xl border border-border bg-card p-5 overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-primary/30 ${onClick ? "cursor-pointer" : ""}`}
        onClick={onClick}
    >
        <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-[100%] opacity-[0.07]" style={{ background: color }} />
        <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl" style={{ background: `${color}18` }}>
                <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-extrabold tabular-nums text-foreground">{value}</span>
                    {trend && (
                        <span className={`flex items-center gap-0.5 text-sm font-bold ${trend.direction === "down" ? "text-destructive" : "text-emerald-600"}`}>
                            {trend.direction === "down" ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                            {trend.value}%
                        </span>
                    )}
                </div>
                {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            </div>
        </div>
    </div>
);

// ─── Area Breakdown Card ─────────────────────────────────────
const AreaCard = ({
    area, total, wsOk, mfgOk, plantOk, reoccurred, color, onClick,
}: {
    area: string; total: number; wsOk: number; mfgOk: number; plantOk: number;
    reoccurred: number; color: string; onClick?: (stage: string) => void;
}) => {
    const plantPct = total > 0 ? Math.round((plantOk / total) * 100) : 0;
    return (
        <div className="rounded-2xl border border-border bg-card p-5 hover:shadow-lg hover:border-primary/30 transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                    <span className="text-sm font-bold uppercase tracking-wider text-foreground">{area}</span>
                </div>
                <span className="text-xs font-mono bg-muted px-2 py-1 rounded-lg text-muted-foreground">{total} concerns</span>
            </div>
            {/* Mini donut */}
            <div className="flex items-center gap-5 mb-4">
                <div className="relative" style={{ width: 80, height: 80 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={[
                                    { name: "OK", value: plantOk || 0.001 },
                                    { name: "NG", value: (total - plantOk) || 0.001 },
                                ]}
                                cx="50%" cy="50%"
                                innerRadius={24} outerRadius={36}
                                dataKey="value" strokeWidth={0}
                            >
                                <Cell fill={color} />
                                <Cell fill={`${color}30`} />
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-sm font-extrabold tabular-nums" style={{ color }}>{plantPct}%</span>
                    </div>
                </div>
                <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Plant OK</span>
                        <span className="font-bold text-foreground">{plantOk}/{total}</span>
                    </div>
                    {reoccurred > 0 && (
                        <div className="flex items-center gap-1 text-xs">
                            <Repeat className="w-3 h-3 text-orange-500" />
                            <span className="text-orange-500 font-bold">{reoccurred} reoccurred</span>
                        </div>
                    )}
                </div>
            </div>
            {/* Stage bars */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 cursor-pointer hover:opacity-80" onClick={() => onClick?.("WS")}>
                    <span className="text-[11px] w-10 text-muted-foreground font-semibold">WS</span>
                    <div className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${total > 0 ? (wsOk / total) * 100 : 0}%`, background: color }} />
                    </div>
                    <span className="text-[11px] font-mono tabular-nums w-12 text-right text-muted-foreground">{total > 0 ? Math.round((wsOk / total) * 100) : 0}%</span>
                </div>
                <div className="flex items-center gap-2 cursor-pointer hover:opacity-80" onClick={() => onClick?.("MFG")}>
                    <span className="text-[11px] w-10 text-muted-foreground font-semibold">MFG</span>
                    <div className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${total > 0 ? (mfgOk / total) * 100 : 0}%`, background: color }} />
                    </div>
                    <span className="text-[11px] font-mono tabular-nums w-12 text-right text-muted-foreground">{total > 0 ? Math.round((mfgOk / total) * 100) : 0}%</span>
                </div>
                <div className="flex items-center gap-2 cursor-pointer hover:opacity-80" onClick={() => onClick?.("PLANT")}>
                    <span className="text-[11px] w-10 text-muted-foreground font-semibold">Plant</span>
                    <div className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${total > 0 ? (plantOk / total) * 100 : 0}%`, background: color }} />
                    </div>
                    <span className="text-[11px] font-mono tabular-nums w-12 text-right text-muted-foreground">{plantPct}%</span>
                </div>
            </div>
        </div>
    );
};


// ─── Main Component ───────────────────────────────────────────
interface ClosedLoopDashboardV2Props {
    qaData: QAMatrixEntry[];
    matched: MatchedRepeat[];
    unmatched: UnmatchedDefect[];
    onOpenPairDialog: (item: UnmatchedDefect) => void;
}

const ClosedLoopDashboardV2 = ({ qaData, matched, unmatched, onOpenPairDialog }: ClosedLoopDashboardV2Props) => {
    const [drill, setDrill] = useState<DrillItem | null>(null);
    const [showUnmatchedModal, setShowUnmatchedModal] = useState(false);

    // Filters
    const [areaFilter, setAreaFilter] = useState("");
    const [sourceFilter, setSourceFilter] = useState("");
    const [resultFilter, setResultFilter] = useState<"" | "OK" | "NG">("");
    const [umSearch, setUmSearch] = useState("");
    const [umGravity, setUmGravity] = useState("");

    const matchedSNos = useMemo(() => new Set(matched.map((m) => m.qaSNo)), [matched]);

    const filteredQA = useMemo(() => {
        let d = qaData;
        if (areaFilter) d = d.filter((e) => e.designation.toUpperCase() === areaFilter);
        if (sourceFilter) d = d.filter((e) => e.source.toUpperCase() === sourceFilter);
        if (resultFilter === "OK") d = d.filter((e) => e.plantStatus === "OK");
        if (resultFilter === "NG") d = d.filter((e) => e.plantStatus === "NG");
        return d;
    }, [qaData, areaFilter, sourceFilter, resultFilter]);

    // Stats
    const refTotal = filteredQA.length;
    const refWsOk = filteredQA.filter((d) => d.workstationStatus === "OK").length;
    const refMfgOk = filteredQA.filter((d) => d.mfgStatus === "OK").length;
    const refPlantOk = filteredQA.filter((d) => d.plantStatus === "OK").length;
    const refPct = refTotal > 0 ? Math.round((refPlantOk / refTotal) * 100) : 0;

    const clPlantOk = filteredQA.filter((d) => d.plantStatus === "OK" && !matchedSNos.has(d.sNo)).length;
    const clOkPct = refTotal > 0 ? Math.round((clPlantOk / refTotal) * 100) : 0;
    const clWsOk = filteredQA.filter((d) => d.workstationStatus === "OK" && !matchedSNos.has(d.sNo)).length;
    const clMfgOk = filteredQA.filter((d) => d.mfgStatus === "OK" && !matchedSNos.has(d.sNo)).length;

    const totalDefectsReported = useMemo(() => matched.reduce((s, m) => s + m.repeatCount, 0), [matched]);
    const matchedInFilter = useMemo(() => filteredQA.filter((d) => matchedSNos.has(d.sNo)).length, [filteredQA, matchedSNos]);

    const pctDelta = refPct - clOkPct;

    // Area breakdown
    const areas = useMemo(() => {
        const areaNames = ["TRIM", "CHASSIS", "FINAL"];
        return areaNames.map((a) => {
            const entries = filteredQA.filter((e) => e.designation.toUpperCase() === a);
            const total = entries.length;
            const wsOk = entries.filter((e) => e.workstationStatus === "OK" && !matchedSNos.has(e.sNo)).length;
            const mfgOk = entries.filter((e) => e.mfgStatus === "OK" && !matchedSNos.has(e.sNo)).length;
            const plantOk = entries.filter((e) => e.plantStatus === "OK" && !matchedSNos.has(e.sNo)).length;
            const reoccurred = entries.filter((e) => matchedSNos.has(e.sNo)).length;
            return { area: a, total, wsOk, mfgOk, plantOk, reoccurred, entries };
        }).filter((a) => a.total > 0);
    }, [filteredQA, matchedSNos]);

    // Top reoccurred concerns
    const topReoccurred = useMemo(() => {
        return matched
            .map((m) => {
                const qa = qaData.find((q) => q.sNo === m.qaSNo);
                return qa ? { ...m, station: qa.operationStation, designation: qa.designation, concern: qa.concern } : null;
            })
            .filter(Boolean)
            .sort((a: any, b: any) => b!.repeatCount - a!.repeatCount)
            .slice(0, 8) as (MatchedRepeat & { station: string; designation: string; concern: string })[];
    }, [matched, qaData]);

    // Bar chart comparison data
    const barData = useMemo(() => [
        { stage: "Workstation", Reference: refTotal > 0 ? Math.round((refWsOk / refTotal) * 100) : 0, "Closed Loop": refTotal > 0 ? Math.round((clWsOk / refTotal) * 100) : 0 },
        { stage: "MFG", Reference: refTotal > 0 ? Math.round((refMfgOk / refTotal) * 100) : 0, "Closed Loop": refTotal > 0 ? Math.round((clMfgOk / refTotal) * 100) : 0 },
        { stage: "Plant", Reference: refPct, "Closed Loop": clOkPct },
    ], [refTotal, refWsOk, refMfgOk, clWsOk, clMfgOk, refPct, clOkPct]);

    // Drill
    const openDrill = (title: string, entries: QAMatrixEntry[]) => {
        if (entries.length > 0) setDrill({ title: `${title} (${entries.length})`, entries });
    };

    // Unmatched filter
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
            <div className="space-y-6">
                {/* ─── Header Card ───────────────────────────────────── */}
                <div className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
                    <div className="px-8 py-4 flex items-center gap-4 border-b border-border"
                        style={{ background: `linear-gradient(135deg, hsl(210,70%,45%,0.08), hsl(210,70%,45%,0.03))` }}>
                        <div className="p-2.5 rounded-xl bg-primary/15">
                            <BarChart3 className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-foreground tracking-tight">
                                Closed Loop Analytics — Visual Dashboard
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Interactive analysis of QA Matrix with closed loop feedback
                            </p>
                        </div>
                    </div>

                    {/* Filter bar */}
                    <div className="px-8 py-4 border-b border-border bg-muted/20 flex flex-wrap items-center gap-4">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-semibold text-muted-foreground">Filter</span>

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
                        <div className="relative">
                            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
                                className="appearance-none pl-4 pr-8 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-shadow">
                                <option value="">All Sources</option>
                                {["DVX", "SCA", "ER3", "ER4", "FIELD"].map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
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
                                className="ml-2 text-sm text-destructive hover:underline flex items-center gap-1 font-medium">
                                <X className="w-4 h-4" /> Clear
                            </button>
                        )}
                        {hasFilter && (
                            <span className="text-xs text-muted-foreground ml-2 bg-muted px-3 py-1 rounded-full font-mono">
                                Showing {refTotal} of {qaData.length}
                            </span>
                        )}
                    </div>
                </div>

                {/* ─── Stat Cards ────────────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        icon={Layers}
                        label="Total Concerns"
                        value={refTotal}
                        subtitle={`${filteredQA.filter(d => d.plantStatus === "NG").length} Plant NG`}
                        color="#6366f1"
                        onClick={() => openDrill("All Concerns", filteredQA)}
                    />
                    <StatCard
                        icon={Repeat}
                        label="Reoccurred"
                        value={matchedInFilter}
                        subtitle={`${totalDefectsReported} total defects reported`}
                        color="#e87030"
                        onClick={() => openDrill("Reoccurred Concerns", filteredQA.filter(d => matchedSNos.has(d.sNo)))}
                    />
                    <StatCard
                        icon={Shield}
                        label="Reference OK%"
                        value={`${refPct}%`}
                        subtitle="Original Plant status"
                        color={OK_COLOR}
                        onClick={() => openDrill("Reference Plant OK", filteredQA.filter(d => d.plantStatus === "OK"))}
                    />
                    <StatCard
                        icon={Target}
                        label="Closed Loop OK%"
                        value={`${clOkPct}%`}
                        subtitle="After reoccurrence impact"
                        color={pctDelta > 0 ? NG_COLOR : "#10b981"}
                        trend={pctDelta > 0 ? { value: pctDelta, direction: "down" } : undefined}
                        onClick={() => openDrill("Closed Loop Plant OK", filteredQA.filter(d => d.plantStatus === "OK" && !matchedSNos.has(d.sNo)))}
                    />
                </div>

                {/* ─── Comparison Section ────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Bar Chart Comparison */}
                    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-5">
                            <BarChart3 className="w-5 h-5 text-primary" />
                            <h3 className="text-sm font-bold text-foreground">Reference vs Closed Loop</h3>
                            <span className="text-xs text-muted-foreground ml-1">OK% comparison by stage</span>
                        </div>
                        <div style={{ height: 220 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={barData} barGap={8} barCategoryGap="25%">
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,87%)" vertical={false} />
                                    <XAxis dataKey="stage" tick={{ fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: 12, border: "1px solid hsl(220,13%,87%)", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 13 }}
                                        formatter={(value: number) => [`${value}%`, undefined]}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
                                    <Bar dataKey="Reference" fill={OK_COLOR} radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="Closed Loop" fill={NG_COLOR} radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Stage-wise Progress Bars */}
                    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-5">
                            <Activity className="w-5 h-5 text-primary" />
                            <h3 className="text-sm font-bold text-foreground">Closed Loop Stage Analysis</h3>
                        </div>
                        <div className="space-y-5">
                            <ProgressBar
                                label="Workstation"
                                okCount={clWsOk}
                                total={refTotal}
                                color="#6366f1"
                                onClick={() => openDrill("Closed Loop WS OK", filteredQA.filter(d => d.workstationStatus === "OK" && !matchedSNos.has(d.sNo)))}
                            />
                            <ProgressBar
                                label="Manufacturing"
                                okCount={clMfgOk}
                                total={refTotal}
                                color="#0ea5e9"
                                onClick={() => openDrill("Closed Loop MFG OK", filteredQA.filter(d => d.mfgStatus === "OK" && !matchedSNos.has(d.sNo)))}
                            />
                            <ProgressBar
                                label="Plant"
                                okCount={clPlantOk}
                                total={refTotal}
                                color="#10b981"
                                onClick={() => openDrill("Closed Loop Plant OK", filteredQA.filter(d => d.plantStatus === "OK" && !matchedSNos.has(d.sNo)))}
                            />
                        </div>

                        {/* Impact summary */}
                        {matchedInFilter > 0 && (
                            <div className="mt-6 pt-5 border-t border-border">
                                <div className="flex items-center gap-2 text-sm">
                                    <TrendingDown className="w-4 h-4 text-orange-500" />
                                    <span className="text-muted-foreground">Reoccurrence impact:</span>
                                    <span className="font-bold text-foreground">{refPct}%</span>
                                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span className="font-bold" style={{ color: OK_COLOR }}>{clOkPct}%</span>
                                    <span className="text-xs font-bold text-orange-500 ml-1">(-{pctDelta}%)</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ─── Area Breakdown ────────────────────────────────── */}
                {areas.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Area Breakdown</span>
                            <span className="flex-1 h-px bg-border" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {areas.map((a) => (
                                <AreaCard
                                    key={a.area}
                                    area={a.area}
                                    total={a.total}
                                    wsOk={a.wsOk}
                                    mfgOk={a.mfgOk}
                                    plantOk={a.plantOk}
                                    reoccurred={a.reoccurred}
                                    color={AREA_COLORS[a.area] || "#6366f1"}
                                    onClick={(stage) => openDrill(
                                        `${a.area} ${stage} OK (Closed Loop)`,
                                        a.entries.filter((e) =>
                                            stage === "WS" ? e.workstationStatus === "OK" && !matchedSNos.has(e.sNo) :
                                                stage === "MFG" ? e.mfgStatus === "OK" && !matchedSNos.has(e.sNo) :
                                                    e.plantStatus === "OK" && !matchedSNos.has(e.sNo)
                                        )
                                    )}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── Top Reoccurred Concerns ──────────────────────── */}
                {topReoccurred.length > 0 && (
                    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-border flex items-center gap-3"
                            style={{ background: `linear-gradient(135deg, hsl(24,90%,50%,0.06), transparent)` }}>
                            <AlertTriangle className="w-5 h-5 text-orange-500" />
                            <h3 className="text-sm font-bold text-foreground">Top Reoccurred Concerns</h3>
                            <span className="text-xs text-muted-foreground">Highest repeat count first</span>
                        </div>
                        <div className="overflow-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="px-5 py-3 text-left font-bold text-muted-foreground w-16">#</th>
                                        <th className="px-5 py-3 text-left font-bold text-muted-foreground">Concern</th>
                                        <th className="px-5 py-3 text-left font-bold text-muted-foreground">Station</th>
                                        <th className="px-5 py-3 text-left font-bold text-muted-foreground">Area</th>
                                        <th className="px-5 py-3 text-center font-bold text-muted-foreground">Repeat Count</th>
                                        <th className="px-5 py-3 text-center font-bold text-muted-foreground">Defects</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topReoccurred.map((item, idx) => (
                                        <tr key={item.qaSNo} className="border-t border-border/50 hover:bg-muted/40 transition-colors cursor-pointer"
                                            onClick={() => {
                                                const qa = qaData.find(q => q.sNo === item.qaSNo);
                                                if (qa) openDrill(`Concern #${item.qaSNo}`, [qa]);
                                            }}>
                                            <td className="px-5 py-3">
                                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-orange-500/10 text-orange-500 font-bold text-xs">
                                                    {idx + 1}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 max-w-[250px] truncate font-medium text-foreground" title={item.concern}>
                                                <span className="text-muted-foreground font-mono text-xs mr-2">#{item.qaSNo}</span>
                                                {item.concern}
                                            </td>
                                            <td className="px-5 py-3 text-muted-foreground">{item.station}</td>
                                            <td className="px-5 py-3">
                                                <span className="inline-block px-2 py-0.5 rounded-md text-xs font-bold"
                                                    style={{ background: `${AREA_COLORS[item.designation.toUpperCase()] || "#6366f1"}18`, color: AREA_COLORS[item.designation.toUpperCase()] || "#6366f1" }}>
                                                    {item.designation}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 font-bold text-sm tabular-nums">
                                                    <Repeat className="w-3.5 h-3.5" />
                                                    {item.repeatCount}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-center font-mono text-muted-foreground">{item.dvxEntries.length}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ─── Unmatched Defects Button ──────────────────────── */}
                {unmatched.length > 0 && (
                    <div className="flex items-center gap-3 bg-orange-500/5 border border-orange-500/20 rounded-2xl px-6 py-4">
                        <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
                        <span className="text-sm text-foreground flex-1">
                            <span className="font-bold text-orange-500">{unmatched.length}</span> defects remain unmatched and need additional pairing.
                        </span>
                        <Button size="sm" variant="outline" className="gap-1.5 border-orange-500/40 hover:border-orange-500/70 text-orange-600 hover:text-orange-700"
                            onClick={() => setShowUnmatchedModal(true)}>
                            <Link2 className="w-4 h-4" /> View Unmatched
                        </Button>
                    </div>
                )}
            </div>

            {/* Drill Modal */}
            {drill && <DrillModal drill={drill} onClose={() => setDrill(null)} />}

            {/* Unmatched Modal */}
            {showUnmatchedModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                    onClick={() => setShowUnmatchedModal(false)}>
                    <div className="rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col border border-border bg-card overflow-hidden"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-primary/10">
                            <div>
                                <h3 className="text-base font-bold text-foreground">Additional Pairing Requirement — Under Validation</h3>
                                <p className="text-sm text-muted-foreground mt-0.5">{filteredUnmatched.length} of {unmatched.length} defects shown</p>
                            </div>
                            <button onClick={() => setShowUnmatchedModal(false)}
                                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="px-5 py-3 border-b border-border bg-muted/20 flex items-center gap-4 flex-wrap">
                            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                            <input type="text" placeholder="Search location, code, description..."
                                value={umSearch} onChange={(e) => setUmSearch(e.target.value)}
                                className="flex-1 min-w-[200px] px-4 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-shadow" />
                            <div className="relative">
                                <select value={umGravity} onChange={(e) => setUmGravity(e.target.value)}
                                    className="appearance-none pl-4 pr-8 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-shadow">
                                    <option value="">All Gravity</option>
                                    <option value="A">A (Critical)</option>
                                    <option value="B">B (Major)</option>
                                    <option value="C">C (Minor)</option>
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

export default ClosedLoopDashboardV2;
