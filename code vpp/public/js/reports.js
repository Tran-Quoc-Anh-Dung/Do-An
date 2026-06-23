async function fetchJSON(url) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error('Network error ' + res.status);
  return res.json();
}

function q(id){ return document.getElementById(id); }

async function loadFilters(){
  try{
    const products = await fetchJSON('/api/products?sold=1');
    const prodSel = q('filter-product');
    products.forEach(p => {
      const o = document.createElement('option'); o.value = p.id; o.text = p.name; prodSel.appendChild(o);
    });

    // try public staff endpoint first (no auth)
    let staff = [];
    try { staff = await fetchJSON('/api/staff_public'); } catch(e) { console.warn('staff_public failed, fallback to /users', e); staff = await fetchJSON('/users').catch(()=>[]); }
    const staffSel = q('filter-staff');
    staff.forEach(u => { const o = document.createElement('option'); o.value = u.id; o.text = u.full_name || u.username; staffSel.appendChild(o); });
  }catch(e){ console.error(e); }
}

function formatCurrency(v){ return Number(v||0).toLocaleString('vi-VN', {style:'currency', currency:'VND'}); }

async function loadSummary(){
  try{
    const start = q('filter-start').value;
    const end = q('filter-end').value;
    const product_id = q('filter-product').value;
    const seller_id = q('filter-staff').value;
    const params = new URLSearchParams();
    if (start) params.set('start', start + ' 00:00:00');
    if (end) params.set('end', end + ' 23:59:59');
    if (product_id) params.set('product_id', product_id);
    if (seller_id) params.set('seller_id', seller_id);
    const data = await fetchJSON('/public/reports/summary?' + params.toString());
    q('sum-revenue').innerText = formatCurrency(data.total_revenue);
    q('sum-orders').innerText = data.order_count;
    q('sum-avg').innerText = formatCurrency(data.avg_order_value);
  }catch(e){ console.error(e); }
}

let salesChart=null, productsChart=null;

async function loadProducts(){
  try{
    const start = q('filter-start').value;
    const end = q('filter-end').value;
    const params = new URLSearchParams();
    if (start) params.set('start', start + ' 00:00:00');
    if (end) params.set('end', end + ' 23:59:59');
    const data = await fetchJSON('/public/reports/products?' + params.toString());
    const tbody = q('table-products').querySelector('tbody'); tbody.innerHTML='';
    data.top.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.product_name||''}</td><td>${r.total_qty||0}</td><td>${formatCurrency(r.total_revenue||0)}</td><td>${r.stock||0}</td>`;
      tbody.appendChild(tr);
    });

    // products pie
    const labels = data.byProduct.slice(0,10).map(r=>r.product_name);
    const values = data.byProduct.slice(0,10).map(r=>Number(r.total_revenue||0));
    const ctx = q('chart-products').getContext('2d');
    if (productsChart) productsChart.destroy();
    productsChart = new Chart(ctx, { type: 'pie', data: { labels, datasets:[{ data: values, backgroundColor: labels.map((_,i)=>`hsl(${i*36%360} 70% 50%)`) }] } });
  }catch(e){ console.error(e); }
}

async function loadCustomers(){
  try{
    const start = q('filter-start').value; const end = q('filter-end').value;
    const params = new URLSearchParams(); if (start) params.set('start', start + ' 00:00:00'); if (end) params.set('end', end + ' 23:59:59');
    const data = await fetchJSON('/public/reports/customers?' + params.toString());
    const tbody = q('table-customers').querySelector('tbody'); tbody.innerHTML='';
    data.forEach(r=>{
      const tr = document.createElement('tr'); tr.innerHTML = `<td>${r.customer_name||'Khách lẻ'}</td><td>${r.orders_count||0}</td><td>${formatCurrency(r.total_revenue||0)}</td>`; tbody.appendChild(tr);
    });
  }catch(e){ console.error(e); }
}

async function loadStaff(){
  try{
    const start = q('filter-start').value; const end = q('filter-end').value;
    const params = new URLSearchParams(); if (start) params.set('start', start + ' 00:00:00'); if (end) params.set('end', end + ' 23:59:59');
    const data = await fetchJSON('/public/reports/staff?' + params.toString());
    const tbody = q('table-staff').querySelector('tbody'); tbody.innerHTML='';
    data.forEach(r=>{
      const tr = document.createElement('tr'); tr.innerHTML = `<td>${r.seller_name||''}</td><td>${r.orders_count||0}</td><td>${formatCurrency(r.total_revenue||0)}</td>`; tbody.appendChild(tr);
    });
  }catch(e){ console.error(e); }
}

async function loadSalesChart(){
  try{
    const data = await fetchJSON('/public/reports/sales');
    const labels = data.daily.map(d=>d.date);
    const values = data.daily.map(d=>Number(d.total_sales||0));
    const ctx = q('chart-sales').getContext('2d');
    if (salesChart) salesChart.destroy();
    salesChart = new Chart(ctx, { type:'line', data:{ labels, datasets:[{ label:'Doanh thu', data:values, borderColor:'#2a9d8f', backgroundColor:'rgba(42,157,143,0.1)'}] } });
  }catch(e){ console.error(e); }
}

async function applyAll(){ await loadSummary(); await loadProducts(); await loadCustomers(); await loadStaff(); await loadSalesChart(); }

q('btn-apply').addEventListener('click', ()=> applyAll());
  q('btn-export').addEventListener('click', ()=>{
  const report = 'products';
  const start = q('filter-start').value; const end = q('filter-end').value;
  const params = new URLSearchParams(); if (start) params.set('start', start + ' 00:00:00'); if (end) params.set('end', end + ' 23:59:59');
  window.location = '/public/reports/export?report=' + report + '&' + params.toString();
});

// init
loadFilters().then(()=>applyAll());
