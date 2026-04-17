const https = require('https');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

https.get(\`https://generativelanguage.googleapis.com/v1beta/models?key=\${GEMINI_API_KEY}\`, (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            const data = JSON.parse(rawData);
            console.log(JSON.stringify(data, null, 2));
        } catch (e) {
            console.error(rawData);
        }
    });
});
