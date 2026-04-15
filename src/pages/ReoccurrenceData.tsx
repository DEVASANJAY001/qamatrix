import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQAMatrixDB } from "@/hooks/useQAMatrixDB";
import QAMatrixTable from "@/components/QAMatrixTable";
import Footer from "@/components/Footer";
import { QAMatrixEntry } from "@/types/qaMatrix";
import { Shield, ArrowLeft, Loader2, History, Search, Filter, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

import { useIsMobile } from "@/hooks/use-mobile";

const ReoccurrenceData = () => {
    const isMobile = useIsMobile();
    const { getSnapshots, getSnapshotRangeData } = useQAMatrixDB();
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: new Date(),
        to: new Date(),
    });
    const [historicalData, setHistoricalData] = useState<QAMatrixEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const loadDates = async () => {
            setLoading(true);
            const dates = await getSnapshots();
            setAvailableDates(dates);
            if (dates.length > 0) {
                const latestDate = new Date(dates[0]);
                setDateRange({ from: latestDate, to: latestDate });
            }
            setLoading(false);
        };
        loadDates();
    }, [getSnapshots]);

    const mergeSnapshotData = (snapshotLists: QAMatrixEntry[][]): QAMatrixEntry[] => {
        if (snapshotLists.length === 0) return [];
        if (snapshotLists.length === 1) return snapshotLists[0];

        const mergedMap = new Map<number, QAMatrixEntry>();

        snapshotLists.forEach((list, listIdx) => {
            const isLatestList = listIdx === snapshotLists.length - 1;

            list.forEach(entry => {
                const existing = mergedMap.get(entry.sNo);
                if (!existing) {
                    mergedMap.set(entry.sNo, { ...entry });
                } else {
                    existing.recurrence += entry.recurrence;
                    if (entry.weeklyRecurrence && existing.weeklyRecurrence) {
                        existing.weeklyRecurrence = existing.weeklyRecurrence.map((v, i) => v + (entry.weeklyRecurrence[i] || 0));
                    }

                    if (isLatestList) {
                        Object.assign(existing, {
                            ...entry,
                            recurrence: existing.recurrence,
                            weeklyRecurrence: existing.weeklyRecurrence
                        });
                    }
                }
            });
        });

        return Array.from(mergedMap.values());
    };

    useEffect(() => {
        const loadRangeData = async () => {
            if (!dateRange?.from) return;
            setDataLoading(true);

            const start = format(dateRange.from, "yyyy-MM-dd");
            const end = dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : start;

            const rawSnapshots = await getSnapshotRangeData(start, end);
            const merged = mergeSnapshotData(rawSnapshots);
            setHistoricalData(merged);

            setDataLoading(false);
        };
        loadRangeData();
    }, [dateRange, getSnapshotRangeData]);

    const filteredData = useMemo(() => {
        if (!searchTerm) return historicalData;
        const term = searchTerm.toLowerCase();
        return historicalData.filter(d =>
            d.concern.toLowerCase().includes(term) ||
            d.operationStation.toLowerCase().includes(term) ||
            d.sNo.toString().includes(term)
        );
    }, [historicalData, searchTerm]);

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-20">
                <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center gap-3">
                    <Link to="/">
                        <Button variant="ghost" size="sm" className="gap-1 px-2 shrink-0">
                            <ArrowLeft className="w-4 h-4" />
                            <span className="hidden xs:inline">Back</span>
                        </Button>
                    </Link>
                    <div className="w-[1px] h-6 bg-border mx-1 shrink-0" />
                    <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                        <History className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-sm md:text-lg font-bold tracking-tight truncate">Matrix History</h1>
                        <p className="text-[10px] text-muted-foreground truncate hidden sm:block">Historical records of Daily QA Matrix Status</p>
                    </div>
                </div>
            </header>

            <main className="w-full mx-auto px-4 py-6 md:py-8">
                <div className="space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4 bg-card border border-border rounded-xl p-4 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                            <div className="flex items-center gap-2 shrink-0">
                                <CalendarIcon className="w-4 h-4 text-primary" />
                                <span className="text-sm font-semibold whitespace-nowrap">Period Select:</span>
                            </div>

                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="date"
                                        variant={"outline"}
                                        className={cn(
                                            "w-full sm:w-[300px] justify-start text-left font-normal",
                                            !dateRange && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateRange?.from ? (
                                            dateRange.to ? (
                                                <>
                                                    {format(dateRange.from, "LLL dd, y")} -{" "}
                                                    {format(dateRange.to, "LLL dd, y")}
                                                </>
                                            ) : (
                                                format(dateRange.from, "LLL dd, y")
                                            )
                                        ) : (
                                            <span>Pick a date</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 z-[200]" align="start">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={dateRange?.from}
                                        selected={dateRange}
                                        onSelect={setDateRange}
                                        numberOfMonths={isMobile ? 1 : 2}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="h-8 w-[1px] bg-border mx-2 hidden lg:block" />

                        <div className="flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-lg px-4 py-1.5 w-full lg:w-auto">
                            <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Read-Only</span>
                                <span className="text-[10px] text-muted-foreground hidden xs:inline">| Historical records</span>
                            </div>
                        </div>

                        {loading && (
                            <div className="ml-auto">
                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            </div>
                        )}
                    </div>

                    <div className="space-y-6 min-w-0">
                        <div className="bg-card border border-border rounded-xl p-6 shadow-sm min-h-[600px] flex flex-col">
                            {historicalData.length === 0 && !loading && !dataLoading ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-4">
                                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                                        <History className="w-8 h-8 opacity-20" />
                                    </div>
                                    <p className="text-sm">No historical snapshots found for this period.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                        <div>
                                            <h2 className="text-xl font-bold tracking-tight">
                                                Matrix Status: {dateRange?.from ? (
                                                    dateRange.to ? `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}` : format(dateRange.from, "MMMM d, yyyy")
                                                ) : "Loading..."}
                                            </h2>
                                            <span className="text-xs text-muted-foreground mt-1 block">
                                                {dataLoading ? "Updating table data..." : `Showing ${historicalData.length} records. Recurrence values are SUMMED over this period.`}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="relative w-full md:w-64">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                <input
                                                    type="text"
                                                    placeholder="Search in history..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="w-full pl-9 pr-3 py-2 text-xs border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                                                />
                                            </div>
                                            <Button variant="outline" size="sm" className="gap-2 h-9">
                                                <Filter className="w-3.5 h-3.5" />
                                                Sort
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-hidden">
                                        {dataLoading ? (
                                            <div className="h-full flex items-center justify-center py-20">
                                                <Loader2 className="w-8 h-8 animate-spin text-primary/30" />
                                            </div>
                                        ) : (
                                            <QAMatrixTable
                                                data={filteredData}
                                                readOnly={true}
                                                filter={null}
                                                onClearFilter={() => { }}
                                                onWeeklyUpdate={() => { }}
                                                onScoreUpdate={() => { }}
                                                onFieldUpdate={() => { }}
                                                onDeleteEntry={() => { }}
                                                onRatingUpdate={() => { }}
                                            />
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default ReoccurrenceData;
