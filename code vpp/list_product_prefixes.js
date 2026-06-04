require('dotenv').config();
const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || undefined,
    charset: 'utf8mb4'
  });

  const [rows] = await c.query("SELECT DISTINCT SUBSTRING_INDEX(name, ' - ', 1) AS prefix, COUNT(*) AS cnt FROM products WHERE barcode LIKE 'VPP%' GROUP BY prefix ORDER BY cnt DESC");
  console.log(JSON.stringify(rows, null, 2));
  const total = rows.reduce((sum, row) => sum + row.cnt, 0);
  console.log('summary rows=', rows.length, 'total=', total);
  const [missingDash] = await c.query("SELECT COUNT(*) AS cnt FROM products WHERE barcode LIKE 'VPP%' AND name NOT LIKE '% - %'");
  console.log('missing dash count:', missingDash[0].cnt);
  const [cats] = await c.query('SELECT DISTINCT category FROM products ORDER BY category');
  console.log('categories', JSON.stringify(cats, null, 2));
  await c.end();
})();
