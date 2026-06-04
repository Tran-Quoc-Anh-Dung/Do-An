require('dotenv').config();
const mysql = require('mysql2/promise');

function keywordForProduct(name) {
  const normalized = (name || '').toLowerCase();
  if (normalized.includes('bút gel')) return 'gel-pen';
  if (normalized.includes('bút bi thiên long tl-027') || normalized.includes('bút bi tl-027') || normalized.includes('bút bi deli') || normalized.includes('bút bi thiên long tl-08') || normalized.includes('bút bi')) return 'ballpoint-pen';
  if (normalized.includes('pilot')) return 'fountain-pen';
  if (normalized.includes('bút highlight')) return 'highlighter';
  if (normalized.includes('bút lông bảng') || normalized.includes('bút lông dầu')) return 'marker-pen';
  if (normalized.includes('bút chì')) return 'pencil';
  if (normalized.includes('bút kim')) return 'fineliner';
  if (normalized.includes('bút ký') || normalized.includes('bút mực nước')) return 'fountain-pen';
  if (normalized.includes('bút xóa')) return 'correction-tape';
  if (normalized.includes('vở') || normalized.includes('sổ')) return 'notebook';
  if (normalized.includes('giấy in ảnh')) return 'photo-paper';
  if (normalized.includes('giấy note')) return 'sticky-notes';
  if (normalized.includes('giấy decal')) return 'decal-paper';
  if (normalized.includes('giấy bìa cứng')) return 'cardstock';
  if (normalized.includes('giấy màu thủ công')) return 'craft-paper';
  if (normalized.includes('giấy')) return 'paper';
  if (normalized.includes('thước nhựa') || normalized.includes('thước inox') || normalized.includes('thước mẫu') || normalized.includes('thước ')) return 'ruler';
  if (normalized.includes('compa')) return 'compass';
  if (normalized.includes('bộ thước eke')) return 'set-square';
  if (normalized.includes('gôm')) return 'eraser';
  if (normalized.includes('chuốt')) return 'pencil-sharpener';
  if (normalized.includes('bảng') || normalized.includes('phấn viết bảng')) return 'whiteboard';
  if (normalized.includes('băng keo 2 mặt')) return 'double-sided-tape';
  if (normalized.includes('băng keo trong') || normalized.includes('băng keo mẫu') || normalized.includes('băng keo')) return 'tape';
  if (normalized.includes('kéo')) return 'scissors';
  if (normalized.includes('kẹp giấy')) return 'paper-clip';
  if (normalized.includes('bấm kim')) return 'stapler';
  if (normalized.includes('kim bấm')) return 'staples';
  if (normalized.includes('hồ dán')) return 'glue';
  if (normalized.includes('file nhựa') || normalized.includes('file mẫu') || normalized.includes('file ')) return 'plastic-folder';
  if (normalized.includes('bìa hồ sơ')) return 'file-folder';
  if (normalized.includes('bìa còng')) return 'binder';
  return 'office-supplies';
}

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    charset: 'utf8mb4'
  });

  const [products] = await connection.query('SELECT id, barcode, name FROM products ORDER BY id');
  let updated = 0;
  for (const product of products) {
    const keyword = keywordForProduct(product.name);
    const imageUrl = `https://source.unsplash.com/300x300/?${keyword}&sig=${product.barcode}`;
    const [result] = await connection.query('UPDATE products SET image = ? WHERE barcode = ?', [imageUrl, product.barcode]);
    if (result.affectedRows > 0) updated += 1;
  }

  console.log(`Assigned fixed image URLs for ${updated} products.`);
  await connection.end();
})();
