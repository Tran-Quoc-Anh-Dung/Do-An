(async ()=>{
  try{
    const loginRes = await fetch('http://localhost:3000/auth/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username:'admin', password:'admin123'})});
    const loginText = await loginRes.text();
    console.log('login status', loginRes.status, 'body:', loginText);
    let loginJson = null;
    try { loginJson = JSON.parse(loginText); } catch(e) { /**/ }
    const token = loginJson ? loginJson.token : null;
    console.log('token ok?', !!token);
    const payload = { cart: [{ product_id:1, product_name:'Bút bi cao cấp', price:8500, quantity:2 }], customer: { name: 'Khách Test', phone: '0912345678' } };
    const res = await fetch('http://localhost:3000/orders', {method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+token}, body: JSON.stringify(payload)});
    const txt = await res.text();
    console.log('status', res.status, txt);
  } catch (e) { console.error(e); process.exit(1); }
})();