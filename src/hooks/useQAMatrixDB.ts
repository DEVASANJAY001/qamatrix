import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QAMatrixEntry } from "@/types/qaMatrix";
import { toast } from "@/hooks/use-toast";
import { Json } from "@/integrations/supabase/types";

function dbRowToEntry(row: any): QAMatrixEntry {
  const trim = (row.trim || {}) as any;
  const chassis = (row.chassis || {}) as any;
  const final = (row.final || {}) as any;
  const qControl = (row.q_control || {}) as any;
  const qControlDetail = (row.q_control_detail || {}) as any;
  const controlRating = (row.control_rating || {}) as any;
  const guaranteedQuality = (row.guaranteed_quality || {}) as any;
  const recordedDefect = (row.recorded_defect || {}) as any;
  const detectionFlags = (row.detection_flags || {}) as any;
  const outsideProcess = (row.outside_process || {}) as any;
  const weeklyRecurrence = (row.weekly_recurrence || [0, 0, 0, 0, 0, 0]) as number[];

  return {
    sNo: row.s_no,
    source: row.source || '',
    operationStation: row.operation_station || '',
    designation: row.designation || '',
    concern: row.concern || '',
    defectRating: (row.defect_rating || 1) as 1 | 3 | 5,
    recurrence: row.recurrence || 0,
    weeklyRecurrence,
    recurrenceCountPlusDefect: row.recurrence_count_plus_defect || 0,
    trim: {
      T10: trim.T10 ?? null, T20: trim.T20 ?? null, T30: trim.T30 ?? null,
      T40: trim.T40 ?? null, T50: trim.T50 ?? null, T60: trim.T60 ?? null,
      T70: trim.T70 ?? null, T80: trim.T80 ?? null, T90: trim.T90 ?? null,
      T100: trim.T100 ?? null, TPQG: trim.TPQG ?? null,
    },
    chassis: {
      C10: chassis.C10 ?? null, C20: chassis.C20 ?? null, C30: chassis.C30 ?? null,
      C40: chassis.C40 ?? null, C45: chassis.C45 ?? null, C50: chassis.C50 ?? null,
      C60: chassis.C60 ?? null, C70: chassis.C70 ?? null, C80: chassis.C80 ?? null,
      P10: chassis.P10 ?? null, P20: chassis.P20 ?? null, P30: chassis.P30 ?? null,
      R10: chassis.R10 ?? null, PRESS: chassis.PRESS ?? null, PQG: chassis.PQG ?? null,
    },
    final: {
      F10: final.F10 ?? null, F20: final.F20 ?? null, F30: final.F30 ?? null,
      F40: final.F40 ?? null, F50: final.F50 ?? null, F60: final.F60 ?? null,
      F70: final.F70 ?? null, F80: final.F80 ?? null, F90: final.F90 ?? null,
      F100: final.F100 ?? null, F110: final.F110 ?? null, FPQG: final.FPQG ?? null,
      TLAudit: final.TLAudit ?? null, TorqueAudit: final.TorqueAudit ?? null,
    },
    qControl: {
      freqControl_1_1: qControl.freqControl_1_1 ?? null,
      visualControl_1_2: qControl.visualControl_1_2 ?? null,
      periodicAudit_1_3: qControl.periodicAudit_1_3 ?? null,
      humanControl_1_4: qControl.humanControl_1_4 ?? null,
      saeAlert_3_1: qControl.saeAlert_3_1 ?? null,
      freqMeasure_3_2: qControl.freqMeasure_3_2 ?? null,
      manualTool_3_3: qControl.manualTool_3_3 ?? null,
      humanTracking_3_4: qControl.humanTracking_3_4 ?? null,
      autoControl_5_1: qControl.autoControl_5_1 ?? null,
      impossibility_5_2: qControl.impossibility_5_2 ?? null,
      saeProhibition_5_3: qControl.saeProhibition_5_3 ?? null,
    },
    qControlDetail: {
      CVT: qControlDetail.CVT ?? null,
      SHOWER: qControlDetail.SHOWER ?? null,
      DynamicUB: qControlDetail.DynamicUB ?? null,
      CC4: qControlDetail.CC4 ?? null,
    },
    controlRating: {
      Workstation: controlRating.Workstation ?? null,
      Zone: controlRating.Zone ?? null,
      Shop: controlRating.Shop ?? null,
      Plant: controlRating.Plant ?? null,
    },
    recordedDefect: {
      workstation: recordedDefect.workstation ?? null,
      zone: recordedDefect.zone ?? null,
      shop: recordedDefect.shop ?? null,
      customer: recordedDefect.customer ?? null,
    },
    guaranteedQuality: {
      Workstation: guaranteedQuality.Workstation ?? null,
      Zone: guaranteedQuality.Zone ?? null,
      Shop: guaranteedQuality.Shop ?? null,
      Plant: guaranteedQuality.Plant ?? null,
    },
    outsideProcess: {
      Static: outsideProcess.Static ?? null,
      WheelAlignment: outsideProcess.WheelAlignment ?? null,
      HLAssembly: outsideProcess.HLAssembly ?? null,
      DMCCABS: outsideProcess.DMCCABS ?? null,
      CC4: outsideProcess.CC4 ?? null,
      CertLine: outsideProcess.CertLine ?? null,
    },
    workstationStatus: (row.workstation_status || 'NG') as 'OK' | 'NG',
    mfgStatus: (row.mfg_status || 'NG') as 'OK' | 'NG',
    plantStatus: (row.plant_status || 'NG') as 'OK' | 'NG',
    defectCode: row.defect_code || '',
    defectLocationCode: row.defect_location_code || '',
    mfgAction: row.mfg_action || '',
    resp: row.resp || '',
    target: row.target || '',
    teamLeader: row.team_leader || '',
    implementationDate: row.implementation_date || '',
    auditDateName: row.audit_date_name || '',
    detectionFlags: {
      repairTime: detectionFlags.repairTime ?? '',
      dvmPQG: detectionFlags.dvmPQG ?? '',
      dvrDVT: detectionFlags.dvrDVT ?? '',
      productAuditSCA: detectionFlags.productAuditSCA ?? '',
      warranty: detectionFlags.warranty ?? '',
      reoccurrence: detectionFlags.reoccurrence ?? '',
    },
  };
}

function sanitizeNum(n: any): number {
  if (typeof n !== 'number') return 0;
  return isNaN(n) ? 0 : n;
}

function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const result: any = {};
  for (const key in obj) {
    const val = obj[key];
    if (typeof val === 'number') {
      result[key] = isNaN(val) ? 0 : val;
    } else if (typeof val === 'object' && val !== null) {
      result[key] = sanitizeObject(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

function entryToDbRow(entry: QAMatrixEntry) {
  return {
    s_no: sanitizeNum(entry.sNo),
    source: entry.source,
    operation_station: entry.operationStation,
    designation: entry.designation,
    concern: entry.concern,
    defect_rating: sanitizeNum(entry.defectRating) || 1,
    recurrence: sanitizeNum(entry.recurrence),
    weekly_recurrence: (entry.weeklyRecurrence || [0, 0, 0, 0, 0, 0]).map(sanitizeNum) as unknown as Json,
    recurrence_count_plus_defect: sanitizeNum(entry.recurrenceCountPlusDefect),
    trim: sanitizeObject(entry.trim) as unknown as Json,
    chassis: sanitizeObject(entry.chassis) as unknown as Json,
    final: sanitizeObject(entry.final) as unknown as Json,
    q_control: sanitizeObject(entry.qControl) as unknown as Json,
    q_control_detail: sanitizeObject(entry.qControlDetail) as unknown as Json,
    control_rating: sanitizeObject(entry.controlRating) as unknown as Json,
    guaranteed_quality: sanitizeObject(entry.guaranteedQuality) as unknown as Json,
    recorded_defect: sanitizeObject(entry.recordedDefect) as unknown as Json,
    outside_process: sanitizeObject(entry.outsideProcess) as unknown as Json,
    detection_flags: sanitizeObject(entry.detectionFlags) as unknown as Json,
    workstation_status: entry.workstationStatus,
    mfg_status: entry.mfgStatus,
    plant_status: entry.plantStatus,
    defect_code: entry.defectCode,
    defect_location_code: entry.defectLocationCode,
    mfg_action: entry.mfgAction,
    resp: entry.resp,
    target: entry.target,
    team_leader: entry.teamLeader,
    implementation_date: entry.implementationDate,
    audit_date_name: entry.auditDateName,
  };
}

export function useQAMatrixDB() {
  const [data, setData] = useState<QAMatrixEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("qa_matrix_entries")
      .select("*")
      .order("s_no", { ascending: true });
    if (error) {
      console.error("Failed to load QA matrix:", error);
      toast({ title: "Load Error", description: error.message, variant: "destructive" });
    } else {
      setData((rows || []).map(dbRowToEntry));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveEntry = useCallback(async (entry: QAMatrixEntry) => {
    const row = entryToDbRow(entry);
    const { error } = await supabase
      .from("qa_matrix_entries")
      .upsert(row, { onConflict: "s_no" });
    if (error) {
      console.error("Save error:", error);
      toast({ title: "Save Error", description: error.message, variant: "destructive" });
    }
  }, []);

  const saveMultiple = useCallback(async (entries: QAMatrixEntry[]) => {
    const rows = entries.map(entryToDbRow);
    const { error } = await supabase
      .from("qa_matrix_entries")
      .upsert(rows, { onConflict: "s_no" });
    if (error) {
      console.error("Batch save error:", error);
      toast({ title: "Save Error", description: error.message, variant: "destructive" });
    }
  }, []);

  const deleteEntry = useCallback(async (sNo: number) => {
    const { error } = await supabase
      .from("qa_matrix_entries")
      .delete()
      .eq("s_no", sNo);
    if (error) {
      console.error("Delete error:", error);
      toast({ title: "Delete Error", description: error.message, variant: "destructive" });
    }
  }, []);

  const deleteAll = useCallback(async () => {
    const { error } = await supabase
      .from("qa_matrix_entries")
      .delete()
      .neq("s_no", -9999); // delete all rows
    if (error) {
      console.error("Delete all error:", error);
      toast({ title: "Delete Error", description: error.message, variant: "destructive" });
      return false;
    }
    setData([]);
    return true;
  }, []);

  const updateData = useCallback((updater: (prev: QAMatrixEntry[]) => QAMatrixEntry[]) => {
    setData(prev => {
      const next = updater(prev);
      // Find changed entries and save them
      const changed = next.filter(n => {
        const old = prev.find(p => p.sNo === n.sNo);
        return !old || JSON.stringify(old) !== JSON.stringify(n);
      });
      if (changed.length > 0) {
        const rows = changed.map(entryToDbRow);
        supabase.from("qa_matrix_entries").upsert(rows, { onConflict: "s_no" }).then(({ error }) => {
          if (error) console.error("Auto-save error:", error);
        });
      }
      return next;
    });
  }, []);

  const saveSnapshot = useCallback(async (currentData: QAMatrixEntry[]) => {
    const { error } = await (supabase as any)
      .from("qa_matrix_snapshots")
      .upsert({
        snapshot_date: new Date().toISOString().split('T')[0],
        data: currentData as unknown as Json
      }, { onConflict: "snapshot_date" });

    if (error) {
      console.error("Snapshot save error:", error);
      toast({ title: "Snapshot Error", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Snapshot Saved", description: "Current matrix state has been archived for today." });
    return true;
  }, []);

  const getSnapshots = useCallback(async () => {
    const { data: rows, error } = await (supabase as any)
      .from("qa_matrix_snapshots")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false }) as any;

    if (error) {
      console.error("Fetch snapshots error:", error);
      return [];
    }
    return rows.map(r => r.snapshot_date);
  }, []);

  const getSnapshotData = useCallback(async (date: string) => {
    const { data: row, error } = await (supabase as any)
      .from("qa_matrix_snapshots")
      .select("data")
      .eq("snapshot_date", date)
      .single() as any;

    if (error) {
      console.error("Fetch snapshot data error:", error);
      return null;
    }
    return row.data as unknown as QAMatrixEntry[];
  }, []);

  const getSnapshotRangeData = useCallback(async (startDate: string, endDate: string) => {
    const { data: rows, error } = await (supabase as any)
      .from("qa_matrix_snapshots")
      .select("data")
      .gte("snapshot_date", startDate)
      .lte("snapshot_date", endDate)
      .order("snapshot_date", { ascending: true }) as any;

    if (error) {
      console.error("Fetch range snapshots error:", error);
      return [];
    }
    return (rows || []).map(r => r.data as unknown as QAMatrixEntry[]);
  }, []);

  return {
    data, loading, setData, updateData, fetchData,
    saveEntry, saveMultiple, deleteEntry, deleteAll,
    saveSnapshot, getSnapshots, getSnapshotData, getSnapshotRangeData
  };
}
