import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
    ArrowLeft, BarChart3, Calendar, Search, Filter,
    Download, Database, RefreshCcw, X,
    ShieldAlert, ShieldCheck, Clock, Info
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface DefectEntry {
    id: string;
    source: string;
    defect_code: string;
    defect_location_code?: string;
    location_code?: string;
    defect_description_details: string;
    defect_description?: string;
    gravity?: string;
    quantity?: number;
    uploaded_at?: string;
    created_at?: string;
}

const DefectDashboard = () => {
    const [data, setData] = useState<DefectEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [sourceFilter, setSourceFilter] = useState("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [isRefreshing, setIsRefreshing] = useState(false);

    const hasFilters = useMemo(() => {
        return searchTerm || sourceFilter !== "all" || startDate || endDate;
    }, [searchTerm, sourceFilter, startDate, endDate]);

    const clearFilters = () => {
        setSearchTerm("");
        setSourceFilter("all");
        setStartDate("");
        setEndDate("");
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch from defect_data (SCA, YARD, DVX legacy)
            const { data: dd, error: e1 } = await supabase
                .from("defect_data")
                .select("*")
                .order("uploaded_at", { ascending: false });

            // 2. Fetch from dvx_defects (New DVX reports)
            const { data: dvx, error: e2 } = await supabase
                .from("dvx_defects")
                .select("*")
                .order("created_at", { ascending: false });

            if (e1 || e2) throw e1 || e2;

            // Unify data structures
            const unified: DefectEntry[] = [
                ...(dd || []).map(item => ({ ...item, source: item.source || "Unknown" })),
                ...(dvx || []).map(item => ({
                    ...item,
                    uploaded_at: item.created_at,
                    defect_location_code: item.location_code,
                    defect_description_details: item.defect_description_details || item.defect_description,
                    source: "DVX"
                }))
            ].sort((a: any, b: any) => {
                const dateA = new Date(a.uploaded_at || a.created_at || 0).getTime();
                const dateB = new Date(b.uploaded_at || b.created_at || 0).getTime();
                return dateB - dateA;
            });

            setData(unified);
        } catch (err: any) {
            toast({ title: "Fetch failed", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredData = useMemo(() => {
        return data.filter(item => {
            // Search term
            const searchStr = `${item.defect_code} ${item.defect_description_details} ${item.defect_location_code || item.location_code}`.toLowerCase();
            if (searchTerm && !searchStr.includes(searchTerm.toLowerCase())) return false;

            // Source filter
            if (sourceFilter !== "all" && item.source !== sourceFilter) return false;

            // Date range filter
            const itemDate = new Date(item.uploaded_at || item.created_at || "");
            if (startDate && itemDate < new Date(startDate)) return false;
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (itemDate > end) return false;
            }

            return true;
        });
    }, [data, searchTerm, sourceFilter, startDate, endDate]);

    const stats = useMemo(() => {
        const total = data.length;
        const dvx = data.filter(d => d.source === "DVX").length;
        const sca = data.filter(d => d.source === "SCA").length;
        const yard = data.filter(d => d.source === "YARD").length;
        const today = data.filter(d => {
            const d1 = new Date(d.uploaded_at || d.created_at || "").toDateString();
            const d2 = new Date().toDateString();
            return d1 === d2;
        }).length;

        return { total, dvx, sca, yard, today };
    }, [data]);

    const exportData = () => {
        const rows = filteredData.map(d => ({
            "Source": d.source,
            "Date": new Date(d.uploaded_at || d.created_at || "").toLocaleString(),
            "Defect Code": d.defect_code,
            "Location": d.defect_location_code || d.location_code || "—",
            "Description": d.defect_description_details,
            "Gravity": d.gravity || "—",
            "Quantity": d.quantity || 1
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Defects");
        XLSX.writeFile(wb, `Defect_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast({ title: "Export Complete", description: `Exported ${rows.length} records.` });
    };

    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950">
            {/* Header */}
            <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="max-w-[1800px] mx-auto flex flex-col md:flex-row md:h-16 items-start md:items-center gap-4 px-4 py-4 md:py-0 md:px-8">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <Link to="/">
                            <Button variant="ghost" size="sm" className="gap-2 shrink-0">
                                <ArrowLeft className="h-4 w-4" />
                                <span className="hidden xs:inline">Back to Matrix</span>
                            </Button>
                        </Link>
                        <div className="flex items-center gap-2">
                            <div className="bg-emerald-500/10 p-2 rounded-lg">
                                <BarChart3 className="h-5 w-5 text-emerald-500" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold tracking-tight">Defect Dashboard</h1>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold hidden sm:block">Historical Analysis</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto md:ml-auto">
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 h-9 flex-1 md:flex-none"
                            onClick={() => { setIsRefreshing(true); fetchData(); }}
                            disabled={isRefreshing}
                        >
                            <RefreshCcw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Button size="sm" className="gap-2 h-9 bg-emerald-600 hover:bg-emerald-700 flex-1 md:flex-none" onClick={exportData}>
                            <Download className="h-3.5 w-3.5" />
                            Export
                        </Button>
                    </div>
                </div>
            </header>


            <main className="w-full mx-auto py-8 px-4 md:px-8 space-y-8">
                {/* Stats Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Total Records</p>
                            <Database className="h-4 w-4 text-primary opacity-50" />
                        </div>
                        <p className="text-3xl font-bold tracking-tight">{stats.total}</p>
                        <div className="flex items-center gap-1.5 mt-2 text-[10px] text-emerald-600 font-medium">
                            <Clock className="h-3 w-3" />
                            <span>{stats.today} uploaded today</span>
                        </div>
                    </div>

                    <div className="bg-card border border-border border-l-4 border-l-sky-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">DVX Defects</p>
                            <ShieldAlert className="h-4 w-4 text-sky-500 opacity-50" />
                        </div>
                        <p className="text-3xl font-bold tracking-tight">{stats.dvx}</p>
                        <p className="text-[10px] text-muted-foreground mt-2">Data from daily reports</p>
                    </div>

                    <div className="bg-card border border-border border-l-4 border-l-emerald-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">SCA Defects</p>
                            <ShieldCheck className="h-4 w-4 text-emerald-500 opacity-50" />
                        </div>
                        <p className="text-3xl font-bold tracking-tight">{stats.sca}</p>
                        <p className="text-[10px] text-muted-foreground mt-2">Surface Coating Defects</p>
                    </div>

                    <div className="bg-card border border-border border-l-4 border-l-amber-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">YARD Defects</p>
                            <Info className="h-4 w-4 text-amber-500 opacity-50" />
                        </div>
                        <p className="text-3xl font-bold tracking-tight">{stats.yard}</p>
                        <p className="text-[10px] text-muted-foreground mt-2">Final Inspection Defects</p>
                    </div>

                    <div className="bg-card border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-5 shadow-sm flex flex-col justify-center">
                        <p className="text-xs font-bold text-emerald-700/80 uppercase mb-1">Pairing Readiness</p>
                        <p className="text-sm font-medium text-emerald-600">All datasets synced & available for matching</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                    <div className="bg-muted/30 px-4 md:px-6 py-4 border-b">
                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                            <div className="flex items-center justify-between md:justify-start gap-2">
                                <div className="flex items-center gap-2">
                                    <Filter className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-bold">Filters</span>
                                </div>
                                {hasFilters && (
                                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-[10px] text-destructive hover:text-destructive md:hidden">
                                        Clear
                                    </Button>
                                )}
                            </div>

                            <div className="h-8 w-[1px] bg-border mx-2 hidden md:block" />

                            <div className="flex-1 min-w-0 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search by code or description..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 h-10 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={sourceFilter}
                                    onChange={e => setSourceFilter(e.target.value)}
                                    className="h-10 px-3 text-xs md:text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                >
                                    <option value="all">All Sources</option>
                                    <option value="DVX">DVX Reports</option>
                                    <option value="SCA">SCA Shop</option>
                                    <option value="YARD">Yard Audit</option>
                                </select>

                                <div className="flex items-center gap-2 bg-background border p-1 rounded-lg">
                                    <div className="flex items-center gap-1.5 px-2">
                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase hidden xs:inline">Range</span>
                                    </div>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                        className="bg-transparent border-0 text-xs focus:ring-0 p-1 w-24"
                                    />
                                    <span className="text-muted-foreground text-xs font-bold">—</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={e => setEndDate(e.target.value)}
                                        className="bg-transparent border-0 text-xs focus:ring-0 p-1 w-24"
                                    />
                                </div>

                                {hasFilters && (
                                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 text-xs text-destructive hover:text-destructive hidden md:flex">
                                        <X className="h-3 w-3 mr-1" />
                                        Clear
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead>
                            <tr className="bg-muted/20 border-b">
                                <th className="px-6 py-3 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Source</th>
                                <th className="px-6 py-3 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Date & Time</th>
                                <th className="px-6 py-3 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Defect Code</th>
                                <th className="px-6 py-3 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Location</th>
                                <th className="px-6 py-3 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Description Details</th>
                                <th className="px-6 py-3 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider text-center">Gravity</th>
                                <th className="px-6 py-3 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider text-center">Qty</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <RefreshCcw className="h-8 w-8 text-primary animate-spin opacity-20" />
                                            <p className="text-muted-foreground font-medium">Crunching historical data...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                            <Database className="h-8 w-8 opacity-10" />
                                            <p className="font-medium">No results found for current filters</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((d, i) => (
                                    <tr key={d.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${d.source === "DVX" ? "bg-sky-500/10 text-sky-600" :
                                                d.source === "SCA" ? "bg-emerald-500/10 text-emerald-600" :
                                                    "bg-amber-500/10 text-amber-600"
                                                }`}>
                                                {d.source}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground font-medium text-[11px] whitespace-nowrap">
                                            {new Date(d.uploaded_at || d.created_at || "").toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                                            {d.defect_code}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {d.defect_location_code || d.location_code ? (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-mono border">
                                                        {d.defect_location_code || d.location_code}
                                                    </span>
                                                </div>
                                            ) : "—"}
                                        </td>
                                        <td className="px-6 py-4 max-w-md">
                                            <p className="line-clamp-2 text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">
                                                {d.defect_description_details}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {d.gravity ? (
                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black ${d.gravity === "S" ? "bg-rose-500 text-white" :
                                                    d.gravity === "P" ? "bg-warning text-white" :
                                                        "bg-primary text-white"
                                                    }`}>
                                                    {d.gravity}
                                                </span>
                                            ) : "—"}
                                        </td>
                                        <td className="px-6 py-4 text-center font-bold text-slate-700 dark:text-slate-300">
                                            {d.quantity || 1}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
};

export default DefectDashboard;

