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
app.use(express.static(path.join(__dirname)));

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
  await ensureColumn("products", "category", "category VARCHAR(100) DEFAULT NULL");
  await ensureColumn("products", "category_id", "category_id INT DEFAULT NULL");

  await ensureColumn("orders", "product_id", "product_id INT DEFAULT NULL");
  await ensureColumn("orders", "product_name", "product_name VARCHAR(255) DEFAULT NULL");
  await ensureColumn("orders", "price", "price DECIMAL(10,2) DEFAULT 0");
  await ensureColumn("orders", "quantity", "quantity INT NOT NULL DEFAULT 1");
  await ensureColumn("orders", "seller_id", "seller_id INT DEFAULT NULL");
  await ensureColumn("orders", "seller_name", "seller_name VARCHAR(120) DEFAULT NULL");
  await ensureColumn("orders", "created_at", "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

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

  // Create branches table for store/warehouse management
  await query(`CREATE TABLE IF NOT EXISTS branches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    location VARCHAR(255) DEFAULT NULL,
    manager_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  // Create product-branch association table
  await query(`CREATE TABLE IF NOT EXISTS branch_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    branch_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT DEFAULT 0,
    UNIQUE KEY unique_branch_product (branch_id, product_id),
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  // Create inventory logs table
  await query(`CREATE TABLE IF NOT EXISTS inventory_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    branch_id INT DEFAULT NULL,
    quantity_change INT NOT NULL,
    reason VARCHAR(100) DEFAULT NULL,
    created_by INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (branch_id) REFERENCES branches(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  try {
    const catRows = await query("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND TRIM(category) != ''");
    for (const r of catRows) {
      const name = r.category;
      if (!name) continue;
      await query("INSERT IGNORE INTO categories (name, slug) VALUES (?, ?)", [name, name.replace(/\s+/g, '-').toLowerCase()]);
    }
  } catch (e) {
    console.error('Category migration failed:', e);
  }
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

app.post("/auth/register", async (req, res) => {
  const { username, password, full_name, role } = req.body;
  if (!username || !password) {
    return res.status(400).send("Username and password are required.");
  }

  let newRole = "seller";
  const authHeader = req.headers.authorization;
  let currentRole = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const payload = jwt.verify(token, AUTH_SECRET);
      currentRole = payload.role;
    } catch (_) {
      currentRole = null;
    }
  }

  if (role && ALLOWED_ROLES.includes(role)) {
    if (currentRole === "admin") {
      newRole = role;
    } else if (currentRole === "manager" && role === "seller") {
      newRole = "seller";
    }
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await query(
      "INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)",
      [username, passwordHash, full_name || null, newRole]
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

app.put("/auth/change-password", authenticateToken, async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;
  if (!oldPassword || !newPassword || !confirmPassword) {
    return res.status(400).send("Vui lòng nhập đủ thông tin.");
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).send("Mật khẩu mới không trùng khớp.");
  }
  if (newPassword.length < 6) {
    return res.status(400).send("Mật khẩu mới phải có ít nhất 6 ký tự.");
  }

  try {
    const users = await query("SELECT * FROM users WHERE id = ? LIMIT 1", [req.user.id]);
    if (users.length === 0) {
      return res.status(404).send("Người dùng không tồn tại.");
    }
    const user = users[0];
    const passwordMatch = await bcrypt.compare(oldPassword, user.password);
    if (!passwordMatch) {
      return res.status(401).send("Mật khẩu cũ không đúng.");
    }
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await query("UPDATE users SET password = ? WHERE id = ?", [newPasswordHash, req.user.id]);
    res.send("Đổi mật khẩu thành công.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi đổi mật khẩu.");
  }
});

app.get("/users", authenticateToken, authorizeRoles(["admin"]), async (req, res) => {
  try {
    const users = await query("SELECT id, username, role, full_name, created_at FROM users ORDER BY created_at DESC");
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi lấy danh sách người dùng.");
  }
});

app.delete("/users/:id", authenticateToken, authorizeRoles(["admin"]), async (req, res) => {
  const userId = Number(req.params.id);
  if (!userId) {
    return res.status(400).send("ID không hợp lệ.");
  }

  try {
    await query("DELETE FROM users WHERE id = ?", [userId]);
    res.send("Xóa tài khoản thành công.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi xóa tài khoản.");
  }
});

app.get("/branches", authenticateToken, async (req, res) => {
  try {
    const branches = await query("SELECT id, name, location, manager_id, created_at FROM branches ORDER BY name");
    res.json(branches);
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi lấy danh sách chi nhánh.");
  }
});

app.post("/branches", authenticateToken, authorizeRoles(["admin"]), async (req, res) => {
  const { name, location, manager_id } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).send("Tên chi nhánh là bắt buộc.");
  }
  try {
    await query("INSERT INTO branches (name, location, manager_id) VALUES (?, ?, ?)", [name.trim(), location || null, manager_id || null]);
    res.send("Tạo chi nhánh thành công.");
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).send("Tên chi nhánh đã tồn tại.");
    }
    console.error(err);
    res.status(500).send("Không thể tạo chi nhánh.");
  }
});

app.put("/branches/:id", authenticateToken, authorizeRoles(["admin"]), async (req, res) => {
  const id = Number(req.params.id);
  const { name, location, manager_id } = req.body;
  if (!id || !name) {
    return res.status(400).send("Dữ liệu không hợp lệ.");
  }
  try {
    await query("UPDATE branches SET name = ?, location = ?, manager_id = ? WHERE id = ?", [name.trim(), location || null, manager_id || null, id]);
    res.send("Cập nhật chi nhánh thành công.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Không thể cập nhật chi nhánh.");
  }
});

app.delete("/branches/:id", authenticateToken, authorizeRoles(["admin"]), async (req, res) => {
  const id = Number(req.params.id);
  if (!id) {
    return res.status(400).send("ID không hợp lệ.");
  }
  try {
    await query("DELETE FROM branches WHERE id = ?", [id]);
    res.send("Xóa chi nhánh thành công.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Không thể xóa chi nhánh.");
  }
});

app.get("/branch-products/:branchId", authenticateToken, async (req, res) => {
  const branchId = Number(req.params.branchId);
  if (!branchId) {
    return res.status(400).send("ID chi nhánh không hợp lệ.");
  }
  try {
    const products = await query(
      "SELECT p.*, bp.quantity as branch_quantity FROM products p LEFT JOIN branch_products bp ON p.id = bp.product_id AND bp.branch_id = ? ORDER BY p.name",
      [branchId]
    );
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi lấy sản phẩm chi nhánh.");
  }
});

app.post("/branch-products", authenticateToken, authorizeRoles(["admin", "manager"]), async (req, res) => {
  const { branch_id, product_id, quantity } = req.body;
  if (!branch_id || !product_id) {
    return res.status(400).send("Dữ liệu không hợp lệ.");
  }
  try {
    await query(
      "INSERT INTO branch_products (branch_id, product_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = ?",
      [branch_id, product_id, quantity || 0, quantity || 0]
    );
    res.send("Cập nhật sản phẩm chi nhánh thành công.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Không thể cập nhật sản phẩm chi nhánh.");
  }
});

app.get("/inventory", authenticateToken, authorizeRoles(["admin", "manager"]), async (req, res) => {
  try {
    const logs = await query(
      "SELECT il.*, p.name as product_name, b.name as branch_name, u.username as created_by_user FROM inventory_logs il LEFT JOIN products p ON il.product_id = p.id LEFT JOIN branches b ON il.branch_id = b.id LEFT JOIN users u ON il.created_by = u.id ORDER BY il.created_at DESC LIMIT 100"
    );
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi lấy logs tồn kho.");
  }
});

app.post("/inventory/import", authenticateToken, authorizeRoles(["admin", "manager"]), async (req, res) => {
  const { product_id, branch_id, quantity } = req.body;
  if (!product_id || !quantity || quantity <= 0) {
    return res.status(400).send("Dữ liệu không hợp lệ.");
  }
  try {
    const products = await query("SELECT stock FROM products WHERE id = ? LIMIT 1", [product_id]);
    if (products.length === 0) {
      return res.status(404).send("Sản phẩm không tồn tại.");
    }
    await query("UPDATE products SET stock = stock + ? WHERE id = ?", [quantity, product_id]);
    if (branch_id) {
      await query(
        "INSERT INTO branch_products (branch_id, product_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + ?",
        [branch_id, product_id, quantity, quantity]
      );
    }
    await query("INSERT INTO inventory_logs (product_id, branch_id, quantity_change, reason, created_by) VALUES (?, ?, ?, ?, ?)", 
      [product_id, branch_id || null, quantity, "import", req.user.id]
    );
    res.send("Nhập hàng thành công.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Không thể nhập hàng.");
  }
});

app.post("/inventory/export", authenticateToken, authorizeRoles(["admin", "manager"]), async (req, res) => {
  const { product_id, branch_id, quantity } = req.body;
  if (!product_id || !quantity || quantity <= 0) {
    return res.status(400).send("Dữ liệu không hợp lệ.");
  }
  try {
    const products = await query("SELECT stock FROM products WHERE id = ? LIMIT 1", [product_id]);
    if (products.length === 0) {
      return res.status(404).send("Sản phẩm không tồn tại.");
    }
    if (products[0].stock < quantity) {
      return res.status(400).send("Số lượng tồn kho không đủ.");
    }
    await query("UPDATE products SET stock = stock - ? WHERE id = ?", [quantity, product_id]);
    if (branch_id) {
      await query(
        "UPDATE branch_products SET quantity = GREATEST(0, quantity - ?) WHERE branch_id = ? AND product_id = ?",
        [quantity, branch_id, product_id]
      );
    }
    await query("INSERT INTO inventory_logs (product_id, branch_id, quantity_change, reason, created_by) VALUES (?, ?, ?, ?, ?)", 
      [product_id, branch_id || null, -quantity, "export", req.user.id]
    );
    res.send("Xuất hàng thành công.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Không thể xuất hàng.");
  }
});

app.get("/categories", async (req, res) => {
  try {
    const rows = await query("SELECT id, name FROM categories ORDER BY name");
    const result = rows.map(r => ({ id: r.id, value: r.name, label: r.name }));
    result.unshift({ id: 0, value: 'all', label: 'Tất cả' });
    result.push({ id: -1, value: 'no-orders', label: 'Chưa có đơn hàng' });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi lấy danh mục.");
  }
});

app.post('/categories', authenticateToken, authorizeRoles(['admin','manager']), async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).send('Tên danh mục là bắt buộc.');
  try {
    const slug = name.trim().replace(/\s+/g,'-').toLowerCase();
    await query('INSERT INTO categories (name, slug) VALUES (?, ?)', [name.trim(), slug]);
    res.send('Tạo danh mục thành công.');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).send('Danh mục đã tồn tại.');
    console.error(err);
    res.status(500).send('Không thể tạo danh mục.');
  }
});

app.put('/categories/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  const id = Number(req.params.id);
  const { name } = req.body;
  if (!id || !name) return res.status(400).send('Dữ liệu không hợp lệ.');
  try {
    const slug = name.trim().replace(/\s+/g,'-').toLowerCase();
    await query('UPDATE categories SET name = ?, slug = ? WHERE id = ?', [name.trim(), slug, id]);
    res.send('Cập nhật danh mục thành công.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Không thể cập nhật danh mục.');
  }
});

app.delete('/categories/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).send('ID không hợp lệ.');
  try {
    // Before deleting, set products with this category to NULL
    const rows = await query('SELECT name FROM categories WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return res.status(404).send('Danh mục không tồn tại.');
    const name = rows[0].name;
    await query('UPDATE products SET category = NULL WHERE category = ?', [name]);
    await query('DELETE FROM categories WHERE id = ?', [id]);
    res.send('Xóa danh mục thành công.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Không thể xóa danh mục.');
  }
});

app.get("/products", async (req, res) => {
  try {
    const category = req.query.category;
    let products;
    if (category && category !== 'all') {
      if (category === 'no-orders') {
        // Products that have never appeared in orders
        products = await query("SELECT p.* FROM products p LEFT JOIN orders o ON p.id = o.product_id WHERE o.id IS NULL ORDER BY p.name");
      } else {
        products = await query("SELECT * FROM products WHERE category = ? ORDER BY name", [category]);
      }
    } else {
      products = await query("SELECT * FROM products ORDER BY name");
    }
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || err });
  }
});

app.post("/products", authenticateToken, authorizeRoles(["admin", "manager"]), async (req, res) => {
  const { name, description, category, code, price, stock, image } = req.body;
  if (!name || !price) {
    return res.status(400).send("Tên và giá sản phẩm là bắt buộc.");
  }

  try {
    // If category provided, ensure it exists in categories table
    if (category && String(category).trim()) {
      const cats = await query('SELECT id FROM categories WHERE name = ? LIMIT 1', [category]);
      if (cats.length === 0) {
        return res.status(400).send('Danh mục không tồn tại. Vui lòng tạo danh mục trước.');
      }
    }
    await query(
      "INSERT INTO products (name, description, category, code, price, stock, image) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [name, description || null, category || null, code || null, price, stock || 0, image || null]
    );
    res.send("Tạo sản phẩm thành công.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Không thể tạo sản phẩm.");
  }
});

app.put("/products/:id", authenticateToken, authorizeRoles(["admin", "manager"]), async (req, res) => {
  const productId = Number(req.params.id);
  const { name, description, category, code, price, stock, image } = req.body;
  if (!productId || !name || !price) {
    return res.status(400).send("Thông tin sản phẩm không hợp lệ.");
  }

  try {
    // If category provided, ensure it exists
    if (category && String(category).trim()) {
      const cats = await query('SELECT id FROM categories WHERE name = ? LIMIT 1', [category]);
      if (cats.length === 0) {
        return res.status(400).send('Danh mục không tồn tại. Vui lòng tạo danh mục trước.');
      }
    }
    await query(
      "UPDATE products SET name = ?, description = ?, category = ?, code = ?, price = ?, stock = ?, image = ? WHERE id = ?",
      [name, description || null, category || null, code || null, price, stock || 0, image || null, productId]
    );
    res.send("Cập nhật sản phẩm thành công.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Không thể cập nhật sản phẩm.");
  }
});

app.delete("/products/:id", authenticateToken, authorizeRoles(["admin"]), async (req, res) => {
  const productId = Number(req.params.id);
  if (!productId) {
    return res.status(400).send("ID sản phẩm không hợp lệ.");
  }

  try {
    await query("DELETE FROM products WHERE id = ?", [productId]);
    res.send("Xóa sản phẩm thành công.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Không thể xóa sản phẩm.");
  }
});

app.get("/dashboard", authenticateToken, async (req, res) => {
  try {
    const summaryFilter = req.user.role === "seller" ? "WHERE seller_id = ?" : "";
    const summaryParams = req.user.role === "seller" ? [req.user.id] : [];
    const productCount = await query("SELECT COUNT(*) AS total FROM products");
    const orderCount = await query(`SELECT COUNT(*) AS total FROM orders ${summaryFilter}`, summaryParams);
    const salesTotal = await query(`SELECT IFNULL(SUM(price * quantity), 0) AS total FROM orders ${summaryFilter}`, summaryParams);
    const todayTotal = await query(
      `SELECT IFNULL(SUM(price * quantity), 0) AS total FROM orders ${summaryFilter} ${summaryFilter ? "AND" : "WHERE"} DATE(created_at) = CURDATE()`,
      summaryParams
    );

    res.json({
      productCount: productCount[0].total,
      orderCount: orderCount[0].total,
      salesTotal: salesTotal[0].total,
      todayTotal: todayTotal[0].total
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi lấy thông tin dashboard.");
  }
});

app.post("/orders", authenticateToken, async (req, res) => {
  // Only sellers, managers, and admins can create orders through POS
  if (!["admin", "manager", "seller"].includes(req.user.role)) {
    return res.status(403).send("Bạn không có quyền tạo đơn hàng.");
  }

  const cart = req.body.cart;
  if (!Array.isArray(cart) || cart.length === 0) {
    return res.status(400).send("Giỏ hàng trống");
  }

  try {
    for (const item of cart) {
      const productId = Number(item.product_id);
      const quantity = Number(item.quantity || 1);
      if (!productId || quantity <= 0) {
        return res.status(400).send("Dữ liệu giỏ hàng không hợp lệ.");
      }

      const products = await query("SELECT id, stock, name, price FROM products WHERE id = ? LIMIT 1", [productId]);
      if (products.length === 0) {
        return res.status(400).send("Sản phẩm không tồn tại.");
      }
      const product = products[0];
      if (product.stock < quantity) {
        return res.status(400).send(`Sản phẩm ${product.name} chỉ còn ${product.stock} chiếc.`);
      }

      let price = Number(item.price);
      if (!Number.isFinite(price) || price <= 0) {
        price = Number(product.price) || 0;
      }

      await query(
        "INSERT INTO orders (product_id, product_name, price, quantity, seller_id, seller_name) VALUES (?, ?, ?, ?, ?, ?)",
        [productId, item.product_name || product.name, price, quantity, req.user.id, req.user.username]
      );
      await query("UPDATE products SET stock = stock - ? WHERE id = ?", [quantity, productId]);
      await query("INSERT INTO inventory_logs (product_id, quantity_change, reason, created_by) VALUES (?, ?, ?, ?)", 
        [productId, -quantity, "sales", req.user.id]
      );
    }

    res.send("Đơn hàng đã được ghi nhận.");
  } catch (err) {
    console.error("Insert error:", err);
    res.status(500).send("Không thể lưu đơn hàng.");
  }
});

app.get("/orders", authenticateToken, async (req, res) => {
  try {
    let sql = "SELECT o.*, u.full_name AS seller_full_name FROM orders o LEFT JOIN users u ON o.seller_id = u.id";
    const params = [];
    if (req.user.role === "seller") {
      sql += " WHERE o.seller_id = ?";
      params.push(req.user.id);
    }
    sql += " ORDER BY o.created_at DESC";
    const orders = await query(sql, params);
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi lấy đơn hàng.");
  }
});

app.get("/reports/sales", authenticateToken, authorizeRoles(["admin", "manager"]), async (req, res) => {
  try {
    const daily = await query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS orders, IFNULL(SUM(price * quantity), 0) AS total_sales FROM orders GROUP BY DATE(created_at) ORDER BY DATE(created_at) DESC LIMIT 30`
    );
    const weeklyRows = await query(
      `SELECT YEAR(created_at) AS year, WEEK(created_at, 1) AS week, COUNT(*) AS orders, IFNULL(SUM(price * quantity), 0) AS total_sales FROM orders GROUP BY year, week ORDER BY year DESC, week DESC LIMIT 12`
    );
    const weekly = weeklyRows.map(row => ({
      week: `${row.year}-W${String(row.week).padStart(2, '0')}`,
      orders: row.orders,
      total_sales: row.total_sales
    }));
    res.json({ daily, weekly });
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi lấy báo cáo doanh thu.");
  }
});

ensureDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log("Server chạy tại http://localhost:" + PORT);
    });
  })
  .catch(err => {
    console.error("Lỗi khởi tạo cơ sở dữ liệu:", err);
    process.exit(1);
  });
