import { QAMatrixEntry } from "@/types/qaMatrix";

const trimKeys = ["T10", "T20", "T30", "T40", "T50", "T60", "T70", "T80", "T90", "T100", "TPQG"] as const;
const chassisKeys = ["C10", "C20", "C30", "C40", "C45", "C50", "C60", "C70", "C80", "P10", "P20", "P30", "R10", "PRESS", "PQG"] as const;
const finalKeys = ["F10", "F20", "F30", "F40", "F50", "F60", "F70", "F80", "F90", "F100", "F110", "FPQG", "TLAudit", "TorqueAudit"] as const;
const qControlKeys = ["freqControl_1_1", "visualControl_1_2", "periodicAudit_1_3", "humanControl_1_4", "saeAlert_3_1", "freqMeasure_3_2", "manualTool_3_3", "humanTracking_3_4", "autoControl_5_1", "impossibility_5_2", "saeProhibition_5_3"] as const;

export function exportToCSV(data: QAMatrixEntry[], filename = "qa-matrix-export.csv") {
  const headers = [
    "S.No", "ER", "Station No.", "Zone/Team", "Team Leader", "Failure Mode", "Repair Time",
    // Detection 24H
    "DVM/PQG (Y/N)", "DVR/DVT (Y/N)", "Product Audit SCA (Y/N)", "WARRANTY", "Defect Rating", "Reoccurrence Broken Clean Point",
    ...trimKeys,
    ...chassisKeys,
    ...finalKeys.slice(0, 12), // F10 to FPQG
    // Outside
    "Team Leader Audit", "Torque Audit", "Static", "Wheel Alignment", "HL Aiming/ ABS", "Dynamic/ UB", "CC4", "Cert Line",
    // Implementation
    "Impl. Date", "Audit Date & Name",
    // Control Rating
    "Control Rating Workstation", "Control Rating Zone", "Control Rating Shop", "Control Rating Plant",
    // Recorded Defect
    "Escaping Workstation 1M", "Escaping Zone 3M", "Escaping Shop 3M", "CUSTOMER 6M",
    // Guaranteed Quality
    "Guaranteed Quality Workstation", "Guaranteed Quality Zone", "Guaranteed Quality Shop", "Guaranteed Quality Plant",
    // Actions
    "MFG Action", "Resp", "Target"
  ];

  const rows = data.map(d => [
    d.sNo,
    d.source,
    d.operationStation,
    d.designation,
    d.teamLeader ?? d.resp,
    `"${d.concern.replace(/"/g, '""')}"`,
    d.detectionFlags?.repairTime ?? "",
    d.detectionFlags?.dvmPQG ?? "",
    d.detectionFlags?.dvrDVT ?? "",
    d.detectionFlags?.productAuditSCA ?? "",
    d.detectionFlags?.warranty ?? "",
    d.defectRating,
    d.detectionFlags?.reoccurrence ?? "",
    ...trimKeys.map(k => d.trim[k] ?? ""),
    ...chassisKeys.map(k => d.chassis[k] ?? ""),
    ...finalKeys.slice(0, 12).map(k => d.final[k] ?? ""),
    // Outside
    d.final.TLAudit ?? "",
    d.final.TorqueAudit ?? "",
    d.outsideProcess?.Static ?? "",
    d.outsideProcess?.WheelAlignment ?? "",
    d.outsideProcess?.HLAssembly ?? "",
    d.outsideProcess?.DMCCABS ?? "",
    d.outsideProcess?.CC4 ?? "",
    d.outsideProcess?.CertLine ?? "",
    // Impl
    d.implementationDate ?? "",
    d.auditDateName ?? "",
    // Control Rating
    d.controlRating.Workstation,
    d.controlRating.Zone,
    d.controlRating.Shop,
    d.controlRating.Plant,
    // Recorded Defect
    d.recordedDefect?.workstation ?? "",
    d.recordedDefect?.zone ?? "",
    d.recordedDefect?.shop ?? "",
    d.recordedDefect?.customer ?? "",
    // Guaranteed Quality
    d.guaranteedQuality.Workstation,
    d.guaranteedQuality.Zone,
    d.guaranteedQuality.Shop,
    d.guaranteedQuality.Plant,
    // Actions
    `"${(d.mfgAction || "").replace(/"/g, '""')}"`,
    d.resp,
    d.target
  ]);

  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
