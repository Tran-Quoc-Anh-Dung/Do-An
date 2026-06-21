(async () => {
  try {
    const base = 'http://localhost:3000';
    const loginRes = await fetch(base + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const login = await loginRes.json();
    if (!login.token) return console.error('Login failed', login);
    console.log('Got token');
    const token = login.token;

    const orderBody = {
      cart: [{ product_id: 1, product_name: 'Bút thử', price: 5300, quantity: 1 }],
      paymentMethod: 'cash',
      customer: { name: 'Khách thử', phone: '0123456789' },
      payment: { cashReceived: 10000, cashChange: 4700 }
    };

    const res = await fetch(base + '/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(orderBody)
    });
    const result = await res.json();
    console.log('Order create response:', result);
  } catch (err) {
    console.error('Error:', err);
  }
})();
