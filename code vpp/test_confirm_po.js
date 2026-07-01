const http = require('http');

function request(path, method='GET', body=null, headers={}){
  return new Promise((resolve, reject)=>{
    const options = { hostname: 'localhost', port: 3000, path, method, headers };
    const req = http.request(options, res=>{
      let data=''; res.on('data',c=>data+=c); res.on('end',()=>resolve({status:res.statusCode, body:data}));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async ()=>{
  try{
    const list = await request('/api/purchase-orders', 'GET', null, { 'Authorization': 'Bearer ' + (process.env.TOKEN || '') });
    console.log('PO list status', list.status, list.body);
    // parse first pending id
    const rows = JSON.parse(list.body || '[]');
    const p = rows.find(r=>r.status==='pending');
    if(!p){ console.log('no pending'); process.exit(0); }
    console.log('attempt confirm', p.id);
    const res = await request(`/api/purchase-orders/${p.id}/confirm`, 'POST', null, { 'Authorization': 'Bearer ' + (process.env.TOKEN || '') });
    console.log('confirm status', res.status, res.body);
  }catch(e){ console.error('err', e); }
})();