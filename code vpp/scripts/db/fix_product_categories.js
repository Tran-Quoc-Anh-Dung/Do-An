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

  const updates = [
    ['Bút viết', "name LIKE 'Bút %' OR name LIKE 'Bút bi %' OR name LIKE 'Bút gel %' OR name LIKE 'Bút mực %'"],
    ['Vở/Sổ', "name LIKE 'Vở %' OR name LIKE 'Sổ %'"],
    ['Giấy', "name LIKE 'Giấy %' OR name LIKE 'Giấy note %' OR name LIKE 'Giấy in %' OR name LIKE 'Giấy decal %'"],
    ['Dụng cụ', "name LIKE 'Thước %' OR name LIKE 'Compa %' OR name LIKE 'Gôm %' OR name LIKE 'Chuốt %' OR name LIKE 'Bộ thước %'"]
  ];

  for (const [category, condition] of updates) {
    const [res] = await conn.query(`UPDATE products SET category = ? WHERE barcode LIKE ? AND (${condition})`, [category, 'VPP%']);
    console.log(category, res.affectedRows);
  }

  const [res] = await conn.query("UPDATE products SET category = 'Vật tư' WHERE barcode LIKE ? AND category NOT IN ('Bút viết','Vở/Sổ','Giấy','Dụng cụ')", ['VPP%']);
  console.log('Vật tư', res.affectedRows);

  await conn.end();
}

main().catch(err => {
  console.error('Fix failed:', err.message || err);
  process.exit(1);
});