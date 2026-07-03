const http = require('http');
const data = JSON.stringify({ orderReference: 'TRFTEST12345', amount: 10000 });
const options = { hostname: 'localhost', port: 3000, path: '/webhook/sepay', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
const req = http.request(options, (res) => { let d = ''; res.on('data', c=>d+=c); res.on('end', ()=>{ console.log('STATUS', res.statusCode); try{ console.log(JSON.parse(d)); }catch(e){ console.log(d); } }); });
req.on('error', e=>console.error('ERR', e)); req.write(data); req.end();
