require('dotenv').config();
const mysql = require('mysql2/promise');

const imageMapping = [
  // BÚT
  { patterns: ['%Bút bi%'], url: 'https://images.unsplash.com/photo-1583485088034-697b5bc36b39' },
  { patterns: ['%Bút gel%'], url: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07' },
  { patterns: ['%highlight%'], url: 'https://images.unsplash.com/photo-1587614382346-ac0c4c1c7a6f' },
  { patterns: ['%bút chì%', '%Bút chì%'], url: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5' },
  
  // VỞ / SỔ
  { patterns: ['%Vở%'], url: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f' },
  { patterns: ['%Sổ%'], url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba' },
  
  // GIẤY
  { patterns: ['%Giấy A4%'], url: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338' },
  { patterns: ['%Giấy note%'], url: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4' },
  { patterns: ['%Giấy%'], url: 'https://images.unsplash.com/photo-1562564055-71e051d33c19' },
  
  // DỤNG CỤ
  { patterns: ['%Thước%'], url: 'https://images.unsplash.com/photo-1581091215367-59ab6b2f9c1b' },
  { patterns: ['%Compa%'], url: 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b' },
  { patterns: ['%Gôm%'], url: 'https://images.unsplash.com/photo-1616627982172-3f7cb7e5a45a' },
  { patterns: ['%Chuốt%'], url: 'https://images.unsplash.com/photo-1588774069410-84ae30757c1d' },
  
  // VPP KHÁC
  { patterns: ['%Băng keo%'], url: 'https://images.unsplash.com/photo-1586074299757-dc655f18518d' },
  { patterns: ['%Kéo%'], url: 'https://images.unsplash.com/photo-1581092335397-9583eb92d232' },
  { patterns: ['%Bấm kim%'], url: 'https://images.unsplash.com/photo-1615485737651-ec8d3b3b3eae' },
  { patterns: ['%Hồ%'], url: 'https://images.unsplash.com/photo-1615485737833-9b1c7c1b5d7e' },
  { patterns: ['%File%'], url: 'https://images.unsplash.com/photo-1586282023358-9c1c9c1c9c1c' },
];

const defaultUrl = 'https://images.unsplash.com/photo-1586281380117-5a60ae2050cc';

function getImageUrl(productName) {
  for (const mapping of imageMapping) {
    for (const pattern of mapping.patterns) {
      // Simple pattern matching: check if product name contains pattern text
      const patternText = pattern.replace(/%/g, '');
      if (productName.toLowerCase().includes(patternText.toLowerCase())) {
        return mapping.url;
      }
    }
  }
  return defaultUrl;
}

(async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
      charset: 'utf8mb4',
    });

    // Fetch all products
    const [products] = await connection.query('SELECT id, name FROM products ORDER BY id');
    console.log(`Found ${products.length} products`);

    let updated = 0;
    
    // Update each product
    for (const product of products) {
      const imageUrl = getImageUrl(product.name);
      await connection.query('UPDATE products SET image = ? WHERE id = ?', [imageUrl, product.id]);
      updated++;
      console.log(`[${updated}/${products.length}] ${product.name} → Updated`);
    }

    console.log(`\n✅ Successfully updated ${updated} products with fixed image URLs`);
    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
