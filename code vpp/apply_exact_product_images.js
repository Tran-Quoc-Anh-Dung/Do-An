require('dotenv').config();
const mysql = require('mysql2/promise');

const patterns = [
  { match: ['Bút gel Thiên Long Gel-08'], image: 'https://images.unsplash.com/photo-1496104679561-38f5b606f9b2?auto=format&fit=crop&w=900&q=80' },
  { match: ['Hồ dán'], image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80' },
  { match: ['Sổ lò xo B5'], image: 'https://images.unsplash.com/photo-1517971071642-34a2d0d41703?auto=format&fit=crop&w=900&q=80' },
  { match: ['Vở Campus 96 trang'], image: 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=900&q=80' },
  { match: ['Giấy decal'], image: 'https://images.unsplash.com/photo-1517686469429-8bdb71f12961?auto=format&fit=crop&w=900&q=80' },
  { match: ['Gôm tẩy'], image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=900&q=80' },
  { match: ['Kéo văn phòng'], image: 'https://images.unsplash.com/photo-1510915228340-29c85a43dcfe?auto=format&fit=crop&w=900&q=80' },
  { match: ['Giấy A4 Paper One'], image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=900&q=80' },
  { match: ['File nhựa A4'], image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80' },
  { match: ['Thước kẻ 20cm'], image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80' },
  { match: ['Chuốt bút chì'], image: 'https://images.unsplash.com/photo-1504252060328-5f3d7e2d55cd?auto=format&fit=crop&w=900&q=80' },
  { match: ['Bút mực Pilot'], image: 'https://images.unsplash.com/photo-1517430816045-df4b7de1f80c?auto=format&fit=crop&w=900&q=80' },
  { match: ['Sổ tay A5 bìa cứng'], image: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=900&q=80' },
  { match: ['Giấy in ảnh'], image: 'https://images.unsplash.com/photo-1516495085724-63dc995cc276?auto=format&fit=crop&w=900&q=80' },
  { match: ['Bút highlight Stabilo'], image: 'https://images.unsplash.com/photo-1506086679525-6f2a3c87cca7?auto=format&fit=crop&w=900&q=80' },
  { match: ['Giấy A4 Double A 80gsm'], image: 'https://images.unsplash.com/photo-1496151211998-b208c9401748?auto=format&fit=crop&w=900&q=80' },
  { match: ['Compa Thiên Long'], image: 'https://images.unsplash.com/photo-1518887887125-60d3277b1d28?auto=format&fit=crop&w=900&q=80' },
  { match: ['Bấm kim Deli'], image: 'https://images.unsplash.com/photo-1518893060605-1f24867f2d6b?auto=format&fit=crop&w=900&q=80' },
  { match: ['Bộ thước eke'], image: 'https://images.unsplash.com/photo-1517433456452-47ba0277781c?auto=format&fit=crop&w=900&q=80' },
  { match: ['Giấy note 5 màu'], image: 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&w=900&q=80' },
  { match: ['Bút bi Thiên Long TL-027'], image: 'https://images.unsplash.com/photo-1503428593586-e225b39bddfe?auto=format&fit=crop&w=900&q=80' },
  { match: ['Sổ planner cao cấp'], image: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=900&q=80' },
  { match: ['Bút bi Deli'], image: 'https://images.unsplash.com/photo-1516455590571-18256e5bb9ff?auto=format&fit=crop&w=900&q=80' },
  { match: ['Vở 200 trang Hải Tiến'], image: 'https://images.unsplash.com/photo-1486427944299-9c7dd9222d8a?auto=format&fit=crop&w=900&q=80' },
  { match: ['Băng keo trong'], image: 'https://images.unsplash.com/photo-1519870914861-5bf5ec052d1d?auto=format&fit=crop&w=900&q=80' }
];

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || undefined,
    charset: 'utf8mb4'
  });

  let total = 0;
  for (const item of patterns) {
    const likeClauses = item.match.map(m => `name LIKE ?`).join(' OR ');
    const [res] = await connection.query(
      `UPDATE products SET image = ? WHERE (${likeClauses})`,
      [item.image, ...item.match.map(m => `${m}%`)]
    );
    total += res.affectedRows;
  }
  console.log('Overrode', total, 'product image rows with exact product images.');

  await connection.end();
})();
