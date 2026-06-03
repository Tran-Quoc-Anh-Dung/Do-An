require("dotenv").config();
const mysql = require("mysql");

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
});

db.connect(err => {
  if (err) {
    console.log("❌ Lỗi kết nối:", err);
  } else {
    console.log("✅ Kết nối MySQL online thành công");
  }
});

module.exports = db;