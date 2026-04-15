import * as XLSX from "xlsx";
import { QAMatrixEntry } from "@/types/qaMatrix";
import { recalculateStatuses } from "@/utils/qaCalculations";

function numOrNull(val: unknown): number | null {
  if (val === undefined || val === null || val === "" || val === " ") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function str(val: unknown): string {
  if (val === undefined || val === null) return "";
  return String(val).trim();
}

export async function loadFromExcel(url: string): Promise<QAMatrixEntry[]> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  let startIdx = 0;
  for (let i = 0; i < rows.length; i++) {
    const firstCell = rows[i]?.[0];
    if (typeof firstCell === "number" || (typeof firstCell === "string" && /^\d+$/.test(firstCell.trim()))) {
      startIdx = i;
      break;
    }
  }

  const entries: QAMatrixEntry[] = [];

  for (let i = startIdx; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 10) continue;
    const sNo = Number(r[0]);
    if (isNaN(sNo) || sNo === 0) continue;

    // Column mapping for QA matrix format (matches SQAM_Network.html):
    // 0=S.No, 1=Source, 2=Station, 3=Designation, 4=Concern,
    // 5=Defect code, 6=Location code,
    // 7=Repair time, 8=DVM/PQG (Y/N), 9=DVR/DVT (Y/N),
    // 10=Product Audit SCA (Y/N), 11=WARRANTY,
    // 12=Defect Rating, 13=Re-occurrence,
    // 14-24=Trim, 25-39=Chassis, 40-52=Final,
    // 53-58=Outside Process Area, 59-69=QControl,
    // 70-73=QCDetail, 74-75=Implementation dates,
    // 76-78=ControlRating, 79-83=RecordedDefect,
    // 84-86=GuaranteedQuality, 87-89=Statuses

    const defectCode = str(r[5]);
    const defectLocationCode = str(r[6]);
    const detectionFlags = {
      repairTime: str(r[7]),
      dvmPQG: str(r[8]),
      dvrDVT: str(r[9]),
      productAuditSCA: str(r[10]),
      warranty: str(r[11]),
      reoccurrence: str(r[13]),
    };
    const defectRating = Number(r[12]) as 1 | 3 | 5;

    const trim = {
      T10: numOrNull(r[14]), T20: numOrNull(r[15]), T30: numOrNull(r[16]),
      T40: numOrNull(r[17]), T50: numOrNull(r[18]), T60: numOrNull(r[19]),
      T70: numOrNull(r[20]), T80: numOrNull(r[21]), T90: numOrNull(r[22]),
      T100: numOrNull(r[23]), TPQG: numOrNull(r[24]),
    };

    const chassis = {
      C10: numOrNull(r[25]), C20: numOrNull(r[26]), C30: numOrNull(r[27]),
      C40: numOrNull(r[28]), C45: numOrNull(r[29]), C50: numOrNull(r[30]),
      C60: numOrNull(r[31]), C70: numOrNull(r[32]), C80: numOrNull(r[33]),
      P10: numOrNull(r[34]), P20: numOrNull(r[35]), P30: numOrNull(r[36]),
      R10: numOrNull(r[37]), PRESS: numOrNull(r[38]), PQG: numOrNull(r[39]),
    };

    const final = {
      F10: numOrNull(r[40]), F20: numOrNull(r[41]), F30: numOrNull(r[42]),
      F40: numOrNull(r[43]), F50: numOrNull(r[44]), F60: numOrNull(r[45]),
      F70: numOrNull(r[46]), F80: numOrNull(r[47]), F90: numOrNull(r[48]),
      F100: numOrNull(r[49]), F110: numOrNull(r[50]), FPQG: numOrNull(r[51]),
      TLAudit: numOrNull(r[52]), TorqueAudit: numOrNull(r[53]),
    };

    const outsideProcess = {
      Static: numOrNull(r[52]),
      WheelAlignment: numOrNull(r[53]),
      HLAssembly: numOrNull(r[54]),
      DMCCABS: numOrNull(r[55]),
      CC4: numOrNull(r[56]),
      CertLine: numOrNull(r[57]),
    };

    const qControl = {
      freqControl_1_1: numOrNull(r[58]), visualControl_1_2: numOrNull(r[59]),
      periodicAudit_1_3: numOrNull(r[60]), humanControl_1_4: numOrNull(r[61]),
      saeAlert_3_1: numOrNull(r[62]), freqMeasure_3_2: numOrNull(r[63]),
      manualTool_3_3: numOrNull(r[64]), humanTracking_3_4: numOrNull(r[65]),
      autoControl_5_1: numOrNull(r[66]), impossibility_5_2: numOrNull(r[67]),
      saeProhibition_5_3: numOrNull(r[68]),
    };

    const qControlDetail = {
      CVT: numOrNull(r[69]), SHOWER: numOrNull(r[70]),
      DynamicUB: numOrNull(r[71]), CC4: numOrNull(r[72]),
    };

    const entry: QAMatrixEntry = {
      sNo,
      source: str(r[1]),
      operationStation: str(r[2]),
      designation: str(r[3]),
      concern: str(r[4]),
      defectCode,
      defectLocationCode,
      defectRating,
      detectionFlags,
      trim, chassis, final, outsideProcess,
      qControl, qControlDetail,
      implementationDate: str(r[73]),
      auditDateName: str(r[74]),
      controlRating: {
        MFG: numOrNull(r[75]),
        Quality: numOrNull(r[76]),
        Plant: numOrNull(r[77]),
      },
      recordedDefect: {
        workstation: numOrNull(r[78]),
        zoneSupervisor: numOrNull(r[79]),
        shopQC: numOrNull(r[80]),
        shopQA: numOrNull(r[81]),
        customer: numOrNull(r[82]),
      },
      guaranteedQuality: {
        Workstation: numOrNull(r[83]),
        MFG: numOrNull(r[84]),
        Plant: numOrNull(r[85]),
      },
      workstationStatus: (str(r[86]).toUpperCase() === "OK" ? "OK" : "NG"),
      mfgStatus: (str(r[87]).toUpperCase() === "OK" ? "OK" : "NG"),
      plantStatus: (str(r[88]).toUpperCase() === "OK" ? "OK" : "NG"),
      mfgAction: str(r[89]),
      resp: str(r[90]),
      target: str(r[91]),
    };

    entries.push(recalculateStatuses(entry));
  }

  return entries;
}
