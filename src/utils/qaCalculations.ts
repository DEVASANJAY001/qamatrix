import { QAMatrixEntry, Status } from "@/types/qaMatrix";

const sumNonNull = (values: (number | null)[]): number =>
  values.reduce<number>((acc, v) => acc + (v ?? 0), 0);


export function recalculateStatuses(entry: QAMatrixEntry): QAMatrixEntry {
  const dr = entry.defectRating;
  const hasRecurrence = entry.weeklyRecurrence.some(w => (w ?? 0) > 0);
  const recurrence = entry.weeklyRecurrence.reduce((a, b) => a + (b ?? 0), 0);
  const recurrenceCountPlusDefect = dr + recurrence;

  const trimValues = Object.values(entry.trim);
  const chassisValues = Object.values(entry.chassis);
  const { TorqueAudit, ...finalWithoutTorque } = entry.final;
  const finalValues = Object.values(finalWithoutTorque); // T10 through TLAudit
  const outsideValues = entry.outsideProcess ? Object.values(entry.outsideProcess) : [];

  // All station scores in sequence: Trim -> Chassis -> Final -> Outside
  const allStationValues = [
    ...trimValues,
    ...chassisValues,
    Object.values(entry.final), // Includes TLAudit and TorqueAudit
    ...outsideValues // Includes Cert Line
  ].flat();

  // 1. Control Rating - Workstation: Value of the FIRST non-zero station encountered (left to right)
  let workstationRating: number | null = null;
  for (const v of allStationValues) {
    if (v !== null && v > 0) {
      workstationRating = v;
      break;
    }
  }

  // 2. Control Rating - Zone: SUM of Trim station values (T10 to TPQG)
  const zoneRatingValue = sumNonNull(trimValues);

  // 3. Control Rating - Shop: SUM of all station values up to Team Leader Audit
  // This corresponds to Trim + Chassis + Final (excluding TorqueAudit)
  const shopRatingValue = sumNonNull([...trimValues, ...chassisValues, ...finalValues]);

  // 4. Control Rating - Plant: SUM of all station values (T10 to Cert Line)
  const plantRatingValue = sumNonNull(allStationValues);

  // Status Logic for Guaranteed Quality:
  const workstationGQ: Status = (workstationRating !== null && workstationRating >= dr && !hasRecurrence) ? "OK" : "NG";
  const zoneGQ: Status = (zoneRatingValue >= dr) ? "OK" : "NG";
  const shopGQ: Status = (shopRatingValue >= dr) ? "OK" : "NG";
  const plantGQ: Status = "OK"; // Plant usually OK per instructions

  return {
    ...entry,
    recurrence,
    recurrenceCountPlusDefect,
    controlRating: {
      Workstation: workstationRating,
      Zone: zoneRatingValue,
      Shop: shopRatingValue,
      Plant: plantRatingValue
    },
    recordedDefect: {
      workstation: null,
      zone: null,
      shop: null,
      customer: null
    },
    guaranteedQuality: {
      Workstation: workstationGQ,
      Zone: zoneGQ,
      Shop: shopGQ,
      Plant: plantGQ
    },
    workstationStatus: hasRecurrence ? "NG" : (workstationRating !== null && workstationRating >= dr ? "OK" : "NG"),
    mfgStatus: shopRatingValue >= dr ? "OK" : "NG",
    plantStatus: plantRatingValue >= dr ? "OK" : "NG",
  };
}
