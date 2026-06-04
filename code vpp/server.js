// ===================== START SERVER =====================
console.log("Đang khởi động server...");

// ===================== IMPORT =====================
const path = require("path");
const express = require("express");
const cors = require("cors");
const db = require("./database");

// ===================== INIT APP =====================
const app = express();

// ===================== MIDDLEWARE =====================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ===================== CHECK =====================
console.log("Server đang chạy...");

// ===================== API GET PRODUCTS =====================
app.get("/products", (req, res) => {
  console.log("GET /products");

  db.query("SELECT * FROM products", (err, result) => {
    if (err) {
      console.log("DB ERROR:", err);
      return res.status(500).json({ error: err.message || err });
    }
    res.json(result);
  });
});

// ===================== API POST ORDERS =====================
app.post("/orders", (req, res) => {
  const cart = req.body.cart;

  if (!cart || cart.length === 0) {
    return res.status(400).send("Cart empty");
  }

  const queries = cart.map(item => {
    return new Promise((resolve, reject) => {
      db.query(
        "INSERT INTO orders (product_id, product_name, price, quantity) VALUES (?, ?, ?, ?)",
        [item.product_id || null, item.product_name, item.price, item.quantity || 1],
        err => {
          if (err && err.code === 'ER_BAD_FIELD_ERROR') {
            db.query(
              "INSERT INTO orders (product_name, price, quantity) VALUES (?, ?, ?)",
              [item.product_name, item.price, item.quantity || 1],
              err2 => {
                if (err2) return reject(err2);
                resolve();
              }
            );
            return;
          }
          if (err) return reject(err);
          resolve();
        }
      );
    });
  });

  Promise.all(queries)
    .then(() => res.send("Đơn hàng đã được ghi nhận."))
    .catch(err => {
      console.error("Insert error:", err);
      res.status(500).send("Không thể lưu đơn hàng.");
    });
});

// ===================== START SERVER =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server chạy tại http://localhost:" + PORT);
});
