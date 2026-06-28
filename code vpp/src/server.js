
require("dotenv").config();

// Ensure Node uses Vietnam timezone for logs and default date handling where possible
process.env.TZ = process.env.TZ || 'Asia/Ho_Chi_Minh';

const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_SECRET = process.env.AUTH_SECRET || "vpp-secret-key";
const ALLOWED_ROLES = ["admin", "manager", "seller"];

app.use(cors());
app.use(express.json());

// Middleware: format timestamp fields to Vietnam time before sending JSON
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  function formatValueToVN(d) {
    try {
      return d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    } catch (e) {
      return d.toString();
    }
  }

  function transform(obj) {
    if (Array.isArray(obj)) return obj.map(transform);
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (k.endsWith('_at') || k === 'opened_at' || k === 'closed_at') {
          if (v == null) {
            out[k] = v;
            out[`${k}_vn`] = v;
            out[`${k}_ts`] = null;
          } else {
            let dateValue = v;
            if (typeof dateValue === 'string') {
              dateValue = dateValue.trim().replace(' ', 'T');
            }
            const d = new Date(dateValue);
            if (!isNaN(d.getTime())) {
              out[k] = d.toISOString();
              out[`${k}_vn`] = formatValueToVN(d);
              out[`${k}_ts`] = d.getTime();
            } else {
              out[k] = v;
              out[`${k}_vn`] = v;
              out[`${k}_ts`] = null;
            }
          }
        } else {
          out[k] = transform(v);
        }
      }
      return out;
    }
    return obj;
  }

  res.json = (body) => {
    try {
      const transformed = transform(body);
      return originalJson(transformed);
    } catch (e) {
      return originalJson(body);
    }
  };
  next();
});

// Simple request logger to help debug missing routes
app.use((req, res, next) => {
  try {
    console.log('[REQ]', new Date().toISOString(), req.method, req.originalUrl);
  } catch (e) {}
  next();
});

// Helper function - MUST be defined before routes that use it
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send("Unauthorized");
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, AUTH_SECRET, (err, payload) => {
    if (err) {
      return res.status(401).send("Invalid token");
    }
    req.user = payload;
    next();
  });
}

// Diagnostic: quick handler to verify POST reachability (temporary)
app.post('/_diag_products_bulk_delete', (req, res) => {
  console.log('Received diagnostic bulk-delete POST, body:', req.body);
  res.json({ ok: true, received: req.body });
});

// GTGT Requests Routes - EARLY PLACEMENT before auth/other routes
console.log('[STARTUP] About to register GTGT POST route');
app.post('/gtgt-requests', async (req, res) => {
  try {
    console.log('[GTGT-POST] Received payload:', req.body);
    const orderNumber = String(req.body.orderNumber || req.body.order_number || req.body.order || '').trim();
    const customerName = String(req.body.customerName || req.body.customer_name || '').trim() || null;
    const customerPhone = String(req.body.customerPhone || req.body.customer_phone || '').trim() || null;
    const customerCompany = String(req.body.customerCompany || req.body.customer_company || '').trim() || null;
    const customerTaxCode = String(req.body.customerTaxCode || req.body.customer_tax_code || '').trim() || null;

    if (!orderNumber) {
      return res.status(400).send('Mã đơn là bắt buộc.');
    }

    const existingOrder = await query('SELECT id FROM orders WHERE order_number = ? LIMIT 1', [orderNumber]);
    if (existingOrder.length === 0) {
      return res.status(404).send('Không tìm thấy hóa đơn.');
    }

    await query(
      `INSERT INTO gtgt_requests (order_number, customer_name, customer_phone, customer_company, customer_tax_code)
       VALUES (?, ?, ?, ?, ?)`,
      [orderNumber, customerName, customerPhone, customerCompany, customerTaxCode]
    );

    console.log('[GTGT-POST] Success:', orderNumber);
    res.json({ success: true });
  } catch (err) {
    console.error('[GTGT-POST] Error:', err);
    res.status(500).send('Không thể lưu yêu cầu GTGT.');
  }
});

console.log('[STARTUP] About to register GTGT GET route');
app.get('/gtgt-requests', authenticateToken, async (req, res) => {
  try {
    const requests = await query(
      `SELECT id, order_number, customer_name, customer_phone, customer_company, customer_tax_code, status, created_at
       FROM gtgt_requests
       ORDER BY created_at DESC
       LIMIT 200`
    );
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải yêu cầu GTGT.');
  }
});

async function ensureColumn(table, column, definition) {
  const columns = await query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  if (columns.length === 0) {
    await query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
  }
}

async function ensureEnumValues(table, column, values) {
  const columns = await query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  if (!columns.length) return;
  const type = columns[0].Type;
  const matches = type.match(/^enum\((.*)\)$/i);
  if (!matches) return;
  const existing = matches[1].split(',').map(item => item.trim().replace(/^'|'$/g, ''));
  const missing = values.filter(v => !existing.includes(v));
  if (missing.length === 0) return;
  const allValues = [...new Set([...existing, ...values])].map(v => `'${v}'`).join(',');
  await query(`ALTER TABLE \`${table}\` MODIFY \`${column}\` ENUM(${allValues}) NOT NULL DEFAULT '${values[0]}'`);
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function getCategoryNameById(categoryId) {
  if (!categoryId) return null;
  const rows = await query('SELECT name FROM categories WHERE id = ? LIMIT 1', [categoryId]);
  return rows.length > 0 ? rows[0].name : null;
}

async function createProductFromPayload(payload) {
  const name = String(payload.name || '').trim();
  const description = payload.description ? String(payload.description).trim() : null;
  const categoryId = payload.categoryId || payload.category_id || null;
  const supplierId = payload.supplierId || payload.supplier_id || null;
  let category = payload.category ? String(payload.category).trim() : null;
  const codeValue = String(payload.sku || payload.code || '').trim() || null;
  const barcodeValue = String(payload.barcode || payload.sku || payload.code || '').trim() || null;
  const costPrice = Number(payload.costPrice ?? payload.cost_price ?? 0) || 0;
  const price = Number(payload.salePrice ?? payload.price ?? 0) || 0;
  const stock = Number(payload.stockQuantity ?? payload.stock_quantity ?? payload.stock ?? 0) || 0;
  const minStock = Number(payload.minStock ?? payload.min_stock ?? 0) || 0;
  const warrantyMonths = Number(payload.warrantyMonths ?? payload.warranty_months ?? 0) || 0;
  const image = String(payload.imageUrl || payload.image || '').trim() || null;

  if (!name || !price) {
    const error = new Error('Tên và giá sản phẩm là bắt buộc.');
    error.statusCode = 400;
    throw error;
  }

  if (!category && categoryId) {
    category = await getCategoryNameById(categoryId);
  }

  if (category && String(category).trim()) {
    const cats = await query('SELECT id FROM categories WHERE name = ? LIMIT 1', [category]);
    if (cats.length === 0) {
      const error = new Error('Danh mục không tồn tại. Vui lòng tạo danh mục trước.');
      error.statusCode = 400;
      throw error;
    }
  }

  if (supplierId) {
    const suppliers = await query('SELECT id FROM suppliers WHERE id = ? LIMIT 1', [supplierId]);
    if (suppliers.length === 0) {
      const error = new Error('Nhà cung cấp không tồn tại.');
      error.statusCode = 400;
      throw error;
    }
  }

  const result = await query(
    `INSERT INTO products
      (name, description, category, category_id, supplier_id, code, barcode, cost_price, price, stock, stock_quantity, min_stock, warranty_months, image)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, description, category || null, categoryId || null, supplierId || null, codeValue, barcodeValue, costPrice, price, stock, stock, minStock, warrantyMonths, image]
  );

  return result.insertId;
}

async function updateProductFromPayload(productId, payload) {
  const existing = await query('SELECT * FROM products WHERE id = ? LIMIT 1', [productId]);
  if (existing.length === 0) {
    const error = new Error('Sản phẩm không tồn tại.');
    error.statusCode = 404;
    throw error;
  }

  const base = existing[0];
  const name = String(payload.name ?? base.name).trim();
  const description = payload.description != null ? String(payload.description).trim() : base.description;
  const categoryId = payload.categoryId ?? payload.category_id ?? base.category_id;
  const supplierId = payload.supplierId ?? payload.supplier_id ?? base.supplier_id;
  let category = payload.category != null ? String(payload.category).trim() : base.category;
  const codeValue = String(payload.sku ?? payload.code ?? payload.barcode ?? base.code ?? '').trim() || null;
  const barcodeValue = String(payload.barcode ?? payload.sku ?? payload.code ?? base.barcode ?? '').trim() || null;
  const costPrice = Number(payload.costPrice ?? payload.cost_price ?? base.cost_price ?? 0) || 0;
  const price = Number(payload.salePrice ?? payload.price ?? base.price ?? 0) || 0;
  const stock = Number(payload.stockQuantity ?? payload.stock_quantity ?? payload.stock ?? base.stock ?? 0) || 0;
  const minStock = Number(payload.minStock ?? payload.min_stock ?? base.min_stock ?? 0) || 0;
  const warrantyMonths = Number(payload.warrantyMonths ?? payload.warranty_months ?? base.warranty_months ?? 0) || 0;
  const image = String(payload.imageUrl ?? payload.image ?? base.image ?? '').trim() || null;

  if (!name || !price) {
    const error = new Error('Tên và giá sản phẩm là bắt buộc.');
    error.statusCode = 400;
    throw error;
  }

  if (!category && categoryId) {
    category = await getCategoryNameById(categoryId);
  }

  if (category && String(category).trim()) {
    const cats = await query('SELECT id FROM categories WHERE name = ? LIMIT 1', [category]);
    if (cats.length === 0) {
      const error = new Error('Danh mục không tồn tại. Vui lòng tạo danh mục trước.');
      error.statusCode = 400;
      throw error;
    }
  }

  if (supplierId) {
    const suppliers = await query('SELECT id FROM suppliers WHERE id = ? LIMIT 1', [supplierId]);
    if (suppliers.length === 0) {
      const error = new Error('Nhà cung cấp không tồn tại.');
      error.statusCode = 400;
      throw error;
    }
  }

  await query(
    `UPDATE products SET
       name = ?, description = ?, category = ?, category_id = ?, supplier_id = ?, code = ?, barcode = ?, cost_price = ?, price = ?, stock = ?, stock_quantity = ?, min_stock = ?, warranty_months = ?, image = ?
     WHERE id = ?`,
    [name, description, category || null, categoryId || null, supplierId || null, codeValue, barcodeValue, costPrice, price, stock, stock, minStock, warrantyMonths, image, productId]
  );

  return productId;
}

async function ensureDatabase() {
  console.log('[DB INIT] ensureDatabase start');
  await query(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(120) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin','manager','seller') NOT NULL DEFAULT 'seller',
    full_name VARCHAR(150) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  await query(`CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    category_id INT DEFAULT NULL,
    code VARCHAR(100),
    price DECIMAL(10,2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  console.log('[DB INIT] products table ensured');

  await query(`CREATE TABLE IF NOT EXISTS shifts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    status ENUM('PENDING','OPEN','CLOSED') NOT NULL DEFAULT 'PENDING',
    starting_cash DECIMAL(10,2) DEFAULT NULL,
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  console.log('[DB INIT] shifts table ensured');

  await query(`CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT DEFAULT NULL,
    product_name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    seller_id INT DEFAULT NULL,
    seller_name VARCHAR(120) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  console.log('[DB INIT] orders table ensured');

  await ensureColumn("products", "stock", "stock INT NOT NULL DEFAULT 0");
  await ensureColumn("products", "description", "description TEXT");
  await ensureColumn("products", "code", "code VARCHAR(100) DEFAULT NULL");
  await ensureColumn("products", "image", "image VARCHAR(255) DEFAULT NULL");
  await ensureColumn("products", "price", "price DECIMAL(10,2) NOT NULL DEFAULT 0");
  await ensureColumn("products", "category", "category VARCHAR(100) DEFAULT NULL");
  await ensureColumn("products", "category_id", "category_id INT DEFAULT NULL");
  await ensureColumn("products", "supplier_id", "supplier_id INT DEFAULT NULL");
  await ensureColumn("products", "barcode", "barcode VARCHAR(100) DEFAULT NULL");
  await ensureColumn("products", "cost_price", "cost_price DECIMAL(10,2) DEFAULT 0");
  await ensureColumn("products", "stock_quantity", "stock_quantity INT DEFAULT 0");
  await ensureColumn("products", "min_stock", "min_stock INT DEFAULT 0");
  await ensureColumn("products", "warranty_months", "warranty_months INT DEFAULT 0");

  await ensureColumn("orders", "product_id", "product_id INT DEFAULT NULL");
  await ensureColumn("orders", "product_name", "product_name VARCHAR(255) DEFAULT NULL");
  await ensureColumn("orders", "price", "price DECIMAL(10,2) DEFAULT 0");
  await ensureColumn("orders", "quantity", "quantity INT NOT NULL DEFAULT 1");
  await ensureColumn("orders", "seller_id", "seller_id INT DEFAULT NULL");
  await ensureColumn("orders", "seller_name", "seller_name VARCHAR(120) DEFAULT NULL");
  await ensureColumn("orders", "payment_cash_received", "payment_cash_received DECIMAL(10,2) DEFAULT NULL");
  await ensureColumn("shifts", "starting_cash", "starting_cash DECIMAL(10,2) DEFAULT NULL");
  await ensureEnumValues('shifts', 'status', ['PENDING', 'OPEN', 'CLOSED']);
  await ensureColumn("orders", "payment_cash_change", "payment_cash_change DECIMAL(10,2) DEFAULT NULL");
  await ensureColumn("orders", "discount_percent", "discount_percent DECIMAL(5,2) DEFAULT NULL");
  await ensureColumn("orders", "total_after_discount", "total_after_discount DECIMAL(10,2) DEFAULT NULL");
  await ensureColumn("orders", "payment_method", "payment_method VARCHAR(40) DEFAULT NULL");
  await ensureColumn("orders", "customer_id", "customer_id INT DEFAULT NULL");
  await ensureColumn("orders", "customer_name", "customer_name VARCHAR(150) DEFAULT NULL");
  await ensureColumn("orders", "customer_phone", "customer_phone VARCHAR(40) DEFAULT NULL");
  await ensureColumn("orders", "customer_company", "customer_company VARCHAR(255) DEFAULT NULL");
  await ensureColumn("orders", "customer_tax_code", "customer_tax_code VARCHAR(80) DEFAULT NULL");
  await ensureColumn("orders", "invoice_type", "invoice_type VARCHAR(40) DEFAULT NULL");
  await ensureColumn("orders", "created_at", "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
  await ensureColumn("orders", "order_number", "order_number VARCHAR(50) DEFAULT NULL");
  await query(`CREATE TABLE IF NOT EXISTS gtgt_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL,
    customer_name VARCHAR(150) DEFAULT NULL,
    customer_phone VARCHAR(40) DEFAULT NULL,
    customer_company VARCHAR(255) DEFAULT NULL,
    customer_tax_code VARCHAR(80) DEFAULT NULL,
    status ENUM('pending','issued') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  const users = await query("SELECT COUNT(*) AS total FROM users");
  if (users[0].total === 0) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    await query(
      "INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)",
      ["admin", passwordHash, "admin", "Quản trị hệ thống"]
    );
    console.log("Tạo tài khoản admin mặc định: admin / admin123");
  }

  // Create categories table for canonical category management
  await query(`CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    slug VARCHAR(180) DEFAULT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  await ensureColumn("categories", "slug", "slug VARCHAR(180) DEFAULT NULL");
  await ensureColumn("categories", "status", "status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'");

  const existingCategoryRows = await query('SELECT COUNT(*) AS total FROM categories');
  if (existingCategoryRows.length > 0 && existingCategoryRows[0].total === 0) {
    const productCategories = await query(
      'SELECT DISTINCT category AS name FROM products WHERE category IS NOT NULL AND category != ""'
    );
    for (const row of productCategories) {
      const name = String(row.name || '').trim();
      if (!name) continue;
      await query('INSERT IGNORE INTO categories (name, slug) VALUES (?, ?)', [name, slugify(name)]);
    }
  }

  await query(`CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(30) DEFAULT NULL,
    email VARCHAR(120) DEFAULT NULL,
    address VARCHAR(255) DEFAULT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  await ensureColumn("suppliers", "phone", "phone VARCHAR(30) DEFAULT NULL");
  await ensureColumn("suppliers", "email", "email VARCHAR(120) DEFAULT NULL");
  await ensureColumn("suppliers", "address", "address VARCHAR(255) DEFAULT NULL");
  await ensureColumn("suppliers", "status", "status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'");

  const unwantedSlugs = ['do-nha-bep', 'dien-gia-dung', 'vat-dung-gia-dinh'];
  await query(`DELETE FROM categories WHERE slug IN (?) OR name IN (?)`, [unwantedSlugs, ['Đồ nhà bếp','Điện gia dụng','Vật dụng gia đình']]).catch(() => {});

  const legacySupplierNames = ['Sunhouse', 'Kangaroo', 'LifeGood', 'SamsungHome', 'PanHome'];
  await query(`DELETE FROM suppliers WHERE name IN (?)`, [legacySupplierNames]).catch(() => {});

  await query(`CREATE TABLE IF NOT EXISTS inventory_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    quantity_change INT NOT NULL,
    reason VARCHAR(100) DEFAULT NULL,
    created_by INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  
  await query(`CREATE TABLE IF NOT EXISTS supplier_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(80) NOT NULL UNIQUE,
    supplier_id INT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED',
    note TEXT,
    created_by INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  await query(`CREATE TABLE IF NOT EXISTS supplier_order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_order_id INT NOT NULL,
    product_id INT DEFAULT NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    unit_cost DECIMAL(10,2) DEFAULT 0,
    FOREIGN KEY (supplier_order_id) REFERENCES supplier_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  await ensureColumn("inventory_logs", "product_id", "product_id INT NOT NULL");
  await ensureColumn("inventory_logs", "quantity_change", "quantity_change INT NOT NULL");
  await ensureColumn("inventory_logs", "reason", "reason VARCHAR(100) DEFAULT NULL");
  await ensureColumn("inventory_logs", "created_by", "created_by INT DEFAULT NULL");

  await query(`CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) DEFAULT NULL,
    phone VARCHAR(40) DEFAULT NULL,
    points INT NOT NULL DEFAULT 0,
    tier VARCHAR(50) DEFAULT 'Thành viên',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  await ensureColumn("customers", "name", "name VARCHAR(150) DEFAULT NULL");
  await ensureColumn("customers", "phone", "phone VARCHAR(40) DEFAULT NULL");
  await ensureColumn("customers", "points", "points INT NOT NULL DEFAULT 0");
  await ensureColumn("customers", "tier", "tier VARCHAR(50) DEFAULT 'Thành viên'");
  await ensureColumn("customers", "created_at", "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
  await ensureColumn("customers", "updated_at", "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

  await query("ALTER TABLE customers MODIFY COLUMN name VARCHAR(150) DEFAULT NULL");
  await query("ALTER TABLE customers MODIFY COLUMN phone VARCHAR(40) DEFAULT NULL");

  try {
    const duplicatePhone = await query(
      `SELECT phone FROM customers WHERE phone IS NOT NULL GROUP BY phone HAVING COUNT(*) > 1 LIMIT 1`
    );
    if (duplicatePhone.length === 0) {
      await query("ALTER TABLE customers ADD UNIQUE INDEX uniq_customers_phone (phone)");
    }
  } catch (err) {
    if (err.code !== "ER_DUP_KEYNAME" && err.code !== "ER_DUP_ENTRY") {
      throw err;
    }
  }

  await query("UPDATE customers SET tier = 'Thành viên' WHERE tier IN ('Bronze', 'bronze') OR tier IS NULL").catch(() => {});
  await query("UPDATE customers SET tier = 'Bạc' WHERE tier IN ('Silver', 'silver')").catch(() => {});
  await query("UPDATE customers SET tier = 'Vàng' WHERE tier IN ('Gold', 'gold')").catch(() => {});
  await query("UPDATE customers SET tier = 'Bạch kim' WHERE tier IN ('Platinum', 'platinum')").catch(() => {});
  await query("UPDATE customers SET tier = 'VIP' WHERE tier IN ('VIP', 'vip')").catch(() => {});
}

function createToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    AUTH_SECRET,
    { expiresIn: "12h" }
  );
}

function authorizeRoles(roles = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).send("Forbidden");
    }
    next();
  };
}

app.post("/auth/register", async (req, res) => {
  const { username, password, full_name, role } = req.body;
  if (!username || !password) {
    return res.status(400).send("Username and password are required.");
  }

  let effectiveRole = "seller";
  if (role) {
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).send("Vai trò không hợp lệ.");
    }
    if (role !== "seller") {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).send("Unauthorized");
      }
      const token = authHeader.split(" ")[1];
      try {
        const payload = jwt.verify(token, AUTH_SECRET);
        if (payload.role !== "admin") {
          return res.status(403).send("Forbidden");
        }
        effectiveRole = role;
      } catch (err) {
        return res.status(401).send("Invalid token");
      }
    }
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await query(
      "INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)",
      [username, passwordHash, full_name || null, effectiveRole]
    );
    res.send("Tạo tài khoản thành công.");
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).send("Tên đăng nhập đã tồn tại.");
    }
    console.error(err);
    res.status(500).send("Không thể tạo tài khoản.");
  }
});

app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send("Username and password are required.");
  }

  try {
    const users = await query("SELECT * FROM users WHERE username = ? LIMIT 1", [username]);
    if (users.length === 0) {
      return res.status(401).send("Sai tên đăng nhập hoặc mật khẩu.");
    }
    const user = users[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).send("Sai tên đăng nhập hoặc mật khẩu.");
    }

    const token = createToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name,
        created_at: user.created_at
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi đăng nhập.");
  }
});

app.get("/auth/me", authenticateToken, async (req, res) => {
  try {
    const users = await query("SELECT id, username, role, full_name, created_at FROM users WHERE id = ? LIMIT 1", [req.user.id]);
    if (users.length === 0) {
      return res.status(404).send("Người dùng không tồn tại.");
    }
    res.json(users[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi lấy thông tin người dùng.");
  }
});

app.get('/users', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  try {
    const users = await query('SELECT id, username, role, full_name, created_at FROM users ORDER BY created_at DESC');
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải danh sách nhân viên.');
  }
});

app.put('/auth/change-password', authenticateToken, async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;
  if (!oldPassword || !newPassword || !confirmPassword) {
    return res.status(400).send('Vui lòng điền đầy đủ thông tin.');
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).send('Mật khẩu mới không trùng khớp.');
  }
  try {
    const users = await query('SELECT password FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).send('Người dùng không tồn tại.');
    }
    const passwordMatch = await bcrypt.compare(oldPassword, users[0].password);
    if (!passwordMatch) {
      return res.status(401).send('Mật khẩu cũ không đúng.');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password = ? WHERE id = ?', [passwordHash, req.user.id]);
    res.send('Đổi mật khẩu thành công.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Không thể đổi mật khẩu.');
  }
});

app.get('/reports/sales', authenticateToken, authorizeRoles(['admin', 'manager', 'seller']), async (req, res) => {
  try {
    const daily = await query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS orders, COALESCE(SUM(price * quantity), 0) AS total_sales
       FROM orders
       WHERE created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) ASC`
    );

    const weekly = await query(
      `SELECT YEARWEEK(created_at, 1) AS week, COUNT(*) AS orders, COALESCE(SUM(price * quantity), 0) AS total_sales
       FROM orders
       WHERE created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 8 WEEK)
       GROUP BY YEARWEEK(created_at, 1)
       ORDER BY YEARWEEK(created_at, 1) ASC`
    );

    const weeklyFormatted = weekly.map(row => ({
      week: String(row.week),
      orders: row.orders,
      total_sales: row.total_sales
    }));

    res.json({ daily, weekly: weeklyFormatted });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải báo cáo doanh thu.');
  }
});

// Public version of sales for demo UI (no auth) - returns last 30 days + 8 weeks
app.get('/public/reports/sales', async (req, res) => {
  try {
    const { start, end, product_id, seller_id } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    
    // Filter by date range (with default 30 days)
    if (start) {
      where += ' AND created_at >= ?';
      params.push(start);
    } else {
      where += ' AND created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)';
    }
    if (end) {
      where += ' AND created_at <= ?';
      params.push(end);
    }
    
    // Filter by product
    if (product_id) {
      where += ' AND product_id = ?';
      params.push(Number(product_id));
    }
    
    // Filter by seller
    if (seller_id) {
      where += ' AND seller_id = ?';
      params.push(Number(seller_id));
    }

    const daily = await query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS orders, COALESCE(SUM(price * quantity), 0) AS total_sales
       FROM orders
       ${where}
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) ASC`, params
    );

    const weekly = await query(
      `SELECT YEARWEEK(created_at, 1) AS week, COUNT(*) AS orders, COALESCE(SUM(price * quantity), 0) AS total_sales
       FROM orders
       ${where}
       GROUP BY YEARWEEK(created_at, 1)
       ORDER BY YEARWEEK(created_at, 1) ASC`, params
    );

    const weeklyFormatted = weekly.map(row => ({ week: String(row.week), orders: row.orders, total_sales: row.total_sales }));
    res.json({ daily, weekly: weeklyFormatted });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải báo cáo doanh thu.');
  }
});

// Flexible summary report: total revenue, number of orders, average order value
app.get('/reports/summary', authenticateToken, authorizeRoles(['admin','manager','seller']), async (req, res) => {
  try {
    const { start, end, product_id, seller_id } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (start) { where += ' AND created_at >= ?'; params.push(start); }
    if (end) { where += ' AND created_at <= ?'; params.push(end); }
    if (product_id) { where += ' AND product_id = ?'; params.push(Number(product_id)); }
    if (seller_id) { where += ' AND seller_id = ?'; params.push(Number(seller_id)); }

    // aggregate per order_number to avoid double counting items
    const rows = await query(
      `SELECT
         COUNT(DISTINCT order_number) AS order_count,
         COALESCE(SUM(item_total),0) AS total_revenue,
         COALESCE(AVG(order_total),0) AS avg_order_value
       FROM (
         SELECT order_number, SUM(price * quantity) AS order_total, SUM(price * quantity) AS item_total
         FROM orders
         ${where}
         GROUP BY order_number
       ) t`, params
    );

    const r = rows[0] || { order_count: 0, total_revenue: 0, avg_order_value: 0 };
    res.json({ order_count: Number(r.order_count || 0), total_revenue: Number(r.total_revenue || 0), avg_order_value: Number(r.avg_order_value || 0) });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải báo cáo tóm tắt.');
  }
});

// Public summary (no auth) for demo UI
app.get('/public/reports/summary', async (req, res) => {
  try {
    const { start, end, product_id, seller_id } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (start) { where += ' AND created_at >= ?'; params.push(start); }
    if (end) { where += ' AND created_at <= ?'; params.push(end); }
    if (product_id) { where += ' AND product_id = ?'; params.push(Number(product_id)); }
    if (seller_id) { where += ' AND seller_id = ?'; params.push(Number(seller_id)); }

    const rows = await query(
      `SELECT
         COUNT(DISTINCT order_number) AS order_count,
         COALESCE(SUM(item_total),0) AS total_revenue,
         COALESCE(AVG(order_total),0) AS avg_order_value
       FROM (
         SELECT order_number, SUM(price * quantity) AS order_total, SUM(price * quantity) AS item_total
         FROM orders
         ${where}
         GROUP BY order_number
       ) t`, params
    );

    const monthlyParams = [];
    let monthlyWhere = 'WHERE DATE(created_at) BETWEEN DATE_FORMAT(CURRENT_DATE(), "%Y-%m-01") AND LAST_DAY(CURRENT_DATE())';
    if (product_id) { monthlyWhere += ' AND product_id = ?'; monthlyParams.push(Number(product_id)); }
    if (seller_id) { monthlyWhere += ' AND seller_id = ?'; monthlyParams.push(Number(seller_id)); }

    const monthlyRows = await query(
      `SELECT
         COUNT(DISTINCT order_number) AS order_count,
         COALESCE(SUM(price * quantity),0) AS total_revenue,
         COALESCE(AVG(price * quantity),0) AS avg_order_value
       FROM orders
       ${monthlyWhere}`, monthlyParams
    );

    // daily summary: if start/end provided use those, otherwise default to today
    let dailyWhere = '';
    const dailyParams = [];
    if (start || end) {
      dailyWhere = where; // uses created_at filters from earlier
      dailyParams.push(...params);
    } else {
      // default to today's date
      dailyWhere = 'WHERE DATE(created_at) = CURRENT_DATE()';
      if (product_id) { dailyWhere += ' AND product_id = ?'; dailyParams.push(Number(product_id)); }
      if (seller_id) { dailyWhere += ' AND seller_id = ?'; dailyParams.push(Number(seller_id)); }
    }

    const dailySummaryRows = await query(
      `SELECT
         COUNT(DISTINCT order_number) AS daily_orders,
         COALESCE(SUM(price * quantity), 0) AS daily_revenue
       FROM orders
       ${dailyWhere}`, dailyParams
    );

    const r = rows[0] || { order_count: 0, total_revenue: 0, avg_order_value: 0 };
    const m = monthlyRows[0] || { order_count: 0, total_revenue: 0, avg_order_value: 0 };
    const d = dailySummaryRows[0] || { daily_orders: 0, daily_revenue: 0 };

    res.json({
      month_order_count: Number(m.order_count || 0),
      month_total_revenue: Number(m.total_revenue || 0),
      month_avg_order_value: Number(m.avg_order_value || 0),
      daily_revenue: Number(d.daily_revenue || 0),
      daily_orders: Number(d.daily_orders || 0)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải báo cáo tóm tắt.');
  }
});

// Products report: top selling, revenue by product, stock
app.get('/reports/products', authenticateToken, authorizeRoles(['admin','manager']), async (req, res) => {
  try {
    const { start, end, limit } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (start) { where += ' AND o.created_at >= ?'; params.push(start); }
    if (end) { where += ' AND o.created_at <= ?'; params.push(end); }
    const lim = Number(limit) || 20;

    const top = await query(
      `SELECT o.product_id, o.product_name, SUM(o.quantity) AS total_qty, COALESCE(SUM(o.price * o.quantity),0) AS total_revenue, p.stock
       FROM orders o
       INNER JOIN products p ON p.id = o.product_id
       ${where}
       GROUP BY o.product_id, o.product_name, p.stock
       ORDER BY total_qty DESC
       LIMIT ?`, [...params, lim]
    );

    const byProduct = await query(
      `SELECT o.product_id, o.product_name, SUM(o.quantity) AS total_qty, COALESCE(SUM(o.price * o.quantity),0) AS total_revenue
       FROM orders o
       INNER JOIN products p ON p.id = o.product_id
       ${where}
       GROUP BY o.product_id, o.product_name
       ORDER BY total_revenue DESC
       LIMIT 200`, params
    );

    res.json({ top, byProduct });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải báo cáo sản phẩm.');
  }
});

// Public products report
app.get('/public/reports/products', async (req, res) => {
  try {
    const { start, end, limit } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (start) { where += ' AND o.created_at >= ?'; params.push(start); }
    if (end) { where += ' AND o.created_at <= ?'; params.push(end); }
    const lim = Number(limit) || 10;

    const top = await query(
      `SELECT o.product_id, o.product_name, SUM(o.quantity) AS total_qty, COALESCE(SUM(o.price * o.quantity),0) AS total_revenue, p.stock
       FROM orders o
       INNER JOIN products p ON p.id = o.product_id
       ${where}
       GROUP BY o.product_id, o.product_name, p.stock
       ORDER BY total_qty DESC
       LIMIT ?`, [...params, lim]
    );

    const byProduct = await query(
      `SELECT o.product_id, o.product_name, SUM(o.quantity) AS total_qty, COALESCE(SUM(o.price * o.quantity),0) AS total_revenue
       FROM orders o
       INNER JOIN products p ON p.id = o.product_id
       ${where}
       GROUP BY o.product_id, o.product_name
       ORDER BY total_revenue DESC
       LIMIT 200`, params
    );

    res.json({ top, byProduct });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải báo cáo sản phẩm.');
  }
});

// Customers report: top customers by revenue and purchase count
app.get('/reports/customers', authenticateToken, authorizeRoles(['admin','manager']), async (req, res) => {
  try {
    const { start, end, limit } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (start) { where += ' AND o.created_at >= ?'; params.push(start); }
    if (end) { where += ' AND o.created_at <= ?'; params.push(end); }
    const lim = Number(limit) || 50;

    const rows = await query(
      `SELECT o.customer_id, o.customer_name, COUNT(DISTINCT o.order_number) AS orders_count, COALESCE(SUM(o.price * o.quantity),0) AS total_revenue
       FROM orders o
       ${where}
       GROUP BY o.customer_id, o.customer_name
       ORDER BY total_revenue DESC
       LIMIT ?`, [...params, lim]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải báo cáo khách hàng.');
  }
});

// Public customers report
app.get('/public/reports/customers', async (req, res) => {
  try {
    const { start, end, limit } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (start) { where += ' AND o.created_at >= ?'; params.push(start); }
    if (end) { where += ' AND o.created_at <= ?'; params.push(end); }
    const lim = Number(limit) || 50;

    const rows = await query(
      `SELECT o.customer_id, o.customer_name, COUNT(DISTINCT o.order_number) AS orders_count, COALESCE(SUM(o.price * o.quantity),0) AS total_revenue
       FROM orders o
       ${where}
       GROUP BY o.customer_id, o.customer_name
       ORDER BY total_revenue DESC
       LIMIT ?`, [...params, lim]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải báo cáo khách hàng.');
  }
});

// Staff report: revenue and orders processed by staff
app.get('/reports/staff', authenticateToken, authorizeRoles(['admin','manager']), async (req, res) => {
  try {
    const { start, end, limit } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (start) { where += ' AND o.created_at >= ?'; params.push(start); }
    if (end) { where += ' AND o.created_at <= ?'; params.push(end); }
    const lim = Number(limit) || 50;

    const rows = await query(
      `SELECT o.seller_id, o.seller_name, COUNT(DISTINCT o.order_number) AS orders_count, COALESCE(SUM(o.price * o.quantity),0) AS total_revenue
       FROM orders o
       ${where}
       GROUP BY o.seller_id, o.seller_name
       ORDER BY total_revenue DESC
       LIMIT ?`, [...params, lim]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải báo cáo nhân viên.');
  }
});

// Public staff report
app.get('/public/reports/staff', async (req, res) => {
  try {
    const { start, end, limit } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (start) { where += ' AND o.created_at >= ?'; params.push(start); }
    if (end) { where += ' AND o.created_at <= ?'; params.push(end); }
    const lim = Number(limit) || 50;

    const rows = await query(
      `SELECT o.seller_id, o.seller_name, COUNT(DISTINCT o.order_number) AS orders_count, COALESCE(SUM(o.price * o.quantity),0) AS total_revenue
       FROM orders o
       ${where}
       GROUP BY o.seller_id, o.seller_name
       ORDER BY total_revenue DESC
       LIMIT ?`, [...params, lim]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải báo cáo nhân viên.');
  }
});

// Export CSV for basic reports (products/customers/staff/summary)
app.get('/reports/export', authenticateToken, authorizeRoles(['admin','manager']), async (req, res) => {
  try {
    const { report = 'products', start, end } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (start) { where += ' AND o.created_at >= ?'; params.push(start); }
    if (end) { where += ' AND o.created_at <= ?'; params.push(end); }

    let rows = [];
    let header = [];
    if (report === 'products') {
      rows = await query(
        `SELECT o.product_id, o.product_name, SUM(o.quantity) AS total_qty, COALESCE(SUM(o.price * o.quantity),0) AS total_revenue, p.stock
         FROM orders o
         LEFT JOIN products p ON p.id = o.product_id
         ${where}
         GROUP BY o.product_id, o.product_name, p.stock
         ORDER BY total_qty DESC`, params
      );
      header = ['product_id','product_name','total_qty','total_revenue','stock'];
    } else if (report === 'customers') {
      rows = await query(
        `SELECT o.customer_id, o.customer_name, COUNT(DISTINCT o.order_number) AS orders_count, COALESCE(SUM(o.price * o.quantity),0) AS total_revenue
         FROM orders o
         ${where}
         GROUP BY o.customer_id, o.customer_name
         ORDER BY total_revenue DESC`, params
      );
      header = ['customer_id','customer_name','orders_count','total_revenue'];
    } else if (report === 'staff') {
      rows = await query(
        `SELECT o.seller_id, o.seller_name, COUNT(DISTINCT o.order_number) AS orders_count, COALESCE(SUM(o.price * o.quantity),0) AS total_revenue
         FROM orders o
         ${where}
         GROUP BY o.seller_id, o.seller_name
         ORDER BY total_revenue DESC`, params
      );
      header = ['seller_id','seller_name','orders_count','total_revenue'];
    } else {
      return res.status(400).send('Loại báo cáo không hỗ trợ xuất.');
    }

    // build CSV
    const lines = [];
    lines.push(header.join(','));
    for (const r of rows) {
      const vals = header.map(h => {
        const v = r[h] == null ? '' : String(r[h]);
        if (v.includes(',') || v.includes('\n') || v.includes('"')) return '"' + v.replace(/"/g, '""') + '"';
        return v;
      });
      lines.push(vals.join(','));
    }
    const content = lines.join('\n');
    const filename = `report-${report}-${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi xuất báo cáo.');
  }
});

// Public export (CSV) for demo UI
app.get('/public/reports/export', async (req, res) => {
  try {
    const { report = 'products', start, end } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (start) { where += ' AND o.created_at >= ?'; params.push(start); }
    if (end) { where += ' AND o.created_at <= ?'; params.push(end); }

    let rows = [];
    let header = [];
    if (report === 'products') {
      rows = await query(
        `SELECT o.product_id, o.product_name, SUM(o.quantity) AS total_qty, COALESCE(SUM(o.price * o.quantity),0) AS total_revenue, p.stock
         FROM orders o
         LEFT JOIN products p ON p.id = o.product_id
         ${where}
         GROUP BY o.product_id, o.product_name, p.stock
         ORDER BY total_qty DESC`, params
      );
      header = ['product_id','product_name','total_qty','total_revenue','stock'];
    } else if (report === 'customers') {
      rows = await query(
        `SELECT o.customer_id, o.customer_name, COUNT(DISTINCT o.order_number) AS orders_count, COALESCE(SUM(o.price * o.quantity),0) AS total_revenue
         FROM orders o
         ${where}
         GROUP BY o.customer_id, o.customer_name
         ORDER BY total_revenue DESC`, params
      );
      header = ['customer_id','customer_name','orders_count','total_revenue'];
    } else if (report === 'staff') {
      rows = await query(
        `SELECT o.seller_id, o.seller_name, COUNT(DISTINCT o.order_number) AS orders_count, COALESCE(SUM(o.price * o.quantity),0) AS total_revenue
         FROM orders o
         ${where}
         GROUP BY o.seller_id, o.seller_name
         ORDER BY total_revenue DESC`, params
      );
      header = ['seller_id','seller_name','orders_count','total_revenue'];
    } else {
      return res.status(400).send('Loại báo cáo không hỗ trợ xuất.');
    }

    const lines = [];
    lines.push(header.join(','));
    for (const r of rows) {
      const vals = header.map(h => {
        const v = r[h] == null ? '' : String(r[h]);
        if (v.includes(',') || v.includes('\n') || v.includes('"')) return '"' + v.replace(/"/g, '""') + '"';
        return v;
      });
      lines.push(vals.join(','));
    }
    const content = lines.join('\n');
    const filename = `report-${report}-${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi xuất báo cáo.');
  }
});

// Diagnostic test data for frontend connectivity checks
app.get('/public/reports/test', async (req, res) => {
  try {
    const sample = {
      daily: [ { date: new Date().toISOString().split('T')[0], orders: 3, total_sales: 120000 }, { date: new Date(Date.now()-86400000).toISOString().split('T')[0], orders: 5, total_sales: 200000 } ],
      weekly: [ { week: '202601', orders: 8, total_sales: 320000 } ],
      top: [ { product_id: 1, product_name: 'Sản phẩm A', total_qty: 10, total_revenue: 500000, stock: 20 } ],
      byProduct: [ { product_id: 1, product_name: 'Sản phẩm A', total_qty: 10, total_revenue: 500000 } ],
      customers: [ { customer_id: 1, customer_name: 'Khách A', orders_count: 3, total_revenue: 150000 } ],
      staff: [ { seller_id: 1, seller_name: 'NV A', orders_count: 5, total_revenue: 220000 } ]
    };
    res.json(sample);
  } catch (err) {
    console.error('reports test error', err);
    res.status(500).send('Test error');
  }
});

// Public staff list for populating filters when not authenticated
app.get('/api/staff_public', async (req, res) => {
  try {
    const rows = await query('SELECT id, username, full_name FROM users ORDER BY full_name ASC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải danh sách nhân viên.');
  }
});

app.get('/inventory', authenticateToken, authorizeRoles(['admin', 'manager']), async (req, res) => {
  try {
    const logs = await query(
      `SELECT l.id, l.product_id, p.name AS product_name, s.name AS supplier_name, l.quantity_change, l.reason, l.created_at, u.full_name AS created_by_user
       FROM inventory_logs l
       LEFT JOIN products p ON l.product_id = p.id
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       LEFT JOIN users u ON l.created_by = u.id
       ORDER BY l.created_at DESC LIMIT 200`
    );
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải tồn kho.');
  }
});

app.post('/inventory/import', authenticateToken, authorizeRoles(['admin', 'manager']), async (req, res) => {
  const { product_id, quantity } = req.body;
  const qty = Number(quantity || 0);
  if (!product_id || qty <= 0) {
    return res.status(400).send('Sản phẩm hoặc số lượng không hợp lệ.');
  }
  try {
    const product = await query('SELECT id FROM products WHERE id = ? LIMIT 1', [product_id]);
    if (product.length === 0) {
      return res.status(404).send('Sản phẩm không tồn tại.');
    }
    await query(
      'INSERT INTO inventory_logs (product_id, quantity_change, reason, created_by) VALUES (?, ?, ?, ?)',
      [product_id, qty, 'Nhập kho', req.user.id]
    );
    await query('UPDATE products SET stock = stock + ? WHERE id = ?', [qty, product_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi nhập kho.');
  }
});

app.post('/inventory/export', authenticateToken, authorizeRoles(['admin', 'manager']), async (req, res) => {
  const { product_id, quantity } = req.body;
  const qty = Number(quantity || 0);
  if (!product_id || qty <= 0) {
    return res.status(400).send('Sản phẩm hoặc số lượng không hợp lệ.');
  }
  try {
    const products = await query('SELECT id, stock FROM products WHERE id = ? LIMIT 1', [product_id]);
    if (products.length === 0) {
      return res.status(404).send('Sản phẩm không tồn tại.');
    }
    const currentStock = Number(products[0].stock || 0);
    if (qty > currentStock) {
      return res.status(400).send('Số lượng xuất lớn hơn tồn kho.');
    }
    await query(
      'INSERT INTO inventory_logs (product_id, quantity_change, reason, created_by) VALUES (?, ?, ?, ?)',
      [product_id, -qty, 'Xuất kho', req.user.id]
    );
    await query('UPDATE products SET stock = GREATEST(stock - ?, 0) WHERE id = ?', [qty, product_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi xuất kho.');
  }
});

// Branch API removed as branch management was disabled.


app.get('/api/categories', async (req, res) => {
  try {
    const categories = await query('SELECT id, name FROM categories WHERE status = ? ORDER BY name ASC', [req.query.status || 'ACTIVE']);
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải danh mục.');
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const soldOnly = String(req.query.sold || '').toLowerCase() === '1' || String(req.query.sold || '').toLowerCase() === 'true';
    const searchValue = String(req.query.search || '').trim();
    if (soldOnly) {
      const products = await query(
        `SELECT DISTINCT p.id, p.name, p.description, p.category, p.price, p.stock, p.image, p.code, p.barcode, p.supplier_id
         FROM products p
         LEFT JOIN orders o ON o.product_id = p.id
         WHERE (p.stock IS NOT NULL AND p.stock > 0) OR o.product_id IS NOT NULL
         ORDER BY p.name ASC`
      );
      return res.json(products);
    }

    let sql = `SELECT id, name, description, category, price, stock, image, code, barcode, supplier_id FROM products`;
    const params = [];
    if (searchValue) {
      sql += ' WHERE code LIKE ? OR barcode LIKE ? OR name LIKE ?';
      const term = `%${searchValue}%`;
      params.push(term, term, term);
    }
    sql += ' ORDER BY name ASC';
    const products = await query(sql, params);
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải sản phẩm.');
  }
});

app.get('/api/products/:barcode', async (req, res) => {
  try {
    const barcode = String(req.params.barcode || '').trim();
    if (!barcode) return res.status(400).send('Barcode không hợp lệ.');

    const products = await query(
      'SELECT id, name, description, category, price, stock, image, code, barcode, supplier_id FROM products WHERE barcode = ? OR code = ? LIMIT 1',
      [barcode, barcode]
    );

    if (products.length === 0) {
      return res.status(404).send('Không tìm thấy sản phẩm với barcode này.');
    }

    res.json(products[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tìm sản phẩm theo barcode.');
  }
});

// Safe register: ensure we don't register duplicate route handlers
// If another part of the code already added a handler for this path, skip adding again.
function registerOnce(path, handler) {
  try {
    if (app._router && Array.isArray(app._router.stack)) {
      const exists = app._router.stack.some(mw => mw.route && mw.route.path === path);
      if (exists) return;
    }
  } catch (e) {
    // ignore and attempt to register
  }
  app.get(path, handler);
}

// Register a simple JSON-style barcode lookup that returns { found, product }
registerOnce('/api/products/:barcode', async (req, res) => {
  try {
    const barcode = String(req.params.barcode || '').trim();
    if (!barcode) return res.status(400).json({ found: false, error: 'Barcode không hợp lệ.' });

    const rows = await query('SELECT id, name, price, stock, image, code, barcode FROM products WHERE barcode = ? OR code = ? LIMIT 1', [barcode, barcode]);
    if (!rows || rows.length === 0) return res.json({ found: false });
    return res.json({ found: true, product: rows[0] });
  } catch (err) {
    console.error('barcode lookup error', err);
    return res.status(500).json({ found: false, error: 'Lỗi server.' });
  }
});

app.get('/api/suppliers', async (req, res) => {
  try {
    const status = req.query.status || 'ACTIVE';
    const limit = Number(req.query.limit) || 100;
    const suppliers = await query('SELECT id, name, phone, email, address, status FROM suppliers WHERE status = ? ORDER BY name ASC LIMIT ?', [status, limit]);
    res.json(suppliers);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải nhà cung cấp.');
  }
});

app.post('/api/suppliers', authenticateToken, authorizeRoles(['admin', 'manager']), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').trim() || null;
    const email = String(req.body.email || '').trim() || null;
    const address = String(req.body.address || '').trim() || null;
    if (!name) {
      return res.status(400).send('Tên nhà cung cấp là bắt buộc.');
    }
    const result = await query(
      'INSERT INTO suppliers (name, phone, email, address, status) VALUES (?, ?, ?, ?, ?)',
      [name, phone, email, address, 'ACTIVE']
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).send('Không thể thêm nhà cung cấp.');
  }
});

app.post('/api/assign-products', authenticateToken, authorizeRoles(['admin', 'manager']), async (req, res) => {
  try {
    const supplierId = Number(req.body.supplierId);
    const productIds = Array.isArray(req.body.productIds) ? req.body.productIds.map(Number) : [];
    
    if (!supplierId || productIds.length === 0) {
      return res.status(400).send('Nhà cung cấp và sản phẩm là bắt buộc.');
    }
    
    // Check if supplier exists
    const suppliers = await query('SELECT id FROM suppliers WHERE id = ? LIMIT 1', [supplierId]);
    if (suppliers.length === 0) {
      return res.status(404).send('Nhà cung cấp không tồn tại.');
    }
    
    // Update all products with the new supplier_id
    for (const productId of productIds) {
      await query('UPDATE products SET supplier_id = ? WHERE id = ?', [supplierId, productId]);
    }
    
    res.status(200).json({ success: true, updatedCount: productIds.length });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi gán sản phẩm.');
  }
});

app.delete('/users/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  const userId = Number(req.params.id);
  if (!userId) {
    return res.status(400).send('ID người dùng không hợp lệ.');
  }
  try {
    const user = await query('SELECT id FROM users WHERE id = ? LIMIT 1', [userId]);
    if (user.length === 0) {
      return res.status(404).send('Người dùng không tồn tại.');
    }
    await query('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send('Không thể xóa tài khoản.');
  }
});

app.get('/products', async (req, res) => {
  try {
    const categoryFilter = req.query.category ? String(req.query.category).trim() : '';
    let sql = `SELECT id, name, description, category, price, stock, image, code, barcode, supplier_id FROM products`;
    const params = [];
    if (categoryFilter) {
      sql += ' WHERE category = ?';
      params.push(categoryFilter);
    }
    sql += ' ORDER BY name ASC';
    const products = await query(sql, params);
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải sản phẩm.');
  }
});

app.post('/api/products', authenticateToken, authorizeRoles(['admin', 'manager']), async (req, res) => {
  try {
    const productId = await createProductFromPayload(req.body);
    res.status(201).json({ id: productId });
  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 500).send(err.message || 'Không thể tạo sản phẩm.');
  }
});

app.get('/categories', async (req, res) => {
  try {
    const categories = await query('SELECT id, name FROM categories ORDER BY name ASC');
    if (categories.length > 0) {
      return res.json(categories);
    }

    const productCategories = await query(
      'SELECT DISTINCT NULL AS id, category AS name FROM products WHERE category IS NOT NULL AND category != "" ORDER BY category ASC'
    );
    res.json(productCategories);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải danh mục.');
  }
});

app.post('/products', authenticateToken, authorizeRoles(['admin', 'manager']), async (req, res) => {
  try {
    const productId = await createProductFromPayload(req.body);
    res.status(201).json({ id: productId });
  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 500).send(err.message || 'Không thể tạo sản phẩm.');
  }
});

app.put('/products/:id', authenticateToken, authorizeRoles(['admin', 'manager']), async (req, res) => {
  try {
    const productId = Number(req.params.id);
    if (Number.isNaN(productId) || productId <= 0) {
      return res.status(400).send('ID sản phẩm không hợp lệ.');
    }
    await updateProductFromPayload(productId, req.body);
    res.send('Sản phẩm đã được cập nhật.');
  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 500).send(err.message || 'Không thể cập nhật sản phẩm.');
  }
});

app.delete('/products/:id', authenticateToken, authorizeRoles(['admin', 'manager']), async (req, res) => {
  try {
    const productId = Number(req.params.id);
    if (Number.isNaN(productId) || productId <= 0) {
      return res.status(400).send('ID sản phẩm không hợp lệ.');
    }
    await query('DELETE FROM products WHERE id = ?', [productId]);
    res.send('Sản phẩm đã được xóa.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Không thể xóa sản phẩm.');
  }
});

app.post('/categories', authenticateToken, authorizeRoles(['admin', 'manager']), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).send('Tên danh mục là bắt buộc.');
    const slug = slugify(name);
    const result = await query('INSERT INTO categories (name, slug) VALUES (?, ?)', [name, slug]);
    res.status(201).json({ id: result.insertId, name });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).send('Danh mục đã tồn tại.');
    res.status(500).send('Không thể tạo danh mục.');
  }
});

app.put('/categories/:id', authenticateToken, authorizeRoles(['admin', 'manager']), async (req, res) => {
  try {
    const categoryId = Number(req.params.id);
    if (Number.isNaN(categoryId) || categoryId <= 0) {
      return res.status(400).send('ID danh mục không hợp lệ.');
    }
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).send('Tên danh mục là bắt buộc.');
    const slug = slugify(name);
    await query('UPDATE categories SET name = ?, slug = ? WHERE id = ?', [name, slug, categoryId]);
    res.send('Danh mục đã được cập nhật.');
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).send('Danh mục đã tồn tại.');
    res.status(500).send('Không thể cập nhật danh mục.');
  }
});

app.delete('/categories/:id', authenticateToken, authorizeRoles(['admin', 'manager']), async (req, res) => {
  try {
    const categoryId = Number(req.params.id);
    if (Number.isNaN(categoryId) || categoryId <= 0) {
      return res.status(400).send('ID danh mục không hợp lệ.');
    }
    await query('DELETE FROM categories WHERE id = ?', [categoryId]);
    res.send('Danh mục đã được xóa.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Không thể xóa danh mục.');
  }
});

app.get('/orders', async (req, res) => {
  try {
    const orders = await query(
      `SELECT id, product_id, product_name, price, quantity, seller_id, seller_name, payment_method, payment_cash_received, payment_cash_change, discount_percent, total_after_discount, customer_id, customer_name, customer_phone, customer_company, customer_tax_code, invoice_type, order_number, created_at
       FROM orders ORDER BY created_at DESC LIMIT 200`
    );
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải đơn hàng.');
  }
});

app.get('/shifts/current', authenticateToken, async (req, res) => {
  try {
    const status = String(req.query.status || '').trim().toUpperCase();
    const userId = req.query.userId ? Number(req.query.userId) : null;
    const params = [];
    let sql = `SELECT id, user_id, status, starting_cash, opened_at, closed_at, created_at FROM shifts`;

    const conditions = [];
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (req.user.role !== 'admin') {
      conditions.push('user_id = ?');
      params.push(req.user.id);
    } else if (userId && Number.isInteger(userId) && userId > 0) {
      conditions.push('user_id = ?');
      params.push(userId);
    }

    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY opened_at DESC';
    const shifts = await query(sql, params);
    res.json(shifts);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải danh sách ca.');
  }
});

app.post('/shifts/open', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  try {
    console.log('[DEBUG] /shifts/open body:', req.body, 'user:', req.user);
    let targetUserId = req.user.id;
    if (req.body && req.body.userId) {
      targetUserId = Number(req.body.userId);
      if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return res.status(400).send('ID người dùng không hợp lệ.');
      }
    }

    let status = String(req.body?.status || 'PENDING').trim().toUpperCase();
    if (!['PENDING', 'OPEN'].includes(status)) {
      return res.status(400).send('Trạng thái ca không hợp lệ.');
    }

    let startingCash = null;
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'startingCash')) {
      startingCash = Number(req.body.startingCash);
      if (isNaN(startingCash) || startingCash < 0) {
        return res.status(400).send('Tiền đầu ca phải lớn hơn hoặc bằng 0.');
      }
    }

    // If admin is opening a shift for another user, always create a pending shift.
    if (targetUserId !== req.user.id) {
      status = 'PENDING';
      startingCash = null;
    }

    const activeShift = await query(
      'SELECT id FROM shifts WHERE user_id = ? AND status = ? LIMIT 1',
      [targetUserId, 'OPEN']
    );
    if (activeShift.length > 0) {
      return res.status(400).send('Nhân viên đã có ca đang mở.');
    }

    if (status === 'OPEN') {
      if (startingCash === null || startingCash <= 0) {
        return res.status(400).send('Khi mở ca trực tiếp, phải nhập tiền đầu ca lớn hơn 0.');
      }
      const result = await query(
        'INSERT INTO shifts (user_id, status, starting_cash, opened_at, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [targetUserId, 'OPEN', startingCash]
      );
      const [shift] = await query('SELECT id, user_id, status, starting_cash, opened_at, closed_at, created_at FROM shifts WHERE id = ? LIMIT 1', [result.insertId]);
      return res.json(shift);
    }

    const result = await query(
      'INSERT INTO shifts (user_id, status, starting_cash, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
      [targetUserId, 'PENDING', startingCash]
    );

    const [shift] = await query('SELECT id, user_id, status, starting_cash, opened_at, closed_at, created_at FROM shifts WHERE id = ? LIMIT 1', [result.insertId]);
    res.json(shift);
  } catch (err) {
    console.error('[ERROR] /shifts/open', err);
    res.status(500).send('Không thể mở ca.');
  }
});

// Endpoint for the target user (or admin) to start a pending shift by providing startingCash
app.post('/shifts/start', authenticateToken, authorizeRoles(['seller','manager','admin']), async (req, res) => {
  try {
    console.log('[DEBUG] /shifts/start', { user: req.user, body: req.body });
    let targetUserId = req.user.id;
    if (req.body && req.body.userId) {
      // only admin can start a shift for someone else
      if (req.user.role !== 'admin') return res.status(403).send('Không có quyền bắt đầu ca cho người khác.');
      targetUserId = Number(req.body.userId);
      if (!Number.isInteger(targetUserId) || targetUserId <= 0) return res.status(400).send('ID người dùng không hợp lệ.');
    }

    const startingCash = Number(req.body && req.body.startingCash ? req.body.startingCash : 0);
    if (isNaN(startingCash) || startingCash <= 0) return res.status(400).send('Tiền đầu ca phải lớn hơn 0.');

    const activeShift = await query('SELECT id FROM shifts WHERE user_id = ? AND status = ? LIMIT 1', [targetUserId, 'OPEN']);
    if (activeShift.length > 0) {
      return res.status(400).send('Nhân viên đã có ca đang mở.');
    }

    const pending = await query('SELECT id FROM shifts WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1', [targetUserId, 'PENDING']);
    let shiftId;

    if (pending && pending.length > 0) {
      shiftId = pending[0].id;
      await query('UPDATE shifts SET status = ?, starting_cash = ?, opened_at = CURRENT_TIMESTAMP WHERE id = ?', ['OPEN', startingCash, shiftId]);
    } else {
      const result = await query(
        'INSERT INTO shifts (user_id, status, starting_cash, opened_at, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [targetUserId, 'OPEN', startingCash]
      );
      shiftId = result.insertId;
    }

    const [shift] = await query('SELECT id, user_id, status, starting_cash, opened_at, closed_at, created_at FROM shifts WHERE id = ? LIMIT 1', [shiftId]);
    res.json(shift);
  } catch (err) {
    console.error(err);
    res.status(500).send('Không thể bắt đầu ca.');
  }
});

app.post('/shifts/close', authenticateToken, authorizeRoles(['seller','manager','admin']), async (req, res) => {
  try {
    let targetUserId = req.user.id;
    if (req.body && req.body.userId) {
      if (req.user.role !== 'admin') {
        return res.status(403).send('Không có quyền đóng ca cho người khác.');
      }
      targetUserId = Number(req.body.userId);
      if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return res.status(400).send('ID người dùng không hợp lệ.');
      }
    }

    const openShifts = await query(
      'SELECT id FROM shifts WHERE user_id = ? AND status = ?',
      [targetUserId, 'OPEN']
    );
    if (openShifts.length === 0) {
      return res.status(400).send('Không có ca đang mở để đóng.');
    }

    const shiftIds = openShifts.map(shift => shift.id);
    const placeholders = shiftIds.map(() => '?').join(',');
    await query(`UPDATE shifts SET status = ?, closed_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`, ['CLOSED', ...shiftIds]);

    if (req.user.role === 'manager' && !req.body?.userId) {
      await query(
        'UPDATE shifts SET status = ?, closed_at = CURRENT_TIMESTAMP WHERE status = ? AND user_id != ? AND user_id IN (SELECT id FROM users WHERE role = ?)',
        ['CLOSED', 'OPEN', targetUserId, 'seller']
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send('Không thể đóng ca.');
  }
});

app.get('/customers', authenticateToken, async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    let sql = 'SELECT id, name, phone, points, tier, created_at FROM customers';
    const params = [];
    if (search) {
      sql += ' WHERE name LIKE ? OR phone LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY created_at DESC LIMIT 200';
    const customers = await query(sql, params);
    res.json(customers);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải khách hàng.');
  }
});

app.get('/customers/:id', authenticateToken, async (req, res) => {
  const customerId = Number(req.params.id);
  if (Number.isNaN(customerId) || customerId <= 0) {
    return res.status(400).send('ID khách hàng không hợp lệ.');
  }
  try {
    const customers = await query('SELECT id, name, phone, points, tier, created_at FROM customers WHERE id = ? LIMIT 1', [customerId]);
    if (customers.length === 0) {
      return res.status(404).send('Khách hàng không tồn tại.');
    }
    res.json(customers[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải thông tin khách hàng.');
  }
});

async function handleCustomerUpdate(req, res) {
  const customerId = Number(req.params.id);
  if (Number.isNaN(customerId) || customerId <= 0) {
    return res.status(400).send('ID khách hàng không hợp lệ.');
  }
  const name = String(req.body?.name || '').trim();
  const phone = String(req.body?.phone || '').trim();
  const { points } = req.body;
  let tier = req.body?.tier;
  if (!name) {
    return res.status(400).send('Tên khách hàng không được để trống.');
  }
  if (points == null || Number.isNaN(Number(points)) || Number(points) < 0) {
    return res.status(400).send('Điểm khách hàng không hợp lệ.');
  }
  if (tier == null) {
    return res.status(400).send('Hạng khách hàng không hợp lệ.');
  }
  tier = String(tier).trim();
  if (!tier) {
    return res.status(400).send('Hạng khách hàng không hợp lệ.');
  }

  const normalizedTier = tier;
  const allowedTiers = ['Thành viên', 'Bạc', 'Vàng', 'Bạch kim', 'VIP'];
  if (!allowedTiers.includes(normalizedTier)) {
    // Permit some common variants and normalize them automatically
    const tierMap = {
      'Thanh vien': 'Thành viên',
      'Thanh viên': 'Thành viên',
      'bac': 'Bạc',
      'bạc': 'Bạc',
      'vàng': 'Vàng',
      'vang': 'Vàng',
      'bach kim': 'Bạch kim',
      'bạch kim': 'Bạch kim',
      'bach kim': 'Bạch kim',
      'vip': 'VIP'
    };
    const normalizedAscii = normalizedTier
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/gi, ' ')
      .trim()
      .toLowerCase();
    const compactAscii = normalizedAscii.replace(/[^a-z0-9]+/gi, '');
    const key = normalizedAscii || compactAscii;
    const mapped = tierMap[key] || tierMap[normalizedTier.toLowerCase()] || tierMap[compactAscii] || (compactAscii === 'bc' ? 'Bạc' : undefined);
    if (mapped) {
      req.body.tier = mapped;
    } else {
      return res.status(400).send('Hạng khách hàng không hợp lệ.');
    }
  }

  try {
    const customers = await query('SELECT id FROM customers WHERE id = ? LIMIT 1', [customerId]);
    if (customers.length === 0) {
      return res.status(404).send('Khách hàng không tồn tại.');
    }
    await query('UPDATE customers SET name = ?, phone = ?, points = ?, tier = ? WHERE id = ?', [name, phone || null, Number(points), req.body.tier, customerId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send('Không thể cập nhật khách hàng.');
  }
}

app.put('/customers/:id', authenticateToken, authorizeRoles(['admin', 'manager']), handleCustomerUpdate);
app.post('/customers/:id', authenticateToken, authorizeRoles(['admin', 'manager']), handleCustomerUpdate);

app.get('/customers/:id/history', authenticateToken, async (req, res) => {
  const customerId = Number(req.params.id);
  if (Number.isNaN(customerId) || customerId <= 0) {
    return res.status(400).send('ID khách hàng không hợp lệ.');
  }
  try {
    const customers = await query('SELECT id, name, phone, points, tier, created_at FROM customers WHERE id = ? LIMIT 1', [customerId]);
    if (customers.length === 0) {
      return res.status(404).send('Khách hàng không tồn tại.');
    }
    const customer = customers[0];
    const history = await query(
      `SELECT
         order_number,
         SUM(price * quantity) AS total_amount,
         SUM(quantity) AS total_items,
         seller_name,
         payment_method,
         MIN(created_at) AS created_at
       FROM orders
       WHERE customer_id = ?
       GROUP BY order_number, seller_name, payment_method
       ORDER BY MIN(created_at) DESC
       LIMIT 1000`,
      [customerId]
    );
    const grouped = {};
    history.forEach(row => {
      const orderNumber = String(row.order_number || '');
      const parts = orderNumber.split('-');
      const key = parts.length === 4 && /^\d+$/.test(parts[3]) ? parts.slice(0, 3).join('-') : orderNumber;
      if (!grouped[key]) {
        grouped[key] = {
          order_number: key,
          total_amount: 0,
          points_earned: 0,
          payment_method: row.payment_method,
          seller_name: row.seller_name,
          created_at: row.created_at
        };
      }
      grouped[key].total_amount += Number(row.total_amount || 0);
    });
    const historyWithPoints = Object.values(grouped).map(row => ({
      order_number: row.order_number,
      total_amount: Number(row.total_amount || 0),
      points_earned: Math.floor(Number(row.total_amount || 0) / 10000),
      payment_method: row.payment_method,
      seller_name: row.seller_name,
      created_at: row.created_at
    }));
    res.json({ customer, history: historyWithPoints });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải lịch sử khách hàng.');
  }
});

app.post('/orders', authenticateToken, async (req, res) => {
  const { cart, customer = {}, paymentMethod, payment = {}, discountPercent = 0, totalAfterDiscount = null, invoiceType = 'normal' } = req.body;
  const paymentCashReceived = payment && payment.cashReceived != null ? Number(payment.cashReceived) : null;
  const paymentCashChange = payment && payment.cashChange != null ? Number(payment.cashChange) : null;
  const discountPct = discountPercent != null ? Number(discountPercent) : 0;
  const customerCompany = customer.company ? String(customer.company).trim() : null;
  const customerTaxCode = customer.taxCode ? String(customer.taxCode).trim() : null;
  if (!Array.isArray(cart) || cart.length === 0) {
    return res.status(400).send('Giỏ hàng không hợp lệ.');
  }

  const baseOrderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
  const sellerName = req.user.username;
  const sellerId = req.user.id;
  const method = paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt';

  const totalAmount = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const computedTotalAfter = totalAfterDiscount != null ? Number(totalAfterDiscount) : +(totalAmount * (1 - discountPct / 100)).toFixed(2);
  const earnedPoints = Math.floor(computedTotalAfter / 10000);
  const phone = customer.phone ? String(customer.phone).trim() : null;
  const name = customer.name ? String(customer.name).trim() : null;
  let customerId = null;
  let currentPoints = null;

  try {
    if (phone || name) {
      if (phone) {
        const existing = await query('SELECT id, points FROM customers WHERE phone = ? LIMIT 1', [phone]);
        if (existing.length > 0) {
          customerId = existing[0].id;
          currentPoints = Number(existing[0].points || 0) + earnedPoints;
          await query("UPDATE customers SET name = COALESCE(NULLIF(?, ''), name), points = points + ? WHERE id = ?", [name || existing[0].name || null, earnedPoints, customerId]);
        } else {
          const result = await query('INSERT INTO customers (name, phone, points) VALUES (?, ?, ?)', [name || null, phone, earnedPoints]);
          customerId = result.insertId;
          currentPoints = earnedPoints;
        }
      } else {
        const result = await query('INSERT INTO customers (name, phone, points) VALUES (?, ?, ?)', [name, null, earnedPoints]);
        customerId = result.insertId;
        currentPoints = earnedPoints;
      }
    }

    const orderRecords = cart.map((item) => {
      const itemDiscount = Number(item.discountPercent || 0);
      return [
        item.product_id || null,
        item.product_name || null,
        item.price || 0,
        item.quantity || 1,
        sellerId,
        sellerName,
        baseOrderNumber,
        method,
        paymentCashReceived,
        paymentCashChange,
        itemDiscount,
        computedTotalAfter,
        customerId,
        name || null,
        phone || null,
        customerCompany,
        customerTaxCode,
        invoiceType || null
      ];
    });

    // Insert orders including payment cash fields if available
    await query(
      `INSERT INTO orders (product_id, product_name, price, quantity, seller_id, seller_name, order_number, payment_method, payment_cash_received, payment_cash_change, discount_percent, total_after_discount, customer_id, customer_name, customer_phone, customer_company, customer_tax_code, invoice_type)
       VALUES ?`,
      [orderRecords]
    );

    for (const item of cart) {
      if (!item.product_id || !item.quantity) continue;
      await query('UPDATE products SET stock = GREATEST(stock - ?, 0) WHERE id = ?', [item.quantity, item.product_id]);
    }

    res.json({ success: true, orderNumber: baseOrderNumber, pointsEarned: currentPoints != null ? earnedPoints : 0, currentPoints });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi xử lý đơn hàng.');
  }
});

// Dashboard route: minimal client to verify UI
app.get('/dashboard', async (req, res) => {
  try {
    const [productCountRow] = await query('SELECT COUNT(*) AS productCount FROM products');
    const [orderCountRow] = await query('SELECT COUNT(*) AS orderCount FROM orders');
    const [salesTotalRow] = await query('SELECT COALESCE(SUM(price * quantity), 0) AS salesTotal FROM orders');
    const [todayTotalRow] = await query(
      `SELECT COALESCE(SUM(price * quantity), 0) AS todayTotal
       FROM orders
       WHERE DATE(created_at) = CURRENT_DATE()`
    );
    const [categoryCountRow] = await query('SELECT COUNT(DISTINCT category) AS categoryCount FROM products');

    res.json({
      productCount: Number(productCountRow.productCount || 0),
      orderCount: Number(orderCountRow.orderCount || 0),
      salesTotal: Number(salesTotalRow.salesTotal || 0),
      todayTotal: Number(todayTotalRow.todayTotal || 0),
      categoryCount: Number(categoryCountRow.categoryCount || 0)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi tải dashboard.');
  }
});

// Finalize DB then serve static `public/` and start listener
ensureDatabase()
  .then(() => {
    // Debug: show router stack info before attaching static and listening
    try {
      console.log('DEBUG: app._router present =', !!app._router);
      console.log('DEBUG: app._router.stack length =', app._router && app._router.stack ? app._router.stack.length : 0);
    } catch (e) { console.log('DEBUG: router inspect error', e); }
    // Serve static files from the project's public directory
    app.use(express.static(path.join(__dirname, '..', 'public')));

    app.listen(PORT, () => {
      console.log("Server chạy tại http://localhost:" + PORT);
      try {
        const routes = [];
        if (app._router && Array.isArray(app._router.stack)) {
          app._router.stack.forEach(mw => {
            if (mw.route && mw.route.path) {
              const methods = Object.keys(mw.route.methods).join(',').toUpperCase();
              routes.push(`${methods} ${mw.route.path}`);
            }
          });
          console.log('Registered routes:\n' + routes.join('\n'));
        } else {
          console.log('No Express router stack available to list routes.');
        }
      } catch (e) {
        console.log('Could not list routes', e);
      }
    });
  })
  .catch(err => {
    console.error("Lỗi khởi tạo cơ sở dữ liệu:", err);
    process.exit(1);
  });
