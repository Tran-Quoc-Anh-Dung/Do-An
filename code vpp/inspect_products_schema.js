require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || undefined,
    charset: 'utf8mb4'
  });
  const [rows] = await conn.query('SHOW COLUMNS FROM products');
  console.log(JSON.stringify(rows, null, 2));
  await conn.end();
}

main().catch(err => {
  console.error('Inspect failed:', err.message || err);
  process.exit(1);
});