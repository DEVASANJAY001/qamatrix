import * as XLSX from "xlsx";

const workbook = XLSX.readFile('src/SQAM_Updatw.xlsm');
console.log('Sheets:', workbook.SheetNames);

workbook.SheetNames.forEach(name => {
  const sheet = workbook.Sheets[name];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`Sheet: ${name}, Rows: ${rows.length}`);
  if (rows.length > 0) {
    console.log('Row 0:', rows[0]);
  }
  if (rows.length > 1) {
    console.log('Row 1:', rows[1]);
  }
  if (rows.length > 2) {
    console.log('Row 2:', rows[2]);
  }
  if (rows.length > 3) {
    console.log('Row 3:', rows[3]);
  }
});