require('dotenv').config();
const mysql = require('mysql2/promise');

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

const imageRules = [
  { keywords: ['noi com dien'], image: '/assets/real-products/rice-cooker.jpg' },
  { keywords: ['am sieu toc'], image: '/assets/real-products/electric-kettle.jpg' },
  { keywords: ['bep dien tu'], image: '/assets/real-products/induction-cooker.jpg' },
  { keywords: ['lo nuong'], image: '/assets/real-products/oven.jpg' },
  { keywords: ['may loc khong khi'], image: '/assets/real-products/air-purifier.jpg' },
  { keywords: ['may hut bui'], image: '/assets/real-products/vacuum-cleaner.jpg' },
  { keywords: ['quat cay'], image: '/assets/real-products/standing-fan.jpg' },
  { keywords: ['chao chong dinh'], image: '/assets/real-products/nonstick-pan.jpg' },
  { keywords: ['tham san'], image: '/assets/real-products/floor-carpet.jpg' },
  { keywords: ['thung rac'], image: '/assets/real-products/trash-bin.jpg' },
  { keywords: ['ke de do'], image: '/assets/real-products/storage-shelf.jpg' },
  { keywords: ['may xay sinh to'], image: '/assets/real-products/blender.jpg' },
  { keywords: ['may ep trai cay'], image: '/assets/real-products/juicer.jpg' },
  { keywords: ['ban ui hoi nuoc'], image: '/assets/real-products/steam-iron.jpg' },
  { keywords: ['den ngu'], image: '/assets/real-products/night-lamp.jpg' },
  { keywords: ['noi chien khong dau'], image: '/assets/real-products/air-fryer.jpg' },
  { keywords: ['may say toc'], image: '/assets/real-products/hair-dryer.jpg' },
  { keywords: ['binh giu nhiet'], image: '/assets/real-products/thermos.jpg' },
  { keywords: ['hop dung thuc pham'], image: '/assets/real-products/food-container.jpg' },
  { keywords: ['moc treo quan ao'], image: '/assets/real-products/hanger.jpg' }
];

function getImageByName(name) {
  const normalizedName = normalizeText(name);
  const rule = imageRules.find(item => item.keywords.some(keyword => normalizedName.includes(keyword)));
  return rule ? rule.image : '/assets/real-products/fallback.jpg';
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pos_vpp',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    charset: 'utf8mb4'
  });

  const [products] = await connection.query(
    "SELECT id, name FROM products WHERE description LIKE 'Sản phẩm mẫu%' OR name LIKE '%Model %'"
  );

  let updated = 0;
  for (const product of products) {
    const image = getImageByName(product.name);
    const [result] = await connection.query('UPDATE products SET image = ? WHERE id = ?', [image, product.id]);
    if (result.affectedRows > 0) updated += 1;
  }

  await connection.end();
  console.log(`Đã cập nhật ảnh cho ${updated} sản phẩm mẫu.`);
}

main().catch(error => {
  console.error('Lỗi cập nhật ảnh sản phẩm mẫu:', error.message);
  process.exit(1);
});
