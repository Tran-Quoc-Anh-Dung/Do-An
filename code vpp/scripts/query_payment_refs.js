const db = require('../src/database');
db.query("SELECT order_number, payment_reference, payment_confirmed, created_at FROM orders WHERE payment_reference IS NOT NULL ORDER BY created_at DESC LIMIT 20", (err, rows)=>{ if(err) { console.error('ERR', err); process.exit(1);} console.log(rows); process.exit(0); });
