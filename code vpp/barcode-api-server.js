const express = require('express');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pos',
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+07:00',
  decimalNumbers: true
});

app.get('/api/products/:barcode', async (req, res) => {
  const barcode = String(req.params.barcode || '').trim();

  if (!barcode) {
    return res.status(400).json({ error: 'Barcode không hợp lệ.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, name, price, barcode, image FROM products WHERE barcode = ? LIMIT 1',
      [barcode]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Sản phẩm không tìm thấy.' });
    }

    const product = rows[0];
    res.json({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      barcode: product.barcode,
      image: product.image
    });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi tìm sản phẩm.' });
  }
});

app.listen(PORT, () => {
  console.log(`Barcode POS API running on http://localhost:${PORT}`);
});
