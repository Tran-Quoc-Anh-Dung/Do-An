require('dotenv').config();
const mysql = require('mysql2/promise');

const imageMap = {
  'Bút viết': 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=700&q=80',
  'Vở/Sổ': 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=700&q=80',
  'Giấy': 'https://images.unsplash.com/photo-1511006913847-e60e7a4e2f65?auto=format&fit=crop&w=700&q=80',
  'Dụng cụ': 'https://images.unsplash.com/photo-1589561084283-930aa7b1f76d?auto=format&fit=crop&w=700&q=80',
  'Vật tư': 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=700&q=80'
};

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || undefined,
    charset: 'utf8mb4'
  });

  const [rows] = await conn.query("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND TRIM(category) != ''");
  const categories = rows.map(r => r.category.trim()).filter(Boolean);
  console.log('Found categories:', categories);

  for (const name of categories) {
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await conn.query('INSERT IGNORE INTO categories (name, slug) VALUES (?, ?)', [name, slug]);
  }

  let totalUpdated = 0;
  for (const category of categories) {
    const image = imageMap[category] || 'https://images.unsplash.com/photo-1519682577862-22b62b24e493?auto=format&fit=crop&w=700&q=80';
    const [result] = await conn.query('UPDATE products SET image = ? WHERE category = ? AND (image IS NULL OR image = "")', [image, category]);
    totalUpdated += result.affectedRows;
  }

  console.log('Inserted categories and updated images for', totalUpdated, 'products.');
  await conn.end();
})().catch(err => {
  console.error('Sync failed:', err.message || err);
  process.exit(1);
});