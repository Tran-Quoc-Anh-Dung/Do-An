const http = require('http');
const data = JSON.stringify({
  cart:[{product_id:null,product_name:'TestProd',price:10000,quantity:1}],
  paymentMethod:'transfer',
  invoiceType:'normal',
  customer:{name:'Khach',phone:'0123456789'},
  payment:{reference:'TRFTEST12345'},
  discountPercent:0,
  totalAfterDiscount:10000
});
const token = process.env.TEST_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ0ZXN0Iiwicm9sZSI6InNlbGxlciIsImlhdCI6MTc4MzA2MTc3M30.g-phy8pIBVLLiJCy9SbQnNRKP2QSWVIlqx5vi5BmuT0';
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/orders',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'Authorization': 'Bearer ' + token
  }
};
const req = http.request(options, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    try { console.log(JSON.parse(d)); } catch(e) { console.log(d); }
  });
});
req.on('error', (e) => { console.error('ERR', e); });
req.write(data);
req.end();
