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
    const token = login.token;

    const rawTotal = 10000;
    const discountPercent = 2;
    const totalAfter = +(rawTotal - rawTotal * (discountPercent/100));

    const orderBody = {
      cart: [{ product_id: 1, product_name: 'Bút thử', price: 5000, quantity: 2 }],
      paymentMethod: 'cash',
      customer: { name: 'Khách VIP', phone: '0987654321' },
      payment: { cashReceived: 10000, cashChange: 0 },
      discountPercent: discountPercent,
      totalAfterDiscount: totalAfter
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
