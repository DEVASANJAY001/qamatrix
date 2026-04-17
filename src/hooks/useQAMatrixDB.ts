import { useState, useEffect, useCallback } from "react";
import { QAMatrixEntry } from "@/types/qaMatrix";
import { toast } from "@/hooks/use-toast";

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
  let rawWeekly = row.weekly_recurrence;
  if (typeof rawWeekly === 'string') {
    try {
      if (rawWeekly.startsWith('{') && rawWeekly.endsWith('}')) {
        rawWeekly = JSON.parse('[' + rawWeekly.substring(1, rawWeekly.length - 1) + ']');
      } else {
        rawWeekly = JSON.parse(rawWeekly);
      }
    } catch (e) {
      rawWeekly = [0, 0, 0, 0, 0, 0];
    }
  }
  const weeklyRecurrence = (Array.isArray(rawWeekly) ? rawWeekly : [0, 0, 0, 0, 0, 0]) as number[];

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
    detectionDate: row.detection_date || '',
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

function entryToDbRow(entry: QAMatrixEntry) {
  return {
    s_no: sanitizeNum(entry.sNo),
    source: entry.source,
    operation_station: entry.operationStation,
    designation: entry.designation,
    concern: entry.concern,
    defect_rating: sanitizeNum(entry.defectRating) || 1,
    recurrence: sanitizeNum(entry.recurrence),
    weekly_recurrence: (entry.weeklyRecurrence || [0, 0, 0, 0, 0, 0]).map(sanitizeNum),
    recurrence_count_plus_defect: sanitizeNum(entry.recurrenceCountPlusDefect),
    trim: entry.trim,
    chassis: entry.chassis,
    final: entry.final,
    q_control: entry.qControl,
    q_control_detail: entry.qControlDetail,
    control_rating: entry.controlRating,
    guaranteed_quality: entry.guaranteedQuality,
    recorded_defect: entry.recordedDefect,
    outside_process: entry.outsideProcess,
    detection_flags: entry.detectionFlags,
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
    detection_date: entry.detectionDate,
  };
}

export function useQAMatrixDB() {
  const [data, setData] = useState<QAMatrixEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/qa-matrix');
      const contentType = response.headers.get('content-type');
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status} ${response.statusText}`);
      }

      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON but got ${contentType}. Server might be restarting. Response: ${text.substring(0, 50)}...`);
      }

      const rows = await response.json();
      console.log(`Fetched ${rows.length} rows from API`);
      const mapped = (rows || []).map((row: any, idx: number) => {
        try {
          return dbRowToEntry(row);
        } catch (e) {
          console.error(`Error mapping row at index ${idx}:`, e, row);
          return null;
        }
      }).filter(Boolean) as QAMatrixEntry[];
      
      console.log(`Successfully mapped ${mapped.length} entries`);
      setData(mapped);
    } catch (error: any) {
      console.error("Failed to load QA matrix:", error);
      toast({ title: "Load Error", description: error.message, variant: "destructive" });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);


  const saveEntry = useCallback(async (entry: QAMatrixEntry) => {
    try {
      const row = entryToDbRow(entry);
      const response = await fetch('/api/qa-matrix/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Save failed");
    } catch (error: any) {
      console.error("Save error:", error);
      toast({ title: "Save Error", description: error.message, variant: "destructive" });
    }
  }, []);

  const saveMultiple = useCallback(async (entries: QAMatrixEntry[]) => {
    try {
      const rows = entries.map(entryToDbRow);
      const response = await fetch('/api/qa-matrix/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Batch save failed");
    } catch (error: any) {
      console.error("Batch save error:", error);
      toast({ title: "Save Error", description: error.message, variant: "destructive" });
    }
  }, []);

  const deleteEntry = useCallback(async (sNo: number) => {
    try {
      const response = await fetch(`/api/qa-matrix/${sNo}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Delete failed");
    } catch (error: any) {
      console.error("Delete error:", error);
      toast({ title: "Delete Error", description: error.message, variant: "destructive" });
    }
  }, []);

  const deleteAll = useCallback(async () => {
    try {
      const response = await fetch('/api/qa-matrix', { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Delete all failed");
      setData([]);
      return true;
    } catch (error: any) {
      console.error("Delete all error:", error);
      toast({ title: "Delete Error", description: error.message, variant: "destructive" });
      return false;
    }
  }, []);

  const updateData = useCallback((updater: (prev: QAMatrixEntry[]) => QAMatrixEntry[]) => {
    setData(prev => {
      const next = updater(prev);
      const changed = next.filter(n => {
        const old = prev.find(p => p.sNo === n.sNo);
        return !old || JSON.stringify(old) !== JSON.stringify(n);
      });
      if (changed.length > 0) {
        saveMultiple(changed);
      }
      return next;
    });
  }, [saveMultiple]);

  const saveSnapshot = useCallback(async (currentData: QAMatrixEntry[]) => {
    try {
      const response = await fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot_date: new Date().toISOString().split('T')[0],
          data: currentData
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Snapshot save failed");
      toast({ title: "Snapshot Saved", description: "Current matrix state has been archived for today." });
      return true;
    } catch (error: any) {
      console.error("Snapshot save error:", error);
      toast({ title: "Snapshot Error", description: error.message, variant: "destructive" });
      return false;
    }
  }, []);

  const getSnapshots = useCallback(async () => {
    try {
      const response = await fetch('/api/snapshots');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Fetch snapshots failed");
      return data;
    } catch (error: any) {
      console.error("Fetch snapshots error:", error);
      return [];
    }
  }, []);

  const getSnapshotData = useCallback(async (date: string) => {
    try {
      const response = await fetch(`/api/snapshots/${date}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Fetch snapshot data failed");
      return data;
    } catch (error: any) {
      console.error("Fetch snapshot data error:", error);
      return null;
    }
  }, []);

  return {
    data, loading, setData, updateData, fetchData,
    saveEntry, saveMultiple, deleteEntry, deleteAll,
    saveSnapshot, getSnapshots, getSnapshotData
  };
}
