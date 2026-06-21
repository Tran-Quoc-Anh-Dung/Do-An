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

  const [rows] = await conn.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'barcode'"
  );

  if (rows.length === 0) {
    console.log('Adding barcode column to products table...');
    await conn.query("ALTER TABLE products ADD COLUMN barcode VARCHAR(100) NULL AFTER category");
    console.log('barcode column added.');
  } else {
    console.log('barcode column already exists.');
  }

  await conn.end();
}

main().catch(err => {
  console.error('Failed to ensure barcode column:', err.message || err);
  process.exit(1);
});