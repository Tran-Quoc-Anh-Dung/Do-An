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
    const id = process.argv[2] || 3;
    if(!token){ console.error('No TOKEN'); process.exit(1); }
    const r = await req(`/api/purchase-orders/${id}`,'GET',token);
    console.log('status',r.status);
    console.log('body',r.body);
  }catch(e){ console.error(e); }
})();