const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'qamatrix';

async function migrate() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db(dbName);

        const sql2Path = path.join(__dirname, '..', 'sql', 'sql2.sql');
        const sqlContent = fs.readFileSync(sql2Path, 'utf8');

        const tables = [
            { name: 'defect_data', columns: ['id', 'source', 'defect_code', 'defect_location_code', 'defect_description_details', 'uploaded_at', 'gravity'] },
            { name: 'dvx_defects', columns: ['id', 'location_code', 'location_details', 'defect_code', 'defect_description', 'defect_description_details', 'gravity', 'quantity', 'source', 'responsible', 'pof_family', 'pof_code', 'pairing_status', 'pairing_method', 'match_score', 'qa_matrix_sno', 'created_at'] },
            { name: 'final_defect', columns: ['id', 'defect_code', 'defect_location_code', 'defect_description_details', 'source', 'created_at', 'gravity'] },
            { name: 'qa_matrix_entries', columns: ['id', 's_no', 'source', 'operation_station', 'designation', 'concern', 'defect_code', 'defect_location_code', 'defect_rating', 'recurrence', 'weekly_recurrence', 'recurrence_count_plus_defect', 'trim', 'chassis', 'final', 'q_control', 'q_control_detail', 'control_rating', 'guaranteed_quality', 'workstation_status', 'mfg_status', 'plant_status', 'mfg_action', 'resp', 'target', 'detection_flags', 'outside_process', 'recorded_defect', 'team_leader', 'repair_time', 'implementation_date', 'audit_date_name', 'dvm_pqg', 'dvr_dvt', 'product_audit_sca', 'warranty', 'reoccurrence_flag', 'created_at', 'updated_at'] },
            { name: 'qa_matrix_snapshots', columns: ['id', 'snapshot_date', 'data', 'created_at'] }
        ];

        // Split the SQL content by statements (semicolon + newline)
        // We use a more careful split that doesn't break on semicolons inside strings
        const statements = splitStatements(sqlContent);

        for (const table of tables) {
            console.log(`Migrating table: ${table.name}...`);
            const entries = [];

            const insertPrefix = `INSERT INTO public.${table.name}`;

            for (const stmt of statements) {
                if (!stmt.trim().startsWith(insertPrefix)) continue;

                const valuesMatch = stmt.match(/VALUES\s+([\s\S]+)$/i);
                if (!valuesMatch) continue;

                const rowsBlock = valuesMatch[1];
                const rows = splitRows(rowsBlock);

                for (const row of rows) {
                    const values = parseValues(row);
                    const entry = {};
                    table.columns.forEach((col, idx) => {
                        entry[col] = cleanVal(values[idx]);
                    });

                    // Specific date handling
                    if (entry.created_at && typeof entry.created_at === 'string') entry.created_at = new Date(entry.created_at);
                    if (entry.updated_at && typeof entry.updated_at === 'string') entry.updated_at = new Date(entry.updated_at);
                    if (entry.uploaded_at && typeof entry.uploaded_at === 'string') entry.uploaded_at = new Date(entry.uploaded_at);
                    if (entry.snapshot_date && typeof entry.snapshot_date === 'string') entry.snapshot_date = new Date(entry.snapshot_date);

                    entries.push(entry);
                }
            }

            if (entries.length > 0) {
                const collection = db.collection(`${table.name}`);
                await collection.deleteMany({});
                const result = await collection.insertMany(entries);
                console.log(`Successfully inserted ${result.insertedCount} documents for ${table.name}.`);

                if (table.columns.includes('s_no')) {
                    await collection.createIndex({ s_no: 1 }, { unique: true });
                }
                await collection.createIndex({ defect_code: 1 });
            } else {
                console.log(`No data found for table ${table.name}.`);
            }
        }

        console.log('All migrations completed.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.close();
    }
}

function splitStatements(content) {
    const results = [];
    let current = '';
    let inQuote = false;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (char === "'" && (i === 0 || content[i - 1] !== "\\")) {
            inQuote = !inQuote;
        }

        if (char === ';' && !inQuote) {
            results.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    if (current.trim()) results.push(current.trim());
    return results;
}

function splitRows(rowsBlock) {
    const results = [];
    let current = '';
    let inQuote = false;
    let inJson = 0;
    let inParen = 0;

    for (let i = 0; i < rowsBlock.length; i++) {
        const char = rowsBlock[i];
        if (char === "'" && (i === 0 || rowsBlock[i - 1] !== "\\")) {
            inQuote = !inQuote;
        } else if (char === "{" && !inQuote) {
            inJson++;
        } else if (char === "}" && !inQuote) {
            inJson--;
        } else if (char === "(" && !inQuote && inJson === 0) {
            inParen++;
            if (inParen === 1) continue;
        } else if (char === ")" && !inQuote && inJson === 0) {
            inParen--;
            if (inParen === 0) {
                results.push(current.trim());
                current = '';
                continue;
            }
        }

        if (inParen > 0) {
            current += char;
        }
    }
    return results;
}

function parseValues(row) {
    const values = [];
    let current = '';
    let inQuote = false;
    let inJson = 0;

    for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === "'" && (i === 0 || row[i - 1] !== "\\")) {
            inQuote = !inQuote;
            current += char;
        } else if (char === "{" && !inQuote) {
            inJson++;
            current += char;
        } else if (char === "}" && !inQuote) {
            inJson--;
            current += char;
        } else if (char === "," && !inQuote && inJson === 0) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    return values;
}

function cleanVal(v) {
    if (v === undefined || v === 'NULL' || v === '') return null;

    let s = v.trim();
    s = s.replace(/::[a-z]+$/, '');

    if (s.startsWith("'") && s.endsWith("'")) {
        s = s.substring(1, s.length - 1).replace(/''/g, "'");
        if (s === 'NULL') return null;

        if (s.startsWith('{') && s.endsWith('}') && !s.includes(':') && !s.includes('"')) {
            try {
                const arrayString = '[' + s.substring(1, s.length - 1) + ']';
                return JSON.parse(arrayString);
            } catch (e) { }
        }

        try {
            if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
                return JSON.parse(s);
            }
        } catch (e) { }
        return s;
    }

    if (s.startsWith('{') || s.startsWith('[')) {
        try {
            return JSON.parse(s);
        } catch (e) { }
    }

    const num = Number(s);
    if (!isNaN(num) && s !== '') return num;
    return s;
}

migrate();
