require('dotenv').config();
const fs = require('fs');
const mysql = require('mysql2/promise');

async function run() {
  const filePath = process.argv[2] || 'railway_seed_products.sql';
  const sql = fs.readFileSync(filePath, 'utf8');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || undefined,
    charset: 'utf8mb4',
    multipleStatements: true
  });

  await connection.query(sql);
  await connection.end();
  console.log(`Imported SQL from ${filePath}`);
}

run().catch(err => {
  console.error('Import failed:', err.message || err);
  process.exit(1);
});