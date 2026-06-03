require("dotenv").config();
const mysql = require("mysql2");

console.log("ENV CHECK:", process.env.DB_HOST, process.env.DB_USER);

const conn = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

conn.connect((err) => {
  if (err) {
    console.log("❌ DB FAIL:", err);
  } else {
    console.log("✅ DB OK");
  }
});