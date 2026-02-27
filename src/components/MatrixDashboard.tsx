import { useState, useMemo, useCallback } from "react";
import { QAMatrixEntry } from "@/types/qaMatrix";
import { X, Filter, ChevronDown } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  Tooltip,
} from "recharts";

interface MatrixDashboardProps {
  data: QAMatrixEntry[];
  onFilterByCategory: (filterType: string, filterValue: string) => void;
}

interface DrillDownData {
  title: string;
  entries: QAMatrixEntry[];
}

type DonutItem = { label: string; ok: number; ng: number; total: number; filterType: string; filterValue: string };

const OK_COLOR = "hsl(142, 71%, 35%)";
const NG_COLOR = "hsl(0, 72%, 51%)";

// ─── Mini Donut ─────────────────────────────────────────────
const MiniDonut = ({
  item,
  onClickSegment,
}: {
  item: DonutItem;
  onClickSegment: (type: "ok" | "ng", item: DonutItem) => void;
}) => {
  const pct = item.total > 0 ? Math.round((item.ok / item.total) * 100) : 0;
  const chartData = [
    { name: "OK", value: item.ok },
    { name: "NG", value: item.ng },
  ];

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-[110px] h-[110px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={32}
              outerRadius={48}
              dataKey="value"
              strokeWidth={2}
              stroke="hsl(var(--background))"
              onClick={(_, idx) => onClickSegment(idx === 0 ? "ok" : "ng", item)}
              className="cursor-pointer outline-none"
            >
              <Cell fill={OK_COLOR} />
              <Cell fill={NG_COLOR} />
            </Pie>
            <Tooltip
              content={({ payload }) => {
                if (!payload?.length) return null;
                const p = payload[0];
                return (
                  <div className="rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-md">
                    <span className="font-semibold">{p.name}:</span> {p.value}
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-lg font-bold tabular-nums">{pct}%</span>
        </div>
      </div>
      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">{item.label}</span>
      <span className="text-[10px] text-muted-foreground tabular-nums">{item.ok} OK · {item.ng} NG</span>
    </div>
  );
};

// ─── Matrix Table (factory-board style) ─────────────────────
const MatrixTable = ({
  sectionTitle,
  sectionColor,
  rows,
  onCellClick,
}: {
  sectionTitle: string;
  sectionColor: string;
  rows: DonutItem[];
  onCellClick: (label: string, type: "total" | "ok" | "ng", entries: QAMatrixEntry[]) => void;
}) => (
  <div className="rounded-lg overflow-hidden border border-foreground/10 bg-zinc-950 text-white">
    {/* Header */}
    <div className="grid grid-cols-4 text-center font-bold text-xs">
      <div className="bg-zinc-800 p-2.5 text-left uppercase tracking-wider text-zinc-400">Category</div>
      <div className="bg-blue-700 p-2.5">TOTAL</div>
      <div className="bg-green-700 p-2.5">OK</div>
      <div className="bg-red-700 p-2.5">NG</div>
    </div>
    {/* Section label */}
    <div className={`${sectionColor} px-4 py-1 text-[11px] font-bold uppercase tracking-widest text-white/90`}>
      {sectionTitle}
    </div>
    {/* Rows */}
    {rows.map((row, ri) => (
      <div
        key={row.label}
        className={`grid grid-cols-4 text-center border-b border-zinc-800/60 ${ri % 2 === 0 ? "bg-zinc-900" : "bg-zinc-950"}`}
      >
        <div className="p-2.5 text-left font-bold text-sm text-zinc-200">{row.label}</div>
        <div
          className="p-2.5 font-mono text-base font-bold text-zinc-300 cursor-pointer hover:bg-zinc-700/40 transition-colors"
          onClick={() => onCellClick(row.label, "total", [])}
        >
          {row.total}
        </div>
        <div
          className="p-2.5 font-mono text-base font-bold text-green-400 cursor-pointer hover:bg-green-900/40 transition-colors"
          onClick={() => onCellClick(row.label, "ok", [])}
        >
          {row.ok}
        </div>
        <div
          className="p-2.5 font-mono text-base font-bold text-red-400 cursor-pointer hover:bg-red-900/40 transition-colors"
          onClick={() => onCellClick(row.label, "ng", [])}
        >
          {row.ng}
        </div>
      </div>
    ))}
  </div>
);

// ─── Section Panel (donuts centered top, matrix table below) ─
const SectionPanel = ({
  title,
  sectionColor,
  donuts,
  onDonutClick,
  onMatrixCellClick,
}: {
  title: string;
  sectionColor: string;
  donuts: DonutItem[];
  onDonutClick: (type: "ok" | "ng", item: DonutItem) => void;
  onMatrixCellClick: (label: string, type: "total" | "ok" | "ng") => void;
}) => (
  <div className="flex flex-col gap-4">
    {/* Top: Donuts centered */}
    <div className="flex flex-wrap justify-center gap-6 p-4 rounded-lg border border-border bg-card">
      {donuts.map((d) => (
        <MiniDonut key={d.label} item={d} onClickSegment={onDonutClick} />
      ))}
    </div>

    {/* Bottom: Matrix Table */}
    <MatrixTable
      sectionTitle={title}
      sectionColor={sectionColor}
      rows={donuts}
      onCellClick={(label, type) => onMatrixCellClick(label, type)}
    />
  </div>
);

// ─── Filters ────────────────────────────────────────────────
interface Filters {
  status: string;
  area: string;
  source: string;
  result: string;
}

const EMPTY_FILTERS: Filters = { status: "", area: "", source: "", result: "" };

const FilterSelect = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring w-full"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
    </div>
  </div>
);

const SECTION_TABS = ["STATUS", "AREA", "SOURCE"] as const;
type SectionTab = typeof SECTION_TABS[number];

// ─── Main Component ─────────────────────────────────────────
const MatrixDashboard = ({ data, onFilterByCategory }: MatrixDashboardProps) => {
  const [activeSection, setActiveSection] = useState<SectionTab>("STATUS");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [drillDown, setDrillDown] = useState<DrillDownData | null>(null);

  const hasFilters = filters.status || filters.area || filters.source || filters.result;

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const updateFilter = useCallback((key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Centralized filtered dataset
  const filtered = useMemo(() => {
    let result = data;
    if (filters.area) result = result.filter((d) => d.designation.toUpperCase() === filters.area);
    if (filters.source) result = result.filter((d) => d.source.toUpperCase() === filters.source);
    if (filters.result === "OK") result = result.filter((d) => d.plantStatus === "OK");
    if (filters.result === "NG") result = result.filter((d) => d.plantStatus === "NG");
    // Status filter narrows to entries where that specific status is OK or NG based on result
    // But status filter alone just highlights; we keep all data visible
    return result;
  }, [data, filters]);

  // Helpers
  const mkDonut = useCallback(
    (label: string, items: QAMatrixEntry[], okFn: (d: QAMatrixEntry) => boolean, filterType: string, filterValue: string): DonutItem => {
      const ok = items.filter(okFn).length;
      return { label, ok, ng: items.length - ok, total: items.length, filterType, filterValue };
    },
    []
  );

  // Build section data
  const { statusDonuts, statusBar, areaDonuts, areaBar, sourceDonuts, sourceBar } = useMemo(() => {
    const d = filtered;

    const statusDonuts: DonutItem[] = [
      mkDonut("WS", d, (e) => e.workstationStatus === "OK", "status", "WS"),
      mkDonut("MFG", d, (e) => e.mfgStatus === "OK", "status", "MFG"),
      mkDonut("PLANT", d, (e) => e.plantStatus === "OK", "status", "PLANT"),
    ];
    const statusBar = statusDonuts.map((s) => ({ name: s.label, OK: s.ok, NG: s.ng }));

    const areas = ["TRIM", "CHASSIS", "FINAL"] as const;
    const areaDonuts: DonutItem[] = areas.map((a) => {
      const items = d.filter((e) => e.designation.toUpperCase() === a);
      return mkDonut(a, items, (e) => e.plantStatus === "OK", "area", a);
    });
    const areaBar = areaDonuts.map((s) => ({ name: s.label, OK: s.ok, NG: s.ng }));

    const sources = ["DVX", "SCA", "ER3", "ER4", "FIELD"] as const;
    const sourceDonuts: DonutItem[] = sources.map((s) => {
      const items = d.filter((e) => e.source.toUpperCase() === s);
      return mkDonut(s, items, (e) => e.plantStatus === "OK", "source", s);
    });
    const sourceBar = sourceDonuts.map((s) => ({ name: s.label, OK: s.ok, NG: s.ng }));

    return { statusDonuts, statusBar, areaDonuts, areaBar, sourceDonuts, sourceBar };
  }, [filtered, mkDonut]);

  // Totals
  const totalOk = filtered.filter((d) => d.plantStatus === "OK").length;
  const totalNg = filtered.length - totalOk;

  // Drill-down handlers
  const handleDonutClick = useCallback(
    (type: "ok" | "ng", item: DonutItem) => {
      // Apply filter chips
      if (item.filterType === "status") updateFilter("status", item.filterValue);
      else if (item.filterType === "area") updateFilter("area", item.filterValue);
      else if (item.filterType === "source") updateFilter("source", item.filterValue);
      updateFilter("result", type === "ok" ? "OK" : "NG");

      // Also open drill-down modal immediately with computed entries
      const d = filtered;
      let entries: QAMatrixEntry[] = [];

      if (item.filterType === "status") {
        const okFn = (e: QAMatrixEntry) =>
          item.filterValue === "WS" ? e.workstationStatus === "OK" :
            item.filterValue === "MFG" ? e.mfgStatus === "OK" :
              e.plantStatus === "OK";
        entries = type === "ok" ? d.filter(okFn) : d.filter((e) => !okFn(e));
      } else if (item.filterType === "area") {
        const areaEntries = d.filter((e) => e.designation.toUpperCase() === item.filterValue);
        entries = type === "ok"
          ? areaEntries.filter((e) => e.plantStatus === "OK")
          : areaEntries.filter((e) => e.plantStatus === "NG");
      } else {
        const srcEntries = d.filter((e) => e.source.toUpperCase() === item.filterValue);
        entries = type === "ok"
          ? srcEntries.filter((e) => e.plantStatus === "OK")
          : srcEntries.filter((e) => e.plantStatus === "NG");
      }

      const title = `${item.filterValue} — ${type.toUpperCase()}`;
      if (entries.length > 0) setDrillDown({ title: `${title} (${entries.length})`, entries });
    },
    [updateFilter, filtered]
  );

  const handleDrillOpen = useCallback(
    (title: string, entries: QAMatrixEntry[]) => {
      if (entries.length === 0) return;
      setDrillDown({ title: `${title} (${entries.length})`, entries });
    },
    []
  );

  // Matrix cell click → drill-down with extracted data
  const handleMatrixCellClick = useCallback(
    (sectionType: "status" | "area" | "source", label: string, cellType: "total" | "ok" | "ng") => {
      let entries: QAMatrixEntry[] = [];
      const d = filtered;

      if (sectionType === "status") {
        const okFn = (e: QAMatrixEntry) =>
          label === "WS" ? e.workstationStatus === "OK" :
            label === "MFG" ? e.mfgStatus === "OK" :
              e.plantStatus === "OK";
        if (cellType === "total") entries = d;
        else if (cellType === "ok") entries = d.filter(okFn);
        else entries = d.filter((e) => !okFn(e));
      } else if (sectionType === "area") {
        const areaEntries = d.filter((e) => e.designation.toUpperCase() === label);
        if (cellType === "total") entries = areaEntries;
        else if (cellType === "ok") entries = areaEntries.filter((e) => e.plantStatus === "OK");
        else entries = areaEntries.filter((e) => e.plantStatus === "NG");
      } else {
        const srcEntries = d.filter((e) => e.source.toUpperCase() === label);
        if (cellType === "total") entries = srcEntries;
        else if (cellType === "ok") entries = srcEntries.filter((e) => e.plantStatus === "OK");
        else entries = srcEntries.filter((e) => e.plantStatus === "NG");
      }

      const suffix = cellType === "total" ? label : `${label} — ${cellType.toUpperCase()}`;
      handleDrillOpen(suffix, entries);
    },
    [filtered, handleDrillOpen]
  );

  return (
    <div className="space-y-4">
      {/* ─── Filter Bar ──────────────────────────────────── */}
      <div className="dashboard-card">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Dashboard Filters</span>
          {hasFilters && (
            <button onClick={clearFilters} className="ml-auto text-xs text-destructive hover:underline flex items-center gap-1">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FilterSelect label="Status" value={filters.status} options={["WS", "MFG", "PLANT"]} onChange={(v) => updateFilter("status", v)} />
          <FilterSelect label="Area" value={filters.area} options={["TRIM", "CHASSIS", "FINAL"]} onChange={(v) => updateFilter("area", v)} />
          <FilterSelect label="Source" value={filters.source} options={["DVX", "SCA", "ER3", "ER4", "FIELD"]} onChange={(v) => updateFilter("source", v)} />
          <FilterSelect label="Result" value={filters.result} options={["OK", "NG"]} onChange={(v) => updateFilter("result", v)} />
        </div>
        {hasFilters && (
          <p className="text-[10px] text-muted-foreground mt-2">
            Showing {filtered.length} of {data.length} concerns · {totalOk} OK · {totalNg} NG
          </p>
        )}
      </div>

      {/* ─── Summary Cards ───────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="dashboard-card text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total</p>
          <p className="text-3xl font-bold tabular-nums">{filtered.length}</p>
        </div>
        <div className="dashboard-card text-center">
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: OK_COLOR }}>OK</p>
          <p className="text-3xl font-bold tabular-nums" style={{ color: OK_COLOR }}>{totalOk}</p>
        </div>
        <div className="dashboard-card text-center">
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: NG_COLOR }}>NG</p>
          <p className="text-3xl font-bold tabular-nums" style={{ color: NG_COLOR }}>{totalNg}</p>
        </div>
      </div>

      {/* ─── Tabbed Section Layout ───────────────────────── */}
      <div className="dashboard-card">
        {/* Section tabs */}
        <div className="flex gap-1 mb-4 bg-muted rounded-lg p-0.5 w-fit">
          {SECTION_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSection(tab)}
              className={`px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${activeSection === tab
                ? "bg-card shadow text-primary"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Active section content */}
        {activeSection === "STATUS" && (
          <SectionPanel
            title="Status"
            sectionColor="bg-blue-600"
            donuts={statusDonuts}
            onDonutClick={handleDonutClick}
            onMatrixCellClick={(label, type) => handleMatrixCellClick("status", label, type)}
          />
        )}
        {activeSection === "AREA" && (
          <SectionPanel
            title="Area"
            sectionColor="bg-green-600"
            donuts={areaDonuts}
            onDonutClick={handleDonutClick}
            onMatrixCellClick={(label, type) => handleMatrixCellClick("area", label, type)}
          />
        )}
        {activeSection === "SOURCE" && (
          <SectionPanel
            title="Source"
            sectionColor="bg-amber-600"
            donuts={sourceDonuts}
            onDonutClick={handleDonutClick}
            onMatrixCellClick={(label, type) => handleMatrixCellClick("source", label, type)}
          />
        )}
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Click any count or donut segment to drill down · Click "Clear" to reset filters
      </p>

      {/* ─── Drill-down Modal ────────────────────────────── */}
      {drillDown && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setDrillDown(null)}>
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-sm font-bold">{drillDown.title}</h3>
              <button onClick={() => setDrillDown(null)} className="p-1 rounded hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left p-2">S.No</th>
                    <th className="text-left p-2">Station</th>
                    <th className="text-left p-2">Concern</th>
                    <th className="text-left p-2">Source</th>
                    <th className="text-center p-2">Rating</th>
                    <th className="text-center p-2">WS</th>
                    <th className="text-center p-2">MFG</th>
                    <th className="text-center p-2">Plant</th>
                    <th className="text-center p-2">Recurrence</th>
                  </tr>
                </thead>
                <tbody>
                  {drillDown.entries.map((e) => (
                    <tr key={e.sNo} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="p-2 font-mono">{e.sNo}</td>
                      <td className="p-2">{e.operationStation}</td>
                      <td className="p-2 max-w-[250px] truncate" title={e.concern}>{e.concern}</td>
                      <td className="p-2">{e.source}</td>
                      <td className="p-2 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${e.defectRating === 5 ? "bg-destructive/20 text-destructive" :
                          e.defectRating === 3 ? "bg-[hsl(var(--chart-4))]/20 text-[hsl(var(--chart-4))]" :
                            "bg-[hsl(var(--chart-2))]/20 text-[hsl(var(--chart-2))]"
                          }`}>{e.defectRating}</span>
                      </td>
                      <td className={`p-2 text-center font-bold ${e.workstationStatus === "NG" ? "text-destructive" : "text-[hsl(var(--chart-2))]"}`}>{e.workstationStatus}</td>
                      <td className={`p-2 text-center font-bold ${e.mfgStatus === "NG" ? "text-destructive" : "text-[hsl(var(--chart-2))]"}`}>{e.mfgStatus}</td>
                      <td className={`p-2 text-center font-bold ${e.plantStatus === "NG" ? "text-destructive" : "text-[hsl(var(--chart-2))]"}`}>{e.plantStatus}</td>
                      <td className="p-2 text-center font-mono">{e.recurrence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatrixDashboard;
