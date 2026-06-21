const db = require('../../src/database');
function query(sql, params=[]) { return new Promise((resolve,reject)=> db.query(sql, params, (err,res)=> err? reject(err): resolve(res))); }
(async ()=>{
  try{
    const rows = await query(`SELECT COALESCE(p.category,'Khác') AS category, SUM(o.quantity) AS quantity_sold, IFNULL(SUM(o.price * o.quantity), 0) AS revenue FROM orders o LEFT JOIN products p ON o.product_id = p.id WHERE DATE(o.created_at) = CURDATE() GROUP BY category ORDER BY revenue DESC`);
    console.log('Rows:', rows);
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1);} })();