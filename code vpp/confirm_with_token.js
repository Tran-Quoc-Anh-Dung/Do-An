const http = require('http');

function req(path, method='GET', token=null){
  return new Promise((resolve,reject)=>{
    const options={hostname:'localhost',port:3000,path,method,headers:{}};
    if(token) options.headers.Authorization='Bearer '+token;
    const r = http.request(options,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>resolve({status:res.statusCode, body:d}));});
    r.on('error',reject);
    r.end();
  });
}

(async()=>{
  try{
    const token = process.env.TOKEN;
    if(!token){ console.error('No TOKEN'); process.exit(1); }
    const list = await req('/api/purchase-orders','GET',token);
    console.log('list status',list.status,'body',list.body);
    const rows = JSON.parse(list.body||'[]');
    const p = rows.find(r=>r.status==='pending');
    if(!p){ console.log('no pending'); process.exit(0); }
    console.log('confirming',p.id);
    const res = await req(`/api/purchase-orders/${p.id}/confirm`,'POST',token);
    console.log('confirm status',res.status,'body',res.body);
  }catch(e){ console.error('err',e); }
})();