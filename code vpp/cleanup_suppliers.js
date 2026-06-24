const db = require('./src/database');

// Merge supplier 119 vào 114 (xóa 119)
const oldSupplierId = 119;
const newSupplierId = 114;

db.query(
  'DELETE FROM suppliers WHERE id = ?',
  [oldSupplierId],
  (err) => {
    if (err) {
      console.error('Error deleting duplicate supplier:', err.message);
      process.exit(1);
    }
    console.log(`✓ Đã xóa nhà cung cấp duplicate (ID: ${oldSupplierId})`);
    process.exit(0);
  }
);
