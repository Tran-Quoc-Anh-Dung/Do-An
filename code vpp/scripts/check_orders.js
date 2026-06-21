(async () => {
  try {
    const res = await fetch('http://localhost:3000/orders');
    const orders = await res.json();
    console.log('Latest orders (first 5):', orders.slice(0,5));
  } catch (err) {
    console.error('Error fetching orders:', err);
  }
})();
