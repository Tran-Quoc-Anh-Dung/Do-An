const db = require('./database');
function query(sql, params=[]) { return new Promise((resolve,reject)=> db.query(sql, params, (err,res)=> err? reject(err): resolve(res))); }
(async ()=>{
  try{
    const rows = await query("SELECT id, username, password FROM users WHERE username = 'admin' LIMIT 1");
    console.log(rows);
  }catch(e){ console.error(e);} })();