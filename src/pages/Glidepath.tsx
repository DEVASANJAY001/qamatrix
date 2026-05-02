import { useState, useMemo, useEffect } from "react";
import { useQAMatrixDB } from "@/hooks/useQAMatrixDB";
import { Link } from "react-router-dom";
import { ArrowLeft, BarChart3, LayoutDashboard, Settings, HelpCircle, ShieldAlert, Calendar, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

const Glidepath = () => {
    const { data, loading } = useQAMatrixDB();
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [dvxDefects, setDvxDefects] = useState<any[]>([]);

    useEffect(() => {
        const fetchDVX = async () => {
            try {
                const res = await fetch('/api/dvx-defects');
                const defects = await res.json();
                if (res.ok) {
                    setDvxDefects(defects.filter((d: any) => d.pairing_status === 'paired' && d.qa_matrix_sno));
                }
            } catch (err) {
                console.error("Fetch DVX error:", err);
            }
        };
        fetchDVX();
    }, []);

    const filteredData = useMemo(() => {
        if (!startDate && !endDate) return data;

        const start = startDate ? new Date(startDate).getTime() : 0;
        const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Infinity;

        const counts = new Map<number, number>();
        dvxDefects.forEach(d => {
            const dDate = new Date(d.date || d.created_at).getTime();
            if (dDate >= start && dDate <= end) {
                const sno = d.qa_matrix_sno;
                counts.set(sno, (counts.get(sno) || 0) + (d.quantity || 1));
            }
        });

        return data.map(entry => ({
            ...entry,
            recurrence: counts.get(entry.sNo) || 0
        })).filter(entry => entry.recurrence > 0);
    }, [data, dvxDefects, startDate, endDate]);

    const mfgMatrix = useMemo(() => {
        const matrix = {
            5: { 1: 0, 3: 0, 5: 0 },
            3: { 1: 0, 3: 0, 5: 0 },
            1: { 1: 0, 3: 0, 5: 0 }
        };

        filteredData.forEach(entry => {
            const severity = entry.defectRating;
            const control = entry.controlRating.Shop || 0;

            // Map control rating to levels 1, 3, 5
            let level: 1 | 3 | 5 = 1;
            if (control >= 5) level = 5;
            else if (control >= 3) level = 3;

            if (matrix[level] && (severity === 1 || severity === 3 || severity === 5)) {
                matrix[level][severity]++;
            }
        });

        return matrix;
    }, [filteredData]);

    const wsMatrix = useMemo(() => {
        const matrix = {
            5: { 1: 0, 3: 0, 5: 0 },
            3: { 1: 0, 3: 0, 5: 0 },
            1: { 1: 0, 3: 0, 5: 0 }
        };

        filteredData.forEach(entry => {
            const severity = entry.defectRating;
            const control = entry.controlRating.Workstation || 0;

            let level: 1 | 3 | 5 = 1;
            if (control >= 5) level = 5;
            else if (control >= 3) level = 3;

            if (matrix[level] && (severity === 1 || severity === 3 || severity === 5)) {
                matrix[level][severity]++;
            }
        });

        return matrix;
    }, [filteredData]);

    const glidepathData = useMemo(() => {
        // Mapping for lower matrix: [severity][control]
        const matrix = {
            5: { 1: { count: 0, rec: 0 }, 3: { count: 0, rec: 0 }, 5: { count: 0, rec: 0 } },
            3: { 1: { count: 0, rec: 0 }, 3: { count: 0, rec: 0 }, 5: { count: 0, rec: 0 } },
            1: { 1: { count: 0, rec: 0 }, 3: { count: 0, rec: 0 }, 5: { count: 0, rec: 0 } }
        };

        filteredData.forEach(entry => {
            const severity = entry.defectRating;
            const control = entry.controlRating.Shop || 0;
            const rec = entry.recurrence || 0;

            let level: 1 | 3 | 5 = 1;
            if (control >= 5) level = 5;
            else if (control >= 3) level = 3;

            if (matrix[severity] && matrix[severity][level]) {
                matrix[severity][level].count++;
                matrix[severity][level].rec += rec;
            }
        });

        return matrix;
    }, [filteredData]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] pb-20">
            {/* Header */}
            <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                        <Link to="/">
                            <Button variant="ghost" size="icon" className="text-slate-500 hover:text-primary">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <h1 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2 whitespace-nowrap">
                            <BarChart3 className="h-5 w-5 text-primary" />
                            Glidepath + Quick Overview on QAM
                        </h1>

                        <div className="hidden md:flex items-center gap-2 ml-8 bg-slate-50 border border-slate-200 p-1 rounded-lg">
                            <div className="flex items-center gap-1.5 px-2">
                                <Filter className="h-3 w-3 text-slate-400" />
                                <span className="text-[10px] font-black text-slate-500 uppercase">Range</span>
                            </div>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="bg-transparent border-none text-xs focus:ring-0 p-0 w-28 font-medium text-slate-700"
                            />
                            <span className="text-slate-300">—</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="bg-transparent border-none text-xs focus:ring-0 p-0 w-28 font-medium text-slate-700"
                            />
                            {(startDate || endDate) && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-slate-400 hover:text-destructive"
                                    onClick={() => { setStartDate(""); setEndDate(""); }}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Link to="/defect-dashboard">
                            <Button variant="outline" size="sm" className="gap-2">
                                <LayoutDashboard className="h-4 w-4" /> Dashboard
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* MFG / Line Section */}
                    <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h2 className="text-xl font-black text-[#1e293b] mb-6 border-b pb-2 flex items-center gap-2">
                            MFG / Line
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className="p-2 border-none"></th>
                                        <th className="p-2 border-none"></th>
                                        <th colSpan={3} className="p-2 border bg-slate-50 text-[10px] uppercase font-black text-slate-500 text-center">Severity Rating</th>
                                    </tr>
                                    <tr>
                                        <th className="p-2 border-none"></th>
                                        <th className="p-2 border-none"></th>
                                        <th className="p-2 border bg-slate-50 text-xs font-black text-slate-700 text-center w-24">Level 5</th>
                                        <th className="p-2 border bg-slate-50 text-xs font-black text-slate-700 text-center w-24">Level 3</th>
                                        <th className="p-2 border bg-slate-50 text-xs font-black text-slate-700 text-center w-24">Level 1</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[1, 3, 5].reverse().map((control) => (
                                        <tr key={control}>
                                            {control === 5 && (
                                                <td rowSpan={3} className="border-none w-10 text-center">
                                                    <p className="[writing-mode:vertical-lr] rotate-180 text-[10px] uppercase font-black text-slate-500">Control Rating</p>
                                                </td>
                                            )}
                                            <td className="p-2 border bg-slate-50 text-xs font-black text-slate-700 text-center whitespace-nowrap">Level {control}</td>
                                            {[5, 3, 1].map((severity) => {
                                                const count = mfgMatrix[control][severity];
                                                let bgColor = "bg-green-500"; // Default Level 5 Control or Level 3 w/ low severity
                                                if (control === 1) bgColor = "bg-red-500";
                                                else if (control === 3 && severity === 5) bgColor = "bg-yellow-400";
                                                else if (control === 3) bgColor = "bg-green-500";

                                                return (
                                                    <td key={severity} className={`p-4 border text-center font-black text-lg ${count > 0 ? bgColor + " text-white" : "bg-white text-slate-200"}`}>
                                                        {count || ""}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Lower Glidepath Matrix for MFG */}
                        <div className="mt-12 overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th colSpan={2} className="p-2"></th>
                                        <th className="p-2 border bg-slate-50 text-[10px] font-black text-slate-500 text-center">Field /0Km</th>
                                        <th className="p-2 border bg-slate-50 text-[10px] font-black text-slate-500 text-center">SCA/ DRR</th>
                                        <th className="p-2 border bg-slate-50 text-[10px] font-black text-slate-500 text-center">PQG /FMEA</th>
                                    </tr>
                                    <tr>
                                        <th colSpan={2} className="p-2"></th>
                                        <th className="p-1 border bg-slate-100 text-[9px] font-black text-slate-600 text-center italic">High</th>
                                        <th className="p-1 border bg-slate-100 text-[9px] font-black text-slate-600 text-center italic">Medium</th>
                                        <th className="p-1 border bg-slate-100 text-[9px] font-black text-slate-600 text-center italic">Low</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { label: "Not Possible", sub: "Hard", level: 1 },
                                        { label: "MFG Detectable", sub: "Medium", level: 3 },
                                        { label: "MFG RC", sub: "Easy", level: 5 }
                                    ].map((row, idx) => (
                                        <tr key={row.level}>
                                            <td className="p-2 border bg-slate-50 text-[10px] font-black text-slate-700 text-center whitespace-nowrap">{row.label}</td>
                                            <td className="p-2 border bg-slate-50 text-[10px] font-black text-slate-700 text-center font-italic italic">{row.sub}</td>
                                            {[5, 3, 1].map((severity) => {
                                                const cell = glidepathData[severity][row.level];
                                                const count = cell.count;
                                                const rec = cell.rec;

                                                let colorClass = "bg-white";
                                                if (count > 0) {
                                                    if (row.level === 1) { // Hard
                                                        colorClass = severity === 5 ? "bg-yellow-400" : (severity === 3 ? "bg-green-600" : "bg-white");
                                                    } else if (row.level === 3) { // Medium
                                                        colorClass = severity === 5 ? "bg-orange-500 text-white" : (severity === 3 ? "bg-orange-400" : "bg-green-600");
                                                    } else if (row.level === 5) { // Easy
                                                        colorClass = severity === 5 ? "bg-red-600 text-white" : (severity === 3 ? "bg-orange-500 text-white" : "bg-yellow-400");
                                                    }
                                                }

                                                return (
                                                    <td key={severity} className={`p-3 border text-center font-black text-sm ${colorClass}`}>
                                                        {count > 0 ? (
                                                            <span>
                                                                {count} <span className="text-[10px] opacity-80">({rec})</span>
                                                            </span>
                                                        ) : ""}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Work Station Section */}
                    <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h2 className="text-xl font-black text-[#1e293b] mb-6 border-b pb-2 flex items-center gap-2">
                            Work Station
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className="p-2 border-none"></th>
                                        <th className="p-2 border-none"></th>
                                        <th colSpan={3} className="p-2 border bg-slate-50 text-[10px] uppercase font-black text-slate-500 text-center">Severity Rating</th>
                                    </tr>
                                    <tr>
                                        <th className="p-2 border-none"></th>
                                        <th className="p-2 border-none"></th>
                                        <th className="p-2 border bg-slate-50 text-xs font-black text-slate-700 text-center w-24">Level 5</th>
                                        <th className="p-2 border bg-slate-50 text-xs font-black text-slate-700 text-center w-24">Level 3</th>
                                        <th className="p-2 border bg-slate-50 text-xs font-black text-slate-700 text-center w-24">Level 1</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[1, 3, 5].reverse().map((control) => (
                                        <tr key={control}>
                                            {control === 5 && (
                                                <td rowSpan={3} className="border-none w-10 text-center">
                                                    <p className="[writing-mode:vertical-lr] rotate-180 text-[10px] uppercase font-black text-slate-500">Control Rating</p>
                                                </td>
                                            )}
                                            <td className="p-2 border bg-slate-50 text-xs font-black text-slate-700 text-center whitespace-nowrap">Level {control}</td>
                                            {[5, 3, 1].map((severity) => {
                                                const count = wsMatrix[control][severity];
                                                let bgColor = "bg-green-500";
                                                if (control === 1) bgColor = "bg-red-500";
                                                else if (control === 3 && severity === 5) bgColor = "bg-yellow-400";
                                                else if (control === 3) bgColor = "bg-green-500";

                                                return (
                                                    <td key={severity} className={`p-4 border text-center font-black text-lg ${count > 0 ? bgColor + " text-white" : "bg-white text-slate-200"}`}>
                                                        {count || ""}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Workstation lower matrix - identical mapping but potentially different data if filtered */}
                        <div className="mt-12 overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th colSpan={2} className="p-2"></th>
                                        <th className="p-2 border bg-slate-50 text-[10px] font-black text-slate-500 text-center">Field /0Km</th>
                                        <th className="p-2 border bg-slate-50 text-[10px] font-black text-slate-500 text-center">SCA/ DRR</th>
                                        <th className="p-2 border bg-slate-50 text-[10px] font-black text-slate-500 text-center">PQG /FMEA</th>
                                    </tr>
                                    <tr>
                                        <th colSpan={2} className="p-2"></th>
                                        <th className="p-1 border bg-slate-100 text-[9px] font-black text-slate-600 text-center italic">High</th>
                                        <th className="p-1 border bg-slate-100 text-[9px] font-black text-slate-600 text-center italic">Medium</th>
                                        <th className="p-1 border bg-slate-100 text-[9px] font-black text-slate-600 text-center italic">Low</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { label: "Not Possible", sub: "Hard", level: 1 },
                                        { label: "MFG Detectable", sub: "Medium", level: 3 },
                                        { label: "MFG RC", sub: "Easy", level: 5 }
                                    ].map((row, idx) => (
                                        <tr key={row.level}>
                                            <td className="p-2 border bg-slate-50 text-[10px] font-black text-slate-700 text-center whitespace-nowrap">{row.label}</td>
                                            <td className="p-2 border bg-slate-50 text-[10px] font-black text-slate-700 text-center font-italic italic">{row.sub}</td>
                                            {[5, 3, 1].map((severity) => {
                                                // For Workstation section lower matrix, we can use the same glidepathData or filter by WS
                                                const cell = glidepathData[severity][row.level];
                                                const count = cell.count;
                                                const rec = cell.rec;

                                                let colorClass = "bg-white";
                                                if (count > 0) {
                                                    if (row.level === 1) { // Hard
                                                        colorClass = severity === 5 ? "bg-red-600 text-white" : "bg-red-500 text-white";
                                                    } else if (row.level === 3) {
                                                        colorClass = severity === 5 ? "bg-yellow-400" : "bg-green-600";
                                                    } else {
                                                        colorClass = "bg-green-600";
                                                    }
                                                }

                                                // Custom colors from workstation image
                                                if (severity === 5 && row.level === 1) colorClass = "bg-yellow-400";
                                                if (severity === 3 && row.level === 1) colorClass = "bg-green-600";
                                                if (severity === 5 && row.level === 3) colorClass = "bg-orange-500 text-white";
                                                if (severity === 3 && row.level === 3) colorClass = "bg-orange-400";
                                                if (severity === 1 && row.level === 3) colorClass = "bg-green-600";
                                                if (severity === 5 && row.level === 5) colorClass = "bg-red-600 text-white";
                                                if (severity === 3 && row.level === 5) colorClass = "bg-orange-500 text-white";
                                                if (severity === 1 && row.level === 5) colorClass = "bg-yellow-400";

                                                return (
                                                    <td key={severity} className={`p-3 border text-center font-black text-sm ${colorClass}`}>
                                                        {count > 0 ? (
                                                            <span>
                                                                {count} <span className="text-[10px] opacity-80">({rec})</span>
                                                            </span>
                                                        ) : ""}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                </div>
            </main>
        </div>
    );
};

export default Glidepath;
