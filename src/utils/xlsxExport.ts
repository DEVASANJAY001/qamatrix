import * as XLSX from "xlsx";
import { QAMatrixEntry } from "@/types/qaMatrix";

const headers = [
  "S.No", "ER", "Station No.", "Zone/Team", "Team Leader", "Failure Mode", "Repair Time",
  // Detection 24H
  "DVM/PQG (Y/N)", "DVR/DVT (Y/N)", "Product Audit SCA (Y/N)", "WARRANTY", "Defect Rating", "Reoccurrence Broken Clean Point",
  // Detection 48H / TRIM
  "T10", "T20", "T30", "T40", "T50", "T60", "T70", "T80", "T90", "T100", "TPQG",
  // Detection 48H / CHASSIS
  "C10", "C20", "C30", "C40", "C45", "C50", "C60", "C70", "C80", "P10", "P20", "P30", "R10", "PRESS", "PQG",
  // Detection 48H / FINAL
  "F10", "F20", "F30", "F40", "F50", "F60", "F70", "F80", "F90", "F100", "F110", "FPQG",
  // Outside Process Area
  "Team Leader Audit", "Torque Audit", "Static", "Wheel Alignment", "HL Aiming/ ABS", "Dynamic/ UB", "CC4", "Cert Line",
  // Implementation
  "Impl. Date", "Audit Date & Name",
  // Control Rating
  "Control Rating Workstation", "Control Rating Zone", "Control Rating Shop", "Control Rating Plant",
  // Recorded Defect
  "Escaping Workstation 1M", "Escaping Zone 3M", "Escaping Shop 3M", "CUSTOMER 6M",
  // Guaranteed Quality
  "Guaranteed Quality Workstation", "Guaranteed Quality Zone", "Guaranteed Quality Shop", "Guaranteed Quality Plant",
  // Actions summary
  "MFG Action", "Resp", "Target"
];

export function exportToXLSX(data: QAMatrixEntry[], filename = "qa-matrix-export.xlsx") {
  const rows = data.map(d => [
    d.sNo,
    d.source,
    d.operationStation,
    d.designation,
    d.teamLeader ?? d.resp,
    d.concern,
    d.detectionFlags?.repairTime ?? "",
    d.detectionFlags?.dvmPQG ?? "",
    d.detectionFlags?.dvrDVT ?? "",
    d.detectionFlags?.productAuditSCA ?? "",
    d.detectionFlags?.warranty ?? "",
    d.defectRating,
    d.detectionFlags?.reoccurrence ?? "",
    // Trim
    d.trim.T10, d.trim.T20, d.trim.T30, d.trim.T40, d.trim.T50, d.trim.T60, d.trim.T70, d.trim.T80, d.trim.T90, d.trim.T100, d.trim.TPQG,
    // Chassis
    d.chassis.C10, d.chassis.C20, d.chassis.C30, d.chassis.C40, d.chassis.C45, d.chassis.C50, d.chassis.C60, d.chassis.C70, d.chassis.C80, d.chassis.P10, d.chassis.P20, d.chassis.P30, d.chassis.R10, d.chassis.PRESS, d.chassis.PQG,
    // Final
    d.final.F10, d.final.F20, d.final.F30, d.final.F40, d.final.F50, d.final.F60, d.final.F70, d.final.F80, d.final.F90, d.final.F100, d.final.F110, d.final.FPQG,
    // Outside
    d.final.TLAudit, d.final.TorqueAudit,
    d.outsideProcess?.Static ?? "", d.outsideProcess?.WheelAlignment ?? "",
    d.outsideProcess?.HLAssembly ?? "", d.outsideProcess?.DMCCABS ?? "",
    d.outsideProcess?.CC4 ?? "", d.outsideProcess?.CertLine ?? "",
    // Impl
    d.implementationDate ?? "", d.auditDateName ?? "",
    // Control Rating
    d.controlRating.Workstation, d.controlRating.Zone, d.controlRating.Shop, d.controlRating.Plant,
    // Recorded Defect
    d.recordedDefect?.workstation ?? "", d.recordedDefect?.zone ?? "", d.recordedDefect?.shop ?? "", d.recordedDefect?.customer ?? "",
    // Guaranteed Quality
    d.guaranteedQuality.Workstation, d.guaranteedQuality.Zone, d.guaranteedQuality.Shop, d.guaranteedQuality.Plant,
    // Actions
    d.mfgAction, d.resp, d.target,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "QA Matrix");
  XLSX.writeFile(wb, filename);
}
