const db = require('./src/database');
function q(sql, params=[]) { return new Promise((res,rej)=>db.query(sql, params, (err, rows)=> err? rej(err): res(rows))); }
(async()=>{
  try{
    const poId = process.argv[2] || 3;
    console.log('poId',poId);
    const po = await q('SELECT * FROM purchase_orders WHERE id=?',[poId]);
    console.log('po',po);
    const items = await q('SELECT * FROM purchase_order_items WHERE po_id=?',[poId]);
    console.log('items',items);
    for(const it of items){
      const prod = await q('SELECT * FROM products WHERE id=?',[it.product_id]);
      console.log('prod for item',it.id, prod);
    }
    const logs = await q('SELECT * FROM inventory_logs WHERE reason LIKE ?',['%PO-'+poId+'%']);
    console.log('logs for po',logs);
  }catch(e){ console.error(e && e.stack? e.stack: e); process.exit(1); }
  process.exit(0);
})();