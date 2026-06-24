const db = require('./src/database');

db.query('SELECT id, name, status FROM suppliers ORDER BY name', (err, suppliers) => {
  if (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
  
  console.log('=== SUPPLIERS ===');
  suppliers.forEach((s, i) => {
    console.log(`${i+1}. ID: ${s.id}, Name: ${s.name}, Status: ${s.status}`);
  });
  
  // Check duplicates
  const grouped = {};
  suppliers.forEach(s => {
    if (!grouped[s.name]) grouped[s.name] = [];
    grouped[s.name].push(s.id);
  });
  
  console.log('\n=== DUPLICATES ===');
  let hasDuplicates = false;
  Object.entries(grouped).forEach(([name, ids]) => {
    if (ids.length > 1) {
      console.log(`${name}: IDs ${ids.join(', ')}`);
      hasDuplicates = true;
    }
  });
  if (!hasDuplicates) {
    console.log('No duplicates found.');
  }
  
  // Check products per supplier
  console.log('\n=== PRODUCTS PER SUPPLIER ===');
  let checked = 0;
  suppliers.forEach(supplier => {
    db.query('SELECT COUNT(*) as count FROM products WHERE supplier_id = ?', [supplier.id], (err, results) => {
      const count = results[0]?.count || 0;
      console.log(`${supplier.name} (ID: ${supplier.id}): ${count} products`);
      checked++;
      if (checked === suppliers.length) {
        process.exit(0);
      }
    });
  });
});
