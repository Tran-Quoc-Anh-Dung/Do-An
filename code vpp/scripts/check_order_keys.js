(async () => {
  try {
    const res = await fetch('http://localhost:3000/orders');
    const orders = await res.json();
    const o = orders[0];
    console.log('Keys:', Object.keys(o));
    console.log('Order 0 raw:', JSON.stringify(o, null, 2));
  } catch (err) {
    console.error('Error fetching orders:', err);
  }
})();
