require("dotenv").config();

const mysql = require("mysql2");
console.log("ENV CHECK:", process.env.DB_USER, process.env.DB_PASSWORD);

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

module.exports = db;