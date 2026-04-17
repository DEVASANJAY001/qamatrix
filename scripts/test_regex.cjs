const fs = require('fs');
const content = `INSERT INTO public.test (id, name) VALUES
  (1, 'a'),
  (2, 'b');`;

const tableName = 'test';
const insertRegex = new RegExp(\`INSERT INTO public\\\\.\${tableName} \\\\([\\\\s\\\\S]+?\\\\) VALUES\\\\s+\\\\(([^;]+?)\\\\);\`, 'g');
let match;
while ((match = insertRegex.exec(content)) !== null) {
    console.log('Match found:', match[1]);
}
