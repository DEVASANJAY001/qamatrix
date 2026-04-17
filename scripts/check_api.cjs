const http = require('http');

http.get('http://localhost:5000/api/qa-matrix', (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            const data = JSON.parse(rawData);
            console.log('Got', data.length, 'entries');
            if (data.length > 0) {
                console.log('First entry:', JSON.stringify(data[0], null, 2));
            } else {
                console.log('No data returned from API');
            }
        } catch (e) {
            console.error('Error parsing JSON:', e.message);
        }
    });
}).on('error', (e) => {
    console.error(`Error: ${e.message}`);
});
