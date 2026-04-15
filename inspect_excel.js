import XLSX from 'xlsx';
const wb = XLSX.readFile('src/SQAM_Updatw.xlsm');
console.log('Sheets:', wb.SheetNames);
wb.SheetNames.forEach(name => {
  const ws = wb.Sheets[name];
  const data = XLSX.utils.sheet_to_json(ws, {header:1});
  console.log('Sheet:', name, 'Rows:', data.length);
  if(data.length > 0) console.log('First row:', data[0]);
  if(data.length > 1) console.log('Second row:', data[1]);
  if(data.length > 2) console.log('Third row:', data[2]);
});