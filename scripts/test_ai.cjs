const http = require('http');

const data = JSON.stringify({
    defects: [
        { index: 0, locationDetails: "Battery area", defectDescription: "loose cable", defectDescriptionDetails: "negative terminal is loose", gravity: "S" }
    ],
    concerns: [
        { sNo: 2, concern: "EC Battery negative terminal insecure", operationStation: "F30", designation: "Final" },
        { sNo: 10, concern: "Scratch on door", operationStation: "T10", designation: "Trim" }
    ]
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/match-defects',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        console.log('Response Status:', res.statusCode);
        console.log('Response:', rawData);
    });
});

req.on('error', (e) => {
    console.error('Problem with request:', e.message);
});

req.write(data);
req.end();
