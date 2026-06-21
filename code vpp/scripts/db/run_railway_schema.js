require('dotenv').config();
const fs = require('fs');
const mysql = require('mysql2/promise');

async function run() {
  const sql = fs.readFileSync('railway_schema.sql', 'utf8');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || undefined,
    charset: 'utf8mb4'
  });

  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    console.log('Executing:', stmt.split('\n')[0]);
    await connection.query(stmt);
  }
  await connection.end();
  console.log('Railway schema import complete.');
}

run().catch(err => {
  console.error('Import failed:', err.message || err);
  process.exit(1);
});