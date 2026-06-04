require('dotenv').config(); const mysql = require('mysql2/promise');
(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || undefined,
    charset: 'utf8mb4'
  });

  const genericImages = [
    'https://images.unsplash.com/photo-1519682577862-22b62b24e493?auto=format&fit=crop&w=700&q=80',
    'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=700&q=80',
    'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=700&q=80',
    'https://images.unsplash.com/photo-1511006913847-e60e7a4e2f65?auto=format&fit=crop&w=700&q=80',
    'https://images.unsplash.com/photo-1589561084283-930aa7b1f76d?auto=format&fit=crop&w=700&q=80'
  ];

  const [countRows] = await connection.query(
    'SELECT COUNT(*) AS cnt FROM products WHERE image IN (?)',
    [genericImages]
  );
  console.log('generic fallback count:', countRows[0].cnt);

  const [groupRows] = await connection.query(
    'SELECT SUBSTRING_INDEX(name, " - ", 1) AS prefix, COUNT(*) AS cnt, image FROM products WHERE image IN (?) GROUP BY prefix, image ORDER BY cnt DESC LIMIT 100',
    [genericImages]
  );
  console.log('generic fallback groups:');
  console.log(JSON.stringify(groupRows, null, 2));

  const [rows] = await connection.query(
    'SELECT name, category, image FROM products WHERE image IN (?) ORDER BY category, name LIMIT 100',
    [genericImages]
  );
  console.log(JSON.stringify(rows, null, 2));
  await connection.end();
})();
