// log để kiểm tra server 
console.log("Đang khởi động server...");

// Import thư viện 
const express = require("express"); // tạo server
const cors = require("cors");       // cho phép frontend gọi API
const db = require("./database");         // file kết nối MySQL

// API lấy sản phẩm từ MYSQL
app.get("/products", (req, res) => {
  db.query("SELECT * FROM products", (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

// tạo app
const app = express();

// Cho phép truy cập
app.use(cors());
app.use(express.json());

app.get("/products", (req, res) => {
  console.log("Có request /products"); // kiểm tra gọi API

  // Câu lệnh SQL lấy toàn bộ sản phẩm
  db.query("SELECT * FROM products", (err, result) => {

    // kiểm tra lỗi
    if (err) {
      console.log("Lỗi truy vấn DB:", err);
      res.send(err);
    } 
    else {
      res.json(result);
    }
  });
});

/*KHỞI ĐỘNG SERVER*/
app.listen(3000, () => {
  console.log("Server chạy tại http://localhost:3000");
});

app.use(express.json());

// API lưu đơn hàng
app.post("/orders", (req, res) => {
  const cart = req.body.cart;

  console.log("Đơn hàng:", cart);

  res.send("OK");
});

app.use(express.json());

app.post("/orders", (req, res) => {
  const cart = req.body.cart;

  cart.forEach(item => {
    db.query(
      "INSERT INTO orders (product_name, price) VALUES (?, ?)",
      [item.name, item.price]
    );
  });

  res.send("OK");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server chạy");
});

const cors = require("cors");
app.use(cors());
app.use(express.json());

app.get("/products", (req, res) => {
  db.query("SELECT * FROM products", (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});