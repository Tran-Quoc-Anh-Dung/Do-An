
require("dotenv").config();

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

// Diagnostic: quick handler to verify POST reachability (temporary)
app.post('/_diag_products_bulk_delete', (req, res) => {
  console.log('Received diagnostic bulk-delete POST, body:', req.body);
  res.json({ ok: true, received: req.body });
});

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}


async function ensureColumn(table, column, definition) {
  const columns = await query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  if (columns.length === 0) {
    await query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
  }
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

async function ensureDatabase() {
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
  await ensureColumn("orders", "created_at", "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
  await ensureColumn("orders", "order_number", "order_number VARCHAR(50) DEFAULT NULL");

  const users = await query("SELECT COUNT(*) AS total FROM users");
  if (users[0].total === 0) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    await query(
      "INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)",
      ["admin", passwordHash, "admin", "Quản trị hệ thống"]
    );
    console.log("Tạo tài khoản admin mặc định: admin / admin123");
  }

  const products = await query("SELECT COUNT(*) AS total FROM products");
  if (products[0].total === 0) {
    await query(
      "INSERT INTO products (name, description, category, code, price, stock, image) VALUES ?",
      [[
        ["Bút bi cao cấp", "Bút bi mực êm, thiết kế thời trang.", "Bút viết", "BT001", 8500.00, 120, "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=600&q=80"],
        ["Sổ tay B5", "Sổ tay lót kẻ ô tiện dụng.", "Sổ tay", "ST001", 29000.00, 80, "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=600&q=80"],
        ["Hồ dán 50g", "Keo dán đa năng dùng cho giấy và vải.", "Keo dán", "KG001", 18000.00, 150, "https://images.unsplash.com/photo-1589561084283-930aa7b1f76d?auto=format&fit=crop&w=600&q=80"],
        ["Bìa kẹp hồ sơ", "Bìa kẹp nhiều màu sắc, chắc chắn.", "Văn phòng phẩm", "BK001", 12000.00, 200, "https://images.unsplash.com/photo-1557682250-4fbc0ba0eb36?auto=format&fit=crop&w=600&q=80"],
        ["Giấy in A4", "Giấy in chất lượng cao, 70gsm.", "Giấy in", "GA4-70", 95000.00, 60, "https://images.unsplash.com/photo-1511006913847-e60e7a4e2f65?auto=format&fit=crop&w=600&q=80"],
        ["Bấm kim số 10", "Máy bấm kim cầm tay tiện lợi.", "Dụng cụ", "BM001", 22000.00, 90, "https://images.unsplash.com/photo-1493119508027-2b584f234d6c?auto=format&fit=crop&w=600&q=80"]
      ]]
    );
    console.log("Đã tạo dữ liệu sản phẩm mẫu.");
  }

  // Create categories table for canonical category management
  await query(`CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    slug VARCHAR(180) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  await ensureColumn("categories", "slug", "slug VARCHAR(180) DEFAULT NULL");
  await ensureColumn("categories", "status", "status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'");

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

function authorizeRoles(roles = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).send("Forbidden");
    }
    next();
  };
}

app.post("/auth/register", authenticateToken, authorizeRoles(["admin"]), async (req, res) => {
  const { username, password, full_name, role } = req.body;
  if (!username || !password) {
    return res.status(400).send("Username and password are required.");
  }
  if (role && !ALLOWED_ROLES.includes(role)) {
    return res.status(400).send("Vai trò không hợp lệ.");
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await query(
      "INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)",
      [username, passwordHash, full_name || null, role || "seller"]
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

// Finalize DB then serve static `public/` and start listener
ensureDatabase()
  .then(() => {
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
