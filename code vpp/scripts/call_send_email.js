(async () => {
  try {
    const orderNumber = 'ORD-1782287598231-497';
    const res = await fetch('http://localhost:3000/gtgt-send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber, email: 'test@example.com' })
    });
    console.log('Status', res.status);
    const text = await res.text();
    console.log(text);
  } catch (e) {
    console.error(e);
  }
})();
