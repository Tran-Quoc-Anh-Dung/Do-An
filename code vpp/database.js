const mysql = require("mysql");

const db = mysql.createConnection({
  host: "VPP",
  user: "ANHDUNG",
  password: "123",
  database: "pos_db",
});

db.connect(err => {
  if (err) {
    console.log("Lỗi kết nối:", err);
  } else {
    console.log("Kết nối MySQL thành công");
  }
});

module.exports = db;