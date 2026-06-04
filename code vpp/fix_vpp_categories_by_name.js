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

  const sql = `UPDATE products SET category = CASE
    WHEN name LIKE 'Bút%' THEN 'Bút viết'
    WHEN name LIKE 'Vở%' OR name LIKE 'Sổ%' THEN 'Vở/Sổ'
    WHEN name LIKE 'Giấy%' THEN 'Giấy'
    WHEN name LIKE 'Thước%' OR name LIKE 'Compa%' OR name LIKE 'Gôm%' OR name LIKE 'Chuốt%' OR name LIKE 'Bộ thước%' THEN 'Dụng cụ'
    ELSE 'Vật tư'
  END
  WHERE barcode LIKE ?`;

  const [res] = await conn.query(sql, ['VPP%']);
  console.log('updated', res.affectedRows);
  await conn.end();
}

main().catch(err => {
  console.error('Fix failed:', err.message || err);
  process.exit(1);
});