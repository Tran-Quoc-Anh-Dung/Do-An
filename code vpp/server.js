// ===================== START SERVER =====================
console.log("Đang khởi động server...");

// ===================== IMPORT =====================
const express = require("express");
const cors = require("cors");
const db = require("./database");

// ===================== INIT APP =====================
const app = express();

// ===================== MIDDLEWARE =====================
app.use(cors());
app.use(express.json());

// ===================== CHECK =====================
console.log("Server đang chạy...");

// ===================== API GET PRODUCTS =====================
app.get("/products", (req, res) => {
  console.log("GET /products");

  db.query("SELECT * FROM products", (err, result) => {
    if (err) {
      console.log("DB ERROR:", err);
      return res.status(500).json({ error: err });
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

  cart.forEach(item => {
    db.query(
      "INSERT INTO orders (product_name, price) VALUES (?, ?)",
      [item.name, item.price],
      (err) => {
        if (err) console.log("Insert error:", err);
      }
    );
  });

  res.send("OK");
});

// ===================== START SERVER =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server chạy tại http://localhost:" + PORT);
});