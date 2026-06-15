const fetch = require('node-fetch');
(async ()=>{
  try{
    const login = await fetch('http://localhost:3000/auth/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username:'admin', password:'admin123'})});
    const loginJson = await login.json();
    const token = loginJson.token;
    console.log('token:', !!token);
    const payload = { cart: [{ product_id:1, product_name:'Bút bi cao cấp', price:8500, quantity:2 }], customer: { name: 'Khách Test', phone: '0912345678' } };
    const res = await fetch('http://localhost:3000/orders', {method:'POST', headers:{'Content-Type':'application/json', 'Authorization': 'Bearer ' + token}, body: JSON.stringify(payload)});
    const txt = await res.text();
    console.log('status', res.status, txt);
  } catch (e) { console.error(e); process.exit(1); }
})();