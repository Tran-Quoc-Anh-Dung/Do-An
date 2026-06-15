const db = require('./database');

function query(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });
}

(async ()=>{
  try {
    const now = new Date();
    const res = await query(`INSERT INTO orders (product_id, product_name, price, quantity, order_number, created_at) VALUES (?, ?, ?, ?, CONCAT('T-', UNIX_TIMESTAMP()), NOW())`, [1, 'Bút bi cao cấp', 8500.00, 2]);
    console.log('Inserted order id:', res.insertId);
    process.exit(0);
  } catch (err) {
    console.error('Error inserting test order:', err);
    process.exit(1);
  }
})();