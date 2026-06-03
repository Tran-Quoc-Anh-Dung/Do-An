const mysql = require("mysql");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
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